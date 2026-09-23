/** GET /api/risks — one scored row per assessed asset. */
import { useMemo } from "react";
import { useApiList, type ApiListResult, type ApiQueryOptions } from "@/hooks/useApiQuery";
import { toMatrixRisks } from "@/lib/mappers";
import type { ApiRisk, RiskBand } from "@/lib/apiTypes";
import type { MatrixRisk } from "@/components/RiskMatrix";

export const risksKey = ["risks"] as const;

export type RiskListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  band?: RiskBand;
  sort?: "score" | "assetName" | "computedAt";
  order?: "asc" | "desc";
};

/** The wire records, for the register table. */
export function useRisks(
  params: RiskListParams = {},
  options?: ApiQueryOptions,
): ApiListResult<ApiRisk> {
  return useApiList<ApiRisk>(risksKey, "/api/risks", params, options);
}

/**
 * The same rows mapped for <RiskMatrix>.
 *
 * Asks for the server's maximum page, because a matrix that plots one page of
 * a multi-page estate is a picture of 25 risks captioned as the whole
 * organisation. `truncated` says so when the estate outgrows one page, rather
 * than letting the chart quietly understate it.
 */
export function useRiskMatrix(options?: ApiQueryOptions): ApiListResult<MatrixRisk> & {
  matrix: MatrixRisk[] | undefined;
  truncated: boolean;
} {
  const query = useRisks({ pageSize: 200 }, options);
  const matrix = useMemo(
    () => (query.data ? toMatrixRisks(query.data) : undefined),
    [query.data],
  );
  return {
    ...(query as unknown as ApiListResult<MatrixRisk>),
    data: matrix,
    matrix,
    truncated: (query.meta?.total ?? 0) > (query.meta?.pageSize ?? 200),
  };
}
