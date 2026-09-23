import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Badge, Btn, SectionHeader, SlideOver, Select } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { PhiSankey, type FlowNode, type FlowLink } from "@/components/PhiSankey";
import { DataState } from "@/components/DataState";
import { listAsQuery } from "@/components/DataTable";
import { PageHeader, Field, FieldGroup, EntityAvatar } from "@/components/ui-patterns";
import { useDataFlows, useRawDataFlows } from "@/hooks/useDataFlows";
import { notify } from "@/lib/notify";

/**
 * PHI flow map — where patient data actually moves.
 *
 * Removed in the Drishti pass: a four-step "Remediation Workflow" that set a
 * local boolean, recoloured the ribbons, dropped the violation count to zero
 * and announced "Violation resolved, encryption applied." Nothing was ever
 * written; a refresh brought the violation straight back. Claiming a security
 * remediation that did not happen is the most damaging thing this product
 * could do, so it is gone until POST /api/dataflows/:id/remediate exists
 * (specified in FRONTEND_API_CONTRACT.md).
 *
 * The node drawer also carried invented facts — a fixed "Name, DOB, SSN,
 * Diagnosis" data-type list, "Users with access: 47", "Last audit: Apr 22
 * 2025", "RBAC ✓" and a compliance check that was a two-second timer. The
 * drawer now shows only what /api/dataflows actually returns.
 */
export default function PhiFlow() {
  const navigate = useNavigate();
  const flows = useDataFlows();
  const rawFlows = useRawDataFlows();
  const chartRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<FlowNode | null>(null);
  const [filter, setFilter] = useState("all");
  const [phiType, setPhiType] = useState("all");

  const nodes = useMemo(() => flows.graph?.nodes ?? [], [flows.graph]);
  const links = useMemo(() => flows.graph?.links ?? [], [flows.graph]);

  const onScan = () => {
    void Promise.all([flows.refresh(), rawFlows.refresh()]).then(() =>
      notify.success("Flow map refreshed from the API"),
    );
  };

  /** PHI categories present in the live data — not a fixed list. */
  const phiTypes = useMemo(() => {
    const set = new Set((rawFlows.data ?? []).map(f => f.phiType));
    return Array.from(set).sort();
  }, [rawFlows.data]);

  /** Edge keys that carry the selected PHI type, when one is chosen. */
  const phiTypeEdgeKeys = useMemo(() => {
    if (phiType === "all") return null;
    return new Set(
      (rawFlows.data ?? [])
        .filter(f => f.phiType === phiType)
        .map(f => `${f.source}→${f.target}`),
    );
  }, [rawFlows.data, phiType]);

  const filteredEdges = useMemo(() => {
    let out: FlowLink[] = links;
    if (filter === "violations") out = out.filter(e => e.tone === "violation");
    else if (filter === "high") out = out.filter(e => e.value > 50_000);
    if (phiTypeEdgeKeys) {
      const nameFor = (id: string) => nodes.find(n => n.id === id)?.name ?? id;
      out = out.filter(e => phiTypeEdgeKeys.has(`${nameFor(e.from)}→${nameFor(e.to)}`));
    }
    return out;
  }, [links, filter, phiTypeEdgeKeys, nodes]);

  /** Only draw nodes the current filter still connects. */
  const visibleNodes = useMemo(() => {
    if (filter === "all" && phiType === "all") return nodes;
    const keep = new Set(filteredEdges.flatMap(e => [e.from, e.to]));
    return nodes.filter(n => keep.has(n.id));
  }, [nodes, filter, phiType, filteredEdges]);

  /** Summary is derived from the same records the chart draws, never restated. */
  const summary = useMemo(() => {
    const violations = links.filter(e => e.tone === "violation");
    return {
      total: links.length,
      compliant: links.filter(e => e.tone === "ok").length,
      violations: violations.length,
      warnings: links.filter(e => e.tone === "warn").length,
      inTransit: links.reduce((sum, e) => sum + e.value, 0),
      firstViolation: violations[0] ?? null,
    };
  }, [links]);

  const nameOf = useCallback(
    (id: string) => nodes.find(n => n.id === id)?.name ?? id,
    [nodes],
  );

  const exposureScore = useMemo(() => {
    if (!summary.total) return 0;
    const risky = links.filter(e => e.tone !== "ok").reduce((s, e) => s + e.value, 0);
    return Math.round((risky / Math.max(1, summary.inTransit)) * 100);
  }, [links, summary]);

  /**
   * Real export: serialise the rendered SVG and hand it to the browser as a
   * download. The old button toasted "Flow map exported as PNG" and produced
   * no file. SVG rather than PNG because it needs no canvas rasterisation
   * step and stays sharp at any size.
   */
  const onExport = useCallback(() => {
    const svg = chartRef.current?.querySelector("svg");
    if (!svg) { notify.error("Nothing to export yet — the map is still loading."); return; }
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `drishti-phi-flow-${new Date().toISOString().slice(0, 10)}.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    notify.success("Flow map downloaded");
  }, []);

  const phiForNode = useMemo(() => {
    if (!selected || !rawFlows.data) return [];
    return rawFlows.data.filter(f => f.source === selected.name || f.target === selected.name);
  }, [selected, rawFlows.data]);

  return (
    <div className="space-y-4">
      <PageHeader
        icon="dataFlow"
        title="PHI Data Flow Map"
        description="Every mapped movement of PHI between systems, sized by daily volume and coloured by encryption status."
        meta={
          <>
            <Badge tone={exposureScore >= 50 ? "danger" : exposureScore >= 25 ? "warning" : "success"}>
              PHI Exposure Score: {exposureScore} / 100
            </Badge>
            <span className="text-caption text-tertiary">{summary.total} flows monitored</span>
          </>
        }
        actions={
          <>
            <Select value={phiType} onChange={e => setPhiType(e.target.value)} aria-label="Filter by PHI type">
              <option value="all">All PHI types</option>
              {phiTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter flows">
              <option value="all">All flows</option>
              <option value="violations">Only violations</option>
              <option value="high">High volume</option>
            </Select>
            <Btn variant="outline" onClick={onScan} disabled={flows.isFetching}>
              <AppIcon name="refresh" size="sm" spin={flows.isFetching} />
              Rescan
            </Btn>
            <Btn variant="outline" onClick={onExport}>
              <AppIcon name="download" size="sm" />
              Export
            </Btn>
          </>
        }
      />

      {summary.firstViolation && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-feedback-error-stroke bg-feedback-error-background p-3">
          <AppIcon name="threats" size="md" className="text-feedback-error" />
          <span className="text-body-md text-primary">
            <span className="font-semibold">
              {summary.violations} active violation{summary.violations === 1 ? "" : "s"}:
            </span>{" "}
            unencrypted PHI on {nameOf(summary.firstViolation.from)} → {nameOf(summary.firstViolation.to)}.
          </span>
          <div className="flex-1" />
          <Btn
            variant="outline"
            onClick={() => setSelected(nodes.find(n => n.id === summary.firstViolation!.from) ?? null)}
          >
            Inspect flow
          </Btn>
          <Btn variant="outline" onClick={() => navigate("/assets")}>
            Open affected asset
          </Btn>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        {/*
          min-w-0 matters here: a grid item defaults to min-width:auto, so
          once the map carries a min-width the column would size to the map
          rather than to 1fr — pushing the card past the viewport and
          clipping the last stage instead of letting the wrapper scroll.
        */}
        <Card className="min-w-0 p-4">
          <DataState
            query={listAsQuery(flows)}
            height={496}
            emptyTitle="No PHI flows recorded"
            emptyMessage="The API returned no data flows. If the backend was just set up, run the seed script."
          >
            {() => (
              <div className="relative w-full overflow-x-auto" ref={chartRef}>
                {filteredEdges.length === 0 ? (
                  <p className="py-16 text-center text-body-sm text-tertiary">
                    No flows match the current filters.
                  </p>
                ) : (
                  <PhiSankey
                    nodes={visibleNodes}
                    links={filteredEdges}
                    onSelect={id => setSelected(nodes.find(n => n.id === id) ?? null)}
                  />
                )}
              </div>
            )}
          </DataState>
          <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-default pt-3 text-caption text-tertiary">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-severity-low" /> Compliant</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-severity-high" /> Warning</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-severity-critical" /> Violation</span>
            <span className="ml-auto">Node height and ribbon width are proportional to PHI records/day</span>
          </div>
        </Card>

        <Card className="h-fit p-4">
          <SectionHeader title="Flow Summary" />
          <div className="space-y-2 text-body-md">
            {[
              ["Total flows", String(summary.total)],
              ["Compliant", String(summary.compliant)],
              ["Violations", String(summary.violations)],
              ["Warnings", String(summary.warnings)],
              ["PHI in transit today", summary.inTransit.toLocaleString()],
            ].map(r => (
              <div key={r[0]} className="flex justify-between">
                <span className="text-tertiary">{r[0]}</span>
                <span className="tabular font-medium text-primary">{r[1]}</span>
              </div>
            ))}
          </div>
          <Btn variant="outline" className="mt-4 w-full" onClick={() => navigate("/risks")}>
            View risk register
            <AppIcon name="chevronRight" size="sm" />
          </Btn>
        </Card>
      </div>

      {/* Node drawer — only fields the API actually returns. */}
      <SlideOver open={!!selected} onClose={() => setSelected(null)} title={selected?.name} width={380}>
        {selected && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <EntityAvatar
                icon="asset"
                tone={selected.status === "ok" ? "success" : selected.status === "warn" ? "warning" : "danger"}
                size="lg"
              />
              <div>
                <Badge tone={selected.status === "ok" ? "success" : selected.status === "warn" ? "warning" : "danger"}>
                  {selected.status === "ok" ? "Compliant" : selected.status === "warn" ? "Warning" : "Violation"}
                </Badge>
                <p className="mt-1.5 text-body-sm text-tertiary">
                  {selected.records.toLocaleString()} PHI records/day
                </p>
              </div>
            </div>

            <FieldGroup>
              <Field label="Records / day" value={selected.records.toLocaleString()} />
              <Field
                label="Encryption"
                value={
                  selected.encryption === "AES-256"
                    ? <Badge tone="success">AES-256</Badge>
                    : <Badge tone="danger">Unencrypted</Badge>
                }
              />
            </FieldGroup>

            <FieldGroup title={`PHI categories on this node (${phiForNode.length})`}>
              {phiForNode.length === 0 ? (
                <p className="py-2 text-body-sm text-quaternary">
                  No flow records reference this node.
                </p>
              ) : (
                phiForNode.map((f, i) => (
                  <Field
                    key={`${f.source}-${f.target}-${f.phiType}-${i}`}
                    label={f.phiType}
                    value={
                      <span className="flex items-center justify-end gap-2">
                        <span className="tabular text-tertiary">{f.recordsPerDay.toLocaleString()}/day</span>
                        {!f.encrypted && <Badge tone="danger">Unencrypted</Badge>}
                      </span>
                    }
                  />
                ))
              )}
            </FieldGroup>

            <Btn variant="outline" className="w-full" onClick={() => navigate("/access")}>
              Review who can reach this
            </Btn>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
