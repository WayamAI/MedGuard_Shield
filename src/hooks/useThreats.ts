/**
 * GET /api/threats — detected threats and security alerts.
 *
 * PLUMBING ONLY, for the same reason as useAccess: the endpoint is not live
 * and its shape is unconfirmed, so the row type stays a parameter rather than
 * an invention. See useAccess for the two-line change when the contract lands.
 *
 * Note the Threats page currently reads alerts from AppStore, which also backs
 * the sidebar badge and the dashboard's Recent Alerts. Wiring this hook in is
 * therefore not a like-for-like swap: either those consumers move too, or the
 * store is seeded from the API. That decision needs the real shape first.
 */
import { useApiQuery, type ApiQueryResult, type ApiQueryOptions } from "@/hooks/useApiQuery";

export const threatsKey = ["threats"] as const;

export function useThreats<T = unknown>(options?: ApiQueryOptions): ApiQueryResult<T[]> {
  return useApiQuery<T[]>(threatsKey, "/api/threats", undefined, options);
}
