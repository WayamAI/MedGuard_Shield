/** GET /api/dataflows, mapped to PhiSankey's node/link props. */
import { useApiQuery, type ApiQueryResult, type ApiQueryOptions } from "@/hooks/useApiQuery";
import { toSankeyData } from "@/lib/mappers";
import type { ApiDataFlow } from "@/lib/apiTypes";
import type { FlowNode, FlowLink } from "@/components/PhiSankey";

export const dataFlowsKey = ["dataflows"] as const;

export function useDataFlows(options?: ApiQueryOptions): ApiQueryResult<{ nodes: FlowNode[]; links: FlowLink[] }> {
  return useApiQuery<ApiDataFlow[], { nodes: FlowNode[]; links: FlowLink[] }>(
    dataFlowsKey,
    "/api/dataflows",
    toSankeyData,
    options,
  );
}

/** The unmapped wire records, for callers that need phiType or raw edges. */
export function useRawDataFlows(): ApiQueryResult<ApiDataFlow[]> {
  return useApiQuery<ApiDataFlow[]>(dataFlowsKey, "/api/dataflows");
}
