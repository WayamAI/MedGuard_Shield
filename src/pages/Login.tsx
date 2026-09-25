import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AppIcon } from "@/components/AppIcon";
import { useAuth } from "@/hooks/use-auth";
import { hadSession } from "@/lib/sessionBreadcrumb";
import { useTheme } from "@/hooks/use-theme";
import drishtiLogoLight from "@/assets/brand/drishti-logo-light.svg";
import drishtiLogoDark from "@/assets/brand/drishti-logo-dark.svg";
import { LOGIN_BACKDROP } from "@/lib/icons3d";

export default function Login() {
  const { isAuthenticated, isInitializing, isRecovering, login } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /*
   * Read once on mount: signing in clears the breadcrumb, and we do not want
   * the notice to vanish mid-typing. Shown only when a session existed in this
   * tab and is now gone - not after an explicit logout, and not on a first
   * visit, where it would be baffling.
   */
  const [hadOne] = useState(() => hadSession());

  /*
   * A breadcrumb says a session existed here; it does not say the session
   * ended. While a refresh is still being retried the server has not told us
   * anything of the sort — it was rate limited, or unreachable — so claiming
   * the session ended is a guess, and one that turns out wrong as soon as
   * the retry lands and puts the user straight back where they were.
   *
   * So: recovery wins while it is running, and the expiry notice waits until
   * the question has actually been answered.
   */
  const sessionEnded = hadOne && !isRecovering;

  if (!isInitializing && isAuthenticated) {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError("error" in result ? result.error : "Sign in failed");
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 py-10">
      {/*
       * The backdrop render, behind a scrim.
       *
       * It is a dark machine-room interior, so it cannot simply be dropped
       * behind a form that also ships a light theme. The scrim is what makes it
       * work in both: near-opaque over the light surface, where the image
       * survives as a faint ghost, and lighter over dark, where it can actually
       * be seen. Either way the card keeps its contrast, which is the only
       * thing on this page that has to be legible.
       *
       * Hidden below `sm`: on a phone the card fills the viewport and the
       * image would be 70 KB of pixels nobody sees.
       */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block">
        <img
          src={LOGIN_BACKDROP}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-[rgba(247,247,248,0.94)] dark:bg-[rgba(15,15,17,0.82)]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img
            src={theme === "dark" ? drishtiLogoDark : drishtiLogoLight}
            alt="Drishti"
            className="h-14 object-contain mb-7"
          />
          <h1 className="font-display text-display-page text-primary tracking-tight">Sign in to Drishti</h1>
          <p className="text-body-md text-tertiary mt-1 text-center">
            Healthcare PHI risk intelligence for Meridian Health
          </p>
        </div>

        <div className="bg-raised border border-default rounded-card p-6 sm:p-8">
          {isRecovering && !error && (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 flex items-start gap-2 rounded-md border border-default bg-raised-2 px-3 py-2.5 text-body-sm text-secondary"
            >
              <span
                aria-hidden
                className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent"
              />
              <span>Checking your session… you can sign in below if you prefer not to wait.</span>
            </div>
          )}

          {sessionEnded && !error && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2 rounded-md border border-feedback-info-stroke bg-feedback-info-background px-3 py-2.5 text-body-sm text-feedback-info"
            >
              <AppIcon name="info" size="sm" className="mt-0.5 flex-shrink-0 text-feedback-info-icon" />
              <span>Your session ended. Please sign in again to continue.</span>
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-label-md text-primary mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@meridian.org"
                className="w-full bg-action border border-default rounded-md px-3 py-2 text-body-md text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-label-md text-primary mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-action border border-default rounded-md px-3 py-2 pr-10 text-body-md text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tertiary hover:text-primary"
                >
                  {showPassword ? <AppIcon name="hidden" size="md" /> : <AppIcon name="visible" size="md" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-body-md text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-primary-foreground font-medium text-body-md rounded-md px-4 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="mt-5 flex items-start gap-2 text-body-sm text-tertiary bg-action/60 border border-default rounded-md px-3 py-2.5">
            <AppIcon name="compliance" size="sm" className="mt-0.5 flex-shrink-0 text-brand" />
            <span>Sign in with your Drishti account. Credentials are verified by the API.</span>
          </div>
        </div>

        <p className="text-center text-body-sm text-tertiary mt-6">
          Drishti by Wayam AI · Demo Environment
        </p>
      </div>
    </div>
  );
}
