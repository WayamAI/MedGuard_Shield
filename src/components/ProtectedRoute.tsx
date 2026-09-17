import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

/**
 * Route guard: signed in, and optionally holding one of a set of roles.
 *
 * `requireRole` extends the existing gate rather than adding a second one.
 * A separate AdminRoute would be a second thing to keep in step with this
 * one, and the failure mode of drift between two guards is a page that looks
 * protected and is not.
 *
 * A signed-in user without the role is sent to the dashboard, not to /login:
 * they are authenticated, so a login form would be a lie about what went
 * wrong. Nav hides what they cannot reach, so arriving here at all means a
 * typed URL or a stale link.
 *
 * This is a convenience, not the enforcement. The API gates these routes
 * itself — import is ADMIN-only server-side — and a client-side check is
 * only ever a way to avoid showing someone a door that will not open.
 */
export default function ProtectedRoute({
  children,
  requireRole,
}: {
  children: ReactNode;
  requireRole?: readonly string[];
}) {
  const { isAuthenticated, isInitializing, user } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requireRole && !requireRole.includes(user?.role ?? "")) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
