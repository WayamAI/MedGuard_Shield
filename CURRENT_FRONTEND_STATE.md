# CURRENT FRONTEND STATE — forensic audit

**Audit date:** 2026-09-22
**Scope:** frontend repository only (`medguard-shield-main`). Backend inspected
read-only, solely to verify endpoint claims.
**Method:** repository inspection plus non-destructive command execution
(`tsc`, `eslint`, `vitest`, `vite build`, read-only SQL). No application code,
configuration, dependencies, database or Git history was modified.

> **Every claim below is evidenced by a file path or captured command output.**
> Where something could not be established, it is marked UNKNOWN rather than
> inferred.

---

## STEP 1 — PROJECT IDENTITY

| Item | Value |
|---|---|
| Repository root | `/Users/arkabera/Desktop/Wayam AI/MEDGUARD/medguard-shield-main` |
| Current branch | `main` |
| Remote | `origin` → `https://github.com/WayamAI/MedGuard_Shield.git` |
| Current commit | `d79f26bd66b2d5abfafa5c8d3477b5cae7ba8e1d` |
| Latest commit time | 2026-09-21 13:17:55 +0530 |
| Latest commit subject | `Merge fix/final-verification: pre-demo click-through fixes` |
| Working tree | **Clean** — no modified (tracked) files |
| Untracked files | `Logos/` (2 Drishti SVGs — see STEP 14), plus this report |

Recent history (most recent first):

```
d79f26b Merge fix/final-verification: pre-demo click-through fixes
c936483 Give the Import page a title, and pin every other one
666b1b9 Stop an unscored vendor crashing the Vendor Risk page
2d292fd Clear the 15 lint errors that were failing the gate
d1d6106 Correct limitation 1: the empty Risk Register is correct behaviour
f45e12f Record the pre-demo QA pass
41d3d0a Call an expired session what it is, not a lost connection
d44a9c3 Cover the import flow, the tables and the new role gate
eec81c7 Add the CSV import UI against the verified contract
```

Other local branches exist: `backup/pre-reorder`, `design-system-retrofit`,
`feat/backend-integration`, `post-demo/expansion`, `fix/final-verification`.

### Naming status

**The Drishti rename has not started in code.** No tracked source file,
config, document or asset path contains `drishti`. The product is named
MedGuard throughout.

**However, Drishti brand assets are present but untracked and unwired:**
`Logos/Drishti-darkmode.svg` and `Logos/Drishti-lightmode.svg` (28 KB total).
They are not committed, not imported by any module, and sit in a root-level
`Logos/` directory rather than `src/assets/brand/` where the existing Wayam
marks live. Rename groundwork has therefore been *started at the asset level
only*. See STEP 14.

---

## STEP 2 — TECHNOLOGY STACK

Versions are the **resolved** versions from `package-lock.json`, not the
semver ranges in `package.json`.

| Concern | Actual | Evidence |
|---|---|---|
| Framework | React 18.3.1 | `package-lock.json` |
| Language | TypeScript 5.8.3 | `package-lock.json` |
| Build tool | Vite 5.4.19 + `@vitejs/plugin-react-swc` | `vite.config.ts` |
| Package manager | **Ambiguous** — both `package-lock.json` (npm) and `bun.lockb` present; no `packageManager` field | repo root |
| Node requirement | **None declared** — `engines` absent from `package.json`; CI pins Node 20 | `package.json`, `.github/workflows/ci.yml` |
| Styling | Tailwind CSS 3.4.17 + custom token layer | `tailwind.config.ts`, `src/styles/tokens.css` |
| Component library | shadcn/ui present (49 files) but **almost entirely unused** — see STEP 12 | `src/components/ui/` |
| Actual design system | `src/components/ui-bits.tsx` (18 hand-written exports) | `src/components/ui-bits.tsx` |
| Server state | TanStack Query 5.83.0 | `src/hooks/useApiQuery.ts` |
| Client state | React Context (`AppStore`, `AuthProvider`, `ThemeProvider`) — no Redux/Zustand | `src/store/AppStore.tsx` |
| Routing | react-router-dom 6.30.1 | `src/App.tsx` |
| Charts | Recharts 2.15.4 + hand-built SVG (`PhiSankey`, `RiskMatrix`) | `src/components/PhiSankey.tsx` |
| Icons | lucide-react 0.462.0, wrapped by `AppIcon` | `src/lib/icons.ts` |
| Toasts | sonner 1.7.4, wrapped by `src/lib/notify.ts` | `src/lib/notify.ts` |
| Theming | `next-themes` installed but **unused**; theming is custom | `src/hooks/use-theme.tsx` |
| Testing | Vitest 3.2.4 + Testing Library 16.3.2 + jsdom 20.0.3 | `vitest.config.ts` |
| Linting | ESLint 9.32.0 flat config + typescript-eslint 8.38.0 | `eslint.config.js` |
| Formatting | **None** — no Prettier, no `.editorconfig` | repo root |
| Env config | Single variable `VITE_API_BASE_URL` | `src/lib/apiClient.ts:53` |
| Auth | Bearer JWT, in-memory only | `src/hooks/use-auth.tsx` |

### Dependencies installed but unused in application code

`zod`, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `next-themes`,
`cmdk`, `embla-carousel-react`, `input-otp`, `react-day-picker`,
`react-resizable-panels`, `vaul`, and ~25 `@radix-ui/*` packages reachable only
through unused shadcn files. Verified by grepping application imports — the
only `@/components/ui/*` imports outside `src/components/ui/` are:

```
src/App.tsx:4       @/components/ui/sonner
src/App.tsx:5       @/components/ui/tooltip
src/hooks/use-toast.ts:3  @/components/ui/toast  (type-only import)
```

These do not bloat the shipped bundle (Vite tree-shakes them), but they are
substantial dead source and dependency surface.

---

## STEP 3 — ARCHITECTURE

### Actual data flow (verified, not assumed)

```
Page component  (src/pages/*.tsx)
  └─ domain hook            src/hooks/use{Assets,Vendors,Risks,Access,Threats,DataFlows}.ts
       └─ useApiQuery       src/hooks/useApiQuery.ts        TanStack Query + poll/reconnect
            └─ api.get      src/lib/apiClient.ts            bearer header, { data } unwrap
                 └─ HTTP    GET ${VITE_API_BASE_URL}/api/...
       └─ optional mapper   src/lib/mappers.ts              wire shape → component props
  └─ <DataState query={…}>  src/components/DataState.tsx    loading | auth | error | empty | stale
       └─ children(data)    the real view
```

This is genuinely how the six backend-connected pages work. It is a clean,
consistent pipeline and the strongest part of the codebase.

**Import uses a second, parallel path** (necessarily — multipart and blob
cannot go through the JSON wrapper):

```
ImportData page → useImport.ts → api.upload / api.download → apiClient
```

### Architectural inconsistencies

1. **Two competing design systems.** `ui-bits.tsx` is used by all 13 pages;
   the 49-file shadcn `ui/` directory is effectively abandoned. `components.json`
   still configures shadcn as if it were live.
2. **Two state paradigms for the same domain.** `AppStore` holds mock alerts
   and notifications while `useThreats` holds real ones. `src/hooks/useThreats.ts`
   acknowledges this in a comment: *"this does not replace AppStore's alerts…
   the two are separate concerns until those consumers are migrated."*
3. **No service layer between hooks and the API client** — paths are string
   literals inside each hook. Workable at this size; there is no endpoint registry.
4. **No mutation layer.** `useMutation` appears exactly once in the codebase
   (`src/hooks/useImport.ts:84`). There is no create/update/delete infrastructure.
5. **Orphan file** `src/pages/Index.tsx` is not routed (self-documented as such).

---

## STEP 4 — ROUTE INVENTORY

Source: `src/App.tsx`. All non-login routes are wrapped in `ProtectedRoute`
and rendered inside `Layout` with `React.lazy` code splitting.

| Route | Page | Purpose | Backend connected | Data source | Status |
|---|---|---|---|---|---|
| `/login` | `Login.tsx` | Sign in | **Yes** | `POST /api/auth/login` | **REAL** |
| `/` | `Dashboard.tsx` | Governance Overview | **Partially** | 3 live hooks **+ mock** | **PARTIALLY WIRED** |
| `/phi-flow` | `PhiFlow.tsx` | PHI Data Flow Map | **Yes** | `GET /api/dataflows` | **REAL** (actions partly fake) |
| `/access` | `Access.tsx` | Access & Identity | **Yes** | `GET /api/access` | **REAL** |
| `/threats` | `Threats.tsx` | Threat Detection | **Yes** | `GET /api/threats` | **REAL** |
| `/policy` | `Policy.tsx` | Policy & Compliance | **No** | `src/data/mock.ts` | **MOCK** (disclosed) |
| `/ai` | `AI.tsx` | AI Governance | **No** | `src/data/mock.ts` | **MOCK** (disclosed) |
| `/audit` | `Audit.tsx` | Audit & Reports | **No** | `src/data/mock.ts` | **MOCK** (disclosed) |
| `/risks` | `Risks.tsx` | Risk Register / Matrix | **Yes** | `GET /api/risks` | **REAL** |
| `/vendors` | `Vendors.tsx` | Vendor Risk | **Yes** | `GET /api/vendors` | **REAL** |
| `/import` | `ImportData.tsx` | CSV Import (ADMIN) | **Yes** | `GET/POST /api/import/*` | **REAL** |
| `*` | `NotFound.tsx` | 404 | n/a | — | **STATIC** |

**No route exists for:** Settings, Profile/Account, Assets (as a managed list),
PHI Types, Controls (standalone), Remediation, Reports, Notifications centre,
Admin/User management, Organisation.

---

## STEP 5 — FEATURE-BY-FEATURE AUDIT

### 1. Authentication — REAL, well implemented
- `POST /api/auth/login` → `{ token, expiresIn, user }` (`src/hooks/use-auth.tsx:105`)
- `POST /api/auth/logout`, fire-and-forget, session dropped locally first (`:135`)
- Token held in a **React ref, never persisted** (`:74`)
- Client-side email/password validation before the request (`:98-103`)
- Distinct messages for 401 / network failure / other (`:118-126`)
- Tests: `role-gate.test.tsx` (10), `session-notice.test.tsx` (5), `live-backend.test.tsx`
- **Gap:** `GET /api/auth/me` exists server-side and is exercised by tests, but
  **no application code calls it** — so there is no session-validation path.

### 2. Dashboard — PARTIALLY WIRED, and this is the most significant finding
Real (`src/pages/Dashboard.tsx:11-13`): the four KPI tiles, computed from
`useAssets`, `useRisks`, `useDataFlows`.

**Mock, presented as live with no disclosure:**

| Section | Source | Evidence |
|---|---|---|
| Governance Health Score `94`, `+2.1%` | hardcoded constant | `Dashboard.tsx:18` `const HEALTH_SCORE = 94` |
| Sub-scores 97% / 91% / 82% | hardcoded array | `Dashboard.tsx:20-24` `HEALTH_SEGMENTS` |
| Compliance Frameworks (HIPAA/SOC2/ISO/HITRUST, all scores and dates) | `mock.ts` | `Dashboard.tsx:9` |
| Recent Alerts + Resolve buttons | `AppStore` → `mock.ts` | `Dashboard.tsx:176` |
| Department Risk Heat Map | `mock.ts` | `Dashboard.tsx:361` |
| Live Activity Feed (ticking timestamps) | `mock.ts` + `setInterval` | `Dashboard.tsx:214-220` |

`SampleDataNotice` is rendered on `/policy`, `/ai` and `/audit`
(`AI.tsx:35`, `Policy.tsx:36`, `Audit.tsx:45`) but **not** on `/`. The flagship
screen is the only page that mixes fabricated and live figures without saying so.
A "Live Activity Feed" with advancing timestamps is actively misleading.

### 3. PHI Flow — REAL data, partly theatrical actions
- `GET /api/dataflows` → `toSankeyData` → custom SVG Sankey (`PhiSankey.tsx`)
- Exposure score genuinely derived from flow volumes (`PhiFlow.tsx:72-77`)
- `Scan Now` performs a real refetch (`PhiFlow.tsx:26-32`) ✅
- `Export Map` → toast only (`:107`) ❌
- `View Detailed Report` → toast only (`:172`) ❌
- **`Remediate Now` wizard is local state only** (`:79-87`): sets `remediated`,
  recolours edges, and announces *"Violation resolved, encryption applied."*
  Nothing is written; a refresh reverts it. **This is the highest-severity
  false affordance in the app** — it claims a security remediation occurred.

### 4. Risk Matrix / Register — REAL, clean
`useRawRisks` → `GET /api/risks`. Band colour comes from the API, never
re-derived client-side (`Risks.tsx`, verified live: 7 of 8 rows have an API
band differing from naïve L×I). Refresh and per-row View drawer are real.
No create/edit/recompute UI.

### 5. Risk Management (recompute/remediate workflow) — **ABSENT**
Backend exposes `POST /api/risks/:assetId/recompute` (`risks.ts:27`).
**No frontend code calls it.**

### 6. Assets — **NO UI**
`useAssets` exists and is consumed only for a Dashboard count. There is no
asset list, detail, create or edit screen, despite
`GET /api/assets/:id`, `POST /api/assets`, `PATCH /api/assets/:id` all existing.

### 7. PHI Types — **NO UI** beyond being an import target. No read endpoint is
called; PHI type names appear only inside data-flow records.

### 8. Data Flows — read-only via the Sankey. No CRUD.

### 9. Vendors — REAL, read-only
`GET /api/vendors`; table, band summary, detail drawer, search and BAA filter
all real. Unscored vendors handled correctly since `666b1b9`.
`POST /api/vendors`, `PATCH /api/vendors/:id`, `POST /api/vendors/:id/recompute`
all exist server-side and are **never called**.

### 10. Access / Identity — REAL, read-only
`GET /api/access` returns an envelope with a server-computed summary, rendered
verbatim rather than recomputed (`useAccess.ts` comment). Findings tags,
filters, detail drawer all real. No grant revoke/modify — and no backend
endpoint for it either.

### 11. Threats — REAL, read-only
`GET /api/threats`. Sidebar badge reads the same query (`Layout.tsx:76`), so it
cannot drift. No status transitions (investigate/resolve) — no endpoint either.

### 12. CSV Import — REAL and the most complete feature
`useImport.ts`: contract fetch, template download, validate, commit.
All 7 entities (`apiTypes.ts:168`). Client-side `.csv` and 2 MB guards
(`ImportData.tsx:13,56-67`), validate-before-commit, per-row error table,
query invalidation on success. 66 tests across three files.

### 13/14/15. Policy, Audit, AI — MOCK, **correctly disclosed**
All three render `SampleDataNotice`. All interactive controls are toast-only
(see STEP 8). This is honest demo-ware, not accidental mocking.

### 16. Settings — **DOES NOT EXIST** (no route, no page, no component).

### 17. User/profile — **MINIMAL**. Sidebar shows initials, derived display
name (`deriveName`, `use-auth.tsx:52`) and email. No profile page, no password
change, no preferences beyond theme.

### 18. Navigation — REAL. `NAV` array in `Layout.tsx:18-30`, role-filtered
(`:72`), persisted collapse (`:86-95`), live threat badge, mobile drawer.

### 19. Search — **FAKE.** The header search box (`Layout.tsx:220-247`) renders
**four hardcoded results** and never reads the typed value. Per-page search
inputs on Vendors/Access/Threats **are** real client-side filters.

### 20. Notifications — **MOCK.** Bell count and slide-over come from
`AppStore` → `mock.ts:1` (`initialNotifications`). Mark-as-read mutates local
state only.

### 21. Newly added since baseline — `src/test/typing-regressions.test.tsx`
(4 tests), expanded `nav-badge.test.tsx` (page-title coverage for all 10
routes), null-safe vendor rendering.

---

## STEP 6 — API INTEGRATION AUDIT

### Every request the frontend makes

| Function | Method | Endpoint | Used by | Auth | Implemented |
|---|---|---|---|---|---|
| `login` | POST | `/api/auth/login` | `use-auth.tsx:105` | No | ✅ |
| `logout` | POST | `/api/auth/logout` | `use-auth.tsx:135` | Yes | ✅ |
| `useAssets` | GET | `/api/assets` | Dashboard | Yes | ✅ |
| `useDataFlows` / `useRawDataFlows` | GET | `/api/dataflows` | PhiFlow, Dashboard | Yes | ✅ |
| `useRisks` / `useRawRisks` | GET | `/api/risks` | Risks, Dashboard | Yes | ✅ |
| `useVendors` | GET | `/api/vendors` | Vendors | Yes | ✅ |
| `useAccess` | GET | `/api/access` | Access | Yes | ✅ |
| `useThreats` | GET | `/api/threats` | Threats, Layout badge | Yes | ✅ |
| `useImportEntities` | GET | `/api/import` | ImportData | ADMIN | ✅ |
| `useTemplateDownload` | GET | `/api/import/:entity/template` | ImportData | ADMIN | ✅ |
| `useValidateImport` | POST | `/api/import/:entity/validate` | ImportData | ADMIN | ✅ |
| `useRunImport` | POST | `/api/import/:entity` | ImportData | ADMIN | ✅ |

**Frontend calls no endpoint that the backend lacks.** No broken paths, no
method mismatches, no duplicate implementations.

### Backend capability the frontend does not use

| Endpoint | Purpose | Frontend status |
|---|---|---|
| `GET /api/auth/me` | session validation | **unused in app** (tests only) |
| `GET /api/assets/:id` | asset detail | unused |
| `POST /api/assets` | create asset | **unused — no UI** |
| `PATCH /api/assets/:id` | edit asset | **unused — no UI** |
| `GET /api/vendors/:id` | vendor detail | unused (drawer uses list row) |
| `POST /api/vendors` | create vendor | **unused — no UI** |
| `PATCH /api/vendors/:id` | edit vendor | **unused — no UI** |
| `POST /api/vendors/:id/recompute` | rescore vendor | **unused — no UI** |
| `POST /api/risks/:assetId/recompute` | rescore asset risk | **unused — no UI** |
| `GET /health` | liveness | unused |

**This is the central integration gap: the backend supports create, update and
rescore for assets, vendors and risks; the frontend is read-only plus CSV
import.** The only `useMutation` in the codebase is the import commit.

Note: the liveness endpoint is `GET /health`, **not** `/api/health` —
everything under `/api` is behind `requireAuth` (`backend src/app.ts:50`).

### Error handling
Centralised and genuinely good. `ApiError` carries `status`, `url`, `body`,
with `isAuthError` / `isNetworkError` (status 0 for transport failure).
`describeApiError` (`src/lib/apiErrors.ts`) maps to human copy. `DataState`
resolves all five states uniformly. Import errors deliberately preserve the
parsed 400 body so the per-row report survives (`apiClient.ts`, `apiUpload`).

---

## STEP 7 — AUTHENTICATION & AUTHORIZATION

| Aspect | Implementation | Evidence |
|---|---|---|
| Login | `POST /api/auth/login`, bearer JWT | `use-auth.tsx:105` |
| Token storage | **In-memory ref only** — never localStorage/sessionStorage | `use-auth.tsx:74` |
| Token injection | `setAuthTokenGetter` indirection, avoids import cycle | `apiClient.ts:44` |
| Cookies | `credentials: "omit"` — deliberately refuses the httpOnly cookie the API also sets | `apiClient.ts:~100` |
| Refresh | **None.** No refresh endpoint exists server-side | `use-auth.tsx:16-19` |
| Expiry handling | `expiresIn` is received and **ignored** — no timer, no proactive logout | `use-auth.tsx:38` |
| Behaviour on reload | Session ends; `ProtectedRoute` → `/login`; breadcrumb explains why | `sessionBreadcrumb.ts` |
| Route protection | `ProtectedRoute`, optional `requireRole` | `ProtectedRoute.tsx` |
| Role enforcement | Client-side is convenience only; self-documented as such | `ProtectedRoute.tsx:19-22` |
| ADMIN-specific UI | `/import` route gate + nav filter | `App.tsx:58-65`, `Layout.tsx:72` |
| 401 handling | Query retry suppressed; poll stops; distinct error state | `useApiQuery.ts:79`, `DataState.tsx` |

The in-memory design is a deliberate, well-reasoned trade recorded in code
comments: XSS cannot exfiltrate a token from storage, at the cost of a reload
ending the session. **Only real gap:** `expiresIn` is unused, so an expired
token is discovered on the next 401 rather than anticipated.

---

## STEP 8 — UI ACTION AUDIT

44 `notify.*` calls across 6 files. Two are truthful (`Signed out`;
`Scan complete` after a real refetch). **The remaining ~42 are toast-only or
otherwise misrepresent what happened** — consistent with the baseline's "~42".

### High severity — claims a state change on a backend-connected page

| Location | Action | Current behaviour | Real call | Severity |
|---|---|---|---|---|
| `PhiFlow.tsx:79-87` | **Remediate Now** wizard | Local state; toast *"Violation resolved, encryption applied"* | ❌ | **HIGH** |
| `Layout.tsx:106-112` | Header **Refresh** | `setTimeout(1500)` then *"Dashboard refreshed"*; **no refetch of any query** | ❌ | **HIGH** |
| `Dashboard.tsx:424` | Alert **Resolve** | Mutates mock `AppStore` | ❌ | **HIGH** |
| `Layout.tsx:220-247` | Global **search** | 4 hardcoded results, ignores input | ❌ | **HIGH** |

### Medium — mock pages, disclosed by `SampleDataNotice`

| Location | Count | Examples |
|---|---|---|
| `AI.tsx` | 14 | Configure Thresholds, Download Model Card, Flag for Retraining, Register Model, Generate Bias Report |
| `Policy.tsx` | 12 | Create Policy, Create Control, Archive, Generate Evidence, Schedule Audit, approve/reject |
| `Audit.tsx` | 8 | Apply Filters, Generate Report, Download Now, Send via Email, Run Now, Save schedule |

These sit behind a visible disclosure, so they are honest prototype surface —
but note `Policy.tsx:189` toasts *"Policy created"* and `Audit.tsx:172` names a
concrete file (`audit_trail_2025-05-05.csv`) that is never produced.

### Low
`Dashboard.tsx:91,166` evidence/export downloads; `PhiFlow.tsx:107,172`
Export Map / Detailed Report.

### Genuinely functional actions
Login, logout, all page-level **Refresh** buttons (`risks.refresh()`,
`vendors.refresh()`, `access.refresh()`, `threats.refresh()`), PhiFlow
**Scan Now**, every detail-drawer **View**, all per-page search/filter
controls, theme toggle, sidebar collapse, and the entire import flow.

### Markers
Exactly one TODO in the codebase: `Dashboard.tsx:300` — *"wire `healthPeriod`
to a real time-range query"*. No FIXME, no "coming soon", no "not implemented".

---

## STEP 9 — DATA & MOCK AUDIT

Single source: **`src/data/mock.ts`** (137 lines, 10 exports).

| Export | Consumed by | Intentional? |
|---|---|---|
| `policies`, `controls`, `approvals` | `Policy.tsx` | ✅ disclosed |
| `auditLog` | `Audit.tsx` | ✅ disclosed |
| `aiDecisions` | `AI.tsx` | ✅ disclosed |
| `frameworks` | `Policy.tsx` **and `Dashboard.tsx`** | ⚠️ **undisclosed on Dashboard** |
| `departmentRisks` | `Dashboard.tsx` | ⚠️ **undisclosed** |
| `activitySamples` | `Dashboard.tsx` | ⚠️ **undisclosed** |
| `alerts` | `AppStore` → `Dashboard.tsx` | ⚠️ **undisclosed** |
| `initialNotifications` | `AppStore` → `Layout.tsx` bell | ⚠️ **undisclosed, app-wide** |

Plus hardcoded values outside `mock.ts`:
- `Dashboard.tsx:18` `HEALTH_SCORE = 94`
- `Dashboard.tsx:20-24` `HEALTH_SEGMENTS`
- `Layout.tsx:82` `lastSync` initialised to the string `"2 mins ago"`
- `Layout.tsx:230-235` the four fake search results

**There is no mock API layer and no fallback data path.** When the API is
unreachable the wired pages render an error state rather than silently
substituting fixtures (`.env.example` states this explicitly). That is the
right design and it is correctly implemented — the mock problem is confined to
components that never had an endpoint, plus the Dashboard's undisclosed mixing.

---

## STEP 10 — TESTING AUDIT

Framework: Vitest 3.2.4, jsdom, Testing Library. **17 files, 185 tests.**
All executed during this audit.

| File | Tests | Kind |
|---|---|---|
| `import-hooks.test.tsx` | 34 | hook + API mocking |
| `import-tables.test.tsx` | 17 | component |
| `mappers.test.ts` | 17 | pure unit |
| `import-page.test.tsx` | 15 | integration |
| `nav-badge.test.tsx` | 14 | component + route titles |
| `resilience.test.tsx` | 13 | error/reconnect |
| `vendors.test.tsx` | 12 | component + null-risk regression |
| `live-backend.test.tsx` | 12 | **real HTTP integration** |
| `components.test.tsx` | 10 | component |
| `role-gate.test.tsx` | 10 | authorization |
| `access-threats.test.tsx` | 9 | component |
| `session-notice.test.tsx` | 5 | auth UX + storage assertions |
| `mock-pages.test.tsx` | 5 | smoke render |
| `typing-regressions.test.tsx` | 4 | behavioural regression |
| `pending-hooks.test.tsx` | 4 | hook |
| `api-query.test.tsx` | 3 | hook |
| `example.test.ts` | 1 | **placeholder — `expect(true).toBe(true)`** |

### Concerns

1. **`live-backend.test.tsx` self-skips silently.** `live()`
   (`live-backend.test.tsx:74-81`) returns early when the backend is
   unreachable *or* `DEMO_USER_PASSWORD` is unset — and the test still
   **reports as passed**. Without credentials the run shows
   `185 passed` while 12 assertions executed nothing. Observed directly:
   ```
   [skip] DEMO_USER_PASSWORD not set
   Tests  185 passed (185)
   ```
   A skip that reports green is worse than a failure.
2. **No coverage tooling.** No `coverage` key in `vitest.config.ts`, no
   `@vitest/coverage-*` dependency, no coverage script. Coverage is unmeasured.
3. **`example.test.ts` is a placeholder** asserting `true`.
4. **Untested areas:** `Dashboard.tsx`, `PhiFlow.tsx`, `Policy.tsx`, `AI.tsx`
   and `Audit.tsx` have no dedicated test file. `mock-pages.test.tsx` smoke-renders
   three of them and asserts the sample-data notice, nothing more. The Dashboard —
   the app's most complex page — has no test of its own.
5. CI excludes `live-backend.test.tsx` deliberately (`ci.yml`), so integration
   coverage never runs in CI at all.

---

## STEP 11 — BUILD / TYPECHECK / LINT / TESTS

All commands run during this audit; results are observed, not assumed.

```
BUILD:      PASS   npm run build            → exit 0, built in 2.23s
TYPECHECK:  PASS   tsc --noEmit -p tsconfig.app.json  → exit 0, 118 files
            PASS   tsc --noEmit -p tsconfig.node.json → exit 0
LINT:       PASS   npm run lint             → exit 0, 0 errors, 10 warnings
TESTS:      PASS   npx vitest run --exclude live-backend → 173 passed
            PASS   npm test                 → 185 passed (12 self-skipped w/o creds)
            PASS   live-backend with creds  → 12 passed against the real API
```

### ⚠️ The typecheck command in common use is a no-op

`npx tsc --noEmit` (no `-p`) **checks zero files**, because the root
`tsconfig.json` sets `"files": []` and only lists project references.
Verified:

```
$ npx tsc --noEmit --listFilesOnly | wc -l
0
$ npx tsc --noEmit -p tsconfig.app.json --listFilesOnly | grep -v node_modules | wc -l
118
```

It always exits 0 and proves nothing. CI uses the correct `-p` form and
`ci.yml` documents the trap — but anyone running the bare command locally gets
a false green.

### ⚠️ Null-safety is disabled, and this is why the vendor crash shipped

`tsconfig.app.json` sets `"strict": false` and `"noImplicitAny": false`;
`strictNullChecks` therefore defaults to **off**. Empirically confirmed with a
probe file compiled under each setting:

```
type V = { risk: { score: number } | null };
const v: V = { risk: null };
v.risk.score;
  --strict false      → no error          (repo's effective setting)
  --strictNullChecks  → error TS18047: 'v.risk' is possibly 'null'
```

**Consequence:** the `| null` added to `ApiVendor.risk` in commit `666b1b9` is
*documentation only* — the compiler will not enforce it, and the same class of
crash can recur anywhere. Only the runtime guards and tests prevent it.

### Lint warnings (10, all non-blocking)
All `react-refresh/only-export-components`, in files that export both a
component and a hook/constant: `use-auth.tsx:149`, `use-theme.tsx:54`,
`AppStore.tsx:64`, plus 7 shadcn files. Cosmetic, HMR-related only.

### CI gaps (`.github/workflows/ci.yml`)
- Lint runs with `continue-on-error: true` — **never gates** (currently passing anyway)
- Node 20 in CI vs Node 26.7.0 locally — untested version skew
- No build-artifact, bundle-size or coverage gate

---

## STEP 12 — PERFORMANCE

Measured from the real build.

| Artifact | Raw | Gzip |
|---|---|---|
| `index-BOlj0iGA.js` (vendor+shell) | 389.39 kB | **120.23 kB** |
| `BarChart-uBu8lmcC.js` (Recharts) | 364.95 kB | **100.82 kB** |
| `index-CWdRB1s8.css` | 82.28 kB | 14.82 kB |
| Largest page chunk (`AI`) | 20.55 kB | 5.68 kB |
| Smallest page chunk (`NotFound`) | 0.62 kB | 0.38 kB |

**Working well:**
- Route-level splitting is real — every page is its own chunk (`App.tsx:11-21`)
- Recharts is isolated in a shared chunk, so non-chart routes never load it
- TanStack Query dedupes: the threat badge and Threats page share `["threats"]`,
  so one poll serves both (`Layout.tsx:76` + `useThreats.ts`)
- `staleTime: 30_000` prevents refetch storms
- `refetchIntervalInBackground: false` — hidden tabs stop polling
- `dedupe` in `vite.config.ts` prevents duplicate React/Query copies
- Skeletons are height-matched to prevent layout shift (`ChartSkeleton`)

**Concerns:**
1. **Recharts is 365 kB raw / 101 kB gzip** — the single heaviest dependency,
   for bar charts on Dashboard/AI. The bespoke `PhiSankey` and `RiskMatrix`
   are hand-rolled SVG and cost nothing by comparison.
2. **Every wired page polls every 30 s** with no global coordination; six open
   views mean six independent intervals.
3. **`Dashboard.tsx:214-226` runs a `setInterval` ticker** purely to animate
   fake activity rows — perpetual re-renders for mock data.
4. 49 shadcn files are dead source. They are tree-shaken from the bundle (no
   chunks emitted), so this is maintenance cost, not runtime cost.
5. No `manualChunks`, no bundle-size budget, no analyzer.

---

## STEP 13 — SECURITY

**The security posture is the strongest aspect of this frontend.**

| Check | Finding |
|---|---|
| Token storage | ✅ In-memory ref only; never localStorage/sessionStorage (`use-auth.tsx:74`) |
| Cookie handling | ✅ `credentials: "omit"` deliberately refuses the httpOnly cookie so the bearer header is the sole grant (`apiClient.ts`) |
| `dangerouslySetInnerHTML` | ✅ **None in application code.** One occurrence in `src/components/ui/chart.tsx:70` — an unused shadcn file, not reachable |
| `eval` / `new Function` | ✅ None |
| Browser storage contents | ✅ Only `medguard-theme`, `medguard-sidebar-collapsed` (localStorage) and `medguard-had-session` = `"1"` (sessionStorage). All non-sensitive. **Asserted by test** (`session-notice.test.tsx:106-113`) |
| PHI in URLs | ✅ All routes static; no identifiers in paths or query strings |
| Env exposure | ✅ Single `VITE_API_BASE_URL`; no keys or secrets bundled |
| Secrets in repo | ✅ `.env.example` documents names only; `.env.local` git-ignored |
| Console logging | ✅ One call — `NotFound.tsx:8` logs the attempted pathname. Harmless given static routes |
| Upload validation | ✅ Extension + 2 MB size checked client-side, **and server-side** (`ImportData.tsx:13,56-67`) |
| CSV handling | ✅ Never parsed in-browser; posted as multipart, server validates |
| Client-side authz | ✅ Correctly treated as cosmetic; `ProtectedRoute.tsx:19-22` documents that the API is the real gate |

### Residual items (low severity)
1. **`expiresIn` ignored** (`use-auth.tsx:38`) — no proactive expiry; a stale
   token is discovered only via 401.
2. **No Content-Security-Policy** meta tag in `index.html`; backend sets
   `helmet({ contentSecurityPolicy: false })`. CSP is disabled end-to-end.
3. **`index.html` loads Google Fonts from two external origins** — a
   third-party runtime dependency on `fonts.googleapis.com` / `fonts.gstatic.com`.
4. Error responses surface backend messages verbatim into the UI via
   `describeApiError`; benign today, worth noting as an information-disclosure
   surface.

---

## STEP 14 — BRANDING AUDIT

### Status: assets staged, code untouched

`Drishti` appears in **no tracked source file, config, document, or string
literal**. The only occurrences anywhere are two untracked asset files:

| Path | Tracked | Imported by any module | Notes |
|---|---|---|---|
| `Logos/Drishti-darkmode.svg` | ❌ untracked | ❌ no | light/dark pair, mirrors the existing Wayam convention |
| `Logos/Drishti-lightmode.svg` | ❌ untracked | ❌ no | — |

Observations for whoever performs the rename:

- The files are **uncommitted**, so they are absent from CI and from any clone.
- They live in a root-level `Logos/` directory, **not** `src/assets/brand/`
  where `wayam-logo-{light,dark}.svg` are imported from
  (`src/components/Layout.tsx:9-11`, `src/pages/Login.tsx:7-8`). Vite will not
  process them from their current location.
- There is **no Drishti favicon** in the set; `public/favicon.svg` and
  `public/favicon.ico` are unchanged.
- The existing logo slots take a light/dark pair plus a collapsed-sidebar mark
  (`wayam-favicon.svg`, `Layout.tsx:144`) — the Drishti set supplies the pair
  but **no equivalent collapsed mark**, so that third slot has no replacement.

Everything below remains MedGuard.

### User-visible MedGuard references (must change)

| File | Line | Content |
|---|---|---|
| `index.html` | 6 | `<title>MedGuard \| Healthcare Governance & Compliance</title>` |
| `index.html` | 7 | meta description — *"MedGuard: real time governance…"* |
| `index.html` | 25 | `og:title` = `MedGuard by Wayam AI` |
| `index.html` | 26 | `og:description` = *"Healthcare Governance & Compliance Platform"* |
| `src/components/Layout.tsx` | 150 | Sidebar wordmark `MedGuard` |
| `src/components/Layout.tsx` | 126 | Page-title fallback `\|\| "MedGuard"` |
| `src/pages/Login.tsx` | 58 | `<h1>Sign in to MedGuard</h1>` |
| `src/pages/Login.tsx` | 142 | *"Sign in with your MedGuard account…"* |

### Persisted storage keys (renaming these silently resets users' preferences)

| File | Line | Key |
|---|---|---|
| `src/hooks/use-theme.tsx` | 11 | `medguard-theme` |
| `index.html` | 13 | `medguard-theme` (inline anti-FOUC script — **must stay in sync**) |
| `src/components/Layout.tsx` | 52 | `medguard-sidebar-collapsed` |
| `src/lib/sessionBreadcrumb.ts` | 10 | `medguard-had-session` |

### Generated filenames

| File | Line | Value |
|---|---|---|
| `src/hooks/useImport.ts` | 158 | fallback download name `medguard-${entity}-template.csv` |

Note the backend also sets `content-disposition: medguard-*-template.csv`
(asserted in `import-hooks.test.tsx:333,360,366`) — **renaming requires a
coordinated backend change**, or the server value will keep overriding the client fallback.

### Comments / docs / config (cosmetic)
`src/lib/apiClient.ts:2,102`, `src/lib/apiTypes.ts:2`, `src/hooks/use-auth.tsx:6`,
`src/styles/tokens.css:2`, `.env.example:1,7`, `README.md`, `USER_WORKFLOW.md`.

### Other branding facts
- Currently-wired logo assets are **Wayam AI** corporate marks
  (`src/assets/brand/wayam-*.svg`) — corporate, not product, branding. Whether
  the Drishti marks replace or sit alongside them is a **product decision, not
  a technical one**, and is not resolved by anything in the repository.
- `public/favicon.svg` / `.ico` — content not inspected; **UNKNOWN** whether
  they carry product-specific marks.
- `apiClient.ts:102` documents an httpOnly cookie named `medguard_token` issued
  by the backend — a **backend-owned** name, outside frontend control.
- Sidebar subtitle reads `Meridian Health` (`Layout.tsx:151`) — the fictional
  demo tenant, not product branding.
- The npm package is still named `vite_react_shadcn_ts` (`package.json:2`) —
  the original scaffold name, never set to any product name.

---

## STEP 15 — PRIORITIZED GAPS

Classification is technical (broken / misleading / unenforced / untested),
not product opinion.

### P0 — Blocking / critical

| # | Gap | Evidence |
|---|---|---|
| 1 | **Dashboard presents mock data as live** with no disclosure — hardcoded health score, mock frameworks, mock alerts, and a "Live Activity Feed" with advancing fake timestamps | `Dashboard.tsx:18,20-24,9,176,214-220`; contrast `AI.tsx:35` |
| 2 | **`Remediate Now` claims a security remediation that never happens** — local state + *"Violation resolved, encryption applied"* | `PhiFlow.tsx:79-87` |
| 3 | **Header Refresh refetches nothing** — a `setTimeout` then "Dashboard refreshed"; users trust stale data | `Layout.tsx:106-112` |
| 4 | **`strictNullChecks` disabled** — the exact bug class that produced the shipped vendor crash is invisible to the compiler; the `\| null` fix is unenforced | `tsconfig.app.json`, probe in STEP 11 |
| 5 | **Bare `tsc --noEmit` checks 0 files** and always passes — a false green for anyone not using `-p` | verified `--listFilesOnly` |

### P1 — Important

| # | Gap | Evidence |
|---|---|---|
| 6 | **No write operations except import** — backend create/update/recompute for assets, vendors, risks all unused | one `useMutation`, `useImport.ts:84` |
| 7 | **Global search is fake** — 4 hardcoded results, input ignored | `Layout.tsx:220-247` |
| 8 | **Notifications are entirely mock**, app-wide via the header bell | `AppStore.tsx` ← `mock.ts:1` |
| 9 | **Live integration tests self-skip while reporting green** | `live-backend.test.tsx:74-81` |
| 10 | **No Assets or PHI Types UI** despite endpoints existing | no page files |
| 11 | **`GET /api/auth/me` never called** — no session validation path | grep: app code |
| 12 | **Dashboard untested** — the most complex page has no test file | `src/test/` |
| 13 | **Lint non-gating in CI** (`continue-on-error: true`) | `ci.yml` |
| 14 | **`expiresIn` ignored** — no proactive expiry handling | `use-auth.tsx:38` |
| 15 | **Drishti rename not started in code** — 8 user-visible strings, 4 storage keys, 1 filename requiring backend coordination. Logo SVGs exist but are **untracked, unwired, and outside `src/assets/`**; no Drishti favicon or collapsed-sidebar mark | STEP 14 |

### P2 — Improvement

16. Two competing design systems; 49 dead shadcn files (`src/components/ui/`)
17. ~35 unused dependencies (`zod`, `react-hook-form`, `date-fns`, `next-themes`, most `@radix-ui/*`)
18. Recharts 365 kB raw for a small number of bar charts
19. No coverage tooling configured
20. `example.test.ts` placeholder asserting `true`
21. Dual lockfiles (`package-lock.json` + `bun.lockb`) with no `packageManager` field
22. No `engines` field; CI Node 20 vs local Node 26
23. No Prettier / `.editorconfig`
24. `AppStore` and `useThreats` model the same domain differently
25. `Dashboard.tsx:214-226` fake-activity `setInterval` causes perpetual re-renders
26. Orphan `src/pages/Index.tsx`
27. Package still named `vite_react_shadcn_ts`

### P3 — Future / optional

28. No CSP meta tag (disabled backend-side too)
29. Google Fonts loaded from external origins
30. No Settings or Profile surface
31. No global poll coordination — six views, six intervals
32. `Dashboard.tsx:300` TODO — wire `healthPeriod` to a real time-range query
33. No `manualChunks` or bundle-size budget
34. Favicon product-specificity UNKNOWN

---

## FRONTEND CURRENT STATE

### 1. Overall implementation status
A well-engineered **read-only** analytics frontend. Six of eleven screens are
genuinely backend-connected through a clean, consistent, well-tested data
pipeline. Three are openly-labelled mock prototypes. One (Dashboard) mixes real
and fabricated data without disclosure. The single write capability is CSV
import. Build, typecheck, lint and tests all pass.

### 2. Definitely working
Authentication (login/logout, bearer injection, in-memory token, role gate);
PHI Flow Map; Risk Matrix/Register; Vendor Risk (incl. unscored vendors);
Access & Identity; Threat Detection + live sidebar badge; the complete CSV
import flow for all 7 entities; error/loading/empty/reconnecting states;
theme switching; sidebar collapse persistence; route-level code splitting;
per-page search, filter and refresh controls.

### 3. Partially working
**Dashboard** — 4 real KPI tiles, everything else mock.
**PHI Flow** — real data, but Export / Detailed Report / Remediate are theatre.

### 4. Mocked
Policy, Audit, AI (disclosed); notifications and header search (undisclosed);
Dashboard health score, frameworks, alerts, heat map and activity feed
(undisclosed).

### 5. Broken
No crashing defects found. Build, typecheck, lint and 185 tests pass.
"Broken" here means *misleading*: P0 items 2 and 3 tell users something
happened that did not.

### 6. Unknown
Favicon product-specificity; runtime behaviour under concurrent multi-user
load; real-browser performance (no Lighthouse run); accessibility conformance
(not audited); visual behaviour at breakpoints below 1024 px.

### 7. Major architectural concerns
Two design systems; no mutation layer; parallel mock/real state models for
threats and alerts; no endpoint registry.

### 8. Major security concerns
**None of substance.** Token handling, storage hygiene, upload validation and
XSS surface are all sound and test-asserted. Residual items are minor:
unused `expiresIn`, no CSP, external font origins.

### 9. Major testing concerns
Integration tests self-skip while reporting green; no coverage measurement;
the most complex page is untested; lint does not gate CI.

### 10. Major integration concerns
The frontend consumes roughly half the backend's surface. Every create, update
and recompute endpoint is unused. The product concept
(*Asset → PHI → Identity/Access → Vendor → Control → Risk*) is **visualised
but not manageable** — a user can see everything and change almost nothing.

### 11. Branding status
**Assets staged, code untouched.** No tracked file references Drishti. Two
untracked logo SVGs sit in a root-level `Logos/` directory, unimported and
outside the asset pipeline. Still to change: 8 user-visible strings, 4 persisted
storage keys (renaming these silently resets users' theme and layout
preferences), and 1 generated filename that requires a coordinated backend
change. No Drishti favicon or collapsed-sidebar mark exists yet.

### 12. Most important technical gaps
(1) Dashboard's undisclosed mock data; (2) actions that claim state changes
they never make; (3) `strictNullChecks` off + a no-op typecheck command, which
together let a real crash ship; (4) absence of any write path beyond import.

---

## FRONTEND FEATURE MATRIX

| Feature | UI | Backend | Functional | Tested | Mocked | Status |
|---|---|---|---|---|---|---|
| Authentication | ✅ | ✅ | ✅ | ✅ | ❌ | **REAL** |
| Dashboard KPIs | ✅ | ✅ | ✅ | ⚠️ live-only | ❌ | **REAL** |
| Dashboard (rest) | ✅ | ❌ | ⚠️ | ❌ | ✅ | **MOCK, undisclosed** |
| PHI Flow Map | ✅ | ✅ | ✅ | ✅ | ❌ | **REAL** |
| PHI Flow actions | ✅ | ❌ | ❌ | ❌ | ✅ | **TOAST-ONLY** |
| Risk Matrix / Register | ✅ | ✅ | ✅ | ✅ | ❌ | **REAL** (read-only) |
| Risk recompute | ❌ | ✅ | ❌ | ❌ | — | **NOT BUILT** |
| Assets management | ❌ | ✅ | ❌ | ❌ | — | **NOT BUILT** |
| PHI Types | ❌ | ⚠️ import only | ❌ | ⚠️ | — | **NOT BUILT** |
| Data Flows | ✅ read | ✅ | ✅ | ✅ | ❌ | **REAL** (read-only) |
| Vendor Risk | ✅ | ✅ | ✅ | ✅ | ❌ | **REAL** (read-only) |
| Vendor CRUD/recompute | ❌ | ✅ | ❌ | ❌ | — | **NOT BUILT** |
| Access / Identity | ✅ | ✅ | ✅ | ✅ | ❌ | **REAL** (read-only) |
| Threats | ✅ | ✅ | ✅ | ✅ | ❌ | **REAL** (read-only) |
| CSV Import | ✅ | ✅ | ✅ | ✅ 66 tests | ❌ | **REAL** |
| Policy | ✅ | ❌ | ❌ | ⚠️ smoke | ✅ | **MOCK, disclosed** |
| Audit | ✅ | ❌ | ❌ | ⚠️ smoke | ✅ | **MOCK, disclosed** |
| AI Governance | ✅ | ❌ | ❌ | ⚠️ smoke | ✅ | **MOCK, disclosed** |
| Settings | ❌ | ❌ | ❌ | ❌ | — | **NOT BUILT** |
| User profile | ⚠️ display | ⚠️ | ⚠️ | ⚠️ | ❌ | **MINIMAL** |
| Navigation | ✅ | ✅ badge | ✅ | ✅ | ❌ | **REAL** |
| Global search | ✅ | ❌ | ❌ | ❌ | ✅ | **FAKE** |
| Page search/filter | ✅ | n/a | ✅ | ✅ | ❌ | **REAL** (client-side) |
| Notifications | ✅ | ❌ | ❌ | ❌ | ✅ | **MOCK, undisclosed** |
| Theme / layout prefs | ✅ | n/a | ✅ | ✅ | ❌ | **REAL** |

---

## FRONTEND → BACKEND DEPENDENCY MAP

```
Login                → POST /api/auth/login
Logout               → POST /api/auth/logout
                       GET  /api/auth/me          ← EXISTS, NEVER CALLED

Dashboard  (KPIs)    → GET /api/assets
                       GET /api/risks
                       GET /api/dataflows
Dashboard  (rest)    → src/data/mock.ts           ← NO BACKEND

PHI Flow Map         → GET /api/dataflows         (via toSankeyData)
Risk Matrix/Register → GET /api/risks             (via toMatrixRisks / raw)
Vendor Risk          → GET /api/vendors
Access & Identity    → GET /api/access            (summary + grants envelope)
Threats              → GET /api/threats           (summary + threats envelope)
Sidebar threat badge → GET /api/threats           (shared ["threats"] cache key)

CSV Import           → GET  /api/import                      (contracts)
                       GET  /api/import/:entity/template     (blob download)
                       POST /api/import/:entity/validate     (dry run)
                       POST /api/import/:entity              (commit)

Policy / Audit / AI  → src/data/mock.ts           ← NO BACKEND
Notifications        → src/data/mock.ts           ← NO BACKEND
Global search        → hardcoded array            ← NO BACKEND

UNUSED BACKEND CAPABILITY
  GET   /api/assets/:id
  POST  /api/assets                  create
  PATCH /api/assets/:id              update
  GET   /api/vendors/:id
  POST  /api/vendors                 create
  PATCH /api/vendors/:id             update
  POST  /api/vendors/:id/recompute   rescore
  POST  /api/risks/:assetId/recompute rescore
  GET   /health                      liveness
```

---

## EVIDENCE INDEX

| Conclusion | File · symbol |
|---|---|
| Rename not started | repo-wide `grep -ri drishti` → 0 matches |
| Routes and lazy loading | `src/App.tsx:11-21`, `:38-73` |
| Nav + role filter + badge | `src/components/Layout.tsx:18-30`, `:72`, `:76` |
| Fake header refresh | `src/components/Layout.tsx:106-112` `onRefresh` |
| Fake global search | `src/components/Layout.tsx:220-247` |
| Page-title fallback to product name | `src/components/Layout.tsx:126` |
| Storage keys to rename | `use-theme.tsx:11`, `Layout.tsx:52`, `sessionBreadcrumb.ts:10`, `index.html:13` |
| Dashboard mock imports | `src/pages/Dashboard.tsx:9-10` |
| Hardcoded health score | `src/pages/Dashboard.tsx:18`, `:20-24` |
| Fake activity ticker | `src/pages/Dashboard.tsx:214-226` |
| Dashboard TODO | `src/pages/Dashboard.tsx:300` |
| Fake remediation | `src/pages/PhiFlow.tsx:79-87` `completeRemediation` |
| Real scan refetch | `src/pages/PhiFlow.tsx:26-32` `onScan` |
| Sample-data disclosure | `AI.tsx:35`, `Policy.tsx:36`, `Audit.tsx:45` |
| Auth: in-memory token | `src/hooks/use-auth.tsx:74` `tokenRef` |
| Auth: `expiresIn` ignored | `src/hooks/use-auth.tsx:38` |
| Token injection indirection | `src/lib/apiClient.ts:44` `setAuthTokenGetter` |
| Cookie refusal | `src/lib/apiClient.ts` `credentials: "omit"` |
| Envelope unwrap | `src/lib/apiClient.ts` `apiFetch` |
| Multipart upload path | `src/lib/apiClient.ts` `apiUpload` |
| Authenticated blob download | `src/lib/apiClient.ts` `apiDownload` |
| Only mutation in codebase | `src/hooks/useImport.ts:84` `useMutation` |
| Template filename fallback | `src/hooks/useImport.ts:158` |
| Poll / reconnect / retry policy | `src/hooks/useApiQuery.ts:79-90` |
| Five-state resolution | `src/components/DataState.tsx` |
| Route guard + role check | `src/components/ProtectedRoute.tsx` |
| `ApiVendor.risk` nullability | `src/lib/apiTypes.ts:68` (+ backend `vendorService.ts:51`) |
| Import entity list | `src/lib/apiTypes.ts:168` |
| Mock data source | `src/data/mock.ts` (137 lines, 10 exports) |
| Mock-backed store | `src/store/AppStore.tsx:2` |
| Storage-contents assertion | `src/test/session-notice.test.tsx:106-113` |
| Silent test skip | `src/test/live-backend.test.tsx:74-81` `live()` |
| Placeholder test | `src/test/example.test.ts` |
| Typecheck no-op | `tsconfig.json` `"files": []` + `--listFilesOnly` = 0 |
| Null-safety disabled | `tsconfig.app.json` `"strict": false`; probe → TS18047 only with `--strictNullChecks` |
| Lint non-gating | `.github/workflows/ci.yml` `continue-on-error: true` |
| Bundle sizes | `npm run build` output, captured STEP 12 |
| Backend endpoint surface | `medguard-backend/src/app.ts:46-58`, `src/routes/*.ts` |
| Liveness is `/health` not `/api/health` | `medguard-backend/src/app.ts:40,50` |

---

## AUDIT INTEGRITY NOTE

Environment observed during this audit: frontend preview on `:8080`, backend on
`:4000`, database `medguard_dev` holding **16 assets / 5 vendors / 10 flows /
8 risks / 5 threats**. Vendors, flows, risks and threats match seeded values;
assets carry 8 additional imported rows (`Telehealth Gateway`,
`Cardiology PACS`, `Oncology Registry`, `Maternity Records`,
`Population Health Warehouse`, `Referral Exchange`, `Genomics Pipeline`,
`Emergency Triage Board`). This is data state, not a code defect, but it means
live figures quoted anywhere in this report are point-in-time.

No application file, dependency, configuration, database row or Git object was
modified. The only file created is this report.
