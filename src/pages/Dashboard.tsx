import { useNavigate } from "react-router-dom";
import { Shield, AlertTriangle, Database, CheckCircle, FileText, Search, Clock, Download, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card, KPI, Badge, Btn, Gauge, Modal, SectionHeader, Textarea, Select, Input } from "@/components/ui-bits";
import { frameworks, departmentRisks, activitySamples } from "@/data/mock";
import { useStore } from "@/store/AppStore";
import { notify } from "@/lib/notify";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

function FrameworkReportModal({ fw, onClose }: { fw: any; onClose: () => void }) {
  const [tab, setTab] = useState<"summary" | "controls" | "evidence">("summary");
  return (
    <Modal open={!!fw} onClose={onClose} title={fw && `${fw.name} Compliance Report`} size="lg">
      {fw && (
        <>
          <div className="flex gap-1 border-b border-border mb-4">
            {(["summary", "controls", "evidence"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm capitalize border-b-2 ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t}</button>
            ))}
          </div>
          {tab === "summary" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="flex justify-center"><Gauge value={fw.score} size={140} color={fw.color} /></div>
              <div className="col-span-2 space-y-3">
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Top passing areas</div>
                  <ul className="text-sm space-y-1 text-foreground">
                    <li>• Encryption at rest (100%)</li>
                    <li>• Access logging (98%)</li>
                    <li>• MFA enforcement (95%)</li>
                  </ul>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Top failing areas</div>
                  <ul className="text-sm space-y-1 text-foreground">
                    <li>• Incident response testing</li>
                    <li>• Vendor risk assessment</li>
                    <li>• AI model validation</li>
                  </ul>
                </div>
                <div className="text-xs text-muted-foreground">Last auditor: <span className="text-foreground">PwC Cyber Assurance</span></div>
                <div className="text-xs text-muted-foreground">Next steps: schedule remediation review, prepare evidence package.</div>
              </div>
            </div>
          )}
          {tab === "controls" && (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-2">Control</th><th className="text-left">Status</th><th className="text-left">Last checked</th></tr></thead>
              <tbody>
                {[["Encryption at rest", "Passing", "Today"], ["MFA enforcement", "Passing", "Today"], ["Access log retention", "Passing", "Yesterday"], ["Incident response test", "Failing", "30 days ago"], ["AI validation", "In Review", "3 days ago"]].map(r => (
                  <tr key={r[0]} className="border-t border-border"><td className="py-2">{r[0]}</td><td><Badge tone={r[1] === "Passing" ? "success" : r[1] === "Failing" ? "danger" : "warning"}>{r[1]}</Badge></td><td className="text-muted-foreground">{r[2]}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "evidence" && (
            <ul className="space-y-2">
              {["evidence_encryption_q1.pdf", "access_logs_2025-04.csv", "mfa_audit_export.json", "incident_drill_report.pdf"].map(f => (
                <li key={f} className="flex items-center justify-between p-3 bg-secondary/50 rounded border border-border">
                  <span className="text-sm text-foreground">{f}</span>
                  <Btn variant="outline" onClick={() => notify.success("Evidence package downloaded")}><Download size={12} /> Download</Btn>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}

function ResolveModal({ alertId, onClose, onResolve }: { alertId: string | null; onClose: () => void; onResolve: (id: string, notes: string) => void }) {
  const [notes, setNotes] = useState("");
  return (
    <Modal open={!!alertId} onClose={onClose} title={`Resolve alert #${alertId}?`} size="sm" dismissOnBackdrop={false}>
      <Textarea placeholder="Resolution notes..." rows={4} value={notes} onChange={e => setNotes(e.target.value)} />
      <div className="flex gap-2 justify-end mt-4">
        <Btn variant="outline" onClick={onClose}>Cancel</Btn>
        <Btn variant="success" onClick={() => { if (alertId) { onResolve(alertId, notes); onClose(); setNotes(""); } }}>Mark Resolved</Btn>
      </div>
    </Modal>
  );
}

function RunRiskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<"form" | "run" | "done">("form");
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (phase === "run") {
      setProgress(0);
      const t = setInterval(() => setProgress(p => Math.min(100, p + 5)), 150);
      const done = setTimeout(() => { setPhase("done"); clearInterval(t); }, 3000);
      return () => { clearInterval(t); clearTimeout(done); };
    }
  }, [phase]);
  const reset = () => { setPhase("form"); setProgress(0); onClose(); };
  return (
    <Modal open={open} onClose={reset} title="Run Risk Assessment" size="md">
      {phase === "form" && (
        <div className="space-y-3">
          <div><label className="text-xs text-muted-foreground">Scope</label><Select className="w-full mt-1"><option>All departments</option><option>Single department</option></Select></div>
          <div><label className="text-xs text-muted-foreground">Assessment type</label><Select className="w-full mt-1"><option>Full HIPAA scan</option><option>SOC 2 readiness</option><option>AI governance</option></Select></div>
          <Btn variant="primary" className="w-full" onClick={() => setPhase("run")}>Run Assessment</Btn>
        </div>
      )}
      {phase === "run" && (
        <div className="py-6">
          <p className="text-sm text-muted-foreground mb-3">Running assessment across 47 controls...</p>
          <div className="h-2 bg-secondary rounded overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
          <p className="text-xs text-muted-foreground mt-2">{progress}%</p>
        </div>
      )}
      {phase === "done" && (
        <div>
          <div className="text-sm text-foreground mb-3">✓ 47 controls tested, <span className="text-amber-400 font-semibold">3 issues</span> found</div>
          <ul className="space-y-2 mb-4">
            <li className="p-2 bg-secondary/50 rounded text-xs">⚠ C-006 Incident response test — failing</li>
            <li className="p-2 bg-secondary/50 rounded text-xs">⚠ C-005 Vendor risk assessment — overdue</li>
            <li className="p-2 bg-secondary/50 rounded text-xs">⚠ Unencrypted PHI in Billing → Insurance gateway</li>
          </ul>
          <Btn variant="primary" onClick={reset}>Close</Btn>
        </div>
      )}
    </Modal>
  );
}

function ExportAuditModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Export Audit Trail" size="sm">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-muted-foreground">From</label><Input type="date" defaultValue="2025-04-01" className="w-full" /></div>
          <div><label className="text-xs text-muted-foreground">To</label><Input type="date" defaultValue="2025-05-05" className="w-full" /></div>
        </div>
        <Btn variant="primary" className="w-full" onClick={() => { onClose(); notify.success("Audit trail exported — downloading audit_trail_2025.csv"); }}>
          <Download size={12} /> Export CSV
        </Btn>
      </div>
    </Modal>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { alerts, resolveAlert } = useStore();
  const [reportFw, setReportFw] = useState<any>(null);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [runRiskOpen, setRunRiskOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const recent = alerts.slice(0, 5);

  // Activity feed
  const [feed, setFeed] = useState(() => activitySamples.slice(0, 8).map((a, i) => ({ ...a, id: i, ts: `${i * 7 + 3}s ago` })));
  const [paused, setPaused] = useState(false);
  const counter = useRef(activitySamples.length);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      const sample = activitySamples[counter.current % activitySamples.length];
      counter.current++;
      setFeed(prev => [{ ...sample, id: counter.current, ts: "just now" }, ...prev.slice(0, 9)]);
    }, 6000);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={<Shield size={18} />} label="Compliance Score" value="94%" trend="+2.1% this week" accent="success" />
        <KPI icon={<AlertTriangle size={18} />} label="Active Alerts" value={String(alerts.filter(a => a.status !== "Resolved").length)} trend="+3 since yesterday" accent="danger" onClick={() => navigate("/threats")} />
        <KPI icon={<Database size={18} />} label="PHI Records Monitored" value="2,401,847" trend="↑ 12,043 today" accent="info" />
        <KPI icon={<CheckCircle size={18} />} label="Controls Passing" value="847 / 901" trend="94% pass rate" accent="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <SectionHeader title="Compliance Frameworks" subtitle="Active frameworks across Meridian Health" />
          <div className="grid grid-cols-2 gap-3">
            {frameworks.map(fw => (
              <div key={fw.name} className="p-4 border border-border rounded-md bg-secondary/30 flex gap-4">
                <div className="w-10 h-10 rounded flex-shrink-0" style={{ background: fw.color, opacity: 0.2 }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{fw.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{fw.controls} controls passing</div>
                    </div>
                    <Gauge value={fw.score} size={56} color={fw.color} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-2">Last: {fw.last}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                    Next: {fw.next} {fw.overdue && <Badge tone="danger">OVERDUE</Badge>}
                  </div>
                  <Btn variant="outline" className="mt-2" onClick={() => setReportFw(fw)}>View Report</Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Governance Health Score" />
          <div className="flex flex-col items-center">
            <Gauge value={94} size={150} color="#10B981" label="Excellent" />
            <Badge tone="success" className="mt-2">Excellent</Badge>
          </div>
          <div className="space-y-2 mt-5">
            {[["Data Protection", 97, "#10B981"], ["Access Control", 91, "#10B981"], ["AI Governance", 82, "#F59E0B"]].map(r => (
              <div key={r[0] as string}>
                <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">{r[0]}</span><span className="text-foreground font-medium">{r[1]}%</span></div>
                <div className="h-1.5 bg-secondary rounded overflow-hidden"><div className="h-full" style={{ width: `${r[1]}%`, background: r[2] as string }} /></div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-border">
            <SectionHeader title="Recent Alerts" />
            <ul className="space-y-2">
              {recent.map(a => (
                <li key={a.id} className={`flex items-center gap-2 text-xs ${a.status === "Resolved" ? "opacity-50 line-through" : ""}`}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.sev === "CRITICAL" ? "#EF4444" : a.sev === "HIGH" ? "#F59E0B" : "#FB923C" }} />
                  <span className="flex-1 truncate"><span className="text-foreground">{a.type}</span> · <span className="text-muted-foreground">{a.dept}</span></span>
                  <span className="text-muted-foreground">{a.time.split(" ").slice(-2).join(" ")}</span>
                  {a.status === "Resolved" ? <Badge tone="success">Resolved</Badge> : <Btn variant="outline" onClick={() => setResolveId(a.id)}>Resolve</Btn>}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate("/threats")} className="text-xs text-primary hover:underline mt-3">View all alerts →</button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionHeader title="Department Risk Heat Map" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={departmentRisks} layout="vertical" margin={{ left: 10, right: 30 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" />
              <YAxis type="category" dataKey="dept" tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} width={120} stroke="hsl(var(--border))" />
              <Tooltip cursor={{ fill: "hsl(var(--border))" }} contentStyle={{ backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
              <Bar dataKey="risk" radius={[0, 4, 4, 0]} onClick={(d: any) => navigate("/risks", { state: { dept: d.dept } })}>
                {departmentRisks.map((d, i) => (
                  <Cell key={i} fill={d.risk > 60 ? "#EF4444" : d.risk > 30 ? "#F59E0B" : "#10B981"} cursor="pointer" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Live Activity Feed" action={
            <Btn variant="outline" onClick={() => setPaused(p => !p)}>{paused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}</Btn>
          } />
          <ul className="space-y-2 max-h-[280px] overflow-y-auto">
            {feed.map((f, idx) => (
              <li key={f.id} className="flex items-start gap-2 text-xs fade-in py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div><span className="text-foreground font-medium">{f.user}</span> <span className="text-muted-foreground">{f.action}</span> <span className="text-foreground">{f.res}</span></div>
                  <div className="text-[10px] text-muted-foreground">{idx === 0 ? "just now" : `${idx * 7 + 3}s ago`}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <SectionHeader title="Quick Actions" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: FileText, label: "Generate Compliance Report", onClick: () => setReportFw(frameworks[0]) },
            { icon: Search, label: "Run Risk Assessment", onClick: () => setRunRiskOpen(true) },
            { icon: Clock, label: "Review Pending Approvals", onClick: () => navigate("/policy", { state: { tab: "approvals" } }) },
            { icon: Download, label: "Export Audit Trail", onClick: () => setExportOpen(true) },
          ].map(a => {
            const Icon = a.icon;
            return (
              <button key={a.label} onClick={a.onClick} className="p-4 border border-border rounded-md bg-secondary/30 hover:bg-secondary hover:border-primary/40 transition-colors text-left">
                <Icon size={18} className="text-primary mb-2" />
                <div className="text-sm font-medium text-foreground">{a.label}</div>
              </button>
            );
          })}
        </div>
      </Card>

      <FrameworkReportModal fw={reportFw} onClose={() => setReportFw(null)} />
      <ResolveModal alertId={resolveId} onClose={() => setResolveId(null)} onResolve={(id) => { resolveAlert(id); notify.success("Alert marked as resolved"); }} />
      <RunRiskModal open={runRiskOpen} onClose={() => setRunRiskOpen(false)} />
      <ExportAuditModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
