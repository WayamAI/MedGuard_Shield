import { createContext, useContext, useMemo, useState, ReactNode, useCallback } from "react";
import { alerts as initAlerts, approvals as initApprovals, initialNotifications } from "@/data/mock";

type AlertItem = (typeof initAlerts)[number];
type Approval = (typeof initApprovals)[number] & { status?: string };
type Notif = (typeof initialNotifications)[number] & { read?: boolean };

type Ctx = {
  alerts: AlertItem[];
  resolveAlert: (id: string, notes?: string) => void;
  addAlert: (a: AlertItem) => void;
  suspendedUsers: Set<number>;
  toggleSuspend: (id: number) => void;
  approvals: Approval[];
  setApprovalStatus: (id: number, status: string) => void;
  notifications: Notif[];
  markNotifRead: (id: number) => void;
  markAllNotifRead: () => void;
  unreadCount: number;
  aiPaused: boolean;
  setAiPaused: (b: boolean) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export const AppStoreProvider = ({ children }: { children: ReactNode }) => {
  const [alerts, setAlerts] = useState<AlertItem[]>(initAlerts);
  const [suspendedUsers, setSuspended] = useState<Set<number>>(new Set());
  const [approvals, setApprovals] = useState<Approval[]>(initApprovals);
  const [notifications, setNotifications] = useState<Notif[]>(initialNotifications);
  const [aiPaused, setAiPaused] = useState(false);

  const resolveAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: "Resolved" } : a));
  }, []);
  const addAlert = useCallback((a: AlertItem) => setAlerts(prev => [a, ...prev]), []);
  const toggleSuspend = useCallback((id: number) => {
    setSuspended(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);
  const setApprovalStatus = useCallback((id: number, status: string) => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  }, []);
  const markNotifRead = useCallback((id: number) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)), []);
  const markAllNotifRead = useCallback(() => setNotifications(prev => prev.map(n => ({ ...n, read: true }))), []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const value = useMemo(() => ({
    alerts, resolveAlert, addAlert,
    suspendedUsers, toggleSuspend,
    approvals, setApprovalStatus,
    notifications, markNotifRead, markAllNotifRead, unreadCount,
    aiPaused, setAiPaused,
  }), [alerts, resolveAlert, addAlert, suspendedUsers, toggleSuspend, approvals, setApprovalStatus, notifications, markNotifRead, markAllNotifRead, unreadCount, aiPaused]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
};

export const useStore = () => {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useStore must be used within AppStoreProvider");
  return ctx;
};
