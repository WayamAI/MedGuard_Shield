import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useApiQuery } from "@/hooks/useApiQuery";

/**
 * The reconnecting state has two entry points and they behave differently in
 * TanStack v5: a failed *heartbeat* flips status to 'error', but a failed
 * manual refetch on a query that already holds data leaves status 'success'.
 * Both must surface, or the Refresh button fails silently.
 */

let mode: "ok" | "fail" = "ok";

beforeEach(() => {
  mode = "ok";
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async () => {
    if (mode === "fail") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify({ data: [1, 2, 3] }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}>
    {children}
  </QueryClientProvider>
);

describe("useApiQuery reconnecting state", () => {
  it("fires when the heartbeat fails, keeping the last good data", async () => {
    const { result } = renderHook(
      () => useApiQuery<number[]>(["hb"], "/api/hb", undefined,
        { retry: 0, staleTime: 0, pollIntervalMs: 50, reconnectIntervalMs: 50 }),
      { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    mode = "fail";
    await waitFor(() => expect(result.current.isReconnecting).toBe(true), { timeout: 5000 });
    expect(result.current.data).toEqual([1, 2, 3]);
  }, 15_000);

  it("also fires when an explicit refresh fails, which query status alone misses", async () => {
    const { result } = renderHook(
      () => useApiQuery<number[]>(["manual"], "/api/manual", undefined,
        { retry: 0, staleTime: 0, pollIntervalMs: 60_000 }),
      { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    mode = "fail";
    await act(async () => { await result.current.refresh(); });

    // TanStack leaves status 'success', error null and failureCount 0 here, so
    // this failure is only observable through refresh().
    expect(result.current.isReconnecting).toBe(true);
    expect(result.current.data).toEqual([1, 2, 3]);
    expect(result.current.error).not.toBeNull();
  }, 15_000);

  it("clears once the backend answers again", async () => {
    const { result } = renderHook(
      () => useApiQuery<number[]>(["heal"], "/api/heal", undefined,
        { retry: 0, staleTime: 0, pollIntervalMs: 50, reconnectIntervalMs: 50 }),
      { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    mode = "fail";
    await waitFor(() => expect(result.current.isReconnecting).toBe(true), { timeout: 5000 });
    mode = "ok";
    await waitFor(() => expect(result.current.isReconnecting).toBe(false), { timeout: 5000 });
  }, 15_000);
});
