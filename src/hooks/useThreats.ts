/**
 * GET /api/threats — paginated threats, plus a separate summary.
 *
 * Same split as access: the sidebar badge and the dashboard read the
 * summary, so they state the organisation's open-threat count rather than
 * the number of open threats that happened to land on page one.
 */
import { useApiQuery, useApiList, type ApiQueryResult, type ApiListResult, type ApiQueryOptions } from "@/hooks/useApiQuery";
import type {
  ApiThreat, ApiThreatDetail, ApiThreatSummary, ThreatSeverity, ThreatStatus,
} from "@/lib/apiTypes";

export const threatsKey = ["threats"] as const;
export const threatSummaryKey = ["threats", "summary"] as const;
export const threatKey = (id: number) => ["threat", id] as const;

export type ThreatListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ThreatStatus;
  severity?: ThreatSeverity;
  assetId?: number;
  openOnly?: boolean;
};

export function useThreats(
  params: ThreatListParams = {},
  options?: ApiQueryOptions,
): ApiListResult<ApiThreat> {
  return useApiList<ApiThreat>(threatsKey, "/api/threats", params, options);
}

/** Organisation-wide counts. Backs the sidebar badge and the dashboard. */
export function useThreatSummary(options?: ApiQueryOptions): ApiQueryResult<ApiThreatSummary> {
  return useApiQuery<ApiThreatSummary>(threatSummaryKey, "/api/threats/summary", undefined, options);
}

/** Detail carries `allowedTransitions[]`, so the UI offers only legal moves. */
export function useThreat(id: number | null): ApiQueryResult<ApiThreatDetail> {
  return useApiQuery<ApiThreatDetail>(
    ["threat", id] as const, `/api/threats/${id}`, undefined, { enabled: id !== null },
  );
}
