import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import Layout from "@/components/Layout";

/**
 * The Threat Detection badge is a count a viewer reads as current. It used to
 * be the literal "2" written into NAV, which would have kept saying 2 while
 * the API reported anything at all — it only ever looked right by accident.
 */

const SUMMARY = {
  total: 5, open: 3, openCritical: 2,
  bySeverity: { CRITICAL: 2, HIGH: 1, MEDIUM: 1, LOW: 1 },
  byStatus: { OPEN: 2, INVESTIGATING: 1, RESOLVED: 1, FALSE_POSITIVE: 1 },
};

let threatsBody: unknown = { summary: SUMMARY, threats: [] };
let threatsOk = true;

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/threats")) {
      if (!threatsOk) throw new TypeError("Failed to fetch");
      return new Response(JSON.stringify({ data: threatsBody }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ data: [] }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }));
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const wrap = (node: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
          {node}
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

describe("Threat Detection nav badge", () => {
  it("shows the open-threat count the API reported, not a baked-in number", async () => {
    threatsOk = true;
    threatsBody = { summary: SUMMARY, threats: [] };
    render(wrap(<Layout><div /></Layout>));

    const link = await screen.findByRole("link", { name: /Threats/ });
    // 3 open (2 OPEN + 1 INVESTIGATING) — never the old literal 2.
    await waitFor(() => expect(link).toHaveTextContent("3"));
    expect(link).not.toHaveTextContent("2");
  });

  it("follows the API when the count changes", async () => {
    threatsOk = true;
    threatsBody = { summary: { ...SUMMARY, open: 7 }, threats: [] };
    render(wrap(<Layout><div /></Layout>));

    const link = await screen.findByRole("link", { name: /Threats/ });
    await waitFor(() => expect(link).toHaveTextContent("7"));
  });

  it("shows no count at all when the backend cannot be reached", async () => {
    threatsOk = false;
    render(wrap(<Layout><div /></Layout>));

    const link = await screen.findByRole("link", { name: /Threats/ });
    // A stale or invented number is worse than none.
    await waitFor(() => expect(link).toHaveTextContent(/^\s*Threats\s*$/));
  });
});

describe("page title in the header", () => {
  /*
   * The header title and breadcrumb both read from PAGE_TITLES. A route
   * missing from that map silently falls back to "Drishti", which is what
   * /import did: the one page whose whole job is to be self-explanatory was
   * the one page that did not say what it was.
   */

  const ROUTES: Array<[string, string]> = [
    ["/", "Governance Overview"],
    ["/assets", "Asset Inventory"],
    ["/phi-flow", "PHI Data Flow Map"],
    ["/access", "Access & Identity Review"],
    ["/threats", "Threat & Anomaly Detection"],
    ["/vendors", "Vendor Risk"],
    ["/risks", "Risk Register"],
    ["/import", "Data Import"],
  ];

  it.each(ROUTES)("%s is titled %s", async (path, title) => {
    threatsOk = true;
    threatsBody = { summary: SUMMARY, threats: [] };
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <MemoryRouter initialEntries={[path]}>
          <ThemeProvider>
            <AuthProvider>
              <Layout><div /></Layout>
            </AuthProvider>
          </ThemeProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
  });

  it("never falls back to the bare product name on a routed page", async () => {
    threatsOk = true;
    threatsBody = { summary: SUMMARY, threats: [] };
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <MemoryRouter initialEntries={["/import"]}>
          <ThemeProvider>
            <AuthProvider>
              <Layout><div /></Layout>
            </AuthProvider>
          </ThemeProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const h1 = await screen.findByRole("heading", { level: 1 });
    expect(h1).not.toHaveTextContent(/^Drishti$/);
  });
});
