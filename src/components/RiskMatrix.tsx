import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type MatrixRisk = { id: string; name: string; cat: string; L: number; I: number; status: string };

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

type Band = "low" | "moderate" | "high" | "critical";

/** Standard 5x5 risk banding on the L x I product. */
const bandOf = (score: number): Band =>
  score >= 15 ? "critical" : score >= 10 ? "high" : score >= 5 ? "moderate" : "low";

const BAND_LABEL: Record<Band, string> = {
  low: "Low", moderate: "Moderate", high: "High", critical: "Critical",
};

/** Cell fill + the chip fill used for risks sitting in that band. */
const BAND_CELL: Record<Band, string> = {
  low: "bg-matrix-low",
  moderate: "bg-matrix-moderate",
  high: "bg-matrix-high",
  critical: "bg-matrix-critical",
};

const BAND_CHIP: Record<Band, string> = {
  low: "bg-solid-success text-on-solid-success",
  moderate: "bg-solid-high text-on-solid-high",
  high: "bg-solid-medium text-on-solid-medium",
  critical: "bg-solid-critical text-on-solid-critical",
};

const BAND_SWATCH: Record<Band, string> = {
  low: "bg-solid-success",
  moderate: "bg-solid-high",
  high: "bg-solid-medium",
  critical: "bg-solid-critical",
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
      const l = Math.min(5, Math.max(1, r.L)) - 1;
      const i = Math.min(5, Math.max(1, r.I)) - 1;
      grid[l][i].push(r);
    }
    return grid;
  }, [risks]);

  const bandCounts = useMemo(() => {
    const c: Record<Band, number> = { low: 0, moderate: 0, high: 0, critical: 0 };
    for (const r of risks) c[bandOf(r.L * r.I)]++;
    return c;
  }, [risks]);

  return (
    <div>
      {/* Legend doubles as a distribution summary. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {(["critical", "high", "moderate", "low"] as Band[]).map(b => (
          <div key={b} className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-sm", BAND_SWATCH[b])} />
            <span className="text-label-sm text-secondary">{BAND_LABEL[b]}</span>
            <span className="tabular text-caption text-quaternary">
              {b === "critical" ? "15-25" : b === "high" ? "10-14" : b === "moderate" ? "5-9" : "1-4"}
            </span>
            <span className="tabular rounded-full bg-action px-1.5 text-caption text-secondary">{bandCounts[b]}</span>
          </div>
        ))}
        <span className="ml-auto text-caption text-quaternary">Score = Likelihood x Impact</span>
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
                  const band = bandOf(score);
                  const items = cellRisks[l][i];
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
                            title={`${r.id} · ${r.name} · ${r.cat} · score ${score} (${BAND_LABEL[band]})`}
                            onClick={() => onSelect(r.id)}
                            className={cn(
                              "tabular rounded px-1.5 py-0.5 text-caption font-semibold transition-transform duration-150 hover:scale-105",
                              BAND_CHIP[band],
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
