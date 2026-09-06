import { ReactNode, useEffect } from "react";
import { AppIcon } from "@/components/AppIcon";
import { IconButton } from "@/components/IconButton";
import type { IconName } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { type Tone, toneVar } from "@/lib/tone";

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
  <div className={cn("bg-raised border border-default rounded-card shadow-raised", className)}>{children}</div>
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
      <div className={cn("relative flex max-h-[88vh] w-full flex-col rounded-card border border-default bg-raised shadow-panel fade-in", w)}>
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
  default: "bg-action-secondary text-action-secondary border border-default hover:bg-action-secondary-hover",
  primary: "bg-brand text-primary-foreground hover:bg-brand-hover",
  // `inverse` is the light-on-dark CTA used for a panel's primary action.
  inverse: "bg-action-primary text-on-color hover:bg-action-primary-hover",
  danger: "bg-feedback-error-background text-feedback-error border border-feedback-error-stroke hover:bg-feedback-error-stroke hover:text-primary",
  success: "bg-feedback-success-background text-feedback-success border border-feedback-success-stroke hover:bg-feedback-success-stroke hover:text-primary",
  warning: "bg-feedback-warning-background text-feedback-warning border border-feedback-warning-stroke hover:bg-feedback-warning-stroke hover:text-primary",
  ghost: "bg-action-tertiary text-action-tertiary hover:bg-action-tertiary-hover hover:text-primary",
  outline: "border border-default text-secondary hover:bg-action-secondary-hover hover:text-primary",
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

export const KPI = ({ icon, label, value, trend, accent = "info", onClick }: { icon: IconName; label: string; value: string; trend?: string; accent?: Tone; onClick?: () => void }) => (
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
      <div className="font-display text-display-metric-sm tabular text-primary">{value}</div>
      {trend && <div className={cn("mt-1 text-caption tabular", TONE_TEXT[accent])}>{trend}</div>}
    </div>
  </Card>
);

export const SectionHeader = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) => (
  <div className="mb-3 flex items-end justify-between gap-3">
    <div className="min-w-0">
      <h3 className="text-heading-sm text-primary">{title}</h3>
      {subtitle && <p className="mt-0.5 text-body-sm text-tertiary">{subtitle}</p>}
    </div>
    {action}
  </div>
);
