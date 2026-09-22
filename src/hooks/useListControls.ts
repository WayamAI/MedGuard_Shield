import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Page, page-size and search state for a server-paginated list screen.
 *
 * Exists so five list pages do not each re-derive the same two rules, both of
 * which are easy to get wrong in ways that look like data loss:
 *
 *   1. Narrowing the result set returns to page 1. Otherwise a search that
 *      leaves two pages while you are on page 5 renders an empty table, and
 *      an empty table reads as "no records" rather than "wrong page".
 *   2. The search term is debounced before it becomes a query parameter, so
 *      typing eight characters is one request rather than eight.
 */

export type ListControls<F extends Record<string, unknown>> = {
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  /** Bound to the input — updates on every keystroke. */
  search: string;
  setSearch: (term: string) => void;
  /** Current filter values. */
  filters: F;
  setFilter: <K extends keyof F>(key: K, value: F[K]) => void;
  /** Ready to spread into a list hook's params. */
  params: F & { page: number; pageSize: number; search?: string };
};

export function useListControls<F extends Record<string, unknown>>(
  initialFilters: F,
  initialPageSize = 25,
  debounceMs = 250,
): ListControls<F> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [search, setSearchState] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<F>(initialFilters);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), debounceMs);
    return () => window.clearTimeout(t);
  }, [search, debounceMs]);

  /* Any narrowing goes back to page 1 — see rule 1 above. */
  useEffect(() => { setPage(1); }, [debouncedSearch, filters, pageSize]);

  const setSearch = useCallback((term: string) => setSearchState(term), []);

  const setPageSize = useCallback((size: number) => setPageSizeState(size), []);

  const setFilter = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const params = useMemo(
    () => ({
      ...filters,
      page,
      pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [filters, page, pageSize, debouncedSearch],
  );

  return { page, setPage, pageSize, setPageSize, search, setSearch, filters, setFilter, params };
}
