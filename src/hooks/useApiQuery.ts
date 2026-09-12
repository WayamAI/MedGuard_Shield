/**
 * Shared query behaviour for the backend-backed hooks.
 *
 * Errors are never swallowed: `isError` and the typed `ApiError` are both
 * returned so a component can tell "backend unreachable" (status 0) from
 * "session expired" (401) and render different states for each.
 */
import { useCallback, useState } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
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
  /** Explicit user-driven reload. Unlike refetch, a failure is observable. */
  refresh: () => Promise<void>;
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

  const queryClient = useQueryClient();

  /*
   * A manual refetch that fails on a query which already holds data is
   * invisible through the hook: TanStack keeps status 'success' and leaves
   * error, failureReason and failureCount all empty. fetchQuery is the one
   * path that surfaces the rejection, so an explicit refresh goes through it
   * and parks the error here.
   */
  const [refreshError, setRefreshError] = useState<ApiError | null>(null);

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

  const refresh = useCallback(async () => {
    try {
      await queryClient.fetchQuery<TWire>({ queryKey: key, queryFn: () => api.get<TWire>(path) });
      setRefreshError(null);
    } catch (err) {
      setRefreshError(err instanceof ApiError ? err : null);
    }
  }, [queryClient, key, path]);

  return {
    refresh,
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    /*
     * TanStack keeps status 'success' when a *manual* refetch fails on a query
     * that already holds data, so isError alone misses that case and the
     * Refresh button would fail silently. failureReason is set on any failed
     * attempt, which covers both the heartbeat and an explicit refetch.
     */
    isReconnecting:
      query.data !== undefined &&
      (query.isError || query.failureReason !== null || refreshError !== null),
    error: query.error ?? query.failureReason ?? refreshError,
    refetch: query.refetch,
  };
}
