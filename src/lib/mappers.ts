/**
 * Translation layer between the backend wire shapes and component props.
 *
 * The API describes PHI movement as a flat edge list. PhiSankey needs an
 * explicit node list with a column index, so the node set, each node's
 * throughput and its stage are all derived here. Keeping this pure means the
 * hard part (stage assignment) is unit-testable without a backend or a DOM.
 */
import type { FlowNode, FlowLink, FlowTone } from "@/components/PhiSankey";
import type { MatrixRisk } from "@/components/RiskMatrix";
import type { ApiDataFlow, ApiRisk } from "@/lib/apiTypes";

/** Stable id from a system name, so nodes dedupe across edges. */
const idOf = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const toneOf = (flow: ApiDataFlow): FlowTone => flow.status ?? (flow.encrypted ? "ok" : "violation");

/**
 * Coerce a wire number into something safe to do geometry with. A null or a
 * string from the API becomes NaN under arithmetic, and a single NaN poisons
 * every scale it touches — so it is neutralised here, at the boundary, rather
 * than defended against in each component.
 */
const safeNumber = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

/** The worst tone wins when several flows touch the same node. */
const TONE_RANK: Record<FlowTone, number> = { ok: 0, warn: 1, violation: 2 };
const worstTone = (a: FlowTone, b: FlowTone): FlowTone => (TONE_RANK[b] > TONE_RANK[a] ? b : a);

/**
 * Assign each node a column index by longest-path depth from any source.
 *
 * Longest path rather than shortest: a system fed both directly and via an
 * intermediary belongs in the later column, otherwise its ribbons would run
 * backwards. Iterative relaxation bounded by node count, so a cycle in the
 * data degrades to a capped depth instead of hanging.
 */
function deriveStages(nodeIds: string[], links: FlowLink[]): Record<string, number> {
  const stage: Record<string, number> = {};
  nodeIds.forEach(id => { stage[id] = 0; });

  for (let pass = 0; pass < nodeIds.length; pass++) {
    let changed = false;
    for (const link of links) {
      const candidate = stage[link.from] + 1;
      if (candidate > stage[link.to]) {
        stage[link.to] = candidate;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return stage;
}

/**
 * Build PhiSankey's `nodes` and `links` from the API's flat flow list.
 *
 * A node's `records` is its throughput: the larger of what flows in and what
 * flows out, matching how the component sizes boxes.
 */
export function toSankeyData(flows: ApiDataFlow[]): { nodes: FlowNode[]; links: FlowLink[] } {
  if (flows.length === 0) return { nodes: [], links: [] };

  const links: FlowLink[] = flows.map(f => ({
    from: idOf(f.source),
    to: idOf(f.target),
    value: safeNumber(f.recordsPerDay),
    tone: toneOf(f),
  }));

  // Preserve first-seen order so column ordering is stable across refetches.
  const names = new Map<string, string>();
  for (const f of flows) {
    if (!names.has(idOf(f.source))) names.set(idOf(f.source), f.source);
    if (!names.has(idOf(f.target))) names.set(idOf(f.target), f.target);
  }
  const ids = [...names.keys()];

  const inSum: Record<string, number> = {};
  const outSum: Record<string, number> = {};
  const tone: Record<string, FlowTone> = {};
  const encrypted: Record<string, boolean> = {};
  ids.forEach(id => { inSum[id] = 0; outSum[id] = 0; tone[id] = "ok"; encrypted[id] = true; });

  flows.forEach((f, i) => {
    const from = idOf(f.source);
    const to = idOf(f.target);
    outSum[from] += links[i].value;
    inSum[to] += links[i].value;
    // A node inherits the worst tone of the flows leaving it, and a downstream
    // node inherits the tone of what reaches it.
    tone[from] = worstTone(tone[from], links[i].tone);
    tone[to] = worstTone(tone[to], links[i].tone);
    if (!f.encrypted) { encrypted[from] = false; encrypted[to] = false; }
  });

  const stage = deriveStages(ids, links);

  const nodes: FlowNode[] = ids.map(id => ({
    id,
    name: names.get(id) ?? id,
    stage: stage[id],
    status: tone[id],
    records: Math.max(inSum[id], outSum[id]),
    encryption: encrypted[id] ? "AES-256" : "Unencrypted",
  }));

  return { nodes, links };
}

const clamp15 = (n: number) => (Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 1);

/**
 * Map API risks onto the matrix's props.
 *
 * `band` is passed through as authoritative. The backend scores on
 * likelihood x impact x exposure x control gap, which the matrix's own
 * L x I product cannot reproduce — on the seeded data the two disagree on 7
 * of 8 rows, and only the backend's inputs include exposure and control gap.
 * L and I still place the chip in its cell; the band decides its colour.
 *
 * `/api/risks` carries no name, category or status of its own, so the row is
 * identified by its asset. cat/status stay undefined rather than invented.
 */
export function toMatrixRisks(risks: ApiRisk[]): MatrixRisk[] {
  return risks.map(r => ({
    id: `R-${String(r.id).padStart(3, "0")}`,
    name: r.assetName,
    L: clamp15(r.likelihood),
    I: clamp15(r.impact),
    band: (typeof r.band === "string" ? r.band.toLowerCase() : undefined) as MatrixRisk["band"],
  }));
}
