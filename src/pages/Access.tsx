import { useMemo, useState } from "react";
import { Card, KPI, Badge, Btn, SlideOver, Input, Select, SectionHeader, HeadlineSkeleton } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataState } from "@/components/DataState";
import { useAccess } from "@/hooks/useAccess";
import type { AccessFlag, AccessLevel, ApiAccessGrant } from "@/lib/apiTypes";
import type { Tone } from "@/lib/tone";

/**
 * Identity and access review, backed by /api/access.
 *
 * The page is ordered by risk rather than alphabetically, because the point of
 * an access review is to find the grants nobody has looked at. A contractor who
 * left months ago still holding admin on a PHI store is the finding; burying it
 * in a sorted list of nine rows would waste the data.
 *
 * Summary counts come from the API rather than being recomputed here, so the
 * headline numbers cannot drift from what the server asserts.
 */

const FLAG_LABEL: Record<AccessFlag, string> = {
  STALE: "Stale",
  NEVER_USED: "Never used",
  NO_MFA: "No MFA",
  INACTIVE_IDENTITY: "Inactive identity",
  EXCESSIVE_LEVEL: "Excessive level",
};

/** Inactive-but-live and never-used are the two that read as outright wrong. */
const FLAG_TONE: Record<AccessFlag, Tone> = {
  STALE: "warning",
  NEVER_USED: "danger",
  NO_MFA: "warning",
  INACTIVE_IDENTITY: "danger",
  EXCESSIVE_LEVEL: "warning",
};

const LEVEL_TONE: Record<AccessLevel, Tone> = {
  READ: "muted",
  WRITE: "info",
  ADMIN: "danger",
};

const usedLabel = (g: ApiAccessGrant) =>
  g.lastUsedAt === null ? "Never used" : `${g.daysSinceUse} days ago`;

export default function Access() {
  const access = useAccess();
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("All");
  const [onlyFlagged, setOnlyFlagged] = useState("All");
  const [view, setView] = useState<ApiAccessGrant | null>(null);

  const summary = access.data?.summary;
  const grants = useMemo(() => access.data?.grants ?? [], [access.data]);

  /** Worst first: most flags, then longest unused. */
  const sorted = useMemo(() => [...grants].sort((a, b) =>
    b.riskFlagCount - a.riskFlagCount ||
    (b.daysSinceUse ?? Number.MAX_SAFE_INTEGER) - (a.daysSinceUse ?? Number.MAX_SAFE_INTEGER)
  ), [grants]);

  const filtered = useMemo(() => sorted.filter(g =>
    (search === "" ||
      g.identityName.toLowerCase().includes(search.toLowerCase()) ||
      g.assetName.toLowerCase().includes(search.toLowerCase())) &&
    (level === "All" || g.level === level) &&
    (onlyFlagged === "All" || g.riskFlagCount > 0)
  ), [sorted, search, level, onlyFlagged]);

  /** The single grant most worth talking about. */
  const worst = sorted[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon="identity" label="Access Grants" value={summary ? String(summary.total) : undefined}
             accent="info" loading={access.isLoading} stale={access.isReconnecting} />
        <KPI icon="threats" label="Flagged" value={summary ? String(summary.flagged) : undefined}
             trend={summary ? `of ${summary.total} grants` : undefined}
             accent={summary?.flagged ? "danger" : "success"} loading={access.isLoading} stale={access.isReconnecting} />
        <KPI icon="locked" label="Without MFA" value={summary ? String(summary.withoutMfa) : undefined}
             accent={summary?.withoutMfa ? "warning" : "success"} loading={access.isLoading} stale={access.isReconnecting} />
        <KPI icon="clock" label="Stale or Never Used"
             value={summary ? String(summary.stale + summary.neverUsed) : undefined}
             trend={summary ? `unused past ${summary.staleAfterDays} days` : undefined}
             accent={summary && summary.stale + summary.neverUsed ? "warning" : "success"}
             loading={access.isLoading} stale={access.isReconnecting} />
      </div>

      {access.isLoading ? <HeadlineSkeleton /> : worst && worst.riskFlagCount > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-feedback-error-stroke bg-feedback-error-background p-3">
          <AppIcon name="threats" size="md" className="text-feedback-error" />
          <span className="text-body-md text-primary">
            <span className="font-semibold">Over-privileged grant:</span>{" "}
            {worst.identityName} still holds <span className="font-semibold">{worst.level}</span> on{" "}
            {worst.assetName}
            {!worst.active && " despite being a deactivated identity"}
            {worst.lastUsedAt === null
              ? ", and has never used it"
              : `, last used ${worst.daysSinceUse} days ago`}
            .
          </span>
          <div className="flex-1" />
          <Btn variant="outline" onClick={() => setView(worst)}>View Details</Btn>
        </div>
      )}

      <Card className="p-4">
        <SectionHeader
          title="Access Review"
          subtitle="Every identity with access to a PHI system, ordered by how much is wrong with the grant."
        />

        <div className="flex flex-wrap gap-2 mb-3">
          <Input placeholder="Search identity or system..." value={search}
                 onChange={e => setSearch(e.target.value)} className="w-56" />
          <Select value={level} onChange={e => setLevel(e.target.value)}>
            {["All", "ADMIN", "WRITE", "READ"].map(o => <option key={o}>{o}</option>)}
          </Select>
          <Select value={onlyFlagged} onChange={e => setOnlyFlagged(e.target.value)}>
            <option value="All">All grants</option>
            <option value="flagged">Flagged only</option>
          </Select>
          <div className="flex-1" />
          <Btn variant="outline" onClick={() => access.refresh()} disabled={access.isFetching}>
            {access.isFetching ? "Refreshing…" : "Refresh"}
          </Btn>
        </div>

        <DataState
          query={access}
          height={340}
          isEmpty={d => d.grants.length === 0}
          emptyTitle="No access grants recorded"
          emptyMessage="The API returned no grants. If the backend was just set up, run the seed script."
        >
          {() => (
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead className="sticky top-0 z-10 bg-raised text-tertiary uppercase text-caption">
                  <tr className="border-b border-default">
                    {["Identity", "Department", "System", "Level", "Last used", "Findings", ""].map(h => (
                      <th key={h} className="text-left py-2 px-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(g => (
                    <tr key={g.id} className="border-b border-default hover:bg-raised-2">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <AppIcon name={g.kind === "SERVICE_ACCOUNT" ? "server" : "practitioner"}
                                   size="sm" className="text-icon-tertiary" />
                          <span className={g.active ? "text-primary" : "text-tertiary line-through"}>
                            {g.identityName}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 text-tertiary">{g.department}</td>
                      <td className="px-2 text-tertiary">{g.assetName}</td>
                      <td className="px-2"><Badge tone={LEVEL_TONE[g.level]}>{g.level}</Badge></td>
                      <td className={`px-2 ${g.lastUsedAt === null || (g.daysSinceUse ?? 0) > 90 ? "text-feedback-warning" : "text-tertiary"}`}>
                        {usedLabel(g)}
                      </td>
                      <td className="px-2">
                        <div className="flex flex-wrap gap-1">
                          {g.flags.length === 0
                            ? <span className="text-tertiary">—</span>
                            : g.flags.map(f => (
                                <Badge key={f} tone={FLAG_TONE[f]}>{FLAG_LABEL[f]}</Badge>
                              ))}
                        </div>
                      </td>
                      <td className="px-2"><Btn variant="outline" onClick={() => setView(g)}>View</Btn></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
      </Card>

      <SlideOver open={!!view} onClose={() => setView(null)} title={view?.identityName} width={380}>
        {view && (
          <div className="space-y-3 text-body-md">
            <div className="flex flex-wrap gap-2">
              <Badge tone={LEVEL_TONE[view.level]}>{view.level}</Badge>
              <Badge tone={view.active ? "success" : "danger"}>{view.active ? "Active" : "Deactivated"}</Badge>
              <Badge tone={view.mfaEnabled ? "success" : "warning"}>{view.mfaEnabled ? "MFA on" : "No MFA"}</Badge>
            </div>
            <Row label="Identity type" value={view.kind === "SERVICE_ACCOUNT" ? "Service account" : "User"} />
            <Row label="Email" value={view.identityEmail ?? "—"} />
            <Row label="Department" value={view.department} />
            <Row label="System" value={`${view.assetName} (${view.assetType})`} />
            <Row label="Granted" value={`${view.daysSinceGrant} days ago`} />
            <Row label="Last used" value={usedLabel(view)} />

            {view.flags.length > 0 && (
              <div>
                <div className="text-body-sm text-tertiary mb-1.5">Findings</div>
                <div className="flex flex-wrap gap-1">
                  {view.flags.map(f => <Badge key={f} tone={FLAG_TONE[f]}>{FLAG_LABEL[f]}</Badge>)}
                </div>
              </div>
            )}

            {!view.active && (
              <p className="rounded border border-feedback-error-stroke bg-feedback-error-background p-2 text-body-sm text-feedback-error">
                This identity is deactivated but the grant is still live. Deprovisioning that stops
                at the directory and never reaches the system leaves exactly this gap.
              </p>
            )}
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
