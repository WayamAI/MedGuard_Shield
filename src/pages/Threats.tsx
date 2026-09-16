import { useMemo, useState } from "react";
import { Card, KPI, Badge, Btn, SlideOver, Input, Select, SectionHeader, SeverityBadge, HeadlineSkeleton } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataState } from "@/components/DataState";
import { useThreats } from "@/hooks/useThreats";
import type { ApiThreat, ThreatStatus } from "@/lib/apiTypes";
import type { Tone } from "@/lib/tone";

/**
 * Threat detection, backed by /api/threats.
 *
 * Severity alone does not say what needs attention: a resolved CRITICAL is
 * history, an open one is now. The list therefore sorts open-before-closed
 * first and severity second, and the headline count is open criticals rather
 * than total threats.
 */

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

const SEVERITY_RANK: Record<ApiThreat["severity"], number> = {
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
};

/** Hours read badly past a couple of days; switch to days. */
const ageLabel = (hours: number) =>
  hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;

export default function Threats() {
  const threats = useThreats();
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("All");
  const [status, setStatus] = useState("All");
  const [view, setView] = useState<ApiThreat | null>(null);

  const summary = threats.data?.summary;
  const rows = useMemo(() => threats.data?.threats ?? [], [threats.data]);

  /** Open first, then by severity, then newest. */
  const sorted = useMemo(() => [...rows].sort((a, b) =>
    Number(b.open) - Number(a.open) ||
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    a.hoursSinceDetection - b.hoursSinceDetection
  ), [rows]);

  const filtered = useMemo(() => sorted.filter(t =>
    (search === "" ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.assetName.toLowerCase().includes(search.toLowerCase())) &&
    (severity === "All" || t.severity === severity) &&
    (status === "All" || t.status === status)
  ), [sorted, search, severity, status]);

  const headline = sorted.find(t => t.open && t.severity === "CRITICAL") ?? null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon="threats" label="Open Threats" value={summary ? String(summary.open) : undefined}
             trend={summary ? `of ${summary.total} detected` : undefined}
             accent={summary?.open ? "danger" : "success"} loading={threats.isLoading} stale={threats.isReconnecting} />
        <KPI icon="incident" label="Open Critical" value={summary ? String(summary.openCritical) : undefined}
             accent={summary?.openCritical ? "danger" : "success"} loading={threats.isLoading} stale={threats.isReconnecting} />
        <KPI icon="tasks" label="Investigating"
             value={summary ? String(summary.byStatus.INVESTIGATING ?? 0) : undefined}
             accent="warning" loading={threats.isLoading} stale={threats.isReconnecting} />
        <KPI icon="success" label="Resolved"
             value={summary ? String(summary.byStatus.RESOLVED ?? 0) : undefined}
             accent="success" loading={threats.isLoading} stale={threats.isReconnecting} />
      </div>

      {threats.isLoading ? <HeadlineSkeleton /> : headline && (
        <div className="flex items-center gap-3 rounded-md border border-feedback-error-stroke bg-feedback-error-background p-3">
          <AppIcon name="threats" size="md" className="text-feedback-error" />
          <span className="text-body-md text-primary">
            <span className="font-semibold">Open critical:</span> {headline.title} on{" "}
            {headline.assetName} — detected {ageLabel(headline.hoursSinceDetection)}, still{" "}
            {STATUS_LABEL[headline.status].toLowerCase()}.
          </span>
          <div className="flex-1" />
          <Btn variant="outline" onClick={() => setView(headline)}>View Details</Btn>
        </div>
      )}

      <Card className="p-4">
        <SectionHeader
          title="Detected Threats"
          subtitle="Open items first, then by severity. Resolved and false positives stay visible for context."
        />

        <div className="flex flex-wrap gap-2 mb-3">
          <Input placeholder="Search threats or systems..." value={search}
                 onChange={e => setSearch(e.target.value)} className="w-56" />
          <Select value={severity} onChange={e => setSeverity(e.target.value)}>
            {["All", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map(o => <option key={o}>{o}</option>)}
          </Select>
          <Select value={status} onChange={e => setStatus(e.target.value)}>
            {["All", "OPEN", "INVESTIGATING", "RESOLVED", "FALSE_POSITIVE"].map(o => <option key={o}>{o}</option>)}
          </Select>
          <div className="flex-1" />
          <Btn variant="outline" onClick={() => threats.refresh()} disabled={threats.isFetching}>
            {threats.isFetching ? "Refreshing…" : "Refresh"}
          </Btn>
        </div>

        <DataState
          query={threats}
          height={340}
          isEmpty={d => d.threats.length === 0}
          emptyTitle="No threats detected"
          emptyMessage="The API returned no threats. If the backend was just set up, run the seed script."
        >
          {() => (
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead className="sticky top-0 z-10 bg-raised text-tertiary uppercase text-caption">
                  <tr className="border-b border-default">
                    {["Severity", "Threat", "System", "Detected", "Status", ""].map(h => (
                      <th key={h} className="text-left py-2 px-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} className={`border-b border-default hover:bg-raised-2 ${t.open ? "" : "opacity-60"}`}>
                      <td className="py-2 px-2"><SeverityBadge sev={t.severity} /></td>
                      <td className="px-2 text-primary">{t.title}</td>
                      <td className="px-2 text-tertiary">{t.assetName}</td>
                      <td className="px-2 tabular text-tertiary">{ageLabel(t.hoursSinceDetection)}</td>
                      <td className="px-2"><Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge></td>
                      <td className="px-2"><Btn variant="outline" onClick={() => setView(t)}>View</Btn></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
      </Card>

      <SlideOver open={!!view} onClose={() => setView(null)} title={view?.title} width={400}>
        {view && (
          <div className="space-y-3 text-body-md">
            <div className="flex flex-wrap gap-2">
              <SeverityBadge sev={view.severity} />
              <Badge tone={STATUS_TONE[view.status]}>{STATUS_LABEL[view.status]}</Badge>
            </div>
            <p className="text-body-md text-secondary">{view.description}</p>
            <Row label="System" value={`${view.assetName} (${view.assetType})`} />
            <Row label="Detected" value={new Date(view.detectedAt).toLocaleString()} />
            <Row label="Age" value={ageLabel(view.hoursSinceDetection)} />
            <Row label="Resolved" value={view.resolvedAt ? new Date(view.resolvedAt).toLocaleString() : "—"} />
          </div>
        )}
      </SlideOver>
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-default last:border-0">
    <span className="text-body-sm text-tertiary">{label}</span>
    <span className="text-primary">{value}</span>
  </div>
);
