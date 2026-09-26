import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Card, Badge, Btn, SectionHeader, ChartSkeleton } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataState } from "@/components/DataState";
import { listAsQuery } from "@/components/DataTable";
import { RiskMatrix } from "@/components/RiskMatrix";
import { DomainIcon, type DomainIconName } from "@/components/DomainIcon";
import {
  PageHeader, MetricCard, MiniBar, EntityAvatar, RiskBandScale, PostureCard,
  BAND_TONE, BAND_ORDER,
} from "@/components/ui-patterns";
import { useAssets } from "@/hooks/useAssets";
import { useRisks, useRiskMatrix } from "@/hooks/useRisks";
import { useRawDataFlows } from "@/hooks/useDataFlows";
import { useVendors } from "@/hooks/useVendors";
import { useAccessSummary } from "@/hooks/useAccess";
import { useThreatSummary } from "@/hooks/useThreats";
import { useControls, useRemediationSummary, useAudit } from "@/hooks/useGovernance";
import { useIsAdmin } from "@/hooks/use-auth";
import type { Tone } from "@/lib/tone";
import type { RiskBand } from "@/lib/apiTypes";

/**
 * Executive risk overview.
 *
 * Every number on this page is computed from a live endpoint. The previous
 * dashboard mixed four real KPI tiles with a hardcoded "Governance Health
 * Score = 94", four invented compliance frameworks, a mock alert list and a
 * "Live Activity Feed" whose timestamps advanced on a setInterval over
 * fixture rows — none of it disclosed, on the one screen an executive is most
 * likely to read as fact. All of that is gone.
 *
 * What replaced the invented composite score is the Action Centre: instead of
 * asserting a single number nobody can audit, it lists the specific findings
 * that number would have been summarising, each linking to the record.
 */

type Finding = {
  id: string;
  icon: DomainIconName;
  tone: Tone;
  title: string;
  detail: string;
  count: number;
  to: string;
};

export default function Dashboard() {
  const navigate = useNavigate();

  /*
   * Organisation-level figures.
   *
   * Access and threats have dedicated /summary routes — use them. The rest
   * are counted from `meta.total`, which the API computes across the whole
   * collection, so a `pageSize: 1` request is enough to learn "how many
   * assets exist" without pulling the inventory.
   *
   * The one exception is the risk matrix, which needs actual rows to plot and
   * therefore asks for the server's maximum page. It reports truncation
   * rather than silently drawing a partial estate.
   */
  const assetCount = useAssets({ pageSize: 1 });
  const vendorList = useVendors({ pageSize: 200 });
  const riskList = useRisks({ pageSize: 200 });
  const matrixRisks = useRiskMatrix();
  const flows = useRawDataFlows();
  const accessSummary = useAccessSummary();
  const threatSummary = useThreatSummary();

  /*
   * Governance posture: the three areas the overview used to leave out.
   *
   * Controls has no summary route, so the statuses are counted here from one
   * page of rows — the estate is small enough that the server's max page is
   * the whole collection, and `meta.total` is checked against it below so a
   * larger one says so rather than quietly reporting a slice.
   *
   * Audit is ADMIN-only server-side. Asking for it as an analyst is a
   * guaranteed 403 and a red error card on the dashboard, so the query is
   * gated on the same role the route is.
   */
  const isAdmin = useIsAdmin();
  const controlList = useControls({ pageSize: 200 });
  const remediationSummary = useRemediationSummary();
  const auditList = useAudit({ pageSize: 25 }, { enabled: isAdmin });

  /* ------------------------------------------------- headline metrics */

  const metrics = useMemo(() => {
    const f = flows.data;
    const r = riskList.data;
    return {
      assets: assetCount.meta?.total,
      phiRecordsPerDay: f ? f.reduce((s, x) => s + x.recordsPerDay, 0) : undefined,
      unencryptedFlows: f ? f.filter(x => !x.encrypted).length : undefined,
      totalFlows: f?.length,
      criticalOrExtreme: r ? r.filter(x => x.band === "CRITICAL" || x.band === "EXTREME").length : undefined,
      openThreats: threatSummary.data?.open,
      openCritical: threatSummary.data?.openCritical,
      vendors: vendorList.meta?.total,
      vendorsNoBaa: vendorList.data ? vendorList.data.filter(v => !v.baaCompliant).length : undefined,
      flaggedGrants: accessSummary.data?.flagged,
      totalGrants: accessSummary.data?.total,
    };
  }, [assetCount.meta, flows.data, riskList.data, threatSummary.data, vendorList.data, vendorList.meta, accessSummary.data]);

  /* --------------------------------------------- risk band distribution */

  const bandCounts = useMemo(() => {
    if (!riskList.data) return null;
    const counts = Object.fromEntries(BAND_ORDER.map(b => [b, 0])) as Record<RiskBand, number>;
    for (const r of riskList.data) counts[r.band] += 1;
    return counts;
  }, [riskList.data]);

  /* --------------------------------------------------- governance posture */

  const controlPosture = useMemo(() => {
    const rows = controlList.data;
    if (!rows) return null;
    const by = (st: string) => rows.filter(c => c.status === st).length;
    return {
      total: controlList.meta?.total ?? rows.length,
      counted: rows.length,
      implemented: by("IMPLEMENTED"),
      partial: by("PARTIAL"),
      planned: by("PLANNED"),
      missing: by("NOT_IMPLEMENTED"),
      /* The API's own assessment verdict, not a re-derivation of it. */
      ineffective: rows.filter(c => c.effectiveness === "INEFFECTIVE").length,
      unassessed: rows.filter(c => c.effectiveness === "NOT_ASSESSED").length,
    };
  }, [controlList.data, controlList.meta]);

  const auditPosture = useMemo(() => {
    const rows = auditList.data;
    if (!rows) return null;
    return {
      total: auditList.meta?.total ?? rows.length,
      latest: rows[0]?.createdAt ?? null,
      failures: rows.filter(e => e.result !== "SUCCESS").length,
      window: rows.length,
    };
  }, [auditList.data, auditList.meta]);

  /* ------------------------------------------------------ action centre */

  /**
   * Real findings, each one a query the user can go and verify. Ordered by
   * how much they should worry, not by which endpoint returned first.
   */
  const findings = useMemo<Finding[]>(() => {
    const out: Finding[] = [];

    const openCritical = threatSummary.data?.openCritical ?? 0;
    if (openCritical > 0) {
      out.push({
        id: "open-critical-threats",
        icon: "threat", tone: "danger",
        title: "Open critical threats",
        detail: "Detected and still unresolved",
        count: openCritical,
        to: "/threats",
      });
    }

    const extreme = riskList.data?.filter(r => r.band === "EXTREME").length ?? 0;
    if (extreme > 0) {
      out.push({
        id: "extreme-risks",
        icon: "risk", tone: "danger",
        title: "Assets at extreme risk",
        detail: "Highest band the scoring engine assigns",
        count: extreme,
        to: "/risks",
      });
    }

    const noBaa = vendorList.data?.filter(v => !v.baaCompliant).length ?? 0;
    if (noBaa > 0) {
      out.push({
        id: "vendors-no-baa",
        icon: "vendor", tone: "danger",
        title: "Vendors without a valid BAA",
        detail: "Processing PHI with a missing, expired or pending agreement",
        count: noBaa,
        to: "/vendors",
      });
    }

    const unencrypted = flows.data?.filter(f => !f.encrypted).length ?? 0;
    if (unencrypted > 0) {
      out.push({
        id: "unencrypted-flows",
        icon: "dataFlow", tone: "warning",
        title: "Unencrypted PHI flows",
        detail: "PHI moving between systems without encryption",
        count: unencrypted,
        to: "/phi-flow",
      });
    }

    const flagged = accessSummary.data?.flagged ?? 0;
    if (flagged > 0) {
      out.push({
        id: "flagged-grants",
        icon: "identity", tone: "warning",
        title: "Access grants flagged",
        detail: "Stale, over-privileged, unused or missing MFA",
        count: flagged,
        to: "/access",
      });
    }

    const unscored = Math.max(0, (assetCount.meta?.total ?? 0) - (riskList.meta?.total ?? 0));
    if (unscored > 0) {
      out.push({
        id: "unscored-assets",
        icon: "asset", tone: "info",
        title: "Assets never scored",
        detail: "No risk assessment has been run against these",
        count: unscored,
        to: "/assets?open=",
      });
    }

    return out;
  }, [threatSummary.data, riskList.data, riskList.meta, vendorList.data, flows.data, accessSummary.data, assetCount.meta]);

  const anyLoading =
    assetCount.isLoading || riskList.isLoading || flows.isLoading ||
    vendorList.isLoading || accessSummary.isLoading || threatSummary.isLoading;

  return (
    <div className="space-y-4">
      <PageHeader
        icon="dashboard"
        title="Governance Overview"
        description="Where PHI lives, how it moves, who can reach it, and where the risk concentrates. Computed live from the Drishti API."
        meta={
          <>
            <span className="flex items-center gap-1.5 text-caption text-tertiary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-feedback-success-icon" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-feedback-success-icon" />
              </span>
              Polling every 30s
            </span>
            <span className="text-caption text-quaternary">Meridian Health</span>
          </>
        }
      />

      {/* PRIMARY RISK SUMMARY */}
      <section aria-label="Risk summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Assets monitored"
          value={metrics.assets}
          icon="database"
          art="asset"
          sub={metrics.totalFlows !== undefined ? `${metrics.totalFlows} PHI flows mapped` : undefined}
          onClick={() => navigate("/assets")}
        />
        <MetricCard
          label="Critical or extreme"
          value={metrics.criticalOrExtreme}
          icon="threats"
          art="kpiCritical"
          tone="danger"
          emphasis={Boolean(metrics.criticalOrExtreme)}
          sub={bandCounts ? `${bandCounts.EXTREME} extreme · ${bandCounts.CRITICAL} critical` : undefined}
          onClick={() => navigate("/risks")}
        />
        <MetricCard
          label="PHI records / day"
          value={metrics.phiRecordsPerDay?.toLocaleString()}
          icon="record"
          sub="across all mapped flows"
          onClick={() => navigate("/phi-flow")}
        />
        <MetricCard
          label="Unencrypted flows"
          value={metrics.unencryptedFlows}
          icon="unlocked"
          tone="danger"
          emphasis={Boolean(metrics.unencryptedFlows)}
          sub={metrics.totalFlows !== undefined ? `of ${metrics.totalFlows} total` : undefined}
          onClick={() => navigate("/phi-flow")}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* RISK OVERVIEW */}
        <Card className="p-4 xl:col-span-2">
          <SectionHeader
            title="Risk Matrix"
            subtitle="Every scored asset by likelihood and impact. Colour is the band the API derived."
            action={
              <Btn variant="outline" onClick={() => navigate("/risks")}>
                Open register
                <AppIcon name="chevronRight" size="sm" />
              </Btn>
            }
          />
          <DataState
            query={listAsQuery(matrixRisks)}
            height={360}
            emptyTitle="No scored assets"
            emptyMessage="Import assets and run a risk assessment to populate the matrix."
            emptyArt="emptyRisks"
          >
            {data => <RiskMatrix risks={data} onSelect={() => navigate("/risks")} />}
          </DataState>
        </Card>

        {/* EXPOSURE */}
        <Card className="p-4">
          <SectionHeader title="Exposure" subtitle="Where PHI reaches beyond the core systems." />

          <div className="space-y-4">
            <ExposureRow
              icon="vendor"
              label="Third-party vendors"
              value={metrics.vendors}
              detail={
                metrics.vendorsNoBaa !== undefined && metrics.vendors !== undefined
                  ? `${metrics.vendorsNoBaa} of ${metrics.vendors} without a valid BAA`
                  : undefined
              }
              tone={metrics.vendorsNoBaa ? "danger" : "success"}
              onClick={() => navigate("/vendors")}
            />
            <ExposureRow
              icon="identity"
              label="Access grants"
              value={metrics.totalGrants}
              detail={
                metrics.flaggedGrants !== undefined && metrics.totalGrants !== undefined
                  ? `${metrics.flaggedGrants} of ${metrics.totalGrants} flagged`
                  : undefined
              }
              tone={metrics.flaggedGrants ? "warning" : "success"}
              onClick={() => navigate("/access")}
            />
            <ExposureRow
              icon="threat"
              label="Open threats"
              value={metrics.openThreats}
              detail={
                metrics.openCritical !== undefined
                  ? `${metrics.openCritical} critical`
                  : undefined
              }
              tone={metrics.openCritical ? "danger" : metrics.openThreats ? "warning" : "success"}
              onClick={() => navigate("/threats")}
            />
          </div>

          {bandCounts && (
            <div className="mt-5 border-t border-muted pt-4">
              <div className="mb-2 text-label-sm uppercase tracking-wide text-quaternary">
                Risk distribution
              </div>
              <MiniBar
                segments={BAND_ORDER.map(b => ({
                  value: bandCounts[b],
                  tone: BAND_TONE[b],
                  label: b,
                }))}
              />
              <div className="mt-3">
                <RiskBandScale counts={bandCounts} />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* GOVERNANCE POSTURE */}
      {/*
        The three areas the overview left out. They sit below the matrix
        rather than beside the metric row on purpose: each is a programme
        rather than a number, and promoting them into the top row would give
        seven equal tiles and no hierarchy at all.
      */}
      <section aria-label="Governance posture" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <PostureCard
          art="control"
          fallbackIcon="control"
          title="Controls"
          subtitle="What is actually in place against the estate."
          value={controlPosture ? `${controlPosture.implemented}/${controlPosture.total}` : undefined}
          valueSub="implemented"
          loading={controlList.isLoading}
          breakdown={controlPosture ? [
            { value: controlPosture.implemented, tone: "success", label: "Implemented" },
            { value: controlPosture.partial, tone: "warning", label: "Partial" },
            { value: controlPosture.planned, tone: "info", label: "Planned" },
            { value: controlPosture.missing, tone: "danger", label: "Not implemented" },
          ] : undefined}
          footer={controlPosture && (
            <>
              <span className="text-caption text-tertiary">
                <span className="tabular text-secondary">{controlPosture.ineffective}</span> assessed ineffective
              </span>
              <span className="text-caption text-tertiary">
                <span className="tabular text-secondary">{controlPosture.unassessed}</span> never assessed
              </span>
              {/*
                Says so rather than quietly reporting a slice. The statuses are
                counted from one page, so a collection larger than that page is
                a number this card cannot honestly claim.
              */}
              {controlPosture.counted < controlPosture.total && (
                <span className="text-caption text-feedback-warning">
                  Breakdown covers the first {controlPosture.counted}
                </span>
              )}
            </>
          )}
          onOpen={() => navigate("/controls")}
          openLabel="Open controls"
        />

        <PostureCard
          art="remediation"
          fallbackIcon="remediation"
          title="Remediation"
          subtitle="Findings with an owner, a date and somewhere to land."
          value={remediationSummary.data?.open}
          valueSub="still open"
          loading={remediationSummary.isLoading}
          breakdown={remediationSummary.data ? [
            { value: remediationSummary.data.bySeverity.CRITICAL ?? 0, tone: "danger", label: "Critical" },
            { value: remediationSummary.data.bySeverity.HIGH ?? 0, tone: "warning", label: "High" },
            { value: remediationSummary.data.bySeverity.MEDIUM ?? 0, tone: "info", label: "Medium" },
            { value: remediationSummary.data.bySeverity.LOW ?? 0, tone: "success", label: "Low" },
          ] : undefined}
          footer={remediationSummary.data && (
            <>
              <span className="text-caption text-tertiary">
                <span className={cn("tabular", remediationSummary.data.overdue ? "text-feedback-error" : "text-secondary")}>
                  {remediationSummary.data.overdue}
                </span> past due
              </span>
              <span className="text-caption text-tertiary">
                <span className="tabular text-secondary">{remediationSummary.data.byStatus.IN_PROGRESS ?? 0}</span> in progress
              </span>
              <span className="text-caption text-tertiary">
                <span className="tabular text-secondary">{remediationSummary.data.byStatus.RESOLVED ?? 0}</span> resolved
              </span>
            </>
          )}
          onOpen={() => navigate("/remediation")}
          openLabel="Open remediation"
        />

        {/*
          Audit is ADMIN-only server-side. A non-admin gets the card explaining
          that rather than a 403, because a tile that silently disappears reads
          as a broken dashboard rather than as a permission boundary.
        */}
        {isAdmin ? (
          <PostureCard
            art="audit"
            fallbackIcon="audit"
            title="Audit activity"
            subtitle="Every write, who made it, and whether it succeeded."
            value={auditPosture?.total?.toLocaleString()}
            valueSub="recorded events"
            loading={auditList.isLoading}
            footer={auditPosture && (
              <>
                {auditPosture.latest && (
                  <span className="text-caption text-tertiary">
                    Last entry {new Date(auditPosture.latest).toLocaleString()}
                  </span>
                )}
                <span className="text-caption text-tertiary">
                  <span className={cn("tabular", auditPosture.failures ? "text-feedback-warning" : "text-secondary")}>
                    {auditPosture.failures}
                  </span> failed in the last {auditPosture.window}
                </span>
              </>
            )}
            onOpen={() => navigate("/audit")}
            openLabel="Open audit trail"
          />
        ) : (
          <div className="flex flex-col justify-center rounded-card border border-dashed border-default bg-raised-2 p-4">
            <h3 className="text-heading-sm text-primary">Audit activity</h3>
            <p className="mt-1 text-body-sm text-tertiary">
              The audit trail is restricted to administrators. Your role can see
              everything else on this page.
            </p>
          </div>
        )}
      </section>

      {/* ACTION CENTRE */}
      <Card className="p-4">
        <SectionHeader
          title="Action Centre"
          subtitle="Unresolved findings across every connected source, worst first. Each one links to the records behind it."
        />
        {anyLoading ? (
          <ChartSkeleton height={200} label="Gathering findings" />
        ) : findings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-feedback-success-background text-feedback-success-icon">
              <AppIcon name="check" size="xl" />
            </span>
            <p className="text-body-md text-primary">Nothing needs attention</p>
            <p className="max-w-sm text-body-sm text-tertiary">
              No open critical threats, extreme risks, BAA gaps, unencrypted flows or flagged
              access grants were returned by the API.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-muted">
            {findings.map(f => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => navigate(f.to)}
                  className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-raised-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                >
                  <EntityAvatar icon={f.icon} tone={f.tone} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-md text-primary">{f.title}</span>
                    <span className="block truncate text-caption text-tertiary">{f.detail}</span>
                  </span>
                  <Badge tone={f.tone}>{f.count}</Badge>
                  <AppIcon name="chevronRight" size="sm" className="text-icon-quaternary" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/*
        There is deliberately no "Recent Activity" feed. The previous one
        animated fixture rows with fabricated timestamps. A real one needs
        GET /api/audit, specified in FRONTEND_API_CONTRACT.md.
      */}
    </div>
  );
}

function ExposureRow({
  icon, label, value, detail, tone, onClick,
}: {
  icon: DomainIconName;
  label: string;
  value: number | undefined;
  detail?: string;
  tone: Tone;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md p-1 text-left transition-colors hover:bg-raised-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <DomainIcon name={icon} size={18} className="text-icon-tertiary" />
      <span className="min-w-0 flex-1">
        <span className="block text-body-md text-primary">{label}</span>
        {detail && <span className="block truncate text-caption text-tertiary">{detail}</span>}
      </span>
      {value === undefined ? (
        <span className="inline-block h-5 w-8 animate-pulse rounded bg-raised-2" />
      ) : (
        <span className={`tabular font-display text-heading-md text-${tone === "success" ? "primary" : "primary"}`}>
          {value}
        </span>
      )}
    </button>
  );
}
