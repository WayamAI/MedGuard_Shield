# Drishti — 3D icon prompts

Copy-paste these into Flow, Midjourney, Ideogram, or any image model. Every
prompt is built for **Drishti** — the dark PHI risk-intelligence console for
Meridian Health — not generic healthcare clipart.

**Product:** Drishti — Healthcare PHI Risk Intelligence Platform
**दृष्टि** = vision / sight / insight. The product's job is *visibility*: where
protected health information lives, how it moves, who can reach it, and where
risk concentrates. Every mark below should feel like something **seen**, not
something decorated.

Use them on page headers, empty states, KPI tiles, the login backdrop, and the
404. Do **not** put readable text, patient names, MRNs, claim IDs, real payer
or EHR logos, or any PHI in the render.

---

## 0. Read this first — what 3D can and cannot replace

This repo has already tried raster icons once and reversed the decision. The
reasons are recorded in `src/components/DomainIcon.tsx`:

> Traced from the commissioned artwork in `design/icons-source/`, which arrived
> as 2K JPEGs. Raster could not ship: icons render at 16–24px and must inherit
> `currentColor` so the same mark reads as tertiary grey in a table, brand
> orange in a page header, and semantic red inside a critical badge. A JPEG is
> one fixed colour on an opaque background, and ~500 KB against roughly 400
> bytes here.

Nothing in this brief overturns that. Three constraints still hold:

| Constraint | Why it binds |
|---|---|
| **Size** | `AppIcon` renders at 12–28px (`SIZE_PX` in `src/components/AppIcon.tsx`). A 3D render is mud below ~40px. |
| **Colour inheritance** | `src/lib/icons.ts` rule 1: line art, `currentColor`, one colour per icon. A baked-orange PNG cannot turn red inside a critical badge. |
| **Weight** | ~400 bytes of SVG path vs ~200–500 KB per PNG. A hundred of those is a different product. |

So the split is:

- **The line-art system stays.** `AppIcon` (Lucide) and `DomainIcon` (the twelve
  traced marks) keep every inline, table, badge, button, and sidebar slot.
- **3D marks are for large surfaces only** — the places currently showing a
  lonely 20–24px glyph in a lot of empty space.

### Surfaces that can take a 3D mark

| Surface | Component | Renders today | Needs | Verdict |
|---|---|---|---|---|
| Empty state | `EmptyState`, `src/components/ui-bits.tsx:359` | `size="2xl"` = 24px | **96–120px** | **Best target.** Biggest canvas, lowest risk. |
| Login backdrop | `src/pages/Login.tsx` | nothing — flat `bg-background` | full-bleed | **Best target.** Pure decoration, no semantics. |
| 404 | `src/pages/NotFound.tsx` | nothing | 120px | Good target. |
| Page header | `PageHeader`, `src/components/ui-patterns.tsx:144` | `DomainIcon size={20}` | 40px+ | Only if the header grows. Judge it against the `font-display` title first. |
| KPI tile | `MetricCard`, `src/components/ui-patterns.tsx:174` | `icon` at small size | 40–56px | Optional. Four tiles × 3D art can read as noisy. |
| Table cell / badge / sidebar / button | `DataTable`, `Badge`, `SidebarItem`, `Btn` | 12–18px | — | **Never.** Line art only. |

**Prerequisite:** generating art does not change the UI. `EmptyState` hardcodes
`size="2xl"` and `PageHeader` hardcodes `size={20}`; both need an opt-in prop
before any of this is visible. See §9.

---

## 1. Colour lock (use this every time)

Drishti orange is `--ref-orange-500` in `src/styles/tokens.css`. The logo ramp
in `Logos/Drishti-darkmode.svg` runs `#FC7E01 → #F57101 → #E35200` with a
`#FDB621` gold highlight; the token ramp below is the one to render against.

| Role | Hex | Token |
| --- | --- | --- |
| Hero / body | `#F97316` | `--ref-orange-500` |
| Rim / highlight | `#FDBA74` | `--ref-orange-300` |
| Mid shade | `#FB923C` | `--ref-orange-400` |
| Recess / core | `#C2410C` | `--ref-orange-700` |
| Deep shadow | `#7C2D12` | `--ref-orange-800` |
| Ember | `#431407` | `--ref-orange-900` |
| Studio void | `#0F0F11` | `--ref-gray-950` |
| Graphite body | `#18181B` | `--ref-gray-900` |
| Graphite mid | `#2E2E33` | `--ref-gray-800` |

Do not substitute coral, amber, gold, or red. If a second material is needed it
is **graphite**, never a second brand colour.

**Severity colours are off-limits as body colour.** `#DC2626` (critical),
`#D97706` (high), `#EA580C` (medium), `#2563EB` (low) belong to badges and the
risk matrix. The only exception is Set D, where the band *is* the subject.

---

## 2. The dual-theme rule (the hard one)

Drishti ships **light and dark** (`src/styles/tokens.css` — dark is the primary
target, light is real and shipping). A render with a baked `#0F0F11` void is a
black rectangle on the light theme's `#F7F7F8` surfaces.

Three rules, all mandatory:

1. **Transparent background.** PNG with alpha. Never bake the void. The prompts
   below say "dark graphite void" to steer the *lighting*, not the backdrop —
   cut it out on export, or generate on `#0F0F11` and key it.
2. **Rim light is not optional.** Every object carries a `#FDBA74` rim on its
   upper-left contour. Without it, graphite-on-near-black loses its silhouette
   in dark mode and the icon becomes a vague orange smear.
3. **No graphite darker than `#18181B` on the outer contour.** Interior recesses
   can go to `#431407`; the outline cannot, or dark mode swallows it.

Check every render twice: dropped on `#0F0F11` and dropped on `#F7F7F8`. If it
only works on one, it is not finished.

---

## 3. Style prefix (paste before every subject)

```
3D product icon, one object, centered, 1:1 square, 8k, studio key light from upper left, dark graphite #0F0F11 void, transparent background on export, no floor shadow fade, Drishti orange #F97316 as the only chromatic color with #FDBA74 rim light on the upper-left contour and #C2410C recesses, graphite #18181B as the only second material, satin polymer with a single glass specular, crisp silhouette readable at 64px, no text, no letters, no numbers, no logos, no human faces, no watermarks, no extra props
```

Then append one subject line. One subject per image — never collage.

---

## 4. Set A — the twelve domain marks (`01`–`12`)

These are the nouns of the risk model and the highest-value renders in the set.
They mirror `DomainIconName` in `src/components/DomainIcon.tsx` one-for-one, so
a 3D mark and its line-art twin must be recognisably **the same object**. Read
the rationale comment above each path before generating; the semantics below are
lifted from it and are not negotiable.

1. `asset` — a 3D Drishti-orange `#F97316` pair of stacked storage drums, data at rest, graphite end caps, front three-quarter view
2. `phi` — a 3D Drishti-orange `#F97316` record card carrying a raised medical cross, graphite card body — **the cross is orange, never red, never the Red Cross emblem**; PHI is the thing protected, so no shield silhouette
3. `dataFlow` — a 3D Drishti-orange `#F97316` routed elbow connecting two graphite nodes, one arrowhead at the far end, direction unmistakable
4. `risk` — a 3D Drishti-orange `#F97316` scored gauge with a needle in the upper arc, graphite dial face, three tick marks only, no numerals — measured, not alarmed
5. `vendor` — a 3D Drishti-orange `#F97316` flat-roofed external office block, graphite windows, no signage — an external premises, never a clinic
6. `identity` — a 3D Drishti-orange `#F97316` single faceless person bust, graphite shoulders, one figure only — a group would read as "team"
7. `threat` — a 3D Drishti-orange `#F97316` radar scope dish with one bright contact blip off-centre, graphite housing, sweep arc implied — on-brand for दृष्टि
8. `control` — a 3D Drishti-orange `#F97316` closed padlock, graphite shackle, the one safeguard object in the set
9. `remediation` — a 3D Drishti-orange `#F97316` open-end wrench at a three-quarter angle, graphite grip — fixing, not building
10. `audit` — a 3D Drishti-orange `#F97316` page of ruled entries as a thick slab, graphite edge, lines of differing length as physical grooves, no readable text
11. `dashboard` — a 3D Drishti-orange `#F97316` composed panel layout of four unevenly split tiles as raised blocks, graphite gutters — never four identical squares
12. `import` — a 3D Drishti-orange `#F97316` intake tray receiving a stack of records in bulk, graphite rails — never a cloud

---

## 5. Set B — empty states (`13`–`21`)

The single best surface for this art: a dashed container, 96px+ of clear space,
and a glyph currently doing very little. Each one is the Set A object **in its
empty condition** — the emptiness is the subject, not a repeat of the noun.

Mapped from the `emptyIcon` prop at each call site:

13. `/assets` (`database`) — a 3D Drishti-orange `#F97316` storage drum standing open and hollow, graphite interior, nothing inside
14. `/phi-flow` (`document`) — a 3D Drishti-orange `#F97316` flow channel with no packet in it, two graphite nodes and an unlit orange route
15. `/access` (`identity`) — a 3D Drishti-orange `#F97316` empty badge holder on a graphite lanyard clip, no card in the sleeve
16. `/vendors` (`facility`) — a 3D Drishti-orange `#F97316` empty plot outline where a building would stand, graphite base plate, one orange corner marker
17. `/threats` (`threats`) — a 3D Drishti-orange `#F97316` radar scope with a clean sweep and no contact, graphite dish, calm — this is good news, render it calm not ominous
18. `/risks` (`risks`) — a 3D Drishti-orange `#F97316` gauge with the needle resting at zero, graphite dial, unscored
19. `/remediation` (`remediation`) — a 3D Drishti-orange `#F97316` empty tool rail with three vacant graphite clips, no wrench mounted
20. `/controls` (`locked`) — a 3D Drishti-orange `#F97316` open padlock with an empty graphite hasp, nothing to secure yet
21. `/audit` and `/policies` (`audit`, `document`) — a 3D Drishti-orange `#F97316` blank ruled slab, grooves unfilled, graphite edge

---

## 6. Set C — dashboard KPI tiles (`22`–`25`)

The four headline metrics on `/` (`src/pages/Dashboard.tsx`). Optional — four 3D
objects in a row can read busy. Generate them, then judge the row as a whole.

22. "Assets monitored" — a 3D Drishti-orange `#F97316` census of small graphite drums with one orange drum lit at the front
23. "Critical or extreme" — a 3D Drishti-orange `#F97316` warning prism with an ember `#431407` core, graphite base, single object
24. "PHI records / day" — a 3D Drishti-orange `#F97316` ribbon of record cards in motion through a graphite gate, throughput
25. "Unencrypted flows" — a 3D Drishti-orange `#F97316` open padlock riding a graphite data channel, the shackle clearly sprung

---

## 7. Set D — risk bands (`26`–`30`)

The only prompts permitted to leave the orange lock, because the band **is** the
colour. Sourced from `--sem-severity-*`; use the dark-theme values, they survive
both themes better. Same object, five finishes — a physical band marker so the
set reads as one scale.

26. `EXTREME` — a 3D band marker monolith in critical red `#F87171` with a graphite plinth, tallest of the five, ember core
27. `CRITICAL` — the same 3D band marker monolith in critical red `#F87171`, one step shorter, graphite plinth
28. `HIGH` — the same 3D band marker monolith in high amber `#FBBF24`, mid height, graphite plinth
29. `MODERATE` — the same 3D band marker monolith in medium orange `#FB923C`, low, graphite plinth
30. `LOW` — the same 3D band marker monolith in low blue `#60A5FA`, lowest, graphite plinth

Render all five from an identical camera and light rig. If they are not stackable
side by side as one scale, rerun the set, not the outlier.

---

## 8. Set E — state, feedback, and platform nouns (`31`–`44`)

Second priority. Generate after Sets A and B are accepted.

**State and feedback** — for large confirmation panels and error surfaces only,
never for inline badges:

31. `success` — a 3D Drishti-orange `#F97316` closed ring with a seated graphite core, complete
32. `warning` — a 3D Drishti-orange `#F97316` triangular alert volume, graphite base, no exclamation glyph
33. `error` — a 3D Drishti-orange `#F97316` cracked prism, fracture running to a `#431407` ember interior
34. `info` — a 3D Drishti-orange `#F97316` faceted marker pin, graphite stem
35. `loading` — a 3D Drishti-orange `#F97316` partial arc caught mid-rotation, graphite hub, motion implied not blurred
36. `block` — a 3D Drishti-orange `#F97316` barrier bar across a graphite gate, lowered
37. `visible` / `hidden` — a 3D Drishti-orange `#F97316` aperture iris, one render open and one closed, graphite housing — **two files, same object**
38. `clock` — a 3D Drishti-orange `#F97316` dial with graphite hands, no numerals

**Platform and data nouns** — for integrations, settings, and analytics panels:

39. `database` — a 3D Drishti-orange `#F97316` cylinder stack with graphite hoops
40. `server` — a 3D Drishti-orange `#F97316` rack block with graphite port strip
41. `network` — a 3D Drishti-orange `#F97316` hex node with six graphite ports
42. `chart` — a 3D Drishti-orange `#F97316` stair of four blocks rising left to right, graphite shadow side, no axis labels
43. `intelligence` — a 3D Drishti-orange `#F97316` faceted ember crystal, the insight spark, graphite setting
44. `model` — a 3D Drishti-orange `#F97316` faceless graphite head with an orange visor band — an abstract agent, never a person, never a photoreal face

---

## 9. Set F — hero surfaces (`45`–`48`)

### 45. Login backdrop

Save as `public/brand/login-bg.jpg`. Note the current login
(`src/pages/Login.tsx:62`) is a **centered card on a flat background**, not a
split panel — so this is a full-bleed page backdrop and the centre must stay
quiet enough for the card to sit on it. Subject off-centre, vignette toward the
middle.

```
Cinematic still for a dark healthcare risk-intelligence login, 16:9 landscape 3840x2160, 8k, photoreal 3D product cinema. A vast graphite #0F0F11 machine-room seen from a three-quarter balcony, subject weighted to the left third with the centre held quiet and near-empty for a UI card. A monumental Drishti eye-aperture: concentric orange #F97316 iris blades around a dark pupil, #FDBA74 rim light from upper left, #C2410C recesses. Abstract sealed record packets travel as a slow sluice of orange ember through graphite channels toward the aperture — protected health information under observation, not literal medical imagery. Satin polymer and brushed graphite only. Shallow depth of field, anamorphic bokeh, heavy vignette into the centre. No people, no human faces, no patients, no hospital beds, no desks, no laptops, no UI screens with readable text, no letters, no numbers, no logos, no hospital crosses, no caduceus, no red cross emblem, no watermarks. Hue locked to #F97316, not red, not amber, not gold.
```

### 46. 404 / not found

A 3D Drishti-orange `#F97316` radar scope sweeping an empty field, one graphite
socket where a contact should be and is not — the route does not exist. No "404".

### 47. Session expired / signed out

A 3D Drishti-orange `#F97316` padlock closing itself on a graphite door plate,
mid-motion. The token lives in memory only and a reload ends the session
(`.env.example`), so this surface is common — worth the render.

### 48. Drishti command mark

A 3D stylised eye-aperture folded from a single orange `#F97316` ribbon, graphite
shadow only, abstract — **not** a reproduction of the logo in `Logos/`, no
wordmark, no lockup. For the command palette and loading splash.

---

## 10. Do NOT render in 3D

These are interface verbs. They live at 12–18px, they change colour with state,
and a 3D version of any of them is a bug, not an upgrade. Per usage count in
`src`, these are also the most-rendered icons in the app:

`refresh` · `chevronUp/Down/Left/Right` · `arrowUp/Down/Left/Right` · `check` ·
`close` · `add` · `remove` · `edit` · `delete` · `filter` · `search` · `more` ·
`drag` · `download` · `export` · `logout` · `menu` · `panel` · `collapse` ·
`expand` · `play` · `pause` · `dot` · `externalLink` · `trendUp` · `trendDown`

`refresh` alone renders 15 times across the app and spins. Leave it as Lucide.

---

## 11. Output, filenames, and directory

- **Square PNG with alpha**, 1024×1024 master. Also export `@2x` at 2048 if the
  empty-state slot lands above 120px.
- Convert to **WebP** for shipping; keep the PNG master out of `public/`.
- Budget: **under 40 KB** per shipped WebP. Anything heavier gets downscaled, not
  shipped. The whole point of the traced SVGs was weight.
- Directory: `public/brand/icons-3d/`. Masters in `design/icons-3d-source/`
  alongside the existing `design/icons-source/`.

Filenames match the set, numbered as above:

```
01-domain-asset.png        13-empty-assets.png       26-band-extreme.png
02-domain-phi.png          14-empty-phi-flow.png     27-band-critical.png
03-domain-data-flow.png    15-empty-access.png       28-band-high.png
04-domain-risk.png         16-empty-vendors.png      29-band-moderate.png
05-domain-vendor.png       17-empty-threats.png      30-band-low.png
06-domain-identity.png     18-empty-risks.png        31-state-success.png
07-domain-threat.png       19-empty-remediation.png  …
08-domain-control.png      20-empty-controls.png     45-login-bg.jpg
09-domain-remediation.png  21-empty-audit.png        46-not-found.png
10-domain-audit.png        22-kpi-assets.png         47-session-expired.png
11-domain-dashboard.png    23-kpi-critical.png       48-command-mark.png
12-domain-import.png       24-kpi-phi-throughput.png
                           25-kpi-unencrypted.png
```

---

## 12. How to generate

- One subject per image. Never collage several into one render.
- Paste the §3 style prefix, then exactly one subject line. Nothing else.
- If the model adds text, rerun with `no text, no letters, no numbers` appended.
- If the orange drifts red or gold, append `hue locked to #F97316, not red, not
  amber, not gold`.
- If the silhouette dissolves on dark, append `strong #FDBA74 rim light on the
  upper-left contour, outer edge no darker than #18181B`.
- Keep one camera and one light rig for a whole set. Regenerate the set, not the
  one that drifted.
- Never generate real EHR, payer, or vendor brand marks. Prompt 5 (`vendor`) and
  prompt 16 stay abstract premises.
- Never generate the Red Cross emblem, a caduceus, patient faces, hospital beds,
  or anything that reads as a real medical record.

---

## 13. Acceptance checklist

Check every render against all nine before accepting it.

1. **Recognisable at 48px.** Shrink it. If you cannot name the object, reject it.
2. **Matches its line-art twin.** The 3D `control` and `DomainIcon` `control` are
   the same padlock, not two different safeguards.
3. **Reads on `#0F0F11`.** Silhouette intact, rim light doing its job.
4. **Reads on `#F7F7F8`.** No black slab, no lost graphite.
5. **Transparent alpha**, no residual matte fringe.
6. **One chromatic colour** — orange only, graphite as the second material.
   Set D is the sole exception.
7. **No text, numerals, faces, logos, or PHI.** Zoom to 100% and confirm.
8. **Under 40 KB** as shipped WebP.
9. **Set coherence.** Lay the whole set out on one sheet and squint. Any render
   with a different light direction, camera height, or gloss level is wrong even
   if it is the prettiest one there.

---

## 14. Wiring it into the app

Generating art changes nothing on its own. Both display components hardcode a
small size and take an `IconName`, not an image.

**`EmptyState`** (`src/components/ui-bits.tsx:359`) renders
`<AppIcon name={icon} size="2xl" />` — a fixed 24px. Add an optional `art` prop
that, when present, renders a 96–120px `<img>` and falls back to the existing
`AppIcon` when absent. Fallback is required: the art is decorative, and a missing
file must degrade to today's glyph rather than a broken image.

**`PageHeader`** (`src/components/ui-patterns.tsx:144`) renders
`<DomainIcon name={icon} size={20} />`. Same pattern if headers get art — but
try it on one page first and look at it next to the `font-display` title before
committing to fourteen.

Keep the image decorative: `alt=""` and `aria-hidden`, because the heading beside
it already carries the meaning. Serve WebP with a PNG fallback, set explicit
`width`/`height` so the dashed container does not reflow on load, and mark it
`loading="lazy"` everywhere except the login backdrop.

**Tests to expect:** `data-icon={name}` on `AppIcon` exists specifically so tests
can assert the right mark is in the right place. Any `art` prop must not remove
that attribute from the fallback path, or existing assertions break.
