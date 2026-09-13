/**
 * GET /api/threats — detected threats plus a server-computed summary.
 *
 * Same envelope rule as useAccess. Note this does not replace AppStore's
 * alerts, which still back the sidebar badge and the dashboard feed; the two
 * are separate concerns until those consumers are migrated.
 */
import { useApiQuery, type ApiQueryResult, type ApiQueryOptions } from "@/hooks/useApiQuery";
import type { ApiThreatsResponse } from "@/lib/apiTypes";

export const threatsKey = ["threats"] as const;

export function useThreats(options?: ApiQueryOptions): ApiQueryResult<ApiThreatsResponse> {
  return useApiQuery<ApiThreatsResponse>(threatsKey, "/api/threats", undefined, options);
}
