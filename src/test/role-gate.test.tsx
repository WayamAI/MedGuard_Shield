import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { AppStoreProvider } from "@/store/AppStore";

/**
 * Role gating is new to this app, so these cover the whole matrix rather than
 * the happy path. The server is the real gate — import is ADMIN-only there —
 * and this is only about not showing someone a door that will not open.
 */

let role = "ADMIN";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  role = "ADMIN";
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/auth/login")) {
      return json({ data: { token: "tok", expiresIn: 28800, user: { id: 1, email: "a@meridian.org", role } } });
    }
    if (url.endsWith("/api/threats")) {
      return json({ data: { summary: { total: 0, open: 0, openCritical: 0, bySeverity: {}, byStatus: {} }, threats: [] } });
    }
    return json({ data: [] });
  }));
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

/** Signs in during render so the tree settles in an authenticated state. */
function SignIn({ children }: { children: ReactNode }) {
  const { login, isAuthenticated } = useAuth();
  useEffect(() => { void login("a@meridian.org", "pw"); }, [login]);
  return <>{isAuthenticated ? children : <div>signing in</div>}</>;
}

const wrap = (node: ReactNode, path = "/import") => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <AuthProvider>
          <AppStoreProvider>{node}</AppStoreProvider>
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

const routes = (
  <SignIn>
    <Routes>
      <Route path="/" element={<div>Dashboard</div>} />
      <Route path="/login" element={<div>Sign in</div>} />
      <Route
        path="/import"
        element={<ProtectedRoute requireRole={["ADMIN"]}><div>Import page</div></ProtectedRoute>}
      />
      <Route
        path="/open"
        element={<ProtectedRoute><div>Open page</div></ProtectedRoute>}
      />
    </Routes>
  </SignIn>
);

describe("ProtectedRoute with requireRole", () => {
  it("lets an ADMIN through", async () => {
    role = "ADMIN";
    render(wrap(routes));
    expect(await screen.findByText("Import page")).toBeInTheDocument();
  });

  it("turns an ANALYST away", async () => {
    role = "ANALYST";
    render(wrap(routes));
    // Sent to the dashboard, not to /login: they are signed in, so a login
    // form would misdescribe what went wrong.
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Import page")).not.toBeInTheDocument();
  });

  it("turns a VIEWER away", async () => {
    role = "VIEWER";
    render(wrap(routes));
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Import page")).not.toBeInTheDocument();
  });

  it("does not send a wrong-role user to the login page", async () => {
    role = "VIEWER";
    render(wrap(routes));
    await waitFor(() => expect(screen.getByText("Dashboard")).toBeInTheDocument());
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });

  it("still admits every role to an ungated route", async () => {
    role = "VIEWER";
    render(wrap(routes, "/open"));
    expect(await screen.findByText("Open page")).toBeInTheDocument();
  });

  it("treats a missing role as not admin", async () => {
    // A token without a role claim must not fall through the gate.
    role = "";
    render(wrap(routes));
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });
});

describe("sidebar visibility", () => {
  const sidebar = (
    <SignIn>
      <Routes>
        <Route path="*" element={<Layout><div /></Layout>} />
      </Routes>
    </SignIn>
  );

  it("offers Import Data to an ADMIN", async () => {
    role = "ADMIN";
    render(wrap(sidebar, "/"));
    expect(await screen.findByRole("link", { name: /Import Data/ })).toBeInTheDocument();
  });

  it("hides it from an ANALYST", async () => {
    role = "ANALYST";
    render(wrap(sidebar, "/"));
    // Wait for a nav item everyone sees, so absence is measured after render.
    await screen.findByRole("link", { name: /Dashboard/ });
    expect(screen.queryByRole("link", { name: /Import Data/ })).not.toBeInTheDocument();
  });

  it("hides it from a VIEWER", async () => {
    role = "VIEWER";
    render(wrap(sidebar, "/"));
    await screen.findByRole("link", { name: /Dashboard/ });
    expect(screen.queryByRole("link", { name: /Import Data/ })).not.toBeInTheDocument();
  });

  it("leaves the ungated items alone for every role", async () => {
    role = "VIEWER";
    render(wrap(sidebar, "/"));
    expect(await screen.findByRole("link", { name: /Risk Register/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vendor Risk/ })).toBeInTheDocument();
  });
});
