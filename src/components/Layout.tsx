import { useLocation, useNavigate } from "react-router-dom";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/store/AppStore";
import { Badge, Btn, SeverityBadge, SlideOver } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { IconButton } from "@/components/IconButton";
import { SidebarItem, type SidebarNavItem } from "@/components/SidebarItem";
import { ThemeToggle } from "@/components/ThemeToggle";
import wayamLogoLight from "@/assets/brand/wayam-logo-light.svg";
import wayamLogoDark from "@/assets/brand/wayam-logo-dark.svg";
import wayamMark from "@/assets/brand/wayam-favicon.svg";
import { notify } from "@/lib/notify";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { useThreats } from "@/hooks/useThreats";
import { cn } from "@/lib/utils";

const NAV: SidebarNavItem[] = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/phi-flow", label: "PHI Flow Map", icon: "phiFlow" },
  { to: "/access", label: "Access & Identity", icon: "access" },
  // No badge here: the count is live, so it is filled in at render.
  { to: "/threats", label: "Threat Detection", icon: "threats", badgeTone: "danger" },
  { to: "/policy", label: "Policy & Compliance", icon: "policy", note: "Sample data" },
  { to: "/ai", label: "AI Governance", icon: "ai", badge: "1", badgeTone: "warning", note: "Sample data" },
  { to: "/audit", label: "Audit & Reports", icon: "audit", note: "Sample data" },
  { to: "/risks", label: "Risk Register", icon: "risks" },
  { to: "/vendors", label: "Vendor Risk", icon: "facility" },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Governance Overview",
  "/phi-flow": "PHI Data Flow Map",
  "/access": "Access & Identity Management",
  "/threats": "Threat & Anomaly Detection",
  "/policy": "Policy & Compliance Engine",
  "/ai": "AI Governance Monitor",
  "/audit": "Audit Trail & Reports",
  "/vendors": "Vendor Risk Management",
  "/risks": "Risk Register",
};

const SEV_STROKE: Record<string, string> = {
  CRITICAL: "border-severity-critical",
  HIGH: "border-severity-high",
  MEDIUM: "border-severity-medium",
  LOW: "border-severity-low",
};

const COLLAPSE_KEY = "medguard-sidebar-collapsed";

export default function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, logout } = useAuth();

  /*
   * The threat count is read off the same /api/threats query the Threats page
   * uses — same key, so this shares its cache and its poll rather than adding
   * a second request. It was previously the literal "2" written into NAV,
   * which would have gone on saying 2 whatever the backend reported.
   *
   * Undefined while loading or while the backend is unreachable, which hides
   * the badge: no number at all beats a stale or invented one.
   */
  const openThreats = useThreats().data?.summary.open;
  const openThreatBadge = openThreats ? String(openThreats) : undefined;
  const { unreadCount, notifications, markNotifRead, markAllNotifRead } = useStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState("2 mins ago");
  const searchRef = useRef<HTMLDivElement>(null);

  // Sidebar collapse persists across reloads, like the theme choice.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return window.localStorage.getItem(COLLAPSE_KEY) === "true"; } catch { return false; }
  });
  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { window.localStorage.setItem(COLLAPSE_KEY, String(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setLastSync("just now");
      notify.success("Dashboard refreshed");
    }, 1500);
  };

  const onLogout = () => {
    logout();
    notify.success("Signed out");
    navigate("/login", { replace: true });
  };

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => { setMobileNavOpen(false); }, [loc.pathname]);

  const displayName = user?.name ?? "Dr. Sarah Chen";
  const initials = displayName.split(" ").filter(Boolean).map(p => p[0]).slice(0, 2).join("").toUpperCase();
  const pageTitle = PAGE_TITLES[loc.pathname] || "MedGuard";

  return (
    <div className="flex h-screen overflow-hidden bg-page text-primary">
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-shrink-0 flex-col border-r border-muted bg-container",
          "transition-[width,transform] duration-200 lg:static lg:translate-x-0",
          collapsed ? "w-[76px]" : "w-[240px]",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("border-b border-muted py-4", collapsed ? "px-3" : "px-5")}>
          {collapsed ? (
            <img src={wayamMark} alt="Wayam AI" className="mx-auto h-9 w-9 object-contain" />
          ) : (
            <div className="flex items-center gap-2">
              <img src={theme === "dark" ? wayamLogoDark : wayamLogoLight} alt="Wayam AI" className="h-24 object-contain" />
              <div className="border-l border-muted pl-2">
                <div className="text-heading-md leading-none text-primary">MedGuard</div>
                <div className="mt-0.5 text-caption text-tertiary">Meridian Health</div>
              </div>
            </div>
          )}
        </div>

        <nav className={cn("flex-1 overflow-y-auto overflow-x-hidden py-3", collapsed ? "px-2" : "px-2")}>
          {NAV.map(item => (
            <SidebarItem
              key={item.to}
              item={item.to === "/threats" ? { ...item, badge: openThreatBadge } : item}
              collapsed={collapsed}
            />
          ))}
        </nav>

        <div className={cn("space-y-2.5 border-t border-muted", collapsed ? "p-2" : "p-3")}>
          {/* Collapse control sits with the other utility actions. */}
          <div className={cn("flex", collapsed ? "justify-center" : "justify-end")}>
            <IconButton
              icon={collapsed ? "expand" : "collapse"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              size="sm"
              onClick={toggleCollapsed}
            />
          </div>

          {!collapsed && <Badge tone="success" className="w-full justify-center">HIPAA Compliant</Badge>}

          <div className={cn("flex items-center gap-2 border-t border-muted pt-2", collapsed && "flex-col gap-2")}>
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-action-primary text-label-sm text-on-color"
              title={collapsed ? `${displayName} · ${user?.email ?? "Chief Compliance Officer"}` : undefined}
            >
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-label-md text-primary">{displayName}</div>
                <div className="truncate text-caption text-tertiary">{user?.email ?? "Chief Compliance Officer"}</div>
              </div>
            )}
            <IconButton icon="logout" aria-label="Log out" title="Log out" size="sm" onClick={onLogout} />
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOPBAR */}
        <header className="flex h-14 items-center gap-3 border-b border-muted bg-container px-3 sm:gap-4 sm:px-5">
          <IconButton
            icon="menu"
            aria-label="Open navigation menu"
            size="sm"
            className="-ml-1 flex-shrink-0 lg:hidden"
            onClick={() => setMobileNavOpen(true)}
          />

          {/* Breadcrumb + page title */}
          <div className="hidden min-w-0 sm:block">
            <div className="flex items-center gap-1.5 text-caption text-quaternary">
              <AppIcon name="home" size="xs" />
              <span>/</span>
              <span className="truncate text-tertiary">{pageTitle}</span>
            </div>
            <h1 className="truncate font-display text-display-page text-primary">{pageTitle}</h1>
          </div>

          <div className="relative max-w-md flex-1" ref={searchRef}>
            <AppIcon name="search" size="md" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-icon-quaternary" />
            <input
              onFocus={() => setSearchOpen(true)}
              placeholder="Search patients, alerts, policies..."
              aria-label="Search"
              className="w-full rounded-md border border-default bg-action py-1.5 pl-9 pr-3 text-body-md text-primary placeholder:text-quaternary transition-colors duration-200 focus:border-active focus:outline-none"
            />
            {searchOpen && (
              <div className="fade-in absolute top-full z-30 mt-1 w-full overflow-hidden rounded-md border border-default bg-raised shadow-panel">
                {[
                  { label: "Alert #A-2847", desc: "Bulk Export, Billing", to: "/threats" },
                  { label: "Policy: PHI Retention", desc: "Data Privacy", to: "/policy" },
                  { label: "User: james.wilson", desc: "Billing Analyst", to: "/access" },
                  { label: "Risk R-003", desc: "Clinical AI Bias", to: "/risks" },
                ].map(r => (
                  <button
                    key={r.label}
                    onClick={() => { setSearchOpen(false); navigate(r.to); }}
                    className="w-full border-b border-muted px-3 py-2 text-left transition-colors duration-200 last:border-0 hover:bg-action"
                  >
                    <div className="text-body-md text-primary">{r.label}</div>
                    <div className="text-caption text-tertiary">{r.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Live monitoring status. Belongs with the other live/system state in
              the header rather than buried at the bottom of the sidebar. */}
          <div
            className="hidden items-center gap-2 rounded-full border border-default bg-action px-2.5 py-1 md:flex"
            title="Live monitoring active"
          >
            <span className="relative flex h-2 w-2">
              <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-feedback-success-icon" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-feedback-success-icon" />
            </span>
            <span className="whitespace-nowrap text-caption text-secondary">Live Monitoring</span>
          </div>

          <span className="tabular hidden whitespace-nowrap text-caption text-quaternary lg:inline">Last sync: {lastSync}</span>

          <ThemeToggle />

          <IconButton icon="refresh" aria-label="Refresh dashboard" title="Refresh" size="sm" spin={refreshing} onClick={onRefresh} />

          <div className="relative">
            <IconButton icon="notification" aria-label={`Notifications (${unreadCount} unread)`} size="sm" onClick={() => setNotifOpen(true)} />
            {unreadCount > 0 && (
              <span className="tabular pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-severity-critical px-1 text-caption font-semibold text-white">
                {unreadCount}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-page p-3 sm:p-5">{children}</main>
      </div>

      <SlideOver
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        width={380}
        title={
          <div className="flex w-full items-center justify-between pr-8">
            <span>Notifications ({unreadCount})</span>
            <button onClick={markAllNotifRead} className="ml-3 text-label-sm text-brand hover:underline">Mark all read</button>
          </div>
        }
        footer={
          <Btn variant="inverse" className="w-full" onClick={() => { setNotifOpen(false); navigate("/audit"); }}>
            View all notifications
          </Btn>
        }
      >
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`rounded-md border-l-2 bg-raised p-3 ${SEV_STROKE[n.sev] ?? "border-severity-info"} ${n.read ? "opacity-50" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <SeverityBadge sev={n.sev} />
                <span className="tabular text-caption text-quaternary">{n.time}</span>
              </div>
              <div className="text-label-md text-primary">{n.title}</div>
              <div className="mt-0.5 text-caption text-tertiary">{n.desc}</div>
              <button
                onClick={() => { markNotifRead(n.id); setNotifOpen(false); navigate(n.page); }}
                className="mt-1.5 text-caption text-brand hover:underline"
              >
                View
              </button>
            </div>
          ))}
        </div>
      </SlideOver>
    </div>
  );
}
