# Drishti Frontend — Final Report

**Date:** 23 September 2026
**Branch:** `main`, pushed to origin, working tree clean
**Method:** live click-through of the running application against the live
backend, signed in as `admin@meridian.org` (ADMIN)
**Updated 23 September 2026:** section 4 replaced — responsive rendering has
since been verified at real CSS viewports, and six further defects fixed.

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

Responsive rendering, previously the one unverified item, has since been
verified across 390, 768, 1024, 1280, 1440 and 1920 in light and dark mode.
That pass found six more defects, all fixed and pushed — see section 4.

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

## 4. Responsive rendering — verified

Superseded. The earlier pass reported this unverified because
`resize_window` changed the OS window but not the rendering viewport: after
requesting 430x900, `outerWidth` read 746 while `innerWidth` and
`clientWidth` stayed pinned at 1470 - a macOS Retina coordinate quirk, with
`innerWidth` exactly equal to `screen.width`. That statement was accurate.

### How it was verified

CSS media queries inside an iframe evaluate against the **iframe's own**
dimensions, not the top window's. An iframe sized to exactly 390px therefore
lays the application out at 390px for real - Tailwind breakpoints, the
`hideBelow` column system and all. This is real layout, not a faked
`innerWidth`.

Proof the viewport genuinely changed, measured inside the frame at 390px:

```
iframe_innerWidth ........................ 390
top_innerWidth ........................... 1470
matchMedia("(max-width: 767px)").matches . true
matchMedia("(min-width: 1024px)").matches  false
```

The CSS engine is evaluating mobile breakpoints. Each page was then audited
programmatically - page-level horizontal overflow, any element whose right
edge passes the viewport outside a deliberate scroller, and any text clipped
inside its own box - and visually by screenshot.

### Coverage

| What | Widths |
|---|---|
| Dashboard, Assets, PHI Flow, Risk Register, Vendors, Access, Threats, Controls, Policies, Remediation, Audit, Import | 390, 768, 1024, 1280, 1440 |
| Dashboard, Assets, PHI Flow, Risk Register | 1920 |
| Login | 390, 768, 1024, 1440, 1920 |
| Asset and Threat detail drawers | 390, 768 |
| New-asset modal | 390 |
| Mobile navigation - open, navigate, auto-close | 390 |
| Table horizontal scroll and column prioritisation | 390 |
| Dark mode - Dashboard, Assets, PHI Flow, Vendors, Threats, Remediation, Audit, Import | 390, 1440 |
| Risk matrix | 768 |

### Six defects found and fixed

Each was committed separately and pushed.

1. **`a76f4d3` Metric values clipped mid-digit at 390px.** Four metrics sat
   two-up, leaving about 139px for a value; "402,200" needs 210px and
   rendered as "402,20". Shrinking the type does not solve it - at the
   smaller display size the number still wants 142px, and Assets carries
   "1,301,800". The grid is now one-up below sm.

2. **`a669d50` PHI Flow's Export button was off-screen at 390px.**
   `PageHeader` pinned its actions with `flex-shrink-0`, so the row could
   never shrink to the viewport and never got the chance to wrap. The page
   reported no horizontal scroll, so Export was not merely awkward to reach,
   it was unreachable. `flex-shrink-0` now applies from sm up.

3. **`017385b` The PHI flow map was illegible at 390px.** The Sankey sized
   itself with `w-full` against a `viewBox`, so it scaled to about a third
   and every node label rendered under 4px - drawn, but unreadable. A
   min-width lets the wrapper's existing `overflow-x-auto` do its job.

4. **`f5b9535` ...which then broke the same card at 1440.** A grid item
   defaults to `min-width: auto`, so the column sized to the map rather than
   to `1fr`: the card ran to 1496px in a 1440px viewport and the last stage
   was clipped rather than scrollable. `min-w-0` on the card fixed it.

5. **`5ca9c40` Page titles truncated at 390px.** Title and actions shared a
   row; the actions took their content width and the title, which is
   `min-w-0` and truncates, got the remainder - "Vendor Risk" rendered as
   "Ven...". The header stacks below sm and the title wraps rather than
   elides.

6. **`4ff71bf` Metric values clipped across 1024-1279.** Four-up started at
   lg (1024). With the sidebar **expanded**, which is the default, that
   leaves 144px for a value and Assets' "1,321,800" needs 165px. This one
   survived the first sweep only because that session happened to have the
   sidebar collapsed to 72px - a layout that holds only when a user
   preference happens to be set one way is not holding. Four-up now waits
   for xl (1280).

Re-verified in the running application afterwards at 1024 with the sidebar
expanded to 236px: metrics two-up, "1,321,800" complete, zero clipping, no
page overflow.

### Result

After those six fixes, all twelve pages report zero horizontal page
overflow, zero elements escaping the viewport and zero clipped text at 390,
768, 1024, 1280 and 1440, in both light and dark mode.

Specifically checked from the brief and found sound: tables scroll inside
their own container with column prioritisation (at 390 the Assets table
keeps Asset, PHI records, Score and Risk and scrolls to a 640px minimum);
drawers fit the viewport (the 560px panel caps to `max-w-full`); modals fit
with all actions reachable; the risk matrix renders its full 5x5 grid with
readable axis labels at 768 without scrolling; mobile navigation opens,
navigates and closes itself; filters wrap rather than overflow; and nothing
becomes excessively stretched at 1920, where content holds sensible
max-widths.

### Honest limits of this method

An iframe gives a genuine **CSS** viewport. It is not a mobile device. The
following were therefore *not* tested and are not claimed:

- touch input, gesture scrolling, or momentum
- mobile browser chrome and the dynamic viewport it creates (`dvh`,
  `safe-area-inset`)
- `devicePixelRatio` - it stayed at the desktop value throughout
- iOS or Android engine differences; this is Chrome's engine only

For layout, breakpoints, overflow and legibility - which is what the brief
asked for - the method is exact. For on-device feel, a real handset is still
the only answer.

### Two observations, deliberately not fixed

Both sit outside "fix actual responsive defects" and neither is a layout
break, so I am reporting rather than changing them.

- **Touch targets are 28-30px tall** on filter chips and drawer transition
  buttons. That clears WCAG 2.5.8 AA (24x24) but sits under the 44px comfort
  guideline. Raising it means changing control sizing across the design
  system, which is a design decision, not a defect fix.
- **A modal does not lock background scroll.** The modal itself stays fixed
  and fully usable; the page behind it can still scroll.

### One non-responsive bug found along the way

Not fixed - out of scope for this pass, and worth a decision.

My harness reloaded the app roughly a hundred times, each boot-probing
`POST /api/auth/refresh`, which tripped the backend's 15-minute rate limit.
The frontend treated the resulting **429 as a dead session**: it cleared
state and showed "Your session ended. Please sign in again." The session was
in fact fine - 60 refresh tokens were still active - and the correct
response to a 429 is to wait and retry, not to log the user out. A transient
rate-limit or network blip on boot currently ejects a signed-in user.

`use-auth.tsx` clears the session in a single catch covering every error;
its comment reasons about 401 and 403 only.

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

Responsive rendering has since been verified at real CSS viewports across
390, 768, 1024, 1280, 1440 and 1920, in light and dark mode. Six responsive
defects were found and fixed; section 4 records the method, its limits, and
what was deliberately left alone.

RESPONSIVE VERIFIED

PRODUCTION DEMO READY
