import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, waitFor, renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { execSync, spawn } from "node:child_process";
import { useEffect, type ReactNode } from "react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { api, setAuthTokenGetter } from "@/lib/apiClient";
import { useAssets } from "@/hooks/useAssets";
import { useRisks } from "@/hooks/useRisks";
import { toMatrixRisks } from "@/lib/mappers";
import { DataState } from "@/components/DataState";
import PhiFlow from "@/pages/PhiFlow";
import Risks from "@/pages/Risks";
import Dashboard from "@/pages/Dashboard";
import Vendors from "@/pages/Vendors";

/**
 * Integration checks against a running backend. No mocks: real fetch, real
 * JWT, real Postgres behind it. Skipped (not failed) when the API is down, so
 * the suite still passes on a machine that only has the frontend.
 *
 * Credentials come from the environment, never from the repo:
 *   DEMO_USER_PASSWORD=... npx vitest run src/test/live-backend.test.tsx
 */

const API = process.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const EMAIL = process.env.DEMO_USER_EMAIL ?? "admin@meridian.org";
const PASSWORD = process.env.DEMO_USER_PASSWORD ?? "";
const BACKEND_DIR = process.env.BACKEND_DIR ?? "";

let backendUp = false;
let token: string | null = null;

/** The exact header apiClient produced, captured by wrapping fetch. */
let lastAuthHeader: string | null = null;

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

const health = async () => {
  try {
    const r = await fetch(`${API}/health`);
    return r.ok;
  } catch {
    return false;
  }
};

beforeAll(async () => {
  process.env.VITE_API_BASE_URL ??= API;
  backendUp = await health();
  if (!backendUp || !PASSWORD) return;

  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    lastAuthHeader = h.get("authorization");
    return realFetch(input, init);
  }) as typeof fetch;

  const res = await api.post<{ token: string; user: { email: string; role: string } }>(
    "/api/auth/login", { email: EMAIL, password: PASSWORD },
  );
  token = res.token;
  setAuthTokenGetter(() => token);
}, 30_000);

const live = (name: string, fn: () => Promise<void> | void, timeout?: number) =>
  it(name, async () => {
    if (!backendUp) { console.warn(`[skip] backend not reachable at ${API}`); return; }
    if (!PASSWORD) { console.warn("[skip] DEMO_USER_PASSWORD not set"); return; }
    // Tests that log out leave the getter cleared; restore it so order is irrelevant.
    setAuthTokenGetter(() => token);
    await fn();
  }, timeout);

describe("live backend: bearer auth", () => {
  live("login returns a token and apiClient attaches it as a Bearer header", async () => {
    expect(token).toBeTruthy();
    expect(token!.split(".")).toHaveLength(3);          // a real JWT, not a stub

    lastAuthHeader = null;
    await api.get("/api/auth/me");
    expect(lastAuthHeader).toBe(`Bearer ${token}`);
  });

  live("useAssets() returns real seeded data through the hook", async () => {
    const { result } = renderHook(() => useAssets(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 10_000 });

    expect(result.current.isError).toBe(false);
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data!.length).toBeGreaterThan(0);
    // Real rows, not an empty envelope.
    expect(result.current.data![0]).toHaveProperty("name");
    console.info(`[live] useAssets -> ${result.current.data!.length} assets, first: ${result.current.data![0].name}`);
  }, 20_000);

  live("a request without the token is rejected by the server", async () => {
    setAuthTokenGetter(() => null);
    await expect(api.get("/api/assets")).rejects.toMatchObject({ status: 401 });
    setAuthTokenGetter(() => token);
  });
});

describe("live backend: killed mid-session", () => {
  live("shows reconnecting over stale data, then recovers when the API returns", async () => {
    if (!BACKEND_DIR) { console.warn("[skip] BACKEND_DIR not set"); return; }

    function Probe() {
      // Fast heartbeat so the outage is observed in test time, not demo time.
      const query = useAssets({ pollIntervalMs: 1000, reconnectIntervalMs: 1000, retry: 0 });
      return (
        <DataState query={query} height={200}>
          {assets => <div data-testid="count">{(assets as unknown[]).length} assets</div>}
        </DataState>
      );
    }

    render(<Probe />, { wrapper });
    await waitFor(() => expect(screen.getByTestId("count")).toBeInTheDocument(), { timeout: 10_000 });
    const loaded = screen.getByTestId("count").textContent;
    expect(loaded).toMatch(/\d+ assets/);

    // --- kill the real process -------------------------------------------
    const pid = execSync("lsof -ti:4000 || true").toString().trim().split("\n")[0];
    expect(pid, "expected something listening on :4000").toBeTruthy();
    execSync(`kill ${pid}`);
    await waitFor(async () => expect(await health()).toBe(false), { timeout: 15_000 });

    // Reconnecting notice, last good data still on screen, not a hard error.
    await waitFor(
      () => expect(screen.getByText(/Lost connection to the backend/)).toBeInTheDocument(),
      { timeout: 30_000 },
    );
    expect(screen.getByTestId("count").textContent).toBe(loaded);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // --- bring it back ----------------------------------------------------
    const child = spawn("npm", ["run", "dev"], {
      cwd: BACKEND_DIR, detached: true, stdio: "ignore", env: process.env,
    });
    child.unref();
    await waitFor(async () => expect(await health()).toBe(true), { timeout: 60_000 });

    await waitFor(
      () => expect(screen.queryByText(/Lost connection to the backend/)).not.toBeInTheDocument(),
      { timeout: 30_000 },
    );
    expect(screen.getByTestId("count").textContent).toMatch(/\d+ assets/);
  }, 150_000);
});

describe("live backend: session lifecycle", () => {
  /** Minimal app: a protected page plus the login page, same guard as production. */
  function LoginStub() {
    const { isAuthenticated, isInitializing } = useAuth();
    if (!isInitializing && isAuthenticated) return <Navigate to="/" replace />;
    return <div data-testid="login">Sign in</div>;
  }

  function Harness({ onReady }: { onReady: (auth: ReturnType<typeof useAuth>) => void }) {
    const auth = useAuth();
    useEffect(() => { onReady(auth); }, [auth, onReady]);
    return (
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<ProtectedRoute><div data-testid="page">Dashboard</div></ProtectedRoute>} />
          {/* Mirrors Login.tsx: an authenticated visit to /login bounces back. */}
          <Route path="/login" element={<LoginStub />} />
        </Routes>
      </MemoryRouter>
    );
  }

  live("a reload lands cleanly on login, because the token lived only in memory", async () => {
    let auth!: ReturnType<typeof useAuth>;
    const capture = (a: ReturnType<typeof useAuth>) => { auth = a; };
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    const view = render(<AuthProvider><Harness onReady={capture} /></AuthProvider>);

    // Logged out to begin with: the guard sends us to login.
    await waitFor(() => expect(screen.getByTestId("login")).toBeInTheDocument());

    // Sign in for real against the API (no form; this is the same call the form makes).
    await act(async () => {
      const res = await auth.login(EMAIL, PASSWORD);
      expect(res.ok).toBe(true);
    });
    await waitFor(() => expect(screen.getByTestId("page")).toBeInTheDocument());

    // Nothing was persisted anywhere. Spying on the prototype catches a write
    // to any key in either store, not just the one we would have guessed.
    expect(setItemSpy).not.toHaveBeenCalled();

    // A reload = the provider mounts fresh. In-memory token is gone.
    view.unmount();
    render(<AuthProvider><Harness onReady={capture} /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId("login")).toBeInTheDocument());
    expect(screen.queryByTestId("page")).not.toBeInTheDocument();   // no half-authenticated shell
  }, 30_000);

  live("logout drops the session immediately, and going back does not restore it", async () => {
    let auth!: ReturnType<typeof useAuth>;
    const capture = (a: ReturnType<typeof useAuth>) => { auth = a; };

    render(<AuthProvider><Harness onReady={capture} /></AuthProvider>);
    await act(async () => { await auth.login(EMAIL, PASSWORD); });
    await waitFor(() => expect(screen.getByTestId("page")).toBeInTheDocument());

    await act(async () => { auth.logout(); });
    await waitFor(() => expect(screen.getByTestId("login")).toBeInTheDocument());
    expect(auth.isAuthenticated).toBe(false);

    // Browser-back re-renders the guard, which re-reads live auth state.
    await act(async () => { window.history.back(); });
    expect(screen.queryByTestId("page")).not.toBeInTheDocument();
    expect(screen.getByTestId("login")).toBeInTheDocument();

    // And the dropped token really is gone: requests are rejected again.
    await expect(api.get("/api/assets")).rejects.toMatchObject({ status: 401 });
  }, 30_000);
});

describe("live backend: risk bands", () => {
  live("matrix data carries the seeded LOW..EXTREME spread, not one clustered band", async () => {
    const { result } = renderHook(() => useRisks(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 10_000 });
    expect(result.current.isError).toBe(false);

    const bands = (result.current.data ?? []).map(r => r.band);
    const distinct = new Set(bands);
    console.info(`[live] risk bands: ${JSON.stringify(
      Object.fromEntries([...distinct].map(b => [b, bands.filter(x => x === b).length])))}`);

    expect(bands.length).toBeGreaterThan(0);
    // The point of the change: more than one band, and the band the matrix
    // previously could not express is present.
    expect(distinct.size).toBeGreaterThanOrEqual(4);
    expect(distinct).toContain("extreme");
    expect(distinct).toContain("low");
  }, 20_000);

  live("every band shown comes from the API, never re-derived from L x I", async () => {
    const raw = await api.get<Array<{ id: number; likelihood: number; impact: number; band: string }>>("/api/risks");
    const mapped = toMatrixRisks(raw as never);

    // At least one row where L x I banding would have disagreed — proving the
    // matrix is not quietly recomputing.
    const lxiBand = (L: number, I: number) => {
      const s = L * I;
      return s >= 15 ? "critical" : s >= 10 ? "high" : s >= 5 ? "moderate" : "low";
    };
    const disagreements = raw.filter((r, i) =>
      mapped[i].band !== lxiBand(r.likelihood, r.impact));
    console.info(`[live] rows where API band != L x I band: ${disagreements.length}/${raw.length}`);
    expect(disagreements.length).toBeGreaterThan(0);

    raw.forEach((r, i) => expect(mapped[i].band).toBe(r.band.toLowerCase()));
  }, 20_000);
});

describe("live backend: wired pages render real data", () => {
  const page = (node: ReactNode) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );

  live("F4 · PHI Flow draws the seeded systems and derives its summary", async () => {
    render(page(<PhiFlow />));
    await waitFor(() => expect(screen.getByText("Epic EHR Core")).toBeInTheDocument(), { timeout: 15_000 });

    // Nodes came from the API, not the old hardcoded list: assert against a
    // name taken from the live response rather than one we remember.
    const flows = await api.get<Array<{ source: string; target: string }>>("/api/dataflows");
    const anyTarget = flows.find(f => f.target !== "Epic EHR Core")!.target;
    expect(screen.getAllByText(anyTarget).length).toBeGreaterThan(0);
    expect(screen.getByText(`${flows.length} flows monitored`)).toBeInTheDocument();
    console.info(`[live] PhiFlow rendered ${flows.length} flows`);
  }, 30_000);

  live("F5 · Risk Register renders API bands including EXTREME", async () => {
    render(page(<Risks />));
    await waitFor(() => expect(screen.getAllByText("Billing Engine DB").length).toBeGreaterThan(0), { timeout: 15_000 });

    // Legend carries all five bands; EXTREME is the one the matrix used to lack.
    expect(screen.getByText("Extreme")).toBeInTheDocument();
    expect(screen.getAllByText("EXTREME").length).toBeGreaterThan(0);
    expect(screen.getByText("Band = Likelihood x Impact x Exposure x Control gap (API)")).toBeInTheDocument();
    console.info("[live] Risks rendered with API-scored bands");
  }, 30_000);

  live("F6 · Dashboard summary cards compute from the three endpoints", async () => {
    const [assets, flows] = await Promise.all([
      api.get<unknown[]>("/api/assets"),
      api.get<Array<{ recordsPerDay: number }>>("/api/dataflows"),
    ]);
    const phiPerDay = flows.reduce((s, f) => s + f.recordsPerDay, 0);

    render(page(<Dashboard />));
    await waitFor(() => expect(screen.getByText("Assets Monitored")).toBeInTheDocument(), { timeout: 15_000 });

    await waitFor(() => expect(screen.getByText(String(assets.length))).toBeInTheDocument(), { timeout: 15_000 });
    // Flows resolve on their own clock; wait for that card rather than assuming
    // it landed with the assets one.
    await waitFor(
      () => expect(screen.getByText(phiPerDay.toLocaleString())).toBeInTheDocument(),
      { timeout: 15_000 },
    );
    console.info(`[live] Dashboard: ${assets.length} assets, ${phiPerDay.toLocaleString()} PHI records/day`);
  }, 30_000);
});

describe("live backend: vendor risk", () => {
  live("Vendor page renders the seeded vendors and leads with the BAA gap", async () => {
    // `risk` is null for any vendor the engine has not scored — every vendor
    // created by CSV import is one. The page must survive them, so the live
    // check has to allow for them too.
    const raw = await api.get<Array<{ name: string; baaStatus: string; risk: { band: string } | null }>>("/api/vendors");
    expect(raw.length).toBeGreaterThan(0);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}>
        <MemoryRouter><Vendors /></MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText(raw[0].name)).toBeInTheDocument(), { timeout: 15_000 });

    // Every seeded vendor reaches the table.
    raw.forEach(v => expect(screen.getAllByText(v.name).length).toBeGreaterThan(0));

    // The compliance gap is surfaced, not buried, whenever one exists.
    const nonCompliant = raw.filter(v => v.baaStatus !== "SIGNED");
    if (nonCompliant.length) {
      expect(screen.getByText(/BAA gap:/)).toBeInTheDocument();
    }

    console.info(`[live] vendors: ${raw.length}, without valid BAA: ${nonCompliant.length}, ` +
      `bands: ${JSON.stringify([...new Set(raw.map(v => v.risk?.band ?? "UNSCORED"))])}`);
  }, 30_000);
});
