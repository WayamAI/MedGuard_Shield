/** GET /api/vendors — third-party PHI access and its scored risk. */
import { useApiQuery, type ApiQueryResult, type ApiQueryOptions } from "@/hooks/useApiQuery";
import type { ApiVendor } from "@/lib/apiTypes";

export const vendorsKey = ["vendors"] as const;

export function useVendors(options?: ApiQueryOptions): ApiQueryResult<ApiVendor[]> {
  return useApiQuery<ApiVendor[]>(vendorsKey, "/api/vendors", undefined, options);
}
