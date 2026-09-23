/** GET /api/vendors — third-party PHI access and its scored risk. */
import { useApiQuery, useApiList, type ApiQueryResult, type ApiListResult, type ApiQueryOptions } from "@/hooks/useApiQuery";
import type { ApiVendor, ApiVendorDetail, BaaStatus } from "@/lib/apiTypes";

export const vendorsKey = ["vendors"] as const;
export const vendorKey = (id: number) => ["vendor", id] as const;

export type VendorListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  baaStatus?: BaaStatus;
  includeArchived?: boolean;
};

export function useVendors(
  params: VendorListParams = {},
  options?: ApiQueryOptions,
): ApiListResult<ApiVendor> {
  return useApiList<ApiVendor>(vendorsKey, "/api/vendors", params, options);
}

/** GET /api/vendors/:id — the vendor plus the assets it can reach. */
export function useVendor(id: number | null): ApiQueryResult<ApiVendorDetail> {
  return useApiQuery<ApiVendorDetail>(
    ["vendor", id] as const, `/api/vendors/${id}`, undefined, { enabled: id !== null },
  );
}
