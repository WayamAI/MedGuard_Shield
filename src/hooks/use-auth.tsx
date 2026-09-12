import * as React from "react";
import { api, ApiError, setAuthTokenGetter } from "@/lib/apiClient";
import { setHadSession } from "@/lib/sessionBreadcrumb";

/**
 * Session management against the MedGuard API, bearer-token flow.
 *
 * The token is held in memory only — a ref inside this provider. It is never
 * written to localStorage or sessionStorage, so an XSS payload that can read
 * browser storage finds nothing, and closing or reloading the tab ends the
 * session. The cost is that a reload requires signing in again; see
 * "Reload behaviour" below for why that is the right trade here.
 *
 * Reload behaviour: the API exposes /api/auth/login, /logout and /me and has
 * no refresh-token endpoint, so there is nothing to silently re-authenticate
 * against. Rather than fake it, a reload lands on a clean logged-out state and
 * ProtectedRoute redirects to /login — never an authenticated-looking shell
 * with no valid token behind it.
 *
 * The public shape of this hook (user / isAuthenticated / isInitializing /
 * login / logout) is unchanged from the demo implementation it replaced, so
 * ProtectedRoute and every consumer are untouched.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthUser = {
  email: string;
  name: string;
  id?: number;
  role?: string;
};

/** POST /api/auth/login -> { data: { token, expiresIn, user } }. */
type LoginResponse = {
  token: string;
  expiresIn: number;
  user: { id: number; email: string; role: string };
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

const toAuthUser = (u: LoginResponse["user"]): AuthUser => ({
  email: u.email,
  name: deriveName(u.email),
  id: u.id,
  role: u.role,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);

  /**
   * The live bearer token. A ref rather than state because apiClient needs to
   * read it synchronously from any call site, and because the token changing
   * should not by itself re-render the tree — `user` already does that.
   */
  const tokenRef = React.useRef<string | null>(null);

  /**
   * Registered during render, not in an effect: a child could fire a request
   * on its first render, which happens before effects run.
   */
  if (tokenRef.current === null) {
    setAuthTokenGetter(() => tokenRef.current);
  }
  React.useEffect(() => {
    setAuthTokenGetter(() => tokenRef.current);
    return () => setAuthTokenGetter(null);
  }, []);

  /**
   * Nothing is persisted, so there is nothing to restore and no async probe to
   * wait on. Kept in the interface because ProtectedRoute and Login both read
   * it, and because a future refresh-token flow would make it meaningful again.
   */
  const isInitializing = false;

  const login = React.useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim();

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      return { ok: false as const, error: "Enter a valid email address." };
    }
    if (password.length === 0) {
      return { ok: false as const, error: "Password is required." };
    }

    try {
      const result = await api.post<LoginResponse>("/api/auth/login", {
        email: trimmedEmail,
        password,
      });
      if (!result?.token) {
        return { ok: false as const, error: "Sign-in failed: no token returned." };
      }
      tokenRef.current = result.token;
      // Breadcrumb only - never the token. Lets the login page explain itself
      // after a reload instead of showing a bare form.
      setHadSession(true);
      setUser(toAuthUser(result.user));
      return { ok: true as const };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isAuthError) return { ok: false as const, error: "Invalid email or password." };
        if (err.isNetworkError) {
          return { ok: false as const, error: "Can't reach the server. Check that the API is running." };
        }
        return { ok: false as const, error: `Sign-in failed (${err.status}). Please try again.` };
      }
      return { ok: false as const, error: "Sign-in failed. Please try again." };
    }
  }, []);

  const logout = React.useCallback(() => {
    // Drop the token first: the session must end even if the API is down.
    tokenRef.current = null;
    setHadSession(false);   // chose to leave; not a lost session
    setUser(null);
    void api.post("/api/auth/logout").catch(() => {});
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
