/**
 * Turns the commissioned 3D renders in `3D Icons/` into shippable web assets.
 *
 * The renders arrive as 2048² JPEGs on a studio backdrop: no alpha, ~200 KB
 * each, 11 MB for the set. None of that can ship. This script produces the
 * `public/brand/icons-3d/` payload the app actually loads.
 *
 * What it does, and why each step is needed:
 *
 *   1. Keys the backdrop to transparency. A plain luminance threshold would
 *      punch holes through every graphite body in the set — the app's second
 *      material is #18181B and the backdrop is #111113, four points apart. So
 *      the fill is *edge-connected*: it floods inward from the border and
 *      stops at the object, which leaves interior darks untouched. Each border
 *      component carries its own reference colour, so the renders that came
 *      back letterboxed in white key just as cleanly as the dark ones.
 *
 *   2. Trims to the drawn content and re-pads to a fixed margin. The renders
 *      frame their subjects at whatever scale the model chose; without this the
 *      padlock reads two sizes larger than the wrench beside it.
 *
 *   3. Emits WebP at 2 sizes, plus a PNG fallback.
 *
 * Originals are never touched — `3D Icons/` is the source of truth and this
 * writes only to `public/brand/icons-3d/`.
 *
 * Run: node scripts/build-3d-icons.mjs
 */
import sharp from "sharp";
import { mkdir, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const SRC = "3D Icons";
const OUT = "public/brand/icons-3d";

/**
 * Semantic slug → source filename.
 *
 * The generated filenames describe the render ("Orange_wrench_fixing_object"),
 * not the product concept, and several subjects came back as near-duplicate
 * pairs. This table is where a Drishti concept is bound to one specific file;
 * everything downstream refers to the slug and never to a filename.
 */
const MAP = {
  // --- domain marks: the nouns of the risk model -------------------------
  asset: "Stacked_storage_drums_product_icon_2K_20260925120510.jpg",
  phi: "Ribbon_of_record_cards_throughput_2K_20260925120138.jpg",
  dataFlow: "Dataflow_3D_product_icon_connect…_2K_20260925120506.jpg",
  risk: "3D_orange_gauge_with_needle_2K_20260925120504.jpg",
  vendor: "3D_orange_office_block_icon_2K_20260925120450.jpg",
  identity: "Faceless_person_bust_3D_icon_2K_20260925120448.jpg",
  threat: "Orange_radar_scope_dish_2K_20260925120326.jpg",
  control: "3D_closed_padlock_product_icon_2K_20260925120451.jpg",
  remediation: "Orange_wrench_fixing_object_2K_20260925120502.jpg",
  audit: "3D_orange_ruled_slab_2K_20260925120224.jpg",
  policy: "3D_product_icon_of_barrier_2K_20260925120105.jpg",
  dashboard: "3D_dashboard_product_icon_layout_2K_20260925120444.jpg",
  import: "Intake_tray_receiving_records_stack_2K_20260925120441.jpg",

  // --- empty states: the same noun, in its empty condition ---------------
  emptyAssets: "Open_storage_drum_2K_20260925120256.jpg",
  emptyPhiFlow: "3D_product_icon_flow_channel_2K_20260925120305.jpg",
  emptyAccess: "Empty_badge_holder_on_lanyard_2K_20260925120128.jpg",
  emptyVendors: "3D_orange_building_plot_icon_2K_20260925120221.jpg",
  emptyThreats: "Orange_radar_scope_missing_contact_2K_20260925120011.jpg",
  emptyRisks: "Orange_gauge_resting_at_zero_2K_20260925120252.jpg",
  emptyRemediation: "Empty_tool_rail_with_clips_2K_20260925120118.jpg",
  emptyControls: "Orange_padlock_with_empty_hasp_2K_20260925120208.jpg",
  emptyAudit: "Orange_3D_page_slab_2K_20260925120456.jpg",

  // --- dashboard metrics --------------------------------------------------
  kpiAssets: "Orange_drum_among_graphite_drums_2K_20260925120208.jpg",
  kpiCritical: "Orange_triangular_warning_icon_2K_20260925120130.jpg",
  kpiUnencrypted: "Open_padlock_on_data_channel_2K_20260925120151.jpg",

  // --- risk bands: the one set allowed off the orange lock ---------------
  bandExtreme: "Red_monolith_band_marker_2K_20260925120217.jpg",
  bandCritical: "Red_band_marker_monolith_icon_2K_20260925120212.jpg",
  bandHigh: "3D_band_marker_monolith_2K_20260925120148.jpg",
  bandModerate: "Orange_band_marker_monolith_2K_20260925120252.jpg",
  bandLow: "3D_band_marker_monolith_2K_20260925120226.jpg",

  // --- state and platform -------------------------------------------------
  success: "3D_closed_ring_with_core_2K_20260925120233.jpg",
  warning: "Orange_triangular_warning_icon_2K_20260925120130.jpg",
  info: "3D_marker_pin_icon_2K_20260925120156.jpg",
  loading: "Orange_arc_rotating_in_void_2K_20260925120115.jpg",
  visible: "Aperture_iris_product_icon_2K_20260925120058.jpg",
  hidden: "Closed_3D_aperture_iris_2K_20260925120051.jpg",
  clock: "Orange_clock_3D_product_icon_2K_20260925120053.jpg",
  database: "Cylinder_stack_with_graphite_hoops_2K_20260925120011.jpg",
  server: "3D_server_rack_block_icon_2K_20260925120055.jpg",
  network: "3D_network_node_icon_2K_20260925120016.jpg",
  chart: "3D_orange_stair_product_icon_2K_20260925120009.jpg",
  intelligence: "3D_faceted_orange_ember_crystal_2K_20260925120047.jpg",
  model: "Graphite_head_with_orange_visor_2K_20260925120017.jpg",

  // --- hero surfaces ------------------------------------------------------
  notFound: "3D_orange_radar_scope_rendering_2K_20260925120245.jpg",
  sessionExpired: "Padlock_closing_on_door_plate_2K_20260925120036.jpg",
  commandMark: "3D_orange_ribbon_eye_icon_2K_20260925120002.jpg",
};

/**
 * Fractional crops applied before keying.
 *
 * Currently empty, and worth saying why rather than deleting: cropping a
 * render whose checkerboard abuts the subject is actively harmful. Cutting the
 * risk gauge free of its checker sliced into the dial, which put the dial's
 * dark interior on the image border — and the flood fill seeds from the
 * border, so it drained the gauge hollow. Anything that touches the subject
 * has to be keyed, not cropped. The hook stays for a render that frames its
 * subject in a corner with clear air around it.
 */
const PRECROP = {
  /*
   * The barrier came back composited on a black rounded plate rather than on
   * the open studio field the rest of the set uses. The checker keys away
   * fine, but that leaves the plate as the content — a black tile, which is
   * wrong twice: it is the only icon in the set with a container, and on a
   * dark surface it reads as a hole rather than as an object.
   *
   * The plate is the same #111113 as the standard backdrop, so it keys
   * cleanly *once it touches the border*. Cropping just inside it is what puts
   * it there. Safe here because the gate has clear air on all four sides
   * within the plate, which is exactly the case this hook was left for.
   */
  policy: { left: 0.12, top: 0.12, width: 0.78, height: 0.74 },
};

/**
 * Per-icon edge trims, by side.
 *
 * The last resort, and only one render needs it. On the risk gauge the dithered
 * checker is *fused* to the dial by its anti-aliased boundary: one connected
 * region, 40% saturated overall, so the region filter reads the whole thing as
 * artwork and keeps it. Cropping cuts the dial open, and no tolerance spans a
 * halftone.
 *
 * So this eats inward from the named edge, column by column, stopping the
 * moment a column carries real colour. It cannot reach past the subject's own
 * silhouette, which is what makes it safe — but it is opt-in per icon, because
 * run everywhere it would nibble the graphite spikes off the intelligence
 * crystal and the legs off the radar housing.
 */
const EDGE_TRIM = {
  risk: ["right", "bottom"],
};

/**
 * Post-key clips, as a fraction of the working frame.
 *
 * The edge trim stops at the first column holding colour, which on the risk
 * gauge leaves a checker sliver pinned between the strip and the dial rim.
 * Clipping is safe *after* keying in a way cropping beforehand is not: the
 * flood has already run, so removing pixels here cannot expose the dial's dark
 * interior to a border seed. Bounds come from measuring where the gauge's
 * orange actually ends (x 0.80, y 0.78 of the frame), plus a little air.
 */
/**
 * Icons whose leftover checker is welded to the artwork.
 *
 * On these three the checker meets the subject along an anti-aliased boundary,
 * so it is literally the same connected region as the object and no
 * region-level test can separate them — the fill sees one shape that is 40%
 * orange and keeps all of it. The only discriminator left is the pixel itself.
 *
 * Opt-in, and deliberately not global: the honest cost of this rule is that it
 * also erases genuine near-white specular, which would punch pinholes through
 * the chrome ring on `hidden` and the visor on `model`. These three are flat
 * orange slabs and an elbow — they own almost no white — so here it is free.
 */
const DECHECKER = new Set(["phi", "risk", "dataFlow"]);

/**
 * Backdrop sealed *inside* an icon's own silhouette, and where to find it.
 *
 * Only the barrier. Its plate keys away from the border once precropped, but
 * the rectangle framed by the two posts, the boom and the lower rail is walled
 * off from the edge, so the flood can never reach it and it survives as a
 * black panel hanging in the middle of the gate.
 *
 * Two approaches fail here, and both are worth recording because both are the
 * obvious thing to reach for:
 *
 *   - Region labelling cannot find it. The labeller walks opaque pixels, and
 *     the void is surrounded by opaque artwork, so the void and the gate come
 *     back as one region. Nothing about the *shape* separates them.
 *   - Colour alone cannot find it either. The void is the flat #121214 of the
 *     studio field, but so is the shadowed interior of the cabinet on the
 *     right — a tolerance wide enough to clear the void ate a ragged bite out
 *     of the cabinet, and one tight enough to spare the cabinet left the void.
 *
 * So the colour test is kept and simply aimed: a rectangle, in fractions of
 * the working frame, inside which near-backdrop pixels are backdrop. The
 * bounds come from mapping where the void actually sits (x 0.21–0.51,
 * y 0.44–0.66) and stopping short of the posts and the rail that bound it.
 * Narrow and per-icon on purpose — it is a patch for one render, not a rule.
 */
const INTERIOR_VOIDS = {
  policy: { left: 0.20, top: 0.42, right: 0.52, bottom: 0.685 },
};

const POSTCLIP = {
  risk: { right: 0.83, bottom: 0.82 },
};

/** Not square, not an icon: the login backdrop keeps its framing and its backdrop. */
const BACKDROP = {
  loginBg: "Orange_aperture_in_machine_room_2K_20260925120043.jpg",
};

/** Emitted widths. 96 covers every in-app slot at 2x; 320 covers the hero surfaces. */
const SIZES = [96, 320];
/** Share of the square left clear around the trimmed subject. */
const MARGIN = 0.06;

/**
 * Flood the backdrop from the border and return an alpha channel.
 *
 * Every border pixel seeds a component carrying its own reference colour, so a
 * render that came back with white letterbox bands above a dark studio field
 * keys both in one pass. Interior pixels are only ever reached through a
 * connected path from the edge, which is what keeps the graphite bodies and the
 * dark cores (the padlock keyhole, the aperture pupil, the radar dish) opaque.
 */
function keyBackdrop(data, w, h, channels, tolerance) {
  /*
   * Some renders came back with a transparency checkerboard drawn into the
   * pixels — the model illustrating "transparent" rather than being it. A
   * checker is two colours, so one tolerance cannot span it: the light checker
   * alternates #FFFFFF with #BDBDBD (~114 apart) and the dark one #050507 with
   * #1E1E20 (~43 apart). Seeds are graded by luminance instead. The wide light
   * tolerance is safe because nothing in the artwork is near white — the
   * palette is orange and graphite — while dark seeds stay tight, since
   * graphite bodies sit only a few points off the studio backdrop.
   */
  const luma = (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114;
  const toleranceFor = (r, g, b) => (luma(r, g, b) > 150 ? 130 : tolerance);

  /*
   * JPEG leaves a halo where the checker meets the object: pixels that are
   * neither checker colour nor artwork, so no single tolerance reaches them,
   * and they survive as a pale frame around the subject. They are identifiable
   * by what the artwork never is — near-neutral and *very* light. The bar has
   * to sit high: the first cut allowed anything above luma 70 through, which
   * ate the risk gauge alive, because a satin render's specular highlights are
   * exactly that — near-neutral and moderately bright. Only near-white
   * neutrals are backdrop. Applied on light backdrops only: on a dark studio
   * field the same test would strip the graphite.
   */
  const isLightResidue = (r, g, b) =>
    Math.max(r, g, b) - Math.min(r, g, b) < 16 && luma(r, g, b) > 150;
  const alpha = new Uint8Array(w * h).fill(255);
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const at = (i) => i * channels;

  const seeds = [];
  for (let x = 0; x < w; x++) { seeds.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seeds.push(y * w, y * w + w - 1); }

  for (const seed of seeds) {
    if (seen[seed]) continue;
    const s = at(seed);
    const [sr, sg, sb] = [data[s], data[s + 1], data[s + 2]];
    const tol = toleranceFor(sr, sg, sb);
    const seedIsLight = luma(sr, sg, sb) > 150;
    let top = 0;
    stack[top++] = seed;
    seen[seed] = 1;

    while (top > 0) {
      const i = stack[--top];
      const p = at(i);
      const dr = data[p] - sr, dg = data[p + 1] - sg, db = data[p + 2] - sb;
      const near = dr * dr + dg * dg + db * db <= tol * tol;
      if (!near && !(seedIsLight && isLightResidue(data[p], data[p + 1], data[p + 2]))) continue;

      alpha[i] = 0;
      const x = i % w, y = (i / w) | 0;
      if (x > 0 && !seen[i - 1]) { seen[i - 1] = 1; stack[top++] = i - 1; }
      if (x < w - 1 && !seen[i + 1]) { seen[i + 1] = 1; stack[top++] = i + 1; }
      if (y > 0 && !seen[i - w]) { seen[i - w] = 1; stack[top++] = i - w; }
      if (y < h - 1 && !seen[i + w]) { seen[i + w] = 1; stack[top++] = i + w; }
    }
  }
  return alpha;
}

/**
 * Erase leftover checkerboard that the flood could not reach.
 *
 * Two of the renders carry a *dithered* checker — a halftone of varying dot
 * density rather than two flat tones. The blend values between dots sit
 * outside any tolerance wide enough to be safe, so the fill stalls and leaves
 * a ragged grey slab beside the subject. Cropping it away is not an option
 * either: the risk gauge's orange body runs to x=0.80 of its frame and the
 * strip starts before that, so any crop that clears the strip cuts the dial
 * open — and a cut dial puts its dark interior on the border, where the fill
 * drains it hollow.
 *
 * What separates the two reliably is colour, not position. The artwork is
 * orange; the checker is grey. So each surviving opaque region is labelled,
 * and a region is erased when it both touches the border and is essentially
 * unsaturated. The border test is what protects the set's genuinely grey
 * parts — the graphite drums, the visor, the radar housing — which sit inside
 * the frame attached to orange bodies, not out at the edge.
 */
function dropNeutralBorderRegions(alpha, data, w, h, channels) {
  const label = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);

  for (let start = 0; start < w * h; start++) {
    if (alpha[start] === 0 || label[start] !== -1) continue;

    let top = 0, area = 0, saturated = 0, touchesBorder = false, lumaSum = 0;
    const members = [];
    stack[top++] = start;
    label[start] = start;

    while (top > 0) {
      const i = stack[--top];
      members.push(i);
      area++;
      const p = i * channels;
      const spread = Math.max(data[p], data[p + 1], data[p + 2]) - Math.min(data[p], data[p + 1], data[p + 2]);
      if (spread > 30) saturated++;
      lumaSum += data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
      const x = i % w, y = (i / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;
      if (x > 0 && alpha[i - 1] && label[i - 1] === -1) { label[i - 1] = start; stack[top++] = i - 1; }
      if (x < w - 1 && alpha[i + 1] && label[i + 1] === -1) { label[i + 1] = start; stack[top++] = i + 1; }
      if (y > 0 && alpha[i - w] && label[i - w] === -1) { label[i - w] = start; stack[top++] = i - w; }
      if (y < h - 1 && alpha[i + w] && label[i + w] === -1) { label[i + w] = start; stack[top++] = i + w; }
    }

    const colourless = saturated / area < 0.12;
    /*
     * Two ways a region is backdrop rather than artwork. Touching the border
     * and colourless is the open case — the strip beside the gauge. The second
     * is the trapped case: checker sealed inside an opening the edge fill can
     * never reach, like the window in the PHI record frame or the gap in the
     * data-flow elbow. Those are identified by brightness, since the palette
     * tops out well below white — a colourless region averaging above luma 150
     * is checkerboard wherever it sits.
     */
    if (colourless && (touchesBorder || lumaSum / area > 150)) {
      for (const i of members) alpha[i] = 0;
    }
  }
}

/**
 * Eat inward from the named edges while each line is opaque-but-colourless.
 * Stops at the first line carrying saturated pixels, so it can never reach past
 * the subject's silhouette into the artwork.
 */
function trimEdges(alpha, data, w, h, channels, sides) {
  const colourless = (line) => {
    let opaque = 0, saturated = 0;
    for (const i of line) {
      if (!alpha[i]) continue;
      opaque++;
      const p = i * channels;
      if (Math.max(data[p], data[p + 1], data[p + 2]) - Math.min(data[p], data[p + 1], data[p + 2]) > 30) saturated++;
    }
    return opaque > 0 && saturated / opaque < 0.05;
  };
  const col = (x) => Array.from({ length: h }, (_, y) => y * w + x);
  const rowAt = (y) => Array.from({ length: w }, (_, x) => y * w + x);

  for (const side of sides) {
    const [lines, count] = side === "right" || side === "left" ? [col, w] : [rowAt, h];
    const order = side === "right" || side === "bottom"
      ? Array.from({ length: count }, (_, k) => count - 1 - k)
      : Array.from({ length: count }, (_, k) => k);
    for (const k of order) {
      const line = lines(k);
      if (!colourless(line)) break;
      for (const i of line) alpha[i] = 0;
    }
  }
}

/** Tight box around everything still opaque, so subjects can be re-scaled to match. */
function contentBox(alpha, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

async function buildIcon(slug, file) {
  const src = path.join(SRC, file);
  const meta = await sharp(src).metadata();
  const crop = PRECROP[slug];
  const base = crop
    ? sharp(src).extract({
        left: Math.round(crop.left * meta.width),
        top: Math.round(crop.top * meta.height),
        width: Math.round(crop.width * meta.width),
        height: Math.round(crop.height * meta.height),
      })
    : sharp(src);
  // Key at a working resolution: 2048² flood-fills are slow and the extra
  // detail is thrown away by the 320px export anyway.
  const work = base.resize(768, 768, { fit: "inside" });
  const { data, info } = await work.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;

  const alpha = keyBackdrop(data, w, h, channels, 52);
  dropNeutralBorderRegions(alpha, data, w, h, channels);
  const voidBox = INTERIOR_VOIDS[slug];
  if (voidBox) {
    // The corner is backdrop by construction: the border flood seeded there.
    const [br, bg, bb] = [data[0], data[1], data[2]];
    for (let y = Math.round(voidBox.top * h); y < Math.round(voidBox.bottom * h); y++) {
      for (let x = Math.round(voidBox.left * w); x < Math.round(voidBox.right * w); x++) {
        const i = y * w + x;
        if (!alpha[i]) continue;
        const p = i * channels;
        const dr = data[p] - br, dg = data[p + 1] - bg, db = data[p + 2] - bb;
        if (dr * dr + dg * dg + db * db <= 20 * 20) alpha[i] = 0;
      }
    }
  }
  if (EDGE_TRIM[slug]) trimEdges(alpha, data, w, h, channels, EDGE_TRIM[slug]);
  if (DECHECKER.has(slug)) {
    for (let i = 0; i < w * h; i++) {
      if (!alpha[i]) continue;
      const p = i * channels;
      const spread = Math.max(data[p], data[p + 1], data[p + 2]) - Math.min(data[p], data[p + 1], data[p + 2]);
      if (spread < 18 && data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114 > 150) alpha[i] = 0;
    }
  }
  const clip = POSTCLIP[slug];
  if (clip) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x / w > clip.right || y / h > clip.bottom) alpha[y * w + x] = 0;
      }
    }
  }
  const box = contentBox(alpha, w, h);
  if (!box) throw new Error(`${slug}: keyed to nothing — tolerance too high for ${file}`);

  const coverage = (box.width * box.height) / (w * h);

  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const p = i * channels;
    rgba[i * 4] = data[p];
    rgba[i * 4 + 1] = data[p + 1];
    rgba[i * 4 + 2] = data[p + 2];
    rgba[i * 4 + 3] = alpha[i];
  }

  // Square the trimmed subject first so every icon lands on the same canvas,
  // then scale once. Cropping to the box and padding to a square keeps the
  // aspect ratio — the artwork is never stretched.
  const side = Math.max(box.width, box.height);
  const pad = Math.round(side * MARGIN);
  const canvas = side + pad * 2;

  const trimmed = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extract(box)
    .extend({
      top: Math.round((canvas - box.height) / 2),
      bottom: canvas - box.height - Math.round((canvas - box.height) / 2),
      left: Math.round((canvas - box.width) / 2),
      right: canvas - box.width - Math.round((canvas - box.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const written = [];
  for (const size of SIZES) {
    const out = path.join(OUT, `${slug}-${size}.webp`);
    const info2 = await sharp(trimmed).resize(size, size).webp({ quality: 86, effort: 6 }).toFile(out);
    written.push({ file: `${slug}-${size}.webp`, bytes: info2.size });
  }
  const png = await sharp(trimmed).resize(96, 96).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${slug}-96.png`));
  written.push({ file: `${slug}-96.png`, bytes: png.size });

  return { slug, source: file, coverage, written };
}

async function buildBackdrop(slug, file) {
  // The backdrop is meant to have a backdrop. No keying, no squaring — it is
  // cropped by the page, so it only needs to be small enough to ship.
  const out = path.join(OUT, `${slug}.webp`);
  const info = await sharp(path.join(SRC, file)).resize(1600).webp({ quality: 74, effort: 6 }).toFile(out);
  return { slug, source: file, written: [{ file: `${slug}.webp`, bytes: info.size }] };
}

const results = [];
await mkdir(OUT, { recursive: true });

for (const [slug, file] of Object.entries(MAP)) {
  results.push(await buildIcon(slug, file));
}
for (const [slug, file] of Object.entries(BACKDROP)) {
  results.push(await buildBackdrop(slug, file));
}

const used = new Set([...Object.values(MAP), ...Object.values(BACKDROP)]);
const unused = (await readdir(SRC)).filter((f) => /\.jpe?g$/i.test(f) && !used.has(f));

const total = results.flatMap((r) => r.written).reduce((n, w) => n + w.bytes, 0);
await writeFile(
  path.join(OUT, "manifest.json"),
  JSON.stringify({ generatedFrom: SRC, icons: results, unusedSources: unused }, null, 2) + "\n",
);

for (const r of results) {
  const big = r.written.find((w) => w.file.endsWith("-320.webp")) ?? r.written[0];
  const cov = r.coverage ? ` cover=${(r.coverage * 100).toFixed(0)}%` : "";
  console.log(`${r.slug.padEnd(18)} ${String(Math.round(big.bytes / 1024)).padStart(4)} KB${cov}`);
}
console.log(`\n${results.length} icons, ${Math.round(total / 1024)} KB total, ${unused.length} sources unused`);
