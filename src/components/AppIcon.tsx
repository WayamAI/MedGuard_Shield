import { icons, type IconName } from "@/lib/icons";
import { cn } from "@/lib/utils";

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

/** Pixel sizes mirror --icon-size-* in src/styles/tokens.css. */
const SIZE_PX: Record<IconSize, number> = {
  xs: 12, sm: 14, md: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 28,
};

/**
 * One stroke weight for the whole app. Lucide ships at 2; 1.5 reads finer and
 * suits the dense telemetry surface without going wispy at 12-14px.
 */
export const ICON_STROKE_WIDTH = 1.5;

export interface AppIconProps {
  name: IconName;
  /** Omit when sizing via className (e.g. the h-4 w-4 convention in components/ui). */
  size?: IconSize;
  className?: string;
  spin?: boolean;
  /** Provide for meaningful icons. Decorative icons stay aria-hidden (the default). */
  "aria-label"?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

/**
 * The only way to render an icon in this app.
 *
 * Colour comes from the surrounding text colour (icons are stroked with
 * currentColor), so callers style with the semantic icon utilities:
 *   <AppIcon name="threats" className="text-icon-tertiary" />
 */
export function AppIcon({
  name,
  size,
  className,
  spin,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
}: AppIconProps) {
  const Glyph = icons[name];
  // An icon is decorative unless it carries its own label.
  const hidden = ariaHidden ?? !ariaLabel;

  return (
    <Glyph
      // Names the mark in the DOM. The redesign hangs on the right glyph
      // appearing in the right place, and without this nothing can assert it.
      data-icon={name}
      size={size ? SIZE_PX[size] : undefined}
      strokeWidth={ICON_STROKE_WIDTH}
      absoluteStrokeWidth
      className={cn("inline-block shrink-0", spin && "animate-spin", className)}
      aria-label={ariaLabel}
      aria-hidden={hidden}
      role={ariaLabel ? "img" : undefined}
    />
  );
}

export default AppIcon;
