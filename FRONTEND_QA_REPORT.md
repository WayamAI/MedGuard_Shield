# Frontend QA — pre-demo pass

Run against the **production build** (`vite preview` on :8080, not the dev
server) talking to the live backend on :4000. Commit under test: `41d3d0a`
on `feature/data-import-ui`.

The backend was on `feature/data-import-backend` at `3489ec0`, **not merged
to its main**, and the demo database had **not** been reseeded — it still
carries the two assets imported during the earlier import click-through
(10 assets rather than the seeded 8). Every count below reflects that.

## 1. Page-by-page

| Page | Result | Evidence |
|---|---|---|
| Login | **PASS** | `POST /api/auth/login` → 200, lands on Dashboard |
| Dashboard | **PASS** | 10 assets · 2 critical-or-extreme · 402,200 records/day · 2 unencrypted, all matching the API |
| PHI Flow (Sankey) | **PASS** | 10 flows, 3 compliant / 2 violations / 5 warnings, all three tones render |
| Risk Matrix | **PASS** | 8 scored, bands 1/1/1/3/2, chip colour from the API not L×I |
| Vendor Risk | **PASS** | 5 vendors, 3 without valid BAA, band summary 1/1/0/2/1 |
| Access & Identity | **PASS** | 9 grants, 6 flagged, headline names the deactivated contractor |
| Threat Detection | **PASS** | 3 open of 5; sidebar badge reads 3 and agrees with the page |
| Import Data | **PASS** | Admin-only; all seven entities load their column contract |
| Policy & Compliance | **PASS** | Sample-data notice present and correctly worded |
| AI Governance | **PASS** | Sample-data notice present and correctly worded |
| Audit & Reports | **PASS** | Sample-data notice present and correctly worded |
| Logout | **PASS** | Returns to `/login`, "Signed out" toast, no session-ended notice |
| Forced logout on reload | **PASS** | Reload drops the in-memory token; login shows "Your session ended. Please sign in again to continue." |

Import entity coverage — each loads its own contract from `GET /api/import`:

| Entity | Slug | Natural key |
|---|---|---|
| Assets | `assets` | name |
| PHI Types | `phi-types` | name |
| Data Flows | `data-flows` | source asset + target asset + PHI type |
| Vendors | `vendors` | name |
| Access Grants | `access-grants` | identity display name + asset name |
| Threats | `threats` | asset name + title |
| Risks | `risks` | asset name |

## 2. Integration contract

Every path the frontend calls, verified live rather than assumed. The three
test-only fixtures (`/api/hb`, `/api/heal`, `/api/manual`) exist solely in
`api-query.test.tsx` and are not part of the shipped surface.

| Endpoint | HTTP | Shape matches frontend types |
|---|---|---|
| `GET /api/assets` | 200 | yes — `id`, `name`, `type` |
| `GET /api/dataflows` | 200 | yes — `source`, `target`, `recordsPerDay`, `encrypted` |
| `GET /api/risks` | 200 | yes — `assetName`, `likelihood`, `impact`, `score`, `band` |
| `GET /api/vendors` | 200 | yes — `name`, `baaStatus`, `phiVolume`, `risk` |
| `GET /api/access` | 200 | yes — `summary` + `grants` envelope |
| `GET /api/threats` | 200 | yes — `summary` + `threats` envelope |
| `GET /api/import` | 200 | yes — `entity`, `label`, `columns` |
| `GET /api/import/:entity/template` | 200 | all seven slugs |
| `POST /api/import/:entity/validate` | 200 | `{valid,totalRows,errors,preview}`, 200 even when invalid |
| `POST /api/import/:entity` | 201 / 400 | success `{...,imported}`; failure nests the report under `error.report` |
| `POST /api/auth/login` `/logout` | 200 | yes |

Three paths that look plausible and are **not** used, confirmed 404:
`/api/import/assets/import`, `/api/import/phitypes/template`,
`/api/import/dataflows/template`.

## 3. Regression

```
Offline suite   15 files, 154 tests passed
Live-backend    12 passed (11 real, 1 skipped: BACKEND_DIR not set)
tsc --noEmit    exit 0
npm run lint    15 errors, 10 warnings
```

Lint is **not** clean and this report will not pretend otherwise. All 15 are
pre-existing and none are in files this branch touched — `eslint` over every
changed file exits 0. They live in `components/ui/*` (shadcn scaffolding),
`Dashboard`, `Policy`, `AI`, `Audit`, `AppStore`, `use-auth`, `use-theme`,
and are mostly `no-explicit-any`. CI reports them without gating.

## 4. Error states

| Scenario | Result | Evidence |
|---|---|---|
| Backend unreachable, data already loaded | **PASS** | Reconnecting banner, last known rows kept and dimmed, no blanking |
| Backend returns, no user action | **PASS** | Banner cleared on its own after one poll |
| Rejected import | **PASS** | "5 problems found across 2 rows. Nothing was imported.", per-field table, no Confirm button, asset count unchanged |
| Two-step guarantee | **PASS** | Network log shows only `POST /api/import/assets/validate`. No request to `/api/import/assets` |
| Expired token, first load | **PASS** | "Session expired — Your session is no longer valid." |
| Expired token, data on screen | **FIXED** | Was reported as a lost connection. See below |

## 5. Bug found and fixed during this pass

**A 401 on a view that already held data rendered the reconnecting banner.**
Wrong twice: the connection was fine, and the banner says "retrying" while
`useApiQuery` deliberately stops polling on auth errors, so nothing was going
to retry. Someone whose session expired mid-demo would have been told the
backend had gone away.

Fixed in `41d3d0a` — the auth case now outranks cached data in `DataState`,
and `isReconnecting` excludes auth errors. Covered by a regression test that
fails without the fix. The existing coverage only exercised a 401 on first
load, where data is `undefined` and the error state was already right, which
is why it survived.

## 6. Known limitations

1. **An imported asset does not appear in the Risk Register — and that is
   correct behaviour, not a gap.** An asset has no risk score until a risk
   assessment exists for it. The Risk Register and the matrix are built from
   `Risk` rows, and a newly created asset has none, so it shows in the
   Dashboard and the asset list with no score and is absent from the matrix.

   Importing an asset does exactly what creating one by hand does:
   `createAsset` in the backend is a bare insert, and the CSV importer takes
   the same path. Neither invents an assessment. A score exists only because
   someone — or a Risk CSV — put one there.

   An earlier revision of this report called it a backend scoring gap and
   pointed at the recompute endpoint. That was wrong: recompute rescores an
   assessment that already exists, it does not create the first one, so
   nothing about the import path is missing a step. `DEMO_RUNBOOK.md` carries
   the same framing plus a line to say out loud if it comes up live, and the
   one-row Risks CSV that fills it in.
2. **Policy, Audit and AI Governance are sample data.** Declared on each page.
3. **A reload signs you out**, by design — the token is memory-only and the
   API has no refresh endpoint.
4. **Role gating is a convenience, not enforcement.** The API is the real
   gate; the UI only avoids showing a door that will not open.
5. **The Dashboard's 7d/30d/90d chips are inert** (`TODO` in `Dashboard.tsx`).
6. **Sidebar Threat badge counts open threats**, which will differ from the
   "open critical" figure beside it. Both are correct and they are different
   measures.
7. **`NotFound.tsx` logs a `console.error`** on an unknown route, so a bad
   link mid-demo prints a red console line.
8. **The seeded demo password is weak** and was exposed in an assistant
   transcript before rotation. Fine locally, not fine anywhere reachable.
9. **Client-side 2MB and `.csv` checks are a first line of defence only.**
   The server enforces both and answers 413 / 400 independently.
