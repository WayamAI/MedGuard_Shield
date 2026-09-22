/**
 * GET /api/access — paginated access grants, plus a separate summary.
 *
 * The endpoint used to return `{ summary, grants }` in one envelope. It is
 * now a paginated collection with the summary on its own route, and that
 * split matters: the summary is organisation-wide, so it must never be
 * derived from whatever 25 rows happen to be on screen. "Total grants = 25"
 * when there are 500 is the exact failure this separation prevents.
 */
import { useApiQuery, useApiList, type ApiQueryResult, type ApiListResult, type ApiQueryOptions } from "@/hooks/useApiQuery";
import type { ApiAccessGrant, ApiAccessSummary, AccessLevel } from "@/lib/apiTypes";

export const accessKey = ["access"] as const;
export const accessSummaryKey = ["access", "summary"] as const;

export type AccessListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  level?: AccessLevel;
  assetId?: number;
  identityId?: number;
  /** Server-side filter — not a client filter over the current page. */
  flaggedOnly?: boolean;
  includeRevoked?: boolean;
};

export function useAccess(
  params: AccessListParams = {},
  options?: ApiQueryOptions,
): ApiListResult<ApiAccessGrant> {
  return useApiList<ApiAccessGrant>(accessKey, "/api/access", params, options);
}

/** Organisation-wide counts. Never computed from a page. */
export function useAccessSummary(options?: ApiQueryOptions): ApiQueryResult<ApiAccessSummary> {
  return useApiQuery<ApiAccessSummary>(accessSummaryKey, "/api/access/summary", undefined, options);
}
