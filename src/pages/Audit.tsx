import { useMemo, useState } from "react";
import { Card, Badge, Btn, Modal, Input, Select, Textarea, SectionHeader } from "@/components/ui-bits";
import { auditLog } from "@/data/mock";
import { notify } from "@/lib/notify";

const scheduledInit = [
  { name: "HIPAA Weekly Summary", freq: "Weekly (Mon)", last: "Apr 28", next: "May 5", to: "compliance@meridian.org", paused: false },
  { name: "SOC 2 Monthly", freq: "Monthly (1st)", last: "May 1", next: "Jun 1", to: "ciso@meridian.org", paused: false },
  { name: "Access Review", freq: "Weekly (Fri)", last: "May 2", next: "May 9", to: "it-security@meridian.org", paused: false },
  { name: "AI Governance", freq: "Daily (6 AM)", last: "Today", next: "Tomorrow", to: "cmo@meridian.org", paused: false },
];

export default function Audit() {
  const [search, setSearch] = useState("");
  const [user, setUser] = useState("All");
  const [action, setAction] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [event, setEvent] = useState<any>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [genPhase, setGenPhase] = useState<"idle" | "running" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [scheduled, setScheduled] = useState(scheduledInit);
  const [recurring, setRecurring] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipInput, setRecipInput] = useState("");
  const [editSched, setEditSched] = useState<number | null>(null);

  const filtered = useMemo(() => auditLog.filter(e =>
    (search === "" || e.user.toLowerCase().includes(search.toLowerCase()) || e.res.toLowerCase().includes(search.toLowerCase())) &&
    (user === "All" || e.user === user) &&
    (action === "All" || e.action === action)
  ), [search, user, action]);

  const generate = () => {
    setGenPhase("running"); setProgress(0);
    const t = setInterval(() => setProgress(p => Math.min(100, p + 4)), 100);
    setTimeout(() => { clearInterval(t); setGenPhase("done"); }, 3000);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <Card className="p-4">
          <SectionHeader title="Audit Trail" />
          <div className="flex flex-wrap gap-2 mb-3">
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-44" />
            <Select value={user} onChange={e => setUser(e.target.value)}><option>All</option>{Array.from(new Set(auditLog.map(a => a.user))).map(u => <option key={u}>{u}</option>)}</Select>
            <Select value={action} onChange={e => setAction(e.target.value)}>{["All", "LOGIN", "RECORD_ACCESS", "POLICY_CHANGE", "REPORT_EXPORT", "ANOMALOUS_LOGIN", "BULK_DOWNLOAD", "ADMIN_ACCESS", "AI_DECISION"].map(o => <option key={o}>{o}</option>)}</Select>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
            <Btn variant="outline" onClick={() => notify.success("Filters applied")}>Apply Filters</Btn>
            <div className="flex-1" />
            <Btn variant="outline" onClick={() => setExportOpen(true)}>Export Full Trail</Btn>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-muted-foreground uppercase text-[10px]"><tr className="border-b border-border">{["#", "Time", "User", "Action", "Resource", "IP", "Location", "Result"].map(h => <th key={h} className="text-left py-2 px-2">{h}</th>)}</tr></thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No results found</td></tr>}
                {filtered.map((e, i) => {
                  const flagged = ["FLAGGED", "BLOCKED", "FAILED", "POLICY VIOLATION"].includes(e.result);
                  return (
                    <tr key={i} onClick={() => setEvent(e)} className={`border-b border-border hover:bg-secondary/50 cursor-pointer ${flagged ? "border-l-2 border-l-red-500" : ""}`}>
                      <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-2">{e.ts}</td>
                      <td className="px-2">{e.user}</td>
                      <td className="px-2 font-mono text-[10px]">{e.action}</td>
                      <td className="px-2 text-muted-foreground">{e.res}</td>
                      <td className="px-2 font-mono">{e.ip}</td>
                      <td className="px-2">{e.loc}</td>
                      <td className="px-2"><Badge tone={flagged ? "danger" : e.result === "Override" || e.result === "Flagged" || e.result === "Alert" ? "warning" : "success"}>{e.result}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">Showing {filtered.length} of 98,441 events</div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader title="Generate Report" />
            <div className="space-y-2">
              <Select className="w-full"><option>HIPAA Compliance Summary</option><option>SOC 2 Evidence Package</option><option>Incident Summary</option><option>Access Review</option><option>AI Governance Report</option><option>Custom</option></Select>
              <div className="grid grid-cols-2 gap-2"><Input type="date" /><Input type="date" /></div>
              <div className="text-xs text-muted-foreground">Sections</div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {["Executive Summary", "Control Details", "Evidence Files", "User Access", "AI Decisions", "Risk Register"].map(s => (
                  <label key={s} className="flex items-center gap-1.5"><input type="checkbox" defaultChecked className="accent-primary" />{s}</label>
                ))}
              </div>
              <div className="flex gap-3 text-xs">
                {["PDF", "CSV", "JSON"].map(f => <label key={f} className="flex items-center gap-1"><input type="radio" name="fmt" defaultChecked={f === "PDF"} className="accent-primary" />{f}</label>)}
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Recipients</div>
                <div className="flex gap-1">
                  <Input placeholder="email@meridian.org" value={recipInput} onChange={e => setRecipInput(e.target.value)} className="flex-1" />
                  <Btn variant="outline" onClick={() => { if (recipInput) { setRecipients([...recipients, recipInput]); setRecipInput(""); } }}>Add +</Btn>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">{recipients.map(r => <Badge key={r} tone="info">{r}</Badge>)}</div>
              </div>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} className="accent-primary" /> Schedule Recurring</label>
              {recurring && (
                <div className="grid grid-cols-2 gap-2"><Select><option>Daily</option><option>Weekly</option><option>Monthly</option></Select><Select><option>Mon</option><option>Tue</option><option>Wed</option></Select></div>
              )}
              <Btn variant="primary" className="w-full" onClick={generate}>Generate Report</Btn>
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader title="Scheduled Reports" />
            <table className="w-full text-[11px]">
              <thead className="text-muted-foreground text-[10px] uppercase"><tr className="border-b border-border">{["Name", "Freq", "Next", "Actions"].map(h => <th key={h} className="text-left py-1 px-1">{h}</th>)}</tr></thead>
              <tbody>
                {scheduled.map((s, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="py-2 px-1">{s.name}{s.paused && <Badge tone="muted" className="ml-1">Paused</Badge>}</td>
                    <td className="px-1 text-muted-foreground">{s.freq}</td>
                    <td className="px-1 text-muted-foreground">{s.next}</td>
                    <td className="px-1">
                      <div className="flex gap-1">
                        <Btn variant="outline" onClick={() => setEditSched(i)}>Edit</Btn>
                        <Btn variant="outline" onClick={() => setScheduled(prev => prev.map((x, j) => j === i ? { ...x, paused: !x.paused } : x))}>{s.paused ? "Resume" : "Pause"}</Btn>
                        <Btn variant="primary" onClick={() => { notify.info("Generating report..."); setTimeout(() => notify.success(`${s.name} sent`), 1500); }}>Run Now</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      <Modal open={!!event} onClose={() => setEvent(null)} title="Audit Event Detail" size="md">
        {event && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><div className="text-xs text-muted-foreground">Timestamp</div><div>{event.ts}</div></div>
              <div><div className="text-xs text-muted-foreground">User</div><div>{event.user}</div></div>
              <div><div className="text-xs text-muted-foreground">Action</div><div className="font-mono">{event.action}</div></div>
              <div><div className="text-xs text-muted-foreground">Result</div><div>{event.result}</div></div>
              <div><div className="text-xs text-muted-foreground">IP</div><div className="font-mono">{event.ip}</div></div>
              <div><div className="text-xs text-muted-foreground">Location</div><div>{event.loc}</div></div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Resource</div>
              <div className="bg-secondary/40 p-2 rounded">{event.res}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Raw log</div>
              <pre className="bg-secondary/60 p-2 rounded text-[11px] font-mono overflow-x-auto">{JSON.stringify(event, null, 2)}</pre>
            </div>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={() => notify.success("Alert created from audit event")}>Create Alert</Btn>
              <Btn variant="outline" onClick={() => notify.success("Event log downloading...")}>Download Event</Btn>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Export Audit Trail" size="sm">
        <div className="space-y-3">
          <div className="flex gap-3 text-xs">{["CSV", "JSON", "PDF"].map(f => <label key={f}><input type="radio" name="exp" defaultChecked={f === "CSV"} className="accent-primary mr-1" />{f}</label>)}</div>
          <div className="grid grid-cols-2 gap-2"><Input type="date" /><Input type="date" /></div>
          <Btn variant="primary" className="w-full" onClick={() => { setExportOpen(false); notify.success("Audit trail export ready — downloading audit_trail_2025-05-05.csv"); }}>Generate Export</Btn>
        </div>
      </Modal>

      <Modal open={genPhase !== "idle"} onClose={() => setGenPhase("idle")} title={genPhase === "done" ? "Report Ready" : "Generating Report"} size="sm" dismissOnBackdrop={false}>
        {genPhase === "running" && (
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">Compiling 47 evidence files... Formatting PDF...</p>
            <div className="h-2 bg-secondary rounded overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
          </div>
        )}
        {genPhase === "done" && (
          <div>
            <p className="text-sm mb-3">✓ 47-page PDF generated successfully.</p>
            <div className="flex gap-2">
              <Btn variant="primary" onClick={() => { notify.success("Downloading..."); setGenPhase("idle"); }}>Download Now</Btn>
              <Btn variant="outline" onClick={() => { notify.success("Email sent"); setGenPhase("idle"); }}>Send via Email</Btn>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editSched !== null} onClose={() => setEditSched(null)} title="Edit Schedule" size="sm">
        <div className="space-y-3">
          <Input className="w-full" defaultValue={editSched !== null ? scheduled[editSched].name : ""} />
          <Select className="w-full"><option>Daily</option><option>Weekly</option><option>Monthly</option></Select>
          <Input className="w-full" placeholder="Recipients" />
          <Btn variant="primary" className="w-full" onClick={() => { notify.success("Schedule updated"); setEditSched(null); }}>Save</Btn>
        </div>
      </Modal>
    </div>
  );
}
