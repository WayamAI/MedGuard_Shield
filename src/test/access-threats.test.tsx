import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import Access from "@/pages/Access";
import Threats from "@/pages/Threats";
import type { ApiAccessResponse, ApiThreatsResponse } from "@/lib/apiTypes";

/** Mirrors the real seeded payloads, including the findings worth demoing. */
const ACCESS: ApiAccessResponse = {
  summary: { total: 9, flagged: 6, stale: 1, neverUsed: 1, withoutMfa: 3,
             inactiveIdentities: 1, excessiveLevel: 6, staleAfterDays: 90 },
  grants: [
    { id: 6, identityId: 4, identityName: "Robert Chen (contractor)",
      identityEmail: "r.chen@contractor.example", kind: "USER", department: "Radiology",
      active: false, mfaEnabled: false, assetId: 5, assetName: "Imaging Archive (S3)",
      assetType: "CLOUD_STORAGE", level: "ADMIN", grantedAt: "2025-04-30T00:00:00Z",
      lastUsedAt: "2026-01-12T00:00:00Z", daysSinceUse: 244, daysSinceGrant: 501,
      flags: ["STALE", "INACTIVE_IDENTITY", "NO_MFA", "EXCESSIVE_LEVEL"], riskFlagCount: 4 },
    { id: 9, identityId: 6, identityName: "svc-legacy-billing-sync", identityEmail: null,
      kind: "SERVICE_ACCOUNT", department: "Billing", active: true, mfaEnabled: false,
      assetId: 6, assetName: "Billing Engine DB", assetType: "DATABASE", level: "WRITE",
      grantedAt: "2024-03-16T00:00:00Z", lastUsedAt: null, daysSinceUse: null,
      daysSinceGrant: 911, flags: ["NEVER_USED", "EXCESSIVE_LEVEL"], riskFlagCount: 2 },
    { id: 1, identityId: 1, identityName: "Dr. Aisha Patel", identityEmail: "a.patel@meridian.org",
      kind: "USER", department: "ICU", active: true, mfaEnabled: true, assetId: 3,
      assetName: "Epic EHR Core", assetType: "EHR", level: "READ",
      grantedAt: "2026-06-01T00:00:00Z", lastUsedAt: "2026-09-12T00:00:00Z",
      daysSinceUse: 1, daysSinceGrant: 103, flags: [], riskFlagCount: 0 },
  ],
};

const THREATS: ApiThreatsResponse = {
  summary: { total: 5, open: 3, bySeverity: { CRITICAL: 2, HIGH: 1, MEDIUM: 1, LOW: 1 },
             byStatus: { OPEN: 2, INVESTIGATING: 1, RESOLVED: 1, FALSE_POSITIVE: 1 }, openCritical: 2 },
  threats: [
    { id: 4, severity: "MEDIUM", status: "RESOLVED", title: "Imaging archive accessed outside working hours",
      description: "Confirmed as on-call review.", assetId: 5, assetName: "Imaging Archive (S3)",
      assetType: "CLOUD_STORAGE", detectedAt: "2026-09-10T03:00:00Z",
      resolvedAt: "2026-09-11T01:00:00Z", hoursSinceDetection: 86, open: false },
    { id: 2, severity: "CRITICAL", status: "OPEN", title: "Authenticated session from Tor exit node",
      description: "Claims gateway accepted credentials from a known Tor exit node.",
      assetId: 8, assetName: "Insurance Claims Gateway", assetType: "API",
      detectedAt: "2026-09-11T22:00:00Z", resolvedAt: null, hoursSinceDetection: 43, open: true },
    { id: 3, severity: "HIGH", status: "OPEN", title: "Privilege escalation attempt on EHR core",
      description: "Three admin-scoped calls, all rejected.", assetId: 3, assetName: "Epic EHR Core",
      assetType: "EHR", detectedAt: "2026-09-11T05:00:00Z", resolvedAt: null,
      hoursSinceDetection: 60, open: true },
  ],
};

let body: unknown;
let status = 200;
beforeEach(() => {
  status = 200;
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify(status === 200 ? { data: body } : { message: "x" }),
      { status, headers: { "content-type": "application/json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const wrap = (node: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    <MemoryRouter>{node}</MemoryRouter>
  </QueryClientProvider>
);

describe("Access page", () => {
  beforeEach(() => { body = ACCESS; });

  it("orders grants by how much is wrong, not alphabetically", async () => {
    render(wrap(<Access />));
    await waitFor(() => expect(screen.getByText("Robert Chen (contractor)")).toBeInTheDocument());
    const names = [...document.querySelectorAll("tbody tr td:first-child")].map(td => td.textContent?.trim());
    expect(names).toEqual(["Robert Chen (contractor)", "svc-legacy-billing-sync", "Dr. Aisha Patel"]);
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

  it("uses the server's summary rather than recomputing it", async () => {
    render(wrap(<Access />));
    // Only 3 grants are in this fixture, but the server says 9 total and 6
    // flagged. Recomputing client-side would say "of 3 grants" and 2 flagged,
    // so these strings are the proof the API summary is what renders.
    // Wait on a data-dependent string: the card label renders immediately,
    // long before the query resolves.
    await waitFor(() => expect(screen.getByText("of 9 grants")).toBeInTheDocument());
    expect(screen.getByText("unused past 90 days")).toBeInTheDocument();
    expect(document.querySelectorAll("tbody tr")).toHaveLength(3);
  });

  it("renders a never-used grant as such, not as a blank cell", async () => {
    render(wrap(<Access />));
    await waitFor(() => expect(screen.getAllByText("Never used").length).toBeGreaterThan(0));
  });

  it("shows an empty state when there are no grants", async () => {
    body = { ...ACCESS, grants: [] };
    render(wrap(<Access />));
    await waitFor(() => expect(screen.getByText("No access grants recorded")).toBeInTheDocument());
  });
});

describe("Threats page", () => {
  beforeEach(() => { body = THREATS; });

  it("puts open threats above resolved ones regardless of detection time", async () => {
    render(wrap(<Threats />));
    await waitFor(() => expect(screen.getByText("Authenticated session from Tor exit node")).toBeInTheDocument());
    const titles = [...document.querySelectorAll("tbody tr td:nth-child(2)")].map(td => td.textContent);
    expect(titles[0]).toBe("Authenticated session from Tor exit node");   // open CRITICAL
    expect(titles[titles.length - 1]).toBe("Imaging archive accessed outside working hours"); // resolved
  });

  it("leads with an open critical, not merely a critical", async () => {
    render(wrap(<Threats />));
    await waitFor(() => expect(screen.getByText(/Open critical:/)).toBeInTheDocument());
    const banner = screen.getByText(/Open critical:/).closest("div")!;
    expect(banner.textContent).toContain("Authenticated session from Tor exit node");
    expect(banner.textContent).not.toContain("Imaging archive");
  });

  it("switches age from hours to days past two days", async () => {
    render(wrap(<Threats />));
    await waitFor(() => expect(screen.getByText("43h ago")).toBeInTheDocument());
    expect(screen.getByText("4d ago")).toBeInTheDocument();   // 86h
  });

  it("shows an empty state when nothing was detected", async () => {
    body = { ...THREATS, threats: [] };
    render(wrap(<Threats />));
    await waitFor(() => expect(screen.getByText("No threats detected")).toBeInTheDocument());
  });
});
