# Drishti — icon design brief

A generation brief for the Drishti icon set. Written to be handed to a
generative design tool (Google Flow, Figma AI, or a human illustrator) and
produce a set that reads as **one family**, not eleven unrelated drawings.

**Product:** Drishti — Healthcare PHI Risk Intelligence Platform
**दृष्टि** = vision / sight / insight. The product's job is *visibility*: where
protected health information lives, how it moves, who can reach it, and where
risk concentrates.

---

## How to use this document

1. Read **§1 Construction rules** first. They are non-negotiable and they are
   what makes the set coherent. Apply them to every icon without exception.
2. Generate **Tier 1** (§4) — the ten domain marks. These carry brand meaning
   and are the highest value.
3. Generate **Tier 2** (§5) — the eight navigation marks. See §3: these are
   currently *inconsistent with Tier 1* and fixing that is the single biggest
   coherence win available.
4. **Do not regenerate Tier 3** (§6). Reasons given there.
5. Check every output against **§7 Acceptance checklist** before accepting it.
6. §8 has a ready-to-paste prompt template.

---

## 1. Construction rules — apply to every icon

These exist so that any two icons in the set, placed side by side at any size,
look like they were drawn by the same hand on the same day.

### Grid and geometry

| Rule | Value |
|---|---|
| Artboard | **24 × 24** px |
| Live area | **20 × 20** centred — all artwork inside this |
| Outer padding | **2 px** on all sides, always clear |
| Alignment | Snap every point to the **0.5 px** grid |
| Angles | **0°, 45°, 90° only.** No arbitrary diagonals |
| Symmetry | Prefer vertical symmetry. Break it only for directional meaning |

### Keyline shapes

Anchor each icon to one of these so the set shares optical mass:

| Keyline | Size | Use for |
|---|---|---|
| Circle | ⌀ 20 | round subjects — identity, status |
| Square | 18 × 18 | solid/structural subjects — control, audit |
| Portrait rect | 16 w × 20 h | tall subjects — shield, document |
| Landscape rect | 20 w × 16 h | wide subjects — flow, table, building |

A circle must be ⌀20 to look the same weight as an 18×18 square. Do not make
them the same number.

### Stroke

| Rule | Value |
|---|---|
| Weight | **1.5 px**, uniform. Never tapered, never variable |
| Caps | **Round** |
| Joins | **Round** |
| Fill | **None.** Outline only, everywhere |
| Colour | **`currentColor`** only — a single colour per icon |
| Corner radius | **2 px** outer, **1 px** inner |
| Minimum gap between strokes | **2 px** |

That last rule matters most. These render at **16 px** in tables and search
results. Any two strokes closer than 2 px will merge into a grey smudge at
that size. Test every icon at 16 px before accepting it.

### Density

- **3–6 drawn elements** per icon. Under three reads as unfinished; over six
  turns to mush at 16 px.
- No detail smaller than **2 px**.
- No text, no numerals, no letterforms.

### Colour

Icons are **monochrome by construction**. They inherit colour from the
surrounding UI — the same mark appears in tertiary grey in a table, brand
orange in a page header, and semantic red inside a critical-risk badge.

Never bake a colour in. Never produce a two-tone or gradient version. If the
mark only works in orange, it is the wrong mark.

Reference brand colours (for *previewing* only, never embedded):

| Token | Value |
|---|---|
| Brand orange | `#F97316` |
| Deeper orange | `#EA580C` |
| Warm highlight | `#FB923C` |
| Neutral dark | `#0B0D0F` |
| Light surface | `#F7F7F5` |

### Output format

- **SVG**, `viewBox="0 0 24 24"`
- `fill="none"`, `stroke="currentColor"`, `stroke-width="1.5"`,
  `stroke-linecap="round"`, `stroke-linejoin="round"`
- Attributes on the root `<svg>`, not repeated per path
- **No** `<style>`, no CSS classes, no `id`s, no `clipPath`, no masks, no
  embedded raster, no `<text>`
- Paths only. Prefer `<path>`; `<circle>`/`<rect>`/`<ellipse>` acceptable
- Flatten transforms — no `transform` attributes in the output
- One file per icon, named `<icon-name>.svg` in kebab-case

---

## 2. What "in sync" means here

The set must hold together on five axes. Check all five.

1. **Optical weight.** Squint at the sheet. No icon should be noticeably
   darker or lighter than its neighbours. A 6-stroke icon next to a 2-stroke
   icon breaks the row.
2. **Visual vocabulary.** A shape means one thing across the set. If a
   *cylinder* means "stored data" in one icon, nothing else may use a cylinder
   for anything else.
3. **Perspective.** Everything is **flat, front-on, orthographic**. No
   isometric, no perspective, no 3D, no shadow.
4. **Corner language.** The same 2 px outer radius everywhere. One sharp
   corner in a set of round ones is instantly visible.
5. **Distinctness.** Any two icons must be tellable apart **at 16 px, in
   monochrome, out of context**. See §4 for the specific pairs that currently
   fail this.

---

## 3. ⚠ Known coherence defects to fix

**Read this before generating anything.** The current implementation has real
inconsistencies. A new icon set is the moment to fix them.

### 3.1 Risk and Threat are swapped

The sidebar and the content area use opposite glyphs for the same two
concepts:

| Concept | Sidebar (`src/lib/icons.ts`) | Content area (`DomainIcon.tsx`) |
|---|---|---|
| **Risk** | Shield | warning triangle |
| **Threat** | warning triangle | Shield |

One concept must resolve to one glyph everywhere. **Resolution:** the new set
should make Risk = *graded exposure* (triangle/gauge language) and Threat =
*active hostile event* (alert/anomaly language). Neither should be a plain
shield — shield belongs to Control (§4.8).

### 3.2 The Threat icon currently reads as "safe"

`DomainIcon.threat` is a shield containing a **checkmark**. A checkmark means
verified, passed, safe — the opposite of a detected threat. This is a semantic
bug, not a style preference. The new Threat mark must read as *alarm*.

### 3.3 PHI and Threat are both shields

Two shields in a ten-icon set, distinguished only by their interior mark, are
not distinguishable at 16 px. **Only one icon in the set may use a shield
silhouette.** Assign it to Control; give PHI and Threat different outer forms.

### 3.4 Sidebar uses generic Lucide glyphs while content uses custom marks

The sidebar draws Assets with Lucide `Database`, Vendors with `Building2`,
Access with `Users`. The tables beneath draw the same concepts with the custom
domain marks. Similar, but not identical — which reads as sloppiness rather
than as a system.

**Resolution:** Tier 2 (§5) generates domain marks for all eight nav slots, so
the sidebar and the content area use the same artwork.

---

## 4. Tier 1 — the ten domain marks (highest priority)

These are the **nouns of the Drishti risk model**:

```
Asset → PHI → Identity / Access → Vendor → Control → Risk
                                       ↘ Threat ↗
        Data Flow ─ Remediation ─ Audit
```

Each appears at **16 px** (table rows, search results), **18–20 px** (page
headers, drawers), and **22 px** (entity avatars in tinted wells).

---

### 4.1 `asset`

**Means:** a monitored system, service or data store. An EHR, a database, an
S3 bucket, an API. The thing PHI lives *in*.

**Where:** asset table rows, asset detail drawer, dashboard Action Centre,
sidebar "Assets", global search results.

**Today:** stacked cylinder (three ellipse bands) — a database drum.

**Direction:** keep the stacked-store idea; it is immediately legible and
correct. Refine the ellipse curvature so the top ellipse doesn't optically
flatten at 16 px. Consider **two** bands rather than three — three bands at
16 px is where the 2 px gap rule gets tight.

- **Must** read as *stored data at rest*, front-on, vertically symmetric
- **Must not** look like a coin stack, a barrel, or a hamburger menu
- **Must not** be confusable with `vendor` (§4.4) — keep them different
  silhouettes entirely, one round-topped, one flat-roofed
- **Keyline:** portrait rect 16 × 20

---

### 4.2 `phi`

**Means:** protected health information itself. The regulated patient data —
not the system holding it, not the risk attached to it. The most sensitive
concept in the product.

**Where:** asset detail PHI tab, PHI flow node drawer, PHI-type listings.

**Today:** a shield containing a medical cross. **Conflicts with §3.3.**

**Direction:** drop the shield. PHI is the *subject being protected*, not the
protection. Better directions, in preference order:

1. A **document/record card** with a subtle medical cross or heartbeat line
2. A **rounded rectangle card** with a small lock-free privacy mark
3. A **person silhouette inside a record outline**

The medical cross should be a **plus with equal arms**, not a Red Cross
emblem, and must not dominate.

- **Must** read as *sensitive personal health record*
- **Must not** use a shield (reserved for `control`)
- **Must not** be confusable with `audit` (§4.10), which is also document-led
  — differentiate by making `phi` **portrait card with a cross**, and `audit`
  **a page with ruled text lines**
- **Keyline:** portrait rect 16 × 20

---

### 4.3 `dataFlow`

**Means:** PHI moving between two systems. A directional, measurable transfer.

**Where:** PHI Flow page header, dashboard Action Centre, flow listings.

**Today:** two offset rounded rects joined by an elbow connector with an
arrowhead.

**Direction:** strong concept; refine execution. The connector should read as
a deliberate **routed path** — one 90° elbow, not a curve, not a straight
diagonal. Arrowhead only at the destination end.

- **Must** show **exactly two** nodes and **one** directional connector
- **Must** have the arrowhead clearly at one end — direction is the meaning
- **Must not** become a generic "share" or "shuffle" icon
- **Must not** use three or more nodes (mush at 16 px)
- **Keyline:** landscape rect 20 × 16

---

### 4.4 `vendor`

**Means:** a third-party organisation with access to PHI. External to the
hospital. Carries a BAA obligation.

**Where:** vendor table rows, vendor drawer, dashboard, sidebar "Vendors".

**Today:** a simple building — roofline over a body with a doorway.

**Direction:** keep the building. Push it toward *external organisation*
rather than *hospital*: a flat-roofed block, not a pitched-roof house, not a
hospital with a cross on it (that would collide with `phi`).

- **Must** read as *another company*, flat-roofed, front-on
- **Must not** carry a medical cross — a vendor is not a clinic
- **Must not** be confusable with `asset` (§4.1)
- **Keyline:** landscape rect 20 × 16

---

### 4.5 `identity`

**Means:** a person or service account that holds access. Both a named
clinician and `svc-analytics-etl`.

**Where:** access grant rows, identity detail, dashboard, sidebar "Access &
Identity", search results.

**Today:** a circle head over a shoulder arc.

**Direction:** the classic person mark is correct and should stay — it is the
one place where convention beats invention. Refine proportion: head ⌀ ~6.5 px,
shoulders spanning ~14 px, with a clear 2 px gap between head and shoulder.

- **Must** be a single person, not a group (a group means "team", not
  "identity")
- **Must** survive at 16 px with the head/shoulder gap intact
- **Must not** be a filled avatar circle
- **Keyline:** circle ⌀ 20

---

### 4.6 `threat`

**Means:** a detected hostile or anomalous event. Bulk PHI export, a login
from a Tor exit node, privilege escalation. **Active, adversarial, live.**

**Where:** threat table rows, threat drawer, dashboard Action Centre, sidebar
"Threats", search results.

**Today:** a shield with a checkmark. **Semantically wrong — see §3.2.**

**Direction:** this must read as **alarm**, not protection. Directions:

1. A **radar/sonar sweep** with a contact blip — ties beautifully to
   *दृष्टि / sight*, and is distinct from everything else in the set
2. A **pulse/anomaly line** with one sharp spike breaking a flat baseline
3. A **siren/alert beacon**

**Recommended: the radar sweep.** It is on-brand (detection through
visibility), it is unlike any other mark in the set, and it does not reuse the
triangle that `risk` needs.

- **Must** read as *something has been detected*
- **Must not** use a shield, a checkmark, or a padlock
- **Must not** use a warning triangle — reserved for `risk`
- **Keyline:** circle ⌀ 20

---

### 4.7 `risk`

**Means:** scored, graded exposure. A calculated band (Low → Extreme) derived
from likelihood, impact, exposure and control gap. **Analytical, not an
event.**

**Where:** risk register rows, risk matrix, risk drawer, dashboard, sidebar
"Risk Register".

**Today:** a warning triangle with an exclamation.

**Direction:** the triangle is right for *graded severity* and should be kept
as the risk language — but lift it above a generic warning sign. Options:

1. Triangle with an internal **level/fill indication** suggesting a band
2. Triangle whose interior carries a **small ascending step** motif
3. A **gauge arc with a needle** — reads as "scored", very on-concept

Option 1 or 3 is preferred; a bare warning triangle is the most generic icon
in existence and the risk register is the product's analytical centrepiece.

- **Must** read as *measured severity*, not *something just happened*
- **Must not** be a plain unadorned warning triangle
- **Must not** use radar/pulse language — reserved for `threat`
- **Keyline:** landscape rect 20 × 16, or circle ⌀ 20 if gauge

---

### 4.8 `control`

**Means:** a safeguard in place. Encryption at rest, MFA enforcement, access
log retention. The thing that *reduces* risk.

**Where:** control listings (pending backend), asset protection indicators.

**Today:** a closed padlock.

**Direction:** **this is the one icon that may use a shield**, per §3.3.
Either a padlock or a shield — pick one and commit. A shield reads more
"governance programme", a padlock more "technical control". Given Drishti's
controls are largely technical, **the padlock is the better fit** — and it
leaves shield unused, which is fine. An unused convention is better than a
reused one.

- **Must** read as *protection actively in place*
- **Must** be closed/engaged, never an open shackle
- **Must not** be confusable with `phi` — `phi` is the data, `control` is the
  guard on it
- **Keyline:** portrait rect 16 × 20

---

### 4.9 `remediation`

**Means:** corrective work on a finding. Assigned, in progress, resolved. The
*action* taken about a risk.

**Where:** remediation queue (pending backend), Action Centre items.

**Today:** a wrench crossed with a repair motif.

**Direction:** a single clean **wrench** at 45°, or a **wrench + small check**
if "resolved" needs expressing. Keep it to one tool — crossed tools (wrench +
screwdriver) are too dense at 16 px.

- **Must** read as *fixing something*
- **Must not** be a gear/cog — that means *settings* and is already spoken for
- **Must not** be a hammer (reads as construction, not repair)
- **Keyline:** square 18 × 18

---

### 4.10 `audit`

**Means:** the immutable event record. Who did what, to what, when, and with
what result.

**Where:** audit trail (pending backend), activity feeds, history tabs.

**Today:** a page with a folded corner and two ruled text lines.

**Direction:** keep the document. Differentiate from `phi` (§4.2) by making
this one unmistakably a **log**: ruled lines of differing length, suggesting
entries. The folded corner is a nice touch — keep it, it adds identity.

- **Must** read as *a written record of events*
- **Must** have 2–3 ruled lines of **differing** lengths
- **Must not** carry a medical cross
- **Must not** be confusable with `phi` — different interior entirely
- **Keyline:** portrait rect 16 × 20

---

## 5. Tier 2 — the eight navigation marks

Currently generic Lucide glyphs (§3.4). Generating domain versions makes the
sidebar and the content area one system.

| Slot | Current Lucide | Action |
|---|---|---|
| Dashboard | `LayoutGrid` | **New mark needed** — see below |
| Assets | `Database` | **Reuse Tier 1 `asset`** |
| PHI Flow | `GitBranch` | **Reuse Tier 1 `dataFlow`** |
| Access & Identity | `Users` | **Reuse Tier 1 `identity`** |
| Vendors | `Building2` | **Reuse Tier 1 `vendor`** |
| Threats | `AlertTriangle` | **Reuse Tier 1 `threat`** |
| Risk Register | `Shield` | **Reuse Tier 1 `risk`** |
| Data Import | `Upload` | **New mark needed** — see below |

Only two new marks are actually required:

### 5.1 `dashboard`

**Means:** the executive overview. Everything at a glance.

**Direction:** a 2×2 panel arrangement with **unequal** cells — one wide, one
tall — reading as a composed layout rather than a plain four-square grid.

- **Must not** be four identical squares (that is every dashboard icon ever)
- **Keyline:** square 18 × 18

### 5.2 `import`

**Means:** bulk-loading records from CSV. The onboarding path.

**Direction:** a **document with an upward arrow entering it**, or a tray
receiving an arrow. Emphasise *records arriving in bulk*, not a generic
cloud-upload.

- **Must** imply structured records, not arbitrary files
- **Must not** be a cloud (nothing else in Drishti uses cloud language)
- **Keyline:** portrait rect 16 × 20

---

## 6. Tier 3 — do not regenerate

The interface icons stay **Lucide**, unchanged: chevrons, arrows, search,
close, check, plus, minus, pencil, trash, filter, refresh, download, upload,
bell, settings, sun, moon, eye, eye-off, clock, calendar, loader, external
link, more-horizontal, grip, log-out.

**Why:** these are *interface verbs*, not brand nouns. Users read them by
convention, and a bespoke chevron is a bespoke chevron — all cost, no value.
Lucide is already drawn at a compatible 24×24 / round-cap system, so a custom
domain set sits beside it without friction, provided §1 is followed.

**The one thing to check:** Lucide ships at stroke-width 2; Drishti renders it
at **1.5** (`ICON_STROKE_WIDTH` in `src/components/AppIcon.tsx`). New custom
icons must be drawn at 1.5 to match what is actually on screen, **not** at
Lucide's default.

---

## 7. Acceptance checklist

Run every generated icon through this. An icon failing any line is not done.

**Per icon**

- [ ] 24×24 viewBox, all artwork inside the central 20×20
- [ ] Stroke exactly 1.5, uniform, round caps and joins
- [ ] `fill="none"`, single `currentColor`, no baked colour
- [ ] No stroke pair closer than 2 px
- [ ] Legible and unambiguous at **16 px**
- [ ] 3–6 elements, nothing finer than 2 px
- [ ] Only 0/45/90° angles
- [ ] No text, no gradient, no shadow, no fill, no 3D
- [ ] Clean SVG: no `<style>`, ids, classes, clipPaths, masks or transforms

**Per set**

- [ ] All eleven-plus icons on one sheet at 16 px — none reads heavier or
      lighter than the rest when squinting
- [ ] No two icons confusable in monochrome out of context, specifically:
      `asset`/`vendor`, `phi`/`audit`, `threat`/`risk`, `phi`/`control`
- [ ] Exactly one shield silhouette in the set (or zero)
- [ ] One concept = one glyph across sidebar and content
- [ ] Same corner radius language throughout
- [ ] Legible in both light (`#0B0D0F` on `#F7F7F5`) and dark
      (`#F7F7F5` on `#0B0D0F`)
- [ ] Legible in brand orange `#F97316` on both surfaces

---

## 8. Prompt template

Paste this as the system/style preamble, then append one icon brief from §4–5.

```
Design a single flat line-art icon for Drishti, an enterprise healthcare
PHI risk-intelligence platform. Premium, restrained, technical — the
visual register of a serious security product, not a consumer app.

STRICT CONSTRUCTION:
- 24x24 px artboard; all artwork inside the central 20x20; 2px padding clear
- Uniform 1.5px stroke, round caps, round joins
- Outline only — NO fills, NO gradients, NO shadows, NO 3D, NO perspective
- Single colour (monochrome); the icon inherits colour from the UI
- Flat, front-on, orthographic
- Angles limited to 0, 45 and 90 degrees
- 2px outer corner radius, 1px inner
- Minimum 2px gap between any two strokes
- 3 to 6 elements maximum; no detail under 2px
- MUST remain legible and unambiguous at 16px
- NO text, letters or numbers

OUTPUT: clean SVG, viewBox="0 0 24 24", fill="none",
stroke="currentColor", stroke-width="1.5", stroke-linecap="round",
stroke-linejoin="round". Paths only. No <style>, ids, classes, clipPaths,
masks or transforms.

ICON TO DRAW:
<paste the "Means" / "Direction" / "Must" / "Must not" block from §4 or §5>
```

### Worked example — `threat`

```
ICON TO DRAW: "threat"

MEANS: a detected hostile or anomalous security event — bulk PHI export,
a login from a Tor exit node, privilege escalation. Active, adversarial,
live. Something has been spotted.

DIRECTION: a radar/sonar sweep — a circular scope with one sweep arm and a
single contact blip off-centre. This ties to the product name (Drishti =
sight/vision) and reads as active detection.

MUST: read as "something has been detected"; be built on a circle keyline
of diameter 20; keep the blip clearly separate from the sweep arm by at
least 2px.

MUST NOT: use a shield, a checkmark, a padlock, or a warning triangle.
The warning triangle is reserved for a different icon in this set. A
checkmark would read as "safe", which is the opposite of the meaning.
```

---

## 9. Where these land in the codebase

For whoever integrates the returned SVGs:

| Tier | File | Notes |
|---|---|---|
| 1 + 2 | `src/components/DomainIcon.tsx` | Paths go in the `PATHS` record, keyed by name. Root `<svg>` attributes are already set by the component — paste **path elements only**, not whole SVG documents |
| 3 | `src/lib/icons.ts` | Unchanged; stays Lucide |

After adding Tier 2, update `NAV` in `src/components/Layout.tsx` to use
`DomainIcon` rather than `AppIcon`, which is what closes the §3.4 gap.

Current type union to extend:

```ts
export type DomainIconName =
  | "asset" | "phi" | "dataFlow" | "risk" | "vendor"
  | "identity" | "threat" | "control" | "remediation" | "audit";
  // Tier 2 adds: | "dashboard" | "import"
```
