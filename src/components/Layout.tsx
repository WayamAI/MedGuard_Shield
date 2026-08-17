import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, GitBranch, Users, AlertTriangle, ClipboardList, Cpu, FileText, Shield, Bell, RefreshCw, Search, Menu } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useStore } from "@/store/AppStore";
import { Badge, Btn, SeverityBadge, SlideOver } from "@/components/ui-bits";
import { ThemeToggle } from "@/components/ThemeToggle";
import wayamLogoLight from "@/assets/brand/wayam-logo-light.svg";
import wayamLogoDark from "@/assets/brand/wayam-logo-dark.svg";
import { notify } from "@/lib/notify";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { LogOut } from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/phi-flow", label: "PHI Flow Map", icon: GitBranch },
  { to: "/access", label: "Access & Identity", icon: Users },
  { to: "/threats", label: "Threat Detection", icon: AlertTriangle, badge: "2", badgeTone: "red" as const },
  { to: "/policy", label: "Policy & Compliance", icon: ClipboardList },
  { to: "/ai", label: "AI Governance", icon: Cpu, badge: "1", badgeTone: "amber" as const },
  { to: "/audit", label: "Audit & Reports", icon: FileText },
  { to: "/risks", label: "Risk Register", icon: Shield },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Governance Overview",
  "/phi-flow": "PHI Data Flow Map",
  "/access": "Access & Identity Management",
  "/threats": "Threat & Anomaly Detection",
  "/policy": "Policy & Compliance Engine",
  "/ai": "AI Governance Monitor",
  "/audit": "Audit Trail & Reports",
  "/risks": "Risk Register",
};

export default function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const { unreadCount, notifications, markNotifRead, markAllNotifRead } = useStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState("2 mins ago");
  const searchRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}
      {/* SIDEBAR */}
      <aside
        className={`w-[240px] flex-shrink-0 bg-sidebar border-r border-border flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <img src={theme === "dark" ? wayamLogoDark : wayamLogoLight} alt="Wayam AI" className="h-7 object-contain" />
            <div className="pl-2 border-l border-border">
              <div className="text-base font-bold text-foreground tracking-tight leading-none">MedGuard</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Meridian Health</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-3 py-2 mb-0.5 text-sm rounded-md transition-colors ${
                    isActive
                      ? "bg-sidebar-active text-sidebar-active-foreground border-l-2 border-sidebar-active-foreground/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary border-l-2 border-transparent"
                  }`
                }
              >
                <Icon size={16} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${item.badgeTone === "red" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 pulse-dot" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] text-muted-foreground">Live Monitoring</span>
          </div>
          <Badge tone="success" className="w-full justify-center">HIPAA Compliant</Badge>

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {(user?.name ?? "Dr. Sarah Chen").split(" ").filter(Boolean).map(p => p[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium text-foreground truncate">{user?.name ?? "Dr. Sarah Chen"}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user?.email ?? "Chief Compliance Officer"}</div>
            </div>
            <button
              onClick={onLogout}
              title="Log out"
              aria-label="Log out"
              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOPBAR */}
        <header className="h-14 border-b border-border bg-card/40 px-3 sm:px-5 flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="p-1.5 -ml-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary lg:hidden flex-shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          <h1 className="text-lg font-bold text-foreground tracking-tight hidden sm:block truncate">{PAGE_TITLES[loc.pathname] || "MedGuard"}</h1>

          <div className="flex-1 max-w-md relative" ref={searchRef}>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              onFocus={() => setSearchOpen(true)}
              placeholder="Search patients, alerts, policies..."
              className="w-full bg-secondary border border-border rounded-md pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-primary"
            />
            {searchOpen && (
              <div className="absolute top-full mt-1 w-full bg-card border border-border rounded-md shadow-xl z-30 fade-in">
                {[
                  { label: "Alert #A-2847", desc: "Bulk Export — Billing", to: "/threats" },
                  { label: "Policy: PHI Retention", desc: "Data Privacy", to: "/policy" },
                  { label: "User: james.wilson", desc: "Billing Analyst", to: "/access" },
                  { label: "Risk R-003", desc: "Clinical AI Bias", to: "/risks" },
                ].map(r => (
                  <button key={r.label} onClick={() => { setSearchOpen(false); navigate(r.to); }} className="w-full text-left px-3 py-2 hover:bg-secondary border-b border-border last:border-0">
                    <div className="text-sm text-foreground">{r.label}</div>
                    <div className="text-[11px] text-muted-foreground">{r.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-[11px] text-muted-foreground hidden md:inline">Last sync: {lastSync}</span>

          <ThemeToggle />

          <button onClick={onRefresh} className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Refresh">
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>

          <button onClick={() => setNotifOpen(true)} className="relative p-2 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadCount}</span>
            )}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5">{children}</main>
      </div>

      <SlideOver open={notifOpen} onClose={() => setNotifOpen(false)} width={380} title={
        <div className="flex items-center justify-between w-full pr-8">
          <span>Notifications ({unreadCount})</span>
          <button onClick={markAllNotifRead} className="text-xs text-primary hover:underline ml-3">Mark all read</button>
        </div>
      }>
        <div className="space-y-2">
          {notifications.map(n => {
            const tone = n.sev === "CRITICAL" ? "border-red-500" : n.sev === "HIGH" ? "border-amber-500" : n.sev === "MEDIUM" ? "border-orange-400" : "border-blue-500";
            return (
              <div key={n.id} className={`p-3 bg-secondary/50 border-l-2 ${tone} rounded ${n.read ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <SeverityBadge sev={n.sev} />
                  <span className="text-[10px] text-muted-foreground">{n.time}</span>
                </div>
                <div className="text-sm font-medium text-foreground">{n.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{n.desc}</div>
                <button onClick={() => { markNotifRead(n.id); setNotifOpen(false); navigate(n.page); }} className="text-[11px] text-primary hover:underline mt-1.5">View →</button>
              </div>
            );
          })}
          <Btn variant="outline" className="w-full mt-3" onClick={() => { setNotifOpen(false); navigate("/audit"); }}>View all notifications</Btn>
        </div>
      </SlideOver>
    </div>
  );
}
