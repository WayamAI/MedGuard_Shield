import { cn } from "@/lib/utils";

/**
 * The twelve Drishti domain marks.
 *
 * Lucide covers the interface verbs — search, close, chevrons — everywhere via
 * <AppIcon>. These twelve are the *nouns* of the risk model, the things the
 * product is actually about, and they earn a custom set because they carry
 * brand meaning a generic library cannot:
 *
 *   Asset → PHI → Identity/Access → Vendor → Control → Risk
 *                                        ↘ Threat ↗
 *           Data Flow ─ Remediation ─ Audit ─ Dashboard ─ Import
 *
 * Traced from the commissioned artwork in `design/icons-source/`, which
 * arrived as 2K JPEGs. Raster could not ship: icons render at 16–24px and
 * must inherit `currentColor` so the same mark reads as tertiary grey in a
 * table, brand orange in a page header, and semantic red inside a critical
 * badge. A JPEG is one fixed colour on an opaque background, and ~500 KB
 * against roughly 400 bytes here.
 *
 * Three were simplified in the trace, because detail that reads at 2048px
 * turns to a grey smudge at 16:
 *   risk    — sixteen gauge ticks reduced to three
 *   control — rivets, side plates and the shackle highlight dropped
 *   dashboard — four mini-charts dropped for a composed panel layout
 *
 * House rules, so they read as one family:
 *   24×24 viewBox, artwork inside the central 20×20, 1.5 stroke, round caps
 *   and joins, no fills, currentColor only, nothing finer than 2px.
 */

export type DomainIconName =
  | "asset" | "phi" | "dataFlow" | "risk" | "vendor"
  | "identity" | "threat" | "control" | "remediation" | "audit"
  | "dashboard" | "import";

const PATHS: Record<DomainIconName, JSX.Element> = {
  /** Asset — two stacked drums. Stored data at rest. */
  asset: (
    <>
      <ellipse cx="12" cy="5.6" rx="7" ry="2.6" />
      <path d="M5 5.6v4.6c0 1.44 3.13 2.6 7 2.6s7-1.16 7-2.6V5.6" />
      <path d="M5 11.8v4.6c0 1.44 3.13 2.6 7 2.6s7-1.16 7-2.6v-4.6" />
    </>
  ),

  /**
   * PHI — a record card carrying a medical cross.
   *
   * Deliberately not a shield: PHI is the thing being protected, not the
   * protection. The shield belongs to `control`, and only one icon in the
   * set may use that silhouette or the two stop being tellable apart.
   */
  phi: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <path d="M12 9v6M9 12h6" />
    </>
  ),

  /** Data flow — two nodes, one routed elbow, direction at the far end. */
  dataFlow: (
    <>
      <circle cx="5.5" cy="17.75" r="2.4" />
      <circle cx="18.5" cy="6.25" r="2.4" />
      <path d="M7.9 17.75h3.6a1.6 1.6 0 0 0 1.6-1.6V7.85a1.6 1.6 0 0 1 1.6-1.6h1.4" />
      <path d="m14.6 4.6 1.65 1.65-1.65 1.65" />
    </>
  ),

  /**
   * Risk — a scored gauge.
   *
   * A needle on a dial says "measured", where a bare warning triangle says
   * "something happened". Risk in Drishti is a calculated band, not an
   * event, and the register is the product's analytical centrepiece.
   */
  risk: (
    <>
      <path d="M3.6 18a8.4 8.4 0 1 1 16.8 0" />
      <path d="M6.1 11.9l1.35.95M12 9.4v1.65M17.9 11.9l-1.35.95" />
      <path d="M12 18l4.6-5.3" />
      <circle cx="12" cy="18" r="1.5" />
    </>
  ),

  /** Vendor — a flat-roofed external premises. Never a clinic. */
  vendor: (
    <>
      <path d="M2.75 4.75h18.5v3.5H2.75z" />
      <path d="M4.75 8.25V20h14.5V8.25" />
      <path d="M10 20v-5.75h4V20" />
      <path d="M6.75 11.25h2.25M15 11.25h2.25" />
    </>
  ),

  /** Identity — one person. A group would mean "team", not "identity". */
  identity: (
    <>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M5 19.75a7 7 0 0 1 14 0" />
    </>
  ),

  /**
   * Threat — a radar scope with a contact.
   *
   * On-brand for दृष्टि (sight), and unlike anything else in the set at
   * 16px. Replaces a shield-with-a-checkmark, which read as verified/safe —
   * the exact opposite of a detected threat.
   */
  threat: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6.6" />
      <path d="m13.3 10.7 3.4-3.4" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="15.9" cy="15.9" r="1.15" />
    </>
  ),

  /** Control — a closed padlock. The one safeguard glyph in the set. */
  control: (
    <>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.25" />
      <path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" />
      <circle cx="12" cy="14.4" r="1.4" />
      <path d="M12 15.8v1.7" />
    </>
  ),

  /** Remediation — one open-end wrench. Fixing, not building. */
  remediation: (
    <path d="M15.9 3.35a5 5 0 0 0-5.65 6.6L3.95 16.25a2 2 0 1 0 2.8 2.8l6.3-6.3a5 5 0 0 0 6.6-5.65l-2.9 2.9-2.4-.6-.6-2.4 2.9-2.9Z" />
  ),

  /** Audit — a page of entries. Ruled lines of differing length. */
  audit: (
    <>
      <path d="M6.5 3.5h7L18 8v12.5H6.5z" />
      <path d="M13.5 3.5V8H18" />
      <path d="M9.25 12.25h5.5M9.25 15.25h5.5M9.25 18.25h3.25" />
    </>
  ),

  /**
   * Dashboard — a composed panel layout.
   *
   * Deliberately not four identical squares, which is every dashboard icon
   * ever drawn. The uneven split reads as an arranged overview.
   */
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.25" />
      <path d="M10 3.5v17" />
      <path d="M10 12h10.5" />
    </>
  ),

  /** Import — records arriving in bulk, into a tray. Never a cloud. */
  import: (
    <>
      <path d="M4.5 14.75v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.5" />
      <path d="M12 3.5v11.25" />
      <path d="m8 7.5 4-4 4 4" />
    </>
  ),
};

export type DomainIconProps = {
  name: DomainIconName;
  /** Pixel size; 16–24 are the tested sizes. */
  size?: number;
  className?: string;
  /** Omit for decorative use — the default, since these sit beside a label. */
  title?: string;
};

export function DomainIcon({ name, size = 20, className, title }: DomainIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}

export const DOMAIN_ICON_NAMES = Object.keys(PATHS) as DomainIconName[];
