/**
 * Wire types for the Drishti backend.
 *
 * These mirror the API contract exactly as the backend declares it. They are
 * deliberately separate from the component prop types: components keep their
 * own shapes, and `src/lib/mappers.ts` translates between the two. When the
 * backend changes a field name, only this file and the mappers move.
 */

/** GET /api/dataflows — one record per PHI flow between two systems. */
export type ApiDataFlow = {
  id?: number;
  source: string;
  sourceAssetId?: number;
  target: string;
  targetAssetId?: number;
  phiType: string;
  phiTypeId?: number;
  sensitivity?: Sensitivity;
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
  assetType?: AssetType;
  assetArchived?: boolean;
  likelihood: number;
  impact: number;
  exposure: number;
  controlGap: number;
  /** 0-100, from likelihood x impact x exposure x controlGap. Authoritative. */
  score: number;
  band: RiskBand;
  computedAt: string;
};

/** The asset categories the API accepts, mirroring the Prisma AssetType enum. */
export const ASSET_TYPES = [
  "EHR", "DATABASE", "API", "CLOUD_STORAGE", "ANALYTICS", "OTHER",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

/** PHI sensitivity, as classified by the API. */
export type Sensitivity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * GET /api/assets — a monitored system, service or data store.
 *
 * Verified field-by-field against the live response and
 * `medguard-backend/src/services/assetService.ts#listAssets`. The previous
 * declaration here was fiction (`id: string`, `department`, `phiRecords`,
 * `riskBand`) and survived only because the sole consumer read `.length`.
 *
 * `risk` is null for an asset that has never been scored — the same shape the
 * vendor endpoint uses, and the same trap: with strictNullChecks off the
 * compiler will not enforce this, so read sites must guard by hand.
 */
export type ApiAsset = {
  id: number;
  name: string;
  type: AssetType;
  phiVolume: number;
  encrypted: boolean;
  mfaEnabled: boolean;
  /** null when the asset has never been assessed. */
  lastAssessedAt: string | null;
  createdAt: string;
  /** Non-null once archived. Archived assets are excluded unless asked for. */
  archivedAt: string | null;
  risk: { score: number; band: RiskBand; computedAt: string } | null;
  /** Server-computed fan-out, so a row can show its connections without N+1. */
  counts: {
    phiTypes: number;
    flows: number;
    accessGrants: number;
    openThreats: number;
    controls: number;
  };
};

/** GET /api/assets/:id — the list record plus everything it connects to. */
export type ApiAssetDetail = Omit<ApiAsset, "risk"> & {
  phiTypes: Array<{
    id: number;
    name: string;
    sensitivity: Sensitivity;
    recordsPerDay: number;
  }>;
  risk:
    | {
        id: number;
        likelihood: number;
        impact: number;
        exposure: number;
        controlGap: number;
        score: number;
        band: RiskBand;
        computedAt: string;
      }
    | null;
  flows: {
    outbound: Array<{ to: string; recordsPerDay: number; encrypted: boolean }>;
    inbound: Array<{ from: string; recordsPerDay: number; encrypted: boolean }>;
  };
};

/** POST /api/assets and PATCH /api/assets/:id request body. */
export type AssetWriteInput = {
  name: string;
  type: AssetType;
  phiVolume?: number;
  encrypted?: boolean;
  mfaEnabled?: boolean;
  lastAssessedAt?: string | null;
};

/**
 * GET /api/vendors/:id — the vendor plus the assets it can reach.
 *
 * Note `assets` here is a list of objects, while the list endpoint returns
 * `assets: string[]` plus `assetCount`. Two different shapes under one field
 * name, so the detail view must not be derived from a list row.
 */
export type ApiVendorDetail = {
  id: number;
  name: string;
  baaStatus: BaaStatus;
  phiVolume: number;
  lastAssessedAt: string | null;
  daysSinceAssessment: number | null;
  assessmentOverdue: boolean;
  baaCompliant: boolean;
  createdAt: string;
  assets: Array<{
    id: number;
    name: string;
    type: AssetType;
    encrypted: boolean;
    grantedAt: string;
  }>;
  risk:
    | {
        id: number;
        likelihood: number;
        impact: number;
        exposure: number;
        controlGap: number;
        score: number;
        band: RiskBand;
        computedAt: string;
      }
    | null;
};

/** POST /api/vendors and PATCH /api/vendors/:id request body. */
export type VendorWriteInput = {
  name: string;
  baaStatus?: BaaStatus;
  phiVolume?: number;
  lastAssessedAt?: string | null;
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
  /**
   * null when no risk record exists for the vendor — which is every vendor
   * created by CSV import, since the import writes the vendor and nothing
   * else. The server returns the field either way, so this must stay
   * nullable: claiming otherwise is what let an unscored vendor crash the
   * page while `tsc` reported no problem.
   */
  risk: { score: number; band: RiskBand; computedAt: string } | null;
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
  /** null when nobody has attested to this grant yet. */
  lastReviewedAt: string | null;
  /** Non-null once revoked; revoked grants are excluded unless asked for. */
  revokedAt: string | null;
  daysSinceUse: number | null;
  daysSinceGrant: number;
  flags: AccessFlag[];
  riskFlagCount: number;
};

/** GET /api/access/summary — organisation-wide, never derived from a page. */
export type ApiAccessSummary = {
  total: number;
  flagged: number;
  stale: number;
  neverUsed: number;
  withoutMfa: number;
  inactiveIdentities: number;
  excessiveLevel: number;
  /** Deliberately not a flag: it would fire on every row of a fresh estate. */
  neverReviewed: number;
  /** The threshold the server used to decide STALE. */
  staleAfterDays: number;
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

/** GET /api/threats/summary — organisation-wide. */
export type ApiThreatSummary = {
  total: number;
  open: number;
  bySeverity: Partial<Record<ThreatSeverity, number>>;
  byStatus: Partial<Record<ThreatStatus, number>>;
  openCritical: number;
};

/** GET /api/threats/:id — adds the transitions the server will actually accept. */
export type ApiThreatDetail = ApiThreat & {
  /** Render exactly these buttons; anything else is a guaranteed 409. */
  allowedTransitions: ThreatStatus[];
};

/* ---------------------------------------------------------------------------
   CSV import.

   Slugs are the server's, verified against GET /api/import — three of them
   are hyphenated and will 404 if guessed from the model name.
   -------------------------------------------------------------------------- */

export const IMPORT_ENTITIES = [
  "assets", "phi-types", "data-flows", "vendors", "access-grants", "threats", "risks",
] as const;

export type ImportEntity = (typeof IMPORT_ENTITIES)[number];

export type ImportColumnSpec = {
  column: string;
  type: "string" | "int" | "boolean" | "date" | "enum";
  required: boolean;
  values?: readonly string[];
  referencesModel?: string;
  description?: string;
};

/** One entry of GET /api/import — the column contract the server publishes. */
export type ImportEntityContract = {
  entity: ImportEntity;
  label: string;
  model: string;
  naturalKey: string[];
  naturalKeyLabel: string;
  columns: ImportColumnSpec[];
};

/**
 * `row` is the line number in the uploaded file with the header counted, so
 * the first data row reports 2. Shown as given — renumbering it would send
 * someone to the wrong line of their own file.
 */
export type ImportRowError = {
  row: number;
  field: string;
  message: string;
};

/**
 * Returned by validate (always 200, even when invalid) and by import. On a
 * failed import the same shape arrives nested under `error.report` in a 400.
 *
 * `preview` holds the rows that parsed, so it is populated even when
 * `valid` is false.
 */
export type ImportReport = {
  valid: boolean;
  totalRows: number;
  errors: ImportRowError[];
  preview: Record<string, unknown>[];
  /** Present on the import response; absent on a dry run. */
  imported?: number;
};
