import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import Vendors from "@/pages/Vendors";
import type { ApiVendor } from "@/lib/apiTypes";

const vendor = (over: Partial<ApiVendor>): ApiVendor => ({
  id: 1, name: "Acme", baaStatus: "SIGNED", phiVolume: 1000,
  lastAssessedAt: "2026-06-01T00:00:00.000Z", daysSinceAssessment: 100,
  assessmentOverdue: false, baaCompliant: true, assetCount: 1,
  assets: ["Some System"], risk: { score: 10, band: "LOW", computedAt: "2026-09-01T00:00:00.000Z" },
  ...over,
});

/** Mirrors the shape of the seeded set, including the headline BAA gap. */
const SEED: ApiVendor[] = [
  vendor({ id: 1, name: "Northwind Claims Processing", baaStatus: "MISSING", baaCompliant: false,
           phiVolume: 87100, lastAssessedAt: null, daysSinceAssessment: null, assessmentOverdue: true,
           assetCount: 2, assets: ["Billing Engine DB", "Insurance Claims Gateway"],
           risk: { score: 100, band: "EXTREME", computedAt: "2026-09-01T00:00:00.000Z" } }),
  vendor({ id: 2, name: "Veritas Transcription", baaStatus: "EXPIRED", baaCompliant: false,
           daysSinceAssessment: 512, assessmentOverdue: true,
           risk: { score: 80, band: "CRITICAL", computedAt: "2026-09-01T00:00:00.000Z" } }),
  vendor({ id: 3, name: "Clarity Imaging Partners", baaStatus: "PENDING", baaCompliant: false,
           risk: { score: 38.4, band: "MODERATE", computedAt: "2026-09-01T00:00:00.000Z" } }),
  vendor({ id: 5, name: "Sentinel Backup Services" }),
];

let payload: ApiVendor[] = SEED;
let status = 200;

beforeEach(() => {
  payload = SEED; status = 200;
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify(status === 200 ? { data: payload } : { message: "down" }),
      { status, headers: { "content-type": "application/json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const wrap = (node: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    <MemoryRouter>{node}</MemoryRouter>
  </QueryClientProvider>
);

describe("Vendor Risk page", () => {
  it("lists every vendor worst-score first", async () => {
    render(wrap(<Vendors />));
    await waitFor(() => expect(screen.getByText("Northwind Claims Processing")).toBeInTheDocument());

    const names = [...document.querySelectorAll("tbody tr td:first-child")].map(td => td.textContent);
    expect(names).toEqual([
      "Northwind Claims Processing",   // 100
      "Veritas Transcription",         // 80
      "Clarity Imaging Partners",      // 38.4
      "Sentinel Backup Services",      // 10
    ]);
  });

  it("leads with the BAA gap rather than burying it in a column", async () => {
    render(wrap(<Vendors />));
    await waitFor(() => expect(screen.getByText(/BAA gap:/)).toBeInTheDocument());
    // The banner names the vendor, the volume and the systems at stake.
    const banner = screen.getByText(/BAA gap:/).closest("div")!;
    expect(banner.textContent).toContain("Northwind Claims Processing holds 87,100 PHI records across 2 systems");
    expect(banner.textContent).toContain("missing");
    expect(banner.textContent).toContain("never assessed");
  });

  it("counts only SIGNED as a valid BAA", async () => {
    render(wrap(<Vendors />));
    await waitFor(() => expect(screen.getByText("Northwind Claims Processing")).toBeInTheDocument());

    // Three of the four rows carry a non-signed agreement, and each renders as
    // its own badge rather than a generic "non-compliant".
    const badges = [...document.querySelectorAll("tbody tr td:nth-child(2)")].map(td => td.textContent);
    expect(badges).toEqual(["Missing", "Expired", "Pending", "Signed"]);
    expect(badges.filter(b => b !== "Signed")).toHaveLength(3);
  });

  it("flags an overdue assessment in the row", async () => {
    render(wrap(<Vendors />));
    await waitFor(() => expect(screen.getByText("Never assessed · overdue")).toBeInTheDocument());
    expect(screen.getByText("512 days ago · overdue")).toBeInTheDocument();
  });

  it("shows an empty state rather than a broken table", async () => {
    payload = [];
    render(wrap(<Vendors />));
    await waitFor(() => expect(screen.getByText("No vendors recorded")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains an unreachable backend instead of rendering nothing", async () => {
    status = 503;
    render(wrap(<Vendors />));
    // useApiQuery retries a 5xx three times with backoff before settling, so
    // this legitimately takes several seconds.
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument(), { timeout: 20_000 });
    expect(screen.getByText("The backend returned an error")).toBeInTheDocument();
  }, 30_000);
});
