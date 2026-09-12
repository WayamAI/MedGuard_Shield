import { useMemo, useState } from "react";
import { Card, KPI, Badge, Btn, SlideOver, Input, Select, SectionHeader } from "@/components/ui-bits";
import { toneVar, type Tone } from "@/lib/tone";
import { RiskMatrix } from "@/components/RiskMatrix";
import { DataState } from "@/components/DataState";
import { useRawRisks } from "@/hooks/useRisks";
import { toMatrixRisks } from "@/lib/mappers";
import type { ApiRisk, RiskBand } from "@/lib/apiTypes";

/**
 * Risk register, backed by /api/risks.
 *
 * The API scores each asset on likelihood x impact x exposure x control gap and
 * returns the band it derived. Owner, due date, category and workflow status
 * have no source on the wire yet, so those columns and the add/edit flows are
 * not rendered — an empty column reads as missing data, which in a compliance
 * tool is worse than an absent one.
 */

const BAND_TONE: Record<RiskBand, Tone> = {
  LOW: "success",
  MODERATE: "info",
  HIGH: "warning",
  CRITICAL: "danger",
  EXTREME: "danger",
};

const scoreTone = (s: number): Tone => s >= 80 ? "danger" : s >= 60 ? "warning" : s >= 40 ? "info" : "success";
const scoreColor = (s: number) => toneVar(scoreTone(s));

const idOf = (r: ApiRisk) => `R-${String(r.id).padStart(3, "0")}`;

export default function Risks() {
  const risks = useRawRisks();
  const [search, setSearch] = useState("");
  const [band, setBand] = useState("All");
  const [view, setView] = useState<ApiRisk | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const rows = useMemo(() => risks.data ?? [], [risks.data]);

  const matrixRisks = useMemo(() => toMatrixRisks(rows), [rows]);

  const filtered = useMemo(() => rows.filter(r =>
    (search === "" || r.assetName.toLowerCase().includes(search.toLowerCase())) &&
    (band === "All" || r.band === band)
  ), [rows, search, band]);

  const counts = useMemo(() => ({
    total: rows.length,
    severe: rows.filter(r => r.band === "CRITICAL" || r.band === "EXTREME").length,
    high: rows.filter(r => r.band === "HIGH").length,
    peak: rows.length ? Math.max(...rows.map(r => r.score)) : 0,
  }), [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon="risks" label="Assets Scored" value={risks.data ? String(counts.total) : undefined}
             accent="info" loading={risks.isLoading} stale={risks.isReconnecting} />
        <KPI icon="threats" label="Critical or Extreme" value={risks.data ? String(counts.severe) : undefined}
             accent="danger" loading={risks.isLoading} stale={risks.isReconnecting} />
        <KPI icon="activity" label="High" value={risks.data ? String(counts.high) : undefined}
             accent="warning" loading={risks.isLoading} stale={risks.isReconnecting} />
        <KPI icon="chart" label="Highest Score" value={risks.data ? String(counts.peak) : undefined}
             accent="danger" loading={risks.isLoading} stale={risks.isReconnecting} />
      </div>

      <Card className="p-4">
        <SectionHeader
          title="Risk Matrix"
          subtitle="Every scored asset plotted by likelihood and impact. Colour is the band the API derived. Select a chip to jump to its row."
        />
        <DataState
          query={risks}
          height={420}
          emptyTitle="No scored risks"
          emptyMessage="The API returned no risk rows. If the backend was just set up, run the seed script."
        >
          {() => (
            <RiskMatrix
              risks={matrixRisks}
              highlightId={highlightId}
              onSelect={(id) => {
                setHighlightId(id);
                document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />
          )}
        </DataState>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <Input placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)} className="w-44" />
          <Select value={band} onChange={e => setBand(e.target.value)}>
            {["All", "EXTREME", "CRITICAL", "HIGH", "MODERATE", "LOW"].map(o => <option key={o}>{o}</option>)}
          </Select>
          <div className="flex-1" />
          <Btn variant="outline" onClick={() => risks.refresh()} disabled={risks.isFetching}>
            {risks.isFetching ? "Refreshing…" : "Refresh"}
          </Btn>
        </div>

        <DataState query={risks} height={280} emptyTitle="No scored risks">
          {() => (
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead className="sticky top-0 z-10 bg-raised text-tertiary uppercase text-caption">
                  <tr className="border-b border-default">
                    {["ID", "Asset", "L", "I", "Exposure", "Control gap", "Score", "Band", ""].map(h => (
                      <th key={h} className="text-left py-2 px-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const id = idOf(r);
                    return (
                      <tr key={r.id} id={`row-${id}`} className={`border-b border-default hover:bg-raised-2 ${highlightId === id ? "bg-brand/10" : ""}`}>
                        <td className="py-2 px-2 font-mono">{id}</td>
                        <td className="px-2">{r.assetName}</td>
                        <td className="px-2 tabular">{r.likelihood}</td>
                        <td className="px-2 tabular">{r.impact}</td>
                        <td className="px-2 tabular">{r.exposure}</td>
                        <td className="px-2 tabular">{r.controlGap}</td>
                        <td className="px-2">
                          <div className="flex items-center gap-1.5">
                            <Badge tone={scoreTone(r.score)}>{r.score}</Badge>
                            <div className="w-16 h-1 bg-action rounded">
                              <div className="h-full" style={{ width: `${Math.min(100, r.score)}%`, background: scoreColor(r.score) }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-2"><Badge tone={BAND_TONE[r.band]}>{r.band}</Badge></td>
                        <td className="px-2"><Btn variant="outline" onClick={() => setView(r)}>View</Btn></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
      </Card>

      <SlideOver open={!!view} onClose={() => setView(null)} title={view?.assetName} width={340}>
        {view && (
          <div className="space-y-3 text-body-md">
            <Badge tone={BAND_TONE[view.band]}>{view.band}</Badge>
            <Row label="Risk ID" value={idOf(view)} />
            <Row label="Likelihood" value={String(view.likelihood)} />
            <Row label="Impact" value={String(view.impact)} />
            <Row label="Exposure" value={String(view.exposure)} />
            <Row label="Control gap" value={String(view.controlGap)} />
            <Row label="Score" value={String(view.score)} />
            <Row label="Last computed" value={new Date(view.computedAt).toLocaleString()} />
            <p className="text-body-sm text-tertiary">
              Score = likelihood x impact x exposure x control gap / 625 x 100, each input 1-5.
            </p>
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
