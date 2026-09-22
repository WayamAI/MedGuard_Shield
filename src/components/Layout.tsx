import { useLocation, useNavigate } from "react-router-dom";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { Badge, Btn, EmptyState, SlideOver } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { IconButton } from "@/components/IconButton";
import { SidebarItem, type SidebarNavItem } from "@/components/SidebarItem";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DomainIcon } from "@/components/DomainIcon";
import { RiskBadge } from "@/components/ui-patterns";
import drishtiLogoLight from "@/assets/brand/drishti-logo-light.svg";
import drishtiLogoDark from "@/assets/brand/drishti-logo-dark.svg";
import drishtiMark from "@/assets/brand/drishti-mark.svg";
import { notify } from "@/lib/notify";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { useThreats } from "@/hooks/useThreats";
import { useGlobalSearch, ENTITY_LABEL } from "@/hooks/useGlobalSearch";
import { cn } from "@/lib/utils";

/**
 * Navigation, grouped by what the user is trying to do.
 *
 * Every destination here is backed by a live endpoint. Capabilities without a
 * backend — Controls, Policies, Audit, Remediation, Users, Settings — are
 * deliberately absent rather than present-and-inert: a nav item that opens an
 * empty screen is a promise the product does not keep. Their API contracts are
 * specified in FRONTEND_API_CONTRACT.md, and the items appear here the day
 * those land.
 */
type NavGroup = { label: string; items: SidebarNavItem[] };

const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: "dashboard", end: true }],
  },
  {
    label: "Discover",
    items: [
      { to: "/assets", label: "Assets", icon: "database" },
      { to: "/phi-flow", label: "PHI Flow", icon: "phiFlow" },
      { to: "/access", label: "Access & Identity", icon: "access" },
      { to: "/vendors", label: "Vendors", icon: "facility" },
      // Badge is filled in at render from the live threat count.
      { to: "/threats", label: "Threats", icon: "threats", badgeTone: "danger" },
    ],
  },
  {
    label: "Risk",
    items: [{ to: "/risks", label: "Risk Register", icon: "risks" }],
  },
  {
    label: "Operations",
    items: [{ to: "/import", label: "Data Import", icon: "upload", requireRole: ["ADMIN"] }],
  },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Governance Overview",
  "/assets": "Asset Inventory",
  "/phi-flow": "PHI Data Flow Map",
  "/access": "Access & Identity Review",
  "/vendors": "Vendor Risk",
  "/threats": "Threat & Anomaly Detection",
  "/risks": "Risk Register",
  "/import": "Data Import",
};

const COLLAPSE_KEY = "drishti-sidebar-collapsed";

export default function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  /*
   * The threat count is read off the same /api/threats query the Threats page
   * uses — same key, so this shares its cache and its poll rather than adding
   * a second request. Undefined while loading or unreachable, which hides the
   * badge: no number at all beats a stale or invented one.
   */
  const openThreats = useThreats().data?.summary.open;
  const openThreatBadge = openThreats ? String(openThreats) : undefined;

  /* Hide what the router would bounce them from. The API is the real gate. */
  const visibleNav = NAV
    .map(g => ({
      ...g,
      items: g.items.filter(i => !i.requireRole || i.requireRole.includes(user?.role ?? "")),
    }))
    .filter(g => g.items.length > 0);

  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const search = useGlobalSearch(searchTerm, searchOpen);

  /*
   * A real refresh: invalidate every cached query and let the hooks refetch.
   * This used to be a 1.5s timer followed by "Dashboard refreshed" — a button
   * that asserted freshness it had done nothing to obtain.
   */
  const inFlight = useIsFetching();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const onLogout = () => {
    logout();
    notify.success("Signed out");
    navigate("/login", { replace: true });
  };

  // Sidebar collapse persists across reloads, like the theme choice.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const stored =
        window.localStorage.getItem(COLLAPSE_KEY) ??
        window.localStorage.getItem("medguard-sidebar-collapsed"); // pre-Drishti
      return stored === "true";
    } catch { return false; }
  });
  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { window.localStorage.setItem(COLLAPSE_KEY, String(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  /* Close the palette on outside click, and open it on Cmd/Ctrl-K. */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => { setActiveIndex(0); }, [search.query]);

  const goTo = useCallback((to: string) => {
    setSearchOpen(false);
    setSearchTerm("");
    navigate(to);
  }, [navigate]);

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!search.flat.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => (i + 1) % search.flat.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => (i - 1 + search.flat.length) % search.flat.length); }
    else if (e.key === "Enter") { e.preventDefault(); goTo(search.flat[activeIndex].to); }
  };

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => { setMobileNavOpen(false); }, [loc.pathname]);

  const displayName = user?.name ?? "Signed in";
  const initials = displayName.split(" ").filter(Boolean).map(p => p[0]).slice(0, 2).join("").toUpperCase();
  const pageTitle = PAGE_TITLES[loc.pathname] ?? "Drishti";

  return (
    <div className="flex h-screen overflow-hidden bg-page text-primary">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-action-primary focus:px-3 focus:py-2 focus:text-on-color"
      >
        Skip to content
      </a>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside
        aria-label="Main navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-shrink-0 flex-col border-r border-muted bg-container",
          "transition-[width,transform] duration-200 lg:static lg:translate-x-0",
          collapsed ? "w-[72px]" : "w-[236px]",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("flex h-14 items-center border-b border-muted", collapsed ? "justify-center px-2" : "px-4")}>
          {collapsed ? (
            <img src={drishtiMark} alt="Drishti" className="h-7 w-7 object-contain" />
          ) : (
            <img
              src={theme === "dark" ? drishtiLogoDark : drishtiLogoLight}
              alt="Drishti"
              className="h-7 object-contain"
            />
          )}
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
          {visibleNav.map(group => (
            <div key={group.label} className="mb-3 last:mb-0">
              {!collapsed && (
                <div className="mb-1 px-2 text-caption font-semibold uppercase tracking-wider text-quaternary">
                  {group.label}
                </div>
              )}
              {group.items.map(item => (
                <SidebarItem
                  key={item.to}
                  item={item.to === "/threats" ? { ...item, badge: openThreatBadge } : item}
                  collapsed={collapsed}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className={cn("space-y-2.5 border-t border-muted", collapsed ? "p-2" : "p-3")}>
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
              title={collapsed ? `${displayName} · ${user?.email ?? ""}` : undefined}
            >
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-label-md text-primary">{displayName}</div>
                <div className="truncate text-caption text-tertiary">{user?.email ?? ""}</div>
              </div>
            )}
            <IconButton icon="logout" aria-label="Log out" title="Log out" size="sm" onClick={onLogout} />
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-muted bg-container px-3 sm:gap-4 sm:px-5">
          <IconButton
            icon="menu"
            aria-label="Open navigation menu"
            size="sm"
            className="-ml-1 flex-shrink-0 lg:hidden"
            onClick={() => setMobileNavOpen(true)}
          />

          <div className="hidden min-w-0 sm:block">
            <div className="flex items-center gap-1.5 text-caption text-quaternary">
              <AppIcon name="home" size="xs" />
              <span>/</span>
              <span className="truncate text-tertiary">{pageTitle}</span>
            </div>
            <h1 className="truncate font-display text-display-page text-primary">{pageTitle}</h1>
          </div>

          {/* GLOBAL SEARCH — real results over the live API */}
          <div className="relative max-w-md flex-1" ref={searchRef}>
            <AppIcon name="search" size="md" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-icon-quaternary" />
            <input
              ref={searchInputRef}
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search assets, vendors, risks, threats…"
              aria-label="Search Drishti"
              role="combobox"
              aria-expanded={searchOpen}
              aria-controls="global-search-results"
              aria-autocomplete="list"
              className="w-full rounded-md border border-default bg-action py-1.5 pl-9 pr-12 text-body-md text-primary placeholder:text-quaternary transition-colors duration-200 focus:border-active focus:outline-none"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-default px-1.5 py-0.5 text-caption text-quaternary md:block">
              ⌘K
            </kbd>

            {searchOpen && (
              <div
                id="global-search-results"
                role="listbox"
                aria-label="Search results"
                className="fade-in absolute top-full z-30 mt-1 max-h-[420px] w-full overflow-y-auto rounded-md border border-default bg-raised shadow-panel"
              >
                {!search.active ? (
                  <p className="px-3 py-3 text-body-sm text-tertiary">
                    Type at least two characters to search assets, vendors, risks, threats and identities.
                  </p>
                ) : search.isLoading ? (
                  <p className="px-3 py-3 text-body-sm text-tertiary">Searching…</p>
                ) : search.flat.length === 0 ? (
                  <p className="px-3 py-3 text-body-sm text-tertiary">No matches for “{search.query}”.</p>
                ) : (
                  search.grouped.map(group => (
                    <div key={group.entity}>
                      <div className="sticky top-0 bg-raised-2 px-3 py-1 text-caption font-semibold uppercase tracking-wider text-quaternary">
                        {ENTITY_LABEL[group.entity]}
                      </div>
                      {group.items.map(r => {
                        const idx = search.flat.findIndex(f => f.id === r.id);
                        const active = idx === activeIndex;
                        return (
                          <button
                            key={r.id}
                            role="option"
                            aria-selected={active}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => goTo(r.to)}
                            className={cn(
                              "flex w-full items-center gap-2.5 border-b border-muted px-3 py-2 text-left transition-colors last:border-0",
                              active ? "bg-action" : "hover:bg-action",
                            )}
                          >
                            <DomainIcon name={r.icon} size={16} className="shrink-0 text-icon-tertiary" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-body-md text-primary">{r.title}</span>
                              <span className="block truncate text-caption text-tertiary">{r.context}</span>
                            </span>
                            {r.band !== undefined && <RiskBadge band={r.band ?? null} />}
                            {r.status && <Badge tone="muted">{r.status}</Badge>}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div
            className="hidden items-center gap-2 rounded-full border border-default bg-action px-2.5 py-1 md:flex"
            title={inFlight > 0 ? "Fetching live data" : "Polling the API"}
          >
            <span className="relative flex h-2 w-2">
              <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-feedback-success-icon" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-feedback-success-icon" />
            </span>
            <span className="whitespace-nowrap text-caption text-secondary">Live</span>
          </div>

          <ThemeToggle />

          <IconButton
            icon="refresh"
            aria-label="Refresh all data"
            title="Refresh all data"
            size="sm"
            spin={refreshing || inFlight > 0}
            onClick={() => void onRefresh()}
          />

          <IconButton
            icon="notification"
            aria-label="Notifications"
            size="sm"
            onClick={() => setNotifOpen(true)}
          />
        </header>

        <main id="main" className="flex-1 overflow-y-auto overflow-x-hidden bg-page p-3 sm:p-5">
          {children}
        </main>
      </div>

      {/*
        Notifications have no backend. Rather than a fabricated feed with an
        invented unread count, this says so. The contract for a real event
        stream is in FRONTEND_API_CONTRACT.md.
      */}
      <SlideOver open={notifOpen} onClose={() => setNotifOpen(false)} width={380} title="Notifications">
        <EmptyState
          icon="notification"
          title="No notifications"
          message="Drishti will surface new threats, risk-band changes and failed imports here once the events API is connected."
          height={320}
        />
        <div className="mt-2 flex justify-center">
          <Btn variant="outline" onClick={() => { setNotifOpen(false); navigate("/threats"); }}>
            View open threats
          </Btn>
        </div>
      </SlideOver>
    </div>
  );
}
