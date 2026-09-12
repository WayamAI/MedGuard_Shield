/**
 * GET /api/access — access grants: who can reach which system, and how stale
 * or over-privileged that grant is.
 *
 * PLUMBING ONLY. The row shape is deliberately left as a type parameter
 * because the endpoint is not live yet and its contract has not been
 * confirmed. Guessing field names here would spread an invented shape through
 * the mapper and the page, and be worse than no type at all.
 *
 * When the backend confirms the response, the one change needed is:
 *   1. add `ApiAccessGrant` to src/lib/apiTypes.ts from the real payload
 *   2. default the parameter to it, i.e. `useAccess<T = ApiAccessGrant>`
 * Nothing else in this file, and no call site, has to move.
 */
import { useApiQuery, type ApiQueryResult, type ApiQueryOptions } from "@/hooks/useApiQuery";

export const accessKey = ["access"] as const;

export function useAccess<T = unknown>(options?: ApiQueryOptions): ApiQueryResult<T[]> {
  return useApiQuery<T[]>(accessKey, "/api/access", undefined, options);
}
