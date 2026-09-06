import { NavLink } from "react-router-dom";
import { AppIcon } from "@/components/AppIcon";
import type { IconName } from "@/lib/icons";
import { cn } from "@/lib/utils";

export interface SidebarNavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  badge?: string;
  badgeTone?: "danger" | "warning";
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
  return (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={item.label}
      title={collapsed ? item.label : undefined}
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
            <AppIcon name={item.icon} size="lg" />

            {/* Collapsed: the count has nowhere to sit, so it becomes a dot. */}
            {collapsed && item.badge && (
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

              {item.badge && (
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
