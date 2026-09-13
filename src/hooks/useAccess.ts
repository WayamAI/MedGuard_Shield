/**
 * GET /api/access — access grants plus a server-computed summary.
 *
 * Returns the envelope, not a bare array: the server derives the summary
 * counts itself, so the page renders the same numbers the API asserts rather
 * than recomputing and risking a quiet disagreement.
 */
import { useApiQuery, type ApiQueryResult, type ApiQueryOptions } from "@/hooks/useApiQuery";
import type { ApiAccessResponse } from "@/lib/apiTypes";

export const accessKey = ["access"] as const;

export function useAccess(options?: ApiQueryOptions): ApiQueryResult<ApiAccessResponse> {
  return useApiQuery<ApiAccessResponse>(accessKey, "/api/access", undefined, options);
}
