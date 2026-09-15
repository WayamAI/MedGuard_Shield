/**
 * Base fetch wrapper for the MedGuard backend.
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

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
};
