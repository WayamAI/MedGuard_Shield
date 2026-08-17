import { useState } from "react";
import { Card, Badge, Btn, Modal, SlideOver, Input, Select, Textarea, SectionHeader, Gauge } from "@/components/ui-bits";
import { policies, controls, frameworks, approvals as initApprovals } from "@/data/mock";
import { notify } from "@/lib/notify";
import { useStore } from "@/store/AppStore";
import { useLocation } from "react-router-dom";

export default function Policy() {
  const loc = useLocation() as any;
  const [tab, setTab] = useState<"policies" | "controls" | "frameworks" | "approvals">(loc.state?.tab === "approvals" ? "approvals" : "policies");
  const { approvals, setApprovalStatus } = useStore();
  const [viewPolicy, setViewPolicy] = useState<any>(null);
  const [editPolicy, setEditPolicy] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addControlOpen, setAddControlOpen] = useState(false);
  const [testCtrl, setTestCtrl] = useState<any>(null);
  const [testPhase, setTestPhase] = useState<"running" | "done">("running");
  const [actionApproval, setActionApproval] = useState<{ a: any; act: string } | null>(null);
  const [reason, setReason] = useState("");
  const [auditModal, setAuditModal] = useState<any>(null);

  const runTest = (c: any) => {
    setTestCtrl(c); setTestPhase("running");
    setTimeout(() => setTestPhase("done"), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border">
        {([["policies", "Policies"], ["controls", "Controls"], ["frameworks", "Frameworks"], ["approvals", `Pending Approvals (${approvals.filter(a => !a.status).length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 text-sm border-b-2 ${tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab === "policies" && (
        <>
          <div className="flex justify-end"><Btn variant="primary" onClick={() => setCreateOpen(true)}>+ Create Policy</Btn></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {policies.map(p => (
              <Card key={p.name} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{p.name}</div>
                    <div className="flex gap-1 mt-1">
                      <Badge tone="info">{p.cat}</Badge>
                      <Badge tone={p.status === "Active" ? "success" : p.status === "Draft" ? "warning" : "danger"}>{p.status}</Badge>
                      {p.overdue && <Badge tone="warning">OVERDUE REVIEW</Badge>}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Enforcement</span><span>{p.enforce}%{p.note ? ` — ${p.note}` : ""}</span></div>
                  <div className="h-1.5 bg-secondary rounded overflow-hidden"><div className="h-full bg-primary" style={{ width: `${p.enforce}%` }} /></div>
                </div>
                <div className="text-[11px] text-muted-foreground mt-3">Last: {p.last} · Owner: {p.owner} · Review by: {p.review}</div>
                <div className="flex gap-1 mt-3">
                  <Btn variant="outline" onClick={() => setViewPolicy(p)}>View</Btn>
                  <Btn variant="outline" onClick={() => setEditPolicy(p)}>Edit</Btn>
                  <Btn variant="outline" onClick={() => notify.success("Policy archived")}>Archive</Btn>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === "controls" && (
        <Card className="p-4">
          <div className="flex justify-end mb-3"><Btn variant="primary" onClick={() => setAddControlOpen(true)}>+ Add Control</Btn></div>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground uppercase text-[10px]"><tr className="border-b border-border">{["ID", "Name", "Frameworks", "Status", "Owner", "Evidence", "Next Review", "Actions"].map(h => <th key={h} className="text-left py-2 px-2">{h}</th>)}</tr></thead>
            <tbody>
              {controls.map(c => (
                <tr key={c.id} className="border-b border-border hover:bg-secondary/30">
                  <td className="py-2 px-2 font-mono">{c.id}</td>
                  <td className="px-2">{c.name}</td>
                  <td className="px-2"><div className="flex gap-1 flex-wrap">{c.fw.map(f => <Badge key={f} tone="info">{f}</Badge>)}</div></td>
                  <td className="px-2"><Badge tone={c.status === "Passing" ? "success" : c.status === "Failing" ? "danger" : "warning"}>{c.status}</Badge></td>
                  <td className="px-2 text-muted-foreground">{c.owner}</td>
                  <td className="px-2 text-muted-foreground">{c.last}</td>
                  <td className="px-2 text-muted-foreground">{c.next}</td>
                  <td className="px-2"><div className="flex gap-1"><Btn variant="outline" onClick={() => notify.info(`Viewing ${c.id}`)}>View</Btn><Btn variant="outline" onClick={() => runTest(c)}>Test</Btn></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "frameworks" && (
        <div className="space-y-3">
          {frameworks.map(fw => (
            <Card key={fw.name} className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded" style={{ background: fw.color, opacity: 0.25 }} />
                <div className="flex-1">
                  <div className="text-base font-semibold text-foreground">{fw.name}</div>
                  <div className="text-xs text-muted-foreground">{fw.controls} controls passing · Next audit {fw.next}</div>
                </div>
                <Gauge value={fw.score} size={80} color={fw.color} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Categories</div>
                  <div className="space-y-1">
                    {[["Encryption", 96], ["Access", 92], ["Audit", 88]].map(r => (
                      <div key={r[0] as string}><div className="flex justify-between text-[11px]"><span>{r[0]}</span><span>{r[1]}%</span></div><div className="h-1 bg-secondary rounded"><div className="h-full bg-emerald-500" style={{ width: `${r[1]}%` }} /></div></div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Upcoming</div>
                  <ul className="text-xs space-y-1 text-muted-foreground"><li>• New encryption requirements Q3</li><li>• Audit scope expansion</li><li>• Mandatory AI documentation</li></ul>
                </div>
                <div className="flex flex-col gap-2">
                  <Btn variant="primary" onClick={() => notify.success("Evidence package ready — 47 files")}>Generate Evidence</Btn>
                  <Btn variant="outline" onClick={() => setAuditModal(fw)}>Schedule Audit</Btn>
                  <Btn variant="outline" onClick={() => notify.success("Report downloading...")}>Download Report</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "approvals" && (
        <div className="space-y-3">
          {approvals.map(a => (
            <Card key={a.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{a.type} — {a.requestor}</div>
                  <div className="text-xs text-muted-foreground mt-1">{a.desc}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">Submitted {a.submitted} · Due {a.due}</div>
                </div>
                {a.status ? <Badge tone={a.status === "Approved" ? "success" : a.status === "Rejected" ? "danger" : "warning"}>{a.status}</Badge> : (
                  <div className="flex gap-2">
                    <Btn variant="success" onClick={() => setActionApproval({ a, act: "Approve" })}>Approve</Btn>
                    <Btn variant="danger" onClick={() => setActionApproval({ a, act: "Reject" })}>Reject</Btn>
                    <Btn variant="outline" onClick={() => setActionApproval({ a, act: "Info" })}>Request Info</Btn>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!viewPolicy} onClose={() => setViewPolicy(null)} title={viewPolicy?.name} size="lg">
        {viewPolicy && (
          <div className="space-y-4 text-sm">
            <div className="flex gap-2"><Badge tone="info">{viewPolicy.cat}</Badge><Badge tone="success">{viewPolicy.status}</Badge></div>
            <div className="space-y-2 text-muted-foreground">
              <p>This policy governs the handling, storage, and transmission of all PHI within Meridian Health System per HIPAA §164.312.</p>
              <p>All affected employees must acknowledge receipt and adhere to enforcement guidelines documented herein.</p>
              <p>Exceptions may be granted on a case-by-case basis with executive approval.</p>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Enforcement: {viewPolicy.enforce}%</div>
              <Btn variant="outline" onClick={() => notify.info("3 active exceptions")}>View Exceptions</Btn>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Acknowledgements</div>
              <div className="text-xs">47 of 52 staff acknowledged</div>
              <Btn variant="outline" className="mt-2" onClick={() => notify.success("Reminders sent to 5 users")}>Send Reminder</Btn>
            </div>
            <Btn variant="primary" onClick={() => notify.success("Policy PDF downloading...")}>Download PDF</Btn>
          </div>
        )}
      </Modal>

      <Modal open={!!editPolicy || createOpen} onClose={() => { setEditPolicy(null); setCreateOpen(false); }} title={createOpen ? "New Policy" : "Edit Policy"} size="md">
        <div className="space-y-3">
          <div><label className="text-xs text-muted-foreground">Name</label><Input className="w-full" defaultValue={editPolicy?.name} /></div>
          <div><label className="text-xs text-muted-foreground">Category</label><Select className="w-full" defaultValue={editPolicy?.cat}><option>Data Privacy</option><option>Security</option><option>AI Governance</option><option>Clinical</option><option>Risk</option></Select></div>
          <Textarea placeholder="Description..." rows={3} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input type="date" />
            <Select><option>Legal Team</option><option>IT Security</option><option>CMO Office</option></Select>
          </div>
          <Btn variant="primary" className="w-full" onClick={() => { setEditPolicy(null); setCreateOpen(false); notify.success(createOpen ? "Policy created" : "Policy submitted for approval"); }}>Save</Btn>
        </div>
      </Modal>

      <Modal open={addControlOpen} onClose={() => setAddControlOpen(false)} title="Add Control" size="md">
        <div className="space-y-3">
          <Input placeholder="Control name" className="w-full" />
          <div><label className="text-xs">Frameworks</label><div className="flex gap-3 mt-1">{["HIPAA", "SOC2", "ISO", "HITRUST"].map(f => <label key={f} className="text-sm flex items-center gap-1"><input type="checkbox" className="accent-primary" /> {f}</label>)}</div></div>
          <Textarea placeholder="Description..." rows={2} />
          <Select><option>IT Security</option><option>Compliance</option><option>IT Admin</option></Select>
          <Btn variant="primary" className="w-full" onClick={() => { setAddControlOpen(false); notify.success("Control created"); }}>Create Control</Btn>
        </div>
      </Modal>

      <Modal open={!!testCtrl} onClose={() => setTestCtrl(null)} title={`Testing ${testCtrl?.id}`} size="sm">
        {testPhase === "running" ? (
          <div className="py-8 text-center"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" /><p className="text-sm text-muted-foreground">Running automated control test...</p></div>
        ) : (
          <div className="space-y-3">
            {testCtrl?.status === "Failing" ? (
              <>
                <div className="text-sm text-red-400">Test Complete: 2 of 7 checks failed</div>
                <ul className="text-xs space-y-1 text-muted-foreground"><li>✗ Quarterly drill missing</li><li>✗ Documentation incomplete</li></ul>
              </>
            ) : <div className="text-sm text-emerald-400">Test Complete: Control passed all 7 automated checks</div>}
            <div className="flex gap-2"><Btn variant="outline" onClick={() => notify.info("Full report opened")}>Full Report</Btn><Btn variant="primary" onClick={() => { notify.success("Remediation task created"); setTestCtrl(null); }}>Create Task</Btn></div>
          </div>
        )}
      </Modal>

      <Modal open={!!auditModal} onClose={() => setAuditModal(null)} title="Schedule Audit" size="sm">
        <div className="space-y-3">
          <Input placeholder="Auditor name" className="w-full" />
          <Select><option>External</option><option>Internal</option></Select>
          <Input type="date" className="w-full" />
          <Btn variant="primary" className="w-full" onClick={() => { notify.success("Audit scheduled"); setAuditModal(null); }}>Schedule</Btn>
        </div>
      </Modal>

      <Modal open={!!actionApproval} onClose={() => setActionApproval(null)} title={`${actionApproval?.act} request`} size="sm" dismissOnBackdrop={false}>
        {actionApproval && (
          <div className="space-y-3">
            <Textarea placeholder={actionApproval.act === "Reject" ? "Reason (required)..." : "Notes (optional)..."} value={reason} onChange={e => setReason(e.target.value)} rows={3} />
            <div className="flex gap-2 justify-end">
              <Btn variant="outline" onClick={() => setActionApproval(null)}>Cancel</Btn>
              <Btn variant={actionApproval.act === "Approve" ? "success" : actionApproval.act === "Reject" ? "danger" : "primary"} disabled={actionApproval.act === "Reject" && !reason.trim()} onClick={() => {
                setApprovalStatus(actionApproval.a.id, actionApproval.act === "Approve" ? "Approved" : actionApproval.act === "Reject" ? "Rejected" : "Info Requested");
                notify.success(`${actionApproval.act === "Info" ? "Info requested" : actionApproval.act + "d"} — ${actionApproval.a.requestor} notified`);
                setActionApproval(null); setReason("");
              }}>Confirm</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
