import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { icon3dSrc, icon3dFallback, type Icon3DName } from "@/lib/icons3d";

/**
 * The only way to render a 3D icon in this app.
 *
 * Direct `<img src="/brand/icons-3d/…">` is not allowed anywhere else, for the
 * same reason `AppIcon` exists: the path scheme, the srcset, the sizing scale
 * and the failure behaviour have to be decided once. Scatter them and the
 * eighth caller forgets the `width`/`height` and the empty state reflows on
 * load.
 *
 * Presentation is deliberately bare — no ring, no tile, no glow, no drop
 * shadow. The renders already carry their own studio lighting and a contact
 * shadow; adding a CSS one gives every icon two shadows falling in different
 * directions. The artwork is the visual identity, the container is nothing.
 */

/**
 * Sizes, chosen against the surfaces that actually exist in this app rather
 * than a generic scale. Nothing below `sm`: a 3D render at 24px is mud, and
 * anything that small should be using `AppIcon` instead.
 */
const SIZE_PX = {
  sm: 28,
  md: 40,
  lg: 56,
  xl: 88,
  hero: 128,
} as const;

export type Icon3DSize = keyof typeof SIZE_PX;

export interface Drishti3DIconProps {
  name: Icon3DName;
  /** Defaults to `md` — the page-header and metric-tile size. */
  size?: Icon3DSize;
  className?: string;
  /**
   * Give this only when the icon carries meaning of its own. Beside a heading
   * that already names the concept it is decoration, and a label would make a
   * screen reader announce the same word twice.
   */
  label?: string;
  /**
   * Load eagerly and at high fetch priority. For the one icon above the fold
   * on first paint — the login mark. Everything else stays lazy.
   */
  priority?: boolean;
  /**
   * Line-art to show if the render fails to load. Always pass one: the artwork
   * is an enhancement, and a broken-image glyph in a page header is a far worse
   * outcome than the `AppIcon` that used to be there.
   */
  fallback?: ReactNode;
}

export function Drishti3DIcon({
  name,
  size = "md",
  className,
  label,
  priority,
  fallback,
}: Drishti3DIconProps) {
  const [failed, setFailed] = useState(false);
  const px = SIZE_PX[size];

  if (failed && fallback) return <>{fallback}</>;

  return (
    <img
      // Names the mark in the DOM, matching the `data-icon` convention in
      // AppIcon — without it nothing can assert that the right artwork landed
      // on the right surface.
      data-icon-3d={name}
      src={icon3dSrc(name, px > 48 ? 320 : 96)}
      srcSet={`${icon3dSrc(name, 96)} 96w, ${icon3dSrc(name, 320)} 320w`}
      sizes={`${px}px`}
      // Explicit intrinsic size: the empty-state container is centred and
      // dashed, so a late-arriving image without one jumps the layout under
      // the reader's eye.
      width={px}
      height={px}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onError={(e) => {
        // One retry as PNG before giving up: the only realistic cause is a
        // browser without WebP, and the fallback is already on disk.
        const img = e.currentTarget;
        const png = icon3dFallback(name);
        if (!img.src.endsWith(png)) {
          img.srcset = "";
          img.src = png;
          return;
        }
        setFailed(true);
      }}
      className={cn("inline-block shrink-0 object-contain", className)}
      style={{ width: px, height: px }}
    />
  );
}

export default Drishti3DIcon;
