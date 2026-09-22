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

type AuthContextValue = {
  user: AuthUser | null;
  memberships: Membership[];
  isAuthenticated: boolean;
  /** True until the boot-time session probe has settled. */
  isInitializing: boolean;
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

  const tokenRef = React.useRef<string | null>(null);
  const refreshTimer = React.useRef<number | null>(null);

  /*
   * Registered during render, not in an effect: a child can fire a request on
   * its first render, which happens before effects run.
   */
  if (tokenRef.current === null) {
    setAuthTokenGetter(() => tokenRef.current);
  }

  const clearSession = React.useCallback(() => {
    tokenRef.current = null;
    setUser(null);
    setMemberships([]);
    if (refreshTimer.current !== null) {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  /** Apply a login/refresh payload and arm the next proactive refresh. */
  const adoptSession = React.useCallback((result: SessionResponse) => {
    tokenRef.current = result.token;
    setUser(toAuthUser(result.user));
    setMemberships(result.memberships ?? []);
    setHadSession(true);

    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    const lead = Math.max(result.expiresIn * 1000 - REFRESH_LEAD_MS, 30_000);
    refreshTimer.current = window.setTimeout(() => { void refreshSession(); }, lead);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Exchange the httpOnly refresh cookie for a new access token.
   * Returns the new token, or null when there is no usable session.
   */
  const refreshSession = React.useCallback(async (): Promise<string | null> => {
    try {
      const result = await api.post<SessionResponse>(
        "/api/auth/refresh", undefined, { withCredentials: true },
      );
      if (!result?.token) return null;
      adoptSession(result);
      return result.token;
    } catch {
      // 401 (unknown/expired/replayed) or 403 (membership withdrawn). Either
      // way there is no session to continue; say so rather than retrying.
      clearSession();
      return null;
    }
  }, [adoptSession, clearSession]);

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
      await refreshSession();
      if (!cancelled) setIsInitializing(false);
    })();
    return () => { cancelled = true; };
    // Once, on mount.
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => () => {
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
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
    login,
    logout,
  }), [user, memberships, isInitializing, login, logout]);

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
