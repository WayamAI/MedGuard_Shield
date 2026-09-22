import { NavLink } from "react-router-dom";
import { AppIcon } from "@/components/AppIcon";
import { DomainIcon, type DomainIconName } from "@/components/DomainIcon";
import type { IconName } from "@/lib/icons";
import { cn } from "@/lib/utils";

export interface SidebarNavItem {
  to: string;
  label: string;
  /** Interface glyph, for destinations with no domain noun of their own. */
  icon?: IconName;
  /**
   * The domain mark for this concept.
   *
   * Preferred over `icon`: the sidebar used to draw Assets with Lucide's
   * Database while the table beneath it drew the custom asset mark. Two
   * glyphs for one concept reads as sloppiness rather than as a system.
   */
  domainIcon?: DomainIconName;
  end?: boolean;
  badge?: string;
  badgeTone?: "danger" | "warning";
  /**
   * Marks a destination whose endpoint does not exist yet, so the screen is
   * drawn from the bundled sample dataset.
   *
   * Deliberately not rendered inline. These labels run to "Policy &
   * Compliance", and every visible marker tried — a pill reading "Sample
   * data", one reading "Sample", a dot on the icon — either truncated the
   * label or read as an unfinished control. A truncated product name in the
   * sidebar is a worse artefact than no marker, so the visible statement
   * lives on the page itself (SampleDataNotice), where there is room to say
   * it in full, and this supplies the hover title and the accessible name.
   *
   * It still suppresses the item's badge: a severity count drawn from sample
   * data is the one number nobody should be reading closely.
   */
  note?: string;
  /**
   * Roles allowed to see this destination. Absent means everyone signed in.
   * Mirrors ProtectedRoute's own gate so the sidebar never offers a door the
   * router will bounce them from.
   */
  requireRole?: readonly string[];
}

/**
 * A single sidebar destination.
 *
 * The full state matrix lives here so inactive -> hover -> active reads
 * identically for every item:
 *   inactive  surface.action slot  + icon.tertiary
 *   hover     surface.raised slot  + icon.secondary
 *   active    action-surface.primary (light) + icon.on-color (near-black)
 *
 * When `collapsed`, the label is removed from the layout and moved onto the
 * native tooltip, and any badge shrinks to a dot on the icon slot.
 */
export function SidebarItem({ item, collapsed = false }: { item: SidebarNavItem; collapsed?: boolean }) {
  const showBadge = item.badge !== undefined && item.note === undefined;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={item.note ? `${item.label} (${item.note})` : item.label}
      title={
        item.note
          ? `${item.label} — ${item.note}`
          : collapsed
            ? item.label
            : undefined
      }
      className={({ isActive }) =>
        cn(
          "group relative mb-0.5 flex items-center gap-3 rounded-lg py-1.5 transition-colors duration-200",
          collapsed ? "justify-center px-0" : "px-2",
          isActive ? "bg-action-secondary-hover" : "hover:bg-action-tertiary-hover",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
              isActive
                ? "bg-action-primary text-icon-on-color"
                : "bg-action text-icon-tertiary group-hover:bg-action-secondary-focused group-hover:text-icon-secondary",
            )}
          >
            {item.domainIcon
              ? <DomainIcon name={item.domainIcon} size={18} />
              : item.icon
                ? <AppIcon name={item.icon} size="lg" />
                : null}

            {/* Collapsed: the count has nowhere to sit, so it becomes a dot. */}
            {collapsed && showBadge && (
              <span
                className={cn(
                  "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-container",
                  item.badgeTone === "danger" ? "bg-severity-critical" : "bg-severity-high",
                )}
              />
            )}

          </span>

          {!collapsed && (
            <>
              <span
                className={cn(
                  "flex-1 truncate text-label-md transition-colors duration-200",
                  isActive ? "text-primary" : "text-tertiary group-hover:text-secondary",
                )}
              >
                {item.label}
              </span>

              {showBadge && (
                <span
                  className={cn(
                    "tabular rounded-full px-1.5 py-0.5 text-caption font-semibold text-white",
                    item.badgeTone === "danger" ? "bg-severity-critical" : "bg-severity-high",
                  )}
                >
                  {item.badge}
                </span>
              )}

            </>
          )}
        </>
      )}
    </NavLink>
  );
}

export default SidebarItem;
