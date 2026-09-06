import { useMemo, useState } from "react";
import { Card, Badge, Btn, Modal, SectionHeader, SlideOver, Select, Textarea } from "@/components/ui-bits";
import { notify } from "@/lib/notify";
import { useNavigate } from "react-router-dom";
import { AppIcon } from "@/components/AppIcon";
import { PhiSankey } from "@/components/PhiSankey";

type Node = {
  id: string; name: string; stage: number; status: "ok" | "violation" | "warn";
  records: number; encryption: "AES-256" | "Unencrypted"; main?: boolean;
};

/** Stage: 0 ingress, 1 core, 2 downstream systems, 3 external recipients. */
const NODES: Node[] = [
  { id: "portal", name: "Patient Portal", stage: 0, status: "ok", records: 12400, encryption: "AES-256" },
  { id: "pharm", name: "Pharmacy System", stage: 0, status: "ok", records: 38900, encryption: "AES-256" },
  { id: "epic", name: "Epic EHR Core", stage: 1, status: "ok", records: 412000, encryption: "AES-256", main: true },
  { id: "lab", name: "Lab Module", stage: 2, status: "ok", records: 64200, encryption: "AES-256" },
  { id: "rad", name: "Radiology PACS", stage: 2, status: "warn", records: 51200, encryption: "AES-256" },
  { id: "billing", name: "Billing Engine", stage: 2, status: "violation", records: 87100, encryption: "Unencrypted" },
  { id: "extlab", name: "External Lab API", stage: 3, status: "ok", records: 18800, encryption: "AES-256" },
  { id: "ai", name: "AI Diagnostic Model", stage: 3, status: "warn", records: 22400, encryption: "AES-256" },
  { id: "ins", name: "Insurance Gateway", stage: 3, status: "violation", records: 71300, encryption: "Unencrypted" },
];

/** `value` is PHI records/day moving across the link; it drives ribbon width. */
type Edge = { from: string; to: string; value: number; tone: "ok" | "warn" | "violation" };
const EDGES: Edge[] = [
  { from: "portal", to: "epic", value: 12400, tone: "ok" },
  { from: "pharm", to: "epic", value: 38900, tone: "ok" },
  { from: "epic", to: "lab", value: 64200, tone: "ok" },
  { from: "epic", to: "rad", value: 51200, tone: "warn" },
  { from: "epic", to: "billing", value: 87100, tone: "violation" },
  { from: "lab", to: "extlab", value: 18800, tone: "ok" },
  { from: "rad", to: "ai", value: 22400, tone: "warn" },
  { from: "billing", to: "ins", value: 71300, tone: "violation" },
];

export default function PhiFlow() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Node | null>(null);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState("all");
  const [remediated, setRemediated] = useState(false);
  const [remediateOpen, setRemediateOpen] = useState(false);
  const [steps, setSteps] = useState([false, false, false, false]);
  const [docNote, setDocNote] = useState("");
  const [checkResult, setCheckResult] = useState<string | null>(null);

  const onScan = () => {
    setScanning(true);
    setTimeout(() => { setScanning(false); notify.success("Scan complete, 1 issue detected"); }, 2000);
  };

  // Once remediated the unencrypted path is compliant, so tones downgrade.
  const edges = useMemo(
    () => EDGES.map(e => ({ ...e, tone: remediated && e.tone === "violation" ? ("ok" as const) : e.tone })),
    [remediated],
  );
  const filteredEdges = useMemo(() => (
    filter === "violations" ? edges.filter(e => e.tone === "violation")
      : filter === "high" ? edges.filter(e => e.value > 50000)
      : edges
  ), [edges, filter]);

  // Only draw nodes that the current filter still connects.
  const visibleNodes = useMemo(() => {
    if (filter === "all") return NODES.map(n => remediated && n.status === "violation" ? { ...n, status: "ok" as const } : n);
    const keep = new Set(filteredEdges.flatMap(e => [e.from, e.to]));
    return NODES.filter(n => keep.has(n.id)).map(n => remediated && n.status === "violation" ? { ...n, status: "ok" as const } : n);
  }, [filter, filteredEdges, remediated]);

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
        <Badge tone="success">PHI Exposure Score: 23 / 100 · Low Risk</Badge>
        <span className="text-body-sm text-tertiary">Last scanned: 4 minutes ago</span>
        <div className="flex-1" />
        <Select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Show: All flows</option>
          <option value="violations">Only violations</option>
          <option value="high">High volume</option>
        </Select>
        <Btn variant="primary" onClick={onScan} disabled={scanning}>{scanning ? "Scanning..." : "Scan Now"}</Btn>
        <Btn variant="outline" onClick={() => notify.success("Flow map exported as PNG")}>Export Map</Btn>
      </div>

      {!remediated && (
        <div className="p-3 bg-feedback-error-background border border-feedback-error-stroke rounded-md flex items-center gap-3">
          <AppIcon name="threats" size="md" className="text-feedback-error" />
          <span className="text-body-md text-primary"><span className="font-semibold">1 Active Violation:</span> Unencrypted PHI detected in Billing → Insurance Gateway connection.</span>
          <div className="flex-1" />
          <Btn variant="outline" onClick={() => setSelected(NODES.find(n => n.id === "billing")!)}>View Details</Btn>
          <Btn variant="danger" onClick={() => setRemediateOpen(true)}>Remediate Now</Btn>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <Card className="p-4">
          <div className="relative w-full overflow-x-auto">
            <PhiSankey
              nodes={visibleNodes}
              links={filteredEdges}
              onSelect={(id) => setSelected(NODES.find(n => n.id === id) ?? null)}
            />
          </div>
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
            {[["Total flows", "9"], ["Compliant", "7"], ["Violations", remediated ? "0" : "1"], ["Warnings", "1"], ["PHI in transit today", "847,293"], ["Peak transfer", "2:00-3:00 AM"]].map(r => (
              <div key={r[0]} className="flex justify-between"><span className="text-tertiary">{r[0]}</span><span className="text-primary font-medium">{r[1]}</span></div>
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
