import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AppStoreProvider } from "@/store/AppStore";
import Policy from "@/pages/Policy";
import Audit from "@/pages/Audit";
import AI from "@/pages/AI";

/**
 * The pages the backend does not serve stay on mock data by design.
 * These guard that the mock trim did not break any of them — `tsc` proves the
 * imports resolve, only a render proves the data is still actually there.
 */

const wrap = (node: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><AppStoreProvider>{node}</AppStoreProvider></MemoryRouter>
  </QueryClientProvider>
);

describe("pages still backed by mock data", () => {
  it("Policy renders its seeded policies and controls", () => {
    render(wrap(<Policy />));
    // Controls and approvals live behind their own tabs; the policies tab is
    // the default view, so that is what a first render must show.
    expect(screen.getByText("PHI Data Retention Policy")).toBeInTheDocument();
    expect(screen.getByText("Incident Response Playbook")).toBeInTheDocument();
  });

  it("Audit renders its seeded log", () => {
    render(wrap(<Audit />));
    expect(screen.getAllByText(/BULK_DOWNLOAD/).length).toBeGreaterThan(0);
  });

  it("AI renders its seeded decisions", () => {
    render(wrap(<AI />));
    expect(screen.getAllByText(/DiagnosticAI/).length).toBeGreaterThan(0);
  });

  it("the trimmed exports are really gone", async () => {
    const mock = await import("@/data/mock");
    expect("SEVERITY_COLORS" in mock).toBe(false);
    expect("recentAlerts" in mock).toBe(false);
    expect("risks" in mock).toBe(false);
    // Access moved to /api/access, so its mock users are gone too.
    expect("users" in mock).toBe(false);
    // ...and the ones the six pages need are not.
    // alerts stays: AppStore still backs the sidebar badge and the dashboard
    // feed, even though the Threats page itself is now API-backed.
    ["initialNotifications", "frameworks", "departmentRisks", "activitySamples",
     "alerts", "policies", "controls", "approvals", "aiDecisions", "auditLog"]
      .forEach(k => expect(k in mock).toBe(true));
  });
});
