# MedGuard — by Wayam AI

A healthcare governance and compliance dashboard demo built for Meridian
Health: real time PHI monitoring, access and identity management, threat
detection, policy and compliance tracking, AI governance oversight, audit
trails, and a risk register, all in one console.

This is a frontend only demo. There is no backend or database — every
screen is driven by realistic mock data and an in-memory app store, and
authentication is a demo layer (see below) rather than a real identity
provider.

## Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) component primitives
- [React Router](https://reactrouter.com/) for routing and route protection
- [TanStack Query](https://tanstack.com/query) (provider is wired in; pages currently read from local mock data)
- [Recharts](https://recharts.org/) for charts, [Sonner](https://sonner.emilkowal.ski/) for toasts
- [Vitest](https://vitest.dev/) + Testing Library for tests

## Running locally

```bash
npm install
npm run dev
```

The dev server prints its local URL (Vite falls back to the next free
port if 8080 is taken). No environment variables are required — see
`.env.example` for details.

> **Note:** if your checkout path contains a space (e.g. a folder named
> `Wayam AI`), use `npm` rather than `bun` — `bun install`/`bun run` hit an
> internal bun bug (`CouldntReadCurrentDirectory`) triggered by the space,
> even though a `bun.lockb` is present in the repo.

Other scripts: `npm run build`, `npm run lint`, `npm run test`, `npm run preview`.

## Signing in (demo authentication)

There is no real backend, so `src/hooks/use-auth.tsx` implements a demo
auth layer: **any syntactically valid email plus any non-empty password**
signs you in — for example `demo@example.com` / `anything works`. The
display name in the sidebar is derived from the email's local part.

The session is stored in `localStorage` and survives a page refresh.
Logging out (via the button in the sidebar's user footer) clears it
completely; protected routes then redirect back to `/login`, including
if you try the browser back button afterward, since route protection
checks live auth state on every render rather than a cached flag.

The auth layer is intentionally isolated behind `useAuth()` so swapping
in a real identity provider later only means rewriting the inside of
`login`/`logout` — no consuming component needs to change.

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
                 Policy, AI, Audit, Risks, Login, NotFound)
  components/    Layout (sidebar + topbar), ProtectedRoute, ui-bits.tsx
                 (Card/Btn/Badge/Modal/etc.), components/ui/* (shadcn primitives)
  hooks/         use-auth (demo auth), use-theme (light/dark), use-mobile
  store/         AppStore — in-memory state for alerts, approvals,
                 notifications, suspended users
  data/          mock.ts — the demo dataset
```

## Known limitations

- **Old asset files left on disk**: `public/J2W_Logo 1.png`,
  `src/assets/j2w-logo.png`, and `src/assets/joules-watts-logo.png` are
  no longer referenced anywhere in the app, but this working session's
  permissions didn't allow deleting files, so they remain on disk unused.
  Safe to `git rm` them in a follow-up commit.
- **`lovable-tagger` dev dependency**: still listed in `package.json` and
  wired into `vite.config.ts` (dev mode only — it injects invisible
  `data-*` attributes for the Lovable editor and never renders anything
  visible). Not removed since dropping a dependency wasn't in scope for
  this pass; safe to remove if this project no longer needs Lovable's
  visual editor.
- **Nested modal grids**: a handful of 2/3 column grids inside modals
  (e.g. the add risk/add user forms) weren't given mobile breakpoints —
  the modals scroll internally, so they're usable but not optimized for
  narrow screens the way the main page layouts are.
- **No real backend**: everything is mock data in `src/data/mock.ts` plus
  client-side state in `src/store/AppStore.tsx`. Actions like "resolve
  alert" or "suspend user" update local state and show a toast, but
  nothing persists server-side or across a hard refresh.
