import { useEffect, useMemo, useState } from "react";
import { useAssets } from "@/hooks/useAssets";
import { useVendors } from "@/hooks/useVendors";
import { useRisks } from "@/hooks/useRisks";
import { useThreats } from "@/hooks/useThreats";
import { useAccess } from "@/hooks/useAccess";
import type { RiskBand } from "@/lib/apiTypes";
import type { DomainIconName } from "@/components/DomainIcon";

/**
 * Global search across the Drishti entities the API exposes.
 *
 * This searches real records. The previous implementation returned four
 * hardcoded rows and ignored what you typed, which looked like search and was
 * not — it could "find" a record that had been deleted and miss every record
 * that existed.
 *
 * Deliberately client-side over the five list endpoints:
 *   - those endpoints are already fetched and cached by the pages themselves,
 *     so opening search usually costs nothing,
 *   - the datasets are inventory-scale (tens to low thousands), not log-scale,
 *   - and it needs no backend work to be truthful today.
 *
 * It will not scale past a few thousand records per entity, and it cannot
 * match on fields the list endpoints do not return. A server-side
 * `GET /api/search` is specified in FRONTEND_API_CONTRACT.md for that; this
 * hook is shaped to be swapped for it without touching the UI.
 *
 * Queries are gated on `enabled` so five lists are not polled for a palette
 * nobody has opened.
 */

export type SearchEntity = "asset" | "vendor" | "risk" | "threat" | "identity";

export type SearchResult = {
  id: string;
  entity: SearchEntity;
  icon: DomainIconName;
  /** Primary line — the thing's name. */
  title: string;
  /** Secondary line — where it sits or what it is. */
  context: string;
  /** Right-hand status chip, when the entity has one. */
  band?: RiskBand | null;
  status?: string;
  /** Where selecting it goes. */
  to: string;
};

export const ENTITY_LABEL: Record<SearchEntity, string> = {
  asset: "Assets",
  vendor: "Vendors",
  risk: "Risks",
  threat: "Threats",
  identity: "Identities",
};

const MAX_PER_GROUP = 5;

/** The server caps pageSize at 200. Scanning more than this needs /api/search. */
const SEARCH_SCAN_LIMIT = 200;

/** Case-insensitive substring match. */
const hit = (haystack: string, q: string) => haystack.toLowerCase().includes(q);

export function useGlobalSearch(rawQuery: string, enabled: boolean) {
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (!enabled) { setDebounced(""); return; }
    const t = window.setTimeout(() => setDebounced(rawQuery.trim().toLowerCase()), 180);
    return () => window.clearTimeout(t);
  }, [rawQuery, enabled]);

  /*
   * Slower poll than the pages use: this is a lookup surface, not a monitor.
   *
   * pageSize is raised to the server's cap because this searches what it has
   * fetched. That is a real limit, not a hidden one — see the note on
   * `truncated` below, and the GET /api/search contract that replaces it.
   */
  const opts = { enabled, pollIntervalMs: 120_000 } as const;
  const page = { pageSize: SEARCH_SCAN_LIMIT } as const;
  const assets = useAssets(page, opts);
  const vendors = useVendors(page, opts);
  const risks = useRisks(page, opts);
  const threats = useThreats(page, opts);
  const access = useAccess(page, opts);

  const isLoading =
    enabled && (assets.isLoading || vendors.isLoading || threats.isLoading || access.isLoading);

  const results = useMemo<SearchResult[]>(() => {
    const q = debounced;
    if (q.length < 2) return [];
    const out: SearchResult[] = [];

    for (const a of assets.data ?? []) {
      if (hit(a.name, q) || hit(a.type, q)) {
        out.push({
          id: `asset-${a.id}`, entity: "asset", icon: "asset",
          title: a.name,
          context: `${a.type.replace(/_/g, " ")} · ${a.phiVolume.toLocaleString()} PHI records`,
          band: a.risk?.band ?? null,
          to: `/assets?open=${a.id}`,
        });
      }
    }

    for (const v of vendors.data ?? []) {
      if (hit(v.name, q)) {
        out.push({
          id: `vendor-${v.id}`, entity: "vendor", icon: "vendor",
          title: v.name,
          context: `BAA ${v.baaStatus.toLowerCase()} · ${v.assetCount} system${v.assetCount === 1 ? "" : "s"}`,
          band: v.risk?.band ?? null,
          to: `/vendors?open=${v.id}`,
        });
      }
    }

    for (const r of risks.data ?? []) {
      if (hit(r.assetName, q)) {
        out.push({
          id: `risk-${r.id}`, entity: "risk", icon: "risk",
          title: r.assetName,
          context: `Risk score ${r.score}`,
          band: r.band,
          to: `/risks?open=${r.id}`,
        });
      }
    }

    for (const t of threats.data ?? []) {
      if (hit(t.title, q) || hit(t.assetName, q)) {
        out.push({
          id: `threat-${t.id}`, entity: "threat", icon: "threat",
          title: t.title,
          context: `${t.assetName} · ${t.severity}`,
          status: t.status,
          to: `/threats?open=${t.id}`,
        });
      }
    }

    for (const g of access.data ?? []) {
      if (hit(g.identityName, q) || hit(g.assetName, q)) {
        out.push({
          id: `identity-${g.id}`, entity: "identity", icon: "identity",
          title: g.identityName,
          context: `${g.level} on ${g.assetName}`,
          status: g.flags.length > 0 ? `${g.flags.length} finding${g.flags.length === 1 ? "" : "s"}` : undefined,
          to: `/access?open=${g.id}`,
        });
      }
    }

    return out;
  }, [debounced, assets.data, vendors.data, risks.data, threats.data, access.data]);

  /** Grouped and capped, so one noisy entity cannot fill the palette. */
  const grouped = useMemo(() => {
    const order: SearchEntity[] = ["asset", "risk", "vendor", "threat", "identity"];
    return order
      .map(entity => ({ entity, items: results.filter(r => r.entity === entity).slice(0, MAX_PER_GROUP) }))
      .filter(g => g.items.length > 0);
  }, [results]);

  /** Flat, in group order — what arrow-key navigation walks. */
  const flat = useMemo(() => grouped.flatMap(g => g.items), [grouped]);

  /*
   * True when any entity has more rows than this hook can see. The UI says
   * so, because "no matches" and "no matches in the first 200" are different
   * statements and only one of them is honest.
   */
  const truncated = [assets, vendors, risks, threats, access]
    .some(q => (q.meta?.total ?? 0) > SEARCH_SCAN_LIMIT);

  return {
    truncated,
    query: debounced,
    /** True once the user has typed enough for a search to run. */
    active: debounced.length >= 2,
    isLoading,
    grouped,
    flat,
    total: results.length,
  };
}
