import { useState } from "react";
import { Card, Badge, Btn, Modal, SectionHeader, SlideOver, Select, Textarea } from "@/components/ui-bits";
import { notify } from "@/lib/notify";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check } from "lucide-react";

type Node = { id: string; name: string; x: number; y: number; status: "ok" | "violation" | "warn"; records: number; encryption: "AES-256" | "Unencrypted"; main?: boolean };

const NODES: Node[] = [
  { id: "portal", name: "Patient Portal", x: 600, y: 40, status: "ok", records: 12400, encryption: "AES-256" },
  { id: "epic", name: "Epic EHR — Core", x: 600, y: 200, status: "ok", records: 412000, encryption: "AES-256", main: true },
  { id: "lab", name: "Lab Module", x: 200, y: 360, status: "ok", records: 64200, encryption: "AES-256" },
  { id: "rad", name: "Radiology PACS", x: 460, y: 360, status: "warn", records: 51200, encryption: "AES-256" },
  { id: "pharm", name: "Pharmacy System", x: 720, y: 360, status: "ok", records: 38900, encryption: "AES-256" },
  { id: "billing", name: "Billing Engine", x: 980, y: 360, status: "violation", records: 87100, encryption: "Unencrypted" },
  { id: "ins", name: "Insurance Gateway", x: 980, y: 520, status: "violation", records: 71300, encryption: "Unencrypted" },
  { id: "ai", name: "AI Diagnostic Model", x: 460, y: 520, status: "warn", records: 22400, encryption: "AES-256" },
  { id: "extlab", name: "External Lab API", x: 200, y: 520, status: "ok", records: 18800, encryption: "AES-256" },
];

type Edge = { from: string; to: string; tone: "ok" | "warn" | "violation" };
const EDGES: Edge[] = [
  { from: "portal", to: "epic", tone: "ok" },
  { from: "pharm", to: "epic", tone: "ok" },
  { from: "epic", to: "lab", tone: "ok" },
  { from: "epic", to: "rad", tone: "ok" },
  { from: "epic", to: "billing", tone: "violation" },
  { from: "billing", to: "ins", tone: "violation" },
  { from: "rad", to: "ai", tone: "warn" },
  { from: "lab", to: "extlab", tone: "ok" },
];

const colors = { ok: "#3B82F6", warn: "#F59E0B", violation: "#EF4444" };

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
    setTimeout(() => { setScanning(false); notify.success("Scan complete — 1 issue detected"); }, 2000);
  };

  const filteredEdges = filter === "violations" ? EDGES.filter(e => e.tone === "violation") : filter === "high" ? EDGES.filter(e => {
    const f = NODES.find(n => n.id === e.from)!; return f.records > 50000;
  }) : EDGES;

  const nodePos = (id: string) => NODES.find(n => n.id === id)!;

  const completeRemediation = () => {
    if (steps.every(Boolean) && docNote.trim()) {
      setRemediated(true);
      setRemediateOpen(false);
      notify.success("Violation resolved — encryption applied");
    } else {
      notify.warning("Complete all steps and document resolution");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge tone="success">PHI Exposure Score: 23 / 100 — Low Risk</Badge>
        <span className="text-xs text-muted-foreground">Last scanned: 4 minutes ago</span>
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
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-400" />
          <span className="text-sm text-foreground"><span className="font-semibold">1 Active Violation:</span> Unencrypted PHI detected in Billing → Insurance Gateway connection.</span>
          <div className="flex-1" />
          <Btn variant="outline" onClick={() => setSelected(NODES.find(n => n.id === "billing")!)}>View Details</Btn>
          <Btn variant="danger" onClick={() => setRemediateOpen(true)}>Remediate Now</Btn>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <Card className="p-4">
          <div className="relative w-full overflow-x-auto">
            <svg viewBox="0 0 1180 620" className="w-full h-[600px]">
              {filteredEdges.map((e, i) => {
                const a = nodePos(e.from), b = nodePos(e.to);
                const tone = remediated && e.tone === "violation" ? "ok" : e.tone;
                const color = colors[tone];
                return (
                  <g key={i}>
                    <line x1={a.x + 80} y1={a.y + 30} x2={b.x + 80} y2={b.y + 30} stroke={color} strokeWidth={tone === "violation" ? 2.5 : 1.5} className={`dash-flow ${tone === "violation" ? "pulse-red" : ""}`} markerEnd={`url(#arrow-${tone})`} />
                  </g>
                );
              })}
              <defs>
                {(["ok", "warn", "violation"] as const).map(t => (
                  <marker key={t} id={`arrow-${t}`} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L9,3 z" fill={colors[t]} />
                  </marker>
                ))}
              </defs>

              {NODES.map(n => {
                const tone = remediated && n.status === "violation" ? "ok" : n.status;
                const stroke = colors[tone];
                return (
                  <g key={n.id} transform={`translate(${n.x},${n.y})`} className="cursor-pointer" onClick={() => setSelected(n)}>
                    <rect width="160" height="60" rx="8" fill="hsl(var(--card))" stroke={stroke} strokeWidth={n.main ? 2.5 : 1.5} />
                    <circle cx="14" cy="14" r="4" fill={stroke} />
                    <text x="26" y="20" fill="hsl(var(--foreground))" fontSize="12" fontWeight="600">{n.name}</text>
                    <text x="14" y="38" fill="hsl(var(--muted-foreground))" fontSize="10">{n.records.toLocaleString()} PHI rec/day</text>
                    <rect x="14" y="44" width={n.encryption === "AES-256" ? 56 : 78} height="13" rx="3" fill={n.encryption === "AES-256" ? "#10B98122" : "#EF444422"} stroke={n.encryption === "AES-256" ? "#10B981" : "#EF4444"} strokeWidth="0.5" />
                    <text x={n.encryption === "AES-256" ? 18 : 18} y="53" fill={n.encryption === "AES-256" ? "#10B981" : "#EF4444"} fontSize="9" fontWeight="600">{n.encryption === "AES-256" ? "AES-256" : "⚠ Unencrypted"}</text>
                  </g>
                );
              })}

              {!remediated && (
                <g transform="translate(990,460)">
                  <rect width="180" height="40" rx="6" fill="hsl(var(--destructive) / 0.26)" stroke="#EF4444" />
                  <text x="10" y="17" fill="hsl(var(--destructive))" fontSize="10" fontWeight="700">⚠ Unencrypted: patient_ssn</text>
                  <text x="10" y="32" fill="hsl(var(--foreground))" fontSize="9" fontWeight="500">3 records exposed</text>
                </g>
              )}
            </svg>
          </div>
          <div className="flex items-center gap-4 pt-3 border-t border-border mt-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Compliant</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Warning</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Violation</span>
            <span className="ml-auto">Line thickness ∝ data volume</span>
          </div>
        </Card>

        <Card className="p-4 h-fit">
          <SectionHeader title="Flow Summary" />
          <div className="space-y-2 text-sm">
            {[["Total flows", "9"], ["Compliant", "7"], ["Violations", remediated ? "0" : "1"], ["Warnings", "1"], ["PHI in transit today", "847,293"], ["Peak transfer", "2:00–3:00 AM"]].map(r => (
              <div key={r[0]} className="flex justify-between"><span className="text-muted-foreground">{r[0]}</span><span className="text-foreground font-medium">{r[1]}</span></div>
            ))}
          </div>
          <Btn variant="primary" className="w-full mt-4" onClick={() => notify.success("Detailed report opening...")}>View Detailed Report</Btn>
        </Card>
      </div>

      <SlideOver open={!!selected} onClose={() => setSelected(null)} title={selected?.name} width={340}>
        {selected && (
          <div className="space-y-3 text-sm">
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
            {checkResult && <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 text-xs">{checkResult}</div>}
          </div>
        )}
      </SlideOver>

      <Modal open={remediateOpen} onClose={() => setRemediateOpen(false)} title="Remediation Workflow" size="md" dismissOnBackdrop={false}>
        <div className="space-y-3">
          {["Isolate connection", "Apply encryption patch", "Verify fix", "Document resolution"].map((s, i) => (
            <div key={s} className="flex items-center gap-3 p-3 bg-secondary/40 rounded border border-border">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${steps[i] ? "bg-emerald-500" : "bg-secondary border border-border"}`}>
                {steps[i] && <Check size={14} className="text-white" />}
              </div>
              <span className="flex-1 text-sm">Step {i + 1}: {s}</span>
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
  <div className="flex justify-between items-center py-1.5 border-b border-border last:border-0"><span className="text-xs text-muted-foreground">{label}</span><span className="text-foreground">{value}</span></div>
);
