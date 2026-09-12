import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAccess, accessKey } from "@/hooks/useAccess";
import { useThreats, threatsKey } from "@/hooks/useThreats";

/**
 * These hooks are plumbing written ahead of their endpoints. The tests assert
 * only what is knowable without the contract: the right URL is called, the
 * envelope is unwrapped, and the shared failure behaviour applies. They assert
 * nothing about row fields, because that shape is not confirmed yet.
 */

let lastUrl = "";
let status = 200;
let body: unknown = { data: [] };

beforeEach(() => {
  lastUrl = ""; status = 200; body = { data: [] };
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    lastUrl = String(input);
    return new Response(JSON.stringify(status === 200 ? body : { message: "nope" }),
      { status, headers: { "content-type": "application/json" } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}>
    {children}
  </QueryClientProvider>
);

describe("hooks awaiting their endpoints", () => {
  it("useAccess calls GET /api/access and unwraps the data envelope", async () => {
    body = { data: [{ id: 1 }, { id: 2 }] };
    const { result } = renderHook(() => useAccess({ retry: 0 }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(lastUrl).toBe("http://api.test/api/access");
    expect(result.current.data).toHaveLength(2);
    expect(result.current.isError).toBe(false);
  });

  it("useThreats calls GET /api/threats and unwraps the data envelope", async () => {
    body = { data: [{ id: 9 }] };
    const { result } = renderHook(() => useThreats({ retry: 0 }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(lastUrl).toBe("http://api.test/api/threats");
    expect(result.current.data).toHaveLength(1);
  });

  it("both surface a 404 rather than resolving empty, so a missing endpoint is loud", async () => {
    status = 404;
    const access = renderHook(() => useAccess({ retry: 0 }), { wrapper });
    await waitFor(() => expect(access.result.current.isError).toBe(true));
    expect(access.result.current.error?.status).toBe(404);

    const threats = renderHook(() => useThreats({ retry: 0 }), { wrapper });
    await waitFor(() => expect(threats.result.current.isError).toBe(true));
    expect(threats.result.current.error?.status).toBe(404);
  });

  it("use distinct cache keys so one cannot serve the other's data", () => {
    expect(accessKey).not.toEqual(threatsKey);
    expect([...accessKey, ...threatsKey]).toEqual(["access", "threats"]);
  });
});
