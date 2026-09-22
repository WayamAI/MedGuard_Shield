# Drishti — frontend implementation report

**Branch:** `feat/drishti` (4 commits, not merged)
**Base:** `main` @ `d79f26b`
**Date:** 2026-09-22

```
BUILD      PASS   npm run build            → exit 0
TYPECHECK  PASS   tsc --noEmit -p tsconfig.app.json → 0 errors
LINT       PASS   npm run lint             → exit 0, 0 errors, 16 warnings
TESTS      PASS   193 passed (17 files)
DOCKER     PASS   image builds, container verified running
```

Starting point was `CURRENT_FRONTEND_STATE.md`, the forensic audit of this
codebase. The guiding constraint throughout: **nothing ships that claims
something it does not do.** Where a capability had no backend, it was removed
and specified rather than faked.

---

## 1. What changed

### Branding — Drishti

The supplied `Logos/Drishti-*.svg` could not be used as-is: both carried an
opaque full-bleed background rect (`#08090B` / `#FEFEFE`) as their first path,
which would paint a hard rectangle over any surface they sat on. Both are
re-emitted transparent and tightly framed to their artwork, and a square mark
was derived from the glyph for the collapsed sidebar and favicon.

| Asset | Source | Use |
|---|---|---|
| `src/assets/brand/drishti-logo-light.svg` | supplied, bg stripped | sidebar + login, light |
| `src/assets/brand/drishti-logo-dark.svg` | supplied, bg stripped | sidebar + login, dark |
| `src/assets/brand/drishti-mark.svg` | derived (421×421) | collapsed sidebar |
| `public/favicon.svg` | same mark | browser tab |

Also: page `<title>`, meta description, OG tags, login headings, sidebar
wordmark, footer.

**Brand colour needed no work.** The audit found the app was already orange —
`--primary: 16 88% 46%` light / `18 90% 54%` dark, with the full
`--ref-orange-50…950` ramp carrying the exact specified values (`#F97316`,
`#EA580C`, `#FB923C`). The brief assumed blue needed replacing; it did not.

**Storage keys** moved `medguard-*` → `drishti-*`, each reading its
predecessor once so no existing user silently loses their theme or sidebar
state. The anti-FOUC snippet in `index.html` reads both keys, in sync with
`use-theme.tsx`.

### Information architecture

```
Overview     Dashboard
Discover     Assets · PHI Flow · Access & Identity · Vendors · Threats
Risk         Risk Register
Operations   Data Import (ADMIN)
```

Every destination has a live endpoint behind it. Per your decision, the six
unbacked domains are absent from navigation rather than present-and-inert.

### Dashboard

Rebuilt as an executive risk overview where **every number traces to an
endpoint**. The composite "Governance Health Score = 94" is not replaced with
a different invented number — it is replaced with the **Action Centre**, which
lists the specific findings that score would have been summarising, each
linking to the records behind it: open critical threats, extreme risks, BAA
gaps, unencrypted flows, flagged grants, unscored assets. When the API returns
none, it says so plainly rather than claiming a perfect score.

---

## 2. What was removed

| Removed | Why |
|---|---|
| `/ai` route + `AI.tsx` | 100% fixture data. 14 toast-only actions |
| `/policy` route + `Policy.tsx` | 100% fixture data. 12 toast-only actions |
| `/audit` route + `Audit.tsx` | 100% fixture data. 8 toast-only actions |
| `src/data/mock.ts` | No consumer left |
| `src/store/AppStore.tsx` | Existed only to serve mock alerts/notifications |
| `src/pages/Index.tsx` | Orphan, never routed |
| Dashboard health score, frameworks, alerts, heat map, activity feed | Invented figures presented as live on the flagship screen |
| PHI Flow "Remediate Now" wizard | Claimed *"Violation resolved, encryption applied"*, wrote nothing |
| PHI Flow node drawer fabrications | Hardcoded "Name, DOB, SSN, Diagnosis", "Users with access: 47", "Last audit: Apr 22 2025", "RBAC ✓", and a compliance check that was a 2-second timer |
| Header refresh timer | `setTimeout(1500)` then "Dashboard refreshed" — refetched nothing |
| Hardcoded global search | 4 fixed results, ignored the query |
| Mock notification feed | Fabricated items and unread count |
| `Export Map` toast | Now writes a real SVG file |

**~42 toast-only actions are gone** — either deleted with their mock page, or
replaced with a real API call.

Two test files were removed because their subjects were: `mock-pages.test.tsx`
(tested Policy/Audit/AI render) and `typing-regressions.test.tsx` (tested
`AppStore.toggleSuspend` and Policy's deep-linked tab). This is the only
coverage reduction, and it is the correct kind.

---

## 3. What was newly implemented

### Assets — a new surface on endpoints that already existed

The API had list, detail, create, update and recompute for assets. **The
frontend had never called any of them** except reading `.length` for one
dashboard tile.

- Inventory table: name, type, PHI volume, protection, last assessed, score, band
- Metric strip, band filter chips, search, sort, pagination, column visibility
- Detail drawer with **Overview / Risk / PHI / Flows** tabs — real PHI
  categories with sensitivity, the full four-factor risk breakdown, and
  inbound/outbound flows
- Create, edit, and recompute risk — all real writes
- Deep-linkable via `?open=<id>`

### Mutations (`src/hooks/useMutations.ts`)

`useCreateAsset`, `useUpdateAsset`, `useCreateVendor`, `useUpdateVendor`,
`useRecomputeAssetRisk`, `useRecomputeVendorRisk`.

All invalidate the **whole risk graph**, not just the list that was edited — a
vendor change can move an asset's band and the dashboard counts that aggregate
it. `api.patch` was added to the client, which previously had no PATCH.

### Global search

Real search across assets, vendors, risks, threats and identities, over live
API data. Debounced, grouped by entity, arrow-key navigable, ⌘K, gated so it
fetches nothing until opened. Shaped to swap for a server-side `/api/search`
without touching the UI.

### Design system

- **`DataTable`** — sorting (with null-sink), search, pagination, column
  visibility, row actions, keyboard access, `aria-sort`, sticky header,
  responsive column dropping, and loading/empty/error/no-match states
- **`ui-patterns.tsx`** — `PageHeader`, `MetricCard`, `RiskBadge`, `Tabs`,
  `Field`, `FieldGroup`, `FilterBar`, `EntityAvatar`, `MiniBar`, `CopyValue`,
  plus the single `BAND_TONE` / `BAA_TONE` vocabulary that was duplicated
  across two pages
- **`DomainIcon`** — ten custom marks for the model nouns (Asset, PHI, Data
  Flow, Risk, Vendor, Identity, Threat, Control, Remediation, Audit).
  24×24, 1.5 stroke, `currentColor` only. Lucide still covers interface verbs.

---

## 4. Three bugs found by writing tests, not by reading code

**`withRows`.** Pages derive `filtered` from `data ?? []`, so spreading
`{...query, data: filtered}` handed `DataState` an empty array while the query
was still loading — turning a skeleton into "nothing here", a different and
wrong claim. I introduced this converting Vendors; the existing vendor tests
caught it. Now a named helper with four tests.

**Premature band counts.** The vendor band summary rendered "0 at EXTREME"
before its data arrived — the most reassuring thing the page can say, said by
accident.

**Ungated search queries.** `useRawRisks()` took no options, so the search
palette polled risks whether or not it was open.

Plus a fourth, found by running the container rather than reading its config —
see §9.

---

## 5. New routes

| Route | Page | Backing |
|---|---|---|
| `/assets` | `Assets.tsx` | `GET/POST /api/assets`, `GET/PATCH /api/assets/:id`, `POST /api/risks/:id/recompute` |

Removed: `/ai`, `/policy`, `/audit`.

## 6. New components and hooks

| File | Purpose |
|---|---|
| `src/components/DataTable.tsx` | The one table + `withRows` |
| `src/components/ui-patterns.tsx` | Composite patterns and risk vocabulary |
| `src/components/DomainIcon.tsx` | Ten Drishti domain marks |
| `src/pages/Assets.tsx` | Asset inventory and detail |
| `src/hooks/useMutations.ts` | All six write hooks |
| `src/hooks/useGlobalSearch.ts` | Real multi-entity search |
| `src/hooks/useAssets.ts` | `useAsset(id)` added |
| `src/hooks/useVendors.ts` | `useVendor(id)` added |
| `src/hooks/useApiQuery.ts` | `enabled` option added |
| `src/lib/apiClient.ts` | `api.patch` added |
| `src/lib/apiErrors.ts` | `toApiError` narrowing helper |

**`ApiAsset` was corrected.** It declared `id: string`, `department`,
`phiRecords`, `riskBand` — none of which the API returns. It survived only
because its one consumer read `.length`. Verified field-by-field against the
live response, and `ApiAssetDetail`, `ApiVendorDetail`, `AssetWriteInput`,
`VendorWriteInput` added.

## 7. Backend contracts required

`FRONTEND_API_CONTRACT.md`, 11 contracts in three priority tiers.

**P0** (restores removed screens): `GET /api/audit`,
`PATCH /api/threats/:id`, the remediation set.
**P1**: controls, policies, identities + access revocation, `/api/phi-types`,
`GET /api/search`.
**P2**: notifications, users, reports, DELETE.

Plus three changes to existing behaviour — most actionable: the CSV template
`Content-Disposition` still says `medguard-*-template.csv`, which the server
controls, so downloads carry the old product name until the backend changes it.

## 8. Tests added

**193 total, up from 185**, despite removing two files with their features.

| File | Tests | Covers |
|---|---|---|
| `data-table.test.tsx` | 12 | Sorting, null-sink, search, keyboard, column visibility, `withRows` |
| `assets.test.tsx` | 9 | Listing, unscored-as-unknown, ordering, metrics, filters, error, empty, role gating |
| `mutations-search.test.tsx` | 10 | All six write hooks, invalidation, search gating and debounce |

Updated: `vendors.test.tsx`, `nav-badge.test.tsx`, `role-gate.test.tsx`,
`live-backend.test.tsx` for the new IA and providers.

## 9. Deployment

`Dockerfile` (Node build → nginx runtime), `nginx.conf`, `.dockerignore`.

**Verified by running the container, not by reading the config:**

```
healthz                         200 "ok"
/ /assets /risks /vendors
/phi-flow /access /threats
/import                         all 200 (SPA fallback)
/assets serves                  <title>Drishti | Healthcare PHI Risk Intelligence</title>
security headers                X-Content-Type-Options, X-Frame-Options, Referrer-Policy
static assets                   Cache-Control: public, max-age=31536000, immutable
index.html                      no-cache, no-store, must-revalidate
```

Two deployment bugs found and fixed this way:

1. **`/assets` returned a 301.** Vite's default output is `dist/assets/`, and
   the new asset-inventory route is `/assets` — nginx saw a real directory and
   issued a trailing-slash redirect, so the page never loaded. Fixed at source:
   `build.assetsDir = "static"`.
2. **Security headers were absent on `/`.** An `add_header` inside a location
   block *replaces* the inherited server-level set rather than adding to it, so
   the `= /index.html` block was silently dropping all three.

```bash
docker build -t drishti-frontend --build-arg VITE_API_BASE_URL=https://api.example.com .
docker run -p 8080:8080 drishti-frontend
curl localhost:8080/healthz
```

`VITE_API_BASE_URL` is **build-time** — Vite inlines `import.meta.env`, so one
image per environment. This is a property of Vite, not a choice made here.

## 10. Remaining blockers and gaps

### Verified only by test, not yet on screen

The login screen is confirmed in **both light and dark** (logo, brand, theme
persistence). The interior screens are covered by 193 tests but **I have not
yet walked them in a browser** — that needs a signed-in session, and entering
a password is something I can't do. Flagged rather than glossed.

### Deliberately not done

| Item | Why |
|---|---|
| Access and Threats still use their own tables | Both work and are well-tested. Converting them to `DataTable` is cosmetic uniformity with real regression risk; better done deliberately than bundled in here |
| Remediation, Controls, Policies, Audit, Users, Settings | No backend. Contracts written instead |
| `GET /api/auth/me` still unused | No session-validation path on the client |

### Pre-existing, untouched

- **`strictNullChecks` is off** (`tsconfig.app.json` `"strict": false`). The
  `| null` on `ApiVendor.risk` and `ApiAsset.risk` is **documentation the
  compiler will not enforce** — I verified this with a probe. The same class of
  crash that shipped before can recur anywhere. Turning it on is a separate,
  sizeable change and would likely surface dozens of errors.
- **Bare `tsc --noEmit` checks zero files** (root `tsconfig.json` has
  `"files": []`). It always exits 0. The real check is `-p tsconfig.app.json`.
- CI runs lint with `continue-on-error: true`, so lint does not gate.
- 16 `react-refresh/only-export-components` warnings (HMR-only, non-blocking).
- 49 shadcn/ui files remain, of which 3 are reachable. Left in place rather
  than bulk-deleted mid-rebrand.

### Backend-dependent features

| Feature | Blocked on |
|---|---|
| Threat status changes | `PATCH /api/threats/:id` |
| Access revocation | `DELETE /api/access/:grantId` |
| PHI flow remediation | remediation contracts |
| Audit / activity | `GET /api/audit` |
| Real notifications | notifications contracts |
| Server-side search | `GET /api/search` (client-side works today) |

## 11. Ready for customer demonstration

| Screen | State |
|---|---|
| **Login** | Ready — verified light and dark |
| **Dashboard** | Ready — every figure from a live endpoint; Action Centre links through |
| **Assets** | Ready — the strongest new surface. Full workflow A: list → detail → PHI → risk → flows → recompute |
| **Risk Register** | Ready — matrix + table, click-through, real recompute (workflow B) |
| **Vendors** | Ready — BAA gap headline, detail, create/edit, recompute (workflow C) |
| **PHI Flow** | Ready — Sankey, PHI-type filter, real SVG export, honest drawer |
| **Access & Identity** | Ready to *show*, read-only (workflow D stops before the action) |
| **Threats** | Ready to *show*, read-only (workflow E stops before status change) |
| **Data Import** | Ready — unchanged and the most complete feature; all 7 entities (workflow F) |

Four of six brief workflows are end-to-end. D and E are complete up to the
write, which needs the backend.

---

## Honest summary

The product no longer tells the customer anything untrue. Every figure on
every screen traces to an endpoint, every button either performs a real API
call or has been removed, and the three screens that were pure fiction are
gone rather than dressed up.

The largest genuine gain is **Assets** — the entry point to the entire
`Asset → PHI → Identity/Access → Vendor → Control → Risk` model, which had no
UI at all while its endpoints sat unused. The largest remaining gap is that
Drishti can now *see* everything and still *change* very little: threat status,
access revocation and remediation are the three writes that would turn it from
an observation tool into an operational one, and all three are specified and
waiting on the backend.
