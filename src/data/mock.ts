export const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#EF4444",
  HIGH: "#F59E0B",
  MEDIUM: "#FB923C",
  LOW: "#3B82F6",
  INFO: "#3B82F6",
};

export const initialNotifications = [
  { id: 1, sev: "CRITICAL", title: "Bulk data export attempt", desc: "Billing dept", time: "2 mins ago", page: "/threats" },
  { id: 2, sev: "CRITICAL", title: "Tor exit node login detected", desc: "IT Infrastructure", time: "8 mins ago", page: "/threats" },
  { id: 3, sev: "HIGH", title: "RiskScoreAI bias drift detected", desc: "AI/Clinical", time: "1 hour ago", page: "/ai" },
  { id: 4, sev: "HIGH", title: "PHI email policy violation", desc: "Oncology", time: "2 hours ago", page: "/policy" },
  { id: 5, sev: "MEDIUM", title: "MFA disabled: j.wilson@meridian.org", desc: "HR notice", time: "3 hours ago", page: "/access" },
  { id: 6, sev: "MEDIUM", title: "HITRUST audit due in 14 days", desc: "Compliance", time: "5 hours ago", page: "/policy" },
  { id: 7, sev: "INFO", title: "Compliance report generated", desc: "Daily report", time: "Yesterday", page: "/audit" },
];

export const frameworks = [
  { name: "HIPAA", score: 96, controls: "234/243", last: "Mar 15 2025", next: "Sep 15 2025", color: "#10B981", overdue: false },
  { name: "SOC 2 Type II", score: 91, controls: "187/205", last: "Jan 20 2025", next: "Jul 20 2025", color: "#10B981", overdue: false },
  { name: "ISO 27001", score: 88, controls: "312/354", last: "Feb 01 2025", next: "Aug 01 2025", color: "#F59E0B", overdue: false },
  { name: "HITRUST", score: 79, controls: "289/365", last: "Nov 2024", next: "May 19 2025", color: "#EF4444", overdue: true },
];

export const recentAlerts = [
  { id: "A-2849", sev: "CRITICAL", type: "Bulk Export", dept: "Billing", time: "9:14 AM" },
  { id: "A-2848", sev: "CRITICAL", type: "Tor Login", dept: "IT Infra", time: "7:32 AM" },
  { id: "A-2847", sev: "HIGH", type: "Bias Drift", dept: "AI/Clinical", time: "6:18 AM" },
  { id: "A-2846", sev: "HIGH", type: "PHI Email", dept: "Oncology", time: "Yesterday 8:55 PM" },
  { id: "A-2845", sev: "MEDIUM", type: "MFA Disabled", dept: "HR", time: "Yesterday 6:30 PM" },
];

export const departmentRisks = [
  { dept: "Billing & Coding", risk: 72 },
  { dept: "Pharmacy", risk: 51 },
  { dept: "HR/Payroll", risk: 51 },
  { dept: "Emergency Dept", risk: 38 },
  { dept: "Radiology", risk: 29 },
  { dept: "IT Infrastructure", risk: 29 },
  { dept: "Oncology", risk: 22 },
  { dept: "ICU", risk: 18 },
];

export const activitySamples = [
  { user: "n.kowalski", action: "accessed record", res: "P-8847 EHR" },
  { user: "SYSTEM", action: "verified control", res: "C-002 MFA" },
  { user: "DiagnosticAI", action: "logged decision", res: "P-1122 scan" },
  { user: "k.park", action: "policy check passed", res: "Password v2.1" },
  { user: "a.patel", action: "user login", res: "Hospital A" },
  { user: "SYSTEM", action: "report generated", res: "HIPAA daily" },
  { user: "j.wilson", action: "access denied", res: "Admin panel" },
  { user: "ClaimsCodingAI", action: "AI decision logged", res: "ICD-10 J18.9" },
  { user: "p.sharma", action: "record accessed", res: "P-9012 EHR" },
  { user: "fatima.alrashid", action: "compliance check", res: "HIPAA suite" },
];

export const users = [
  { id: 1, name: "Dr. Aisha Patel", email: "a.patel@meridian.org", role: "Doctor", dept: "ICU", access: "Clinical R/W", mfa: true, login: "Today 8:23 AM", risk: 12 },
  { id: 2, name: "Marcus Thompson", email: "m.thompson@meridian.org", role: "IT Admin", dept: "IT Infra", access: "System Admin", mfa: true, login: "Today 9:14 AM", risk: 34 },
  { id: 3, name: "James Wilson", email: "j.wilson@meridian.org", role: "Billing Analyst", dept: "Billing", access: "Financial Full", mfa: false, login: "Today 7:32 AM", risk: 89, flag: "No MFA + sensitive access" },
  { id: 4, name: "Dr. Priya Sharma", email: "p.sharma@meridian.org", role: "Doctor", dept: "Oncology", access: "Clinical R/W", mfa: true, login: "Today 7:55 AM", risk: 18 },
  { id: 5, name: "Nina Kowalski", email: "n.kowalski@meridian.org", role: "Nurse", dept: "Emergency", access: "Clinical Read", mfa: true, login: "Today 9:02 AM", risk: 22 },
  { id: 6, name: "Robert Chen", email: "r.chen@meridian.org", role: "Radiologist", dept: "Radiology", access: "Radiology Full", mfa: true, login: "Yesterday 11:44 PM", risk: 71, flag: "Login 11:44 PM new device" },
  { id: 7, name: "Sarah Mitchell", email: "s.mitchell@meridian.org", role: "Pharmacist", dept: "Pharmacy", access: "Pharmacy R/W", mfa: true, login: "Today 6:18 AM", risk: 29 },
  { id: 8, name: "David Kim", email: "d.kim@meridian.org", role: "Billing Analyst", dept: "Billing", access: "Financial Full", mfa: true, login: "Today 8:01 AM", risk: 44 },
  { id: 9, name: "Emily Torres", email: "e.torres@meridian.org", role: "HR Manager", dept: "HR/Payroll", access: "HR Full", mfa: true, login: "Yesterday 3:22 PM", risk: 31 },
  { id: 10, name: "Dr. Liam O'Brien", email: "l.obrien@meridian.org", role: "Doctor", dept: "Radiology", access: "Clinical R/W", mfa: true, login: "Today 7:48 AM", risk: 15 },
  { id: 11, name: "Fatima Al-Rashid", email: "f.alrashid@meridian.org", role: "Compliance Officer", dept: "Compliance", access: "Full Audit", mfa: true, login: "Today 9:30 AM", risk: 8 },
  { id: 12, name: "Tyler Brooks", email: "t.brooks@meridian.org", role: "Nurse", dept: "ICU", access: "Clinical Read", mfa: true, login: "Today 8:55 AM", risk: 19 },
  { id: 13, name: "Maria Santos", email: "m.santos@meridian.org", role: "Billing Analyst", dept: "Billing", access: "Financial Full", mfa: false, login: "Today 7:32 AM", risk: 94, flag: "Bulk download 847 records" },
  { id: 14, name: "Kevin Park", email: "k.park@meridian.org", role: "IT Admin", dept: "IT Infra", access: "System Admin", mfa: true, login: "Today 8:40 AM", risk: 27 },
  { id: 15, name: "Dr. Ananya Iyer", email: "an.iyer@meridian.org", role: "Doctor", dept: "Pharmacy", access: "Clinical R/W", mfa: true, login: "Today 8:12 AM", risk: 11 },
];

export const alerts = [
  { id: "A-2847", sev: "CRITICAL", type: "Data Exfiltration", desc: "Bulk download 847 records by m.santos", dept: "Billing", time: "07:32 AM", status: "Investigating", assigned: "IT Security Team" },
  { id: "A-2846", sev: "CRITICAL", type: "Unauthorized Access", desc: "Login from Tor exit node 185.220.xx.xx", dept: "IT Infra", time: "09:14 AM", status: "Open", assigned: "Unassigned" },
  { id: "A-2845", sev: "HIGH", type: "AI Bias Drift", desc: "RiskScoreAI demographic disparity detected", dept: "AI/Clinical", time: "06:18 AM", status: "Open", assigned: "CMO Office" },
  { id: "A-2844", sev: "HIGH", type: "Policy Violation", desc: "PHI sent via unencrypted email attachment", dept: "Oncology", time: "Yesterday 8:55 PM", status: "Open", assigned: "Compliance" },
  { id: "A-2843", sev: "HIGH", type: "Privilege Escalation", desc: "Admin panel accessed outside role permissions", dept: "IT Infra", time: "Yesterday 11:22 PM", status: "Resolved", assigned: "Kevin Park" },
  { id: "A-2842", sev: "MEDIUM", type: "MFA Failure", desc: "3 failed MFA challenges for j.wilson", dept: "Billing", time: "Yesterday 6:30 PM", status: "Resolved", assigned: "IT Admin" },
  { id: "A-2841", sev: "MEDIUM", type: "Anomalous Login", desc: "Login at 11:44 PM from new device", dept: "Radiology", time: "Yesterday 11:44 PM", status: "Resolved", assigned: "Auto resolved" },
  { id: "A-2840", sev: "MEDIUM", type: "PHI Encryption", desc: "Unencrypted field in billing pipeline", dept: "Billing", time: "2 days ago", status: "Investigating", assigned: "IT Security" },
  { id: "A-2839", sev: "LOW", type: "Policy Update", desc: "Clinical data sharing policy edited", dept: "Compliance", time: "2 days ago", status: "Resolved", assigned: "Auto" },
  { id: "A-2838", sev: "LOW", type: "User Added", desc: "New user account created in Pharmacy", dept: "HR", time: "2 days ago", status: "Resolved", assigned: "HR Admin" },
  { id: "A-2837", sev: "MEDIUM", type: "Session Timeout", desc: "Multiple sessions not logged out properly", dept: "Emergency", time: "3 days ago", status: "Resolved", assigned: "Auto" },
  { id: "A-2836", sev: "LOW", type: "Report Export", desc: "Compliance report exported", dept: "Compliance", time: "3 days ago", status: "Resolved", assigned: "Auto" },
];

export const policies = [
  { name: "PHI Data Retention Policy", cat: "Data Privacy", status: "Active", enforce: 100, last: "30 days ago", owner: "Legal Team", review: "Jun 2025" },
  { name: "Password Complexity & Rotation", cat: "Security", status: "Active", enforce: 94, last: "45 days ago", owner: "IT Security", review: "Aug 2025", note: "6 exceptions" },
  { name: "Remote Access & VPN Policy", cat: "Security", status: "Active", enforce: 89, last: "60 days ago", owner: "IT Admin", review: "Jul 2025" },
  { name: "AI Output Review Protocol", cat: "AI Governance", status: "Draft", enforce: 0, last: "—", owner: "CMO Office", review: "May 30 2025" },
  { name: "Emergency Override Protocol", cat: "Clinical", status: "Active", enforce: 100, last: "15 days ago", owner: "Clinical Ops", review: "Dec 2025" },
  { name: "Third Party Vendor Assessment", cat: "Risk", status: "Active", enforce: 91, last: "20 days ago", owner: "Procurement", review: "Sep 2025" },
  { name: "Clinical Data Sharing Protocol", cat: "Data Privacy", status: "Active", enforce: 97, last: "7 days ago", owner: "Compliance", review: "Oct 2025" },
  { name: "Incident Response Playbook", cat: "Security", status: "Review Needed", enforce: 100, last: "45 days ago", owner: "IT Security", review: "May 1 2025", overdue: true },
];

export const controls = [
  { id: "C-001", name: "Encryption at rest", fw: ["HIPAA", "SOC2"], status: "Passing", owner: "IT Security", last: "Today 6:00 AM", next: "Jun 2025" },
  { id: "C-002", name: "MFA enforcement", fw: ["HIPAA", "SOC2", "ISO"], status: "Passing", owner: "IT Admin", last: "Today 6:00 AM", next: "Jun 2025" },
  { id: "C-003", name: "Access log retention", fw: ["HIPAA"], status: "Passing", owner: "Compliance", last: "Yesterday", next: "Jun 2025" },
  { id: "C-004", name: "PHI data masking", fw: ["HIPAA", "HITRUST"], status: "Passing", owner: "IT Security", last: "2 days ago", next: "Jun 2025" },
  { id: "C-005", name: "Vendor risk assessment", fw: ["SOC2", "ISO"], status: "In Review", owner: "Procurement", last: "5 days ago", next: "May 2025" },
  { id: "C-006", name: "Incident response test", fw: ["SOC2", "HITRUST"], status: "Failing", owner: "IT Security", last: "30 days ago", next: "Overdue" },
  { id: "C-007", name: "AI model validation", fw: ["ISO", "HITRUST"], status: "In Review", owner: "CMO Office", last: "3 days ago", next: "May 2025" },
  { id: "C-008", name: "Data backup & recovery", fw: ["HIPAA", "SOC2"], status: "Passing", owner: "IT Admin", last: "Today", next: "Jul 2025" },
  { id: "C-009", name: "User access review", fw: ["HIPAA", "SOC2"], status: "Passing", owner: "Compliance", last: "1 week ago", next: "Aug 2025" },
  { id: "C-010", name: "Network segmentation", fw: ["ISO"], status: "Passing", owner: "IT Security", last: "Today", next: "Jul 2025" },
  { id: "C-011", name: "Penetration testing", fw: ["SOC2", "HITRUST"], status: "Passing", owner: "IT Security", last: "Last quarter", next: "Q3 2025" },
  { id: "C-012", name: "Vulnerability scanning", fw: ["HIPAA", "ISO"], status: "Passing", owner: "IT Security", last: "Today", next: "Jun 2025" },
  { id: "C-013", name: "Endpoint protection", fw: ["HIPAA"], status: "Passing", owner: "IT Admin", last: "Today", next: "Jun 2025" },
  { id: "C-014", name: "Disaster recovery plan", fw: ["SOC2", "HITRUST"], status: "In Review", owner: "IT Ops", last: "10 days ago", next: "Jun 2025" },
  { id: "C-015", name: "Security awareness training", fw: ["HIPAA"], status: "Passing", owner: "HR", last: "Last month", next: "Jul 2025" },
  { id: "C-016", name: "Mobile device management", fw: ["HIPAA"], status: "Passing", owner: "IT Admin", last: "Today", next: "Jun 2025" },
  { id: "C-017", name: "Audit logging coverage", fw: ["HIPAA", "SOC2"], status: "Passing", owner: "IT Security", last: "Today", next: "Jun 2025" },
  { id: "C-018", name: "Data classification", fw: ["ISO"], status: "In Review", owner: "Compliance", last: "1 week ago", next: "May 2025" },
  { id: "C-019", name: "Third party SLAs", fw: ["SOC2"], status: "Passing", owner: "Procurement", last: "2 weeks ago", next: "Jul 2025" },
  { id: "C-020", name: "Privacy impact assessment", fw: ["HIPAA", "ISO"], status: "Passing", owner: "Legal", last: "1 month ago", next: "Aug 2025" },
];

export const approvals = [
  { id: 1, type: "Policy Edit", requestor: "Sarah Mitchell", desc: "Updated PHI retention period from 6 to 7 years", submitted: "2 days ago", due: "May 10" },
  { id: 2, type: "Access Request", requestor: "Tyler Brooks", desc: "Requesting read access to Billing reports", submitted: "1 day ago", due: "May 8" },
  { id: 3, type: "Exception Request", requestor: "David Kim", desc: "MFA exception for shared radiology workstation (30 days)", submitted: "today", due: "May 9" },
];

export const aiDecisions = [
  { id: "LOG-4821", model: "DiagnosticAI", patient: "P-8847", decision: "Pneumonia — High likelihood", conf: 94, reviewed: true, outcome: "Confirmed", time: "09:12 AM", flag: false },
  { id: "LOG-4820", model: "ClaimsCodingAI", patient: "P-2341", decision: "ICD-10: J18.9 applied", conf: 99, reviewed: false, outcome: "Auto approved", time: "09:08 AM", flag: false },
  { id: "LOG-4819", model: "RiskScoreAI", patient: "P-9923", decision: "Triage Priority: 3", conf: 78, reviewed: true, outcome: "Changed to Priority 2", time: "08:55 AM", flag: true },
  { id: "LOG-4818", model: "DiagnosticAI", patient: "P-1122", decision: "Normal scan — no findings", conf: 97, reviewed: false, outcome: "Confirmed", time: "08:41 AM", flag: false },
  { id: "LOG-4817", model: "ClaimsCodingAI", patient: "P-5504", decision: "ICD-10: I21.0 applied", conf: 96, reviewed: false, outcome: "Auto approved", time: "08:30 AM", flag: false },
  { id: "LOG-4816", model: "RiskScoreAI", patient: "P-7741", decision: "Triage Priority: 4", conf: 71, reviewed: true, outcome: "Changed to Priority 2", time: "08:15 AM", flag: true },
  { id: "LOG-4815", model: "DiagnosticAI", patient: "P-3310", decision: "Pneumothorax detected", conf: 89, reviewed: true, outcome: "Confirmed", time: "08:02 AM", flag: false },
  { id: "LOG-4814", model: "ClaimsCodingAI", patient: "P-8820", decision: "ICD-10: K35.8 applied", conf: 98, reviewed: false, outcome: "Auto approved", time: "07:55 AM", flag: false },
  { id: "LOG-4813", model: "RiskScoreAI", patient: "P-4401", decision: "Triage Priority: 3", conf: 80, reviewed: false, outcome: "Auto approved", time: "07:44 AM", flag: false },
  { id: "LOG-4812", model: "DiagnosticAI", patient: "P-6603", decision: "Normal scan", conf: 92, reviewed: false, outcome: "Confirmed", time: "07:30 AM", flag: false },
];

export const auditLog = [
  { ts: "09:31:44 AM", user: "Dr. Aisha Patel", action: "LOGIN", res: "System", ip: "10.0.1.45", loc: "Hospital A — Floor 3", result: "Success" },
  { ts: "09:29:12 AM", user: "m.santos@meridian", action: "BULK_DOWNLOAD", res: "Patient Records (847 files)", ip: "10.0.2.33", loc: "Billing Office", result: "FLAGGED" },
  { ts: "09:14:22 AM", user: "m.thompson", action: "ADMIN_ACCESS", res: "System Configuration Panel", ip: "10.0.1.12", loc: "IT Server Room", result: "Success" },
  { ts: "09:08:44 AM", user: "ClaimsCodingAI", action: "AI_DECISION", res: "Claim ICD-10 P-2341", ip: "System", loc: "Automated", result: "Success" },
  { ts: "09:02:11 AM", user: "n.kowalski", action: "RECORD_ACCESS", res: "Patient P-8847 EHR", ip: "10.0.3.71", loc: "Emergency — Desk 4", result: "Success" },
  { ts: "08:55:33 AM", user: "r.chen", action: "ANOMALOUS_LOGIN", res: "System", ip: "185.220.101.45", loc: "Unknown — Tor Exit", result: "BLOCKED" },
  { ts: "08:41:02 AM", user: "DiagnosticAI", action: "AI_DECISION", res: "Radiology scan P-1122", ip: "System", loc: "Automated", result: "Success" },
  { ts: "08:30:19 AM", user: "k.park", action: "POLICY_CHANGE", res: "Password Policy v2.1", ip: "10.0.1.89", loc: "IT Server Room", result: "Success" },
  { ts: "08:22:47 AM", user: "p.sharma", action: "RECORD_ACCESS", res: "Patient P-9012 EHR", ip: "10.0.4.22", loc: "Oncology — Ward B", result: "Success" },
  { ts: "08:15:03 AM", user: "RiskScoreAI", action: "AI_DECISION_OVERRIDE", res: "Triage P-7741 (Priority changed)", ip: "System", loc: "Automated", result: "Override" },
  { ts: "08:01:55 AM", user: "a.patel", action: "REPORT_EXPORT", res: "HIPAA Compliance Report Q1", ip: "10.0.1.45", loc: "Hospital A", result: "Success" },
  { ts: "07:55:22 AM", user: "j.wilson", action: "LOGIN_ATTEMPT", res: "System", ip: "203.0.113.44", loc: "External Network", result: "FAILED" },
  { ts: "07:48:11 AM", user: "l.obrien", action: "RECORD_ACCESS", res: "Radiology PACS P-3310", ip: "10.0.5.14", loc: "Radiology Suite", result: "Success" },
  { ts: "07:32:08 AM", user: "m.santos", action: "RECORD_ACCESS", res: "Patient Records bulk query", ip: "10.0.2.33", loc: "Billing Office", result: "FLAGGED" },
  { ts: "07:30:44 AM", user: "s.mitchell", action: "MEDICATION_ACCESS", res: "Pharmacy records P-6198", ip: "10.0.6.55", loc: "Pharmacy", result: "Success" },
  { ts: "Yesterday 11:44 PM", user: "r.chen", action: "ANOMALOUS_LOGIN", res: "System", ip: "192.168.99.1", loc: "New device — Mobile", result: "Flagged" },
  { ts: "Yesterday 10:22 PM", user: "SYSTEM", action: "BACKUP_COMPLETE", res: "All databases", ip: "System", loc: "Automated", result: "Success" },
  { ts: "Yesterday 8:55 PM", user: "p.sharma", action: "EMAIL_SEND", res: "PHI attachment to ext. address", ip: "10.0.4.22", loc: "Oncology", result: "POLICY VIOLATION" },
  { ts: "Yesterday 6:30 PM", user: "SYSTEM", action: "MFA_ALERT", res: "j.wilson account — 3 failures", ip: "System", loc: "Automated", result: "Alert" },
  { ts: "Yesterday 5:14 PM", user: "fatima.alrashid", action: "COMPLIANCE_CHECK", res: "HIPAA control suite full run", ip: "10.0.7.01", loc: "Compliance Office", result: "Success" },
];

export const risks = [
  { id: "R-001", name: "Ransomware Attack on EHR", cat: "Cybersecurity", L: 4, I: 5, owner: "IT Security", status: "Mitigating", due: "May 30" },
  { id: "R-002", name: "HIPAA Breach via Vendor", cat: "Compliance", L: 3, I: 4, owner: "Legal Team", status: "Open", due: "Jun 15" },
  { id: "R-003", name: "Clinical AI Bias (Triage)", cat: "AI Governance", L: 3, I: 4, owner: "CMO Office", status: "Open", due: "May 20" },
  { id: "R-004", name: "PHI Overprovisioned Access", cat: "IAM", L: 4, I: 3, owner: "IT Admin", status: "Mitigating", due: "May 25" },
  { id: "R-005", name: "HITRUST Audit Readiness Gap", cat: "Compliance", L: 2, I: 4, owner: "Compliance", status: "Open", due: "May 19" },
  { id: "R-006", name: "Insider Threat — Billing", cat: "Insider Risk", L: 3, I: 3, owner: "HR + Security", status: "Investigating", due: "Jun 1" },
  { id: "R-007", name: "EHR System Downtime (>4hr)", cat: "Operational", L: 2, I: 4, owner: "IT Ops", status: "Mitigating", due: "Jul 1" },
  { id: "R-008", name: "Third Party API Vulnerabilities", cat: "Cybersecurity", L: 2, I: 3, owner: "IT Security", status: "Open", due: "Jun 30" },
  { id: "R-009", name: "Staff Training Compliance Gap", cat: "Compliance", L: 3, I: 2, owner: "HR", status: "Open", due: "May 31" },
  { id: "R-010", name: "Data Backup Failure", cat: "Operational", L: 1, I: 4, owner: "IT Ops", status: "Mitigating", due: "Jul 15" },
  { id: "R-011", name: "Shadow IT Usage", cat: "Cybersecurity", L: 2, I: 2, owner: "IT Admin", status: "Open", due: "Jun 15" },
  { id: "R-012", name: "Physical Access Control", cat: "Physical", L: 1, I: 3, owner: "Facilities", status: "Closed", due: "—" },
];

export const riskScoreOf = (L: number, I: number) => {
  // Map approximated to spec
  const map: Record<string, number> = {
    "4-5": 95, "3-4": 72, "3-4-2": 68, "4-3": 61, "2-4": 48, "3-3": 44,
    "2-4-2": 41, "2-3": 35, "3-2": 31, "1-4": 22, "2-2": 18, "1-3": 14,
  };
  return map[`${L}-${I}`] ?? L * I * 4;
};
