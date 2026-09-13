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

/* ---------------------------------------------------------------------------
   GET /api/access — identity and access review.

   Note the envelope: this endpoint returns an object, not a bare array. The
   server computes the summary itself rather than leaving the client to derive
   it, so the two can never disagree.
   -------------------------------------------------------------------------- */

export type AccessFlag =
  | "STALE"              // not used within staleAfterDays
  | "NEVER_USED"         // granted and never exercised
  | "NO_MFA"             // identity has no second factor
  | "INACTIVE_IDENTITY"  // person or account is deactivated, grant still live
  | "EXCESSIVE_LEVEL";   // level exceeds what the role needs

export type AccessLevel = "READ" | "WRITE" | "ADMIN";
export type IdentityKind = "USER" | "SERVICE_ACCOUNT";

export type ApiAccessGrant = {
  id: number;
  identityId: number;
  identityName: string;
  /** null for service accounts. */
  identityEmail: string | null;
  kind: IdentityKind;
  department: string;
  active: boolean;
  mfaEnabled: boolean;
  assetId: number;
  assetName: string;
  assetType: string;
  level: AccessLevel;
  grantedAt: string;
  /** null when the grant has never been used. */
  lastUsedAt: string | null;
  daysSinceUse: number | null;
  daysSinceGrant: number;
  flags: AccessFlag[];
  riskFlagCount: number;
};

export type ApiAccessResponse = {
  summary: {
    total: number;
    flagged: number;
    stale: number;
    neverUsed: number;
    withoutMfa: number;
    inactiveIdentities: number;
    excessiveLevel: number;
    /** The threshold the server used to decide STALE. */
    staleAfterDays: number;
  };
  grants: ApiAccessGrant[];
};

/* ---------------------------------------------------------------------------
   GET /api/threats — detected threats. Same envelope shape as access.
   -------------------------------------------------------------------------- */

export type ThreatSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ThreatStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "FALSE_POSITIVE";

export type ApiThreat = {
  id: number;
  severity: ThreatSeverity;
  status: ThreatStatus;
  title: string;
  description: string;
  assetId: number;
  assetName: string;
  assetType: string;
  detectedAt: string;
  resolvedAt: string | null;
  hoursSinceDetection: number;
  /** Server's own view of "still needs attention". */
  open: boolean;
};

export type ApiThreatsResponse = {
  summary: {
    total: number;
    open: number;
    bySeverity: Partial<Record<ThreatSeverity, number>>;
    byStatus: Partial<Record<ThreatStatus, number>>;
    openCritical: number;
  };
  threats: ApiThreat[];
};
