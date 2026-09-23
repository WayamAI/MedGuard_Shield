import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { api, parseRetryAfter, setAuthRefreshHandler, setAuthTokenGetter } from "@/lib/apiClient";

/** Mirrors the provider's own bounds; see use-auth.tsx. */
const TRANSIENT_RETRY_MAX_MS = 5 * 60_000;
const TRANSIENT_MAX_ATTEMPTS = 6;

/**
 * What a failed refresh is allowed to conclude.
 *
 * The provider used to clear the session inside one broad catch, so a 429
 * from the rate limiter — or a 502, or a dropped connection — signed the user
 * out while their refresh token was still perfectly valid. Only 401 and 403
 * are the server answering the question; everything else means it went
 * unanswered, and an unanswered question is not a "no".
 */

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const session = (token: string) => ({
  data: {
    token,
    expiresIn: 3600,
    user: { id: 1, email: "admin@meridian.org", role: "ADMIN", organizationId: 1 },
  },
});

/** Queue of responses for /api/auth/refresh, plus a call counter. */
let refreshQueue: Array<() => Promise<Response>> = [];
let refreshCalls = 0;
let dataResponder: () => Promise<Response> = async () => json({ data: [] });

beforeEach(() => {
  refreshQueue = [];
  refreshCalls = 0;
  dataResponder = async () => json({ data: [] });
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/auth/login")) return json(session("access-1"));
    if (url.includes("/api/auth/logout")) return json({ data: null });
    if (url.includes("/api/auth/refresh")) {
      refreshCalls += 1;
      const next = refreshQueue.shift();
      return next ? next() : json({ error: { message: "no session" } }, 401);
    }
    return dataResponder();
  }));
});

afterEach(() => {
  setAuthRefreshHandler(null);
  setAuthTokenGetter(null);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

/** Surfaces auth state and lets a test drive a login or a protected call. */
function Probe({ onReady }: { onReady?: (fns: { call: () => Promise<unknown> }) => void }) {
  const { user, isAuthenticated, isInitializing, login, logout } = useAuth();
  const [err, setErr] = useState("");
  useEffect(() => {
    onReady?.({ call: () => api.get("/api/assets").catch(e => { setErr(String(e)); throw e; }) });
  }, [onReady]);
  return (
    <div>
      <span data-testid="state">
        {isInitializing ? "initializing" : isAuthenticated ? "authenticated" : "anonymous"}
      </span>
      {/* Independent of the boot flag, so a test can assert on the session
          while initialization is still in flight. */}
      <span data-testid="auth">{isAuthenticated ? "yes" : "no"}</span>
      <span data-testid="email">{user?.email ?? ""}</span>
      <span data-testid="err">{err}</span>
      <button onClick={() => void login("admin@meridian.org", "pw")}>signin</button>
      <button onClick={() => logout()}>signout</button>
    </div>
  );
}

const mount = (onReady?: (fns: { call: () => Promise<unknown> }) => void) =>
  render(
    <MemoryRouter>
      <AuthProvider><Probe onReady={onReady} /></AuthProvider>
    </MemoryRouter>,
  );

const settled = () => waitFor(() =>
  expect(screen.getByTestId("state").textContent).not.toBe("initializing"));

/* ------------------------------------------------- conclusive outcomes ---- */

describe("boot refresh — the server answers", () => {
  it("200 signs the user in", async () => {
    refreshQueue = [async () => json(session("access-1"))];
    mount();
    await settled();
    expect(screen.getByTestId("state").textContent).toBe("authenticated");
    expect(screen.getByTestId("email").textContent).toBe("admin@meridian.org");
  });

  it("401 leaves the user signed out", async () => {
    refreshQueue = [async () => json({ error: { message: "expired" } }, 401)];
    mount();
    await settled();
    expect(screen.getByTestId("state").textContent).toBe("anonymous");
  });

  it("403 leaves the user signed out", async () => {
    refreshQueue = [async () => json({ error: { message: "membership withdrawn" } }, 403)];
    mount();
    await settled();
    expect(screen.getByTestId("state").textContent).toBe("anonymous");
  });
});

/* ----------------------------------------------- inconclusive outcomes ---- */

/**
 * Signs in for real, then makes a protected call that 401s so the client
 * fires its refresh — the exact sequence that logged people out mid-session.
 */
async function signInThenRefreshWith(response: () => Promise<Response>) {
  let call: (() => Promise<unknown>) | null = null;
  refreshQueue = [async () => json({ error: { message: "no session" } }, 401)];
  mount(fns => { call = fns.call; });
  await settled();

  await act(async () => { screen.getByText("signin").click(); });
  await waitFor(() =>
    expect(screen.getByTestId("state").textContent).toBe("authenticated"));

  // Next protected call 401s once, which drives the refresh under test.
  let served = false;
  dataResponder = async () => {
    if (!served) { served = true; return json({ error: { message: "expired" } }, 401); }
    return json({ data: [] });
  };
  refreshQueue = [response];
  await act(async () => { await call!().catch(() => {}); });
}

describe("mid-session refresh — the question goes unanswered", () => {
  it("429 keeps the user signed in", async () => {
    await signInThenRefreshWith(async () =>
      json({ error: { code: "RATE_LIMITED" } }, 429, { "Retry-After": "900" }));
    expect(screen.getByTestId("state").textContent).toBe("authenticated");
    expect(screen.getByTestId("email").textContent).toBe("admin@meridian.org");
  });

  it("500 keeps the user signed in", async () => {
    await signInThenRefreshWith(async () => json({ error: { message: "boom" } }, 500));
    expect(screen.getByTestId("state").textContent).toBe("authenticated");
  });

  it("503 keeps the user signed in", async () => {
    await signInThenRefreshWith(async () => json({ error: { message: "down" } }, 503));
    expect(screen.getByTestId("state").textContent).toBe("authenticated");
  });

  it("a network failure keeps the user signed in", async () => {
    await signInThenRefreshWith(async () => { throw new TypeError("Failed to fetch"); });
    expect(screen.getByTestId("state").textContent).toBe("authenticated");
  });

  it("a timeout keeps the user signed in", async () => {
    await signInThenRefreshWith(async () => {
      const abort = new Error("The operation was aborted.");
      abort.name = "AbortError";
      throw abort;
    });
    expect(screen.getByTestId("state").textContent).toBe("authenticated");
  });

  it("still signs the user out when the server does say 401", async () => {
    await signInThenRefreshWith(async () => json({ error: { message: "expired" } }, 401));
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe("anonymous"));
  });
});

/* ------------------------------------------------------------ recovery ---- */

describe("recovery and retry discipline", () => {
  /*
   * A long Retry-After is deliberate in these two. Boot only waits inline for
   * a hint it can absorb; anything longer settles initialization at once and
   * hands off to the background schedule, which is the path under test.
   */
  const rateLimited = async () =>
    json({ error: { code: "RATE_LIMITED" } }, 429, { "Retry-After": "900" });

  it("recovers when a later refresh succeeds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    refreshQueue = [rateLimited, async () => json(session("access-2"))];
    mount();
    await settled();
    expect(screen.getByTestId("state").textContent).toBe("anonymous");

    // The scheduled retry lands and the session comes back on its own.
    await act(async () => { await vi.advanceTimersByTimeAsync(TRANSIENT_RETRY_MAX_MS + 1_000); });
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe("authenticated"));
  });

  it("keeps an established session through a rate limit and restores it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await signInThenRefreshWith(rateLimited);
    expect(screen.getByTestId("state").textContent).toBe("authenticated");

    refreshQueue = [async () => json(session("access-3"))];
    await act(async () => { await vi.advanceTimersByTimeAsync(TRANSIENT_RETRY_MAX_MS + 1_000); });
    // Still signed in, now on a freshly minted token.
    expect(screen.getByTestId("state").textContent).toBe("authenticated");
  });

  it("does not retry forever", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    for (let i = 0; i < 50; i += 1) refreshQueue.push(rateLimited);

    mount();
    await settled();

    await act(async () => { await vi.advanceTimersByTimeAsync(6 * 60 * 60_000); });
    // One boot attempt plus the capped background schedule — not fifty.
    expect(refreshCalls).toBeLessThanOrEqual(1 + TRANSIENT_MAX_ATTEMPTS);
  });
});

/* ---------------------------------------------------------- concurrency --- */

describe("no refresh storm", () => {
  it("coalesces concurrent 401 retries into one refresh", async () => {
    let call: (() => Promise<unknown>) | null = null;
    refreshQueue = [async () => json(session("access-1"))];
    mount(fns => { call = fns.call; });
    await settled();
    const afterBoot = refreshCalls;

    // Six queries 401 at the same moment, as they would after an idle tab.
    dataResponder = async () => json({ error: { message: "expired" } }, 401);
    refreshQueue = [async () => json(session("access-2"))];

    await act(async () => {
      await Promise.allSettled(Array.from({ length: 6 }, () => call!().catch(() => {})));
    });

    /*
     * Rotation makes this a correctness test, not a tuning one: a second
     * concurrent refresh presents an already-rotated token, which the API
     * treats as theft and answers by revoking every session for the account.
     */
    expect(refreshCalls - afterBoot).toBe(1);
  });

  it("boot does not race the token getter into a second refresh", async () => {
    refreshQueue = [async () => json(session("access-1"))];
    mount();
    await settled();
    expect(refreshCalls).toBe(1);
  });
});

/* ----------------------------------------------------------- staleness --- */

/**
 * A refresh that started before the session was deliberately replaced must
 * not act on its result afterwards. Both directions matter: a slow 401
 * landing after a fresh login would sign the user straight back out, and a
 * slow success landing after a logout would sign them back in.
 */
describe("a stale refresh cannot move the session", () => {
  it("a 401 landing after a successful login does not sign the user out", async () => {
    let release: ((r: Response) => void) | null = null;
    refreshQueue = [
      () => new Promise<Response>(resolve => { release = resolve; }),
    ];
    mount();

    // Boot's refresh is hanging. Sign in while it is still in flight.
    await act(async () => { screen.getByText("signin").click(); });
    await waitFor(() => expect(screen.getByTestId("auth").textContent).toBe("yes"));

    // The stale refresh now fails conclusively — but it is stale.
    await act(async () => {
      release!(json({ error: { message: "expired" } }, 401));
      await Promise.resolve();
    });

    expect(screen.getByTestId("auth").textContent).toBe("yes");
    expect(screen.getByTestId("email").textContent).toBe("admin@meridian.org");
  });

  it("no automatic refresh runs after an explicit logout", async () => {
    let call: (() => Promise<unknown>) | null = null;
    refreshQueue = [async () => json(session("access-1"))];
    mount(fns => { call = fns.call; });
    await settled();
    expect(screen.getByTestId("auth").textContent).toBe("yes");

    await act(async () => { screen.getByText("signout").click(); });
    await waitFor(() => expect(screen.getByTestId("auth").textContent).toBe("no"));

    const afterLogout = refreshCalls;

    /*
     * A stray in-flight query now 401s. Before, that would drive a refresh,
     * and a still-valid cookie would have signed the user straight back in
     * moments after they chose to leave.
     */
    dataResponder = async () => json({ error: { message: "expired" } }, 401);
    refreshQueue = [async () => json(session("access-late"))];
    await act(async () => { await call!().catch(() => {}); });

    expect(refreshCalls).toBe(afterLogout);
    expect(screen.getByTestId("auth").textContent).toBe("no");
  });

  it("signing in again re-enables refreshing", async () => {
    refreshQueue = [async () => json({ error: { message: "no session" } }, 401)];
    mount();
    await settled();
    expect(screen.getByTestId("auth").textContent).toBe("no");

    // The conclusive 401 suppressed refreshing; an explicit login must lift it.
    await act(async () => { screen.getByText("signin").click(); });
    await waitFor(() => expect(screen.getByTestId("auth").textContent).toBe("yes"));

    const before = refreshCalls;
    refreshQueue = [async () => json(session("access-2"))];
    let served = false;
    dataResponder = async () => {
      if (!served) { served = true; return json({ error: { message: "expired" } }, 401); }
      return json({ data: [] });
    };
    await act(async () => { await api.get("/api/assets").catch(() => {}); });
    expect(refreshCalls).toBe(before + 1);
    expect(screen.getByTestId("auth").textContent).toBe("yes");
  });
});

/* ----------------------------------------------------------- lifecycle ---- */

describe("explicit logout still wins", () => {
  it("signs out deterministically", async () => {
    refreshQueue = [async () => json(session("access-1"))];
    mount();
    await settled();
    expect(screen.getByTestId("state").textContent).toBe("authenticated");

    await act(async () => { screen.getByText("signout").click(); });
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe("anonymous"));
  });
});

/* --------------------------------------------------------- Retry-After ---- */

describe("parseRetryAfter", () => {
  it("reads delta-seconds, which is what the API sends", () => {
    expect(parseRetryAfter("900")).toBe(900);
    expect(parseRetryAfter(" 30 ")).toBe(30);
  });

  it("reads an HTTP-date, which a proxy in front of it may send instead", () => {
    const in60s = new Date(Date.now() + 60_000).toUTCString();
    const parsed = parseRetryAfter(in60s);
    expect(parsed).not.toBeNull();
    expect(Math.abs((parsed as number) - 60)).toBeLessThanOrEqual(2);
  });

  it("never returns a negative wait for a date already past", () => {
    expect(parseRetryAfter(new Date(Date.now() - 60_000).toUTCString())).toBe(0);
  });

  it("returns null for absent or unparseable values", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter(undefined)).toBeNull();
    expect(parseRetryAfter("")).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
  });
});
