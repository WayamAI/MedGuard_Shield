/**
 * Every write the Drishti frontend performs, other than CSV import.
 *
 * Collected in one file because they share one concern: what a successful
 * write invalidates. Risk is derived from asset and vendor state on the
 * server, so a change to either can move a score, a band, and the dashboard
 * counts that aggregate them — invalidating only the list you just edited
 * leaves the rest of the app quietly wrong.
 *
 * All of these call endpoints that already exist. Nothing here is speculative:
 * see medguard-backend/src/routes/{assets,vendors,risks}.ts.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/apiClient";
import { assetsKey } from "@/hooks/useAssets";
import { vendorsKey } from "@/hooks/useVendors";
import { risksKey } from "@/hooks/useRisks";
import { dataFlowsKey } from "@/hooks/useDataFlows";
import { accessKey } from "@/hooks/useAccess";
import { threatsKey } from "@/hooks/useThreats";
import type {
  ApiAsset, ApiAssetDetail, ApiVendor, ApiRisk,
  AssetWriteInput, VendorWriteInput,
} from "@/lib/apiTypes";

/** Query key for a single asset — GET /api/assets/:id. */
export const assetKey = (id: number) => ["asset", id] as const;

/**
 * Anything that can move a risk score. Deliberately broad: the cost of an
 * extra refetch is a few hundred milliseconds, the cost of a stale band on a
 * risk dashboard is someone believing a number that is no longer true.
 */
function useInvalidateRiskGraph() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: assetsKey }),
      qc.invalidateQueries({ queryKey: vendorsKey }),
      qc.invalidateQueries({ queryKey: risksKey }),
      qc.invalidateQueries({ queryKey: dataFlowsKey }),
      qc.invalidateQueries({ queryKey: accessKey }),
      qc.invalidateQueries({ queryKey: threatsKey }),
      qc.invalidateQueries({ queryKey: ["asset"] }),
      qc.invalidateQueries({ queryKey: ["vendor"] }),
    ]);
}

/* ------------------------------------------------------------------ assets */

/** POST /api/assets — requires ADMIN or ANALYST (`canWrite` server-side). */
export function useCreateAsset() {
  const invalidate = useInvalidateRiskGraph();
  return useMutation<ApiAsset, ApiError, AssetWriteInput>({
    mutationFn: input => api.post<ApiAsset>("/api/assets", input),
    onSuccess: invalidate,
  });
}

/** PATCH /api/assets/:id — partial; omitted fields are left untouched. */
export function useUpdateAsset(id: number) {
  const invalidate = useInvalidateRiskGraph();
  return useMutation<ApiAsset, ApiError, Partial<AssetWriteInput>>({
    mutationFn: input => api.patch<ApiAsset>(`/api/assets/${id}`, input),
    onSuccess: invalidate,
  });
}

/* ----------------------------------------------------------------- vendors */

/** POST /api/vendors — requires `canWrite`. */
export function useCreateVendor() {
  const invalidate = useInvalidateRiskGraph();
  return useMutation<ApiVendor, ApiError, VendorWriteInput>({
    mutationFn: input => api.post<ApiVendor>("/api/vendors", input),
    onSuccess: invalidate,
  });
}

/** PATCH /api/vendors/:id — partial. */
export function useUpdateVendor(id: number) {
  const invalidate = useInvalidateRiskGraph();
  return useMutation<ApiVendor, ApiError, Partial<VendorWriteInput>>({
    mutationFn: input => api.patch<ApiVendor>(`/api/vendors/${id}`, input),
    onSuccess: invalidate,
  });
}

/* -------------------------------------------------------------- recompute */

/**
 * POST /api/risks/:assetId/recompute — re-runs the scoring engine from the
 * asset's stored factors and returns the new row.
 *
 * The frontend never computes a score itself. It asks the server to, then
 * renders whatever comes back: one scoring engine, server-side, always.
 */
export function useRecomputeAssetRisk() {
  const invalidate = useInvalidateRiskGraph();
  return useMutation<ApiRisk, ApiError, number>({
    mutationFn: assetId => api.post<ApiRisk>(`/api/risks/${assetId}/recompute`),
    onSuccess: invalidate,
  });
}

/** POST /api/vendors/:id/recompute — same contract, vendor side. */
export function useRecomputeVendorRisk() {
  const invalidate = useInvalidateRiskGraph();
  return useMutation<ApiVendor, ApiError, number>({
    mutationFn: vendorId => api.post<ApiVendor>(`/api/vendors/${vendorId}/recompute`),
    onSuccess: invalidate,
  });
}

export type { ApiAssetDetail };
