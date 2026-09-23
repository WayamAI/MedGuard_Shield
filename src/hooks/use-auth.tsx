import * as React from "react";
import { api, ApiError, setAuthTokenGetter, setAuthRefreshHandler } from "@/lib/apiClient";
import { setHadSession } from "@/lib/sessionBreadcrumb";

/**
 * Session management against the Drishti API.
 *
 * Two tokens, deliberately handled differently:
 *
 *   Access (JWT, 1 hour)  — held in memory here. Never persisted. Sent as
 *                           `Authorization: Bearer` on every data call.
 *   Refresh (opaque, 30d) — never touched by this code at all. It lives in
 *                           the httpOnly `drishti_refresh` cookie, which
 *                           JavaScript cannot read, so an XSS payload that
 *                           can read anything readable still finds no way to
 *                           mint a new session.
 *
 * That split is what lets a reload restore the session without storing a
 * credential anywhere script can reach: on mount we POST /api/auth/refresh
 * with `credentials: "include"` and let the browser present the cookie.
 *
 * Refresh tokens rotate on every use, and presenting an already-rotated one
 * revokes every session for the account. Concurrency is therefore not a
 * performance concern but a correctness one — see the single-flight guard in
 * apiClient.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Refresh this long before expiry, so a slow network cannot race the clock. */
const REFRESH_LEAD_MS = 60_000;

/**
 * Backoff for a refresh that failed without answering the question.
 *
 * A 429, a 502 or a dropped connection say nothing about whether the session
 * is valid, so the only safe response is to keep what we have and ask again
 * later. These bound "later": doubling from 2s, never beyond 5 minutes, and
 * at most six consecutive attempts so a backend that stays down cannot leave
 * a tab retrying forever. After that the session is left as it is — an
 * ordinary request meeting a 401 will start the cycle again on its own.
 */
const TRANSIENT_RETRY_BASE_MS = 2_000;
const TRANSIENT_RETRY_MAX_MS = 5 * 60_000;
const TRANSIENT_MAX_ATTEMPTS = 6;

/**
 * On boot only, wait inline for a retry when the hint is short, so a brief
 * blip never bounces a signed-in user to the login screen. Anything longer
 * settles initialization and retries in the background instead — the app
 * must not sit on a spinner because a rate limit has minutes left to run.
 */
const BOOT_INLINE_RETRIES = 2;
const BOOT_INLINE_MAX_WAIT_MS = 1_500;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type Membership = {
  organizationId: number;
  organizationName: string;
  organizationSlug: string;
  role: string;
};

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  organizationId: number;
};

/** POST /api/auth/login and /refresh both return this shape. */
type SessionResponse = {
  token: string;
  expiresIn: number;
  refreshToken?: string;
  refreshExpiresIn?: number;
  user: { id: number; email: string; role: string; organizationId: number };
  memberships?: Membership[];
};

/** What one refresh attempt concluded. See attemptRefreshOnce. */
type RefreshResult = {
  token: string | null;
  /**
   * ok            — a new token; the session is live.
   * unauthenticated — the server said 401/403. Conclusive.
   * inconclusive  — the question went unanswered. Keep the session, retry.
   * stale         — the answer arrived too late to matter, because the
   *                 session was deliberately replaced while it was in
   *                 flight. Nothing is wrong, so there is nothing to retry.
   */
  outcome: "ok" | "unauthenticated" | "inconclusive" | "stale";
  retryAfterSeconds: number | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  memberships: Membership[];
  isAuthenticated: boolean;
  /** True until the boot-time session probe has settled. */
  isInitializing: boolean;
  /**
   * A refresh came back inconclusive and another attempt is pending.
   *
   * Not the same as being signed out. The server never said the session was
   * invalid — it was rate limited, or unreachable, or it failed — so the
   * honest thing to tell the user is that we are still checking, not that
   * their session ended. Goes false the moment the question is answered
   * either way, or when the retries are exhausted.
   */
  isRecovering: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

function deriveName(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const words = localPart.split(/[._-]+/).filter(Boolean);
  if (words.length === 0) return "Drishti User";
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const toAuthUser = (u: SessionResponse["user"]): AuthUser => ({
  id: u.id,
  email: u.email,
  name: deriveName(u.email),
  role: u.role,
  organizationId: u.organizationId,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [memberships, setMemberships] = React.useState<Membership[]>([]);
  const [isInitializing, setIsInitializing] = React.useState(true);
  const [isRecovering, setIsRecovering] = React.useState(false);

  const tokenRef = React.useRef<string | null>(null);
  const refreshTimer = React.useRef<number | null>(null);
  /** Pending retry after an inconclusive refresh. Separate from the proactive timer. */
  const retryTimer = React.useRef<number | null>(null);
  const transientAttempts = React.useRef(0);

  /**
   * Bumped whenever the session is deliberately replaced — login, logout, or
   * a conclusive clear.
   *
   * A refresh that started before one of those must not act on its result
   * afterwards: a slow 401 landing after a fresh login would sign the user
   * straight back out, and a slow success landing after a logout would sign
   * them back in. Each refresh captures the generation it began in and drops
   * its result if the world moved on.
   */
  const sessionGeneration = React.useRef(0);

  /**
   * Set once we know there is no session — an explicit logout, or a 401/403
   * that settled the matter. It stops the automatic paths (the 401 handler,
   * a pending retry) from quietly re-establishing a session the user just
   * ended, and stops a conclusive failure from looping. Cleared the moment a
   * session is adopted again.
   */
  const refreshSuppressed = React.useRef(false);

  /** One refresh at a time, whoever asks. */
  const inFlight = React.useRef<Promise<RefreshResult> | null>(null);

  const cancelRetry = React.useCallback(() => {
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  /*
   * Registered during render, not in an effect: a child can fire a request on
   * its first render, which happens before effects run.
   */
  if (tokenRef.current === null) {
    setAuthTokenGetter(() => tokenRef.current);
  }

  const clearSession = React.useCallback(() => {
    sessionGeneration.current += 1;
    refreshSuppressed.current = true;
    setIsRecovering(false);
    tokenRef.current = null;
    setUser(null);
    setMemberships([]);
    transientAttempts.current = 0;
    cancelRetry();
    if (refreshTimer.current !== null) {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, [cancelRetry]);

  /** Apply a login/refresh payload and arm the next proactive refresh. */
  const adoptSession = React.useCallback((result: SessionResponse) => {
    sessionGeneration.current += 1;
    refreshSuppressed.current = false;
    setIsRecovering(false);
    tokenRef.current = result.token;
    setUser(toAuthUser(result.user));
    setMemberships(result.memberships ?? []);
    setHadSession(true);

    // A session in hand settles whatever the retries were chasing.
    transientAttempts.current = 0;
    cancelRetry();

    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    const lead = Math.max(result.expiresIn * 1000 - REFRESH_LEAD_MS, 30_000);
    refreshTimer.current = window.setTimeout(() => { void refreshSession(); }, lead);
  }, [cancelRetry]);  // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Exchange the httpOnly refresh cookie for a new access token.
   *
   * Returns the new token, null when the session is genuinely gone, and null
   * when the attempt was inconclusive — the caller cannot tell those apart
   * and does not need to, because this function has already decided what to
   * do about each. `outcome` is what the retry logic reads.
   *
   * The distinction that matters: only 401 and 403 are the server answering
   * the question. A 429, a 500 or a dead socket mean the question went
   * unanswered, and an unanswered question is not a "no". Treating it as one
   * signed users out mid-session for the duration of a rate-limit window
   * while their refresh tokens were still perfectly valid.
   */
  const attemptRefreshOnce = React.useCallback(async (): Promise<RefreshResult> => {
    const startedAt = sessionGeneration.current;
    try {
      const result = await api.post<SessionResponse>(
        "/api/auth/refresh", undefined, { withCredentials: true },
      );

      // The world moved on while this was in flight — a login or a logout
      // has since set the session deliberately. Do not overwrite it, and do
      // not retry: nothing failed.
      if (startedAt !== sessionGeneration.current) {
        return { token: null, outcome: "stale", retryAfterSeconds: null };
      }

      /*
       * A 2xx carrying no token is a shape the API does not produce — it
       * answers a missing cookie with 401. Deliberately not treated as a
       * logout: inventing one from an unexpected payload is exactly the
       * over-reach this change exists to remove. Nothing to adopt, nothing
       * to clear, nothing to retry.
       */
      if (!result?.token) {
        return { token: null, outcome: "stale", retryAfterSeconds: null };
      }

      adoptSession(result);
      return { token: result.token, outcome: "ok", retryAfterSeconds: null };
    } catch (err) {
      const apiError = err instanceof ApiError ? err : null;

      if (startedAt !== sessionGeneration.current) {
        return { token: null, outcome: "stale", retryAfterSeconds: null };
      }

      // 401 (unknown, expired or replayed token) or 403 (membership
      // withdrawn). The server has answered; there is no session to continue.
      if (apiError?.isAuthError) {
        clearSession();
        return { token: null, outcome: "unauthenticated", retryAfterSeconds: null };
      }

      /*
       * Everything else — 429, 5xx, timeout, offline, CORS, an error that is
       * not even an ApiError — leaves the session exactly as it was. We do
       * not know that it is invalid, and guessing costs the user their work.
       */
      return {
        token: null,
        outcome: "inconclusive",
        retryAfterSeconds: apiError?.retryAfterSeconds ?? null,
      };
    }
  }, [adoptSession, clearSession]);

  /** How long to wait before the next inconclusive retry. */
  const backoffFor = React.useCallback((attempt: number, hintSeconds: number | null) => {
    const hinted = hintSeconds !== null ? hintSeconds * 1000 : 0;
    const backoff = TRANSIENT_RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1);
    // Honour the server's own number when it gave one, but never wait less
    // than the backoff and never longer than the ceiling.
    return Math.min(Math.max(hinted, backoff), TRANSIENT_RETRY_MAX_MS);
  }, []);

  const scheduleRetry = React.useCallback((hintSeconds: number | null): boolean => {
    // Out of attempts: stop, and stop claiming to be recovering.
    if (transientAttempts.current >= TRANSIENT_MAX_ATTEMPTS) {
      setIsRecovering(false);
      return false;
    }
    transientAttempts.current += 1;
    const delay = backoffFor(transientAttempts.current, hintSeconds);
    cancelRetry();
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null;
      void refreshSession();
    }, delay);
    return true;
  }, [backoffFor, cancelRetry]);  // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Single-flight refresh. Every path goes through here: the boot probe, the
   * proactive expiry timer, the client's 401 handler and the inconclusive
   * retry.
   *
   * Coalescing is not an optimisation. Refresh tokens rotate on use, so a
   * second concurrent call presents an already-rotated token, which the API
   * treats as theft and answers by revoking every session for the account.
   * apiClient single-flights its own 401 path; this closes the others, which
   * previously called straight through and could overlap with it.
   */
  const runRefresh = React.useCallback((): Promise<RefreshResult> => {
    if (refreshSuppressed.current) {
      return Promise.resolve({ token: null, outcome: "unauthenticated", retryAfterSeconds: null });
    }
    if (inFlight.current) return inFlight.current;

    const run = (async () => {
      const result = await attemptRefreshOnce();
      if (result.outcome === "inconclusive") {
        // Recovering only while a further attempt is actually coming.
        setIsRecovering(scheduleRetry(result.retryAfterSeconds));
      }
      return result;
    })();

    inFlight.current = run;
    // Clear by identity, so a late settle can never unseat a newer flight.
    void run.finally(() => { if (inFlight.current === run) inFlight.current = null; });
    return run;
  }, [attemptRefreshOnce, scheduleRetry]);

  const refreshSession = React.useCallback(
    async (): Promise<string | null> => (await runRefresh()).token,
    [runRefresh],
  );

  /* The client calls this on a 401, once, and replays with what comes back. */
  React.useEffect(() => {
    setAuthTokenGetter(() => tokenRef.current);
    setAuthRefreshHandler(() => refreshSession());
    return () => {
      setAuthTokenGetter(null);
      setAuthRefreshHandler(null);
    };
  }, [refreshSession]);

  /*
   * Boot probe. A reload drops the in-memory access token but not the
   * refresh cookie, so this is what keeps a working session across a
   * refresh without persisting anything script can read.
   */
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      /*
       * Boot gets a couple of quick retries for an inconclusive answer, so a
       * momentary blip or a rate limit with a second or two left on it never
       * bounces a signed-in user to the login screen.
       *
       * Only short waits are taken inline. A 429 with minutes left settles
       * initialization immediately and keeps trying in the background —
       * holding the whole app on a spinner would trade one bad experience
       * for a worse one. If a background retry then succeeds, the user is
       * authenticated again and Login's redirect returns them to the page
       * ProtectedRoute took them from.
       */
      for (let attempt = 0; attempt <= BOOT_INLINE_RETRIES; attempt += 1) {
        const { outcome, retryAfterSeconds } = await runRefresh();
        if (cancelled || outcome !== "inconclusive") break;

        // runRefresh has already armed a background retry; these inline waits
        // only decide whether to hold boot open a moment longer first.
        const hinted = retryAfterSeconds !== null ? retryAfterSeconds * 1000 : 0;
        const wait = Math.max(hinted, (TRANSIENT_RETRY_BASE_MS / 4) * 2 ** attempt);
        if (attempt === BOOT_INLINE_RETRIES || wait > BOOT_INLINE_MAX_WAIT_MS) break;
        await sleep(wait);
      }
      if (!cancelled) setIsInitializing(false);
    })();
    return () => { cancelled = true; };
    // Once, on mount.
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => () => {
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim();

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      return { ok: false as const, error: "Enter a valid email address." };
    }
    if (password.length === 0) {
      return { ok: false as const, error: "Password is required." };
    }

    try {
      const result = await api.post<SessionResponse>(
        "/api/auth/login",
        { email: trimmedEmail, password },
        { withCredentials: true },   // lets the API set both httpOnly cookies
      );
      if (!result?.token) {
        return { ok: false as const, error: "Sign-in failed: no token returned." };
      }
      adoptSession(result);
      return { ok: true as const };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          return { ok: false as const, error: "Too many attempts. Wait a few minutes and try again." };
        }
        if (err.status === 403) {
          return { ok: false as const, error: "This account is not a member of any organisation." };
        }
        if (err.isAuthError) return { ok: false as const, error: "Invalid email or password." };
        if (err.isNetworkError) {
          return { ok: false as const, error: "Can't reach the server. Check that the API is running." };
        }
        return { ok: false as const, error: `Sign-in failed (${err.status}). Please try again.` };
      }
      return { ok: false as const, error: "Sign-in failed. Please try again." };
    }
  }, [adoptSession]);

  const logout = React.useCallback(() => {
    // Drop the session locally first: leaving must work even if the API is down.
    clearSession();
    setHadSession(false);   // chose to leave; not a lost session
    void api.post("/api/auth/logout", undefined, { withCredentials: true }).catch(() => {});
  }, [clearSession]);

  const value = React.useMemo<AuthContextValue>(() => ({
    user,
    memberships,
    isAuthenticated: user !== null,
    isInitializing,
    isRecovering,
    login,
    logout,
  }), [user, memberships, isInitializing, isRecovering, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

/** Role helpers, so pages stop hand-rolling the same comparisons. */
export function useCanWrite() {
  const { user } = useAuth();
  return user?.role === "ADMIN" || user?.role === "ANALYST";
}

export function useIsAdmin() {
  const { user } = useAuth();
  return user?.role === "ADMIN";
}
