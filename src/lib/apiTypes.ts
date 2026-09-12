/**
 * Wire types for the MedGuard backend.
 *
 * These mirror the API contract exactly as the backend declares it. They are
 * deliberately separate from the component prop types: components keep their
 * own shapes, and `src/lib/mappers.ts` translates between the two. When the
 * backend changes a field name, only this file and the mappers move.
 */

/** GET /api/dataflows — one record per PHI flow between two systems. */
export type ApiDataFlow = {
  source: string;
  target: string;
  phiType: string;
  recordsPerDay: number;
  encrypted: boolean;
  /**
   * Optional third state. `encrypted` alone is a boolean and can only express
   * compliant/violation, but the Sankey renders three tones. If the backend
   * supplies this, it wins; otherwise tone falls back to `encrypted`.
   */
  status?: "ok" | "warn" | "violation";
};

/** GET /api/risks — one row per scored asset. */
export type RiskBand = "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "EXTREME";

export type ApiRisk = {
  id: number;
  assetId: number;
  assetName: string;
  likelihood: number;
  impact: number;
  exposure: number;
  controlGap: number;
  /** 0-100, from likelihood x impact x exposure x controlGap. Authoritative. */
  score: number;
  band: RiskBand;
  computedAt: string;
};

/** GET /api/assets — a monitored system, service or data store. */
export type ApiAsset = {
  id: string;
  name: string;
  type: string;
  department?: string;
  phiRecords?: number;
  riskBand?: "low" | "moderate" | "high" | "critical";
};

/** GET /api/vendors — third parties with access to PHI. */
export type BaaStatus = "SIGNED" | "PENDING" | "EXPIRED" | "MISSING";

export type ApiVendor = {
  id: number;
  name: string;
  baaStatus: BaaStatus;
  phiVolume: number;
  /** null when the vendor has never been assessed. */
  lastAssessedAt: string | null;
  daysSinceAssessment: number | null;
  assessmentOverdue: boolean;
  /** The API's own judgement: only SIGNED counts as compliant. */
  baaCompliant: boolean;
  assetCount: number;
  assets: string[];
  risk: { score: number; band: RiskBand; computedAt: string };
};
