import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { hadSession } from "@/lib/sessionBreadcrumb";
import { ThemeProvider } from "@/hooks/use-theme";
import Login from "@/pages/Login";

/**
 * The in-memory token means a reload always lands on the login page. Without
 * context that reads as "the app logged me out for no reason", so the page
 * distinguishes three situations: never signed in, signed out on purpose, and
 * a session that ended underneath you.
 */

const NOTICE = /Your session ended/;

let loginOk = true;
/** Overrides the response to /api/auth/refresh only, when a test needs to. */
let refreshResponder: (() => Promise<Response>) | null = null;

const ok = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json", ...headers },
  });

const sessionPayload = {
  data: { token: "t.t.t", expiresIn: 28800, user: { id: 1, email: "admin@meridian.org", role: "ADMIN" } },
};

beforeEach(() => {
  sessionStorage.clear();
  loginOk = true;
  refreshResponder = null;
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/auth/refresh") && refreshResponder) return refreshResponder();
    if (!loginOk) return new Response(JSON.stringify({ message: "no" }), { status: 401 });
    return ok(sessionPayload);
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); sessionStorage.clear(); });

const page = (node: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><ThemeProvider><AuthProvider>{node}</AuthProvider></ThemeProvider></MemoryRouter>
  </QueryClientProvider>
);

/** Drives login without a form, so no password is typed into a field. */
function Harness({ onReady }: { onReady: (a: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  onReady(auth);
  return <Login />;
}

describe("session-ended notice", () => {
  it("is absent on a first visit", () => {
    render(page(<Login />));
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("appears after a session existed and the page was reloaded", async () => {
    let auth!: ReturnType<typeof useAuth>;
    const view = render(page(<Harness onReady={a => { auth = a; }} />));
    await act(async () => { await auth.login("admin@meridian.org", "pw"); });
    expect(hadSession()).toBe(true);

    // A reload: the tree remounts and the in-memory token is gone, but the
    // breadcrumb survives in sessionStorage.
    view.unmount();
    render(page(<Login />));
    await waitFor(() => expect(screen.getByText(NOTICE)).toBeInTheDocument());
  });

  it("does not appear after an explicit logout", async () => {
    let auth!: ReturnType<typeof useAuth>;
    const view = render(page(<Harness onReady={a => { auth = a; }} />));
    await act(async () => { await auth.login("admin@meridian.org", "pw"); });
    await act(async () => { auth.logout(); });
    expect(hadSession()).toBe(false);

    view.unmount();
    render(page(<Login />));
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("gives way to a real error message rather than stacking with it", async () => {
    let auth!: ReturnType<typeof useAuth>;
    const view = render(page(<Harness onReady={a => { auth = a; }} />));
    await act(async () => { await auth.login("admin@meridian.org", "pw"); });
    view.unmount();

    // Fresh mount with the breadcrumb set: the notice is showing.
    loginOk = false;
    render(page(<Login />));
    expect(screen.getByText(NOTICE)).toBeInTheDocument();

    // Submit the form so the page's own error state is what changes. Values
    // here are fixtures against a stubbed fetch, not real credentials.
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "admin@meridian.org" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "x" } });
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: /Sign in/i }).closest("form")!); });

    await waitFor(() => expect(screen.getByText(/Invalid email or password/)).toBeInTheDocument());
    // One message, not two competing explanations.
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    loginOk = true;
  });

  it("never writes a token to storage, only the boolean breadcrumb", async () => {
    let auth!: ReturnType<typeof useAuth>;
    render(page(<Harness onReady={a => { auth = a; }} />));
    await act(async () => { await auth.login("admin@meridian.org", "pw"); });

    // sessionStorage holds the breadcrumb and nothing else.
    const session = Object.keys(sessionStorage).map(k => sessionStorage.getItem(k));
    expect(session).toEqual(["1"]);

    // localStorage legitimately holds UI preferences (theme, sidebar state).
    // What must never appear in either store is the token itself.
    const all = [
      ...Object.keys(localStorage).map(k => [k, localStorage.getItem(k)] as const),
      ...Object.keys(sessionStorage).map(k => [k, sessionStorage.getItem(k)] as const),
    ];
    expect(all.some(([, v]) => v === "t.t.t")).toBe(false);
    expect(all.some(([, v]) => (v ?? "").split(".").length === 3)).toBe(false);
    expect(all.some(([k]) => /token|auth-session/i.test(k))).toBe(false);
  });
});

/* ------------------------------------------------ recovery vs expiration -- */

const RECOVERING = /Checking your session/;

/**
 * The notice used to key off the breadcrumb alone. A breadcrumb says a
 * session existed in this tab; it does not say the session ended.
 *
 * On a cold boot during a rate-limit window the refresh came back 429 — the
 * server saying "not now", not "no" — and the login page announced "Your
 * session ended" anyway. Then the background retry landed and put the user
 * straight back where they were, which is the tell that the message was
 * never true.
 */
describe("recovery is not expiration", () => {
  /** Leaves a breadcrumb behind, as a real prior session would. */
  async function withPriorSession() {
    let auth!: ReturnType<typeof useAuth>;
    const view = render(page(<Harness onReady={a => { auth = a; }} />));
    await act(async () => { await auth.login("admin@meridian.org", "pw"); });
    expect(hadSession()).toBe(true);
    view.unmount();
  }

  it("says it is checking, not that the session ended, while a retry is pending", async () => {
    await withPriorSession();

    // Cold boot meets the rate limiter.
    refreshResponder = async () =>
      ok({ error: { code: "RATE_LIMITED" } }, 429, { "Retry-After": "900" });

    render(page(<Login />));
    await waitFor(() => expect(screen.getByText(RECOVERING)).toBeInTheDocument());
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("does the same for a server error and for an unreachable backend", async () => {
    for (const responder of [
      async () => ok({ error: { message: "boom" } }, 500),
      async () => { throw new TypeError("Failed to fetch"); },
    ]) {
      sessionStorage.clear();
      await withPriorSession();
      refreshResponder = responder;
      const view = render(page(<Login />));
      await waitFor(() => expect(screen.getByText(RECOVERING)).toBeInTheDocument());
      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("still offers the form, so nobody has to wait for the retry", async () => {
    await withPriorSession();
    refreshResponder = async () =>
      ok({ error: { code: "RATE_LIMITED" } }, 429, { "Retry-After": "900" });

    render(page(<Login />));
    await waitFor(() => expect(screen.getByText(RECOVERING)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Sign in/i })).toBeEnabled();
  });

  it("says the session ended when the server actually says 401", async () => {
    await withPriorSession();
    refreshResponder = async () => ok({ error: { message: "expired" } }, 401);

    render(page(<Login />));
    await waitFor(() => expect(screen.getByText(NOTICE)).toBeInTheDocument());
    expect(screen.queryByText(RECOVERING)).not.toBeInTheDocument();
  });

  it("says the session ended when the server says 403", async () => {
    await withPriorSession();
    refreshResponder = async () => ok({ error: { message: "membership withdrawn" } }, 403);

    render(page(<Login />));
    await waitFor(() => expect(screen.getByText(NOTICE)).toBeInTheDocument());
    expect(screen.queryByText(RECOVERING)).not.toBeInTheDocument();
  });

  it("shows neither notice on a first visit that is merely rate limited", async () => {
    // No breadcrumb: nothing ended, and there is nothing to restore either.
    refreshResponder = async () =>
      ok({ error: { code: "RATE_LIMITED" } }, 429, { "Retry-After": "900" });

    render(page(<Login />));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Sign in/i })).toBeInTheDocument());
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("restores the session when the retry succeeds, without ever having lied", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await withPriorSession();

      let firstCall = true;
      refreshResponder = async () => {
        if (firstCall) {
          firstCall = false;
          return ok({ error: { code: "RATE_LIMITED" } }, 429, { "Retry-After": "900" });
        }
        return ok(sessionPayload);
      };

      let auth!: ReturnType<typeof useAuth>;
      render(page(<Harness onReady={a => { auth = a; }} />));
      await waitFor(() => expect(screen.getByText(RECOVERING)).toBeInTheDocument());
      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();

      await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000 + 1_000); });
      await waitFor(() => expect(auth.isAuthenticated).toBe(true));
      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
