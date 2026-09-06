import { useMemo, useState } from "react";
import { Card, KPI, Badge, Btn, Modal, SlideOver, Input, Select, Textarea, SectionHeader, Gauge } from "@/components/ui-bits";
import { toneVar, type Tone } from "@/lib/tone";
import { AppIcon } from "@/components/AppIcon";
import { RiskMatrix } from "@/components/RiskMatrix";
import { risks as initRisks, riskScoreOf } from "@/data/mock";
import { notify } from "@/lib/notify";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const trendData = Array.from({ length: 8 }, (_, i) => ({
  week: `W${i + 1}`,
  Critical: 180 - i * 5 + Math.round(Math.random() * 8),
  High: 140 + i * 2,
  Medium: 120 - i,
  Low: 60 + i,
}));

const scoreTone = (s: number): Tone => s >= 70 ? "danger" : s >= 40 ? "warning" : s >= 20 ? "info" : "success";
/** Same mapping, resolved to a CSS colour for SVG fills and inline styles. */
const scoreColor = (s: number) => toneVar(scoreTone(s));

export default function Risks() {
  const [risks, setRisks] = useState(initRisks);
  const [closed, setClosed] = useState<Set<string>>(new Set(["R-012"]));
  const [steps, setSteps] = useState<Record<string, boolean[]>>({});
  const [comments, setComments] = useState<Record<string, string[]>>({});
  const [newComment, setNewComment] = useState("");
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [status, setStatus] = useState("All");
  const [view, setView] = useState<any>(null);
  const [edit, setEdit] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [escalateR, setEscalateR] = useState<any>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const enriched = useMemo(() => risks.map(r => ({ ...r, score: riskScoreOf(r.L, r.I), status: closed.has(r.id) ? "Closed" : r.status })), [risks, closed]);

  const filtered = useMemo(() => enriched.filter(r =>
    (search === "" || r.name.toLowerCase().includes(search.toLowerCase())) &&
    (cat === "All" || r.cat === cat) &&
    (status === "All" || r.status === status)
  ), [enriched, search, cat, status]);

  const stepsFor = (id: string) => steps[id] || [false, false, false, false];
  const completion = (id: string) => {
    const s = stepsFor(id); return Math.round(s.filter(Boolean).length / s.length * 100);
  };

  const counts = {
    total: enriched.length,
    critical: enriched.filter(r => r.score >= 80).length,
    open: enriched.filter(r => r.status === "Open").length,
    mitigating: enriched.filter(r => r.status === "Mitigating").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon="risks" label="Total Risks" value={String(counts.total)} accent="info" />
        <KPI icon="threats" label="Critical (80+)" value={String(counts.critical)} accent="danger" />
        <KPI icon="activity" label="Open Risks" value={String(counts.open)} accent="warning" />
        <KPI icon="maintenance" label="Mitigating" value={String(counts.mitigating)} accent="info" />
      </div>

      <Card className="p-4">
        <SectionHeader
          title="Risk Matrix"
          subtitle="Every risk plotted by likelihood and impact. Select a chip to jump to its row."
        />
        <RiskMatrix
          risks={enriched}
          highlightId={highlightId}
          onSelect={(id) => {
            setHighlightId(id);
            document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <Input placeholder="Search risks..." value={search} onChange={e => setSearch(e.target.value)} className="w-44" />
          <Select value={cat} onChange={e => setCat(e.target.value)}>{["All", "Cybersecurity", "Compliance", "AI Governance", "IAM", "Insider Risk", "Operational", "Physical"].map(o => <option key={o}>{o}</option>)}</Select>
          <Select value={status} onChange={e => setStatus(e.target.value)}>{["All", "Open", "Mitigating", "Investigating", "Closed"].map(o => <option key={o}>{o}</option>)}</Select>
          <div className="flex-1" />
          <Btn variant="primary" onClick={() => setAddOpen(true)}>+ Add Risk</Btn>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <thead className="sticky top-0 z-10 bg-raised text-tertiary uppercase text-caption"><tr className="border-b border-default">{["ID", "Name", "Category", "L", "I", "Score", "Owner", "Status", "Due", "Actions"].map(h => <th key={h} className="text-left py-2 px-2">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} id={`row-${r.id}`} className={`border-b border-default hover:bg-raised-2 ${highlightId === r.id ? "bg-brand/10" : ""}`}>
                  <td className="py-2 px-2 font-mono">{r.id}</td>
                  <td className="px-2">{r.name}</td>
                  <td className="px-2 text-tertiary">{r.cat}</td>
                  <td className="px-2">{r.L}</td>
                  <td className="px-2">{r.I}</td>
                  <td className="px-2">
                    <div className="flex items-center gap-1.5"><Badge tone={scoreTone(r.score)}>{r.score}</Badge>
                      <div className="w-16 h-1 bg-action rounded"><div className="h-full" style={{ width: `${r.score}%`, background: scoreColor(r.score) }} /></div>
                    </div>
                  </td>
                  <td className="px-2 text-tertiary">{r.owner}</td>
                  <td className="px-2"><Badge tone={r.status === "Closed" ? "success" : r.status === "Mitigating" ? "info" : r.status === "Open" ? "warning" : "muted"}>{r.status}</Badge></td>
                  <td className="px-2 text-tertiary">{r.due}</td>
                  <td className="px-2"><div className="flex gap-1"><Btn variant="outline" onClick={() => setView(r)}>View</Btn><Btn variant="outline" onClick={() => setEdit(r)}>Edit</Btn></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <SectionHeader title="Risk Score Trend, Last 8 Weeks" />
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trendData}>
            <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="Critical" stroke="var(--sem-severity-critical)" />
            <Line type="monotone" dataKey="High" stroke="var(--sem-severity-high)" />
            <Line type="monotone" dataKey="Medium" stroke="var(--sem-severity-medium)" />
            <Line type="monotone" dataKey="Low" stroke="var(--sem-feedback-success-icon)" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <SlideOver open={!!view} onClose={() => setView(null)} title={view?.id} width={480}>
        {view && (() => {
          const score = riskScoreOf(view.L, view.I);
          const myComments = comments[view.id] || ["Identified during quarterly review.", "Mitigation plan drafted by IT Security."];
          const stepLabels = ["Identify owner & scope", "Implement primary control", "Independent verification", "Sign off & monitoring"];
          return (
            <div className="space-y-4 text-body-md">
              <div className="flex items-center gap-3"><Gauge value={Math.min(100, score)} tone={scoreTone(score)} size={100} /><div><div className="font-semibold">{view.name}</div><div className="text-body-sm text-tertiary">{view.cat} · {view.owner}</div></div></div>
              <p className="text-tertiary text-body-sm">This risk relates to potential exposure within the {view.cat.toLowerCase()} domain. Mitigation requires multi-step coordination across teams. Continuous monitoring is in effect.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-body-sm">
                <div><div className="text-tertiary">Likelihood</div><input type="range" min={1} max={5} value={view.L} disabled className="w-full accent-primary" /></div>
                <div><div className="text-tertiary">Impact</div><input type="range" min={1} max={5} value={view.I} disabled className="w-full accent-primary" /></div>
              </div>

              <div>
                <div className="flex justify-between mb-1"><span className="text-body-sm uppercase text-tertiary">Mitigation Plan</span><span className="text-body-sm">{completion(view.id)}%</span></div>
                <div className="h-1 bg-action rounded overflow-hidden mb-2"><div className="h-full bg-feedback-success-icon" style={{ width: `${completion(view.id)}%` }} /></div>
                {stepLabels.map((s, i) => (
                  <label key={i} className="flex items-center gap-2 py-1 text-body-sm">
                    <input type="checkbox" checked={stepsFor(view.id)[i]} onChange={e => setSteps(prev => ({ ...prev, [view.id]: stepsFor(view.id).map((v, j) => j === i ? e.target.checked : v) }))} className="accent-primary" />
                    {s}
                  </label>
                ))}
              </div>

              <div>
                <div className="text-body-sm uppercase text-tertiary mb-1">Linked Controls</div>
                <div className="flex gap-1"><Badge tone="info">C-001</Badge><Badge tone="info">C-008</Badge></div>
              </div>
              <div>
                <div className="text-body-sm uppercase text-tertiary mb-1">Linked Alerts</div>
                <div className="flex gap-1"><Badge tone="danger">A-2847</Badge></div>
              </div>
              <div>
                <div className="text-body-sm uppercase text-tertiary mb-1">History</div>
                <ul className="text-body-sm space-y-1 text-tertiary"><li>• Risk identified, Mar 12</li><li>• Score updated to {score}, Apr 04</li><li>• Mitigation started, Apr 15</li></ul>
              </div>

              <div>
                <div className="text-body-sm uppercase text-tertiary mb-1">Comments</div>
                <ul className="space-y-1.5 mb-2">
                  {myComments.map((c, i) => <li key={i} className="bg-raised-2 rounded p-2 text-body-sm">{c}</li>)}
                </ul>
                <Textarea rows={2} placeholder="Add comment..." value={newComment} onChange={e => setNewComment(e.target.value)} />
                <Btn variant="outline" className="mt-1" onClick={() => { if (newComment.trim()) { setComments(prev => ({ ...prev, [view.id]: [...myComments, newComment] })); setNewComment(""); } }}>Post</Btn>
              </div>

              <div className="flex gap-2 pt-2 border-t border-default">
                <Btn variant="outline" onClick={() => notify.success("Risk report generated")}>Generate Report</Btn>
                {view.status !== "Closed" && <Btn variant="inverse" onClick={() => { setClosed(prev => new Set(prev).add(view.id)); notify.success(`${view.id} closed`); setView(null); }}>Close Risk</Btn>}
                <Btn variant="danger" onClick={() => setEscalateR(view)}>Escalate</Btn>
              </div>
            </div>
          );
        })()}
      </SlideOver>

      <Modal open={!!edit || addOpen} onClose={() => { setEdit(null); setAddOpen(false); }} title={addOpen ? "Add Risk" : "Edit Risk"} size="md">
        <RiskForm initial={edit} onSubmit={(r) => {
          if (addOpen) {
            setRisks(prev => [...prev, { ...r, id: `R-${String(prev.length + 1).padStart(3, "0")}` }]);
            notify.success("Risk added to register");
          } else {
            setRisks(prev => prev.map(x => x.id === edit.id ? { ...x, ...r } : x));
            notify.success("Risk updated");
          }
          setEdit(null); setAddOpen(false);
        }} />
      </Modal>

      <Modal open={!!escalateR} onClose={() => setEscalateR(null)} title="Escalate Risk" size="sm" dismissOnBackdrop={false}>
        <p className="text-body-md mb-3">Escalate {escalateR?.id} to executive risk committee?</p>
        <div className="flex justify-end gap-2"><Btn variant="outline" onClick={() => setEscalateR(null)}>Cancel</Btn><Btn variant="danger" onClick={() => { notify.success("Escalated to ERC"); setEscalateR(null); }}>Confirm</Btn></div>
      </Modal>
    </div>
  );
}

function RiskForm({ initial, onSubmit }: { initial?: any; onSubmit: (r: any) => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [cat, setCat] = useState(initial?.cat || "Cybersecurity");
  const [L, setL] = useState(initial?.L || 3);
  const [I, setI] = useState(initial?.I || 3);
  const [owner, setOwner] = useState(initial?.owner || "IT Security");
  const [due, setDue] = useState(initial?.due || "");
  const score = riskScoreOf(L, I);
  return (
    <div className="space-y-3">
      <Input placeholder="Risk name" className="w-full" value={name} onChange={e => setName(e.target.value)} />
      <Select className="w-full" value={cat} onChange={e => setCat(e.target.value)}>{["Cybersecurity", "Compliance", "AI Governance", "IAM", "Insider Risk", "Operational", "Physical"].map(c => <option key={c}>{c}</option>)}</Select>
      <Textarea placeholder="Description" rows={2} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="text-body-sm text-tertiary">Likelihood: {L}</label><input type="range" min={1} max={5} value={L} onChange={e => setL(+e.target.value)} className="w-full accent-primary" /></div>
        <div><label className="text-body-sm text-tertiary">Impact: {I}</label><input type="range" min={1} max={5} value={I} onChange={e => setI(+e.target.value)} className="w-full accent-primary" /></div>
      </div>
      <div className="text-body-sm">Risk Score: <span className="font-semibold" style={{ color: scoreColor(score) }}>{score}</span></div>
      <Select className="w-full" value={owner} onChange={e => setOwner(e.target.value)}>{["IT Security", "Compliance", "Legal Team", "CMO Office", "IT Admin", "HR", "IT Ops"].map(o => <option key={o}>{o}</option>)}</Select>
      <Input type="date" placeholder="Due" value={due} onChange={e => setDue(e.target.value)} />
      <Textarea placeholder="Mitigation plan..." rows={2} />
      <Btn variant="primary" className="w-full" onClick={() => onSubmit({ name, cat, L, I, owner, due, status: "Open" })}>Save</Btn>
    </div>
  );
}
