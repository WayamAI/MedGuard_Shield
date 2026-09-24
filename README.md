# MedGuard — by Wayam AI

A healthcare governance and compliance dashboard built for Meridian
Health: real time PHI monitoring, access and identity management, threat
detection, policy and compliance tracking, AI governance oversight, audit
trails, and a risk register, all in one console.

This is the frontend. It talks to the MedGuard backend API over HTTP —
authentication and six screens read live data; the remaining screens are
still driven by the mock dataset while their endpoints are built. See
[Data sources](#data-sources) for exactly which is which.

## Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) component primitives
- [React Router](https://reactrouter.com/) for routing and route protection
- [TanStack Query](https://tanstack.com/query) for all backend reads, behind the shared `useApiQuery` hook
- [Recharts](https://recharts.org/) for charts, [Sonner](https://sonner.emilkowal.ski/) for toasts
- [Vitest](https://vitest.dev/) + Testing Library for tests

## Running locally

```bash
npm install
cp .env.example .env.local   # then point VITE_API_BASE_URL at the backend
npm run dev
```

`VITE_API_BASE_URL` **is required**. There is no mock fallback on the
API-backed pages: with it unset, `getApiBaseUrl()` in
`src/lib/apiClient.ts` throws and those pages render their error state.
The backend listens on **port 4000**, which is what `.env.example` ships.

The dev server is pinned to port 8080 in `vite.config.ts`, and Vite falls
back to the next free port if 8080 is already taken — check the URL it
prints.

> **Note:** if your checkout path contains a space (e.g. a folder named
> `Wayam AI`), use `npm` rather than `bun` — `bun install`/`bun run` hit an
> internal bun bug (`CouldntReadCurrentDirectory`) triggered by the space,
> even though a `bun.lockb` is present in the repo.

Other scripts: `npm run build`, `npm run lint`, `npm run test`, `npm run preview`.

## Deploying

Hosted on **Vercel** (static build) against the API on **Render** and Postgres
on **Supabase** — all three on free tiers. `vercel.json` holds the whole
frontend side of that; the backend's `DEPLOYMENT.md` holds the rest.

`VITE_API_BASE_URL` is a **build-time** variable. Vite inlines
`import.meta.env` into the bundle, so it must be set as a Vercel *project
environment variable* (Production and Preview both) and a change to it needs a
redeploy — setting it at runtime does nothing. This is a property of Vite, not
a choice made here.

```bash
vercel link
vercel env add VITE_API_BASE_URL production   # https://<service>.onrender.com
vercel env add VITE_API_BASE_URL preview
vercel --prod
```

Three things `vercel.json` is doing that are easy to undo by accident:

- **`installCommand` is pinned to `npm ci`.** A `bun.lockb` sits beside
  `package-lock.json` in this repo, and left to auto-detect Vercel may pick
  bun — see the note above about bun and spaces in paths. The pin removes the
  ambiguity.
- **The catch-all rewrite to `/index.html`** is the SPA fallback, replacing
  what `nginx.conf` does in the Docker image. It is safe for assets because
  Vercel matches the filesystem *before* applying rewrites.
- **The cache header targets `/static/`, not `/assets/`.** `vite.config.ts`
  sets `assetsDir: "static"` deliberately, because the app has a route at
  `/assets` that Vite's default output directory would shadow. Don't "fix"
  either one.

The security headers (`nosniff`, `DENY`, `strict-origin-when-cross-origin`) are
ported from `nginx.conf` so the Vercel deploy and the container image behave
the same way.

**CORS:** the API allowlists exact origins from `FRONTEND_ORIGIN` and never a
wildcard, so the Render service needs the Vercel production origin set on it
(scheme + host, no trailing slash) before login will work. Preview deployments
get a hashed hostname and will *not* match unless listed by hand.

**First load may be slow.** The Render free tier suspends the API after ~15
minutes of no traffic, and the next request waits 30-60s for it to wake.

## Data sources

| Screen | Source |
| --- | --- |
| PHI Flow | `GET /api/dataflows` via `useDataFlows` |
| Risk Register | `GET /api/risks` via `useRisks` / `useRawRisks` |
| Vendor Risk | `GET /api/vendors` via `useVendors` |
| Access | `GET /api/access` via `useAccess` |
| Threats | `GET /api/threats` via `useThreats` |
| Dashboard | **Mixed** — the four KPI cards aggregate `useAssets` + `useRisks` + `useDataFlows`; the frameworks strip, department bar chart and activity feed are still `src/data/mock.ts` |
| Policy, Audit, AI Governance | `src/data/mock.ts` — no endpoints for these yet |

Every API-backed hook goes through `useApiQuery` (`src/hooks/useApiQuery.ts`),
which adds a polling heartbeat, a tighter retry cadence while the backend
is down, and an `isReconnecting` state so a view keeps its last good data
behind a notice instead of blanking out.

## Signing in

`src/hooks/use-auth.tsx` authenticates against the backend:
`POST /api/auth/login` returns a bearer token, and the hook registers that
token with `setAuthTokenGetter()` so every subsequent request carries it.
Credentials are real — the backend decides who gets in.

The token is held **in memory only**, in a ref inside `AuthProvider`. It is
never written to `localStorage` or `sessionStorage`, so an XSS payload that
can read browser storage finds nothing. The cost is that a reload ends the
session: the API exposes `/login`, `/logout` and `/me` but no refresh-token
endpoint, so rather than fake a restore, a reload lands on a clean
logged-out state and `ProtectedRoute` redirects to `/login`. A breadcrumb
flag (`src/lib/sessionBreadcrumb.ts`) lets the login page say the session
ended rather than showing a bare form. No token is ever in that flag.

Logging out clears the token first and then calls `/api/auth/logout`, so
the session ends locally even if the API is unreachable.

## Wayam AI rebrand

This app was rebranded from its original "Joules to Watts" styling to
Wayam AI:

- The sidebar and login page use the Wayam wordmark (light or dark
  variant, chosen automatically by the active theme) and the Wayam
  favicon.
- The primary brand color is Wayam's signature orange, defined once as
  CSS custom properties in `src/index.css` (`--primary`, `--primary-hover`,
  `--ring`, `--sidebar-active`) and consumed everywhere through Tailwind
  tokens (`tailwind.config.ts`) rather than hardcoded hex values, so
  buttons, links, active nav state, focus rings, and form controls all
  stay in sync.
- Severity/status colors (red for critical, amber for warning, green for
  success/passing, blue for informational badges) are left as
  conventional semantic colors rather than orange, so a critical alert
  still reads as urgent rather than as a primary action.

## Project structure

```
src/
  pages/         One file per route (Dashboard, PhiFlow, Access, Threats,
                 Policy, AI, Audit, Risks, Vendors, Login, NotFound)
  components/    Layout (sidebar + topbar), ProtectedRoute, DataState,
                 PhiSankey, RiskMatrix, ui-bits.tsx (Card/Btn/Badge/Modal/
                 etc.), components/ui/* (shadcn primitives)
  hooks/         use-auth (bearer-token session), useApiQuery (shared query
                 behaviour) and the per-endpoint hooks built on it
                 (useAssets, useRisks, useDataFlows, useVendors, useAccess,
                 useThreats), use-theme, use-mobile
  lib/           apiClient (fetch wrapper + ApiError), apiTypes (wire
                 shapes), mappers (wire -> chart props), tone, icons
  store/         AppStore — in-memory state for alerts, approvals,
                 notifications
  data/          mock.ts — the dataset still backing the unwired screens
  test/          Vitest suites; live-backend.test.tsx needs a running API
```

## Testing

```bash
npx vitest run --exclude "**/live-backend.test.tsx"   # what CI runs
npx vitest run src/test/live-backend.test.tsx          # needs a live backend
```

`live-backend.test.tsx` **skips itself when the API is unreachable** rather
than failing, so it reports green on a frontend-only machine without having
asserted anything. Check its output for `[skip]` lines before treating it
as coverage. CI excludes it outright.

## Known limitations

- **Read-only**: there are no write endpoints yet beyond auth. Actions like
  "resolve alert", "flag for retraining" or "generate export" update local
  state and show a toast; nothing persists server-side.
- **Policy, Audit and AI Governance are still mock-backed**, and the
  Dashboard's frameworks strip, department chart and activity feed are too.
  The activity feed cycles a fixed sample array on a timer.
- **The Dashboard health-period chips (7d/30d/90d) are inert** — see the
  TODO in `src/pages/Dashboard.tsx`; the underlying score is a
  point-in-time value with no time-range query behind it.
- **Lint carries a backlog** of ~15 errors, mostly `@typescript-eslint/no-explicit-any`
  in the mock-backed pages. CI reports them but does not gate on them.
- **A reload signs you out**, by design — see [Signing in](#signing-in).
- **Main bundle is still ~344 KB gzip 108 KB** even after route-level
  code splitting, mostly React/Router/Query/shadcn. Recharts (the
  largest single dependency, ~365 KB) is already isolated into its own
  chunk that only loads on chart-heavy pages. Further reduction would
  mean swapping dependencies, which was out of scope here.
