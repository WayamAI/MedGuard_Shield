import { useMemo, useState } from "react";
import { Card, KPI, Badge, Btn, SlideOver, Input, Select, SectionHeader, HeadlineSkeleton } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataState } from "@/components/DataState";
import { useVendors } from "@/hooks/useVendors";
import type { ApiVendor, BaaStatus, RiskBand } from "@/lib/apiTypes";
import type { Tone } from "@/lib/tone";

/**
 * Vendor risk, backed by /api/vendors.
 *
 * The register deliberately leads with the compliance gap rather than the
 * score. A vendor touching PHI without a signed BAA is a HIPAA breach on its
 * own, whether or not anything has leaked, so that fact is surfaced at the top
 * instead of being one column among many.
 */

const BAND_TONE: Record<RiskBand, Tone> = {
  LOW: "success",
  MODERATE: "info",
  HIGH: "warning",
  CRITICAL: "danger",
  EXTREME: "danger",
};

/** Only SIGNED is compliant; the other three are each a different kind of gap. */
const BAA_TONE: Record<BaaStatus, Tone> = {
  SIGNED: "success",
  PENDING: "warning",
  EXPIRED: "danger",
  MISSING: "danger",
};

const BAA_LABEL: Record<BaaStatus, string> = {
  SIGNED: "Signed",
  PENDING: "Pending",
  EXPIRED: "Expired",
  MISSING: "Missing",
};

/** Worst first: the point of the page is what needs attention. */
const BAND_ORDER: RiskBand[] = ["EXTREME", "CRITICAL", "HIGH", "MODERATE", "LOW"];

const assessedLabel = (v: ApiVendor) =>
  v.lastAssessedAt === null
    ? "Never assessed"
    : `${v.daysSinceAssessment} days ago`;

export default function Vendors() {
  const vendors = useVendors();
  const [search, setSearch] = useState("");
  const [baa, setBaa] = useState("All");
  const [view, setView] = useState<ApiVendor | null>(null);

  const rows = useMemo(() => vendors.data ?? [], [vendors.data]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.risk.score - a.risk.score),
    [rows],
  );

  const filtered = useMemo(() => sorted.filter(v =>
    (search === "" || v.name.toLowerCase().includes(search.toLowerCase())) &&
    (baa === "All" || v.baaStatus === baa)
  ), [sorted, search, baa]);

  const counts = useMemo(() => ({
    total: rows.length,
    noBaa: rows.filter(v => !v.baaCompliant).length,
    overdue: rows.filter(v => v.assessmentOverdue).length,
    phiVolume: rows.reduce((sum, v) => sum + v.phiVolume, 0),
  }), [rows]);

  /** The headline exposure: no valid BAA *and* the highest score. */
  const worstGap = useMemo(
    () => sorted.find(v => !v.baaCompliant) ?? null,
    [sorted],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon="facility" label="Vendors" value={vendors.data ? String(counts.total) : undefined}
             accent="info" loading={vendors.isLoading} stale={vendors.isReconnecting} />
        <KPI icon="threats" label="Without a Valid BAA" value={vendors.data ? String(counts.noBaa) : undefined}
             trend={vendors.data ? "missing, expired or pending" : undefined}
             accent={counts.noBaa ? "danger" : "success"} loading={vendors.isLoading} stale={vendors.isReconnecting} />
        <KPI icon="clock" label="Assessment Overdue" value={vendors.data ? String(counts.overdue) : undefined}
             accent={counts.overdue ? "warning" : "success"} loading={vendors.isLoading} stale={vendors.isReconnecting} />
        <KPI icon="database" label="PHI Records Exposed" value={vendors.data ? counts.phiVolume.toLocaleString() : undefined}
             trend={vendors.data ? "across all vendors" : undefined}
             accent="info" loading={vendors.isLoading} stale={vendors.isReconnecting} />
      </div>

      {vendors.isLoading ? <HeadlineSkeleton /> : worstGap && (
        <div className="flex items-center gap-3 rounded-md border border-feedback-error-stroke bg-feedback-error-background p-3">
          <AppIcon name="threats" size="md" className="text-feedback-error" />
          <span className="text-body-md text-primary">
            <span className="font-semibold">BAA gap:</span>{" "}
            {worstGap.name} holds {worstGap.phiVolume.toLocaleString()} PHI records across{" "}
            {worstGap.assetCount} {worstGap.assetCount === 1 ? "system" : "systems"} with a{" "}
            <span className="font-semibold">{BAA_LABEL[worstGap.baaStatus].toLowerCase()}</span>{" "}
            business associate agreement — {assessedLabel(worstGap).toLowerCase()}.
          </span>
          <div className="flex-1" />
          <Btn variant="outline" onClick={() => setView(worstGap)}>View Details</Btn>
        </div>
      )}

      <Card className="p-4">
        <SectionHeader
          title="Vendor Risk Register"
          subtitle="Third parties with access to PHI, scored by the same engine as asset risk. Ordered by score, worst first."
        />

        <div className="flex flex-wrap gap-2 mb-3">
          <Input placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
          <Select value={baa} onChange={e => setBaa(e.target.value)}>
            {["All", "SIGNED", "PENDING", "EXPIRED", "MISSING"].map(o => <option key={o}>{o}</option>)}
          </Select>
          <div className="flex-1" />
          <Btn variant="outline" onClick={() => vendors.refresh()} disabled={vendors.isFetching}>
            {vendors.isFetching ? "Refreshing…" : "Refresh"}
          </Btn>
        </div>

        <DataState
          query={vendors}
          height={320}
          emptyTitle="No vendors recorded"
          emptyMessage="The API returned no vendors. If the backend was just set up, run the seed script."
        >
          {() => (
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead className="sticky top-0 z-10 bg-raised text-tertiary uppercase text-caption">
                  <tr className="border-b border-default">
                    {["Vendor", "BAA", "Systems", "PHI records", "Last assessed", "Score", "Band", ""].map(h => (
                      <th key={h} className="text-left py-2 px-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(v => (
                    <tr key={v.id} className="border-b border-default hover:bg-raised-2">
                      <td className="py-2 px-2 text-primary">{v.name}</td>
                      <td className="px-2"><Badge tone={BAA_TONE[v.baaStatus]}>{BAA_LABEL[v.baaStatus]}</Badge></td>
                      <td className="px-2 tabular">{v.assetCount}</td>
                      <td className="px-2 tabular">{v.phiVolume.toLocaleString()}</td>
                      <td className={`px-2 ${v.assessmentOverdue ? "text-feedback-warning" : "text-tertiary"}`}>
                        {assessedLabel(v)}
                        {v.assessmentOverdue && " · overdue"}
                      </td>
                      <td className="px-2 tabular">{v.risk.score}</td>
                      <td className="px-2"><Badge tone={BAND_TONE[v.risk.band]}>{v.risk.band}</Badge></td>
                      <td className="px-2"><Btn variant="outline" onClick={() => setView(v)}>View</Btn></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
      </Card>

      <Card className="p-4">
        <SectionHeader title="Risk by Band" subtitle="How vendor exposure is distributed." />
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {BAND_ORDER.map(band => {
            const n = rows.filter(v => v.risk.band === band).length;
            return (
              <div key={band} className="flex items-center gap-2">
                <Badge tone={BAND_TONE[band]}>{band}</Badge>
                {/* A count derived from an empty array is not a loading state,
                    it is a wrong answer: "0 vendors at EXTREME" is the most
                    reassuring thing this page could say, and it would be a lie. */}
                {vendors.data
                  ? <span className="tabular text-body-sm text-secondary">{n}</span>
                  : <span className="inline-block h-4 w-3 animate-pulse rounded bg-raised-2" />}
              </div>
            );
          })}
        </div>
      </Card>

      <SlideOver open={!!view} onClose={() => setView(null)} title={view?.name} width={360}>
        {view && (
          <div className="space-y-3 text-body-md">
            <div className="flex gap-2">
              <Badge tone={BAA_TONE[view.baaStatus]}>BAA {BAA_LABEL[view.baaStatus]}</Badge>
              <Badge tone={BAND_TONE[view.risk.band]}>{view.risk.band}</Badge>
            </div>
            <Row label="Risk score" value={String(view.risk.score)} />
            <Row label="PHI records" value={view.phiVolume.toLocaleString()} />
            <Row label="Systems reachable" value={String(view.assetCount)} />
            <Row label="Last assessed" value={assessedLabel(view)} />
            <Row label="Assessment overdue" value={view.assessmentOverdue ? "Yes" : "No"} />

            <div>
              <div className="text-body-sm text-tertiary mb-1.5">Systems this vendor can reach</div>
              <ul className="space-y-1">
                {view.assets.map(a => (
                  <li key={a} className="flex items-center gap-2 text-body-sm text-primary">
                    <AppIcon name="server" size="sm" className="text-icon-tertiary" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>

            {!view.baaCompliant && (
              <p className="rounded border border-feedback-error-stroke bg-feedback-error-background p-2 text-body-sm text-feedback-error">
                Under HIPAA, a vendor processing PHI without a signed BAA is a compliance breach in
                itself — independent of whether any data has been exposed.
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
    <span className="text-primary tabular">{value}</span>
  </div>
);
