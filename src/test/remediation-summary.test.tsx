import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import Remediation from "@/pages/Remediation";
import type { ApiRemediationSummary } from "@/lib/apiTypes";

/**
 * GET /api/remediations/summary returns its counts keyed by status. The type
 * used to claim flat `inProgress` / `resolved` / `accepted` fields the API has
 * never returned, so the Closed card rendered the literal string "NaN" and
 * "undefined resolved · undefined accepted" on a live screen.
 *
 * The fixture below is the real payload shape, deliberately with distinct
 * numbers in every bucket so a card reading the wrong key cannot pass.
 */
const SUMMARY: ApiRemediationSummary = {
  total: 21,
  open: 12,                               // server roll-up: OPEN+IN_PROGRESS+REOPENED
  byStatus: { OPEN: 7, IN_PROGRESS: 3, RESOLVED: 6, ACCEPTED: 3, REOPENED: 2 },
  bySeverity: { CRITICAL: 4, HIGH: 5, MEDIUM: 8, LOW: 4 },
  overdue: 5,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/auth/login")) {
      return json({ data: { token: "t", expiresIn: 3600, user: { id: 1, email: "a@meridian.org", role: "ADMIN", organizationId: 1 } } });
    }
    if (url.includes("/api/auth/refresh")) return json({ error: { message: "no" } }, 401);
    if (url.includes("/api/remediations/summary")) return json({ data: SUMMARY });
    if (url.includes("/api/remediations")) {
      return json({ data: [], meta: { page: 1, pageSize: 25, total: 0, totalPages: 0 } });
    }
    return json({ data: [] });
  }));
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function SignIn({ children }: { children: ReactNode }) {
  const { login, isAuthenticated, isInitializing } = useAuth();
  useEffect(() => { if (!isInitializing) void login("a@meridian.org", "pw"); }, [login, isInitializing]);
  return <>{isAuthenticated ? children : <div>signing in</div>}</>;
}

/**
 * Resolves once a metric card has an actual value.
 *
 * A card renders its label while its query is still in flight, so asserting
 * as soon as the label appears reads an empty card and passes or fails for
 * the wrong reason.
 */
const card = async (testId: string) => {
  const el = await screen.findByTestId(testId);
  await waitFor(() => expect(el.textContent).toMatch(/\d/));
  return el;
};

const wrap = (node: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    <MemoryRouter><AuthProvider><SignIn>{node}</SignIn></AuthProvider></MemoryRouter>
  </QueryClientProvider>
);

describe("Remediation summary cards", () => {
  it("never renders NaN or undefined", async () => {
    render(wrap(<Remediation />));
    await card("metric-closed");
    expect(document.body.textContent).not.toMatch(/NaN/);
    expect(document.body.textContent).not.toMatch(/undefined/);
  });

  it("counts awaiting work as OPEN plus REOPENED", async () => {
    render(wrap(<Remediation />));
    const el = await card("metric-awaiting-work");
    expect(el.textContent).toContain("9");                 // 7 + 2
    expect(el.textContent).toContain("2 reopened");
  });

  it("does not reuse the server's `open` roll-up as a card, which would double-count", async () => {
    render(wrap(<Remediation />));
    const el = await card("metric-awaiting-work");
    // 12 is OPEN+IN_PROGRESS+REOPENED; showing it beside In progress (3)
    // would count the same three findings twice.
    expect(el.textContent).not.toContain("12");
  });

  it("reads In progress from byStatus", async () => {
    render(wrap(<Remediation />));
    const el = await card("metric-in-progress");
    expect(el.textContent).toContain("3");
  });

  it("sums Closed from RESOLVED and ACCEPTED, and keeps them named apart", async () => {
    render(wrap(<Remediation />));
    const el = await card("metric-closed");
    expect(el.textContent).toContain("9");                 // 6 + 3
    // "we fixed it" and "we decided to live with it" are not the same claim.
    expect(el.textContent).toContain("6 resolved · 3 accepted");
  });

  it("shows overdue as a flag across the open findings, not a fifth bucket", async () => {
    render(wrap(<Remediation />));
    const el = await card("metric-overdue");
    expect(el.textContent).toContain("5");
    expect(el.textContent).toContain("of the open findings");
  });
});

/**
 * `subject` is always an object of five independently nullable slots. The
 * type claimed `{ type, id, label } | null`, so the UI's null guard never
 * fired: every row printed "undefined: undefined", and the drawer's
 * cross-link — branching on a `type` field that has never existed — could
 * never render at all.
 */
describe("Remediation subject", () => {
  const finding = (subject: Record<string, unknown>) => ({
    id: 1, title: "Billing DB stores PHI unencrypted",
    description: "d", recommendation: "r",
    severity: "CRITICAL", status: "OPEN", source: "MANUAL",
    owner: { id: 1, email: "admin@meridian.org" },
    subject, dueAt: null, resolvedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z", open: true, overdue: false,
  });

  const EMPTY = { asset: null, vendor: null, threat: null, control: null, identity: null, accessGrantId: null };

  const withRows = (rows: unknown[]) => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/login")) {
        return json({ data: { token: "t", expiresIn: 3600, user: { id: 1, email: "a@meridian.org", role: "ADMIN", organizationId: 1 } } });
      }
      if (url.includes("/api/auth/refresh")) return json({ error: { message: "no" } }, 401);
      if (url.includes("/api/remediations/summary")) return json({ data: SUMMARY });
      if (url.includes("/api/remediations")) {
        return json({ data: rows, meta: { page: 1, pageSize: 25, total: rows.length, totalPages: 1 } });
      }
      return json({ data: [] });
    }));
  };

  it("never prints undefined for a finding that points at nothing", async () => {
    withRows([finding(EMPTY)]);
    render(wrap(<Remediation />));
    await screen.findByText("Billing DB stores PHI unencrypted");
    expect(document.body.textContent).not.toMatch(/undefined/);
  });

  it("falls back to the source, in words, when no entity is referenced", async () => {
    withRows([finding(EMPTY)]);
    render(wrap(<Remediation />));
    expect(await screen.findByText("Raised manually")).toBeInTheDocument();
  });

  it("names the entity when there is one", async () => {
    withRows([finding({ ...EMPTY, asset: { id: 6, name: "Billing Engine DB" } })]);
    render(wrap(<Remediation />));
    expect(await screen.findByText("Asset: Billing Engine DB")).toBeInTheDocument();
  });

  it("names every entity when a finding points at several", async () => {
    withRows([finding({
      ...EMPTY,
      asset: { id: 6, name: "Billing Engine DB" },
      vendor: { id: 1, name: "Northwind Claims Processing" },
    })]);
    render(wrap(<Remediation />));
    // A finding can implicate an asset and a vendor at once; showing only
    // the first would hide half of what it is about.
    expect(await screen.findByText(
      "Asset: Billing Engine DB · Vendor: Northwind Claims Processing",
    )).toBeInTheDocument();
  });
});
