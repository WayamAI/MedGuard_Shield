import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/use-auth";
import Access from "@/pages/Access";
import Threats from "@/pages/Threats";
import type { ApiAccessGrant, ApiAccessSummary, ApiThreat, ApiThreatSummary } from "@/lib/apiTypes";

/**
 * Access and Threats against the paginated contract.
 *
 * The central property under test is unchanged and now matters more: the
 * headline counts come from /summary and describe the organisation, while
 * the table shows one page. These fixtures deliberately disagree — the
 * summary says 9 grants and 6 flagged, the page returns 3 rows — so any
 * regression that starts counting rows instead of reading the summary fails
 * here rather than in front of a customer.
 */

const ACCESS_SUMMARY: ApiAccessSummary = {
  total: 9, flagged: 6, stale: 1, neverUsed: 1, withoutMfa: 3,
  inactiveIdentities: 1, excessiveLevel: 6, neverReviewed: 9, staleAfterDays: 90,
};

/** Server order: worst-first by flag count, then longest idle. */
const GRANTS: ApiAccessGrant[] = [
  { id: 6, identityId: 4, identityName: "Robert Chen (contractor)",
    identityEmail: "r.chen@contractor.example", kind: "USER", department: "Radiology",
    active: false, mfaEnabled: false, assetId: 5, assetName: "Imaging Archive (S3)",
    assetType: "CLOUD_STORAGE", level: "ADMIN", grantedAt: "2025-04-30T00:00:00Z",
    lastUsedAt: "2026-01-12T00:00:00Z", lastReviewedAt: null, revokedAt: null,
    daysSinceUse: 244, daysSinceGrant: 501,
    flags: ["STALE", "INACTIVE_IDENTITY", "NO_MFA", "EXCESSIVE_LEVEL"], riskFlagCount: 4 },
  { id: 9, identityId: 6, identityName: "svc-legacy-billing-sync", identityEmail: null,
    kind: "SERVICE_ACCOUNT", department: "Billing", active: true, mfaEnabled: false,
    assetId: 6, assetName: "Billing Engine DB", assetType: "DATABASE", level: "WRITE",
    grantedAt: "2024-03-16T00:00:00Z", lastUsedAt: null, lastReviewedAt: null, revokedAt: null,
    daysSinceUse: null, daysSinceGrant: 911,
    flags: ["NEVER_USED", "EXCESSIVE_LEVEL"], riskFlagCount: 2 },
  { id: 1, identityId: 1, identityName: "Dr. Aisha Patel", identityEmail: "a.patel@meridian.org",
    kind: "USER", department: "ICU", active: true, mfaEnabled: true, assetId: 3,
    assetName: "Epic EHR Core", assetType: "EHR", level: "READ",
    grantedAt: "2026-06-01T00:00:00Z", lastUsedAt: "2026-09-12T00:00:00Z",
    lastReviewedAt: null, revokedAt: null,
    daysSinceUse: 1, daysSinceGrant: 103, flags: [], riskFlagCount: 0 },
];

const THREAT_SUMMARY: ApiThreatSummary = {
  total: 5, open: 3,
  bySeverity: { CRITICAL: 2, HIGH: 1, MEDIUM: 1, LOW: 1 },
  byStatus: { OPEN: 2, INVESTIGATING: 1, RESOLVED: 1, FALSE_POSITIVE: 1 },
  openCritical: 2,
};

/** Server order: open items first, then by severity. */
const THREATS: ApiThreat[] = [
  { id: 2, severity: "CRITICAL", status: "OPEN", title: "Authenticated session from Tor exit node",
    description: "Claims gateway accepted credentials from a known Tor exit node.",
    assetId: 8, assetName: "Insurance Claims Gateway", assetType: "API",
    detectedAt: "2026-09-11T22:00:00Z", resolvedAt: null, hoursSinceDetection: 43, open: true },
  { id: 3, severity: "HIGH", status: "OPEN", title: "Privilege escalation attempt on EHR core",
    description: "Three admin-scoped calls, all rejected.", assetId: 3, assetName: "Epic EHR Core",
    assetType: "EHR", detectedAt: "2026-09-11T05:00:00Z", resolvedAt: null,
    hoursSinceDetection: 60, open: true },
  { id: 4, severity: "MEDIUM", status: "RESOLVED", title: "Imaging archive accessed outside working hours",
    description: "Confirmed as on-call review.", assetId: 5, assetName: "Imaging Archive (S3)",
    assetType: "CLOUD_STORAGE", detectedAt: "2026-09-10T03:00:00Z",
    resolvedAt: "2026-09-11T01:00:00Z", hoursSinceDetection: 86, open: false },
];

let grants: ApiAccessGrant[] = GRANTS;
let threats: ApiThreat[] = THREATS;
let status = 200;

/**
 * A realistic first page: fewer rows than the total, so the range maths and
 * the "summary is not the page" property are both actually exercised.
 */
const page = (rows: unknown[], total: number) => ({
  data: rows,
  meta: {
    page: 1,
    pageSize: rows.length || 25,
    total,
    totalPages: rows.length ? Math.ceil(total / rows.length) : 1,
  },
});

beforeEach(() => {
  status = 200;
  grants = GRANTS;
  threats = THREATS;
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (body: unknown, code = status) =>
      new Response(JSON.stringify(body), {
        status: code, headers: { "content-type": "application/json" },
      });

    if (status !== 200) return json({ error: { code: "SERVER_ERROR", message: "down" } });

    if (url.includes("/api/access/summary")) return json({ data: ACCESS_SUMMARY });
    if (url.includes("/api/access")) return json(page(grants, ACCESS_SUMMARY.total));
    if (url.includes("/api/threats/summary")) return json({ data: THREAT_SUMMARY });
    if (/\/api\/threats\/\d+/.test(url)) {
      return json({ data: { ...threats[0], allowedTransitions: ["INVESTIGATING", "RESOLVED"] } });
    }
    if (url.includes("/api/threats")) return json(page(threats, THREAT_SUMMARY.total));
    return json({ data: [], meta: { page: 1, pageSize: 25, total: 0, totalPages: 1 } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const wrap = (node: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    <MemoryRouter><AuthProvider>{node}</AuthProvider></MemoryRouter>
  </QueryClientProvider>
);

describe("Access page", () => {
  it("preserves the server's worst-first ordering", async () => {
    render(wrap(<Access />));
    await waitFor(() => expect(screen.getByText("Robert Chen (contractor)")).toBeInTheDocument());

    // Ordering is the server's job now — the page must not re-sort and
    // quietly disagree with what pagination assumed.
    const names = [...document.querySelectorAll("tbody tr td:first-child")]
      .map(td => td.textContent ?? "");
    expect(names[0]).toContain("Robert Chen (contractor)");
    expect(names[names.length - 1]).toContain("Dr. Aisha Patel");
  });

  it("surfaces the over-privileged grant instead of burying it", async () => {
    render(wrap(<Access />));
    await waitFor(() => expect(screen.getByText(/Over-privileged grant:/)).toBeInTheDocument());
    const banner = screen.getByText(/Over-privileged grant:/).closest("div")!;
    expect(banner.textContent).toContain("Robert Chen (contractor)");
    expect(banner.textContent).toContain("ADMIN");
    expect(banner.textContent).toContain("Imaging Archive (S3)");
    expect(banner.textContent).toContain("deactivated identity");
  });

  it("reads the organisation summary rather than counting the page", async () => {
    render(wrap(<Access />));

    // The page holds 3 rows; the summary says 9 total and 6 flagged.
    // Counting rows would render "of 3 grants" — these strings are the proof
    // that /api/access/summary is what the metrics come from.
    await waitFor(() => expect(screen.getByText("of 9 grants")).toBeInTheDocument());
    expect(screen.getByText("unused past 90 days")).toBeInTheDocument();
    expect(document.querySelectorAll("tbody tr")).toHaveLength(3);
  });

  it("states the whole dataset size in the table footer", async () => {
    render(wrap(<Access />));
    // "1–3 of 9", never a bare "3 rows" that implies 3 is all there is.
    // Built from several expressions in one span, so match on textContent.
    await waitFor(() => {
      const live = document.querySelector("[aria-live=polite]");
      expect(live?.textContent?.replace(/\s+/g, " ")).toContain("1–3 of 9");
    });
  });

  it("renders a never-used grant as such, not as a blank cell", async () => {
    render(wrap(<Access />));
    await waitFor(() => expect(screen.getAllByText("Never used").length).toBeGreaterThan(0));
  });

  it("shows an empty state when there are no grants", async () => {
    grants = [];
    render(wrap(<Access />));
    await waitFor(() => expect(screen.getByText("No access grants")).toBeInTheDocument());
  });
});

describe("Threats page", () => {
  it("preserves the server's open-first ordering", async () => {
    render(wrap(<Threats />));
    await waitFor(() =>
      expect(screen.getByText("Authenticated session from Tor exit node")).toBeInTheDocument());

    const titles = [...document.querySelectorAll("tbody tr td:nth-child(2)")]
      .map(td => td.textContent ?? "");
    expect(titles[0]).toContain("Authenticated session from Tor exit node");
    expect(titles[titles.length - 1]).toContain("Imaging archive accessed outside working hours");
  });

  it("leads with an open critical, not merely a critical", async () => {
    render(wrap(<Threats />));
    await waitFor(() => expect(screen.getByText(/Open critical:/)).toBeInTheDocument());
    const banner = screen.getByText(/Open critical:/).closest("div")!;
    expect(banner.textContent).toContain("Authenticated session from Tor exit node");
    expect(banner.textContent).not.toContain("Imaging archive");
  });

  it("reads the organisation summary rather than counting the page", async () => {
    render(wrap(<Threats />));
    // 3 rows on the page; the summary says 3 open of 5 detected.
    await waitFor(() => expect(screen.getByText("of 5 detected")).toBeInTheDocument());
  });

  it("switches age from hours to days past two days", async () => {
    render(wrap(<Threats />));
    await waitFor(() => expect(screen.getByText("43h ago")).toBeInTheDocument());
    expect(screen.getByText("4d ago")).toBeInTheDocument();   // 86h
  });

  it("shows an empty state when nothing was detected", async () => {
    threats = [];
    render(wrap(<Threats />));
    await waitFor(() => expect(screen.getByText("No threats detected")).toBeInTheDocument());
  });
});
