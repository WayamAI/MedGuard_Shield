# Drishti — Customer Demo Script

**Duration:** 10–15 minutes
**Audience:** healthcare security, privacy and compliance leaders
**Environment:** the seeded Drishti demo organisation, *Drishti Demo Healthcare*
**Account:** `admin@drishti-demo.invalid` (see `DRISHTI_DEMO_OPERATIONS.md`)

Everything in this script is on screen in the demo environment. No feature is
described that does not exist, and every figure quoted below comes from the
seeded dataset.

---

## 1. The scenario

**Drishti Demo Healthcare** is a mid-sized provider. Like most providers, it
did not set out to build a sprawling estate — it grew one.

Twelve systems hold patient data today: a cardiology EHR, a patient portal, a
lab results API, an imaging archive, a pharmacy system, a billing database, a
claims gateway, an analytics warehouse, a research repository, a telehealth
platform, an emergency triage board, and one that nobody quite owns any more —
the **Legacy Records Exchange**.

Between them sit **2,323,100 patient records**. PHI moves between them along
**13 mapped flows**, carrying **208,550 records a day**. Five external vendors
touch some of those systems. Twenty-three access grants let people and service
accounts reach them.

Nobody in the organisation can hold that picture in their head. That is the
problem Drishti exists to solve.

The demo follows one thread through it: **the Legacy Records Exchange**. It
holds the most sensitive concentration of data in the estate, it is the source
of an active threat, a deactivated contractor still has administrator rights
over it, and there is an open finding against it that nobody has closed.

---

## 2. Talk track

*Read this as continuous narrative. The step-by-step in §3 is the same story
with the clicks written down.*

> Most healthcare organisations can tell you which systems they run. Very few
> can tell you where patient data actually lives, how it moves between those
> systems, who can reach it, and which of their vendors is exposed. That
> information exists — it is just spread across spreadsheets, ticket queues
> and people's memories.
>
> Drishti puts it in one place and keeps it current.
>
> This is a demo organisation. Twelve systems, just over two million patient
> records, five vendors, twenty-three access grants. The dashboard is the whole
> estate in one view: where the data is, how much of it moves each day, and
> where the risk concentrates.
>
> Risk here is not a label somebody typed. Every system is scored on four
> factors — how likely something is, how bad it would be, how exposed the
> system is, and how much of the control gap is still open. The scoring runs in
> the platform, and it re-runs on its own whenever something that feeds it
> changes.
>
> One system comes out at the top of that list, and it is the one nobody owns:
> the Legacy Records Exchange. Half a million records, no encryption, no
> multi-factor. It sends clinical notes to the analytics warehouse unencrypted
> every day. A contractor who left the organisation still holds administrator
> rights over it and has not signed in for three hundred days. And right now
> there is an active alert showing sustained outbound transfer from it.
>
> That is four different teams' information — inventory, data flow, access
> review, threat detection — and Drishti is showing you that they are all
> pointing at the same box.
>
> So somebody raises a finding, assigns it, and works it. When they close it,
> Drishti records who decided what and when — and it deliberately does not
> change the system itself. Closing a finding is a claim about people, not a
> fix. If the estate needs to change, the estate has to be changed, and
> Drishti will show you whether it was.
>
> Every one of those actions is written to an audit trail that nobody can edit,
> including the administrators. When a regulator or an auditor asks what you
> knew and what you did about it, that is the answer.

---

## 3. Step-by-step

### Step 1 — Dashboard · *the whole estate in one view* (60s)

| | |
|---|---|
| **Screen** | Governance Overview (`/`) |
| **Action** | Start here. Do not click anything yet — let it be read. |
| **Point out** | `12` assets monitored · `13` PHI flows mapped. `208,550` records a day. `8` of 13 flows unencrypted. The risk matrix, and the band strip: 1 extreme, 1 critical, 3 high, 4 moderate, 3 low. |
| **Say** | "This is the entire estate. Twelve systems holding patient data, thirteen mapped flows between them, two hundred thousand records moving every day — and eight of those thirteen flows are moving it unencrypted. The matrix places every scored system by likelihood and impact." |
| **Business value** | One screen replaces the spreadsheet nobody trusts and the quarterly slide nobody can reproduce. |

### Step 2 — Asset discovery · *what we actually have* (60s)

| | |
|---|---|
| **Screen** | Assets (`/assets`) |
| **Action** | Open Assets. Let the table sort itself by score. |
| **Point out** | `Legacy Records Exchange` at the top — `521,000` records, Unencrypted, No MFA, score `100`, band `EXTREME`. Contrast with `Patient Portal` at `1.92` / LOW. |
| **Say** | "Every system that holds patient data, ranked by the risk it carries. Two systems here are comparable in size, and one of them is a hundred times the risk of the other — because one is encrypted and behind multi-factor, and the other is neither." |
| **Business value** | Inventory stops being a list and becomes a priority order. |

### Step 3 — PHI visibility · *what kind of data, and how sensitive* (45s)

| | |
|---|---|
| **Screen** | Asset detail drawer → **PHI** tab |
| **Action** | Click `Legacy Records Exchange`. Open the **PHI** tab. |
| **Point out** | The PHI types recorded against it and their sensitivity. The estate tracks four: Genomic Sequences (critical), Clinical Notes (high), Billing & Claims (medium), Demographics (low). |
| **Say** | "Not all patient data is equal. Genomic sequences and clinical notes carry very different consequences from a billing reference, and Drishti keeps that distinction rather than counting records." |
| **Business value** | Lets a team defend *why* one system is prioritised over another. |

### Step 4 — Data flow · *how it moves* (75s)

| | |
|---|---|
| **Screen** | PHI Flow (`/phi-flow`) |
| **Action** | Open PHI Flow. Let the map draw. Scroll it horizontally if needed. |
| **Point out** | The banner naming active violations. `Legacy Records Exchange → Analytics Warehouse`, `31,500` records a day, **unencrypted**, carrying Clinical Notes. Ribbon thickness is volume; colour is encryption status. |
| **Say** | "This is the part almost nobody has. Where the data goes after it lands. The thick red ribbon is thirty-one thousand clinical notes a day leaving the legacy system for the warehouse with no encryption in transit. Nobody designed that. It accumulated." |
| **Business value** | Turns "we think it's encrypted" into a picture you can point at in a meeting. |

### Step 5 — Risk · *where it concentrates, and why* (75s)

| | |
|---|---|
| **Screen** | Risk Register (`/risks`) → open the top row |
| **Action** | Open Risk Register. Click the highest-scoring entry. |
| **Point out** | The four factors: likelihood, impact, exposure, control gap. The band is derived, not typed. Then click **Recompute risk** and watch the score update. |
| **Say** | "The score is the product of four factors, and the platform derives them from the facts it already holds rather than asking somebody to estimate. Watch — I'll recompute it live. If nothing that feeds the score has changed, the score does not move, and it says so. This is not a number somebody can quietly nudge before a board meeting." |
| **Business value** | A defensible, reproducible risk position instead of an opinion. |

### Step 6 — Vendor exposure · *who else touches it* (75s)

| | |
|---|---|
| **Screen** | Vendors (`/vendors`) |
| **Action** | Open Vendors. Click `Northgate Claims Services`, then the **Assets** tab. |
| **Point out** | `3` of `5` vendors without a valid BAA. `Northgate Claims Services` — BAA **Missing**, `88,700` records, CRITICAL. `Archive Nine Backup` — BAA **Expired**, `486,000` records. The banner explains the gap in a sentence. |
| **Say** | "Five vendors touch this estate and three do not have a business associate agreement in place — one missing, one expired, one still pending. The expired one is reachable by four hundred and eighty-six thousand records. Under HIPAA, processing PHI without a signed BAA is a problem in its own right, before anybody has lost any data." |
| **Business value** | Vendor paperwork and vendor *exposure* finally appear in the same view. |

### Step 7 — Access · *who can reach it* (75s)

| | |
|---|---|
| **Screen** | Access & Identity (`/access`) |
| **Action** | Open Access & Identity. Click the top flagged grant. |
| **Point out** | `18` of `23` grants flagged. `Tomas Brandt (contractor)` — name struck through, identity **inactive**, holds **ADMIN** on Legacy Records Exchange, last used **300 days ago**. Three such grants. |
| **Say** | "Eighteen of twenty-three grants have something wrong with them. This one is the clearest: a contractor who is no longer active, still holding administrator rights over the most sensitive system in the estate, and last used ten months ago. Every quarter somebody signs an access review. This is what the review missed." |
| **Business value** | Finds the access nobody revoked — the most common real-world breach path. |

### Step 8 — Threat · *what is happening now* (60s)

| | |
|---|---|
| **Screen** | Threats (`/threats`) → open the critical item |
| **Action** | Open Threats. Click `Sustained outbound transfer from legacy exchange`. |
| **Point out** | `5` open, `3` critical. The record: severity, status, affected system, when detected. The status buttons offered are the ones the platform will actually accept from here. |
| **Say** | "Three critical alerts open right now. This one is outbound transfer from the same legacy system we have been looking at all along — the one with no encryption, the stale administrator, and the unencrypted feed to the warehouse. Four separate signals, one box." |
| **Business value** | Detection lands in the same place as the context needed to judge it. |

### Step 9 — Controls · *what is supposed to be stopping this* (45s)

| | |
|---|---|
| **Screen** | Controls (`/controls`) |
| **Action** | Open Controls. |
| **Point out** | `8` controls: 2 implemented, 4 partial, 1 planned, 1 not implemented. `Least Privilege Access` — Partial, **Ineffective**. `Vendor BAA Management` — Partial, **Ineffective**. The note at the foot of the page. |
| **Say** | "These are the safeguards the organisation says it has. Two are fully implemented. Least privilege is partial and assessed as ineffective — which is exactly what the access screen just showed us. The framework references here are citations your team recorded; Drishti stores them and makes no conformance claim of its own on the strength of them." |
| **Business value** | Control posture stops being aspirational and starts being assessed. |

### Step 10 — Remediation · *what we are doing about it* (90s)

| | |
|---|---|
| **Screen** | Remediation (`/remediation`) → open a finding → change status |
| **Action** | Open Remediation. Click `Deactivated contractor retains ADMIN access to Imaging Archive`. Move it to **In progress**. |
| **Point out** | `9` findings, `6` open, `5` critical. The finding names the asset it points at. The status moves and the counters move with it. Resolved and Risk-accepted are counted separately. |
| **Say** | "Findings, owners, and what was decided. Watch the counters as I move this one to in progress. And note these two columns stay apart: *resolved* means we fixed it, *risk accepted* means we decided to live with it. Those are different claims and an auditor will ask which one you meant." |
| **Business value** | Closes the loop from detection to ownership, with the decision recorded. |

### Step 11 — Audit · *proof it happened* (60s)

| | |
|---|---|
| **Screen** | Audit Trail (`/audit`) |
| **Action** | Open Audit Trail. The status change from step 10 is at the top. |
| **Point out** | The entry recorded seconds ago: action, who did it, which record, the result. Filter by activity. Read-only — there is no way to add or edit an entry, for anyone. |
| **Say** | "Everything we just did is here, with who did it and when. There is no write path to this screen and no administrator override — not in the interface and not in the platform. When somebody asks what you knew and what you did about it, this is the answer." |
| **Business value** | Turns "we handled it" into something you can hand to an auditor. |

### Step 12 — Back to the dashboard · *the loop closes* (45s)

| | |
|---|---|
| **Screen** | Governance Overview (`/`) |
| **Action** | Return to the dashboard. |
| **Point out** | The Action Centre: open critical threats, assets at extreme risk, vendors without a valid BAA, unencrypted flows, flagged access grants. Each links back to the records behind it. |
| **Say** | "And we're back where we started, except now the Action Centre reads as a work queue rather than a status board. Every line links to the records behind it. Tomorrow morning somebody starts at the top of this list." |
| **Business value** | A standing operating picture, not a point-in-time assessment. |

---

## 4. Closing (30s)

> "Where patient data lives. How it moves. Who can reach it. Which vendors are
> exposed. Where the risk concentrates, what needs attention, and whether the
> remediation actually happened — with a record of all of it.
>
> That is Drishti. What would you want to look at first in your own estate?"

---

## 5. Questions you should expect

**"Is the risk score something we can tune?"**
Yes. Likelihood and impact are yours to set per system; exposure and control
gap are derived from the facts already recorded. The platform recomputes on
its own when an input changes.

**"Does closing a finding change the system?"**
No, deliberately. It records a decision, an owner and a timestamp. If the
estate needs to change, the estate has to be changed — and Drishti will show
you whether it was. Demonstrate it if asked: resolve a finding, then open the
asset and show it unchanged.

**"Can an administrator edit the audit trail?"**
No. It is read-only in the interface and there is no write path in the
platform. Administrators can read it; nobody can alter it.

**"How does our data stay separate from another customer's?"**
Every record carries an organisation, every query is scoped to the
organisation in the signed session token, and a request for another
organisation's record returns *not found* rather than *forbidden* — so the
platform never even confirms the record exists.

**"How does data get in?"**
CSV import today, for seven record types, with a validate-then-confirm step —
nothing is written until the preview is confirmed. Show it if there is time.

---

## 6. What not to say

- Do not claim Drishti makes an organisation HIPAA compliant. It provides
  visibility and a record; compliance is the customer's determination.
- Do not describe the framework references on the Controls page as
  certification or attestation. They are citations the customer recorded.
- Do not promise automated remediation. Drishti records that work happened;
  it does not perform it.
- Do not describe roadmap items as present. `DRISHTI_FEATURE_MATRIX.md` is the
  authority on what exists today.
