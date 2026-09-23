# Drishti — Demo Operations

How to bring the demo up, verify it, run it, and return it to a known state
afterwards.

Allow **five minutes** for a cold start, or **one minute** if the machine has
run the demo before. Do the reset and the verification *before* the customer
joins, never during.

- **Database** — local PostgreSQL 14, database `medguard_dev`
- **Backend** — `medguard-backend`, port **4000**
- **Frontend** — `medguard-shield-main`, port **8080** (not negotiable — the
  API's permitted browser origin is set to it)

> First run on a new machine? Do the dependency install in
> `medguard-backend/DEMO_RUNBOOK.md` → *Step 0* first. It is easy to skip and
> it fails confusingly.

---

## 1 — Start the database

```bash
brew services start postgresql@14      # macOS
pg_isready                             # expect: accepting connections
```

## 2 — Start the backend

```bash
cd "<repo root>/medguard-backend"
npm run dev
```

Wait for:

```
[drishti] API listening on http://localhost:4000
[drishti] CORS origin: http://localhost:8080
```

If the port is already taken, an older detached server is still running. Find
and stop it rather than starting a second:

```bash
lsof -nP -iTCP:4000 -sTCP:LISTEN
```

## 3 — Start the frontend

```bash
cd "<repo root>/medguard-shield-main"
npm run build && npm run preview -- --port 8080
```

`preview` serves the production build, which is what a customer should see.
`npm run dev` also works and is fine for rehearsal.

## 4 — Prepare the demo database

**Before every customer demonstration**, return the demo organisation to its
seeded state:

```bash
cd "<repo root>/medguard-backend"
npm run db:demo:reset
```

This removes the demo organisation's records and re-seeds them, so every
demonstration starts from the same dataset — the figures in
`DRISHTI_CUSTOMER_DEMO_SCRIPT.md` will match what is on screen.

See §8 for exactly what it touches and why it is safe.

> **Rehearsing rather than demonstrating?** `npm run db:seed:demo` is
> additive: it seeds without deleting, so anything you added during a
> rehearsal survives. Use the reset when you want the script's numbers back.

## 5 — Log in

Open **http://localhost:8080**

| Account | Role | Use |
|---|---|---|
| `admin@drishti-demo.invalid` | Admin | **Run the demo with this one** |
| `analyst@drishti-demo.invalid` | Analyst | To show the role boundary |
| `viewer@drishti-demo.invalid` | Viewer | To show read-only access |

The password is `DEMO_USER_PASSWORD` from the backend `.env`. **Do not put it
on a slide, in a shared document, or on screen.** Type it before screen
sharing starts, or share a single window rather than the desktop.

## 6 — Verify the dashboard

The Governance Overview should show, for *Drishti Demo Healthcare*:

| Reads | Value |
|---|---|
| Assets monitored | **12** · 13 PHI flows mapped |
| Critical or extreme | **2** — 1 extreme · 1 critical |
| PHI records / day | **208,550** |
| Unencrypted flows | **8** of 13 |
| Third-party vendors | **5** — 3 of 5 without a valid BAA |
| Access grants | **23** — 18 of 23 flagged |
| Open threats | **5** — 3 critical |
| Risk distribution | 1 extreme · 1 critical · 3 high · 4 moderate · 3 low |

If those do not match, the reset in step 4 did not run or did not finish.
Run it again and reload.

**Also check quickly:**

- The browser console is clean (no red).
- **Assets** shows `1–12 of 12`, with `Legacy Records Exchange` at the top,
  score `100`, band `EXTREME`.
- **PHI Flow** draws the map — the thick red ribbon from the legacy exchange
  to the analytics warehouse is the one the script points at.
- **Audit Trail** loads (admin only — this is also how you confirm you are
  signed in as the admin).

## 7 — Run the demo

Follow `DRISHTI_CUSTOMER_DEMO_SCRIPT.md`. Twelve steps, 10–15 minutes.

**Before you share your screen:**

- Close unrelated tabs and windows; the tab title and any bookmarks are visible.
- Set the browser to the theme you intend to present in — both are supported;
  light reads better on a projector, dark on a good screen.
- Full-screen the browser at a desktop width. The interface is verified from
  390px up, but a demo is not the place to show a phone layout unless asked.
- Have the reset command ready in a terminal you are **not** sharing, in case
  a second run is needed.

**During the demo, two actions change data** — step 5 recomputes a risk and
step 10 moves a finding to *In progress*. Both are intentional, both are
audited, and step 4's reset undoes them. Nothing else you do in the script
writes.

## 8 — Reset the demo safely

```bash
cd "<repo root>/medguard-backend"
npm run db:demo:reset
```

**What it does.** Removes the records belonging to the demo organisation
(slug `drishti-demo`) and re-seeds them from `prisma/seed-demo.ts`.

**What it keeps.** The organisation row itself, the three demo accounts and
their memberships. An operator who changed the demo password would be
surprised to find it silently reverted, and keeping the organisation keeps its
id stable.

**Why it is safe to run on a database that also holds other data.** This
script genuinely deletes, so its scoping is enforced rather than intended:

- Every statement carries the organisation, directly or through the parent row
  that owns it. There is no `TRUNCATE`, no `DROP`, no raw SQL and no unscoped
  delete anywhere in it.
- Rows **outside** the demo organisation are counted immediately before and
  after the deletions, **inside the same transaction**. If a single count
  moves, the whole transaction rolls back and nothing is deleted at all. A
  scoping mistake fails loudly and changes nothing, rather than half-destroying
  another tenant.
- It refuses to run under `NODE_ENV=production` unless
  `DEMO_RESET_ALLOW_PRODUCTION=yes` is set explicitly.

**What it does not touch.** Any other organisation's data, including the
`meridian` development organisation on the same database.

> **Do not** use `npm run db:reset`. That is `prisma migrate reset` — it drops
> and rebuilds the entire database, every organisation included. It is a
> development command and has no place in demo operations.

---

## If something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| Login page says *"Checking your session…"* | A refresh attempt was rate limited or the API was briefly unreachable. **Not** an expiry — the app is retrying | Sign in normally; it does not block you |
| Login page says *"Your session ended"* | The session genuinely expired or was revoked | Sign in again |
| Dashboard figures differ from §6 | The demo data was modified, or the reset did not finish | Re-run step 4, reload |
| Lists show *"can't reach the server"* | The backend is not running | Restart step 2 |
| `429 Too many requests` | The rate limiter tripped during rehearsal | Wait for the window to pass (15 minutes) or restart the backend, which clears it |
| Port 4000 or 8080 already in use | A detached server from earlier testing | `lsof -nP -iTCP:<port> -sTCP:LISTEN`, then stop it |
| The flow map looks tiny | The window is narrow | The map scrolls horizontally at full size — widen the window or scroll it |

## After the demo

```bash
npm run db:demo:reset     # leave it clean for the next person
```

Stop the servers if the machine is shared. Nothing else is required — the
demo holds no customer data and no real PHI. Every name, system and record in
the demo organisation is fictional, and the demo accounts use the
non-routable `.invalid` domain deliberately, so no address in the dataset can
receive mail.
