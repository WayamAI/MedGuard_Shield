import * as React from "react";

/**
 * Demo authentication layer.
 *
 * This app has no real backend, so this provider simulates one: any
 * syntactically valid email plus any non-empty password is accepted.
 * The session is kept in localStorage so a browser refresh preserves it,
 * and cleared entirely on logout.
 *
 * Swapping this for a real auth provider later only means changing the
 * body of `login`/`logout` below — every consumer just calls `useAuth()`.
 */

const SESSION_STORAGE_KEY = "medguard-auth-session";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthUser = {
  email: string;
  name: string;
};

type Session = {
  user: AuthUser;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

function deriveName(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const words = localPart.split(/[._-]+/).filter(Boolean);
  if (words.length === 0) return "Demo User";
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.user?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = React.useState(true);

  React.useEffect(() => {
    const session = readSession();
    setUser(session?.user ?? null);
    setIsInitializing(false);
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim();

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      return { ok: false as const, error: "Enter a valid email address." };
    }
    if (password.length === 0) {
      return { ok: false as const, error: "Password is required." };
    }

    // Simulate network latency for a realistic loading state.
    await new Promise(resolve => setTimeout(resolve, 500));

    const authUser: AuthUser = { email: trimmedEmail, name: deriveName(trimmedEmail) };
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ user: authUser } satisfies Session));
    setUser(authUser);
    return { ok: true as const };
  }, []);

  const logout = React.useCallback(() => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setUser(null);
  }, []);

  const value = React.useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: user !== null,
    isInitializing,
    login,
    logout,
  }), [user, isInitializing, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
