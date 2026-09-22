/**
 * GET /api/dataflows — PHI movements between systems.
 *
 * The Sankey has to draw the whole map, so both hooks ask for the server's
 * maximum page rather than the default 25. A flow diagram missing three
 * quarters of its edges is not a smaller diagram, it is a wrong one — and
 * unlike a table, nothing on screen would hint that edges were missing.
 * `truncated` says so if the estate ever outgrows one page.
 */
import { useMemo } from "react";
import { useApiList, type ApiListResult, type ApiQueryOptions } from "@/hooks/useApiQuery";
import { toSankeyData } from "@/lib/mappers";
import type { ApiDataFlow } from "@/lib/apiTypes";
import type { FlowNode, FlowLink } from "@/components/PhiSankey";

export const dataFlowsKey = ["dataflows"] as const;

/** The server caps pageSize at 200. */
const FLOW_SCAN_LIMIT = 200;

/** The wire records. */
export function useRawDataFlows(options?: ApiQueryOptions): ApiListResult<ApiDataFlow> {
  return useApiList<ApiDataFlow>(dataFlowsKey, "/api/dataflows", { pageSize: FLOW_SCAN_LIMIT }, options);
}

/** The same rows mapped to the Sankey's node/link props. */
export function useDataFlows(options?: ApiQueryOptions): ApiListResult<ApiDataFlow> & {
  graph: { nodes: FlowNode[]; links: FlowLink[] } | undefined;
  truncated: boolean;
} {
  const query = useRawDataFlows(options);
  const graph = useMemo(
    () => (query.data ? toSankeyData(query.data) : undefined),
    [query.data],
  );
  return {
    ...query,
    graph,
    truncated: (query.meta?.total ?? 0) > FLOW_SCAN_LIMIT,
  };
}
