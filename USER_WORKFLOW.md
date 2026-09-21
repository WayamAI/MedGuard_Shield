# MedGuard — how to use it

A click-by-click walkthrough of every screen, written for someone doing the
clicking rather than someone maintaining the code. Each step names the exact
button or label you will see and what should happen when you use it.

Every label quoted here was read off the running app, not from a design.

---

## Before you start

Someone on the engineering team needs to have both halves running:

| What | Where | How you know it is up |
|---|---|---|
| The app itself | `http://localhost:8080` | The sign-in page loads |
| The API behind it | `http://localhost:4000` | Pages show numbers instead of an error |

If the API is down the app still loads, but each screen says so plainly
instead of showing blank or invented figures.

**Your account.** Sign in as `admin@meridian.org`. The password is the shared
demo password — ask whoever set the environment up; it is deliberately not
written down here.

Three accounts exist, and they see different things:

| Account | Role | Can open Import Data? |
|---|---|---|
| `admin@meridian.org` | Administrator | Yes |
| `f.alrashid@meridian.org` | Analyst | No |
| `a.patel@meridian.org` | Viewer | No |

---

## 1. Signing in

1. Open `http://localhost:8080`. The page reads **"Sign in to MedGuard"**, with
   **"Healthcare governance and compliance for Meridian Health"** beneath it.
2. Type your address into **"Email address"**.
3. Type your password into **"Password"**. The eye icon on the right reveals
   what you typed, if you want to check it.
4. Click **"Sign in"**. The button reads **"Signing in…"** while it works.

You land on **Governance Overview** — the dashboard. If the details were wrong,
a red message appears above the button and nothing else changes.

> **If you reload the page at any point you will be signed out.** This is
> deliberate: the session is held in memory and never written to disk. You will
> see **"Your session ended. Please sign in again to continue."** Just sign in
> again. Avoid reloading mid-demo.

---

## 2. Finding your way around

The left-hand column is the main menu. Top to bottom:

| Menu item | What it covers |
|---|---|
| **Dashboard** | The headline numbers |
| **PHI Flow Map** | Where patient data physically moves |
| **Access & Identity** | Who can reach which system |
| **Threat Detection** | Suspicious activity. Carries a red count of open threats |
| **Policy & Compliance** | Written policies and controls |
| **AI Governance** | Oversight of the clinical AI models |
| **Audit & Reports** | The event log and report builder |
| **Risk Register** | Every system scored for risk |
| **Vendor Risk** | Third parties who touch patient data |
| **Import Data** | Bulk-load records from a spreadsheet. **Administrators only** |

If you are not an administrator, **Import Data** is simply not in the menu.

**Three screens are not live yet.** Policy & Compliance, AI Governance and
Audit & Reports each carry a blue notice at the top, for example:

> *Sample data. Audit & Reports is not connected to the API yet, so the figures
> below are illustrative rather than live.*

Everything on those three screens is a worked example. Every other screen shows
real data from the API.

Along the top of every page: a **search box**, a green **"Live Monitoring"**
indicator, **"Last sync:"**, a **moon/sun icon** to switch between light and
dark, a **circular arrow** to refresh (a message confirms "Dashboard
refreshed"), and a **bell** with a red count of unread notifications. Clicking
the bell slides a panel in from the right with **"Mark all read"** at the top
and **"View all notifications"** at the bottom.

The small icon at the bottom of the menu, just above the green **"HIPAA
Compliant"** badge, narrows the menu to icons only. Click it again to restore.

---

## 3. Dashboard — *Governance Overview*

Click **"Dashboard"**. Four figures across the top:

- **ASSETS MONITORED** — systems holding patient data, with *"N PHI flows mapped"* below
- **CRITICAL OR EXTREME** — systems in the two worst risk bands
- **PHI RECORDS / DAY** — patient records moving between systems daily
- **UNENCRYPTED FLOWS** — how many of those movements are unprotected

Below, **"Compliance Frameworks"** shows HIPAA, SOC 2 Type II, ISO 27001 and
HITRUST, each with a score ring and a **"View Report"** button. HITRUST is
tagged **OVERDUE**. Clicking **"View Report"** opens a report with
**summary / controls / evidence** tabs.

On the right: **"Governance Health Score"** with **7d / 30d / 90d** buttons, and
**"Recent Alerts"**, each with a **"Resolve"** button. **"See all alerts →"**
at the bottom jumps to Threat Detection.

Lower down: **"Department Risk Heat Map"**, a **"Live Activity Feed"** with a
**"Pause"** button, and **"Quick Actions"** — *Generate Compliance Report*,
*Run Risk Assessment*, *Review Pending Approvals*, *Export Audit Trail*.

---

## 4. PHI Flow Map — *PHI Data Flow Map*

Click **"PHI Flow Map"**. This is the diagram people usually want to see: a
flow chart of patient data moving left to right through four columns —
**INGRESS**, **CORE SYSTEM**, **DOWNSTREAM SYSTEMS**, **EXTERNAL RECIPIENTS**.

Each box is a system, labelled with its daily record count and either its
encryption (**AES-256**) or a red **UNENCRYPTED**. Ribbon thickness is volume.

Top left shows the **"PHI Exposure Score"** and *"N flows monitored"*. Top right:
a **"Show: All flows"** dropdown, **"Scan Now"**, and **"Export Map"**.

A red banner names the specific problem, e.g.
*"2 Active Violations: Unencrypted PHI detected in Epic EHR Core → Billing
Engine DB connection."* with **"View Details"** and **"Remediate Now"**.

**"Flow Summary"** on the right totals *Total flows*, *Compliant*, *Violations*,
*Warnings* and *PHI in transit today*, over a **"View Detailed Report"** button.

---

## 5. Risk Register — *Risk Matrix*

Click **"Risk Register"**. Top row: **ASSETS SCORED**, **CRITICAL OR EXTREME**,
**HIGH**, **HIGHEST SCORE**.

**"Risk Matrix"** plots every system on a five-by-five grid — **LIKELIHOOD**
up the side (*Rare* to *Almost Certain*), **IMPACT** across the bottom
(*Negligible* to *Catastrophic*). Each numbered chip is one system. Clicking a
chip jumps to its row in the table below.

Above the grid, a colour key: **Extreme, Critical, High, Moderate, Low**, each
with a count.

> The note on the right reads *"Band = Likelihood x Impact x Exposure x Control
> gap (API)"*. The colour comes from the scoring engine, which weighs two
> further factors beyond the two axes — so a system's colour will often not be
> what its grid square alone suggests. That is correct, not a display error.

Below: filter buttons **All / EXTREME / CRITICAL / HIGH / MODERATE / LOW**, a
**"Refresh"** button, and a table of **ID, ASSET, L, I, EXPOSURE, CONTROL GAP,
SCORE, BAND**, worst first, each row ending in **"View"**.

---

## 6. Vendor Risk — *Vendor Risk Management*

Click **"Vendor Risk"**. Top row: **VENDORS**, **WITHOUT A VALID BAA**
(*"missing, expired or pending"*), **ASSESSMENT OVERDUE**, **PHI RECORDS
EXPOSED**.

A red **"BAA gap:"** banner names the single worst offender in a sentence.

**"Vendor Risk Register"** lists every third party: **VENDOR, BAA, SYSTEMS, PHI
RECORDS, LAST ASSESSED, SCORE, BAND**, worst first. BAA status shows as
**Missing**, **Expired**, **Pending** or **Signed**. Overdue assessments are
red and marked *"· overdue"*. Search and an **All / SIGNED / PENDING / EXPIRED /
MISSING** filter sit above.

> A vendor you have just added by import has not been scored yet. It shows a
> dash for its score and **"Not scored"** where the band would be, and sorts to
> the bottom of the list — not the top. Nobody has assessed it yet, which is
> not the same as it being safe.

**"Risk by Band"** at the bottom counts vendors in each band. Unscored vendors
are not counted in any of them.

---

## 7. Access & Identity — *Access & Identity Management*

Click **"Access & Identity"**. Top row: **ACCESS GRANTS**, **FLAGGED**,
**WITHOUT MFA**, **STALE OR NEVER USED** (*"unused past 90 days"*).

A red banner leads with the worst case, e.g. *"Over-privileged grant: Robert
Chen (contractor) still holds ADMIN on Imaging Archive (S3) despite being a
deactivated identity, last used 246 days ago."*

**"Access Review"** lists **IDENTITY, DEPARTMENT, SYSTEM, LEVEL, LAST USED,
FINDINGS**, ordered by how much is wrong with each grant. Findings are coloured
tags — **Stale**, **Inactive identity**, **No MFA**, **Never used**, **Excessive
level** — and a dash where nothing is wrong. Deactivated people have their name
struck through. People and service accounts have different icons.

Filters: **All / ADMIN / WRITE / READ**, and **All grants / Flagged only**.

---

## 8. Threat Detection — *Threat & Anomaly Detection*

Click **"Threat Detection"**. The red number beside the menu item is the count
of open threats, and it matches this page. Top row: **OPEN THREATS**
(*"of N detected"*), **OPEN CRITICAL**, **INVESTIGATING**, **RESOLVED**.

A red **"Open critical:"** banner describes the most urgent item.

**"Detected Threats"** lists **SEVERITY, THREAT, SYSTEM, DETECTED, STATUS** —
open items first, then by severity. Severity is **CRITICAL / HIGH / MEDIUM /
LOW**; status is **Open**, **Investigating**, **Resolved** or **False positive**.
Resolved and false-positive rows stay visible but greyed, for context.

Filters: severity **All / CRITICAL / HIGH / MEDIUM / LOW** and status
**All / OPEN / INVESTIGATING / RESOLVED / FALSE_POSITIVE**.

---

## 9. Import Data — administrators only

Click **"Import Data"** (bottom of the menu; you may need to scroll it). The
page explains itself: *"Upload a CSV to add records. Every file is checked
before anything is written."*

### The seven things you can import

The **"What are you importing?"** dropdown offers, in order: **Assets**,
**PHI Types**, **Data Flows**, **Vendors**, **Access Grants**, **Threats**,
**Risks**.

**Order matters.** Four of these refer to things by name, and the thing must
already exist:

| Importing | Refers to | So import these first |
|---|---|---|
| **Data Flows** | two Assets and a PHI Type | Assets, PHI Types |
| **Access Grants** | a person and an Asset | Assets |
| **Threats** | an Asset | Assets |
| **Risks** | an Asset | Assets |

Import **Assets** and **PHI Types** before the rest and the others will resolve.
Out of order, the file is rejected with an unrecognised-name error.

### Importing a file

1. Pick what you are importing from **"What are you importing?"**.
2. The **"Columns"** strip lists every column, each tagged **required** or
   **optional** with its type. On the right, *"Matched on …"* tells you which
   columns decide whether a row is new or a duplicate.
3. Click **"Download template"** — a CSV with the correct headings and one
   filled-in example row. The button reads **"Preparing…"** briefly.
4. Fill the template in, keeping the heading row exactly as it came.
5. Under **"Upload"**, click **"Choose file"** and pick your CSV. Only `.csv`
   is accepted, up to 2MB.
6. **The file is checked immediately — this writes nothing.** You will see
   either:
   - green **"N rows ready to import"** with a preview table, or
   - red **"N problems found across M rows. Nothing was imported."** with a
     table of **FILE LINE, FIELD, PROBLEM** naming each bad value — for example
     *"type must be one of: EHR, DATABASE, API, CLOUD_STORAGE, ANALYTICS,
     OTHER. Got "NOT_A_REAL_TYPE""*. Fix the file and choose it again.
7. Check the preview, then click **"Confirm Import"**. Beside it the page says
   *"Checked only. Nothing has been written yet."* — true right up until you
   click.
8. Confirmation replaces it: **"Imported N <type> rows — the dashboard and the
   other views have been refreshed."** This is not just a message; the other
   screens genuinely update. Import a threat and the red count beside **Threat
   Detection** goes up straight away.
9. **"Import another file"** clears the form for the next one.

**"Clear"** beside the filename abandons the file. Changing the dropdown also
clears whatever you had selected, so pick the type first.

> Nothing is written to the system until you click **"Confirm Import"**, and a
> file with any error in it is rejected whole — the good rows are not partially
> imported.

---

## 10. Signing out

Click the **exit icon** beside your name at the bottom of the menu. You return
to the sign-in page and a message confirms **"Signed out"**.

Signing out deliberately does *not* show the "Your session ended" notice — that
one only appears when a session ends on its own, such as after a reload.

---

## If something looks wrong

| What you see | What it means | What to do |
|---|---|---|
| **"Sample data."** in a blue bar | Policy, AI Governance and Audit are not wired to the API yet | Expected. Those figures are illustrative |
| A page explains the API is unreachable | The backend on port 4000 is down | Ask engineering to restart it |
| **"Your session ended."** | You reloaded, or the session expired | Sign in again |
| **Import Data** missing from the menu | You are not signed in as an administrator | Sign in as an administrator |
| A red error after **"Sign in"** | Wrong address or password | Re-check; the eye icon reveals the password |
| A vendor showing **"Not scored"** | Imported but never assessed | Expected. Assess it to give it a band |
| Numbers look stale | The page polls, but you can force it | Click **"Refresh"** on the page, or the circular arrow in the top bar |

---

## For whoever sets up the demo

Re-seed the database **on the day**, not the night before:

```
cd medguard-backend && npx prisma db seed
```

Threat timestamps are generated relative to when the seed runs — the lead alert
is meant to read "4 hours ago". Seed the evening before and it reads a day old
by the time anyone sees it, which undercuts the point of the threat feed. The
seed takes about a second and is safe to repeat.
