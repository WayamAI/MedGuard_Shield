import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/AppIcon";
import { DomainIcon, type DomainIconName } from "@/components/DomainIcon";
import { Drishti3DIcon } from "@/components/Drishti3DIcon";
import { Badge } from "@/components/ui-bits";
import type { IconName } from "@/lib/icons";
import { DOMAIN_TO_3D, BAND_TO_3D, type Icon3DName } from "@/lib/icons3d";
import type { Tone } from "@/lib/tone";
import type { RiskBand, BaaStatus, Sensitivity } from "@/lib/apiTypes";
import { EMPTY_VALUE } from "@/lib/empty";

/**
 * Composite patterns built from ui-bits primitives.
 *
 * ui-bits owns the atoms (Btn, Badge, Card, Input). This file owns the
 * recurring *arrangements* — the page header every screen starts with, the
 * metric tile the dashboard repeats, the risk vocabulary shared by four
 * pages. Split so ui-bits stays a primitives file rather than growing into a
 * dumping ground.
 */

/* ------------------------------------------------------- risk vocabulary */

/**
 * One band→tone map for the whole app.
 *
 * This existed twice (Risks.tsx and Vendors.tsx) with the same values. Two
 * copies of a colour vocabulary is one rename away from a Vendor EXTREME and
 * a Risk EXTREME being different colours, which would quietly teach the
 * viewer that the bands mean different things on different pages.
 */
export const BAND_TONE: Record<RiskBand, Tone> = {
  EXTREME: "danger",
  CRITICAL: "danger",
  HIGH: "warning",
  MODERATE: "info",
  LOW: "success",
};

/** Worst first — the order every band summary and sort uses. */
export const BAND_ORDER: RiskBand[] = ["EXTREME", "CRITICAL", "HIGH", "MODERATE", "LOW"];

/** Rank for sorting. Higher is worse; unscored returns null so it sinks. */
export const bandRank = (band: RiskBand | null | undefined): number | null =>
  band == null ? null : BAND_ORDER.length - BAND_ORDER.indexOf(band);

export const BAA_TONE: Record<BaaStatus, Tone> = {
  SIGNED: "success",
  PENDING: "warning",
  EXPIRED: "danger",
  MISSING: "danger",
};

export const BAA_LABEL: Record<BaaStatus, string> = {
  SIGNED: "Signed",
  PENDING: "Pending",
  EXPIRED: "Expired",
  MISSING: "Missing",
};

export const SENSITIVITY_TONE: Record<Sensitivity, Tone> = {
  CRITICAL: "danger",
  HIGH: "warning",
  MEDIUM: "info",
  LOW: "muted",
};

/**
 * A risk band as rendered anywhere in Drishti.
 *
 * `null` means the scoring engine has not run for this record. It renders as
 * "Not scored" rather than borrowing a band, because an unassessed thing is
 * not a safe thing — it is an unknown one.
 */
export const RiskBadge = ({ band, className }: { band: RiskBand | null; className?: string }) =>
  band ? (
    <Badge tone={BAND_TONE[band]} className={className}>{band}</Badge>
  ) : (
    <Badge tone="muted" className={className}>Not scored</Badge>
  );

/**
 * A risk score, formatted for display.
 *
 * The API derives a score as a product of its factors, so it returns a whole
 * number for some rows (64, 80, 100) and a two-decimal float for others
 * (38.4, 11.52). Printed raw, one column reads 100 / 80 / 38.4 / 11.52 —
 * ragged precision that implies the engine is more certain about some rows
 * than others. One decimal at most, trailing zero dropped.
 *
 * Nothing is hidden: the exact value stays on the element as a tooltip. And
 * the band badge beside it always comes from the server, so display rounding
 * can never move a row into a band the API did not put it in.
 */
export const formatScore = (score: number): string => {
  const rounded = Math.round(score * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

/** Numeric score, consistently formatted. Em dash when unscored. */
export const RiskScore = ({
  score,
  className = "tabular",
}: {
  score: number | null | undefined;
  className?: string;
}) =>
  score == null
    ? <span className={className}>{EMPTY_VALUE}</span>
    : <span className={className} title={String(score)}>{formatScore(score)}</span>;

/* ------------------------------------------------------------ page header */

export type Breadcrumb = { label: string; to?: string };

/**
 * The top of every page: what this is, what it is for, and the actions that
 * apply to the whole screen. One component so the vertical rhythm above the
 * first card is identical everywhere.
 *
 * This carries the page's <h1>. The app shell deliberately does not also
 * render one — the title used to appear twice on every screen, once in the
 * top bar and again here, which reads as an unfinished layout rather than as
 * emphasis. The shell keeps the breadcrumb; the page keeps the title.
 */
export const PageHeader = ({
  title, description, actions, meta, icon, art, fallbackIcon,
}: {
  title: string;
  description?: string;
  /** Right-aligned controls: refresh, create, export. */
  actions?: ReactNode;
  /** A row of small facts under the description (counts, last-updated). */
  meta?: ReactNode;
  icon?: DomainIconName;
  /**
   * A 3D mark for a page whose concept has no domain glyph.
   *
   * Two destinations need this: Policies, whose barrier exists in 3D but not
   * in `DomainIcon`, and Settings, which has no domain noun at all. Everywhere
   * else `icon` is the right prop, because it upgrades the mark *and* keeps a
   * line-art twin for the sub-`sm` layout and the failure path.
   *
   * `fallbackIcon` supplies that twin here. Without one the small-screen
   * header simply has no mark, which is the honest degradation.
   */
  art?: Icon3DName;
  fallbackIcon?: DomainIconName;
}) => (
  /*
   * Below sm the title and its actions stack instead of sharing a row.
   * Sharing one meant the actions took their content width and the title —
   * which is min-w-0 and truncates — lost whatever was left: "Vendor Risk"
   * rendered as "Ven…" at 390px with Refresh and New vendor beside it.
   */
  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-6 sm:gap-y-3">
    <div className="flex min-w-0 flex-1 items-start gap-3">
      {(icon || art) && (
        /*
         * The page's identity anchor. It sits beside the title block rather
         * than inline with the title, because at 40px an inline mark drags the
         * baseline of a `font-display` heading off centre.
         *
         * 40px is a considered ceiling, not a default: large enough that the
         * render reads as an object, small enough that it stays subordinate to
         * the page name. Hidden below `sm`, where the title and its actions
         * already stack and the horizontal budget is spent.
         */
        <Drishti3DIcon
          name={art ?? DOMAIN_TO_3D[icon!]}
          size="md"
          className="mt-0.5 hidden sm:inline-block"
          fallback={
            (icon ?? fallbackIcon)
              ? <DomainIcon name={(icon ?? fallbackIcon)!} size={20} className="mt-1 text-brand" />
              : null
          }
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {(icon ?? fallbackIcon) && (
            <DomainIcon name={(icon ?? fallbackIcon)!} size={18} className="text-brand sm:hidden" />
          )}
          <h1 className="font-display text-display-page text-primary sm:truncate">{title}</h1>
        </div>
        {description && (
          <p className="mt-1 max-w-2xl text-body-sm text-tertiary">{description}</p>
        )}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">{meta}</div>}
      </div>
    </div>
    {actions && (
      /*
       * flex-shrink-0 keeps the controls at their natural size when there is
       * room, which is what a desktop header wants. Below sm it has to go:
       * it stopped the row shrinking to the viewport, so the row could never
       * wrap internally and simply overflowed instead — on PHI Flow that put
       * Export entirely off-screen and cut "Rescan" in half at 390px.
       */
      <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">{actions}</div>
    )}
  </div>
);

/* ------------------------------------------------------------ metric card */

/**
 * A single headline number.
 *
 * `value` is deliberately typed to accept undefined: a metric whose query has
 * not resolved renders a pulse, never a zero. "0 critical risks" is the most
 * reassuring thing this product can say and it must never be said by accident.
 */
export const MetricCard = ({
  label, value, sub, icon, art, tone = "muted", onClick, loading, emphasis,
}: {
  label: string;
  value: number | string | undefined;
  sub?: ReactNode;
  icon?: IconName;
  /**
   * 3D render for the tile, in place of the small glyph.
   *
   * For lead metrics only. Four tiles in a row each carrying 40px of artwork
   * reads as a toy shelf, and the number is what the tile is for, so the
   * dashboard gives art to the two that carry the row's story: what is being
   * watched (assets) and what is wrong with it (critical and extreme). The
   * other two are supporting counts and stay in line art. That difference is
   * the hierarchy, and it only works while it stays a difference: adding art
   * to a third tile flattens all four back into a row of pictures.
   */
  art?: Icon3DName;
  tone?: Tone;
  onClick?: () => void;
  loading?: boolean;
  /** Draws the accent rule in the tone colour — for the metrics that matter. */
  emphasis?: boolean;
}) => {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? "button" : undefined}
      data-testid={`metric-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
      className={cn(
        "relative flex w-full flex-col gap-1 overflow-hidden rounded-lg border border-default bg-container p-4 text-left",
        "transition-colors duration-200",
        onClick && "hover:border-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
      )}
    >
      {emphasis && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-0.5"
          style={{ background: `var(--sem-feedback-${tone === "danger" ? "error" : tone === "muted" ? "neutral" : tone}-icon)` }}
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <span className="text-label-sm uppercase tracking-wide text-tertiary">{label}</span>
        {art ? (
          <Drishti3DIcon
            name={art}
            size="md"
            className="-mr-1 -mt-1"
            fallback={icon ? <AppIcon name={icon} size="md" className="text-icon-quaternary" /> : null}
          />
        ) : (
          icon && <AppIcon name={icon} size="md" className="text-icon-quaternary" />
        )}
      </div>
      {loading || value === undefined ? (
        <span className="mt-1 inline-block h-8 w-16 animate-pulse rounded bg-raised-2" />
      ) : (
        <span className="font-display text-display-metric tabular text-primary">{value}</span>
      )}
      {sub && <span className="text-caption text-tertiary">{sub}</span>}
    </Wrapper>
  );
};

/* ------------------------------------------------------------------ tabs */

export type TabItem = { id: string; label: string; count?: number };

/**
 * Section tabs for detail views. Roving-tabindex keyboard handling, so arrow
 * keys move between tabs the way a native tablist does.
 */
export const Tabs = ({
  tabs, active, onChange, className,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) => {
  const base = useId();
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex(t => t.id === active);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault(); onChange(tabs[(i + 1) % tabs.length].id);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault(); onChange(tabs[(i - 1 + tabs.length) % tabs.length].id);
    } else if (e.key === "Home") { e.preventDefault(); onChange(tabs[0].id); }
    else if (e.key === "End") { e.preventDefault(); onChange(tabs[tabs.length - 1].id); }
  };

  return (
    <div role="tablist" aria-label="Sections" onKeyDown={onKeyDown}
         className={cn("flex gap-0.5 overflow-x-auto border-b border-default", className)}>
      {tabs.map(t => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            id={`${base}-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative whitespace-nowrap px-3 py-2 text-label-md transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand",
              selected ? "text-primary" : "text-tertiary hover:text-primary",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn("ml-1.5 tabular text-caption", selected ? "text-secondary" : "text-quaternary")}>
                {t.count}
              </span>
            )}
            {selected && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-brand" />}
          </button>
        );
      })}
    </div>
  );
};

export const TabPanel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div role="tabpanel" className={cn("pt-4", className)}>{children}</div>
);

/* ------------------------------------------------------------- field rows */

/** Label/value pair, the unit that detail panels are built from. */
export const Field = ({ label, value, className }: { label: string; value: ReactNode; className?: string }) => (
  <div className={cn("flex items-baseline justify-between gap-4 border-b border-muted py-2 last:border-0", className)}>
    <span className="flex-shrink-0 text-body-sm text-tertiary">{label}</span>
    <span className="min-w-0 text-right text-body-sm text-primary">{value}</span>
  </div>
);

/** A titled group of fields. */
export const FieldGroup = ({ title, children }: { title?: string; children: ReactNode }) => (
  <div>
    {title && <div className="mb-1 text-label-sm uppercase tracking-wide text-quaternary">{title}</div>}
    <div>{children}</div>
  </div>
);

/* -------------------------------------------------------------- filter bar */

export type FilterOption = { value: string; label: string; count?: number };

/**
 * A labelled row of mutually-exclusive chips. Rendered as a radiogroup so a
 * screen reader announces it as one choice rather than N unrelated buttons.
 */
export const FilterBar = ({
  label, options, value, onChange, className,
}: {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) => (
  <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap items-center gap-1.5", className)}>
    {options.map(o => {
      const selected = o.value === value;
      return (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-label-sm transition-colors duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
            selected
              ? "border-transparent bg-action-primary text-on-color"
              : "border-default bg-action text-secondary hover:bg-action-secondary-hover hover:text-primary",
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cn("tabular text-caption", selected ? "text-on-color/70" : "text-quaternary")}>
              {o.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

/* ----------------------------------------------------------- entity avatar */

/**
 * A domain mark in a tinted well. Gives tables and drawers a consistent
 * leading glyph so an asset row is visually an *asset* before it is read.
 */
export const EntityAvatar = ({
  icon, tone = "muted", size = "md",
}: { icon: DomainIconName; tone?: Tone; size?: "sm" | "md" | "lg" }) => {
  const box = { sm: "h-7 w-7", md: "h-9 w-9", lg: "h-11 w-11" }[size];
  const glyph = { sm: 14, md: 18, lg: 22 }[size];
  const family = tone === "danger" ? "error" : tone === "muted" ? "neutral" : tone;
  return (
    <span
      aria-hidden
      className={cn("inline-flex items-center justify-center rounded-lg border", box)}
      style={{
        background: `var(--sem-feedback-${family}-background)`,
        borderColor: `var(--sem-feedback-${family}-stroke)`,
        color: `var(--sem-feedback-${family}-icon)`,
      }}
    >
      <DomainIcon name={icon} size={glyph} />
    </span>
  );
};

/**
 * The identity anchor at the top of an entity drawer.
 *
 * A drawer is the one place in the app where a single record fills the
 * screen, so it is worth saying which *kind* of thing it is in more than
 * 18px of line art. This is `EntityAvatar`'s bigger sibling and takes its
 * place there, nowhere else — the avatar stays correct in every table row,
 * where §16's density rule applies.
 *
 * The tone tile is dropped rather than kept behind the render, and that is
 * deliberate: every drawer that uses this puts the severity, band or status
 * in a `Badge` immediately to the right, so a second colour-coded surface
 * saying the same thing is noise. Where the tone *is* the identity — a risk,
 * whose band marker is the mark — the caller passes the band's own art.
 *
 * `EntityAvatar` remains the fallback, so a render that fails to load leaves
 * the drawer looking exactly as it did before any of this existed.
 */
export const EntityMark = ({
  art, icon, tone = "muted",
}: { art: Icon3DName; icon: DomainIconName; tone?: Tone }) => (
  <Drishti3DIcon
    name={art}
    size="lg"
    className="mt-0.5"
    fallback={<EntityAvatar icon={icon} tone={tone} size="lg" />}
  />
);

/* ------------------------------------------------------------------ misc */

/** Inline "n of m" bar, for composition breakdowns. */
/**
 * The five risk bands as a row of physical markers, with their counts.
 *
 * The band markers are the one part of the 3D set that leaves the orange lock,
 * because here the colour *is* the data. They were shot as a scale — five
 * monoliths of descending height on one camera — so they only do their job
 * seen together. Used on the two band summaries, never in a table row, where
 * §16's density rule applies and `RiskBadge` stays the right answer.
 *
 * The marker is an anchor, not the datum. The band name and the count are
 * still text, still selectable, still the thing a screen reader reads; strip
 * the artwork out and the component still says everything it needs to.
 */
export const RiskBandScale = ({ counts }: { counts: Record<RiskBand, number> }) => (
  <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
    {BAND_ORDER.map(band => (
      <div key={band} className="flex items-center gap-2">
        <Drishti3DIcon name={BAND_TO_3D[band]} size="sm" fallback={<RiskBadge band={band} />} />
        <div className="flex flex-col leading-tight">
          <span className="text-caption text-tertiary">
            {band[0] + band.slice(1).toLowerCase()}
          </span>
          <span className="tabular text-label-md text-primary">{counts[band] ?? 0}</span>
        </div>
      </div>
    ))}
  </div>
);

export const MiniBar = ({ segments }: { segments: Array<{ value: number; tone: Tone; label: string }> }) => {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-raised-2" role="img"
         aria-label={segments.map(s => `${s.label}: ${s.value}`).join(", ")}>
      {segments.filter(s => s.value > 0).map(s => (
        <span
          key={s.label}
          style={{
            width: `${(s.value / total) * 100}%`,
            background: `var(--sem-feedback-${s.tone === "danger" ? "error" : s.tone === "muted" ? "neutral" : s.tone}-icon)`,
          }}
        />
      ))}
    </div>
  );
};

/**
 * Copy-to-clipboard affordance for identifiers. Confirms in place rather than
 * firing a toast — a toast for a copy is noise.
 */
export const CopyValue = ({ value, className }: { value: string; className?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        });
      }}
      className={cn("group inline-flex items-center gap-1.5 font-mono text-body-sm text-secondary hover:text-primary", className)}
      aria-label={`Copy ${value}`}
    >
      {value}
      <AppIcon
        name={copied ? "check" : "export"}
        size="xs"
        className={cn("transition-opacity", copied ? "text-feedback-success-icon" : "opacity-0 group-hover:opacity-60")}
      />
    </button>
  );
};
