# Drishti — Feature Matrix

What exists today, stated precisely. Anything not listed here as available is
not available. Nothing on a roadmap appears in this table.

**Status key**
- **Available** — working end to end, customer-visible, covered by tests
- **Available (API only)** — the platform supports it; no screen surfaces it yet

Verified against the running build at frontend `a34ff7d` / backend `ac99f3e`.

---

| Capability | What Drishti does | Status | Customer-visible workflow | Backend support | Notes |
|---|---|---|---|---|---|
| **Asset Discovery** | Maintains every system holding PHI, with volume, encryption and MFA status, and a derived risk band per system | Available | **Assets** — list, search, filter by band, sort; detail drawer with seven tabs (Overview, Risk, PHI, Flows, Access, Vendors, Threats); create, edit, archive, recompute risk | List, detail, create, update, archive, restore, assessment, recompute | Archived assets are hidden from the default list rather than deleted |
| **PHI Visibility** | Records the categories of PHI held and their sensitivity, and ties them to the systems and flows that carry them | Available | Surfaced per system in the asset drawer's **PHI** tab, and as the data type on each flow in the flow map | PHI types with sensitivity; import supported | No standalone PHI screen — PHI is shown in the context of the system or flow that holds it, which is where the question is usually asked |
| **Data Flow** | Maps every recorded movement of PHI between systems, with daily volume and encryption status | Available | **PHI Flow** — interactive map, node height and ribbon width proportional to volume, colour by encryption status; filter by PHI type and by violations; export the map as SVG | List, detail, create, update, delete | The map scrolls horizontally rather than shrinking, so labels stay readable on any screen |
| **Risk Intelligence** | Scores each system on likelihood × impact × exposure × control gap, derives the band, and recomputes automatically when an input changes | Available | **Risk Register** — every scored system ranked; risk matrix by likelihood and impact on the dashboard; per-system factors and manual recompute in the drawer | Scoring engine, per-subject history, automatic triggers on change | Exposure and control gap are derived from recorded facts, not estimated. Recompute is idempotent: unchanged inputs produce no new history |
| **Vendor Risk** | Tracks third parties touching PHI, their BAA status, what they can reach, and scores them with the same engine as assets | Available | **Vendors** — list with BAA state, PHI reachable, assessment currency and score; detail drawer with Overview, Risk and Assets tabs; create, edit, assess, recompute | List, detail, create, update, archive, assessment, recompute, risk history | Vendors and assets share one scoring engine and one history table, so the numbers are comparable |
| **Access Intelligence** | Flags every access grant that is stale, excessive, unused, missing MFA, or held by an inactive identity | Available | **Access & Identity** — every grant with its findings; filter by level and by flagged; detail drawer with grant and identity facts; reduce level, revoke, mark reviewed | List, summary, grant, update level, revoke, review | Marking a grant reviewed records that a human looked; it deliberately does not change who can reach what |
| **Threat Management** | Records detected threats against the systems they affect and moves them through a governed lifecycle | Available | **Threats** — list with severity and status, summary counts, filters; detail drawer showing only the status transitions the platform will accept from the current state | List, summary, detail, create, update, status transition | Illegal transitions are refused by the platform with the legal set named, not merely hidden in the interface |
| **Controls** | Records safeguards, how far each is implemented, and how effective it was assessed to be | Available | **Controls** — list with status and effectiveness; detail drawer showing covered assets, citing policies and open findings; create (admin); record assessment (admin or analyst) | List, detail, create, update, archive, link to assets | Framework references are citations the customer recorded. Drishti stores them as written and makes no conformance claim on their basis |
| **Policies** | Records written policy, its owner, its status and when it is next due for review | Available | **Policies** — list with status and review date; detail drawer with the cited controls; create and move through the lifecycle (admin) | List, detail, create, update, archive, link to controls | Evidence references are rendered as text, never as a live link — unvalidated customer input does not become a clickable destination in a compliance tool |
| **Remediation** | Tracks findings against the estate with owners, due dates and a lifecycle that records what was decided | Available | **Remediation** — list with severity, owner, due date and status; summary counters; detail drawer; create, assign, transition | List, summary, detail, create, update, assign, status transition | *Resolved* and *Risk accepted* stay distinct in every count. Closing a finding records a decision and does not alter the asset, control or threat it points at |
| **Audit** | Records every action with actor, subject, result and source address | Available | **Audit Trail** — newest first, filter by activity family, paginated; entry detail with sanitised metadata | List with filters; written only by the platform's own audit service | Read-only by design: there is no write path in the interface or the API, for any role. Administrators read it; nobody edits it. Credentials and patient identifiers are stripped before storage |
| **CSV Import** | Loads estate data in bulk with a validate-then-confirm step | Available | **Data Import** — pick a record type, download its template, upload, review the validation result, confirm. Nothing is written until confirmed | Contract, validate and commit for seven record types | Seven types: assets, PHI types, data flows, vendors, access grants, threats, risks. Admin only. Foreign keys resolve by name, so dependencies must be imported first — the template and guide say so |
| **Search** | One search across the estate | Available | Command palette (⌘K) and the header search; results grouped by type with context and status | Server-side across assets, vendors, risks, threats, identities, remediations, controls, policies | Scoped to the caller's organisation. Reports truncation honestly when the result set is capped |
| **RBAC** | Three roles, enforced by the platform | Available | Roles: **Admin**, **Analyst**, **Viewer**. The interface hides what a role cannot reach; the platform refuses it regardless | Permission matrix enforced per endpoint; field-level on control updates | Analyst may assess a control (status, effectiveness, last reviewed) but not reconfigure it; the refusal names the offending fields. Audit and import are admin-only |
| **Tenant Isolation** | Keeps each organisation's data separate | Available | Transparent — a user sees only their organisation | Every record carries an organisation; every query is scoped to the organisation in the signed session token | A request for another organisation's record returns **not found**, not *forbidden* — the platform does not confirm that the record exists |
| **Reporting** | Produces a risk assessment summary counted from recorded data | **Available (API only)** | **No screen surfaces this yet.** The dashboard and the audit trail are the reporting surfaces customers use today | `GET /api/reports/risk-assessment` returns a structured summary — assets, PHI, flows, access, vendors, threats, controls, remediation, risk distribution and top risks | Every figure is counted from persisted rows at request time. There is no compliance score and no invented weighting; the payload carries a disclaimer saying so. Do not demonstrate this as a feature |

---

## Deliberately absent

Worth stating plainly, because their absence is a design decision rather than
an omission:

- **No AI or ML features.** Nothing in Drishti infers, predicts or generates.
  Every number shown is counted or derived from recorded facts.
- **No automated remediation.** Drishti records that work was decided and
  done. It does not perform changes to the estate on a customer's behalf.
- **No compliance certification.** Drishti provides visibility and a record.
  Conformance with any framework remains the customer's determination.
- **No audit write path.** Not for administrators, not for support, not
  through the API.

## Known limitations

- **Reporting has no screen.** The endpoint exists and is accurate; nothing
  surfaces it. Customers export via the audit trail and the dashboard today.
- **Controls and policies are recorded, not enforced.** Drishti stores what a
  customer says is in place and how they assessed it. It does not test the
  control.
- **Data arrives by CSV or by hand.** There are no live connectors to EHRs,
  cloud providers or identity systems.
- **PHI has no standalone screen.** It is shown per system and per flow.
