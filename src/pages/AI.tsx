import { useState } from "react";
import { Card, KPI, Badge, Btn, Modal, Gauge, SectionHeader } from "@/components/ui-bits";
import { Cpu, Activity, AlertTriangle, Users } from "lucide-react";
import { aiDecisions } from "@/data/mock";
import { useStore } from "@/store/AppStore";
import { notify } from "@/lib/notify";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from "recharts";

const biasData = [
  { group: "White", model: 78, actual: 76 },
  { group: "Black", model: 72, actual: 71 },
  { group: "Hispanic", model: 58, actual: 76 },
  { group: "Asian", model: 75, actual: 74 },
  { group: "Other", model: 73, actual: 72 },
];

const overrideHist = Array.from({ length: 8 }, (_, i) => ({
  week: `W${i + 1}`,
  DiagnosticAI: [2, 1, 3, 2, 4, 2, 3, 3][i],
  RiskScoreAI: [3, 4, 5, 6, 7, 8, 10, 11][i],
  ClaimsCodingAI: [0, 0, 1, 0, 0, 1, 0, 1][i],
}));

export default function AI() {
  const { aiPaused, setAiPaused } = useStore();
  const [decision, setDecision] = useState<any>(null);
  const [biasModalOpen, setBiasModalOpen] = useState(false);
  const [pauseConfirm, setPauseConfirm] = useState(false);
  const [addModelOpen, setAddModelOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={<Cpu size={16} />} label="Models Monitored" value="3" accent="info" />
        <KPI icon={<Activity size={16} />} label="Decisions Today" value="1,576" accent="info" />
        <KPI icon={<AlertTriangle size={16} />} label="Models Flagged" value="1" accent="warning" />
        <KPI icon={<Users size={16} />} label="Override Rate" value="3.2%" accent="info" />
      </div>

      <div className="flex justify-end"><Btn variant="primary" onClick={() => setAddModelOpen(true)}>+ Add AI Model</Btn></div>

      {/* Card 1 */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div><div className="text-base font-semibold">DiagnosticAI <span className="text-xs text-muted-foreground">v2.3</span></div></div>
          <Badge tone="success">✓ HEALTHY</Badge>
        </div>
        <div className="grid grid-cols-5 gap-3 mt-3 text-xs">
          {[["Accuracy", "94.2%"], ["Bias Score", "0.03 / 1.0"], ["Decisions", "247"], ["Confidence", "91.4%"], ["Last Override", "2 days ago"]].map(s => (
            <div key={s[0]}><div className="text-muted-foreground">{s[0]}</div><div className="text-foreground font-medium">{s[1]}</div></div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="flex flex-col items-center"><Gauge value={94} color="#10B981" /><div className="text-xs text-muted-foreground mt-1">Accuracy</div></div>
          <div className="flex flex-col items-center"><Gauge value={97} color="#10B981" /><div className="text-xs text-muted-foreground mt-1">Fairness</div></div>
          <div className="flex flex-col items-center"><Gauge value={91} color="#10B981" /><div className="text-xs text-muted-foreground mt-1">Confidence</div></div>
        </div>
        <div className="flex gap-2 mt-4">
          <Btn variant="outline" onClick={() => notify.info("Loading decision history...")}>View Decisions</Btn>
          <Btn variant="outline" onClick={() => notify.success("Threshold panel opened")}>Configure Thresholds</Btn>
          <Btn variant="outline" onClick={() => notify.success("Model card downloading...")}>Download Model Card</Btn>
        </div>
      </Card>

      {/* Card 2 - flagged */}
      <Card className="p-5 border-amber-500/40">
        <div className="flex items-center justify-between">
          <div><div className="text-base font-semibold">RiskScoreAI <span className="text-xs text-muted-foreground">v1.1 (ICU Triage)</span></div></div>
          <Badge tone="warning" className="pulse-red">⚠ BIAS DRIFT DETECTED</Badge>
        </div>

        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded mt-3 text-sm">
          <span className="font-semibold text-foreground">Action Required:</span> <span className="text-muted-foreground">Demographic disparity detected — Hispanic patients receiving systematically lower triage priority. Disparity margin +18.3%. Human review mandatory.</span>
        </div>

        <div className="grid grid-cols-5 gap-3 mt-3 text-xs">
          {[["Accuracy", "91.8%"], ["Bias Score", "0.18 (HIGH)"], ["Decisions", "89"], ["Override", "12.4%"], ["Flagged", "May 3"]].map(s => (
            <div key={s[0]}><div className="text-muted-foreground">{s[0]}</div><div className="text-foreground font-medium">{s[1]}</div></div>
          ))}
        </div>

        <div className="mt-4">
          <SectionHeader title="Bias breakdown — model score vs actual outcome" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={biasData}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="group" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="model" fill="#3B82F6" name="Model score" />
              <Bar dataKey="actual" fill="#10B981" name="Actual outcome" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {aiPaused && <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded mt-3 text-sm text-amber-400">AI PAUSED — Manual review active</div>}

        <div className="flex gap-2 mt-4 flex-wrap">
          <Btn variant={aiPaused ? "success" : "danger"} onClick={() => aiPaused ? (setAiPaused(false), notify.success("AI resumed")) : setPauseConfirm(true)}>{aiPaused ? "Resume AI Decisions" : "Pause AI Decisions"}</Btn>
          <Btn variant="warning" onClick={() => setBiasModalOpen(true)}>Investigate Bias</Btn>
          <Btn variant="outline" onClick={() => notify.success("Bias report sent to CMO and Compliance")}>Generate Bias Report</Btn>
          <Btn variant="outline" onClick={() => notify.info("Showing flagged decisions")}>View Flagged Decisions</Btn>
        </div>
      </Card>

      {/* Card 3 */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div><div className="text-base font-semibold">ClaimsCodingAI <span className="text-xs text-muted-foreground">v3.0 (Billing)</span></div></div>
          <Badge tone="success">✓ HEALTHY</Badge>
        </div>
        <div className="grid grid-cols-5 gap-3 mt-3 text-xs">
          {[["Accuracy", "97.1%"], ["Bias Score", "0.02"], ["Decisions", "1,240"], ["Cost Savings", "$47,200"], ["Error Rate", "0.3%"]].map(s => (
            <div key={s[0]}><div className="text-muted-foreground">{s[0]}</div><div className="text-foreground font-medium">{s[1]}</div></div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="flex flex-col items-center"><Gauge value={97} color="#10B981" /><div className="text-xs text-muted-foreground mt-1">Accuracy</div></div>
          <div className="flex flex-col items-center"><Gauge value={98} color="#10B981" /><div className="text-xs text-muted-foreground mt-1">Fairness</div></div>
          <div className="flex flex-col items-center"><Gauge value={95} color="#10B981" /><div className="text-xs text-muted-foreground mt-1">Reliability</div></div>
        </div>
        <div className="flex gap-2 mt-4">
          <Btn variant="outline" onClick={() => notify.info("Loading...")}>View Decisions</Btn>
          <Btn variant="outline" onClick={() => notify.success("Threshold panel opened")}>Configure Thresholds</Btn>
          <Btn variant="outline" onClick={() => notify.success("Model card downloading...")}>Download Model Card</Btn>
        </div>
      </Card>

      <Card className="p-4">
        <SectionHeader title="AI Decision Audit Log" />
        <table className="w-full text-xs">
          <thead className="text-muted-foreground uppercase text-[10px]"><tr className="border-b border-border">{["Log ID", "Model", "Patient", "Decision", "Conf", "Reviewed", "Outcome", "Time"].map(h => <th key={h} className="text-left py-2 px-2">{h}</th>)}</tr></thead>
          <tbody>
            {aiDecisions.map(d => (
              <tr key={d.id} onClick={() => setDecision(d)} className={`border-b border-border hover:bg-secondary/50 cursor-pointer ${d.flag ? "bg-amber-500/5" : ""}`}>
                <td className="py-2 px-2 font-mono">{d.id}</td>
                <td className="px-2">{d.model}</td>
                <td className="px-2 font-mono">{d.patient}</td>
                <td className="px-2">{d.decision}</td>
                <td className="px-2">{d.conf}%</td>
                <td className="px-2">{d.reviewed ? <Badge tone={d.flag ? "warning" : "success"}>{d.flag ? "OVERRIDDEN" : "Yes ✓"}</Badge> : <span className="text-muted-foreground">No</span>}</td>
                <td className="px-2 text-muted-foreground">{d.outcome}</td>
                <td className="px-2 text-muted-foreground">{d.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <SectionHeader title="AI Override History — Last 8 Weeks" />
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={overrideHist}>
            <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="DiagnosticAI" fill="#3B82F6" />
            <Bar dataKey="RiskScoreAI" fill="#F59E0B" />
            <Bar dataKey="ClaimsCodingAI" fill="#10B981" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Modal open={!!decision} onClose={() => setDecision(null)} title={`AI Decision ${decision?.id}`} size="md">
        {decision && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><div className="text-xs text-muted-foreground">Model</div><div>{decision.model}</div></div>
              <div><div className="text-xs text-muted-foreground">Patient</div><div className="font-mono">{decision.patient}</div></div>
              <div><div className="text-xs text-muted-foreground">Decision</div><div>{decision.decision}</div></div>
              <div><div className="text-xs text-muted-foreground">Confidence</div><div>{decision.conf}%</div></div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Input features</div>
              <pre className="bg-secondary/60 p-2 rounded text-xs">{`Age: 67\nBP: 140/90\nO2 Sat: 94%\nHeart rate: 88\nLab: WBC 12.4`}</pre>
            </div>
            {decision.flag && <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-xs">Override reason: Clinician judged severity higher (Dr. P. Sharma)</div>}
            <div className="flex gap-2">
              <Btn variant="outline" onClick={() => notify.success("Flagged for retraining")}>Flag for Retraining</Btn>
              <Btn variant="outline" onClick={() => notify.success("Dispute filed")}>Dispute Decision</Btn>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={biasModalOpen} onClose={() => setBiasModalOpen(false)} title="Bias Investigation — RiskScoreAI" size="md">
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">Bias detection methodology: equal opportunity disparity testing across demographic groups using SPD and EOD metrics.</p>
          <div className="p-3 bg-secondary/40 rounded text-xs">Affected patients: <span className="text-red-400 font-semibold">234</span> over the last 30 days.</div>
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-1">Recommended retraining steps</div>
            <ol className="text-xs list-decimal pl-5 space-y-1 text-muted-foreground"><li>Audit training dataset for representation</li><li>Apply re-weighting to minority groups</li><li>Retrain with adversarial debiasing</li><li>Validate on hold-out fairness suite</li></ol>
          </div>
          <Btn variant="primary" onClick={() => { notify.success("Assigned to Data Science Team"); setBiasModalOpen(false); }}>Assign to Data Science Team</Btn>
        </div>
      </Modal>

      <Modal open={pauseConfirm} onClose={() => setPauseConfirm(false)} title="Pause RiskScoreAI?" size="sm" dismissOnBackdrop={false}>
        <p className="text-sm mb-4">All triage decisions will require manual review until AI is resumed.</p>
        <div className="flex gap-2 justify-end">
          <Btn variant="outline" onClick={() => setPauseConfirm(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={() => { setAiPaused(true); setPauseConfirm(false); notify.warning("RiskScoreAI paused"); }}>Confirm Pause</Btn>
        </div>
      </Modal>

      <Modal open={addModelOpen} onClose={() => setAddModelOpen(false)} title="Register AI Model" size="md">
        <div className="space-y-3">
          <input className="bg-secondary border border-border rounded text-sm px-3 py-1.5 w-full" placeholder="Model name" />
          <select className="bg-secondary border border-border rounded text-sm px-3 py-1.5 w-full"><option>Diagnostic</option><option>Triage</option><option>Coding</option></select>
          <select className="bg-secondary border border-border rounded text-sm px-3 py-1.5 w-full"><option>Radiology</option><option>ICU</option><option>Billing</option></select>
          <select className="bg-secondary border border-border rounded text-sm px-3 py-1.5 w-full"><option>Low risk</option><option>Medium</option><option>High</option></select>
          <input className="bg-secondary border border-border rounded text-sm px-3 py-1.5 w-full" placeholder="Integration endpoint" />
          <Btn variant="primary" className="w-full" onClick={() => { setAddModelOpen(false); notify.success("Model registered — monitoring will begin within 24 hours"); }}>Register Model</Btn>
        </div>
      </Modal>
    </div>
  );
}
