import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/use-auth";
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
    <MemoryRouter><AuthProvider>{node}</AuthProvider></MemoryRouter>
  </QueryClientProvider>
);

describe("Vendor Risk page: first paint", () => {
  /*
   * Both of these are about the same half-second: what the page says before
   * the fetch lands. A number rendered from an empty array is not a loading
   * state, it is a wrong answer, and a banner that appears late shoves
   * everything under it down the screen.
   */

  it("shows no band counts until the data is in", async () => {
    render(wrap(<Vendors />));

    // The summary card is last in the DOM; the table above also renders band
    // badges once it has rows, so take the final one.
    const extremeRow = () => screen.getAllByText("EXTREME").at(-1)!.parentElement!.textContent;

    // Zero vendors at EXTREME is a claim, and at this moment we cannot make it.
    expect(extremeRow()).not.toMatch(/0/);

    await waitFor(() => expect(screen.getByText("Northwind Claims Processing")).toBeInTheDocument());
    // ...and once it is in, the real count is there.
    await waitFor(() => expect(extremeRow()).toMatch(/1/));
  });

  it("reserves the headline banner's space while loading so nothing jumps", async () => {
    render(wrap(<Vendors />));
    expect(screen.getByRole("status", { name: "Loading summary" })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText(/BAA gap:/)).toBeInTheDocument());
    expect(screen.queryByRole("status", { name: "Loading summary" })).not.toBeInTheDocument();
  });
});

describe("Vendor Risk page", () => {
  it("lists every vendor worst-score first", async () => {
    render(wrap(<Vendors />));
    await waitFor(() => expect(screen.getByText("Northwind Claims Processing")).toBeInTheDocument());

    // The name cell now carries a subtitle, so target the name node itself
    // rather than the whole cell — the assertion is about order, not markup.
    const names = screen.getAllByTestId("vendor-row-name").map(n => n.textContent);
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

describe("Vendor Risk page: a vendor the engine has not scored", () => {
  /*
   * `GET /api/vendors` returns `risk: null` for any vendor with no risk
   * record — which is every vendor created through the CSV import, since the
   * import writes the vendor and nothing else. The frontend type claimed the
   * field was always present, so `tsc` was happy while the page crashed on
   * the first unscored vendor it met.
   */

  const UNSCORED = vendor({
    id: 9, name: "Arcadia Care Logistics", baaStatus: "PENDING", baaCompliant: false,
    phiVolume: 9400, assetCount: 0, assets: [], risk: null,
  });

  it("renders the table instead of crashing", async () => {
    payload = [...SEED, UNSCORED];
    render(wrap(<Vendors />));

    await waitFor(() => expect(screen.getByText("Arcadia Care Logistics")).toBeInTheDocument());
    // The scored vendors must still be there — a crash would take them too.
    expect(screen.getByText("Northwind Claims Processing")).toBeInTheDocument();
  });

  it("sorts unscored vendors last rather than treating them as zero-risk", async () => {
    payload = [UNSCORED, ...SEED];
    render(wrap(<Vendors />));

    await waitFor(() => expect(screen.getByText("Arcadia Care Logistics")).toBeInTheDocument());

    const names = screen.getAllByTestId("vendor-row-name").map(n => n.textContent);
    expect(names[0]).toBe("Northwind Claims Processing");
    expect(names[names.length - 1]).toBe("Arcadia Care Logistics");
  });

  it("says it is unscored rather than showing a made-up band", async () => {
    payload = [...SEED, UNSCORED];
    render(wrap(<Vendors />));

    await waitFor(() => expect(screen.getByText("Arcadia Care Logistics")).toBeInTheDocument());
    expect(screen.getByTestId("vendor-row-band-9").textContent).toBe("Not scored");
  });

  it("leaves unscored vendors out of the band counts", async () => {
    payload = [...SEED, UNSCORED];
    render(wrap(<Vendors />));

    await waitFor(() => expect(screen.getByText("Arcadia Care Logistics")).toBeInTheDocument());
    // Five vendors, but only four carry a band.
    expect(screen.getByTestId("band-count-MODERATE").textContent).toBe("1");
    expect(screen.getByTestId("band-count-LOW").textContent).toBe("1");
  });
});

describe("a vendor that is not there", () => {
  /*
   * Reached by a bookmark to a record since deleted, or by an id typed into
   * the URL. The drawer opened and then sat empty: the fetch 404s, so there
   * is no vendor to render, and nothing else claimed the space. Eighteen
   * seconds of a panel showing only the word "Vendor" reads as a hung app,
   * not as "that record is gone".
   */
  it("explains a 404 instead of opening an empty panel", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (/\/api\/vendors\/\d+$/.test(url)) {
        return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "No such vendor" } }),
          { status: 404, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ data: SEED }),
        { status: 200, headers: { "content-type": "application/json" } });
    }));

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <MemoryRouter initialEntries={["/vendors?open=999999"]}>
          <AuthProvider><Vendors /></AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // The panel must say something. Anything the user can act on.
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
