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
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async () => {
    if (!loginOk) return new Response(JSON.stringify({ message: "no" }), { status: 401 });
    return new Response(JSON.stringify({
      data: { token: "t.t.t", expiresIn: 28800, user: { id: 1, email: "admin@meridian.org", role: "ADMIN" } },
    }), { status: 200, headers: { "content-type": "application/json" } });
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
