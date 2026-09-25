/**
 * The 3D icon registry — the single source of truth for dimensional artwork.
 *
 * This sits *beside* the line-art system in `src/lib/icons.ts`, it does not
 * replace it. The split is a size and colour constraint, not a preference:
 *
 *   - Lucide and `DomainIcon` render at 12–28px, inherit `currentColor`, and
 *     cost ~400 bytes. They own every table cell, badge, button, sidebar row
 *     and inline affordance. That is the overwhelming majority of the app.
 *   - These are raster renders. They cannot recolour, they are mud below
 *     ~40px, and they cost 5–30 KB each. They earn their place only where the
 *     surface is large enough to show them: page headers, empty states, the
 *     dashboard's lead metrics, login, and 404.
 *
 * Adding a name here does not put it on screen. It is a catalogue, not a
 * policy — see `Drishti3DIcon` for how one gets rendered.
 *
 * Assets are produced by `scripts/build-3d-icons.mjs` from the originals in
 * `3D Icons/`, and land in `public/brand/icons-3d/`. Served from `public/`
 * rather than imported so they stay out of the JS bundle and are cached by URL.
 *
 * Forty-seven of the fifty-one commissioned renders are bound to a slug. The
 * five that are not are second takes, not gaps: near-identical alternates of
 * `success`, `info`, `network` and `asset`, plus the second barrier. They are
 * left in `3D Icons/` rather than deleted, and `manifest.json` lists them
 * under `unusedSources` on every build so the count stays honest.
 *
 * Eight slugs are built but never rendered, and that is also a decision
 * rather than an omission, so it is written down here:
 *
 *   intelligence, model  The AI marks. Drishti shows what the API computed
 *                        and nothing else; there is no AI surface for them to
 *                        sit on, and adding one to use the artwork would be
 *                        the tail wagging the dog.
 *   database, server,    Platform nouns with no page of their own. Asset type
 *   network              is a table column and a badge, both far below the
 *                        size at which a render is legible.
 *   success, loading     State marks. `success` belongs on a toast and
 *                        `loading` on a skeleton, and both are surfaces whose
 *                        whole job is to be cheap and instant. A 5 KB image
 *                        in a loading state is a contradiction.
 *   clock                Now used on Vendors. Kept in this note's history
 *                        because it was the borderline case: a state mark
 *                        that turned out to have one genuine entity meaning.
 *   commandMark          The eye ribbon. Login already carries the Drishti
 *                        wordmark, and a second brand mark above it is one
 *                        logo too many on the one screen that needs none.
 *
 * They stay in the registry because they are built, catalogued and ready if a
 * surface ever earns one. A name here has never meant a name on screen.
 */

/** Concepts the set covers. Slugs match the emitted filenames exactly. */
export const ICON_3D_NAMES = [
  // domain marks — the nouns of the risk model, one per DomainIconName
  "asset", "phi", "dataFlow", "risk", "vendor", "identity", "threat",
  "control", "remediation", "audit", "dashboard", "import",
  // `policy` has no DomainIcon counterpart — Policies borrows the audit glyph
  // for its 18px slots — so it is named here and passed explicitly rather than
  // arriving through DOMAIN_TO_3D.
  "policy",
  // empty states — the same noun, in its empty condition
  "emptyAssets", "emptyPhiFlow", "emptyAccess", "emptyVendors", "emptyThreats",
  "emptyRisks", "emptyRemediation", "emptyControls", "emptyAudit",
  // dashboard metrics
  "kpiAssets", "kpiCritical", "kpiUnencrypted",
  // risk bands — the one set that leaves the orange lock, because the band is the colour
  "bandExtreme", "bandCritical", "bandHigh", "bandModerate", "bandLow",
  // state and platform
  "success", "warning", "info", "loading", "visible", "hidden", "clock",
  "database", "server", "network", "chart", "intelligence", "model",
  // hero surfaces
  "notFound", "sessionExpired", "commandMark",
] as const;

export type Icon3DName = (typeof ICON_3D_NAMES)[number];

const BASE = "/brand/icons-3d";

/**
 * Emitted widths. Two is deliberate: 96 covers every in-app slot at 2x on a
 * retina display, 320 covers the hero surfaces. A third size would cost more
 * in cache misses than it saves in bytes.
 */
export const ICON_3D_WIDTHS = [96, 320] as const;

export const icon3dSrc = (name: Icon3DName, width: (typeof ICON_3D_WIDTHS)[number] = 96) =>
  `${BASE}/${name}-${width}.webp`;

/** PNG of last resort, for a browser without WebP. Emitted at 96 only. */
export const icon3dFallback = (name: Icon3DName) => `${BASE}/${name}-96.png`;

/** Full-bleed backdrop for the login page. Not an icon: it keeps its own backdrop. */
export const LOGIN_BACKDROP = `${BASE}/loginBg.webp`;

/**
 * Domain mark → 3D counterpart.
 *
 * Keyed by `DomainIconName` so a page header can upgrade its existing icon
 * without restating which concept it is. Every one of the twelve is covered,
 * so this is total rather than partial — a missing entry would be a silent
 * downgrade to line art, which is exactly the bug that is hard to spot.
 */
export const DOMAIN_TO_3D = {
  asset: "asset",
  phi: "phi",
  dataFlow: "dataFlow",
  risk: "risk",
  vendor: "vendor",
  identity: "identity",
  threat: "threat",
  control: "control",
  remediation: "remediation",
  audit: "audit",
  dashboard: "dashboard",
  import: "import",
} as const satisfies Record<string, Icon3DName>;

/**
 * Risk band → 3D band marker.
 *
 * The markers are a physical scale: five monoliths of descending height, shot
 * on one camera. They are an anchor beside the score, never a replacement for
 * it — the band, the number and the matrix position remain the authority.
 */
export const BAND_TO_3D = {
  EXTREME: "bandExtreme",
  CRITICAL: "bandCritical",
  HIGH: "bandHigh",
  MODERATE: "bandModerate",
  LOW: "bandLow",
} as const satisfies Record<string, Icon3DName>;
