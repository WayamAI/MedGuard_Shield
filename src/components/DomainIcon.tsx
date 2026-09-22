import { cn } from "@/lib/utils";

/**
 * The ten Drishti domain marks.
 *
 * Lucide covers the interface verbs — search, close, chevrons — and is used
 * everywhere for those via <AppIcon>. These ten are the *nouns* of the risk
 * model, the things the product is actually about, and they earn a custom set
 * because they carry brand meaning that a generic icon library cannot:
 *
 *   Asset → PHI → Identity/Access → Vendor → Control → Risk
 *
 * Rules, so they read as one family:
 *   24×24 viewBox, 1.5 stroke, round caps/joins, no fills, currentColor only.
 * Monochrome by construction, so they inherit any token colour including the
 * brand orange, and stay legible at 16px.
 */

export type DomainIconName =
  | "asset" | "phi" | "dataFlow" | "risk" | "vendor"
  | "identity" | "threat" | "control" | "remediation" | "audit";

const PATHS: Record<DomainIconName, JSX.Element> = {
  /** Asset — a stacked data store. */
  asset: (
    <>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.75" />
      <path d="M5 5.5v6c0 1.52 3.13 2.75 7 2.75s7-1.23 7-2.75v-6" />
      <path d="M5 11.5v6c0 1.52 3.13 2.75 7 2.75s7-1.23 7-2.75v-6" />
    </>
  ),
  /** PHI — a record under protection. */
  phi: (
    <>
      <path d="M12 3 5 6v5.5c0 4 2.9 7.6 7 8.5 4.1-.9 7-4.5 7-8.5V6l-7-3Z" />
      <path d="M9.5 11.5h5M12 9v5" />
    </>
  ),
  /** Data flow — movement between two systems. */
  dataFlow: (
    <>
      <rect x="3" y="4" width="6" height="5" rx="1.25" />
      <rect x="15" y="15" width="6" height="5" rx="1.25" />
      <path d="M9 6.5h4.5a2.5 2.5 0 0 1 2.5 2.5v6" />
      <path d="m13.75 12.75 2.25 2.25 2.25-2.25" />
    </>
  ),
  /** Risk — graded exposure. */
  risk: (
    <>
      <path d="M12 3.5 3 19h18L12 3.5Z" />
      <path d="M12 10v4M12 16.5v.5" />
    </>
  ),
  /** Vendor — an external party. */
  vendor: (
    <>
      <path d="M4 9.5 12 4l8 5.5" />
      <path d="M5.5 9.5V19h13V9.5" />
      <path d="M9.5 19v-4.5h5V19" />
    </>
  ),
  /** Identity — a person holding access. */
  identity: (
    <>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5 19.5a7 7 0 0 1 14 0" />
    </>
  ),
  /** Threat — a detected anomaly. */
  threat: (
    <>
      <path d="M12 3.5 4.5 7v5c0 4 3.1 7.6 7.5 8.5 4.4-.9 7.5-4.5 7.5-8.5V7L12 3.5Z" />
      <path d="m9.75 11.5 1.75 1.75 3-3.5" />
    </>
  ),
  /** Control — a safeguard in place. */
  control: (
    <>
      <rect x="4.5" y="10.5" width="15" height="9" rx="1.75" />
      <path d="M8.5 10.5V7.75a3.5 3.5 0 0 1 7 0v2.75" />
      <path d="M12 14v2.5" />
    </>
  ),
  /** Remediation — a fix applied to a finding. */
  remediation: (
    <>
      <path d="M14.5 4.5a4 4 0 0 0-5.2 5.2L4 15v4.5h4.5l5.3-5.3a4 4 0 0 0 5.2-5.2l-2.6 2.6-2.4-2.4 2.5-2.7Z" />
    </>
  ),
  /** Audit — the event record. */
  audit: (
    <>
      <path d="M6 3.5h8.5L19 8v12.5H6V3.5Z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M9 12.5h6M9 16h4" />
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
