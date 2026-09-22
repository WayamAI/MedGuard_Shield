import { useEffect, useMemo, useState } from "react";
import { useServerSearch } from "@/hooks/useGovernance";
import type { ApiSearchResult } from "@/lib/apiTypes";
import type { DomainIconName } from "@/components/DomainIcon";

/**
 * Global search, served by GET /api/search.
 *
 * This replaces two earlier implementations, in order of how wrong they were:
 *
 *   1. Four hardcoded results that ignored what you typed. It could "find" a
 *      record that had been deleted and miss every record that existed.
 *   2. A client-side scan over the five list endpoints. That searched real
 *      records, but only the ones it had already fetched — so "no matches"
 *      actually meant "no matches in the first 200", which is a different
 *      statement and not one the UI was making.
 *
 * The server searches everything and reports its own truncation, so the
 * answer is now the answer the database would give.
 */

export type SearchEntity = ApiSearchResult["type"];

export type SearchResult = {
  id: string;
  entity: SearchEntity;
  icon: DomainIconName;
  title: string;
  context: string;
  status: string | null;
  to: string;
};

export const ENTITY_LABEL: Record<SearchEntity, string> = {
  asset: "Assets",
  risk: "Risks",
  vendor: "Vendors",
  threat: "Threats",
  identity: "Identities",
  remediation: "Remediation",
  control: "Controls",
  policy: "Policies",
};

const ENTITY_ICON: Record<SearchEntity, DomainIconName> = {
  asset: "asset",
  risk: "risk",
  vendor: "vendor",
  threat: "threat",
  identity: "identity",
  remediation: "remediation",
  control: "control",
  policy: "audit",
};

/** Where selecting a result goes. */
const routeFor = (r: ApiSearchResult): string => {
  switch (r.type) {
    case "asset": return `/assets?open=${r.id}`;
    case "vendor": return `/vendors?open=${r.id}`;
    case "risk": return `/risks?open=${r.id}`;
    case "threat": return `/threats?open=${r.id}`;
    case "identity": return `/access?search=${encodeURIComponent(r.title)}`;
    case "remediation": return `/remediation?open=${r.id}`;
    case "control": return `/controls?open=${r.id}`;
    case "policy": return `/policies?open=${r.id}`;
    default: return "/";
  }
};

/** Display order — worst-news entities first. */
const ORDER: SearchEntity[] = [
  "asset", "risk", "threat", "vendor", "identity", "remediation", "control", "policy",
];

const MAX_PER_GROUP = 5;

export function useGlobalSearch(rawQuery: string, enabled: boolean) {
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (!enabled) { setDebounced(""); return; }
    const t = window.setTimeout(() => setDebounced(rawQuery.trim()), 180);
    return () => window.clearTimeout(t);
  }, [rawQuery, enabled]);

  const query = useServerSearch(debounced, enabled);

  const results = useMemo<SearchResult[]>(
    () => (query.data?.results ?? []).map(r => ({
      id: `${r.type}-${r.id}`,
      entity: r.type,
      icon: ENTITY_ICON[r.type] ?? "asset",
      title: r.title,
      context: r.context,
      status: r.status,
      to: routeFor(r),
    })),
    [query.data],
  );

  const grouped = useMemo(
    () => ORDER
      .map(entity => ({ entity, items: results.filter(r => r.entity === entity).slice(0, MAX_PER_GROUP) }))
      .filter(g => g.items.length > 0),
    [results],
  );

  const flat = useMemo(() => grouped.flatMap(g => g.items), [grouped]);

  return {
    query: debounced,
    active: debounced.length >= 2,
    isLoading: enabled && debounced.length >= 2 && query.isLoading,
    isError: query.isError,
    grouped,
    flat,
    total: results.length,
    /** The server capped the result set — say so rather than implying completeness. */
    truncated: query.data?.truncated ?? false,
  };
}
