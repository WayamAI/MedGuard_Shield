import { useEffect, useMemo, useRef, useState } from "react";
import { Card, KPI, Badge, Btn, Modal, SlideOver, Input, Select, Textarea, SeverityBadge } from "@/components/ui-bits";
import { AlertTriangle, CheckCircle, Clock, Activity } from "lucide-react";
import { useStore } from "@/store/AppStore";
import { notify } from "@/lib/notify";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line } from "recharts";

const sparkData = Array.from({ length: 24 }, (_, i) => ({ h: i, v: Math.round(2 + Math.sin(i / 3) * 4 + Math.random() * 3) }));

const timelineData = Array.from({ length: 24 }, (_, h) => ({
  hour: `${h}:00`,
  Critical: h >= 7 && h <= 9 ? Math.round(2 + Math.random() * 2) : Math.round(Math.random()),
  High: h >= 6 && h <= 10 ? Math.round(3 + Math.random() * 3) : Math.round(Math.random() * 2),
  Medium: Math.round(2 + Math.random() * 4),
  Low: Math.round(1 + Math.random() * 2),
}));

const newAlertTypes = [
  { type: "Routine Policy Check", desc: "Automated policy compliance check completed" },
  { type: "Session Activity", desc: "Unusual session activity logged" },
  { type: "Access Log Verified", desc: "Access log integrity verified" },
];
const depts = ["IT Infra", "Compliance", "Pharmacy", "Radiology", "ICU"];

export default function Threats() {
  const { alerts, resolveAlert, addAlert } = useStore();
  const [search, setSearch] = useState("");
  const [sev, setSev] = useState("All");
  const [status, setStatus] = useState("All");
  const [dept, setDept] = useState("All");
  const [chartFilter, setChartFilter] = useState("All");
  const [viewAlert, setViewAlert] = useState<any>(null);
  const [resolveTarget, setResolveTarget] = useState<any>(null);
  const [escalateTarget, setEscalateTarget] = useState<any>(null);
  const [resNote, setResNote] = useState("");
  const autoCount = useRef(0);

  useEffect(() => {
    const t = setInterval(() => {
      if (autoCount.current >= 5) return;
      const sample = newAlertTypes[autoCount.current % newAlertTypes.length];
      autoCount.current++;
      addAlert({
        id: `A-${2900 + autoCount.current}`, sev: "MEDIUM",
        type: sample.type, desc: sample.desc,
        dept: depts[Math.floor(Math.random() * depts.length)],
        time: "just now", status: "Open", assigned: "Unassigned",
      } as any);
      notify.info(`New alert: ${sample.type}`);
    }, 45000);
    return () => clearInterval(t);
  }, [addAlert]);

  const filtered = useMemo(() => alerts.filter(a =>
    (search === "" || a.id.includes(search) || a.desc.toLowerCase().includes(search.toLowerCase())) &&
    (sev === "All" || a.sev === sev) &&
    (status === "All" || a.status === status) &&
    (dept === "All" || a.dept === dept)
  ), [alerts, search, sev, status, dept]);

  const onResolve = () => {
    if (!resolveTarget) return;
    resolveAlert(resolveTarget.id);
    notify.success(`${resolveTarget.id} resolved`);
    setResolveTarget(null); setResNote(""); setViewAlert(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 border-t-2 border-t-blue-500">
          <div className="flex items-center justify-between"><AlertTriangle size={16} className="text-muted-foreground" /><span className="text-[11px] uppercase text-muted-foreground">Alerts Today</span></div>
          <div className="flex items-end gap-2 mt-2"><div className="text-2xl font-bold">23</div>
            <ResponsiveContainer width={80} height={32}><LineChart data={sparkData}><Line dataKey="v" stroke="#3B82F6" strokeWidth={1.5} dot={false} /></LineChart></ResponsiveContainer>
          </div>
        </Card>
        <KPI icon={<AlertTriangle size={16} />} label="Critical (unresolved)" value="2" accent="danger" />
        <KPI icon={<CheckCircle size={16} />} label="Resolved Today" value="18" accent="success" />
        <KPI icon={<Clock size={16} />} label="Mean Time to Resolve" value="4.2 hrs" accent="info" />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Alert Volume — Last 24 Hours</h3>
          <div className="flex gap-1">
            {["All", "Critical", "High", "Medium", "Low"].map(t => (
              <button key={t} onClick={() => setChartFilter(t)} className={`px-2.5 py-1 text-xs rounded border ${chartFilter === t ? "bg-primary border-primary text-white" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}>{t}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={timelineData}>
            <XAxis dataKey="hour" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} stroke="hsl(var(--border))" />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} stroke="hsl(var(--border))" />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
            {(chartFilter === "All" || chartFilter === "Critical") && <Area type="monotone" dataKey="Critical" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.5} />}
            {(chartFilter === "All" || chartFilter === "High") && <Area type="monotone" dataKey="High" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.5} />}
            {(chartFilter === "All" || chartFilter === "Medium") && <Area type="monotone" dataKey="Medium" stackId="1" stroke="#FB923C" fill="#FB923C" fillOpacity={0.4} />}
            {(chartFilter === "All" || chartFilter === "Low") && <Area type="monotone" dataKey="Low" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.4} />}
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <Input placeholder="Search alerts..." value={search} onChange={e => setSearch(e.target.value)} className="w-56" />
          <Select value={sev} onChange={e => setSev(e.target.value)}>{["All", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map(o => <option key={o}>{o}</option>)}</Select>
          <Select value={status} onChange={e => setStatus(e.target.value)}>{["All", "Open", "Investigating", "Resolved"].map(o => <option key={o}>{o}</option>)}</Select>
          <Select value={dept} onChange={e => setDept(e.target.value)}>{["All", "Billing", "IT Infra", "AI/Clinical", "Oncology", "Radiology", "Compliance", "HR", "Emergency"].map(o => <option key={o}>{o}</option>)}</Select>
          <div className="flex-1" />
          <Btn variant="outline" onClick={() => notify.success("Alerts exported as CSV")}>Export Alerts</Btn>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground uppercase text-[10px]">
              <tr className="border-b border-border">{["Severity", "ID", "Type", "Description", "Department", "Triggered", "Status", "Assigned", "Actions"].map(h => <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No results found</td></tr>}
              {filtered.map(a => (
                <tr key={a.id} className={`border-b border-border hover:bg-secondary/30 ${a.status === "Resolved" ? "opacity-60" : ""}`}>
                  <td className="py-2 px-2"><SeverityBadge sev={a.sev} /></td>
                  <td className="px-2 font-mono text-foreground">{a.id}</td>
                  <td className="px-2">{a.type}</td>
                  <td className="px-2 text-muted-foreground max-w-xs truncate">{a.desc}</td>
                  <td className="px-2">{a.dept}</td>
                  <td className="px-2 text-muted-foreground">{a.time}</td>
                  <td className="px-2"><Badge tone={a.status === "Resolved" ? "success" : a.status === "Investigating" ? "warning" : "danger"}>{a.status}</Badge></td>
                  <td className="px-2 text-muted-foreground">{a.assigned}</td>
                  <td className="px-2">
                    <div className="flex gap-1">
                      <Btn variant="outline" onClick={() => setViewAlert(a)}>View</Btn>
                      {a.status !== "Resolved" && (
                        <>
                          {a.assigned === "Unassigned" ? <Btn variant="outline" onClick={() => { notify.success(`${a.id} assigned to IT Security`); }}>Assign</Btn> : <Btn variant="outline" onClick={() => setEscalateTarget(a)}>Escalate</Btn>}
                          <Btn variant="success" onClick={() => setResolveTarget(a)}>Resolve</Btn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <SlideOver open={!!viewAlert} onClose={() => setViewAlert(null)} title={viewAlert ? `Alert ${viewAlert.id}` : ""} width={480}>
        {viewAlert && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2"><SeverityBadge sev={viewAlert.sev} /><span className="text-foreground font-semibold">{viewAlert.type}</span></div>
            <p className="text-muted-foreground">{viewAlert.desc}</p>
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Timeline</div>
              <ul className="space-y-1.5 text-xs">
                <li className="flex gap-2"><span className="text-muted-foreground w-16">{viewAlert.time}</span><span>Alert triggered</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground w-16">+2m</span><span>Assigned to {viewAlert.assigned}</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground w-16">+8m</span><span>Under investigation</span></li>
              </ul>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Affected Resources</div>
              <ul className="text-xs space-y-1"><li>• Epic EHR Core</li><li>• {viewAlert.dept} department</li><li>• 847 patient records</li></ul>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Evidence</div>
              {["session_log_07-32.json", "ip_geolocation_report.pdf", "exfil_metrics.csv"].map(f => (
                <div key={f} className="flex justify-between p-2 bg-secondary/40 rounded my-1 text-xs"><span>{f}</span><button onClick={() => notify.info("Opening evidence log...")} className="text-primary hover:underline">View</button></div>
              ))}
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Related Alerts</div>
              <div className="flex gap-2"><Badge tone="warning">A-2842</Badge><Badge tone="danger">A-2840</Badge></div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Assign to</div>
              <div className="flex gap-2">
                <Select className="flex-1"><option>IT Security</option><option>Compliance Team</option><option>CMO Office</option><option>Legal</option><option>External MSSP</option></Select>
                <Btn variant="primary" onClick={() => notify.success("Alert assigned")}>Assign</Btn>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Add Note</div>
              <Textarea rows={2} placeholder="Investigation notes..." />
              <Btn variant="outline" className="mt-2" onClick={() => notify.success("Note saved")}>Save Note</Btn>
            </div>
            <div className="flex gap-2 pt-2 border-t border-border">
              <Btn variant="warning" onClick={() => setEscalateTarget(viewAlert)}>Escalate to CISO</Btn>
              {viewAlert.status !== "Resolved" && <Btn variant="success" onClick={() => setResolveTarget(viewAlert)}>Mark Resolved</Btn>}
            </div>
          </div>
        )}
      </SlideOver>

      <Modal open={!!resolveTarget} onClose={() => setResolveTarget(null)} title={`Resolve ${resolveTarget?.id}?`} size="sm" dismissOnBackdrop={false}>
        <Textarea required placeholder="Resolution notes (required)..." rows={4} value={resNote} onChange={e => setResNote(e.target.value)} />
        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="outline" onClick={() => setResolveTarget(null)}>Cancel</Btn>
          <Btn variant="success" disabled={!resNote.trim()} onClick={onResolve}>Mark Resolved</Btn>
        </div>
      </Modal>

      <Modal open={!!escalateTarget} onClose={() => setEscalateTarget(null)} title={`Escalate ${escalateTarget?.id}?`} size="sm" dismissOnBackdrop={false}>
        <p className="text-sm text-muted-foreground mb-4">CISO and CMO will be notified via email and SMS.</p>
        <div className="flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setEscalateTarget(null)}>Cancel</Btn>
          <Btn variant="warning" onClick={() => { notify.success("Escalated — CISO notified"); setEscalateTarget(null); }}>Confirm Escalate</Btn>
        </div>
      </Modal>
    </div>
  );
}
