/** GET /api/vendors — third-party PHI access and its scored risk. */
import { useApiQuery, type ApiQueryResult, type ApiQueryOptions } from "@/hooks/useApiQuery";
import type { ApiVendor, ApiVendorDetail } from "@/lib/apiTypes";

export const vendorsKey = ["vendors"] as const;

export function useVendors(options?: ApiQueryOptions): ApiQueryResult<ApiVendor[]> {
  return useApiQuery<ApiVendor[]>(vendorsKey, "/api/vendors", undefined, options);
}

/** GET /api/vendors/:id — the vendor plus the assets it can reach. */
export function useVendor(id: number | null): ApiQueryResult<ApiVendorDetail> {
  return useApiQuery<ApiVendorDetail>(
    ["vendor", id] as const,
    `/api/vendors/${id}`,
    undefined,
    { enabled: id !== null },
  );
}
