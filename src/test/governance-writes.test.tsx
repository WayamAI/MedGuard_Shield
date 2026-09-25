import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import Controls from "@/pages/Controls";
import Policies from "@/pages/Policies";
import type {
  ApiControl, ApiControlDetail, ApiPolicy, ApiPolicyDetail,
} from "@/lib/apiTypes";

/**
 * Controls and Policies were read-only views of a collection the UI gave no
 * way to fill, while the API had create, patch and archive for both. These
 * cover the write paths, and in particular the field-level role split the
 * controls route enforces.
 */

let role = "ADMIN";
const calls: Array<{ url: string; method: string; body: unknown }> = [];

const control = (over: Partial<ApiControl> = {}): ApiControl => ({
  id: 1, name: "Encryption at rest", description: "AES-256 on PHI stores.",
  category: "ENCRYPTION", status: "PARTIAL", effectiveness: "PARTIALLY_EFFECTIVE",
  owner: "Security Engineering", frameworkRef: "HIPAA 164.312(a)(2)(iv)",
  lastReviewedAt: null, archivedAt: null, createdAt: "2026-09-01T00:00:00.000Z",
  appliedAssetCount: 3, policyCount: 1, openRemediations: 0, ...over,
});

const policy = (over: Partial<ApiPolicy> = {}): ApiPolicy => ({
  id: 1, name: "PHI Access Control Policy", description: "Least privilege, reviewed quarterly.",
  status: "DRAFT", owner: "Privacy Office", evidenceRef: "wiki/privacy/access",
  reviewDueAt: null, reviewOverdue: false, archivedAt: null,
  createdAt: "2026-09-01T00:00:00.000Z", controlCount: 2, ...over,
});

/**
 * The detail endpoints return a DIFFERENT shape from their list rows: the
 * rows themselves, and none of the aggregate counts. Typing the drawers as
 * the list shape printed "undefined assets" on screen, so the fixtures below
 * deliberately mirror the real detail payload rather than reusing the row.
 */
const controlDetail = (over: Partial<ApiControlDetail> = {}): ApiControlDetail => ({
  id: 1, name: "Encryption at rest", description: "AES-256 on PHI stores.",
  category: "ENCRYPTION", status: "PARTIAL", effectiveness: "PARTIALLY_EFFECTIVE",
  owner: "Security Engineering", frameworkRef: "HIPAA 164.312(a)(2)(iv)",
  lastReviewedAt: null, createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z", archivedAt: null,
  assets: [{ id: 6, name: "Billing Engine DB", type: "DATABASE", phiVolume: 87100, linkedAt: "2026-09-01T00:00:00.000Z" }],
  policies: [{ id: 1, name: "PHI Access Control Policy", status: "DRAFT" }],
  remediations: [],
  phiCovered: 87100,
  ...over,
});

const policyDetail = (over: Partial<ApiPolicyDetail> = {}): ApiPolicyDetail => ({
  id: 1, name: "PHI Access Control Policy", description: "Least privilege, reviewed quarterly.",
  status: "DRAFT", owner: "Privacy Office", evidenceRef: "wiki/privacy/access",
  reviewDueAt: null, reviewOverdue: false, createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z", archivedAt: null,
  controls: [{ id: 1, name: "Encryption at rest", category: "ENCRYPTION", status: "PARTIAL", effectiveness: "PARTIALLY_EFFECTIVE" }],
  ...over,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const paged = (rows: unknown[]) =>
  json({ data: rows, meta: { page: 1, pageSize: 25, total: rows.length, totalPages: 1 } });

beforeEach(() => {
  role = "ADMIN";
  calls.length = 0;
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (method !== "GET") calls.push({ url, method, body });

    if (url.includes("/api/auth/login")) {
      return json({ data: { token: "tok", expiresIn: 3600, user: { id: 1, email: "a@meridian.org", role, organizationId: 1 } } });
    }
    if (url.includes("/api/auth/refresh")) return json({ error: { message: "no session" } }, 401);
    if (url.match(/\/api\/controls\/\d+$/)) {
      return json({ data: controlDetail(method === "PATCH" ? body as Partial<ApiControlDetail> : {}) });
    }
    if (url.includes("/api/controls")) {
      return method === "POST" ? json({ data: control() }, 201) : paged([control()]);
    }
    if (url.match(/\/api\/policies\/\d+$/)) {
      return json({ data: policyDetail(method === "PATCH" ? body as Partial<ApiPolicyDetail> : {}) });
    }
    if (url.includes("/api/policies")) {
      return method === "POST" ? json({ data: policy() }, 201) : paged([policy()]);
    }
    return json({ data: [] });
  }));
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

/**
 * Signs in through the provider, and only once the boot-time session probe
 * has settled.
 *
 * Racing it is not an option: the probe 401s here (there is no refresh
 * cookie in jsdom) and its failure path clears the session, so a login that
 * lands first is wiped by a probe that finishes second.
 */
function SignIn({ children }: { children: ReactNode }) {
  const { login, isAuthenticated, isInitializing } = useAuth();
  useEffect(() => {
    if (!isInitializing) void login("a@meridian.org", "pw");
  }, [login, isInitializing]);
  return <>{isAuthenticated ? children : <div>signing in</div>}</>;
}

const wrap = (node: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    <MemoryRouter>
      <AuthProvider><SignIn>{node}</SignIn></AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

describe("Controls — writes", () => {
  it("offers New control to an admin", async () => {
    render(wrap(<Controls />));
    expect(await screen.findByRole("button", { name: /new control/i })).toBeInTheDocument();
  });

  it("withholds New control from an analyst, who may assess but not create", async () => {
    role = "ANALYST";
    render(wrap(<Controls />));
    await screen.findByText("Encryption at rest");
    expect(screen.queryByRole("button", { name: /new control/i })).not.toBeInTheDocument();
  });

  it("withholds it from a viewer too", async () => {
    role = "VIEWER";
    render(wrap(<Controls />));
    await screen.findByText("Encryption at rest");
    expect(screen.queryByRole("button", { name: /new control/i })).not.toBeInTheDocument();
  });

  it("sends ONLY the three analyst-permitted fields when recording an assessment", async () => {
    role = "ANALYST";
    render(wrap(<Controls />));
    fireEvent.click(await screen.findByText("Encryption at rest"));

    const select = await screen.findByDisplayValue("Partial");
    fireEvent.change(select, { target: { value: "IMPLEMENTED" } });
    fireEvent.click(screen.getByRole("button", { name: /record assessment/i }));

    await waitFor(() => {
      expect(calls.some(c => c.method === "PATCH")).toBe(true);
    });
    const patch = calls.find(c => c.method === "PATCH")!;
    // Anything outside this set pushes the request over the ADMIN line and
    // the server answers 403 naming the offending field.
    expect(Object.keys(patch.body as object).sort())
      .toEqual(["effectiveness", "lastReviewedAt", "status"]);
    expect((patch.body as { status: string }).status).toBe("IMPLEMENTED");
  });

  it("keeps Record assessment inert until something actually changes", async () => {
    render(wrap(<Controls />));
    fireEvent.click(await screen.findByText("Encryption at rest"));
    expect(await screen.findByRole("button", { name: /record assessment/i })).toBeDisabled();
  });

  it("tells a viewer why there is nothing to record", async () => {
    role = "VIEWER";
    render(wrap(<Controls />));
    fireEvent.click(await screen.findByText("Encryption at rest"));
    expect(await screen.findByText(/cannot|not record an assessment/i)).toBeInTheDocument();
  });
});

describe("Policies — writes", () => {
  it("offers New policy to an admin only", async () => {
    render(wrap(<Policies />));
    expect(await screen.findByRole("button", { name: /new policy/i })).toBeInTheDocument();
  });

  it("withholds New policy from an analyst — every policy field is configuration", async () => {
    role = "ANALYST";
    render(wrap(<Policies />));
    await screen.findByText("PHI Access Control Policy");
    expect(screen.queryByRole("button", { name: /new policy/i })).not.toBeInTheDocument();
  });

  it("patches only the status when moving a policy through its lifecycle", async () => {
    render(wrap(<Policies />));
    fireEvent.click(await screen.findByText("PHI Access Control Policy"));

    const select = await screen.findByDisplayValue("Draft");
    fireEvent.change(select, { target: { value: "ACTIVE" } });
    fireEvent.click(screen.getByRole("button", { name: /save status/i }));

    await waitFor(() => expect(calls.some(c => c.method === "PATCH")).toBe(true));
    expect(calls.find(c => c.method === "PATCH")!.body).toEqual({ status: "ACTIVE" });
  });

  it("renders an evidence reference as text, never as a link", async () => {
    render(wrap(<Policies />));
    fireEvent.click(await screen.findByText("PHI Access Control Policy"));
    const ref = await screen.findByText("wiki/privacy/access");
    // Unvalidated customer input must not become a live anchor in a
    // compliance tool.
    expect(ref.closest("a")).toBeNull();
  });
});

describe("detail drawers render the detail payload, not the list row", () => {
  it("never prints the word undefined in the control drawer", async () => {
    render(wrap(<Controls />));
    fireEvent.click(await screen.findByText("Encryption at rest"));
    await screen.findByText("Security Engineering");
    // The counts the list row carries do not exist on the detail payload.
    expect(document.body.textContent).not.toMatch(/undefined/);
  });

  it("shows the assets a control covers, by name", async () => {
    render(wrap(<Controls />));
    fireEvent.click(await screen.findByText("Encryption at rest"));
    expect(await screen.findByText("Billing Engine DB")).toBeInTheDocument();
    expect(screen.getByText(/Applied to 1 asset$/)).toBeInTheDocument();
    expect(screen.getByText("87,100 records")).toBeInTheDocument();
  });

  it("never prints the word undefined in the policy drawer", async () => {
    render(wrap(<Policies />));
    fireEvent.click(await screen.findByText("PHI Access Control Policy"));
    await screen.findByText("Privacy Office");
    expect(document.body.textContent).not.toMatch(/undefined/);
  });

  it("lists the controls a policy cites, by name", async () => {
    render(wrap(<Policies />));
    fireEvent.click(await screen.findByText("PHI Access Control Policy"));
    expect(await screen.findByText("Encryption at rest")).toBeInTheDocument();
    expect(screen.getByText("Cites 1 control")).toBeInTheDocument();
  });
});

describe("empty states wear their own mark", () => {
  it("shows the controls mark, not the inventory cylinder, on an empty Controls page", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/login")) {
        return json({ data: { token: "t", expiresIn: 3600, user: { id: 1, email: "a@meridian.org", role: "ADMIN", organizationId: 1 } } });
      }
      if (url.includes("/api/auth/refresh")) return json({ error: { message: "no" } }, 401);
      return paged([]);
    }));

    render(wrap(<Controls />));
    // DataState hardcoded the database glyph for every empty view, so a page
    // built around its own domain mark lost it exactly when it mattered.
    //
    // The mark is now the 3D render rather than the line-art glyph, so that is
    // what this asserts. The guarantee is unchanged and still the point of the
    // test: the empty Controls page wears the controls mark, and the inventory
    // cylinder does not appear on it. `emptyIcon="locked"` remains declared at
    // the call site as the fallback if the asset fails to load.
    await screen.findByText("No controls recorded");
    expect(document.querySelector('[data-icon-3d="emptyControls"]')).not.toBeNull();
    expect(document.querySelector('[data-icon="database"]')).toBeNull();
    expect(document.querySelector('[data-icon-3d="kpiAssets"]')).toBeNull();
  });
});
