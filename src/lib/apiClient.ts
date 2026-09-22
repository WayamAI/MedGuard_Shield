/**
 * Base fetch wrapper for the Drishti backend.
 *
 * Auth stays behind an indirection on purpose: nothing here imports the auth
 * layer, so this module has no cycle with it and is trivial to test. The
 * provider calls `setAuthTokenGetter` once and every request picks up the
 * token from then on — no call site changes. Today that caller is
 * src/hooks/use-auth.tsx, against the backend's own /api/auth/login.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: unknown;

  constructor(message: string, status: number, url: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
    this.body = body;
  }

  /** 401/403 — the session is gone or insufficient, not a server fault. */
  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }

  /** No HTTP response at all: backend down, DNS failure, CORS, offline. */
  get isNetworkError() {
    return this.status === 0;
  }
}

type TokenGetter = () => string | null | undefined | Promise<string | null | undefined>;

let authTokenGetter: TokenGetter | null = null;

/**
 * Register the session-token source. AuthProvider (src/hooks/use-auth.tsx)
 * calls this with a reader for its in-memory token ref, and passes null on
 * unmount so a torn-down provider cannot keep authorizing requests.
 *
 * The getter may return a promise, so a provider that has to mint or refresh
 * a token asynchronously fits without changing anything here.
 */
export function setAuthTokenGetter(getter: TokenGetter | null) {
  authTokenGetter = getter;
}

/** Base URL without a trailing slash, so path joining stays predictable. */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (!raw) {
    throw new ApiError(
      "VITE_API_BASE_URL is not set. Copy .env.example to .env and point it at the backend.",
      0,
      "",
      null,
    );
  }
  return raw.replace(/\/+$/, "");
}

async function parseBody(res: Response): Promise<unknown> {
  const type = res.headers.get("content-type") ?? "";
  try {
    return type.includes("application/json") ? await res.json() : await res.text();
  } catch {
    return null;
  }
}

/**
 * Collection envelope. The API returns `meta` as a SIBLING of `data`, not
 * nested inside it:
 *
 *   { "data": [ ... ], "meta": { page, pageSize, total, totalPages } }
 *
 * `apiFetch` unwraps `data` and throws `meta` away, which is correct for a
 * single record and silently wrong for a list — the caller gets 25 rows and
 * no way to know there are 500. `apiList` is the paginated counterpart and
 * every list endpoint must go through it.
 */
export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  /** Never below 1, even when total is 0. */
  totalPages: number;
};

export type Paginated<T> = { items: T[]; meta: PageMeta };

/** Query parameters every paginated endpoint accepts. */
export type PageParams = {
  page?: number;
  /** Server caps at 200 rather than rejecting. */
  pageSize?: number;
};

/** A meta object for data that is not actually paginated, so callers can
 *  treat every list uniformly. */
export const singlePageMeta = (total: number): PageMeta => ({
  page: 1, pageSize: total, total, totalPages: 1,
});

export type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

/**
 * Perform a JSON request. Resolves with the parsed body on 2xx, throws
 * `ApiError` on anything else — including transport failures, which surface
 * as status 0 so callers can tell "backend unreachable" from "backend said no".
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const { body, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  finalHeaders.set("Accept", "application/json");
  if (body !== undefined) finalHeaders.set("Content-Type", "application/json");

  if (authTokenGetter) {
    const token = await authTokenGetter();
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      /**
       * Bearer-only, deliberately.
       *
       * The API also issues an httpOnly `medguard_token` cookie on login and
       * `requireAuth` accepts either. With "include" that cookie would keep
       * authenticating requests after a reload, when the in-memory token is
       * already gone — exactly the authenticated-looking-but-tokenless state
       * the in-memory design exists to avoid. "omit" also stops the browser
       * storing that cookie at all, so the Authorization header is the only
       * thing that can grant access.
       */
      credentials: "omit",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw new ApiError(
      cause instanceof Error ? cause.message : "Network request failed",
      0,
      url,
      null,
    );
  }

  if (!res.ok) {
    const parsed = await parseBody(res);
    const detail =
      parsed && typeof parsed === "object" && "message" in parsed
        ? String((parsed as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(`${res.status} ${detail}`.trim(), res.status, url, parsed);
  }

  if (res.status === 204) return undefined as T;

  // The API wraps every success payload as { data: ... }. Unwrap here so no
  // hook or component has to know about the envelope.
  const parsed = await parseBody(res);
  if (parsed && typeof parsed === "object" && "data" in parsed) {
    return (parsed as { data: T }).data;
  }
  return parsed as T;
}

/** Auth header for the non-JSON paths, which cannot go through apiFetch. */
async function authHeaders(): Promise<Headers> {
  const headers = new Headers();
  if (authTokenGetter) {
    const token = await authTokenGetter();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

/** Wraps a transport failure as status 0, matching apiFetch's contract. */
function asNetworkError(cause: unknown, url: string): ApiError {
  return new ApiError(
    cause instanceof Error ? cause.message : "Network request failed",
    0,
    url,
    null,
  );
}

/**
 * POST a single file as multipart/form-data under the field name the API
 * expects.
 *
 * Deliberately not routed through apiFetch: that sets Content-Type to
 * application/json and JSON.stringifies the body, either of which would
 * destroy a multipart request. The Content-Type is left unset on purpose so
 * the browser can generate the boundary — setting it by hand is the classic
 * way to produce an upload the server cannot parse.
 *
 * Errors keep their parsed body, because the import endpoint returns its
 * per-row report inside a 400 and the caller needs to read it.
 */
export async function apiUpload<T>(path: string, file: File, field = "file"): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = await authHeaders();
  headers.set("Accept", "application/json");

  const form = new FormData();
  form.append(field, file);

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, credentials: "omit", body: form });
  } catch (cause) {
    throw asNetworkError(cause, url);
  }

  const parsed = await parseBody(res);
  if (!res.ok) {
    const detail =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: { message?: unknown } }).error?.message ?? res.statusText)
        : res.statusText;
    throw new ApiError(`${res.status} ${detail}`.trim(), res.status, url, parsed);
  }
  if (parsed && typeof parsed === "object" && "data" in parsed) {
    return (parsed as { data: T }).data;
  }
  return parsed as T;
}

/**
 * GET a file and hand back its bytes plus the server's filename.
 *
 * A plain <a href> cannot be used for this: the template route is ADMIN-only
 * and the session token lives in memory, so a browser-initiated navigation
 * would arrive unauthenticated and bounce with a 401. Fetching it here and
 * handing the blob to a synthetic anchor keeps the browser's own download
 * behaviour while still sending the Authorization header.
 */
export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string | null }> {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = await authHeaders();

  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers, credentials: "omit" });
  } catch (cause) {
    throw asNetworkError(cause, url);
  }

  if (!res.ok) {
    const parsed = await parseBody(res);
    throw new ApiError(`${res.status} ${res.statusText}`.trim(), res.status, url, parsed);
  }

  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return { blob: await res.blob(), filename: match?.[1] ?? null };
}

/** Serialise query parameters, dropping undefined/null/empty rather than
 *  sending `?page=undefined`. Arrays repeat the key. */
export function toQuery(params: Record<string, unknown> | undefined): string {
  if (!params) return "";
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      for (const item of v) if (item !== undefined && item !== null && item !== "") q.append(k, String(item));
    } else {
      q.set(k, String(v));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * GET a paginated collection, keeping the `meta` the API sent.
 *
 * Falls back to a synthesised single-page meta when an endpoint returns a
 * bare array, so a not-yet-paginated route cannot make a caller crash.
 */
export async function apiList<T>(
  path: string,
  params?: Record<string, unknown>,
  options: RequestOptions = {},
): Promise<Paginated<T>> {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}${toQuery(params)}`;
  // `body` is dropped deliberately: this is always a GET.
  const { headers, body: _body, ...rest } = options;

  const finalHeaders = new Headers(headers);
  finalHeaders.set("Accept", "application/json");
  if (authTokenGetter) {
    const token = await authTokenGetter();
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...rest, method: "GET", headers: finalHeaders, credentials: "omit" });
  } catch (cause) {
    throw new ApiError(
      cause instanceof Error ? cause.message : "Network request failed", 0, url, null,
    );
  }

  const parsed = await parseBody(res);

  if (!res.ok) {
    const detail =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error?: { message?: unknown } }).error?.message ?? res.statusText)
        : res.statusText;
    throw new ApiError(`${res.status} ${detail}`.trim(), res.status, url, parsed);
  }

  if (Array.isArray(parsed)) return { items: parsed as T[], meta: singlePageMeta(parsed.length) };

  if (parsed && typeof parsed === "object" && "data" in parsed) {
    const body = parsed as { data: unknown; meta?: PageMeta };
    const items = Array.isArray(body.data) ? (body.data as T[]) : [];
    return { items, meta: body.meta ?? singlePageMeta(items.length) };
  }

  return { items: [], meta: singlePageMeta(0) };
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "GET" }),
  /** Paginated collection — keeps `meta`. Use for every list endpoint. */
  list: apiList,
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  /** Partial update. The API treats absent fields as "leave alone", not "null". */
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  upload: apiUpload,
  download: apiDownload,
};
