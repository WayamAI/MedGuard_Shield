import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Badge, Btn, SlideOver, ChartSkeleton } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataTable, listAsQuery, type Column } from "@/components/DataTable";
import {
  PageHeader, MetricCard, Field, FieldGroup, FilterBar, EntityAvatar,
} from "@/components/ui-patterns";
import { useThreats, useThreatSummary, useThreat } from "@/hooks/useThreats";
import { useListControls } from "@/hooks/useListControls";
import { useSetThreatStatus } from "@/hooks/useMutations";
import { useCanWrite } from "@/hooks/use-auth";
import { describeApiError, toApiError } from "@/lib/apiErrors";
import { notify } from "@/lib/notify";
import type { ApiThreat, ThreatSeverity, ThreatStatus } from "@/lib/apiTypes";
import type { Tone } from "@/lib/tone";

/**
 * Threat detection, with a real lifecycle.
 *
 * Status changes go to POST /api/threats/:id/status and the page renders
 * whatever comes back. The buttons offered are the server's own
 * `allowedTransitions[]` — the frontend does not keep a second copy of the
 * transition table, because two copies of a rule is one edit away from
 * offering a button that is guaranteed to 409.
 */

const SEVERITY_TONE: Record<ThreatSeverity, Tone> = {
  CRITICAL: "danger",
  HIGH: "warning",
  MEDIUM: "info",
  LOW: "muted",
};

const STATUS_TONE: Record<ThreatStatus, Tone> = {
  OPEN: "danger",
  INVESTIGATING: "warning",
  RESOLVED: "success",
  FALSE_POSITIVE: "muted",
};

const STATUS_LABEL: Record<ThreatStatus, string> = {
  OPEN: "Open",
  INVESTIGATING: "Investigating",
  RESOLVED: "Resolved",
  FALSE_POSITIVE: "False positive",
};

const SEVERITIES: ThreatSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUSES: ThreatStatus[] = ["OPEN", "INVESTIGATING", "RESOLVED", "FALSE_POSITIVE"];

/**
 * Hours up to two days, then days.
 *
 * 48 rather than 24: during an incident "43h ago" is a more useful thing to
 * read than "2d ago", and the extra day of precision costs nothing.
 */
const age = (hours: number) =>
  hours < 1 ? "just now"
    : hours < 48 ? `${Math.round(hours)}h ago`
    : `${Math.round(hours / 24)}d ago`;

export default function Threats() {
  const summary = useThreatSummary();

  const [params, setParams] = useSearchParams();
  const openId = params.get("open") ? Number(params.get("open")) : null;

  const controls = useListControls<{ severity?: ThreatSeverity; status?: ThreatStatus }>({
    severity: undefined,
    status: undefined,
  });
  const threats = useThreats(controls.params);

  const openThreat = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id === null) next.delete("open");
    else next.set("open", String(id));
    setParams(next, { replace: true });
  };

  const headline = useMemo(
    () => (threats.data ?? []).find(t => t.open && t.severity === "CRITICAL") ?? null,
    [threats.data],
  );

  const columns: Column<ApiThreat>[] = [
    {
      id: "severity",
      header: "Severity",
      width: "w-28",
      sortValue: t => SEVERITIES.length - SEVERITIES.indexOf(t.severity),
      cell: t => <Badge tone={SEVERITY_TONE[t.severity]}>{t.severity}</Badge>,
    },
    {
      id: "title",
      header: "Threat",
      sortValue: t => t.title,
      cell: t => (
        <div className="flex items-center gap-2.5">
          <EntityAvatar icon="threat" tone={SEVERITY_TONE[t.severity]} size="sm" />
          <div className="min-w-0">
            <div className={`truncate text-body-md ${t.open ? "text-primary" : "text-tertiary"}`}>
              {t.title}
            </div>
            <div className="truncate text-caption text-tertiary">{t.assetName}</div>
          </div>
        </div>
      ),
    },
    {
      id: "detected",
      header: "Detected",
      hideBelow: "md",
      sortValue: t => -t.hoursSinceDetection,
      cell: t => <span className="text-tertiary">{age(t.hoursSinceDetection)}</span>,
    },
    {
      id: "status",
      header: "Status",
      sortValue: t => t.status,
      cell: t => <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>,
    },
  ];

  const s = summary.data;

  return (
    <div className="space-y-4">
      <PageHeader
        icon="threat"
        title="Threat & Anomaly Detection"
        description="Detected threats across the estate. Open items first, then by severity."
        actions={
          <Btn variant="outline" onClick={() => { void threats.refresh(); void summary.refresh(); }} disabled={threats.isFetching}>
            <AppIcon name="refresh" size="sm" spin={threats.isFetching} />
            Refresh
          </Btn>
        }
      />

      {/* From /api/threats/summary — the estate, not the page. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Open threats"
          value={s?.open}
          icon="threats"
          tone="danger"
          emphasis={Boolean(s?.open)}
          sub={s ? `of ${s.total} detected` : undefined}
        />
        <MetricCard
          label="Open critical"
          value={s?.openCritical}
          icon="activity"
          tone="danger"
          emphasis={Boolean(s?.openCritical)}
        />
        <MetricCard label="Investigating" value={s?.byStatus.INVESTIGATING ?? 0} icon="search" tone="warning" />
        <MetricCard label="Resolved" value={s?.byStatus.RESOLVED ?? 0} icon="check" tone="success" />
      </div>

      {headline && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-feedback-error-stroke bg-feedback-error-background p-3">
          <AppIcon name="threats" size="md" className="text-feedback-error" />
          <span className="text-body-md text-primary">
            <span className="font-semibold">Open critical:</span> {headline.title} on{" "}
            {headline.assetName}, detected {age(headline.hoursSinceDetection)}, still{" "}
            {STATUS_LABEL[headline.status].toLowerCase()}.
          </span>
          <div className="flex-1" />
          <Btn variant="outline" onClick={() => openThreat(headline.id)}>View details</Btn>
        </div>
      )}

      <Card className="p-4">
        <DataTable
          label="Detected threats"
          query={listAsQuery(threats)}
          server={{
            meta: threats.meta,
            page: controls.page,
            onPageChange: controls.setPage,
            pageSize: controls.pageSize,
            onPageSizeChange: controls.setPageSize,
            onSearch: controls.setSearch,
            searchValue: controls.search,
            isPaging: threats.isPaging,
          }}
          columns={columns}
          getRowId={t => t.id}
          onRowClick={t => openThreat(t.id)}
          isRowActive={t => t.id === openId}
          searchPlaceholder="Search threats or systems…"
          emptyIcon="threats"
          emptyTitle="No threats detected"
          emptyMessage="Nothing matches the current filters."
          toolbar={
            <>
              <FilterBar
                label="Filter by severity"
                value={controls.filters.severity ?? "all"}
                onChange={v => controls.setFilter("severity", v === "all" ? undefined : (v as ThreatSeverity))}
                options={[
                  { value: "all", label: "All" },
                  ...SEVERITIES.map(sev => ({
                    value: sev,
                    label: sev[0] + sev.slice(1).toLowerCase(),
                    count: s?.bySeverity[sev],
                  })),
                ]}
              />
              <FilterBar
                label="Filter by status"
                value={controls.filters.status ?? "all"}
                onChange={v => controls.setFilter("status", v === "all" ? undefined : (v as ThreatStatus))}
                options={[
                  { value: "all", label: "Any status" },
                  ...STATUSES.map(st => ({
                    value: st,
                    label: STATUS_LABEL[st],
                    count: s?.byStatus[st],
                  })),
                ]}
              />
            </>
          }
        />
      </Card>

      <ThreatDrawer id={openId} onClose={() => openThreat(null)} />
    </div>
  );
}

function ThreatDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const navigate = useNavigate();
  const detail = useThreat(id);
  const setStatus = useSetThreatStatus();
  const canWrite = useCanWrite();

  const t = detail.data;

  const transition = async (status: ThreatStatus) => {
    if (!t) return;
    try {
      await setStatus.mutateAsync({ id: t.id, status });
      notify.success(`Threat marked ${STATUS_LABEL[status].toLowerCase()}`);
    } catch (err) {
      // A 409 here means the server rejected the transition — surface its
      // message rather than a generic failure, because it names the legal set.
      notify.error(describeApiError(toApiError(err)).message);
    }
  };

  return (
    <SlideOver
      open={id !== null}
      onClose={onClose}
      width={480}
      title={t?.title ?? "Threat"}
      footer={
        t && canWrite && t.allowedTransitions.length > 0 ? (
          <div className="w-full">
            <div className="mb-1.5 text-caption text-tertiary">Change status</div>
            <div className="flex flex-wrap gap-2">
              {/* Exactly the moves the server will accept. */}
              {t.allowedTransitions.map(next => (
                <Btn
                  key={next}
                  variant={next === "RESOLVED" ? "primary" : "outline"}
                  disabled={setStatus.isPending}
                  onClick={() => void transition(next)}
                >
                  {STATUS_LABEL[next]}
                </Btn>
              ))}
            </div>
          </div>
        ) : undefined
      }
    >
      {detail.isLoading && <ChartSkeleton height={300} label="Loading threat" />}

      {t && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <EntityAvatar icon="threat" tone={SEVERITY_TONE[t.severity]} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={SEVERITY_TONE[t.severity]}>{t.severity}</Badge>
                <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
              </div>
              <p className="mt-1.5 text-body-sm text-tertiary">
                {t.assetName} · detected {age(t.hoursSinceDetection)}
              </p>
            </div>
          </div>

          <p className="rounded-md border border-default bg-raised-2 px-3 py-2.5 text-body-sm text-secondary">
            {t.description}
          </p>

          <FieldGroup title="Record">
            <Field label="Severity" value={t.severity} />
            <Field label="Status" value={STATUS_LABEL[t.status]} />
            <Field label="Affected system" value={t.assetName} />
            <Field label="Detected" value={new Date(t.detectedAt).toLocaleString()} />
            {t.resolvedAt && <Field label="Resolved" value={new Date(t.resolvedAt).toLocaleString()} />}
          </FieldGroup>

          <Btn variant="outline" className="w-full" onClick={() => navigate(`/assets?open=${t.assetId}`)}>
            Open {t.assetName}
          </Btn>
        </div>
      )}
    </SlideOver>
  );
}
