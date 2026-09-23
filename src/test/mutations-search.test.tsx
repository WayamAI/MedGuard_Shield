import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useCreateAsset, useUpdateAsset, useRecomputeAssetRisk,
  useCreateVendor, useUpdateVendor, useRecomputeVendorRisk,
} from "@/hooks/useMutations";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";

/**
 * Writes and search.
 *
 * The mutations matter because the frontend previously had exactly one
 * (CSV import) while the API had six. The risk is not that a request fails —
 * it is that it succeeds and the rest of the app keeps showing the old
 * numbers, so these assert the method, the path, and the invalidation.
 */

type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data }), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  calls = [];
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (url.includes("/api/assets")) return jsonResponse([]);
    if (url.includes("/api/vendors")) return jsonResponse([]);
    // GET /api/risks is a list; POST .../recompute returns the single new row.
    // Returning the object for both made the search hook iterate a non-array.
    if (url.includes("/api/risks")) {
      return url.includes("/recompute")
        ? jsonResponse({ id: 1, assetId: 7, score: 42, band: "MODERATE" })
        : jsonResponse([]);
    }
    if (url.includes("/api/threats")) return jsonResponse({ summary: { open: 0 }, threats: [] });
    if (url.includes("/api/access")) return jsonResponse({ summary: { flagged: 0 }, grants: [] });
    if (url.includes("/api/dataflows")) return jsonResponse([]);
    return jsonResponse({});
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const makeWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
};

describe("write hooks hit the right endpoint", () => {
  it("useCreateAsset POSTs to /api/assets", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateAsset(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "Cardiology PACS", type: "CLOUD_STORAGE" });
    });

    const call = calls.find(c => c.method === "POST");
    expect(call?.url).toBe("http://api.test/api/assets");
    expect(call?.body).toMatchObject({ name: "Cardiology PACS", type: "CLOUD_STORAGE" });
  });

  it("useUpdateAsset PATCHes the specific asset", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateAsset(12), { wrapper });

    await act(async () => { await result.current.mutateAsync({ encrypted: true }); });

    const call = calls.find(c => c.method === "PATCH");
    expect(call?.url).toBe("http://api.test/api/assets/12");
    expect(call?.body).toEqual({ encrypted: true });
  });

  it("useCreateVendor POSTs to /api/vendors", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateVendor(), { wrapper });

    await act(async () => { await result.current.mutateAsync({ name: "Arcadia Care" }); });

    expect(calls.find(c => c.method === "POST")?.url).toBe("http://api.test/api/vendors");
  });

  it("useUpdateVendor PATCHes the specific vendor", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateVendor(3), { wrapper });

    await act(async () => { await result.current.mutateAsync({ baaStatus: "SIGNED" }); });

    expect(calls.find(c => c.method === "PATCH")?.url).toBe("http://api.test/api/vendors/3");
  });

  it("recompute posts to the asset's recompute route", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRecomputeAssetRisk(), { wrapper });

    await act(async () => { await result.current.mutateAsync(7); });

    expect(calls.find(c => c.method === "POST")?.url).toBe("http://api.test/api/risks/7/recompute");
  });

  it("recompute posts to the vendor's recompute route", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRecomputeVendorRisk(), { wrapper });

    await act(async () => { await result.current.mutateAsync(4); });

    expect(calls.find(c => c.method === "POST")?.url).toBe("http://api.test/api/vendors/4/recompute");
  });
});

describe("writes invalidate the risk graph", () => {
  /*
   * A vendor edit can move an asset's score, which moves the dashboard
   * counts. Invalidating only the list that was edited leaves every other
   * view quietly stale, which on a risk dashboard means showing a number
   * that is no longer true.
   */
  it("marks assets, vendors and risks stale after a write", async () => {
    const { client, wrapper } = makeWrapper();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateVendor(1), { wrapper });

    await act(async () => { await result.current.mutateAsync({ phiVolume: 10 }); });

    const keys = spy.mock.calls.map(c => JSON.stringify(c[0]?.queryKey));
    for (const k of ["assets", "vendors", "risks", "dataflows", "access", "threats"]) {
      expect(keys.some(key => key?.includes(k))).toBe(true);
    }
  });
});

/** Past the 180ms debounce, with room for the queries to settle. */
const settle = () => new Promise(r => setTimeout(r, 400));

describe("global search", () => {
  it("issues no requests until it is opened", async () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useGlobalSearch("epic", false), { wrapper });
    await new Promise(r => setTimeout(r, 50));
    expect(calls).toHaveLength(0);
  });

  it("stays idle below the minimum query length", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useGlobalSearch("e", true), { wrapper });
    await settle();
    expect(result.current.active).toBe(false);
    expect(result.current.flat).toEqual([]);
  });

  it("becomes active once past the debounce and the minimum length", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useGlobalSearch("epic", true), { wrapper });

    // Nothing is searched on the first render — that is the debounce working.
    expect(result.current.active).toBe(false);

    await settle();
    expect(result.current.active).toBe(true);
    expect(result.current.query).toBe("epic");
  });
});
