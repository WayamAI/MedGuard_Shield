import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export const Card = ({ className = "", children }: { className?: string; children: ReactNode }) => (
  <div className={`bg-card border border-border rounded-lg ${className}`}>{children}</div>
);

export const Badge = ({ tone = "muted", children, className = "" }: { tone?: "success" | "warning" | "danger" | "info" | "muted"; children: ReactNode; className?: string }) => {
  const map: Record<string, string> = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    danger: "bg-red-500/10 text-red-400 border-red-500/30",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    muted: "bg-secondary text-muted-foreground border-border",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${map[tone]} ${className}`}>{children}</span>;
};

export const SeverityBadge = ({ sev }: { sev: string }) => {
  const map: Record<string, "danger" | "warning" | "info"> = {
    CRITICAL: "danger", HIGH: "warning", MEDIUM: "warning", LOW: "info", INFO: "info",
  };
  return <Badge tone={map[sev] || "muted"}>{sev}</Badge>;
};

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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => dismissOnBackdrop && onClose()} />
      <div className={`relative bg-card border border-border rounded-lg shadow-2xl w-full ${w} max-h-[88vh] flex flex-col fade-in`}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-secondary">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function SlideOver({ open, onClose, title, children, width = 440 }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; width?: number }) {
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
      <div className="absolute right-0 top-0 h-full bg-card border-l border-border shadow-2xl flex flex-col slide-in-right" style={{ width }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-secondary">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">{children}</div>
      </div>
    </div>
  );
}

export const Btn = ({ variant = "default", className = "", children, ...rest }: { variant?: "default" | "primary" | "danger" | "success" | "ghost" | "outline" | "warning" } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const map: Record<string, string> = {
    default: "bg-secondary hover:bg-accent text-foreground border border-border",
    primary: "bg-primary hover:bg-primary/90 text-primary-foreground",
    danger: "bg-red-600 hover:bg-red-500 text-white",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white",
    warning: "bg-amber-600 hover:bg-amber-500 text-white",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-secondary",
    outline: "border border-border text-foreground hover:bg-secondary",
  };
  return <button className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${map[variant]} ${className}`} {...rest}>{children}</button>;
};

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`bg-secondary border border-border rounded text-sm px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary ${props.className || ""}`} />
);

export const Select = ({ children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...rest} className={`bg-secondary border border-border rounded text-sm px-3 py-1.5 text-foreground focus:outline-none focus:border-primary ${rest.className || ""}`}>
    {children}
  </select>
);

export const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={`bg-secondary border border-border rounded text-sm px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-full ${props.className || ""}`} />
);

export const Gauge = ({ value, size = 120, color = "#3B82F6", label }: { value: number; size?: number; color?: string; label?: string }) => {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-foreground">{value}%</span>
        {label && <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>}
      </div>
    </div>
  );
};

export const KPI = ({ icon, label, value, trend, accent = "info", onClick }: { icon: ReactNode; label: string; value: string; trend?: string; accent?: "success" | "warning" | "danger" | "info"; onClick?: () => void }) => {
  const borderMap: Record<string, string> = {
    success: "border-t-emerald-500",
    warning: "border-t-amber-500",
    danger: "border-t-red-500",
    info: "border-t-blue-500",
  };
  return (
    <Card className={`p-4 border-t-2 ${borderMap[accent]} ${onClick ? "cursor-pointer hover:border-primary/50 transition-colors" : ""}`}>
      <div onClick={onClick}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-muted-foreground">{icon}</div>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {trend && <div className="text-[11px] text-muted-foreground mt-1">{trend}</div>}
      </div>
    </Card>
  );
};

export const SectionHeader = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) => (
  <div className="flex items-end justify-between mb-3">
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);
