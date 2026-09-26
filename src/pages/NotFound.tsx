import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Drishti3DIcon } from "@/components/Drishti3DIcon";
import { AppIcon } from "@/components/AppIcon";

/**
 * The 404.
 *
 * Previously the scaffold's default: raw `text-4xl font-bold`, `bg-muted`, and
 * a bare anchor that dropped the SPA router and reloaded the whole app — which
 * on this product means losing the in-memory session token and landing on the
 * login screen. It now uses the app's own type scale, surfaces and Link.
 *
 * The mark is the radar scope sweeping an empty field: the route was searched
 * for and is not there. It is the only illustration on the page, so it gets
 * hero size, and it is eager — there is nothing else competing to load.
 */
const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="flex max-w-md flex-col items-center text-center">
        <Drishti3DIcon name="notFound" size="hero" priority />
        <h1 className="mt-6 font-display text-display-page text-primary">Page not found</h1>
        <p className="mt-2 text-body-md text-tertiary">
          Nothing is mapped to{" "}
          <code className="rounded bg-raised-2 px-1.5 py-0.5 text-body-sm text-secondary">
            {location.pathname}
          </code>
          . It may have moved, or the link may be out of date.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1.5 text-body-md text-brand transition-colors hover:text-brand-hover"
        >
          <AppIcon name="arrowLeft" size="sm" />
          Back to the overview
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
