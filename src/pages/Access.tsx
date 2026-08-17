import { useMemo, useState } from "react";
import { Card, KPI, Badge, Btn, Modal, SlideOver, Input, Select, Textarea, Gauge, SectionHeader } from "@/components/ui-bits";
import { users as initUsers } from "@/data/mock";
import { Users, ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";
import { useStore } from "@/store/AppStore";
import { notify } from "@/lib/notify";

type U = typeof initUsers[number];

export default function Access() {
  const { suspendedUsers, toggleSuspend } = useStore();
  const [users, setUsers] = useState(initUsers);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All");
  const [role, setRole] = useState("All");
  const [risk, setRisk] = useState("All");
  const [viewUser, setViewUser] = useState<U | null>(null);
  const [editUser, setEditUser] = useState<U | null>(null);
  const [breachUser, setBreachUser] = useState<U | null>(null);
  const [suspendUser, setSuspendUser] = useState<U | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => users.filter(u =>
    (search === "" || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.includes(search.toLowerCase()) || u.role.toLowerCase().includes(search.toLowerCase())) &&
    (dept === "All" || u.dept === dept) &&
    (role === "All" || u.role === role) &&
    (risk === "All" || (risk === "High" ? u.risk >= 70 : risk === "Medium" ? u.risk >= 40 && u.risk < 70 : risk === "Low" ? u.risk < 40 : true))
  ), [users, search, dept, role, risk]);

  const riskTone = (r: number) => r >= 70 ? "danger" : r >= 40 ? "warning" : "success";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPI icon={<Users size={16} />} label="Total Users" value="4,847" accent="info" />
        <KPI icon={<ShieldCheck size={16} />} label="Active Sessions" value="312" accent="info" />
        <KPI icon={<ShieldCheck size={16} />} label="MFA Enabled" value="4,621" trend="95.3%" accent="success" />
        <KPI icon={<ShieldAlert size={16} />} label="High Risk Users" value="8" accent="danger" />
        <KPI icon={<AlertTriangle size={16} />} label="Suspicious Sessions" value="2" accent="danger" />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <Input placeholder="Search by name, email, role..." value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
          <Select value={dept} onChange={e => setDept(e.target.value)}>
            {["All", "ICU", "Emergency", "Radiology", "Billing", "Pharmacy", "Oncology", "HR/Payroll", "IT Infra", "Compliance"].map(d => <option key={d}>{d}</option>)}
          </Select>
          <Select value={role} onChange={e => setRole(e.target.value)}>
            {["All", "Doctor", "Nurse", "Billing Analyst", "IT Admin", "Radiologist", "Pharmacist", "Compliance Officer", "HR Manager"].map(r => <option key={r}>{r}</option>)}
          </Select>
          <Select value={risk} onChange={e => setRisk(e.target.value)}>
            {["All", "Low", "Medium", "High", "Critical"].map(r => <option key={r}>{r}</option>)}
          </Select>
          <button onClick={() => { setSearch(""); setDept("All"); setRole("All"); setRisk("All"); }} className="text-xs text-primary hover:underline">Reset Filters</button>
          <div className="flex-1" />
          <Btn variant="primary" onClick={() => setAddOpen(true)}>+ Add User</Btn>
        </div>

        <div className="p-3 mb-3 bg-amber-500/10 border border-amber-500/30 rounded-md flex items-center gap-3">
          <AlertTriangle size={14} className="text-amber-400" />
          <span className="text-sm text-foreground">2 anomalous sessions detected in last 24 hours</span>
          <div className="flex-1" />
          <Btn variant="warning" onClick={() => { setRisk("High"); notify.info("Showing high risk users"); }}>Review Now</Btn>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground uppercase text-[10px]">
              <tr className="border-b border-border">
                {["User", "Email", "Role", "Department", "Access Level", "MFA", "Last Login", "Risk", "Actions"].map(h => <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-12 text-center"><Users size={24} className="mx-auto text-muted-foreground mb-2" /><div className="text-muted-foreground">No results found</div><Btn variant="outline" className="mt-2" onClick={() => { setSearch(""); setDept("All"); setRole("All"); setRisk("All"); }}>Clear Filters</Btn></td></tr>
              )}
              {filtered.map(u => {
                const suspended = suspendedUsers.has(u.id);
                const flagged = !!u.flag;
                return (
                  <tr key={u.id} className={`border-b border-border hover:bg-secondary/30 ${flagged ? "border-l-2 border-l-red-500" : ""}`}>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/40 to-emerald-500/40 flex items-center justify-center text-[10px] font-bold">{u.name.split(" ").map(p => p[0]).join("").slice(0, 2)}</div>
                        <span className="text-foreground">{u.name} {suspended && <Badge tone="danger" className="ml-1">SUSPENDED</Badge>}</span>
                      </div>
                    </td>
                    <td className="px-2 text-muted-foreground">{u.email}</td>
                    <td className="px-2">{u.role}</td>
                    <td className="px-2">{u.dept}</td>
                    <td className="px-2">{u.access}</td>
                    <td className="px-2">{u.mfa ? <Badge tone="success">✓ MFA</Badge> : <Badge tone="danger">✗ NO MFA</Badge>}</td>
                    <td className="px-2 text-muted-foreground">{u.login}</td>
                    <td className="px-2"><Badge tone={riskTone(u.risk) as any}>{u.risk}</Badge>{flagged && <div className="text-[10px] text-amber-400 mt-0.5">⚠ {u.flag}</div>}</td>
                    <td className="px-2">
                      <div className="flex gap-1">
                        <Btn variant="outline" onClick={() => setViewUser(u)}>View</Btn>
                        <Btn variant="outline" onClick={() => setEditUser(u)}>Edit</Btn>
                        {(flagged || suspended) && <Btn variant={suspended ? "success" : "danger"} onClick={() => suspended ? toggleSuspend(u.id) : setSuspendUser(u)}>{suspended ? "Restore" : "Suspend"}</Btn>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border mt-3 text-xs text-muted-foreground">
          <span>Showing 1–{filtered.length} of 4,847 users</span>
          <div className="flex gap-1">
            <Btn variant="outline">Prev</Btn>
            <Btn variant="outline">Next</Btn>
          </div>
        </div>
      </Card>

      {/* View user slide-over */}
      <SlideOver open={!!viewUser} onClose={() => setViewUser(null)} title={viewUser?.name} width={420}>
        {viewUser && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/40 to-emerald-500/40 flex items-center justify-center text-base font-bold">{viewUser.name.split(" ").map(p => p[0]).join("").slice(0, 2)}</div>
              <div>
                <div className="font-semibold text-foreground">{viewUser.name}</div>
                <div className="text-xs text-muted-foreground">{viewUser.email}</div>
                <div className="text-xs text-muted-foreground">{viewUser.role} · {viewUser.dept}</div>
              </div>
            </div>
            <div className="flex items-center justify-center"><Gauge value={viewUser.risk} color={viewUser.risk >= 70 ? "#EF4444" : viewUser.risk >= 40 ? "#F59E0B" : "#10B981"} label="Risk Score" /></div>

            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Access Permissions</div>
              <ul className="space-y-1">
                {[["Epic EHR", viewUser.role.includes("Doctor") ? "Read/Write" : "Read"], ["Billing System", viewUser.dept === "Billing" ? "Full" : "None"], ["Pharmacy", viewUser.dept === "Pharmacy" ? "R/W" : "None"], ["Audit Logs", "None"]].map(p => (
                  <li key={p[0]} className="flex justify-between text-xs"><span className="text-muted-foreground">{p[0]}</span><Badge tone={p[1] === "None" ? "muted" : p[1] === "Full" ? "danger" : "info"}>{p[1]}</Badge></li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Recent Activity</div>
              <ul className="text-xs space-y-1.5">
                <li className="text-muted-foreground"><span className="text-foreground">{viewUser.login}</span> — Login from 10.0.1.45</li>
                <li className="text-muted-foreground">8:42 AM — Accessed P-8847 EHR</li>
                <li className="text-muted-foreground">8:30 AM — Generated daily report</li>
                <li className="text-muted-foreground">8:15 AM — Policy acknowledgement</li>
                <li className="text-muted-foreground">8:01 AM — Session started</li>
              </ul>
            </div>

            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Active Session</div>
              <div className="text-xs bg-secondary/50 p-2 rounded border border-border">
                <div>IP: 10.0.{viewUser.id}.45</div>
                <div>Hospital A — Floor 3</div>
                <div>Chrome 124 / macOS</div>
                <div>Duration: 2h 14m</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border">
              <Btn variant="danger" onClick={() => setBreachUser(viewUser)}>Simulate Breach</Btn>
              <Btn variant="danger" onClick={() => { notify.success(`Access revoked for ${viewUser.name}`); setViewUser(null); }}>Revoke Access</Btn>
              <Btn variant="outline" onClick={() => notify.success(`MFA reset email sent to ${viewUser.email}`)}>Reset MFA</Btn>
              <Btn variant="outline" onClick={() => notify.success("Report downloading...")}>Download Report</Btn>
            </div>
          </div>
        )}
      </SlideOver>

      {/* Edit user */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User" size="sm">
        {editUser && <UserForm initial={editUser} onSubmit={() => { setEditUser(null); notify.success("User updated"); }} />}
      </Modal>

      {/* Add user */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add User" size="sm">
        <UserForm onSubmit={() => { setAddOpen(false); notify.success("User created successfully"); }} />
      </Modal>

      {/* Breach Simulator */}
      <Modal open={!!breachUser} onClose={() => setBreachUser(null)} title={`⚠ Breach Impact Simulation — ${breachUser?.name}`} size="lg">
        {breachUser && <BreachSim user={breachUser} onClose={() => setBreachUser(null)} />}
      </Modal>

      {/* Suspend confirm */}
      <Modal open={!!suspendUser} onClose={() => setSuspendUser(null)} title="Confirm Suspension" size="sm" dismissOnBackdrop={false}>
        {suspendUser && (
          <div>
            <p className="text-sm text-foreground mb-4">Suspend access for <span className="font-semibold">{suspendUser.name}</span>? This will immediately terminate all active sessions.</p>
            <div className="flex gap-2 justify-end">
              <Btn variant="outline" onClick={() => setSuspendUser(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={() => { toggleSuspend(suspendUser.id); notify.success(`${suspendUser.name} suspended`); setSuspendUser(null); setViewUser(null); }}>Confirm Suspend</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function UserForm({ initial, onSubmit }: { initial?: U; onSubmit: () => void }) {
  return (
    <div className="space-y-3">
      <div><label className="text-xs text-muted-foreground">Name</label><Input className="w-full" defaultValue={initial?.name} /></div>
      <div><label className="text-xs text-muted-foreground">Email</label><Input className="w-full" defaultValue={initial?.email} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><label className="text-xs text-muted-foreground">Department</label><Select className="w-full" defaultValue={initial?.dept}>{["ICU", "Emergency", "Radiology", "Billing", "Pharmacy", "Oncology", "HR/Payroll", "IT Infra", "Compliance"].map(d => <option key={d}>{d}</option>)}</Select></div>
        <div><label className="text-xs text-muted-foreground">Role</label><Select className="w-full" defaultValue={initial?.role}>{["Doctor", "Nurse", "Billing Analyst", "IT Admin", "Radiologist", "Pharmacist", "Compliance Officer", "HR Manager"].map(r => <option key={r}>{r}</option>)}</Select></div>
      </div>
      <div><label className="text-xs text-muted-foreground">Access Level</label><Select className="w-full" defaultValue={initial?.access}><option>Clinical Read</option><option>Clinical R/W</option><option>System Admin</option><option>Financial Full</option></Select></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked={initial?.mfa ?? true} className="accent-primary" /> MFA Enabled</label>
      <Btn variant="primary" className="w-full" onClick={onSubmit}>Save</Btn>
    </div>
  );
}

function BreachSim({ user, onClose }: { user: U; onClose: () => void }) {
  const high = user.risk >= 70;
  const records = high ? 847293 : Math.round(user.risk * 1300);
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">If this account were compromised...</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded">
          <div className="text-xs text-muted-foreground">PHI at risk</div>
          <div className="text-2xl font-bold text-red-400">{records.toLocaleString()}</div>
        </div>
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded">
          <div className="text-xs text-muted-foreground">Time to detection</div>
          <div className="text-2xl font-bold text-amber-400">4.2 hrs</div>
        </div>
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded">
          <div className="text-xs text-muted-foreground">Estimated HIPAA fine</div>
          <div className="text-2xl font-bold text-red-400">{high ? "$2.1M – $4.8M" : "$200K – $800K"}</div>
        </div>
      </div>
      <div>
        <div className="text-xs uppercase text-muted-foreground mb-1">Downstream Systems Exposed</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {["Epic EHR Core", "Billing Engine", "Insurance Gateway"].map(s => (
            <div key={s} className="p-2 bg-secondary/50 rounded border border-border text-xs">{s}</div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs uppercase text-muted-foreground mb-1">Lateral Movement Risk</div>
        <div className="flex gap-2">{["Billing", "Insurance", "HR/Payroll"].map(d => <Badge key={d} tone="warning">{d}</Badge>)}</div>
      </div>
      <div>
        <div className="text-xs uppercase text-muted-foreground mb-1">Regulatory Impact</div>
        <div className="flex gap-2"><Badge tone="danger">HIPAA HIGH</Badge><Badge tone="warning">SOC 2 MEDIUM</Badge><Badge tone="warning">ISO 27001 MEDIUM</Badge></div>
      </div>
      <div>
        <div className="text-xs uppercase text-muted-foreground mb-1">Recommended Actions</div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="primary" onClick={() => notify.success("MFA enforcement queued")}>Enforce MFA Now</Btn>
          <Btn variant="warning" onClick={() => notify.success("Access scope reduced")}>Reduce Access Scope</Btn>
          <Btn variant="outline" onClick={() => notify.success("Enhanced monitoring enabled")}>Enable Monitoring</Btn>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <Btn variant="outline" onClick={onClose}>Close</Btn>
        <Btn variant="primary" onClick={() => { notify.success("Incident report generated"); onClose(); }}>Generate Incident Report</Btn>
      </div>
    </div>
  );
}
