/**
 * Shared query behaviour for the backend-backed hooks.
 *
 * Errors are never swallowed: `isError` and the typed `ApiError` are both
 * returned so a component can tell "backend unreachable" (status 0) from
 * "session expired" (401) and render different states for each.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/apiClient";

export type ApiQueryResult<T> = {
  data: T | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  /**
   * The backend went away *after* we already had data. The last good data is
   * still in `data`, so the UI keeps showing it behind a reconnecting notice
   * instead of blanking out. Polls itself back to health — no page reload.
   */
  isReconnecting: boolean;
  error: ApiError | null;
  refetch: UseQueryResult<T, ApiError>["refetch"];
};

export type ApiQueryOptions = {
  /**
   * Heartbeat. The dashboard advertises live monitoring, so it re-reads on an
   * interval; that poll is also what *notices* the backend has gone away.
   * Without it a healthy query would sit on stale data forever, because
   * nothing would ever produce the error that triggers the reconnect loop.
   */
  pollIntervalMs?: number;
  /** Faster retry cadence once the backend has gone away. */
  reconnectIntervalMs?: number;
  staleTime?: number;
  /** Attempts before a fetch is declared failed. Lowered in tests. */
  retry?: number;
};

export function useApiQuery<TWire, TData = TWire>(
  key: readonly unknown[],
  path: string,
  select?: (wire: TWire) => TData,
  options: ApiQueryOptions = {},
): ApiQueryResult<TData> {
  const {
    pollIntervalMs = 30_000,
    reconnectIntervalMs = 5_000,
    staleTime = 30_000,
    retry: maxRetries = 3,
  } = options;

  const query = useQuery<TWire, ApiError, TData>({
    queryKey: key,
    queryFn: () => api.get<TWire>(path),
    select,
    staleTime,
    // Auth failures will not fix themselves by asking again.
    retry: (attempt, error) => !error.isAuthError && attempt < maxRetries,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 8000),
    // Heartbeat while healthy; tighter cadence while down, so the view both
    // notices the outage and heals from it without a reload.
    refetchInterval: q => {
      if (q.state.status === "error") {
        return q.state.error?.isAuthError ? false : reconnectIntervalMs;
      }
      return pollIntervalMs;
    },
    refetchIntervalInBackground: false,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    isReconnecting: query.isError && query.data !== undefined,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}
