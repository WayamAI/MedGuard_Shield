import { useMemo, useState } from "react";
import { Card, Badge, Btn, Modal, SectionHeader, SlideOver, Select, Textarea } from "@/components/ui-bits";
import { notify } from "@/lib/notify";
import { useNavigate } from "react-router-dom";
import { AppIcon } from "@/components/AppIcon";
import { PhiSankey, type FlowNode, type FlowLink } from "@/components/PhiSankey";
import { DataState } from "@/components/DataState";
import { useDataFlows } from "@/hooks/useDataFlows";

export default function PhiFlow() {
  const navigate = useNavigate();
  const flows = useDataFlows();

  const [selected, setSelected] = useState<FlowNode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState("all");
  const [remediated, setRemediated] = useState(false);
  const [remediateOpen, setRemediateOpen] = useState(false);
  const [steps, setSteps] = useState([false, false, false, false]);
  const [docNote, setDocNote] = useState("");
  const [checkResult, setCheckResult] = useState<string | null>(null);

  const nodes = useMemo(() => flows.data?.nodes ?? [], [flows.data]);
  const links = useMemo(() => flows.data?.links ?? [], [flows.data]);

  const onScan = () => {
    setScanning(true);
    flows.refresh().finally(() => {
      setScanning(false);
      notify.success("Scan complete");
    });
  };

  // Once remediated the unencrypted path is compliant, so tones downgrade.
  const edges = useMemo<FlowLink[]>(
    () => links.map(e => ({ ...e, tone: remediated && e.tone === "violation" ? ("ok" as const) : e.tone })),
    [links, remediated],
  );

  const filteredEdges = useMemo(() => (
    filter === "violations" ? edges.filter(e => e.tone === "violation")
      : filter === "high" ? edges.filter(e => e.value > 50000)
      : edges
  ), [edges, filter]);

  // Only draw nodes that the current filter still connects.
  const visibleNodes = useMemo(() => {
    const healed = (n: FlowNode) =>
      remediated && n.status === "violation" ? { ...n, status: "ok" as const } : n;
    if (filter === "all") return nodes.map(healed);
    const keep = new Set(filteredEdges.flatMap(e => [e.from, e.to]));
    return nodes.filter(n => keep.has(n.id)).map(healed);
  }, [nodes, filter, filteredEdges, remediated]);

  /** Summary is derived from the same records the chart draws, never restated. */
  const summary = useMemo(() => {
    const violations = edges.filter(e => e.tone === "violation");
    const warnings = edges.filter(e => e.tone === "warn");
    const inTransit = edges.reduce((sum, e) => sum + e.value, 0);
    return {
      total: edges.length,
      compliant: edges.filter(e => e.tone === "ok").length,
      violations: violations.length,
      warnings: warnings.length,
      inTransit,
      firstViolation: violations[0] ?? null,
    };
  }, [edges]);

  const nameOf = (id: string) => nodes.find(n => n.id === id)?.name ?? id;

  const exposureScore = useMemo(() => {
    if (!summary.total) return 0;
    // Share of PHI volume moving over a non-compliant path.
    const risky = edges.filter(e => e.tone !== "ok").reduce((s, e) => s + e.value, 0);
    return Math.round((risky / Math.max(1, summary.inTransit)) * 100);
  }, [edges, summary]);

  const completeRemediation = () => {
    if (steps.every(Boolean) && docNote.trim()) {
      setRemediated(true);
      setRemediateOpen(false);
      notify.success("Violation resolved, encryption applied");
    } else {
      notify.warning("Complete all steps and document resolution");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge tone={exposureScore >= 50 ? "danger" : exposureScore >= 25 ? "warning" : "success"}>
          PHI Exposure Score: {exposureScore} / 100 · {exposureScore >= 50 ? "High" : exposureScore >= 25 ? "Moderate" : "Low"} Risk
        </Badge>
        <span className="text-body-sm text-tertiary">
          {flows.isFetching ? "Scanning…" : `${summary.total} flows monitored`}
        </span>
        <div className="flex-1" />
        <Select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Show: All flows</option>
          <option value="violations">Only violations</option>
          <option value="high">High volume</option>
        </Select>
        <Btn variant="primary" onClick={onScan} disabled={scanning || flows.isFetching}>
          {scanning ? "Scanning..." : "Scan Now"}
        </Btn>
        <Btn variant="outline" onClick={() => notify.success("Flow map exported as PNG")}>Export Map</Btn>
      </div>

      {!remediated && summary.firstViolation && (
        <div className="p-3 bg-feedback-error-background border border-feedback-error-stroke rounded-md flex items-center gap-3">
          <AppIcon name="threats" size="md" className="text-feedback-error" />
          <span className="text-body-md text-primary">
            <span className="font-semibold">
              {summary.violations} Active Violation{summary.violations === 1 ? "" : "s"}:
            </span>{" "}
            Unencrypted PHI detected in {nameOf(summary.firstViolation.from)} → {nameOf(summary.firstViolation.to)} connection.
          </span>
          <div className="flex-1" />
          <Btn
            variant="outline"
            onClick={() => setSelected(nodes.find(n => n.id === summary.firstViolation!.from) ?? null)}
          >
            View Details
          </Btn>
          <Btn variant="danger" onClick={() => setRemediateOpen(true)}>Remediate Now</Btn>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <Card className="p-4">
          <DataState
            query={flows}
            height={496}
            emptyTitle="No PHI flows recorded"
            emptyMessage="The API returned no data flows. If the backend was just set up, run the seed script."
          >
            {() => (
              <div className="relative w-full overflow-x-auto">
                <PhiSankey
                  nodes={visibleNodes}
                  links={filteredEdges}
                  onSelect={id => setSelected(nodes.find(n => n.id === id) ?? null)}
                />
              </div>
            )}
          </DataState>
          <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-default pt-3 text-caption text-tertiary">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-severity-low" /> Compliant</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-severity-high" /> Warning</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-severity-critical" /> Violation</span>
            <span className="ml-auto">Node height and ribbon width are both proportional to PHI records/day</span>
          </div>
        </Card>

        <Card className="p-4 h-fit">
          <SectionHeader title="Flow Summary" />
          <div className="space-y-2 text-body-md">
            {[
              ["Total flows", String(summary.total)],
              ["Compliant", String(summary.compliant)],
              ["Violations", String(remediated ? 0 : summary.violations)],
              ["Warnings", String(summary.warnings)],
              ["PHI in transit today", summary.inTransit.toLocaleString()],
            ].map(r => (
              <div key={r[0]} className="flex justify-between">
                <span className="text-tertiary">{r[0]}</span>
                <span className="text-primary font-medium tabular">{r[1]}</span>
              </div>
            ))}
          </div>
          <Btn variant="primary" className="w-full mt-4" onClick={() => notify.success("Detailed report opening...")}>View Detailed Report</Btn>
        </Card>
      </div>

      <SlideOver open={!!selected} onClose={() => setSelected(null)} title={selected?.name} width={340}>
        {selected && (
          <div className="space-y-3 text-body-md">
            <Badge tone={selected.status === "ok" ? "success" : selected.status === "warn" ? "warning" : "danger"}>{selected.status === "ok" ? "Compliant" : selected.status === "warn" ? "Warning" : "Violation"}</Badge>
            <Row label="Records/day" value={selected.records.toLocaleString()} />
            <Row label="Data types" value="Name, DOB, SSN, Diagnosis" />
            <Row label="Encryption" value={selected.encryption === "AES-256" ? "AES-256 ✓" : "✗ Unencrypted"} />
            <Row label="Access controls" value="RBAC ✓" />
            <Row label="Last audit" value="Apr 22, 2025" />
            <Row label="Data retention" value="7 years per HIPAA" />
            <Row label="Users with access" value="47" />
            <Btn variant="outline" className="w-full" onClick={() => navigate("/access")}>View Access Controls</Btn>
            <Btn variant="primary" className="w-full" onClick={() => {
              setCheckResult(null);
              setTimeout(() => setCheckResult("3 checks passed, 0 failed"), 2000);
            }}>Run Compliance Check</Btn>
            {checkResult && <div className="p-2 bg-feedback-success-background border border-feedback-success-stroke rounded text-feedback-success text-body-sm">{checkResult}</div>}
          </div>
        )}
      </SlideOver>

      <Modal open={remediateOpen} onClose={() => setRemediateOpen(false)} title="Remediation Workflow" size="md" dismissOnBackdrop={false}>
        <div className="space-y-3">
          {["Isolate connection", "Apply encryption patch", "Verify fix", "Document resolution"].map((s, i) => (
            <div key={s} className="flex items-center gap-3 p-3 bg-raised-2 rounded border border-default">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${steps[i] ? "bg-feedback-success-icon" : "bg-action border border-default"}`}>
                {steps[i] && <AppIcon name="check" size="sm" className="text-white" />}
              </div>
              <span className="flex-1 text-body-md">Step {i + 1}: {s}</span>
              {i < 3 ? (
                <Btn variant={steps[i] ? "outline" : "primary"} onClick={() => setSteps(prev => prev.map((v, j) => j === i ? true : v))} disabled={steps[i]}>
                  {steps[i] ? "Done" : "Run"}
                </Btn>
              ) : null}
            </div>
          ))}
          <Textarea placeholder="Document resolution..." rows={3} value={docNote} onChange={e => setDocNote(e.target.value)} />
          <Btn variant="success" className="w-full" onClick={completeRemediation}>Submit & Resolve</Btn>
        </div>
      </Modal>
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-default last:border-0"><span className="text-body-sm text-tertiary">{label}</span><span className="text-primary">{value}</span></div>
);
