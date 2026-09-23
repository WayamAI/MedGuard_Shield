# DRISHTI
### Healthcare PHI Risk Intelligence

---

## The problem

Healthcare organisations can usually tell you which systems they run. Very few
can tell you **where patient data actually lives, how it moves between those
systems, who can reach it, and which of their vendors is exposed.**

That information does exist. It is spread across spreadsheets that go stale
the week they are written, ticket queues, vendor folders, and the memories of
people who may not be there next year. When a regulator, an auditor or an
incident asks the question, the answer has to be reassembled by hand.

Meanwhile the ordinary drift continues: a contractor leaves and keeps their
access, a vendor agreement lapses, a system nobody owns keeps sending records
somewhere unencrypted. None of these are exotic attacks. They are the things
that were already true and nobody could see.

## The solution

Drishti keeps a live picture of the PHI estate and the risk in it — and keeps
a record of what was found, who was told, and what was decided.

It answers six questions continuously:

1. **Where does PHI live?** Every system, what it holds, how much.
2. **How does it move?** Every mapped flow, its volume, and whether it is encrypted.
3. **Who can reach it?** Every identity and service account, and what is wrong with each grant.
4. **Which vendors are exposed?** Who touches what, and whether the agreement covering them is valid.
5. **Where does risk concentrate?** A derived score per system and per vendor, not a label someone typed.
6. **Did anything actually get fixed?** Findings, owners, decisions, and an audit trail nobody can edit.

## Core capabilities

| | |
|---|---|
| **Asset inventory** | Every system holding PHI, with volume, encryption and MFA status |
| **PHI visibility** | The categories of data held, by sensitivity |
| **Data flow mapping** | Volume and encryption status of every mapped movement between systems |
| **Risk intelligence** | Derived scoring per asset and per vendor, recomputed automatically when an input changes |
| **Vendor risk** | BAA status, PHI reachable, assessment currency, scored by the same engine |
| **Access intelligence** | Stale, excessive, unused, inactive-identity and missing-MFA grants, flagged |
| **Threat management** | Detected threats with a governed status lifecycle |
| **Controls & policies** | Recorded safeguards with assessed status and effectiveness; written policy with review dates |
| **Remediation** | Findings with owners, due dates and a lifecycle that keeps *resolved* and *risk accepted* apart |
| **Audit trail** | Every action recorded, read-only, with no write path for anyone |
| **CSV import** | Seven record types, validated and previewed before anything is written |
| **Search** | One search across assets, vendors, threats, identities and findings |

## How it works

**1 — Record the estate.** Import systems, PHI types, flows, vendors,
identities and access grants by CSV, or add them directly.

**2 — Drishti derives the risk.** Each system and vendor is scored on
likelihood, impact, exposure and control gap. Exposure and control gap come
from facts already recorded — encryption, MFA, vendor agreements, applied
controls — rather than from an estimate. Change one of those facts and the
score recomputes on its own.

**3 — The gaps surface.** Unencrypted flows, missing agreements, stale
administrator access, systems never assessed. The dashboard's Action Centre
lists them worst-first, each linking to the record behind it.

**4 — Work gets tracked.** Raise a finding, assign it, move it through its
lifecycle, and record whether it was fixed or the risk was accepted.

**5 — The record stands.** Every action lands in an audit trail that is
read-only for everyone, including administrators.

## Key workflows

- **Estate review** — dashboard → assets → open the worst → see its PHI, flows, access, vendors and threats in one record
- **Vendor assessment** — vendors → BAA gaps → what each vendor can reach → raise a finding
- **Access review** — flagged grants → stale, excessive or inactive → reduce level, revoke, or record that it was reviewed
- **Incident triage** — threat → affected system → its risk, access and vendors → raise remediation → close it → audit shows the trail
- **Reporting** — audit trail filtered by activity, with counts that reconcile against the pages they come from

## Who it is for

| Role | What they use it for |
|---|---|
| **Security leadership** | Where risk concentrates, and whether it is moving |
| **Privacy / compliance** | Where PHI lives, who reached it, and a record of what was done |
| **Security operations** | Threat triage with the context needed to judge it |
| **Vendor management** | Which agreements are missing or expired, and what those vendors can reach |
| **Internal audit** | An unalterable record of actions, actors and outcomes |

## Example customer journey

A provider imports its estate: twelve systems, two million patient records,
thirteen data flows, five vendors, twenty-three access grants.

Drishti scores it. One system comes out at the top — a legacy records exchange
nobody owns, half a million records, no encryption, no multi-factor, sending
clinical notes to the analytics warehouse in the clear every day.

The access screen shows a contractor who left the organisation still holding
administrator rights over it, unused for three hundred days. The threat screen
shows sustained outbound transfer from the same system. The vendor screen
shows a backup provider with an expired agreement reachable by four hundred
thousand records.

Four teams' information, one box.

Someone raises a finding, assigns it, and works it. When they close it, Drishti
records who decided what and when — and does not touch the system itself,
because closing a finding is a claim about people, not a fix. The next
recompute shows whether the estate actually changed.

Six months later an auditor asks what the organisation knew and when. The
answer is one screen.

## Technology

A browser application over a REST API and a PostgreSQL database. Sessions use
short-lived tokens held in memory with a rotating refresh credential in a
cookie that scripts cannot read. Every record is scoped to an organisation and
every query is scoped to the organisation in the signed session; a request for
another organisation's record returns *not found*. Deployable as containers.

See `DRISHTI_ARCHITECTURE_OVERVIEW.md`.

---

*Drishti provides visibility into PHI risk and a record of the actions taken.
It does not certify compliance with any framework; conformance remains the
customer's determination.*
