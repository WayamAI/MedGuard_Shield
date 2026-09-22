/** GET /api/assets — the monitored systems, services and data stores. */
import { useApiQuery, useApiList, type ApiQueryResult, type ApiListResult, type ApiQueryOptions } from "@/hooks/useApiQuery";
import type { ApiAsset, ApiAssetDetail, AssetType, RiskBand } from "@/lib/apiTypes";

export const assetsKey = ["assets"] as const;
export const assetKey = (id: number) => ["asset", id] as const;

export type AssetListParams = {
  page?: number;
  pageSize?: number;
  /** Server-side, across the whole estate — not a filter over one page. */
  search?: string;
  type?: AssetType;
  band?: RiskBand;
  includeArchived?: boolean;
  sort?: "name" | "phiVolume" | "riskScore" | "createdAt";
  order?: "asc" | "desc";
};

export function useAssets(
  params: AssetListParams = {},
  options?: ApiQueryOptions,
): ApiListResult<ApiAsset> {
  return useApiList<ApiAsset>(assetsKey, "/api/assets", params, options);
}

/**
 * GET /api/assets/:id — the asset plus its PHI categories, full risk
 * breakdown, both directions of data flow, and its vendors, access grants,
 * threats, controls and remediations.
 *
 * Kept separate from the list rather than deriving the drawer from a row:
 * the list deliberately carries only `counts`, and showing a subset as if it
 * were the whole picture is how a drawer starts lying.
 */
export function useAsset(id: number | null): ApiQueryResult<ApiAssetDetail> {
  return useApiQuery<ApiAssetDetail>(
    ["asset", id] as const, `/api/assets/${id}`, undefined, { enabled: id !== null },
  );
}
