import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type Band = "low" | "moderate" | "high" | "critical" | "extreme";

export type MatrixRisk = {
  id: string;
  name: string;
  L: number;
  I: number;
  /**
   * The API's band. Authoritative when present: the backend scores on
   * likelihood x impact x exposure x controlGap, which L x I alone cannot
   * reproduce. Absent (e.g. hand-entered rows), we fall back to L x I.
   */
  band?: Band;
  cat?: string;
  status?: string;
};

/**
 * Likelihood x Impact matrix.
 *
 * The previous version drew bare dots on a faint SVG grid: you could see that
 * something sat in a cell, but not what band it fell into, how many risks
 * shared a cell, or what the axes actually meant. This version makes the
 * grid self-explanatory:
 *   - every cell states its own L x I product, so the scoring rule is visible
 *   - cells are filled by severity band, with a legend that carries counts
 *   - risks render as labelled chips inside their cell and stack when they share one
 *   - hovering a cell cross-highlights its row and column headers
 */

const LIKELIHOOD = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
const IMPACT = ["Negligible", "Minor", "Moderate", "Major", "Catastrophic"];

/** Standard 5x5 risk banding on the L x I product. */
/** Clamp an API-supplied 1-5 axis value onto a 0-based grid index. */
const cellIndex = (v: number) =>
  Number.isFinite(v) ? Math.min(5, Math.max(1, Math.round(v))) - 1 : 0;

const bandOf = (score: number): Band =>
  score >= 15 ? "critical" : score >= 10 ? "high" : score >= 5 ? "moderate" : "low";

/** Worst band first: used for legend order and for picking a cell's fill. */
const ORDER: Band[] = ["extreme", "critical", "high", "moderate", "low"];

const BAND_LABEL: Record<Band, string> = {
  low: "Low", moderate: "Moderate", high: "High", critical: "Critical", extreme: "Extreme",
};

/** Cell fill + the chip fill used for risks sitting in that band. */
const BAND_CELL: Record<Band, string> = {
  low: "bg-matrix-low",
  moderate: "bg-matrix-moderate",
  high: "bg-matrix-high",
  critical: "bg-matrix-critical",
  extreme: "bg-matrix-extreme",
};

const BAND_CHIP: Record<Band, string> = {
  low: "bg-solid-success text-on-solid-success",
  moderate: "bg-solid-low text-on-solid-low",
  high: "bg-solid-medium text-on-solid-medium",
  critical: "bg-solid-high text-on-solid-high",
  extreme: "bg-solid-critical text-on-solid-critical",
};

const BAND_SWATCH: Record<Band, string> = {
  low: "bg-solid-success",
  moderate: "bg-solid-low",
  high: "bg-solid-medium",
  critical: "bg-solid-high",
  extreme: "bg-solid-critical",
};

export function RiskMatrix({
  risks,
  onSelect,
  highlightId,
}: {
  risks: MatrixRisk[];
  onSelect: (id: string) => void;
  highlightId?: string | null;
}) {
  const [hover, setHover] = useState<{ l: number; i: number } | null>(null);

  /** cellRisks[likelihood][impact], both 1-indexed into 0-based arrays. */
  const cellRisks = useMemo(() => {
    const grid: MatrixRisk[][][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => [] as MatrixRisk[]),
    );
    for (const r of risks) {
      // A non-finite L or I from the API would index the grid with NaN and
      // take the matrix down; park those in the lowest cell instead.
      grid[cellIndex(r.L)][cellIndex(r.I)].push(r);
    }
    return grid;
  }, [risks]);

  /** API band when the row carries one, else the L x I fallback. */
  const bandForRisk = (r: MatrixRisk): Band =>
    r.band ?? bandOf((cellIndex(r.L) + 1) * (cellIndex(r.I) + 1));

  const bandCounts = useMemo(() => {
    const c: Record<Band, number> = { low: 0, moderate: 0, high: 0, critical: 0, extreme: 0 };
    for (const r of risks) c[bandForRisk(r)]++;
    return c;
  }, [risks]);

  /** True when the rows are scored server-side, which changes what the legend can honestly claim. */
  const serverScored = risks.some(r => r.band !== undefined);

  return (
    <div>
      {/* Legend doubles as a distribution summary. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {ORDER.map(b => (
          <div key={b} className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-sm", BAND_SWATCH[b])} />
            <span className="text-label-sm text-secondary">{BAND_LABEL[b]}</span>
            {!serverScored && (
              <span className="tabular text-caption text-quaternary">
                {b === "extreme" ? "—" : b === "critical" ? "15-25" : b === "high" ? "10-14" : b === "moderate" ? "5-9" : "1-4"}
              </span>
            )}
            <span className="tabular rounded-full bg-action px-1.5 text-caption text-secondary">{bandCounts[b]}</span>
          </div>
        ))}
        <span className="ml-auto text-caption text-quaternary">
          {serverScored
            ? "Band = Likelihood x Impact x Exposure x Control gap (API)"
            : "Score = Likelihood x Impact"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-[640px] gap-2">
          {/* Y axis caption */}
          <div className="flex w-6 items-center justify-center">
            <span className="whitespace-nowrap text-caption font-medium uppercase tracking-wider text-tertiary"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              Likelihood
            </span>
          </div>

          <div className="flex-1">
            {/* Rows run high likelihood at the top, the conventional reading order. */}
            {[4, 3, 2, 1, 0].map(l => (
              <div key={l} className="flex gap-1.5 pb-1.5">
                <div
                  className={cn(
                    "flex w-28 shrink-0 flex-col justify-center pr-2 text-right transition-colors duration-150",
                    hover?.l === l ? "text-primary" : "text-tertiary",
                  )}
                >
                  <span className="text-label-sm leading-tight">{LIKELIHOOD[l]}</span>
                  <span className="tabular text-caption text-quaternary">L={l + 1}</span>
                </div>

                {[0, 1, 2, 3, 4].map(i => {
                  const score = (l + 1) * (i + 1);
                  const items = cellRisks[l][i];
                  // With server scoring, two risks in the same cell can differ,
                  // so the cell takes the worst band present and each chip keeps
                  // its own. Empty cells fall back to the positional band.
                  const band = items.length
                    ? ORDER.find(b => items.some(r => bandForRisk(r) === b)) ?? bandOf(score)
                    : bandOf(score);
                  return (
                    <div
                      key={i}
                      onMouseEnter={() => setHover({ l, i })}
                      onMouseLeave={() => setHover(null)}
                      className={cn(
                        "relative min-h-[68px] flex-1 rounded-md border border-matrix-stroke p-1.5 transition-all duration-150",
                        BAND_CELL[band],
                        (hover?.l === l || hover?.i === i) && "brightness-125",
                      )}
                    >
                      <span className="tabular absolute right-1.5 top-1 text-caption text-quaternary/70">{score}</span>
                      <div className="flex flex-wrap gap-1 pt-3.5">
                        {items.map(r => (
                          <button
                            key={r.id}
                            type="button"
                            title={`${r.id} · ${r.name}${r.cat ? ` · ${r.cat}` : ""} · L${cellIndex(r.L) + 1} x I${cellIndex(r.I) + 1} · ${BAND_LABEL[bandForRisk(r)]}`}
                            onClick={() => onSelect(r.id)}
                            className={cn(
                              "tabular rounded px-1.5 py-0.5 text-caption font-semibold transition-transform duration-150 hover:scale-105",
                              BAND_CHIP[bandForRisk(r)],
                              highlightId === r.id && "ring-2 ring-brand ring-offset-1 ring-offset-raised",
                              r.status === "Closed" && "opacity-45 line-through",
                            )}
                          >
                            {r.id.replace("R-", "")}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* X axis */}
            <div className="flex gap-1.5">
              <div className="w-28 shrink-0" />
              {IMPACT.map((label, i) => (
                <div
                  key={label}
                  className={cn(
                    "flex-1 pt-1 text-center transition-colors duration-150",
                    hover?.i === i ? "text-primary" : "text-tertiary",
                  )}
                >
                  <div className="text-label-sm leading-tight">{label}</div>
                  <div className="tabular text-caption text-quaternary">I={i + 1}</div>
                </div>
              ))}
            </div>
            <div className="mt-1 pl-28 text-center text-caption font-medium uppercase tracking-wider text-tertiary">
              Impact
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RiskMatrix;
