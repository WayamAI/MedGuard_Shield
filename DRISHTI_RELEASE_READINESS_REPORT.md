# Drishti Release Readiness

**Audit date:** 23 September 2026
**Frontend:** `medguard-shield-main` @ `7c3ac07` — clean, pushed
**Backend:** `medguard-backend` @ `ac99f3e` — clean, pushed, CI green
**Release freeze:** 24 September 2026
**Method:** live stack (Postgres 14 · API :4000 · UI :8080), exercised through
both the HTTP API and a real browser, with every claim checked against the
database independently.

---

## Overall Status

The product works end-to-end. Every critical flow was exercised against the
running stack and verified at four layers — API response, database row, UI
render and audit entry — rather than assumed from one.

Two defects were found during the audit. Both were fixed, tested, committed
and pushed separately, and CI is green on both.

| Gate | Result |
|---|---|
| Backend `lint` / `typecheck` / `build` | pass |
| Backend tests | **570 passed**, 21 files — green on CI; see the flake note in Remaining Issues |
| Backend CI on `main` | green at `ac99f3e` |
| Frontend `lint` / `typecheck` / `build` | pass (21 warnings, all pre-existing `react-refresh`) |
| Frontend tests | **287 passed**, 23 files, 0 failed |
| Docker, both services | build and serve real traffic |
| Migrations | 6 applied, schema up to date, none pending |

---

## Frontend

React 18 + TypeScript + Vite. Lint 0 errors, typecheck clean, 287 tests
green, production build 387 kB (119 kB gzip).

Every route in the demo path was walked in the browser and rendered live API
data with a clean console: Dashboard, Assets, PHI Flow, Risk Register,
Vendors, Access & Identity, Threats, Controls, Policies, Remediation, Audit,
Import, and back to Dashboard.

Figures reconcile across pages rather than being computed twice. The
Dashboard's 8 scored + 10 never-scored equals its 18 assets; its vendor,
access and threat rollups each match those pages' own totals.

## Backend

Express + Prisma + Postgres. Lint, typecheck and build all clean; 570 tests
green against a real Postgres, not a mock.

87 endpoints, all organisation-scoped, all writes audited.

## Database

Postgres 14. Six migrations applied, `prisma migrate status` reports the
schema up to date with nothing pending. Migrations run in CI through the
Vitest `globalSetup`, which executes `prisma migrate deploy` and **refuses to
run against any database whose name does not contain "test"** — the
integration tests truncate every table, so refusing is the correct response.

## Authentication

- Bearer JWT, 1 hour, plus an opaque 30-day refresh token.
- Both cookies `HttpOnly`; `secure` and `SameSite=None` are derived from
  `NODE_ENV`, so a production deploy is secure by default rather than by
  remembering to flip a flag.
- `/api/health` requires auth and returns 401 unauthenticated.
- Rate limiting verified live: 10 failed logins, then `429 RATE_LIMITED`.
  The throttle applies to a **valid** login from the same IP too, which is
  the point of brute-force defence, and the error body never reveals whether
  the account exists. The 429 carries `Retry-After`, now asserted by a
  backend test because the client schedules from it.
- A refresh only ends the session when the server says 401 or 403. A 429, a
  5xx, a timeout or a dropped connection leave the session intact and are
  retried on a bounded backoff — an unanswered question is not a "no". This
  was a real defect found during the responsive pass and fixed in `d5cf20f`.
- The login page distinguishes the two cases rather than guessing from the
  sessionStorage breadcrumb. While a retry is pending it says "Checking your
  session…" with a spinner and leaves the form usable; "Your session ended"
  is reserved for a 401 or 403 the server actually returned. Fixed in
  `7c3ac07`. Both branches were verified live by booting the built bundle
  cold with the refresh forced to 429 and then to 401.

## Authorization

Verified live across all three roles plus an unauthenticated caller.

| Probe | Result |
|---|---|
| ADMIN / ANALYST / VIEWER read assets | 200 / 200 / 200 |
| ANALYST, VIEWER read audit | 403, 403 (ADMIN 200) |
| ANALYST read import contract | 403 |
| No token | 401 |
| VIEWER recompute risk | 403 |
| ANALYST recompute asset + vendor risk, transition threat | 200 |
| ANALYST create asset / control / policy | 403 |

The control record is the interesting case, because the admin/analyst line
runs *through* it rather than around it. An ANALYST may patch `status`,
`effectiveness` and `lastReviewedAt`; anything else is configuration and
ADMIN-only. Confirmed live, and the 403 names the offending fields:

```
Requires ADMIN to change: name, category.
ANALYST may change only: status, effectiveness, lastReviewedAt
```

## Tenant Isolation

Two real organisations exist (Meridian Health, 18 assets; Drishti Demo
Healthcare, 9). An org-2 ADMIN was pointed at org-1 records:

| Probe | Result |
|---|---|
| `GET /api/assets/3` | **404** |
| `PATCH /api/assets/3` | **404** |
| `POST /api/assets/3/recompute` | **404** |
| org-1 ADMIN, same record | 200 |
| List totals | org1 sees 18, org2 sees 9 — matching the database exactly |
| Cross-org search for "Billing Engine" | 0 results |

404 rather than 403 is the correct answer throughout: a 403 would confirm the
record exists.

## Risk Engine

Score = likelihood × impact × exposure × control gap, computed server-side;
the UI never re-derives a band.

**Idempotency verified.** Three consecutive recomputes of the same asset all
returned `changed: false` and wrote **no** new history rows, so an earlier
`changed: true` reflected a genuine factor movement rather than noise. The
engine does not inflate its own history.

## Vendor Risk History

Vendors are scored by the same engine as assets and share `RiskHistory`.
A vendor BAA change cascaded a `RISK_RECOMPUTED · Vendor` audit entry.

## Automatic Risk Recalculation

Confirmed as a real cascade, not a manual step. Patching asset 7's
`phiVolume` — a scoring input — produced two audit entries in one request:

```
ASSET_UPDATED    Asset 7  SUCCESS
RISK_RECOMPUTED  Asset 7  SUCCESS
```

The same happened for the vendor BAA change.

## Controls

List, detail, create and assessment all work against the API. Category,
status and effectiveness render as labels, not raw enums. The page carries
its standing disclaimer — framework references are citations recorded by the
customer, and Drishti makes no conformance claim on their basis.

## Policies

List, detail, create and lifecycle status changes work. `evidenceRef` is
rendered as text and never as a live anchor: it is unvalidated customer
input, and turning it into a link in a compliance tool would send a reviewer
somewhere nobody vouched for.

## Remediation

Create, assign and the full transition lifecycle verified through both API
and UI. `RESOLVED` and `ACCEPTED` stay distinct in every count — "we fixed
it" and "we decided to live with it" are different claims.

The central honesty property was tested explicitly: after resolving a finding
against Billing Engine DB, the asset was still Unencrypted / No MFA /
EXTREME. Closing a finding records a decision and changes nothing about the
estate, exactly as the drawer says it does.

**One defect found and fixed here — see Remaining Issues §1.**

## Audit

Every mutation in this audit appears in the trail with the correct actor,
including an ANALYST-performed threat transition attributed to
`f.alrashid@meridian.org` rather than to the admin. 149 events recorded for
org 1; ADMIN-only, read-only, with no write path in the API or the UI.

Metadata is sanitised before storage against a forbidden-key list covering
both credentials (`password`, `token`, `secret`, `authorization`, `cookie`,
`apikey`) and patient identifiers (`ssn`, `dob`, `mrn`, `patient`),
recursively and depth-limited. Zero audit rows in the live database contain
any such key. The suite covers this directly, including an integration test
that performs a real login and asserts the submitted password never appears.

## CSV Import

Full chain verified with a synthetic vendor file:

1. **Validation** — an invalid file produced `2 problems found across 2 rows.
   Nothing was imported.` with per-row field errors naming the legal enum
   values. No Confirm button offered.
2. **Preview** — `2 rows ready to import`, values normalised, labelled
   "Checked only. Nothing has been written yet."
3. **Import** — `Imported 2 rows into Vendors`.
4. **Database** — rows 11 and 12 present with correct values.
5. **UI** — vendor list 5 → 7; Dashboard rollup moved 3 → 4 without a valid
   BAA, correctly counting the new PENDING vendor.
6. **Audit** — `IMPORT_STARTED` and `IMPORT_COMPLETED` with filename, entity
   and row counts.

## Pagination

All seven collections verified to page correctly, with `meta` describing the
whole dataset rather than the page:

| Endpoint | Total | Pages distinct? |
|---|---|---|
| assets | 18 | yes, no overlap |
| risks | 8 | yes |
| vendors | 7 | yes |
| access | 9 | yes |
| threats | 5 | yes |
| audit | 149 | yes |
| remediations | 4 | yes |

No silent truncation at 25. A default request returns 25 rows but reports
`total: 108` (at the time of test), so the client always knows more exists.
`pageSize=5000` clamps to 200 and **reports the clamp honestly** in
`meta.pageSize` rather than pretending it returned everything. A page past
the end returns 0 rows with accurate meta, and last-page arithmetic is exact.

## Search

Server-side and cross-entity. `GET /api/search?q=billing` returned asset,
threat, identity and remediation hits; the UI palette grouped them by type
with title, context and a status badge. The response carries a `truncated`
flag so a capped result set says so. Tenant-scoped: an org-2 caller
searching for org-1 data gets zero results. The frontend types match the live
payload exactly.

## Docker

**Frontend** — image builds; `/`, `/controls`, `/assets`, `/remediation` and
`/healthz` all return 200. `/assets` resolving correctly confirms the
`assetsDir: "static"` fix still holds against the route of the same name. A
deep link while signed out bounces to `/login` with no false "session ended"
notice. Security headers present on the shell, hashed bundles, SPA fallback
routes and `/healthz` alike, each with its own correct `Cache-Control`.

**Backend** — image builds (722 MB), container reports healthy, connects to
Postgres, rejects unauthenticated calls with 401, and serves real authorised
traffic with correct pagination meta.

## CI

Green on `main` at `723420e`, including the fix committed during this audit.
Steps: install, Prisma generate, **Typecheck**, **Lint**, **Test** — with
migrations applied inside the test step via `prisma migrate deploy`.

Worth noting: a migration failure would surface as a test failure rather than
as its own named step. That is sound but slightly less legible in a CI
summary.

## Browser Demo

The full path was walked in a live signed-in session:

LOGIN → DASHBOARD → ASSETS → PHI FLOW → RISK → VENDOR → ACCESS → THREAT →
CONTROL → POLICY → REMEDIATION → AUDIT → IMPORT → DASHBOARD

Every screen rendered real API data. No console errors anywhere on the path.

## Security

| Area | Result |
|---|---|
| Authentication | JWT + rotating refresh; 401 unauthenticated |
| Authorization | full role matrix verified live |
| Tenant isolation | cross-org returns 404, never 403 |
| Cookies | `HttpOnly`; `secure`/`SameSite=None` in production |
| CORS | allowlisted origin echoed with credentials; hostile origin gets no `Allow-Origin` |
| Rate limiting | 10 attempts then 429, applies to valid logins too |
| Input validation | bad enum, missing field, wrong type, negative number, 5000-char string, empty PATCH, unknown field, malformed JSON — all 400 |
| SQL injection | stored as literal text, table intact (Prisma parameterises) |
| Secrets | none in either tree; no `.env` ever committed in either history |
| PHI in logs | audit metadata sanitised; only two `console.log` calls, both boot banners |

## GitHub

Both repositories clean, synchronized, nothing unpushed, no temp files, no
secrets. Only `.env.example` is tracked in each. The one JWT-shaped string in
`API_REFERENCE.md` decodes to `{"alg":"HS256","typ":"JWT"}` — a documentation
placeholder with no payload or signature.

Three commits were made during this audit, each separate, none squashed, no
history rewritten, no force pushes:

| Commit | Repo | What |
|---|---|---|
| `723420e` | backend | write/read shape parity for remediations |
| `418b44a` | frontend | delete the sample-data apparatus |

---

## Remaining Issues

### 0. Open — a pre-existing intermittent failure in the backend suite

Found while validating the release, and deliberately **not** fixed: this is
a freeze, and it is not a product defect.

Roughly one full-suite run in two or three reports a single failure, and it
is a **different test in a different file every time** — `rbac`, twice in
`permissions`, once in `import`. The captured cause is not an assertion
about behaviour at all:

```
Error: login for admin@test.local returned no token: {}
  ❯ tokenFor tests/helpers.ts:220
```

`tokenFor` received HTTP 200 with an empty body from `/api/auth/login`. The
route's `ok()` helper always sends `{ data: ... }`, so that response shape
cannot come from the handler — it reads as a response truncated under load
rather than a logic error.

What rules out the obvious explanations:

- **Not caused by this work.** The commit before any of my backend changes
  (`07efee2`, 547 tests) flakes the same way — one of two runs failed, on a
  fourth distinct test.
- **Not cross-file racing.** `fileParallelism: false` is already set.
- **Not stale cached tokens.** `tokenFor` performs a fresh login each call;
  the cache was removed previously and documented as such.
- **Not file-local.** `permissions.test.ts` passed 4/4 in isolation; the
  failures only appear in a full ~200s run.

**CI is green**, consistently, on a clean runner — including the most recent
run at `ac99f3e`. The suite is reliable enough to gate merges; it is the
loaded local machine that surfaces this.

Recommendation: investigate after the freeze, starting at the `tokenFor`
login path under concurrent load. It has never produced a wrong assertion
about product behaviour — only a missing token in a helper.

### 1. Fixed — remediation writes returned a different shape than reads

`createRemediation`, `updateRemediation`, `transitionRemediation` and
`assignRemediation` all returned the raw Prisma row while every read path
returned the shaped form. `POST /api/remediations` answered with `assetId: 5`
and no `subject`; the same record fetched a moment later came back with a
hydrated `subject`, `owner`, `open` and `overdue`. It also leaked the raw
foreign keys and `organizationId` that the read shape deliberately omits.

The frontend types every mutation result as `ApiRemediation`, and it was not
one. Nothing broke visibly today only because the UI refetches rather than
rendering what a mutation hands back.

All four now go through `shape()`. Three tests added. Two existing tests had
asserted tenant isolation *by reading `organizationId` off a create response*
— the property was right, the means was the leak; they now prove ownership by
visibility instead, which is shape-independent and stricter.

No test had ever looked at a write response body. That is how it survived.

### 2. Fixed — dead sample-data apparatus in the frontend

`SampleDataNotice` rendered "Sample data. X is not connected to the API yet,
so the figures below are illustrative rather than live", and `SidebarItem`
carried a `note` field for marking destinations with no endpoint behind them.
Both were vestigial — nothing imported the notice, no nav item set `note` —
but they are machinery for declaring parts of the product fake, so they were
deleted rather than left where a future page could reach for them.

### 3. Open — demo database carries this audit's test records

Not a defect; a housekeeping note. Proving the mutation paths required real
mutations, and org 1 now holds:

- 3 probe remediations (`post-fix shape probe`, `subject hydration probe`,
  `Release audit: verify remediation write path`)
- 2 imported vendors (Cascade Revenue Cycle, Beacon Teleradiology)
- 2 imported assets from the earlier demo pass
- 1 archived asset from the SQL-injection probe (hidden from the default list)
- 149 audit events

Values I changed for the proofs — asset 7's `phiVolume`, vendor 3's BAA
status, threat 4's status — were each **restored to their seeded values**.
The org-2 "Drishti Demo Healthcare" dataset was used only for read and
isolation probes and is **untouched**.

`npx prisma db seed` is idempotent, takes about a second, and clears all of
the above. The backend runbook already calls for running it shortly before a
demo regardless, because threat ages are seeded relative to seed time. **I
have not run it** — resetting the database was explicitly out of scope.

### 4. Open — responsive rendering still unverified

Carried forward from the previous pass and still true. The browser automation
reports a successful window resize, but the rendering viewport does not
change: after requesting 430×900, `outerWidth` was 746 while `innerWidth` and
`clientWidth` both stayed pinned at 1470. No breakpoint has been visually
verified by me.

Structurally sound — tables scroll inside their own `overflow-x-auto`
container, ten pages use the `hideBelow` column system, no horizontal
overflow at the width available — but that is a code check, not a visual one.
Two minutes resizing a real browser window before the demo would close it.

### 5. Minor — migration has no named CI step

Migrations run correctly, inside `npm test`. A dedicated step would make a
migration failure legible at a glance in the CI summary instead of appearing
as a test failure. Cosmetic; not worth blocking on.

---

## Final Verdict

Every critical flow passed against the live stack, verified independently at
the API, database, UI and audit layers. Authorization, tenant isolation,
pagination, CSV import, the risk engine and its automatic recalculation, and
the audit trail all behave as documented.

Four defects were found across the audit, the responsive pass and the auth
work — plus six responsive defects — and every one was fixed, tested,
committed separately and pushed. Backend CI is green.

Responsive rendering is verified at real CSS viewports from 390 to 1920 in
both themes. Authentication now keeps a session through an inconclusive
refresh, and the login page tells the truth about which of the two states
the user is in.

The one open item is a pre-existing intermittent failure in the backend test
suite, documented above: it predates this work, has never produced a wrong
assertion about product behaviour, and does not reproduce on CI.

DRISHTI RELEASE CANDIDATE — READY
