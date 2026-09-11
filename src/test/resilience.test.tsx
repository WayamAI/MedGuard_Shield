import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";
import { DataState } from "@/components/DataState";
import { useApiQuery } from "@/hooks/useApiQuery";
import { PhiSankey } from "@/components/PhiSankey";
import { RiskMatrix } from "@/components/RiskMatrix";
import { KPI } from "@/components/ui-bits";
import { toSankeyData, toMatrixRisks } from "@/lib/mappers";
import type { ApiDataFlow, ApiRisk } from "@/lib/apiTypes";

/* ---------------------------------------------------------------------------
   Backend simulator.

   apiClient goes through global fetch, so stubbing fetch intercepts at exactly
   the boundary the real backend will sit behind — no msw, no extra dependency.
   `scenario` is swapped mid-test to simulate the backend dying and recovering.
   -------------------------------------------------------------------------- */

type Scenario =
  | { kind: "ok"; body: unknown; delayMs?: number }
  | { kind: "down" }                    // connection refused -> fetch rejects
  | { kind: "status"; code: number };

let scenario: Scenario = { kind: "ok", body: [] };
let callCount = 0;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  callCount = 0;
  vi.stubEnv("VITE_API_BASE_URL", "http://backend.test");
  vi.stubGlobal("fetch", vi.fn(async () => {
    callCount++;
    const s = scenario;
    if (s.kind === "down") throw new TypeError("Failed to fetch");
    if (s.kind === "status") return jsonResponse({ message: "boom" }, s.code);
    if (s.delayMs) await new Promise(r => setTimeout(r, s.delayMs));
    return jsonResponse(s.body);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

const FLOWS: ApiDataFlow[] = [
  { source: "Patient Portal", target: "Epic EHR Core", phiType: "Demographics", recordsPerDay: 12400, encrypted: true },
  { source: "Epic EHR Core", target: "Billing Engine", phiType: "Claims", recordsPerDay: 87100, encrypted: false },
];

const RISKS: ApiRisk[] = [
  { id: 1, assetId: 1, assetName: "Billing Engine DB", likelihood: 4, impact: 5,
    exposure: 5, controlGap: 5, score: 100, band: "EXTREME", computedAt: "2026-01-01T00:00:00.000Z" },
];

/** Stand-in for the wired PhiFlow page, using the real hook + boundary. */
function SankeyView({ pollIntervalMs = 60_000, reconnectIntervalMs = 20 }: {
  pollIntervalMs?: number; reconnectIntervalMs?: number;
}) {
  const query = useApiQuery<ApiDataFlow[], ReturnType<typeof toSankeyData>>(
    ["dataflows"], "/api/dataflows", toSankeyData,
    { retry: 0, staleTime: 0, pollIntervalMs, reconnectIntervalMs },
  );
  return (
    <DataState query={query} emptyTitle="No PHI flows recorded" height={470}>
      {d => <PhiSankey nodes={d.nodes} links={d.links} onSelect={vi.fn()} />}
    </DataState>
  );
}

function MatrixView() {
  const query = useApiQuery<ApiRisk[], ReturnType<typeof toMatrixRisks>>(
    ["risks"], "/api/risks", toMatrixRisks, { retry: 0, staleTime: 0 },
  );
  return (
    <DataState query={query} emptyTitle="No risks in the register">
      {rs => <RiskMatrix risks={rs} onSelect={vi.fn()} />}
    </DataState>
  );
}

/* ========================================================================== */

describe("slow network", () => {
  it("holds a sized skeleton instead of flashing empty content", async () => {
    scenario = { kind: "ok", body: FLOWS, delayMs: 60 };
    render(<SankeyView />, { wrapper });

    // Mid-flight: skeleton present, chart absent, space already reserved.
    const skeleton = screen.getByRole("status", { name: "Loading data" });
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveStyle({ height: "470px" });
    expect(screen.queryByText("Epic EHR Core")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Epic EHR Core")).toBeInTheDocument());
    expect(screen.queryByRole("status", { name: "Loading data" })).not.toBeInTheDocument();
  });

  it("shimmers the KPI figure rather than rendering 'undefined'", () => {
    const { rerender } = render(<KPI icon="database" label="PHI Records" loading />);
    expect(screen.getByRole("status", { name: "Loading PHI Records" })).toBeInTheDocument();
    rerender(<KPI icon="database" label="PHI Records" value={undefined} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("backend unreachable on first load", () => {
  it("explains the failure in plain language and offers retry", async () => {
    scenario = { kind: "down" };
    render(<SankeyView />, { wrapper });

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText("Can't reach the backend")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    // Never a raw stack trace.
    expect(screen.queryByText(/TypeError/)).not.toBeInTheDocument();
  });

  it("distinguishes a 500 from an unreachable host", async () => {
    scenario = { kind: "status", code: 500 };
    render(<MatrixView />, { wrapper });
    await waitFor(() => expect(screen.getByText("The backend returned an error")).toBeInTheDocument());
  });

  it("does not retry-storm a 401", async () => {
    scenario = { kind: "status", code: 401 };
    render(<MatrixView />, { wrapper });
    await waitFor(() => expect(screen.getByText("Session expired")).toBeInTheDocument());
    expect(callCount).toBe(1);
  });
});

describe("empty and malformed payloads", () => {
  it("shows an empty state, not a broken chart, when the seed did not run", async () => {
    scenario = { kind: "ok", body: [] };
    render(<SankeyView />, { wrapper });
    await waitFor(() => expect(screen.getByText("No PHI flows recorded")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("survives malformed flow records without crashing the view", async () => {
    scenario = { kind: "ok", body: [
      { source: "A", target: "B", recordsPerDay: null, encrypted: true },
      { source: "B", target: "C", recordsPerDay: "lots", encrypted: undefined },
    ] };
    render(<SankeyView />, { wrapper });
    await waitFor(() => expect(screen.getByText("A")).toBeInTheDocument());
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("survives malformed risk records without crashing the matrix", async () => {
    scenario = { kind: "ok", body: [
      { id: 99, assetName: "Broken Asset", likelihood: null, impact: "high", band: null },
    ] };
    render(<MatrixView />, { wrapper });
    // Chip label is the zero-padded id; a null likelihood must not crash the grid.
    await waitFor(() => expect(screen.getByText("099")).toBeInTheDocument());
  });
});

describe("backend killed mid-session", () => {
  it("keeps the last good data behind a reconnecting notice, then recovers with no remount", async () => {
    /** Counts mounts so a silent full remount (i.e. a reload) would be caught. */
    let mounts = 0;
    const MountCounter = () => {
      const seen = useRef(false);
      useEffect(() => { if (!seen.current) { seen.current = true; mounts++; } }, []);
      return null;
    };

    scenario = { kind: "ok", body: FLOWS };
    render(<><MountCounter /><SankeyView pollIntervalMs={25} reconnectIntervalMs={25} /></>, { wrapper });

    // 1. Healthy.
    await waitFor(() => expect(screen.getByText("Epic EHR Core")).toBeInTheDocument());
    expect(screen.queryByText(/Lost connection/)).not.toBeInTheDocument();
    expect(mounts).toBe(1);

    // 2. Backend dies. The self-healing poll fires the next request.
    scenario = { kind: "down" };
    await waitFor(
      () => expect(screen.getByText(/Lost connection to the backend/)).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // The screen did NOT blank: the last known chart is still on it.
    expect(screen.getByText("Epic EHR Core")).toBeInTheDocument();
    expect(screen.getByText("Patient Portal")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();   // not a hard error

    // 3. Backend comes back. Recovery is automatic, no user action, no reload.
    scenario = { kind: "ok", body: FLOWS };
    await waitFor(
      () => expect(screen.queryByText(/Lost connection to the backend/)).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(screen.getByText("Epic EHR Core")).toBeInTheDocument();
    expect(mounts).toBe(1);
  });

  it("stops polling once the session is the problem", async () => {
    scenario = { kind: "ok", body: RISKS };
    render(<MatrixView />, { wrapper });
    await waitFor(() => expect(screen.getByText("001")).toBeInTheDocument());

    scenario = { kind: "status", code: 401 };
    const before = callCount;
    await act(async () => { await new Promise(r => setTimeout(r, 120)); });
    // No background poll storm against an endpoint that will keep saying no.
    expect(callCount - before).toBeLessThanOrEqual(1);
  });
});
