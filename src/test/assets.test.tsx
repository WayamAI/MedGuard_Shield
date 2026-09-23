import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/use-auth";
import Assets from "@/pages/Assets";
import type { ApiAsset } from "@/lib/apiTypes";

/**
 * The Assets screen is new UI over endpoints the frontend had never called.
 * These cover the parts that carry a claim: that an unscored asset is shown
 * as unknown rather than safe, that the headline numbers come from the same
 * response the table renders, and that write actions are gated on role.
 */

const asset = (over: Partial<ApiAsset>): ApiAsset => ({
  id: 1, name: "Epic EHR Core", type: "EHR", phiVolume: 412000,
  encrypted: true, mfaEnabled: true,
  lastAssessedAt: "2026-09-18T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  archivedAt: null,
  risk: { score: 48, band: "HIGH", computedAt: "2026-09-18T00:00:00.000Z" },
  counts: { phiTypes: 1, flows: 2, accessGrants: 2, openThreats: 0, controls: 0 },
  ...over,
});

const SEED: ApiAsset[] = [
  asset({ id: 1, name: "Billing Engine DB", type: "DATABASE", phiVolume: 87100, encrypted: false, mfaEnabled: false,
          risk: { score: 100, band: "EXTREME", computedAt: "2026-09-18T00:00:00.000Z" } }),
  asset({ id: 2, name: "Epic EHR Core" }),
  asset({ id: 3, name: "Patient Portal", type: "OTHER", phiVolume: 12400,
          risk: { score: 8.64, band: "LOW", computedAt: "2026-09-18T00:00:00.000Z" } }),
  asset({ id: 4, name: "Telehealth Gateway", type: "API", phiVolume: 18500, risk: null, lastAssessedAt: null }),
];

let payload: unknown = SEED;
let detailPayload: unknown = null;
let status = 200;

beforeEach(() => {
  payload = SEED; detailPayload = null; status = 200;
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (/\/api\/assets\/\d+/.test(url) && detailPayload) {
      return new Response(JSON.stringify({ data: detailPayload }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }
    const rows = Array.isArray(payload) ? payload : [];
    const body = status === 200
      ? { data: payload, meta: { page: 1, pageSize: 25, total: rows.length, totalPages: 1 } }
      : { error: { code: "SERVER_ERROR", message: "down" } };
    return new Response(JSON.stringify(body), {
      status, headers: { "content-type": "application/json" },
    });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const wrap = (node: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    <MemoryRouter><AuthProvider>{node}</AuthProvider></MemoryRouter>
  </QueryClientProvider>
);

describe("Asset detail", () => {
  /*
   * The asset is the hub of the Drishti model — PHI lives in it, identities
   * reach it, vendors touch it, threats fire against it. The drawer showed
   * only PHI and flows while the API returned the whole graph in the same
   * response, so half the model was being fetched and thrown away.
   */
  const DETAIL = {
    ...SEED[0],
    phiTypes: [{ id: 1, name: "Financial", sensitivity: "MEDIUM", recordsPerDay: 87100 }],
    risk: { id: 1, likelihood: 5, impact: 5, exposure: 5, controlGap: 5,
            score: 100, band: "EXTREME", computedAt: "2026-09-18T00:00:00.000Z" },
    flows: { outbound: [], inbound: [{ from: "Epic EHR Core", recordsPerDay: 87100, encrypted: false }] },
    vendors: [{ id: 1, name: "Northwind Claims Processing", baaStatus: "MISSING", grantedAt: "2026-01-01T00:00:00.000Z" }],
    access: [{ id: 9, identityId: 6, identityName: "svc-legacy-billing-sync", kind: "SERVICE_ACCOUNT",
               active: true, mfaEnabled: false, level: "WRITE",
               grantedAt: "2024-03-16T00:00:00.000Z", lastUsedAt: null }],
    threats: [{ id: 1, severity: "CRITICAL", status: "INVESTIGATING",
                title: "Bulk PHI export from billing database",
                detectedAt: "2026-09-18T00:00:00.000Z", resolvedAt: null }],
    controls: [],
    remediations: [],
  };

  const openDrawer = async () => {
    payload = SEED;
    detailPayload = DETAIL;
    render(wrap(<Assets />));
    await waitFor(() => expect(screen.getByText("Billing Engine DB")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("row-1"));
    await waitFor(() => expect(screen.getByRole("tab", { name: /Overview/ })).toBeInTheDocument());
  };

  it("offers a tab for each side of the graph the API returns", async () => {
    await openDrawer();
    for (const name of [/Overview/, /Risk/, /PHI/, /Flows/, /Access/, /Vendors/, /Threats/]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
  });

  it("shows the identities that can reach the asset", async () => {
    await openDrawer();
    fireEvent.click(screen.getByRole("tab", { name: /Access/ }));
    expect(await screen.findByText("svc-legacy-billing-sync")).toBeInTheDocument();
    expect(screen.getByText("Never used")).toBeInTheDocument();
  });

  it("shows the vendors that touch the asset, with their BAA state", async () => {
    await openDrawer();
    fireEvent.click(screen.getByRole("tab", { name: /Vendors/ }));
    expect(await screen.findByText("Northwind Claims Processing")).toBeInTheDocument();
    expect(screen.getByText(/BAA missing/)).toBeInTheDocument();
  });

  it("shows what has been detected against the asset", async () => {
    await openDrawer();
    fireEvent.click(screen.getByRole("tab", { name: /Threats/ }));
    expect(await screen.findByText("Bulk PHI export from billing database")).toBeInTheDocument();
  });
});

describe("Asset inventory", () => {
  it("lists every asset the API returned", async () => {
    render(wrap(<Assets />));
    await waitFor(() => expect(screen.getByText("Billing Engine DB")).toBeInTheDocument());
    for (const a of SEED) expect(screen.getByText(a.name)).toBeInTheDocument();
  });

  it("shows an unscored asset as unknown, not as low risk", async () => {
    render(wrap(<Assets />));
    await waitFor(() => expect(screen.getByText("Telehealth Gateway")).toBeInTheDocument());

    const row = screen.getByTestId("row-4");
    expect(within(row).getByText("Not scored")).toBeInTheDocument();
    // An unscored asset must never borrow a band from anywhere.
    for (const band of ["LOW", "MODERATE", "HIGH", "CRITICAL", "EXTREME"]) {
      expect(within(row).queryByText(band)).not.toBeInTheDocument();
    }
  });

  it("orders by score with unscored last", async () => {
    render(wrap(<Assets />));
    await waitFor(() => expect(screen.getByText("Billing Engine DB")).toBeInTheDocument());

    const order = [...document.querySelectorAll("tbody tr")].map(r => r.getAttribute("data-testid"));
    expect(order[0]).toBe("row-1");                       // score 100
    expect(order[order.length - 1]).toBe("row-4");        // unscored
  });

  it("derives the headline metrics from the same response as the table", async () => {
    render(wrap(<Assets />));
    await waitFor(() => expect(screen.getByText("Billing Engine DB")).toBeInTheDocument());

    // 4 assets, 1 unencrypted (Billing), 1 extreme + 0 critical, 1 unscored.
    expect(screen.getByTestId("metric-assets")).toHaveTextContent("4");
    expect(screen.getByTestId("metric-unencrypted")).toHaveTextContent("1");
    expect(screen.getByTestId("metric-critical-or-extreme")).toHaveTextContent("1");
    expect(screen.getByText(/not yet scored/)).toBeInTheDocument();
  });

  it("sends the band filter to the server rather than filtering the page", async () => {
    render(wrap(<Assets />));
    await waitFor(() => expect(screen.getByText("Billing Engine DB")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("radio", { name: /Extreme/ }));

    // The whole point: narrowing is a new request, not a client-side filter
    // over the 25 rows that happen to be on screen.
    await waitFor(() => {
      const urls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map(c => String(c[0]));
      expect(urls.some(u => u.includes("band=EXTREME"))).toBe(true);
    });
  });

  it("sends the search term to the server", async () => {
    render(wrap(<Assets />));
    await waitFor(() => expect(screen.getByText("Billing Engine DB")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Search assets/), { target: { value: "epic" } });

    await waitFor(() => {
      const urls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map(c => String(c[0]));
      expect(urls.some(u => u.includes("search=epic"))).toBe(true);
    }, { timeout: 3000 });
  });

  it("explains an unreachable backend instead of rendering an empty table", async () => {
    status = 500;
    render(wrap(<Assets />));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument(), { timeout: 8000 });
    expect(screen.queryByText("Billing Engine DB")).not.toBeInTheDocument();
  }, 12_000);

  it("shows an empty state rather than a broken table", async () => {
    payload = [];
    render(wrap(<Assets />));
    await waitFor(() => expect(screen.getByText(/No assets yet/)).toBeInTheDocument());
  });

  it("hides write actions from a signed-out or read-only user", async () => {
    // No session in this harness, so role is undefined — the read-only case.
    render(wrap(<Assets />));
    await waitFor(() => expect(screen.getByText("Billing Engine DB")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /New asset/ })).not.toBeInTheDocument();
  });
});
