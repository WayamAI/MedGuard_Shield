# Drishti Frontend — Final Report

**Date:** 23 September 2026
**Branch:** `main` @ `8eea0e0`, pushed to origin, working tree clean
**Method:** live click-through of the running application against the live
backend, signed in as `admin@meridian.org` (ADMIN)

---

## 1. Verdict

Eleven defects were found by walking the application, and all eleven were
fixed, tested, committed and pushed. Each fix was then re-verified in the
rebuilt bundle in the browser, not merely in the test suite.

Final state of the checks:

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 21 warnings (all `react-refresh/only-export-components`, pre-existing) |
| `npx tsc --noEmit -p tsconfig.app.json` | clean |
| `npx vitest run` | **258 passed**, 22 files, 0 failed |
| `npm run build` | succeeds, 385 kB / 118 kB gzip |
| `docker build` + run | image builds, all routes 200 |

Test count rose from 208 to 258 over this pass. Every fix below carries a
test that was confirmed to fail against the old code.

**One item on the checklist could not be verified — see §4.** It is an
unverified item, not a known defect.

---

## 2. What was exercised live

Every one of these was driven in the browser against the real API, with the
backend mutation, the UI update, a full page reload and the audit trail each
checked separately.

| Area | What was done | Verified |
|---|---|---|
| Dashboard | Loaded, all metrics reconciled against the other pages | 8 scored + 8 unscored = 16 assets; threats/vendors/access match their own pages; console clean |
| Assets | List, detail, all 7 tabs | `1–16 of 16`, real counts per tab |
| Risk recompute | Asset #3 rescored | 48 HIGH → 64 CRITICAL, chips updated live, survived reload, audited |
| Threats | List, summary, filters, detail | `1–5 of 5`, summary matched facets |
| Threat transition | Threat #2 → Investigating | Badge, record, summary all moved; survived reload; audited as `THREAT_STATUS_CHANGED`; backend cascaded `Risk recomputed · Asset #8` |
| Vendors | List, 4 summary cards, 3 detail tabs | All four cards reconcile against the five rows; cross-link to asset resolves |
| Access | List, summary, grant detail | Card counts reconcile; `Mark reviewed` persisted and audited as `Access reviewed` |
| Controls | **Created a control**, recorded an assessment | Row, badges and `Last reviewed` all updated |
| Policies | **Created a policy** | Row rendered with status, owner, review date |
| Remediation | **Raised a finding**, moved it In progress, then Resolved | Cards moved 0→1→0→1 correctly; transitions matched the server's allowed set |
| Remediation honesty | Resolved the finding, then re-checked the asset | Billing Engine DB **still** Unencrypted / No MFA / EXTREME — closing a finding records a decision and does not touch the estate, exactly as the drawer claims |
| Audit | List, filters, pagination | 91 events; every mutation above appears |
| Pagination | Next, Previous, page size | `1–25 of 91` → `26–50 of 91`, Page 2 of 4; changing page size correctly reset to page 1 |
| CSV import | Invalid file, then valid file | Invalid: `2 problems found across 2 rows. Nothing was imported.` with per-row field errors. Valid: preview → `Confirm Import` → assets went 16 → 18 |
| Dark mode | Dashboard, Controls drawer, Import; both toggle directions | Renders correctly throughout |
| Docker | Built and ran the image | `/`, `/controls`, `/assets`, `/remediation`, `/healthz` all 200; SPA deep-link bounced to `/login` with no false "session ended" notice |

---

## 3. Defects found and fixed

All eleven were found by using the product, not by reading it.

### 3.1 The same page title printed twice — `12a7d5d`
Every screen rendered its title in the layout header *and* again in the page
header. Replaced the layout copy with a breadcrumb.

### 3.2 Asset detail showed a fraction of the graph — `5870965`
The API returned PHI types, flows, access, vendors and threats per asset;
the drawer showed two of them. Now seven tabs with real counts.

### 3.3 Every audit row wore the same glyph — `2c31a9d`
A fifty-row trail was one undifferentiated column. Keyed the mark to the
action family, with a fallback so a new backend action can never become
invisible.

### 3.4 Risk scores printed in four different formats — `1b68a24`
The Vendor Risk column read `100 / 80 / 38.4 / 28.8 / 11.52` — ragged
precision implying the engine is more certain about some rows than others.
A `RiskScore` helper already existed for this and **nothing used it**; all
six call sites hand-rolled their own span. The helper now owns the
formatting (one decimal at most) and is used everywhere. The exact value
remains on the element as a tooltip, and the band badge is still the
server's, so display rounding cannot move a row into a band the API did not
put it in.

### 3.5 "1 days ago" — `f8ef01e`
Three of the nine seeded access grants were last used yesterday. Five call
sites interpolated `${days} days ago` by hand, so all five had the bug and
`0 days ago` was waiting behind it. One helper now owns the wording. It
deliberately does not compute a day count — the API already returns one, and
a second opinion derived from the browser clock is how a UI starts
disagreeing with its own backend.

### 3.6 Controls and Policies were dead ends — `f8ccaa4`
Both were read-only views of collections the UI gave no way to fill, and
both are unseeded — so a customer clicking either reached "nothing recorded"
with no way forward, while the API had create, patch and archive for both.
Both now support creation, and Controls supports recording an assessment.

The role split follows the server exactly rather than approximating it:

```
control:create   ADMIN            — New control is admin-only
control:assess   ADMIN, ANALYST   — but ONLY status, effectiveness, lastReviewedAt
control:update   ADMIN            — name, category, owner, frameworkRef
policy:*         ADMIN            — every policy field is configuration
```

The assessment panel therefore sends exactly those three fields and nothing
else: including an untouched configuration field would earn a 403 naming a
field the user never touched. A test asserts on the exact key set of the
PATCH body.

### 3.7 "undefined assets" in the new drawers — `f8ccaa4`
Caught in the browser immediately after building 3.6. The detail endpoints
return a **different, richer shape** than their list rows — the asset,
policy and remediation rows themselves plus `phiCovered`, and none of the
aggregate counts. Added `ApiControlDetail` / `ApiPolicyDetail`; the drawers
now list covered assets and citing policies by name, which is what a
reviewer wanted anyway.

### 3.8 Every empty state wore a database cylinder — `d74d30d`
`DataState` hardcoded one glyph for all nine list pages, so a product built
around domain marks lost its mark exactly when a customer is most likely to
be staring at it. `AppIcon` now emits `data-icon`, so this is assertable for
the first time.

### 3.9 Remediation summary rendered `NaN` — `b52c433`
The Closed card showed the literal string `NaN` with the subtitle
`undefined resolved · undefined accepted`, and In progress sat in its
loading skeleton forever. The type claimed flat `inProgress` / `resolved` /
`accepted` fields the API has never returned; the counts arrive under
`byStatus`. The four cards now partition the findings exactly once — the
server's own `open` roll-up is deliberately *not* used as a card because it
already includes `IN_PROGRESS` and would double-count.

### 3.10 Every remediation row said "undefined: undefined" — `ab7e354`
`subject` is always an object of five independently nullable slots; the type
claimed `{ type, id, label } | null`, so the null guard never fired. The
same wrong shape had silently disabled the drawer's cross-link, which
branched on a `type` field that has never existed — no link had ever
rendered for any finding. Both now handle a finding that implicates several
entities at once, which the old single-pair shape could not represent.

### 3.11 Security headers missing on every JS and CSS response — `8eea0e0`
An `add_header` inside an nginx `location` block *replaces* the inherited
set rather than adding to it. The config already knew this — `/index.html`
repeats the headers with a comment explaining why — but `/static/` and
`/healthz` each set their own `add_header` and so dropped all three. Every
fingerprinted bundle was served without `X-Content-Type-Options: nosniff`,
which is precisely the response a MIME-sniffing attack wants, and any header
scan across the site would have found it. Verified in the built image
against all four response classes.

Also fixed: `Imported 2 Assets rows` → `Imported 2 rows into Assets`
(`329740c`), since the entity labels are plural nouns and read wrong as
adjectives for every entity, not just that one.

---

## 4. What I could not verify

**Responsive rendering.** The browser automation reports a successful window
resize, but the rendering viewport does not change: after requesting 430×900,
`window.outerWidth` was 746 while `innerWidth` and
`document.documentElement.clientWidth` both stayed pinned at 1470. Every
screenshot came back identical. I therefore did **not** visually verify any
breakpoint and will not claim otherwise.

What I could confirm is structural only: tables scroll inside their own
`overflow-x-auto` container rather than pushing the page wide, ten pages use
the `hideBelow` column system, and the page reported no horizontal overflow
at the width available. That is a code check, not a visual one.

**Recommendation:** spend two minutes resizing a real browser window across
1440 / 1024 / 768 / 390 before the demo, or simply present at a fixed
desktop width.

---

## 5. Before the demo — please read

This walkthrough wrote real data to the demo database:

- 2 imported assets (Cardiology Scheduling, Radiology Worklist) — assets now 18, not 16
- 1 control, 1 policy, 1 remediation finding (resolved)
- Threat #2 moved to Investigating; access grant #6 marked reviewed
- Assets #3 and #8 rescored; audit trail grown to 91 events

The backend `DEMO_RUNBOOK.md` calls for `npx prisma db seed` shortly before
the demo — it is idempotent and takes about a second — and notes that threat
timestamps are seeded relative to seed time, so it should be run on the day
regardless. **I have not run it.** Running it will clear the records above
and return the estate to the seeded 16 assets.

If you would rather demo the richer state, everything above is real and
consistent; just be aware the "24h ago" style threat ages drift each day it
is not reseeded.

---

## 6. Status

Every defect found was fixed rather than filed. The suite is green, the
build and the container both succeed, and the honesty properties the product
is built on — that a risk band is the server's, that closing a finding
changes no inventory, that a framework reference is a citation and not a
compliance claim — were each checked live rather than assumed.

The one open item is visual responsive QA, which the tooling in this
environment cannot perform, and which is flagged above rather than glossed.

PRODUCTION DEMO READY
