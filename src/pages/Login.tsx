import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AppIcon } from "@/components/AppIcon";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import wayamLogoLight from "@/assets/brand/wayam-logo-light.svg";
import wayamLogoDark from "@/assets/brand/wayam-logo-dark.svg";

export default function Login() {
  const { isAuthenticated, isInitializing, login } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img
            src={theme === "dark" ? wayamLogoDark : wayamLogoLight}
            alt="Wayam AI"
            className="h-32 object-contain mb-6"
          />
          <h1 className="font-display text-display-page text-primary tracking-tight">Sign in to MedGuard</h1>
          <p className="text-body-md text-tertiary mt-1 text-center">
            Healthcare governance and compliance for Meridian Health
          </p>
        </div>

        <div className="bg-raised border border-default rounded-xl shadow-sm p-6 sm:p-8">
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
            <span>Sign in with your MedGuard account. Credentials are verified by the API.</span>
          </div>
        </div>

        <p className="text-center text-body-sm text-tertiary mt-6">
          Wayam AI Governance Suite · Demo Environment
        </p>
      </div>
    </div>
  );
}
