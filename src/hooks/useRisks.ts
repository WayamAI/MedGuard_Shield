/** GET /api/risks, mapped to RiskMatrix's props. */
import { useApiQuery, type ApiQueryResult, type ApiQueryOptions } from "@/hooks/useApiQuery";
import { toMatrixRisks } from "@/lib/mappers";
import type { ApiRisk } from "@/lib/apiTypes";
import type { MatrixRisk } from "@/components/RiskMatrix";

export const risksKey = ["risks"] as const;

export function useRisks(options?: ApiQueryOptions): ApiQueryResult<MatrixRisk[]> {
  return useApiQuery<ApiRisk[], MatrixRisk[]>(risksKey, "/api/risks", toMatrixRisks, options);
}

/** The unmapped wire records, for the register table's owner/due columns. */
export function useRawRisks(): ApiQueryResult<ApiRisk[]> {
  return useApiQuery<ApiRisk[]>(risksKey, "/api/risks");
}
