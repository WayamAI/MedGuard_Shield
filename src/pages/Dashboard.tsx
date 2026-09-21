import { useNavigate } from "react-router-dom";
import { AppIcon } from "@/components/AppIcon";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  Card, KPI, Badge, Btn, Gauge, Modal, SectionHeader, Textarea, Select, Input, FilterChip,
} from "@/components/ui-bits";
import { toneVar, riskTone, type Tone } from "@/lib/tone";
import type { IconName } from "@/lib/icons";
import { frameworks, departmentRisks, activitySamples } from "@/data/mock";
import { useStore } from "@/store/AppStore";
import { useAssets } from "@/hooks/useAssets";
import { useRisks } from "@/hooks/useRisks";
import { useDataFlows } from "@/hooks/useDataFlows";
import { notify } from "@/lib/notify";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

/** Composite governance score and the sub-scores that make up its status bar. */
const HEALTH_SCORE = 94;
const HEALTH_PERIODS = ["7d", "30d", "90d"] as const;
const HEALTH_SEGMENTS: { label: string; value: number; tone: Tone }[] = [
  { label: "Data Protection", value: 97, tone: "success" },
  { label: "Access Control", value: 91, tone: "success" },
  { label: "AI Governance", value: 82, tone: "warning" },
];

/** Alert severity -> feedback tone. */
const sevTone = (sev: string): Tone =>
  sev === "CRITICAL" ? "danger" : sev === "HIGH" ? "warning" : "info";

type Framework = (typeof frameworks)[number];

type QuickAction = "report" | "risk" | "approvals" | "export";
const QUICK_ACTIONS: { icon: IconName; label: string; action: QuickAction }[] = [
  { icon: "audit", label: "Generate Compliance Report", action: "report" },
  { icon: "search", label: "Run Risk Assessment", action: "risk" },
  { icon: "clock", label: "Review Pending Approvals", action: "approvals" },
  { icon: "download", label: "Export Audit Trail", action: "export" },
];

function FrameworkReportModal({ fw, onClose }: { fw: Framework | null; onClose: () => void }) {
  const [tab, setTab] = useState<"summary" | "controls" | "evidence">("summary");
  return (
    <Modal open={!!fw} onClose={onClose} title={fw && `${fw.name} Compliance Report`} size="lg">
      {fw && (
        <>
          <div className="flex gap-1 border-b border-default mb-4">
            {(["summary", "controls", "evidence"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-body-md capitalize border-b-2 ${tab === t ? "border-brand text-primary" : "border-transparent text-tertiary hover:text-primary"}`}>{t}</button>
            ))}
          </div>
          {tab === "summary" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="flex justify-center"><Gauge value={fw.score} size={140} tone={fw.tone as Tone} /></div>
              <div className="col-span-2 space-y-3">
                <div>
                  <div className="text-body-sm uppercase text-tertiary mb-1">Top passing areas</div>
                  <ul className="text-body-md space-y-1 text-primary">
                    <li>• Encryption at rest (100%)</li>
                    <li>• Access logging (98%)</li>
                    <li>• MFA enforcement (95%)</li>
                  </ul>
                </div>
                <div>
                  <div className="text-body-sm uppercase text-tertiary mb-1">Top failing areas</div>
                  <ul className="text-body-md space-y-1 text-primary">
                    <li>• Incident response testing</li>
                    <li>• Vendor risk assessment</li>
                    <li>• AI model validation</li>
                  </ul>
                </div>
                <div className="text-body-sm text-tertiary">Last auditor: <span className="text-primary">PwC Cyber Assurance</span></div>
                <div className="text-body-sm text-tertiary">Next steps: schedule remediation review, prepare evidence package.</div>
              </div>
            </div>
          )}
          {tab === "controls" && (
            <table className="w-full text-body-sm">
              <thead className="text-body-sm uppercase text-tertiary"><tr><th className="text-left py-2">Control</th><th className="text-left">Status</th><th className="text-left">Last checked</th></tr></thead>
              <tbody>
                {[["Encryption at rest", "Passing", "Today"], ["MFA enforcement", "Passing", "Today"], ["Access log retention", "Passing", "Yesterday"], ["Incident response test", "Failing", "30 days ago"], ["AI validation", "In Review", "3 days ago"]].map(r => (
                  <tr key={r[0]} className="border-t border-default"><td className="py-2">{r[0]}</td><td><Badge tone={r[1] === "Passing" ? "success" : r[1] === "Failing" ? "danger" : "warning"}>{r[1]}</Badge></td><td className="text-tertiary">{r[2]}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "evidence" && (
            <ul className="space-y-2">
              {["evidence_encryption_q1.pdf", "access_logs_2025-04.csv", "mfa_audit_export.json", "incident_drill_report.pdf"].map(f => (
                <li key={f} className="flex items-center justify-between p-3 bg-raised-2 rounded border border-default">
                  <span className="text-body-md text-primary">{f}</span>
                  <Btn variant="outline" onClick={() => notify.success("Evidence package downloaded")}><AppIcon name="download" size="xs" /> Download</Btn>
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
          <div><label className="text-body-sm text-tertiary">Scope</label><Select className="w-full mt-1"><option>All departments</option><option>Single department</option></Select></div>
          <div><label className="text-body-sm text-tertiary">Assessment type</label><Select className="w-full mt-1"><option>Full HIPAA scan</option><option>SOC 2 readiness</option><option>AI governance</option></Select></div>
          <Btn variant="primary" className="w-full" onClick={() => setPhase("run")}>Run Assessment</Btn>
        </div>
      )}
      {phase === "run" && (
        <div className="py-6">
          <p className="text-body-md text-tertiary mb-3">Running assessment across 47 controls...</p>
          <div className="h-2 bg-action rounded overflow-hidden"><div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div>
          <p className="text-body-sm text-tertiary mt-2">{progress}%</p>
        </div>
      )}
      {phase === "done" && (
        <div>
          <div className="text-body-md text-primary mb-3">✓ 47 controls tested, <span className="text-feedback-warning font-semibold">3 issues</span> found</div>
          <ul className="space-y-2 mb-4">
            <li className="p-2 bg-raised-2 rounded text-body-sm">⚠ C-006 Incident response test: failing</li>
            <li className="p-2 bg-raised-2 rounded text-body-sm">⚠ C-005 Vendor risk assessment: overdue</li>
            <li className="p-2 bg-raised-2 rounded text-body-sm">⚠ Unencrypted PHI in Billing → Insurance gateway</li>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div><label className="text-body-sm text-tertiary">From</label><Input type="date" defaultValue="2025-04-01" className="w-full" /></div>
          <div><label className="text-body-sm text-tertiary">To</label><Input type="date" defaultValue="2025-05-05" className="w-full" /></div>
        </div>
        <Btn variant="primary" className="w-full" onClick={() => { onClose(); notify.success("Audit trail exported, downloading audit_trail_2025.csv"); }}>
          <AppIcon name="download" size="xs" /> Export CSV
        </Btn>
      </div>
    </Modal>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { alerts, resolveAlert } = useStore();

  /* Summary figures are computed client-side from the three read endpoints
     rather than a dedicated aggregate route, per the demo's scope. */
  const assets = useAssets();
  const risks = useRisks();
  const flows = useDataFlows();

  const summary = useMemo(() => {
    const riskRows = risks.data ?? [];
    const byBand = (b: string) => riskRows.filter(r => r.band === b).length;
    const links = flows.data?.links ?? [];
    return {
      assetCount: assets.data?.length,
      severe: risks.data ? byBand("extreme") + byBand("critical") : undefined,
      severeTrend: risks.data
        ? `${byBand("extreme")} extreme · ${byBand("critical")} critical`
        : undefined,
      phiPerDay: flows.data ? links.reduce((sum, l) => sum + l.value, 0) : undefined,
      unencrypted: flows.data ? links.filter(l => l.tone === "violation").length : undefined,
      flowCount: links.length,
    };
  }, [assets.data, risks.data, flows.data]);
  const [reportFw, setReportFw] = useState<Framework | null>(null);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [runRiskOpen, setRunRiskOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [healthPeriod, setHealthPeriod] = useState<(typeof HEALTH_PERIODS)[number]>("30d");
  const recent = alerts.slice(0, 5);

  const runQuickAction = (action: QuickAction) => {
    if (action === "report") setReportFw(frameworks[0]);
    else if (action === "risk") setRunRiskOpen(true);
    else if (action === "approvals") navigate("/policy", { state: { tab: "approvals" } });
    else setExportOpen(true);
  };

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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPI
          icon="server" label="Assets Monitored"
          value={summary.assetCount?.toLocaleString()}
          trend={summary.assetCount !== undefined ? `${summary.flowCount} PHI flows mapped` : undefined}
          accent="info" loading={assets.isLoading} stale={assets.isReconnecting}
        />
        <KPI
          icon="threats" label="Critical or Extreme"
          value={summary.severe !== undefined ? String(summary.severe) : undefined}
          trend={summary.severeTrend}
          accent="danger" loading={risks.isLoading} stale={risks.isReconnecting}
          onClick={() => navigate("/risks")}
        />
        <KPI
          icon="database" label="PHI Records / Day"
          value={summary.phiPerDay?.toLocaleString()}
          trend={summary.phiPerDay !== undefined ? "across all mapped flows" : undefined}
          accent="info" loading={flows.isLoading} stale={flows.isReconnecting}
          onClick={() => navigate("/phi-flow")}
        />
        <KPI
          icon="unlocked" label="Unencrypted Flows"
          value={summary.unencrypted !== undefined ? String(summary.unencrypted) : undefined}
          trend={summary.unencrypted !== undefined ? `of ${summary.flowCount} total` : undefined}
          accent={summary.unencrypted ? "danger" : "success"}
          loading={flows.isLoading} stale={flows.isReconnecting}
          onClick={() => navigate("/phi-flow")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionHeader title="Compliance Frameworks" subtitle="Active frameworks across Meridian Health" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {frameworks.map(fw => (
              <div key={fw.name} className="flex gap-4 rounded-lg border border-default bg-raised-2 p-4 transition-colors duration-200 hover:border-active">
                <div className="h-10 w-10 flex-shrink-0 rounded-md" style={{ background: toneVar(fw.tone as Tone), opacity: 0.18 }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-heading-sm text-primary">{fw.name}</div>
                      <div className="tabular mt-0.5 text-caption text-tertiary">{fw.controls} controls passing</div>
                    </div>
                    <Gauge value={fw.score} size={56} tone={fw.tone as Tone} />
                  </div>
                  <div className="tabular mt-2 text-caption text-quaternary">Last: {fw.last}</div>
                  <div className="tabular flex items-center gap-1.5 text-caption text-quaternary">
                    Next: {fw.next} {fw.overdue && <Badge tone="danger">OVERDUE</Badge>}
                  </div>
                  <Btn variant="outline" className="mt-2" onClick={() => setReportFw(fw)}>View Report</Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Primary health card, floating summary over the section. */}
        <Card className="flex flex-col p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-heading-sm text-primary">Governance Health Score</h3>
              <AppIcon
                name="help"
                size="xs"
                className="text-icon-quaternary"
                aria-label="Composite of data protection, access control and AI governance sub-scores"
              />
            </div>
          </div>

          {/* Period control. TODO: wire `healthPeriod` to a real time-range query;
              the underlying score is currently a point-in-time value. */}
          <div className="mt-3 flex gap-1.5">
            {HEALTH_PERIODS.map(p => (
              <FilterChip key={p} selected={healthPeriod === p} onClick={() => setHealthPeriod(p)}>{p}</FilterChip>
            ))}
          </div>

          <div className="mt-4 flex items-end gap-3">
            <span className="font-display text-display-metric tabular leading-none text-primary">{HEALTH_SCORE}</span>
            <div className="pb-1">
              <div className="flex items-center gap-1 text-label-sm text-feedback-success">
                <AppIcon name="trendUp" size="xs" />
                <span className="tabular">+2.1%</span>
              </div>
              <div className="text-caption text-quaternary">vs. previous {healthPeriod}</div>
            </div>
          </div>

          {/* Segmented status bar, one segment per sub-score. */}
          <div className="mt-4 flex h-1.5 gap-1 overflow-hidden rounded-full">
            {HEALTH_SEGMENTS.map(seg => (
              <div key={seg.label} className="h-full flex-1 overflow-hidden rounded-full bg-action">
                <div className="h-full rounded-full" style={{ width: `${seg.value}%`, background: toneVar(seg.tone) }} />
              </div>
            ))}
          </div>

          <ul className="mt-3 space-y-1.5">
            {HEALTH_SEGMENTS.map(seg => (
              <li key={seg.label} className="flex items-center gap-2 text-caption">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: toneVar(seg.tone) }} />
                <span className="flex-1 truncate text-tertiary">{seg.label}</span>
                <span className="tabular text-secondary">{seg.value}%</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-muted pt-4">
            <SectionHeader title="Recent Alerts" />
            <ul className="space-y-2">
              {recent.map(a => (
                <li key={a.id} className={`flex items-center gap-2 text-body-sm ${a.status === "Resolved" ? "line-through opacity-50" : ""}`}>
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: toneVar(sevTone(a.sev)) }} />
                  <span className="flex-1 truncate"><span className="text-primary">{a.type}</span> <span className="text-quaternary">·</span> <span className="text-tertiary">{a.dept}</span></span>
                  <span className="tabular text-caption text-quaternary">{a.time.split(" ").slice(-2).join(" ")}</span>
                  {a.status === "Resolved" ? <Badge tone="success">Resolved</Badge> : <Btn variant="outline" onClick={() => setResolveId(a.id)}>Resolve</Btn>}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate("/threats")} className="mt-3 text-label-sm text-brand transition-colors duration-200 hover:underline">
              See all alerts →
            </button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader title="Department Risk Heat Map" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={departmentRisks} layout="vertical" margin={{ left: 10, right: 30 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "var(--sem-text-tertiary)", fontSize: 11 }} stroke="var(--sem-stroke-default)" />
              <YAxis type="category" dataKey="dept" tick={{ fill: "var(--sem-text-secondary)", fontSize: 11 }} width={120} stroke="var(--sem-stroke-default)" />
              <Tooltip
                cursor={{ fill: "var(--sem-surface-action)" }}
                contentStyle={{
                  backgroundColor: "var(--sem-surface-raised-x2)",
                  color: "var(--sem-text-primary)",
                  border: "1px solid var(--sem-stroke-default)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="risk" radius={[0, 4, 4, 0]} onClick={(d: { dept: string }) => navigate("/risks", { state: { dept: d.dept } })}>
                {departmentRisks.map((d, i) => (
                  <Cell key={i} fill={toneVar(riskTone(d.risk))} cursor="pointer" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Live Activity Feed" action={
            <Btn variant="outline" onClick={() => setPaused(p => !p)}>
              {paused ? <><AppIcon name="play" size="xs" /> Resume</> : <><AppIcon name="pause" size="xs" /> Pause</>}
            </Btn>
          } />
          <ul className="max-h-[280px] space-y-2 overflow-y-auto">
            {feed.map((f, idx) => (
              <li key={f.id} className="fade-in flex items-start gap-2 py-1 text-body-sm">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand" />
                <div className="min-w-0 flex-1">
                  <div>
                    <span className="text-primary">{f.user}</span>{" "}
                    <span className="text-tertiary">{f.action}</span>{" "}
                    <span className="text-primary">{f.res}</span>
                  </div>
                  <div className="tabular text-caption text-quaternary">{idx === 0 ? "just now" : `${idx * 7 + 3}s ago`}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <SectionHeader title="Quick Actions" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map(a => (
            <button
              key={a.label}
              onClick={() => runQuickAction(a.action)}
              className="rounded-lg border border-default bg-raised-2 p-4 text-left transition-colors duration-200 hover:border-active hover:bg-action"
            >
              <AppIcon name={a.icon} size="lg" className="mb-2 text-icon-secondary" />
              <div className="text-label-md text-primary">{a.label}</div>
            </button>
          ))}
        </div>
      </Card>

      <FrameworkReportModal fw={reportFw} onClose={() => setReportFw(null)} />
      <ResolveModal alertId={resolveId} onClose={() => setResolveId(null)} onResolve={(id) => { resolveAlert(id); notify.success("Alert marked as resolved"); }} />
      <RunRiskModal open={runRiskOpen} onClose={() => setRunRiskOpen(false)} />
      <ExportAuditModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
