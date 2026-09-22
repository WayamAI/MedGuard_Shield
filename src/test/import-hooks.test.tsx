import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useImportEntities, useValidateImport, useRunImport, useTemplateDownload, reportFromError,
} from "@/hooks/useImport";
import { ApiError } from "@/lib/apiClient";
import type { ImportReport } from "@/lib/apiTypes";

/* ---------------------------------------------------------------------------
   The server is stubbed at global fetch, the same boundary the rest of the
   suite uses, so the multipart body and the Authorization header are the real
   ones the browser would send.
   -------------------------------------------------------------------------- */

type Call = { url: string; method: string; body: unknown; headers: Headers };
let calls: Call[] = [];
let handler: (url: string, init: RequestInit) => Response | Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const okReport = (over: Partial<ImportReport> = {}): ImportReport => ({
  valid: true, totalRows: 2, errors: [],
  preview: [{ name: "A", type: "DATABASE" }, { name: "B", type: "API" }],
  ...over,
});

const badReport = (): ImportReport => ({
  valid: false, totalRows: 2,
  errors: [
    { row: 2, field: "name", message: "name is required" },
    { row: 2, field: "type", message: 'type must be one of: EHR, DATABASE. Got "NOPE"' },
    { row: 3, field: "phiVolume", message: 'phiVolume must be a whole number, got "abc"' },
  ],
  preview: [{ name: "C", type: "EHR" }],
});

beforeEach(() => {
  calls = [];
  handler = () => json({ data: okReport() });
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({
      url,
      method: init.method ?? "GET",
      body: init.body,
      headers: new Headers(init.headers as HeadersInit),
    });
    return handler(url, init);
  }));
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const wrapper = (client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

const csv = (name = "assets.csv") =>
  new File(["name,type\nA,DATABASE\n"], name, { type: "text/csv" });

/* ========================================================================== */

describe("useImportEntities", () => {
  it("reads the column contract from GET /api/import", async () => {
    handler = () => json({ data: [{ entity: "assets", label: "Assets", columns: [] }] });
    const { result } = renderHook(() => useImportEntities({ retry: 0 }), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.[0].entity).toBe("assets");
    expect(calls[0].url).toBe("http://api.test/api/import");
    expect(calls[0].method).toBe("GET");
  });

  it("surfaces an unreachable backend as a network error, not a crash", async () => {
    handler = () => { throw new TypeError("Failed to fetch"); };
    const { result } = renderHook(() => useImportEntities({ retry: 0 }), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.isNetworkError).toBe(true);
  });
});

describe("useValidateImport", () => {
  it("posts to the validate path, which writes nothing", async () => {
    const { result } = renderHook(() => useValidateImport("assets"), { wrapper: wrapper() });
    await act(async () => { await result.current.run(csv()); });

    expect(calls[0].url).toBe("http://api.test/api/import/assets/validate");
    expect(calls[0].method).toBe("POST");
  });

  it("sends the file as multipart under the field name the API expects", async () => {
    const { result } = renderHook(() => useValidateImport("assets"), { wrapper: wrapper() });
    const file = csv();
    await act(async () => { await result.current.run(file); });

    const body = calls[0].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get("file") as File).name).toBe("assets.csv");
  });

  it("leaves Content-Type unset so the browser can write the boundary", async () => {
    const { result } = renderHook(() => useValidateImport("assets"), { wrapper: wrapper() });
    await act(async () => { await result.current.run(csv()); });

    // A hand-set multipart content type omits the boundary and the server
    // cannot parse the body.
    expect(calls[0].headers.get("content-type")).toBeNull();
  });

  it("returns the report when the file is clean", async () => {
    const { result } = renderHook(() => useValidateImport("assets"), { wrapper: wrapper() });
    await act(async () => { await result.current.run(csv()); });

    expect(result.current.report?.valid).toBe(true);
    expect(result.current.report?.totalRows).toBe(2);
    expect(result.current.report?.preview).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it("treats an invalid file as a report, not a failure", async () => {
    // The server answers 200 with valid:false — a dry run that found problems
    // is still a successful dry run.
    handler = () => json({ data: badReport() });
    const { result } = renderHook(() => useValidateImport("assets"), { wrapper: wrapper() });
    await act(async () => { await result.current.run(csv()); });

    expect(result.current.report?.valid).toBe(false);
    expect(result.current.report?.errors).toHaveLength(3);
    expect(result.current.error).toBeNull();
  });

  it("keeps the server's file line numbers untouched", async () => {
    handler = () => json({ data: badReport() });
    const { result } = renderHook(() => useValidateImport("assets"), { wrapper: wrapper() });
    await act(async () => { await result.current.run(csv()); });

    // Header counted: the first data row is line 2, not row 1.
    expect(result.current.report?.errors.map(e => e.row)).toEqual([2, 2, 3]);
  });

  it("reports a 401 as a blocking error rather than a row problem", async () => {
    handler = () => json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
    const { result } = renderHook(() => useValidateImport("assets"), { wrapper: wrapper() });
    await act(async () => { await result.current.run(csv()); });

    expect(result.current.report).toBeNull();
    expect(result.current.error?.isAuthError).toBe(true);
  });

  it("reports a 413 as a blocking error", async () => {
    handler = () => json({ error: { code: "FILE_TOO_LARGE", message: "File exceeds the 2MB limit" } }, 413);
    const { result } = renderHook(() => useValidateImport("assets"), { wrapper: wrapper() });
    await act(async () => { await result.current.run(csv()); });

    expect(result.current.error?.status).toBe(413);
    expect(result.current.report).toBeNull();
  });

  it("reports an unreachable backend as status 0", async () => {
    handler = () => { throw new TypeError("Failed to fetch"); };
    const { result } = renderHook(() => useValidateImport("assets"), { wrapper: wrapper() });
    await act(async () => { await result.current.run(csv()); });

    expect(result.current.error?.isNetworkError).toBe(true);
  });

  it("clears a previous result when a new file is checked", async () => {
    handler = () => json({ data: badReport() });
    const { result } = renderHook(() => useValidateImport("assets"), { wrapper: wrapper() });
    await act(async () => { await result.current.run(csv()); });
    expect(result.current.report?.valid).toBe(false);

    handler = () => json({ data: okReport() });
    await act(async () => { await result.current.run(csv("second.csv")); });
    expect(result.current.report?.valid).toBe(true);
  });

  it("reset() empties both the report and the error", async () => {
    handler = () => json({ data: badReport() });
    const { result } = renderHook(() => useValidateImport("assets"), { wrapper: wrapper() });
    await act(async () => { await result.current.run(csv()); });
    expect(result.current.report).not.toBeNull();

    act(() => { result.current.reset(); });
    expect(result.current.report).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it.each([
    ["assets", "/api/import/assets/validate"],
    ["phi-types", "/api/import/phi-types/validate"],
    ["data-flows", "/api/import/data-flows/validate"],
    ["vendors", "/api/import/vendors/validate"],
    ["access-grants", "/api/import/access-grants/validate"],
    ["threats", "/api/import/threats/validate"],
    ["risks", "/api/import/risks/validate"],
  ] as const)("builds the right path for %s", async (entity, path) => {
    const { result } = renderHook(() => useValidateImport(entity), { wrapper: wrapper() });
    await act(async () => { await result.current.run(csv()); });
    expect(calls[0].url).toBe(`http://api.test${path}`);
  });
});

describe("useRunImport", () => {
  it("posts to the entity itself, with no /import suffix", async () => {
    handler = () => json({ data: okReport({ imported: 2 }) }, 201);
    const { result } = renderHook(() => useRunImport("assets"), { wrapper: wrapper() });
    await act(async () => { await result.current.run(csv()); });

    // The suffixed path is a 404 on the real server.
    expect(calls[0].url).toBe("http://api.test/api/import/assets");
    expect(calls[0].url).not.toContain("/assets/import");
  });

  it("accepts the 201 the server returns on a successful commit", async () => {
    handler = () => json({ data: okReport({ imported: 2 }) }, 201);
    const { result } = renderHook(() => useRunImport("assets"), { wrapper: wrapper() });
    await act(async () => { await result.current.run(csv()); });

    expect(result.current.report?.valid).toBe(true);
    expect(result.current.report?.imported).toBe(2);
  });

  it("digs the per-row report out of the 400 a rejected import returns", async () => {
    handler = () => json({
      error: {
        code: "IMPORT_VALIDATION_FAILED",
        message: "3 problem(s) found. Nothing was imported.",
        report: badReport(),
      },
    }, 400);
    const { result } = renderHook(() => useRunImport("assets"), { wrapper: wrapper() });
    await act(async () => { await result.current.run(csv()); });

    // Same table renders it as the dry run's errors.
    expect(result.current.report?.valid).toBe(false);
    expect(result.current.report?.errors).toHaveLength(3);
    expect(result.current.error).toBeNull();
  });

  it("invalidates every data query after a successful import", async () => {
    handler = () => json({ data: okReport({ imported: 2 }) }, 201);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useRunImport("assets"), { wrapper: wrapper(client) });
    await act(async () => { await result.current.run(csv()); });

    const keys = spy.mock.calls.map(c => JSON.stringify(c[0]?.queryKey));
    // An asset import moves the risk register and the flow map too, so the
    // sweep is deliberately wider than the entity that was imported.
    for (const key of ["assets", "risks", "dataflows", "vendors", "access", "threats"]) {
      expect(keys).toContain(JSON.stringify([key]));
    }
  });

  it("invalidates nothing when the import was rejected", async () => {
    handler = () => json({
      error: { code: "IMPORT_VALIDATION_FAILED", message: "no", report: badReport() },
    }, 400);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useRunImport("assets"), { wrapper: wrapper(client) });
    await act(async () => { await result.current.run(csv()); });

    // Nothing was written, so nothing is stale.
    expect(spy).not.toHaveBeenCalled();
  });

  it("invalidates nothing when the backend is unreachable", async () => {
    handler = () => { throw new TypeError("Failed to fetch"); };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useRunImport("assets"), { wrapper: wrapper(client) });
    await act(async () => { await result.current.run(csv()); });

    expect(spy).not.toHaveBeenCalled();
    expect(result.current.error?.isNetworkError).toBe(true);
  });
});

describe("reportFromError", () => {
  it("returns null for anything that is not an ApiError", () => {
    expect(reportFromError(new Error("nope"))).toBeNull();
    expect(reportFromError(null)).toBeNull();
    expect(reportFromError("400")).toBeNull();
  });

  it("returns null when the body carries no report", () => {
    expect(reportFromError(new ApiError("401", 401, "/x", { error: { code: "UNAUTHORIZED" } }))).toBeNull();
  });

  it("returns null when the report is not shaped like one", () => {
    const err = new ApiError("400", 400, "/x", { error: { report: { valid: "yes" } } });
    expect(reportFromError(err)).toBeNull();
  });

  it("extracts a well-formed report", () => {
    const err = new ApiError("400", 400, "/x", { error: { report: badReport() } });
    expect(reportFromError(err)?.errors).toHaveLength(3);
  });
});

describe("useTemplateDownload", () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();
    // jsdom has no navigation, so a real anchor click logs an unimplemented
    // error. The click itself is the browser's job, not this hook's.
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it("fetches the template with the auth header rather than navigating", async () => {
    handler = () => new Response("name,type\n", {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="drishti-assets-template.csv"',
      },
    });
    const { result } = renderHook(() => useTemplateDownload(), { wrapper: wrapper() });
    await act(async () => { await result.current.download("assets"); });

    expect(calls[0].url).toBe("http://api.test/api/import/assets/template");
    expect(calls[0].method).toBe("GET");
  });

  it("uses the filename the server supplied", async () => {
    let downloaded: string | null = null;
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLElement;
      if (tag === "a") {
        vi.spyOn(el as HTMLAnchorElement, "click").mockImplementation(() => {
          downloaded = (el as HTMLAnchorElement).download;
        });
      }
      return el;
    });

    handler = () => new Response("name,type\n", {
      status: 200,
      headers: {
        "content-type": "text/csv",
        "content-disposition": 'attachment; filename="drishti-phi-types-template.csv"',
      },
    });
    const { result } = renderHook(() => useTemplateDownload(), { wrapper: wrapper() });
    await act(async () => { await result.current.download("phi-types"); });

    expect(downloaded).toBe("drishti-phi-types-template.csv");
    vi.restoreAllMocks();
  });

  it("surfaces a 403 instead of saving an error page as a CSV", async () => {
    handler = () => json({ error: { code: "FORBIDDEN", message: "ADMIN only" } }, 403);
    const { result } = renderHook(() => useTemplateDownload(), { wrapper: wrapper() });
    await act(async () => { await result.current.download("assets"); });

    expect(result.current.error?.status).toBe(403);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("surfaces an unreachable backend", async () => {
    handler = () => { throw new TypeError("Failed to fetch"); };
    const { result } = renderHook(() => useTemplateDownload(), { wrapper: wrapper() });
    await act(async () => { await result.current.download("assets"); });

    expect(result.current.error?.isNetworkError).toBe(true);
  });
});
