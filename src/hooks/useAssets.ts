/** GET /api/assets — monitored systems, services and data stores. */
import { useApiQuery, type ApiQueryResult, type ApiQueryOptions } from "@/hooks/useApiQuery";
import type { ApiAsset } from "@/lib/apiTypes";

export const assetsKey = ["assets"] as const;

export function useAssets(options?: ApiQueryOptions): ApiQueryResult<ApiAsset[]> {
  return useApiQuery<ApiAsset[]>(assetsKey, "/api/assets", undefined, options);
}
