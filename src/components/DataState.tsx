import type { ReactNode } from "react";
import { describeApiError } from "@/lib/apiErrors";
import type { ApiQueryResult } from "@/hooks/useApiQuery";
import type { IconName } from "@/lib/icons";
import type { Icon3DName } from "@/lib/icons3d";
import { AppIcon } from "@/components/AppIcon";
import { ChartSkeleton, ErrorState, EmptyState } from "@/components/ui-bits";

/**
 * The single place every backend-backed view resolves its non-happy paths.
 *
 * Four states, in priority order: first load (skeleton), hard failure with
 * nothing to show (error), success but nothing to draw (empty), and success.
 * A fifth sits on top of success: once data has been seen, a backend that
 * disappears must not blank the screen — the last good data stays, dimmed,
 * under a reconnecting notice.
 */

/** Slim, non-blocking notice: the view below it is stale but still readable. */
export const ReconnectingBanner = ({ onRetry }: { onRetry?: () => void }) => (
  <div
    role="status"
    className="mb-3 flex items-center gap-2 rounded-lg border border-feedback-warning-stroke bg-feedback-warning-background px-3 py-2 text-body-sm text-feedback-warning"
  >
    <AppIcon name="refresh" size="sm" spin className="text-feedback-warning-icon" />
    <span>Lost connection to the backend. Showing the last known data and retrying…</span>
    {onRetry && (
      <button type="button" onClick={onRetry} className="ml-auto underline underline-offset-2">
        Retry now
      </button>
    )}
  </div>
);

export type DataStateProps<T> = {
  query: ApiQueryResult<T>;
  children: (data: T) => ReactNode;
  /** Success with nothing worth drawing. Defaults to treating [] as empty. */
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  /**
   * The mark to show when there is nothing to draw.
   *
   * Defaults to the database glyph, which is right for an inventory and
   * wrong everywhere else — an empty Controls page showed a data cylinder
   * while the rest of the screen was built around its own domain mark. Pass
   * the page's own icon.
   */
  emptyIcon?: IconName;
  /**
   * The 3D render to show instead of the glyph, where one fits the page.
   *
   * Empty states are the surface with the most room and the least competing
   * content, so they carry the artwork. `emptyIcon` stays the fallback: if the
   * asset 404s the state still renders, just in line art.
   */
  emptyArt?: Icon3DName;
  /** Match the skeleton to the real content's height so nothing jumps. */
  height?: number;
  skeleton?: ReactNode;
};

const defaultIsEmpty = (data: unknown) =>
  Array.isArray(data)
    ? data.length === 0
    : !!data && typeof data === "object" && "nodes" in data
      ? (data as { nodes: unknown[] }).nodes.length === 0
      : data == null;

export function DataState<T>({
  query,
  children,
  isEmpty = defaultIsEmpty,
  emptyTitle = "No data yet",
  emptyMessage = "Nothing has been recorded for this view. If the backend was just set up, run the seed script.",
  emptyIcon = "database",
  emptyArt,
  height = 470,
  skeleton,
}: DataStateProps<T>) {
  const { data, isLoading, isError, isReconnecting, isFetching, error, refresh } = query;

  // First load: hold the space rather than flashing an empty container.
  if (isLoading || (data === undefined && isFetching)) {
    return <>{skeleton ?? <ChartSkeleton height={height} />}</>;
  }

  /*
   * An expired session outranks whatever is cached. Showing the last known
   * rows under a reconnecting banner would be wrong twice: the problem is not
   * the connection, and the banner promises retrying when useApiQuery
   * deliberately stops polling on auth errors. Nothing here will refresh
   * until the person signs in again, so say that instead.
   */
  if (error?.isAuthError) {
    const { title, message } = describeApiError(error);
    return <ErrorState title={title} message={message} height={height} art="sessionExpired" />;
  }

  // Failed with nothing cached to fall back on.
  if (isError && data === undefined) {
    const { title, message } = describeApiError(error);
    return <ErrorState title={title} message={message} onRetry={() => refresh()} isRetrying={isFetching} height={height} />;
  }

  if (data === undefined) {
    return <>{skeleton ?? <ChartSkeleton height={height} />}</>;
  }

  if (isEmpty(data)) {
    return (
      <EmptyState
        icon={emptyIcon}
        art={emptyArt}
        title={emptyTitle}
        message={emptyMessage}
        height={height}
      />
    );
  }

  // Success — possibly stale, if the backend vanished after we loaded.
  return (
    <>
      {isReconnecting && <ReconnectingBanner onRetry={() => refresh()} />}
      <div className={isReconnecting ? "opacity-60 transition-opacity" : undefined}>
        {children(data)}
      </div>
    </>
  );
}
