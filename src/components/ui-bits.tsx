import { ReactNode, useEffect } from "react";
import { AppIcon } from "@/components/AppIcon";
import { Drishti3DIcon } from "@/components/Drishti3DIcon";
import { IconButton } from "@/components/IconButton";
import type { IconName } from "@/lib/icons";
import type { Icon3DName } from "@/lib/icons3d";
import { cn } from "@/lib/utils";
import { type Tone, toneVar } from "@/lib/tone";
import { EMPTY_VALUE } from "@/lib/empty";

/**
 * Shared primitives for the application surface.
 *
 * Every colour, size and radius here routes through the semantic token layer
 * (see src/styles/tokens.css + tailwind.config.ts). No raw palette values.
 */

/** Public tone names -> token family. `danger`/`muted` are kept as the app's
 *  established vocabulary; they map onto feedback.error / feedback.neutral. */
const TONE_TEXT: Record<Tone, string> = {
  success: "text-feedback-success",
  warning: "text-feedback-warning",
  danger: "text-feedback-error",
  info: "text-feedback-info",
  muted: "text-feedback-neutral",
};

/** Solid, saturated status fills. Status is read at a glance, so badges use a
 *  bright fill with its own contrast-checked foreground rather than a tint. */
const TONE_BADGE: Record<Tone, string> = {
  success: "bg-solid-success text-on-solid-success",
  warning: "bg-solid-warning text-on-solid-warning",
  danger: "bg-solid-error text-on-solid-error",
  info: "bg-solid-info text-on-solid-info",
  muted: "bg-solid-neutral text-on-solid-neutral",
};

/** The 4-level alert scale, each at full saturation. */
const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: "bg-solid-critical text-on-solid-critical",
  HIGH: "bg-solid-high text-on-solid-high",
  MEDIUM: "bg-solid-medium text-on-solid-medium",
  LOW: "bg-solid-low text-on-solid-low",
  INFO: "bg-solid-low text-on-solid-low",
};

const TONE_ICON: Record<Tone, string> = {
  success: "text-feedback-success-icon",
  warning: "text-feedback-warning-icon",
  danger: "text-feedback-error-icon",
  info: "text-feedback-info-icon",
  muted: "text-feedback-neutral-icon",
};

export const Card = ({ className = "", children }: { className?: string; children: ReactNode }) => (
  <div className={cn("bg-raised border border-default rounded-card", className)}>{children}</div>
);

export const Badge = ({ tone = "muted", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) => (
  <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-caption font-semibold", TONE_BADGE[tone], className)}>
    {children}
  </span>
);

/** Status/severity pill. Bright, solid, one fill per severity level. */
export const SeverityBadge = ({ sev }: { sev: string }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-caption font-semibold tracking-wide",
      SEVERITY_BADGE[sev] ?? "bg-solid-neutral text-on-solid-neutral",
    )}
  >
    {sev}
  </span>
);

export { SeverityBadge as StatusBadge };

/** Compact filter pill, muted by default, brighter when selected. Never a blue pill. */
export const FilterChip = ({
  selected = false, onClick, children, className = "", count,
}: { selected?: boolean; onClick?: () => void; children: ReactNode; className?: string; count?: number }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={cn(
      "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-label-sm transition-colors duration-200",
      selected
        ? "border-transparent bg-action-primary text-on-color"
        : "border-default bg-action text-secondary hover:bg-action-secondary-hover hover:text-primary",
      className,
    )}
  >
    {children}
    {count !== undefined && (
      <span className={cn("tabular text-caption", selected ? "text-on-color/70" : "text-quaternary")}>{count}</span>
    )}
  </button>
);

export function Modal({ open, onClose, title, children, size = "md", dismissOnBackdrop = true }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; size?: "sm" | "md" | "lg" | "xl"; dismissOnBackdrop?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={() => dismissOnBackdrop && onClose()} />
      <div className={cn("relative flex max-h-[88vh] w-full flex-col rounded-card border border-active bg-raised fade-in", w)}>
        {title && (
          <div className="flex items-center justify-between border-b border-muted px-5 py-4">
            <h3 className="text-heading-md text-primary">{title}</h3>
            <IconButton icon="close" aria-label="Close dialog" size="sm" onClick={onClose} />
          </div>
        )}
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/**
 * Side panel. Reads as part of the shell rather than a floating modal:
 * flush to the viewport edge, single hairline stroke, no backdrop blur.
 */
export function SlideOver({ open, onClose, title, children, footer, width = 440 }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="absolute right-0 top-0 flex h-full max-w-full flex-col border-l border-default bg-container slide-in-right"
        style={{ width }}
      >
        <div className="flex items-center justify-between border-b border-muted px-5 py-4">
          <h3 className="text-heading-md text-primary">{title}</h3>
          <IconButton icon="close" aria-label="Close panel" size="sm" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-muted p-4">{footer}</div>}
      </div>
    </div>
  );
}

type BtnVariant = "default" | "primary" | "danger" | "success" | "ghost" | "outline" | "warning" | "inverse";

const BTN_VARIANT: Record<BtnVariant, string> = {
  default: "bg-action-secondary text-action-secondary hover:bg-action-secondary-hover",
  primary: "bg-brand text-primary-foreground hover:bg-brand-hover",
  // `inverse` is the light-on-dark CTA used for a panel's primary action.
  inverse: "bg-action-primary text-on-color hover:bg-action-primary-hover",
  danger: "bg-feedback-error-background text-feedback-error border border-feedback-error-stroke hover:bg-feedback-error-stroke hover:text-primary",
  success: "bg-feedback-success-background text-feedback-success border border-feedback-success-stroke hover:bg-feedback-success-stroke hover:text-primary",
  warning: "bg-feedback-warning-background text-feedback-warning border border-feedback-warning-stroke hover:bg-feedback-warning-stroke hover:text-primary",
  ghost: "bg-action-tertiary text-action-tertiary hover:bg-action-tertiary-hover hover:text-primary",
  /*
   * border-muted, not border-default. default is #2E2E33 in dark, which
   * against a near-black page reads as a hard black ring drawn around
   * every Refresh and Cancel. muted keeps the outline legible as an
   * outline while letting the surface, not the stroke, do the work.
   */
  outline: "border border-muted text-secondary hover:border-default hover:bg-action-secondary-hover hover:text-primary",
};

export const Btn = ({ variant = "default", className = "", children, ...rest }: { variant?: BtnVariant } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={cn(
      "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-label-sm transition-colors duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
      "disabled:cursor-not-allowed disabled:opacity-50",
      BTN_VARIANT[variant],
      className,
    )}
    {...rest}
  >
    {children}
  </button>
);

const FIELD =
  "bg-action border border-default rounded-md px-3 py-1.5 text-body-md text-primary placeholder:text-quaternary " +
  "transition-colors duration-200 focus:outline-none focus:border-active";

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={cn(FIELD, props.className)} />
);

export const Select = ({ children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...rest} className={cn(FIELD, rest.className)}>{children}</select>
);

export const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={cn(FIELD, "w-full", props.className)} />
);

/** Radial progress. Telemetry value set in Michroma with tabular figures. */
export const Gauge = ({ value, size = 120, tone = "info", label }: { value: number; size?: number; tone?: Tone; label?: string }) => {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const isDisplay = size >= 96;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sem-surface-action)" strokeWidth="8" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={toneVar(tone)} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Michroma is a wide, square face, it only fits (and only reads as a
            display metric) at larger diameters. Small gauges use Geist. */}
        {isDisplay ? (
          <span className="font-display tabular leading-none text-primary" style={{ fontSize: size * 0.19 }}>
            {value}%
          </span>
        ) : (
          <span className="tabular font-semibold leading-none text-primary" style={{ fontSize: size * 0.28 }}>
            {value}
          </span>
        )}
        {label && <span className="mt-1 text-caption text-tertiary">{label}</span>}
      </div>
    </div>
  );
};

export const KPI = ({ icon, label, value, trend, accent = "info", onClick, loading, stale }: {
  icon: IconName; label: string;
  /** `undefined` renders a dash rather than "undefined" when a fetch fails. */
  value?: string;
  trend?: string; accent?: Tone; onClick?: () => void;
  /** First load: shimmer in place of the figure, same height, no layout jump. */
  loading?: boolean;
  /** Last known figure, backend currently unreachable. */
  stale?: boolean;
}) => (
  <Card
    className={cn(
      "p-4 transition-colors duration-200",
      onClick && "cursor-pointer hover:border-active",
    )}
  >
    <div onClick={onClick}>
      <div className="mb-3 flex items-center justify-between">
        <AppIcon name={icon} size="lg" className={TONE_ICON[accent]} />
        <span className="text-caption uppercase tracking-wider text-tertiary">{label}</span>
      </div>
      {loading ? (
        <div
          role="status"
          aria-label={`Loading ${label}`}
          className="h-[--kpi-metric-h] w-24 animate-pulse rounded bg-raised-2"
          style={{ height: "1.9rem" }}
        />
      ) : (
        <div
          className={cn("font-display text-display-metric-sm tabular text-primary", stale && "opacity-60")}
          title={stale ? "Last known value. Backend unreachable." : undefined}
        >
          {value ?? EMPTY_VALUE}
        </div>
      )}
      {/*
        The trend line holds its place while loading. It used to render only
        once data arrived, so every card in a KPI row lost a line on first
        paint and the grid — plus everything below it — dropped when the fetch
        landed. Reserved for every card, not only the ones that will end up
        with a trend: the row is as tall as its tallest card either way, so
        matching the one that has a trend is what keeps the row still.
      */}
      {loading ? (
        <div role="status" aria-label={`Loading ${label} trend`} className="mt-1 text-caption">
          <span className="inline-block h-3 w-24 animate-pulse rounded bg-raised-2 align-middle" />
        </div>
      ) : (
        trend && <div className={cn("mt-1 text-caption tabular", TONE_TEXT[accent])}>{trend}</div>
      )}
    </div>
  </Card>
);

export const SectionHeader = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) => (
  /*
   * Stacks below `sm`, for the same reason PageHeader does.
   *
   * Sharing one row at 390px put the action at its content width and left the
   * subtitle to wrap underneath it: on the dashboard "Every scored asset by
   * likelihood and impact…" ran straight under the Open register button and
   * the two were unreadable on top of each other. There is no horizontal
   * budget to share at that width, so they stop trying to share it.
   */
  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
    <div className="min-w-0">
      <h3 className="text-heading-sm text-primary">{title}</h3>
      {subtitle && <p className="mt-0.5 text-body-sm text-tertiary">{subtitle}</p>}
    </div>
    {action && <div className="sm:shrink-0">{action}</div>}
  </div>
);

/* ---------------------------------------------------------------------------
   Data-state primitives

   Every component that will read from the backend needs the same three
   non-happy paths. Defining them once keeps a failed fetch looking like part
   of the product rather than a stack trace, and keeps the skeleton the same
   height as the content it replaces so nothing jumps on load.
   -------------------------------------------------------------------------- */

/** Placeholder occupying the exact footprint of the chart it stands in for. */
export const ChartSkeleton = ({ height = 470, label = "Loading data" }: { height?: number; label?: string }) => (
  <div
    role="status"
    aria-label={label}
    className="flex w-full animate-pulse flex-col justify-center gap-3 rounded-lg border border-default bg-raised p-6"
    style={{ height }}
  >
    {[0.9, 0.6, 0.75, 0.45, 0.8].map((w, i) => (
      <div key={i} className="h-4 rounded bg-raised-2" style={{ width: `${w * 100}%` }} />
    ))}
    <span className="sr-only">{label}</span>
  </div>
);

/**
 * Failed fetch. `error` is inspected rather than printed raw: an unreachable
 * backend and an expired session are different problems for the viewer.
 */
export const ErrorState = ({
  title,
  message,
  onRetry,
  isRetrying,
  height,
  art,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  height?: number;
  /**
   * A 3D mark for an error that is a *state* rather than a fault.
   *
   * An expired session is the only one so far: it is an ordinary thing that
   * happens to everyone, and the red warning triangle overstates it. A real
   * failure keeps the triangle, because there the alarm is the point.
   */
  art?: Icon3DName;
}) => (
  <div
    role="alert"
    className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-default bg-raised-2 p-8 text-center"
    style={height ? { minHeight: height } : undefined}
  >
    {art ? (
      <Drishti3DIcon
        name={art}
        size="xl"
        fallback={<AppIcon name="warning" size="2xl" className="text-feedback-error" />}
      />
    ) : (
      <AppIcon name="warning" size="2xl" className="text-feedback-error" />
    )}
    <div>
      <div className="text-heading-sm text-primary">{title ?? "Could not load this data"}</div>
      {message && <p className="mt-1 max-w-md text-body-sm text-tertiary">{message}</p>}
    </div>
    {onRetry && (
      <Btn variant="outline" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? "Retrying…" : "Retry"}
      </Btn>
    )}
  </div>
);

/**
 * Request succeeded, there is simply nothing to draw. Not an error.
 *
 * The one surface in the app with room for the 3D artwork and no competition
 * for attention: a dashed container, eight units of padding, and previously a
 * single 24px glyph adrift in it. `art` names the render to show instead —
 * always the page's own subject in its empty condition, an open drum on
 * Assets, a radar with a clean sweep on Threats, so the picture states the
 * situation before the sentence does.
 *
 * `icon` stays required in practice: it is what renders if the artwork fails,
 * and what renders on every empty state that has not been given art.
 */
export const EmptyState = ({
  icon = "info",
  art,
  title,
  message,
  action,
  height,
}: {
  icon?: IconName;
  art?: Icon3DName;
  title: string;
  message?: string;
  action?: ReactNode;
  height?: number;
}) => (
  <div
    className="flex w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-default bg-raised-2 p-8 text-center"
    style={height ? { minHeight: height } : undefined}
  >
    {art ? (
      <Drishti3DIcon
        name={art}
        size="xl"
        fallback={<AppIcon name={icon} size="2xl" className="text-icon-tertiary" />}
      />
    ) : (
      <AppIcon name={icon} size="2xl" className="text-icon-tertiary" />
    )}
    <div>
      <div className="text-heading-sm text-primary">{title}</div>
      {message && <p className="mt-1 max-w-md text-body-sm text-tertiary">{message}</p>}
    </div>
    {action}
  </div>
);

/**
 * Holds a headline banner's footprint while the data behind it loads.
 *
 * These banners are conditional on their own content — no worst offender, no
 * banner — so on first paint the cards underneath sat about ninety pixels too
 * high and dropped the moment the fetch landed. The jump is small and very
 * visible, because it happens under the viewer's eye mid-sentence.
 *
 * The height is matched by construction rather than by a hardcoded number:
 * the same icon size, the same one-line text box, and a real Btn, all made
 * invisible. A magic height here would drift the first time a banner's
 * padding changed and nobody would notice until it jumped again.
 *
 * Trade-off worth naming: when the data arrives and there is nothing to
 * report, the reserved strip disappears and the page moves up instead. That
 * is the rarer case — a headline banner exists precisely because these
 * screens usually have something wrong to lead with — and an empty bordered
 * strip left permanently in its place would be worse.
 */
export const HeadlineSkeleton = ({ label = "Loading summary" }: { label?: string }) => (
  <div
    role="status"
    aria-label={label}
    className="flex animate-pulse items-center gap-3 rounded-md border border-default bg-raised p-3"
  >
    <AppIcon name="threats" size="md" className="invisible" />
    <span className="text-body-md">
      <span className="inline-block h-4 w-80 max-w-full rounded bg-raised-2 align-middle" />
    </span>
    <div className="flex-1" />
    <Btn variant="outline" className="invisible" tabIndex={-1} aria-hidden>
      View Details
    </Btn>
    <span className="sr-only">{label}</span>
  </div>
);
