/** GET /api/assets — monitored systems, services and data stores. */
import { useApiQuery, type ApiQueryResult, type ApiQueryOptions } from "@/hooks/useApiQuery";
import type { ApiAsset, ApiAssetDetail } from "@/lib/apiTypes";

export const assetsKey = ["assets"] as const;

export function useAssets(options?: ApiQueryOptions): ApiQueryResult<ApiAsset[]> {
  return useApiQuery<ApiAsset[]>(assetsKey, "/api/assets", undefined, options);
}

/**
 * GET /api/assets/:id — the asset plus its PHI categories, full risk
 * breakdown and both directions of data flow.
 *
 * Kept separate from the list rather than deriving the drawer from a list
 * row: the list deliberately does not carry phiTypes or flows, and faking
 * them client-side would show a subset as if it were the whole picture.
 */
export function useAsset(id: number | null): ApiQueryResult<ApiAssetDetail> {
  return useApiQuery<ApiAssetDetail>(
    ["asset", id] as const,
    `/api/assets/${id}`,
    undefined,
    { enabled: id !== null },
  );
}
