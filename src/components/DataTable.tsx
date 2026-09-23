import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/AppIcon";
import { IconButton } from "@/components/IconButton";
import { Btn, Input, EmptyState } from "@/components/ui-bits";
import { DataState } from "@/components/DataState";
import type { ApiQueryResult, ApiListResult } from "@/hooks/useApiQuery";
import type { PageMeta } from "@/lib/apiClient";

/**
 * The one table in Drishti.
 *
 * Every list view — assets, vendors, access grants, threats, risks — is the
 * same interaction with different columns, so it is the same component. Built
 * once here rather than five times: a fix to sorting, keyboard handling or the
 * empty state lands everywhere at once.
 *
 * Non-happy paths are delegated to <DataState>, which already owns the
 * loading/auth/error/empty/stale vocabulary for backend-backed views. Passing
 * `query` opts into that; passing plain `rows` is for data already in hand.
 */

export type Column<T> = {
  /** Stable key — also the column-visibility identity. */
  id: string;
  header: string;
  /** Cell content. */
  cell: (row: T) => ReactNode;
  /**
   * Makes the column sortable. Return null to sort a row last regardless of
   * direction — "not scored" is not the same as "scores zero".
   */
  sortValue?: (row: T) => string | number | null;
  /** Free-text search haystack for this column. */
  searchValue?: (row: T) => string;
  align?: "left" | "right";
  /** Tailwind width utility, e.g. "w-40". */
  width?: string;
  /** Hidden until switched on in the column menu. */
  defaultHidden?: boolean;
  /** Drop below this breakpoint so narrow screens keep the key columns. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
};

/**
 * Narrow a query's rows without destroying its non-happy states.
 *
 * The trap: pages derive `filtered` from `data ?? []`, so spreading
 * `{...query, data: filtered}` hands DataState an empty array while the query
 * is still loading or has errored — and an empty array is a *successful*
 * result. The skeleton and the error state both vanish, replaced by "nothing
 * here", which is a different and wrong claim. Undefined must stay undefined.
 */
export function withRows<T>(query: ApiQueryResult<T[]>, rows: T[]): ApiQueryResult<T[]> {
  return { ...query, data: query.data === undefined ? undefined : rows };
}

/**
 * Adapt a paginated list result to the shape DataState expects.
 *
 * DataState owns the loading/auth/error/empty vocabulary and is keyed off
 * ApiQueryResult; ApiListResult is the same thing plus `meta` and minus
 * `refetch`. Rather than fork DataState, adapt here.
 */
export function listAsQuery<T>(list: ApiListResult<T>): ApiQueryResult<T[]> {
  return { ...list, refetch: (() => Promise.resolve(undefined)) as never };
}

/**
 * Server-side pagination.
 *
 * When present, the table stops slicing rows itself and renders the server's
 * own page controls. Critically it also disables the client search box: a
 * text filter applied to the 25 rows the server happened to send is not a
 * search of the dataset, and presenting it as one is the "only the first 25
 * records" failure wearing a different hat. Pages that want real search pass
 * `onSearch`, which sends the term to the API.
 */
export type ServerPagination = {
  meta: PageMeta | undefined;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange?: (pageSize: number) => void;
  /** Receives the debounced term; the page forwards it to the API. */
  onSearch?: (term: string) => void;
  /** Controlled value for the search box, when the page owns it. */
  searchValue?: string;
  /** True while a different page is in flight, for a subtle busy state. */
  isPaging?: boolean;
};

const PAGE_SIZES = [25, 50, 100];

export type DataTableProps<T> = {
  columns: Column<T>[];
  getRowId: (row: T) => string | number;

  /** Backend-backed usage: DataState resolves loading/error/empty. */
  query?: ApiQueryResult<T[]>;
  /** Already-resolved usage. Ignored when `query` is supplied. */
  rows?: T[];

  onRowClick?: (row: T) => void;
  /** Marks the row visually as the open one in a drawer. */
  isRowActive?: (row: T) => boolean;

  searchPlaceholder?: string;
  /** Toolbar content between search and the column menu (filter chips etc). */
  toolbar?: ReactNode;
  /** Trailing toolbar content, e.g. a Refresh button. */
  toolbarEnd?: ReactNode;

  initialSort?: { columnId: string; direction: "asc" | "desc" };
  pageSize?: number;

  emptyTitle?: string;
  emptyMessage?: string;
  /** Empty state shown when a filter/search excludes everything. */
  noMatchTitle?: string;

  /** Caption for assistive tech describing what the table lists. */
  label: string;
  /** Skeleton height so first paint does not shift the page. */
  height?: number;
  className?: string;
  /** Present when the API paginates this collection. */
  server?: ServerPagination;
};

const HIDE_BELOW: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

export function DataTable<T>(props: DataTableProps<T>) {
  const { query, rows, ...rest } = props;

  if (query) {
    return (
      <DataState
        query={query}
        height={props.height ?? 420}
        emptyTitle={props.emptyTitle ?? "Nothing to show yet"}
        emptyMessage={props.emptyMessage ?? "No records have been recorded for this view."}
      >
        {data => <DataTableInner {...rest} rows={data} />}
      </DataState>
    );
  }
  return <DataTableInner {...rest} rows={rows ?? []} />;
}

function DataTableInner<T>({
  columns,
  getRowId,
  rows,
  onRowClick,
  isRowActive,
  searchPlaceholder = "Search…",
  toolbar,
  toolbarEnd,
  initialSort,
  pageSize = 25,
  noMatchTitle = "No matches",
  label,
  className,
  server,
}: Omit<DataTableProps<T>, "query" | "rows"> & { rows: T[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter(c => c.defaultHidden).map(c => c.id)),
  );
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  const tableId = useId();

  useEffect(() => {
    if (!colMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setColMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [colMenuOpen]);

  const visible = useMemo(() => columns.filter(c => !hidden.has(c.id)), [columns, hidden]);
  const searchable = useMemo(() => columns.filter(c => c.searchValue), [columns]);

  /*
   * Client filtering is skipped entirely in server mode. Filtering the page
   * the server sent would silently answer "no matches" for a record that
   * exists on page 3.
   */
  const filtered = useMemo(() => {
    if (server) return rows;
    const q = search.trim().toLowerCase();
    if (!q || searchable.length === 0) return rows;
    return rows.filter(r => searchable.some(c => c.searchValue!(r).toLowerCase().includes(q)));
  }, [rows, search, searchable, server]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find(c => c.id === sort.columnId);
    if (!col?.sortValue) return filtered;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      // Nulls always sink, whichever way the column is pointing: a missing
      // value is "unknown", never "best" or "worst".
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  /* In server mode the rows ARE the page; slicing again would drop records. */
  const paged = useMemo(
    () => (server ? sorted : sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)),
    [sorted, safePage, pageSize, server],
  );

  // Any narrowing of the result set returns to the first page; page 4 of a
  // 2-page result is an empty screen that looks like a bug.
  useEffect(() => { setPage(0); }, [search, sort]);

  /*
   * Sorting is client-side, so in server mode it can only reorder the page
   * in front of you. A header that looks like it sorts the dataset but sorts
   * 25 of 500 rows is the same lie as a count that describes the page — so
   * the affordance is withdrawn rather than left to mislead. Server-side
   * sorting is available on some endpoints (assets, risks) and is the right
   * way to restore it; see DATATABLE_MIGRATION_BACKLOG.md.
   */
  const sortable = (col: Column<T>) =>
    Boolean(col.sortValue) && (!server || (server.meta?.totalPages ?? 1) <= 1);

  const toggleSort = useCallback((col: Column<T>) => {
    if (!col.sortValue) return;
    setSort(prev =>
      prev?.columnId === col.id
        ? (prev.direction === "asc" ? { columnId: col.id, direction: "desc" } : null)
        : { columnId: col.id, direction: "asc" },
    );
  }, []);

  const onRowKey = (e: React.KeyboardEvent, row: T) => {
    if (!onRowClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onRowClick(row);
    }
  };

  const hasSearchBox = server ? Boolean(server.onSearch) : searchable.length > 0;
  const showToolbar = hasSearchBox || toolbar || toolbarEnd || columns.some(c => c.defaultHidden !== undefined);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {(server ? Boolean(server.onSearch) : searchable.length > 0) && (
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <AppIcon
                name="search"
                size="sm"
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-icon-quaternary"
              />
              <Input
                value={server ? (server.searchValue ?? "") : search}
                onChange={e => (server?.onSearch ? server.onSearch(e.target.value) : setSearch(e.target.value))}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full pl-8"
              />
              {(server ? server.searchValue : search) && (
                <button
                  type="button"
                  onClick={() => (server?.onSearch ? server.onSearch("") : setSearch(""))}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiary hover:text-primary"
                >
                  <AppIcon name="close" size="sm" />
                </button>
              )}
            </div>
          )}

          {toolbar}

          <div className="ml-auto flex items-center gap-2">
            {toolbarEnd}
            <div className="relative" ref={colMenuRef}>
              <IconButton
                icon="settings"
                size="sm"
                aria-label="Choose columns"
                title="Columns"
                aria-expanded={colMenuOpen}
                aria-haspopup="true"
                onClick={() => setColMenuOpen(o => !o)}
              />
              {colMenuOpen && (
                <div
                  role="menu"
                  aria-label="Toggle columns"
                  className="absolute right-0 top-full z-30 mt-1 min-w-[190px] overflow-hidden rounded-md border border-default bg-raised py-1 shadow-panel"
                >
                  {columns.map(c => {
                    const on = !hidden.has(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={on}
                        onClick={() =>
                          setHidden(prev => {
                            const next = new Set(prev);
                            // Never let the last column be switched off.
                            if (on && next.size >= columns.length - 1) return prev;
                            if (on) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          })
                        }
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-body-sm text-secondary transition-colors hover:bg-action hover:text-primary"
                      >
                        <span className={cn("flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border", on ? "border-transparent bg-action-primary text-on-color" : "border-default")}>
                          {on && <AppIcon name="check" size="xs" />}
                        </span>
                        {c.header}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon="search"
          title={noMatchTitle}
          message={
            search
              ? `Nothing matches “${search}”. Try a shorter or different term.`
              : "No rows match the current filters."
          }
          height={260}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-default">
            <table className="w-full min-w-[640px] border-collapse text-body-sm">
              <caption className="sr-only">{label}</caption>
              <thead className="sticky top-0 z-10 bg-raised-2">
                <tr className="border-b border-default">
                  {visible.map(c => {
                    const active = sort?.columnId === c.id;
                    const ariaSort = active ? (sort!.direction === "asc" ? "ascending" : "descending") : "none";
                    return (
                      <th
                        key={c.id}
                        scope="col"
                        aria-sort={sortable(c) ? (ariaSort as "ascending" | "descending" | "none") : undefined}
                        className={cn(
                          "px-3 py-2.5 text-label-sm font-semibold uppercase tracking-wide text-tertiary",
                          c.align === "right" ? "text-right" : "text-left",
                          c.width,
                          c.hideBelow && HIDE_BELOW[c.hideBelow],
                        )}
                      >
                        {sortable(c) ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded transition-colors hover:text-primary",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                              c.align === "right" && "flex-row-reverse",
                              active && "text-primary",
                            )}
                          >
                            {c.header}
                            <AppIcon
                              name={active ? (sort!.direction === "asc" ? "arrowUp" : "arrowDown") : "chevronDown"}
                              size="xs"
                              className={active ? "text-brand" : "opacity-40"}
                            />
                          </button>
                        ) : (
                          c.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {paged.map(row => {
                  const id = getRowId(row);
                  const clickable = Boolean(onRowClick);
                  const activeRow = isRowActive?.(row) ?? false;
                  return (
                    <tr
                      key={id}
                      data-testid={`row-${id}`}
                      onClick={clickable ? () => onRowClick!(row) : undefined}
                      onKeyDown={clickable ? e => onRowKey(e, row) : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      role={clickable ? "button" : undefined}
                      aria-current={activeRow ? "true" : undefined}
                      className={cn(
                        "border-b border-muted transition-colors last:border-0",
                        clickable && "cursor-pointer hover:bg-raised-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand",
                        activeRow && "bg-raised-2",
                      )}
                    >
                      {visible.map(c => (
                        <td
                          key={c.id}
                          className={cn(
                            "px-3 py-2.5 align-middle text-primary",
                            c.align === "right" && "text-right tabular",
                            c.hideBelow && HIDE_BELOW[c.hideBelow],
                          )}
                        >
                          {c.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-tertiary">
            {server ? (
              /*
               * States the whole dataset, not the page. "1–25 of 512" is the
               * difference between an honest table and one that implies 25
               * is all there is.
               */
              <span aria-live="polite" id={`${tableId}-count`}>
                {server.meta
                  ? server.meta.total === 0
                    ? "No rows"
                    : `${(server.meta.page - 1) * server.meta.pageSize + 1}–` +
                      `${Math.min(server.meta.page * server.meta.pageSize, server.meta.total)}` +
                      ` of ${server.meta.total.toLocaleString()}`
                  : "…"}
              </span>
            ) : (
              <span aria-live="polite" id={`${tableId}-count`}>
                {sorted.length === rows.length
                  ? `${sorted.length} ${sorted.length === 1 ? "row" : "rows"}`
                  : `${sorted.length} of ${rows.length} rows`}
              </span>
            )}

            {server ? (
              <div className="flex items-center gap-2">
                {server.onPageSizeChange && (
                  <label className="flex items-center gap-1.5">
                    <span className="sr-only">Rows per page</span>
                    <select
                      value={server.pageSize}
                      onChange={e => server.onPageSizeChange!(Number(e.target.value))}
                      className="rounded border border-default bg-action px-1.5 py-0.5 text-caption text-secondary"
                      aria-label="Rows per page"
                    >
                      {PAGE_SIZES.map(n => <option key={n} value={n}>{n} / page</option>)}
                    </select>
                  </label>
                )}
                {(server.meta?.totalPages ?? 1) > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Btn
                      variant="outline"
                      onClick={() => server.onPageChange(Math.max(1, server.page - 1))}
                      disabled={server.page <= 1 || server.isPaging}
                      aria-label="Previous page"
                    >
                      <AppIcon name="chevronLeft" size="sm" />
                    </Btn>
                    <span className="tabular px-1">
                      Page {server.meta?.page ?? server.page} of {server.meta?.totalPages ?? 1}
                    </span>
                    <Btn
                      variant="outline"
                      onClick={() => server.onPageChange(server.page + 1)}
                      disabled={server.page >= (server.meta?.totalPages ?? 1) || server.isPaging}
                      aria-label="Next page"
                    >
                      <AppIcon name="chevronRight" size="sm" />
                    </Btn>
                  </div>
                )}
              </div>
            ) : (
              pageCount > 1 && (
                <div className="flex items-center gap-1.5">
                  <Btn variant="outline" onClick={() => setPage(p => Math.max(0, p - 1))}
                       disabled={safePage === 0} aria-label="Previous page">
                    <AppIcon name="chevronLeft" size="sm" />
                  </Btn>
                  <span className="tabular px-1">Page {safePage + 1} of {pageCount}</span>
                  <Btn variant="outline" onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                       disabled={safePage >= pageCount - 1} aria-label="Next page">
                    <AppIcon name="chevronRight" size="sm" />
                  </Btn>
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
