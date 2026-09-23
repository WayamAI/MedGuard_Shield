/**
 * Controls, policies, remediation, audit, identities and the organisation.
 *
 * One file because they arrived together and share a shape: paginated,
 * organisation-scoped, and read via the same list plumbing as everything
 * else. Splitting them into six files of twelve lines each would spread one
 * idea across six places.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useApiQuery, useApiList,
  type ApiQueryResult, type ApiListResult, type ApiQueryOptions,
} from "@/hooks/useApiQuery";
import { api, type ApiError } from "@/lib/apiClient";
import type {
  ApiControl, ApiControlDetail, ApiPolicy, ApiPolicyDetail,
  ApiRemediation, ApiRemediationDetail,
  ApiRemediationSummary, ApiAuditEntry, ApiIdentity, ApiOrganization,
  ApiSearchResponse, ControlStatus, ControlCategory, ControlEffectiveness, PolicyStatus,
  RemediationStatus, RemediationSeverity,
} from "@/lib/apiTypes";

export const controlsKey = ["controls"] as const;
export const policiesKey = ["policies"] as const;
export const remediationsKey = ["remediations"] as const;
export const auditKey = ["audit"] as const;
export const identitiesKey = ["identities"] as const;
export const organizationKey = ["organization"] as const;

/* ---------------------------------------------------------------- controls */

export type ControlListParams = {
  page?: number; pageSize?: number; search?: string;
  status?: ControlStatus; category?: string; includeArchived?: boolean;
};

export function useControls(params: ControlListParams = {}, options?: ApiQueryOptions) {
  return useApiList<ApiControl>(controlsKey, "/api/controls", params, options);
}

export function useControl(id: number | null): ApiQueryResult<ApiControlDetail> {
  return useApiQuery<ApiControlDetail>(
    ["control", id] as const, `/api/controls/${id}`, undefined, { enabled: id !== null },
  );
}

/** Everything a control write can invalidate. A control feeds asset risk. */
function useInvalidateControls() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: controlsKey }),
      qc.invalidateQueries({ queryKey: ["control"] }),
      // Controls close control gaps, so the scoring engine may have re-run.
      qc.invalidateQueries({ queryKey: ["assets"] }),
      qc.invalidateQueries({ queryKey: ["risks"] }),
      qc.invalidateQueries({ queryKey: auditKey }),
    ]);
}

export type ControlWriteInput = {
  name: string;
  description: string;
  category: ControlCategory;
  status?: ControlStatus;
  effectiveness?: ControlEffectiveness;
  owner?: string | null;
  frameworkRef?: string | null;
  lastReviewedAt?: string | null;
};

/** POST /api/controls — ADMIN only (`control:create`). */
export function useCreateControl() {
  const invalidate = useInvalidateControls();
  return useMutation<ApiControl, ApiError, ControlWriteInput>({
    mutationFn: input => api.post<ApiControl>("/api/controls", input),
    onSuccess: invalidate,
  });
}

/**
 * PATCH /api/controls/:id.
 *
 * The admin/analyst line runs *through* this record rather than around it.
 * Recording how well a control is working — `status`, `effectiveness`,
 * `lastReviewedAt` — is assessment, which an ANALYST may do. Renaming it,
 * recategorising it or changing its owner or framework reference is
 * configuration, which is ADMIN-only. The server decides by reading the body
 * and names the offending fields in its 403; the UI must therefore send only
 * the fields it actually means to change.
 */
export const ANALYST_CONTROL_FIELDS = ["status", "effectiveness", "lastReviewedAt"] as const;

export function useUpdateControl() {
  const invalidate = useInvalidateControls();
  return useMutation<ApiControl, ApiError, { id: number; patch: Partial<ControlWriteInput> }>({
    mutationFn: ({ id, patch }) => api.patch<ApiControl>(`/api/controls/${id}`, patch),
    onSuccess: invalidate,
  });
}

/* ---------------------------------------------------------------- policies */

export type PolicyListParams = {
  page?: number; pageSize?: number; search?: string;
  status?: PolicyStatus; includeArchived?: boolean;
};

export function usePolicies(params: PolicyListParams = {}, options?: ApiQueryOptions) {
  return useApiList<ApiPolicy>(policiesKey, "/api/policies", params, options);
}

export function usePolicy(id: number | null): ApiQueryResult<ApiPolicyDetail> {
  return useApiQuery<ApiPolicyDetail>(
    ["policy", id] as const, `/api/policies/${id}`, undefined, { enabled: id !== null },
  );
}

function useInvalidatePolicies() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: policiesKey }),
      qc.invalidateQueries({ queryKey: ["policy"] }),
      qc.invalidateQueries({ queryKey: auditKey }),
    ]);
}

export type PolicyWriteInput = {
  name: string;
  description: string;
  status?: PolicyStatus;
  owner?: string | null;
  evidenceRef?: string | null;
  reviewDueAt?: string | null;
};

/**
 * POST and PATCH /api/policies — both ADMIN only. There is no analyst carve-out
 * here as there is for controls: a policy is a written document, and every
 * field of it is configuration.
 *
 * `evidenceRef` is a pointer the customer typed. The API stores it and never
 * dereferences or inspects it, and neither does this UI.
 */
export function useCreatePolicy() {
  const invalidate = useInvalidatePolicies();
  return useMutation<ApiPolicy, ApiError, PolicyWriteInput>({
    mutationFn: input => api.post<ApiPolicy>("/api/policies", input),
    onSuccess: invalidate,
  });
}

export function useUpdatePolicy() {
  const invalidate = useInvalidatePolicies();
  return useMutation<ApiPolicy, ApiError, { id: number; patch: Partial<PolicyWriteInput> }>({
    mutationFn: ({ id, patch }) => api.patch<ApiPolicy>(`/api/policies/${id}`, patch),
    onSuccess: invalidate,
  });
}

/* ------------------------------------------------------------- remediation */

export type RemediationListParams = {
  page?: number; pageSize?: number; search?: string;
  status?: RemediationStatus; severity?: RemediationSeverity;
  openOnly?: boolean; overdueOnly?: boolean;
  assetId?: number; vendorId?: number; ownerId?: number;
};

export function useRemediations(params: RemediationListParams = {}, options?: ApiQueryOptions) {
  return useApiList<ApiRemediation>(remediationsKey, "/api/remediations", params, options);
}

export function useRemediation(id: number | null): ApiQueryResult<ApiRemediationDetail> {
  return useApiQuery<ApiRemediationDetail>(
    ["remediation", id] as const, `/api/remediations/${id}`, undefined, { enabled: id !== null },
  );
}

export function useRemediationSummary(options?: ApiQueryOptions): ApiQueryResult<ApiRemediationSummary> {
  return useApiQuery<ApiRemediationSummary>(
    ["remediations", "summary"] as const, "/api/remediations/summary", undefined, options,
  );
}

/** Everything a remediation write can invalidate. */
function useInvalidateRemediation() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: remediationsKey }),
      qc.invalidateQueries({ queryKey: ["remediation"] }),
      qc.invalidateQueries({ queryKey: auditKey }),
    ]);
}

export type RemediationCreateInput = {
  title: string;
  description: string;
  recommendation: string;
  severity?: RemediationSeverity;
  source?: string;
  ownerId?: number;
  dueAt?: string | null;
  assetId?: number;
  vendorId?: number;
  threatId?: number;
};

export function useCreateRemediation() {
  const invalidate = useInvalidateRemediation();
  return useMutation<ApiRemediation, ApiError, RemediationCreateInput>({
    mutationFn: input => api.post<ApiRemediation>("/api/remediations", input),
    onSuccess: invalidate,
  });
}

/**
 * POST /api/remediations/:id/status.
 *
 * `ACCEPTED` means the risk was accepted without fixing, and the API keeps it
 * distinct from `RESOLVED` in every count. The UI must keep them distinct too:
 * collapsing them would turn "we decided to live with this" into "we fixed
 * it", which is the kind of difference an auditor exists to find.
 *
 * Note what this does NOT do — the API is explicit about it. Resolving
 * persists a status, a timestamp, an actor and an audit event. It does not
 * touch the asset, control or threat the finding points at. If the estate
 * needs to change, the estate has to be changed.
 */
export function useSetRemediationStatus() {
  const invalidate = useInvalidateRemediation();
  return useMutation<ApiRemediation, ApiError, { id: number; status: RemediationStatus }>({
    mutationFn: ({ id, status }) =>
      api.post<ApiRemediation>(`/api/remediations/${id}/status`, { status }),
    onSuccess: invalidate,
  });
}

export function useAssignRemediation() {
  const invalidate = useInvalidateRemediation();
  return useMutation<ApiRemediation, ApiError, { id: number; ownerId: number | null }>({
    mutationFn: ({ id, ownerId }) =>
      api.post<ApiRemediation>(`/api/remediations/${id}/assign`, { ownerId }),
    onSuccess: invalidate,
  });
}

/* ------------------------------------------------------------------- audit */

export type AuditListParams = {
  page?: number; pageSize?: number;
  action?: string; entityType?: string; entityId?: number;
  actorUserId?: number; from?: string; to?: string;
};

/**
 * GET /api/audit — ADMIN only, newest first, read-only.
 *
 * There is no write path: the only writer in the backend is its own audit
 * service. A UI that could add entries would make the trail worthless.
 */
export function useAudit(params: AuditListParams = {}, options?: ApiQueryOptions) {
  return useApiList<ApiAuditEntry>(auditKey, "/api/audit", params, options);
}

/* -------------------------------------------------------------- identities */

export type IdentityListParams = {
  page?: number; pageSize?: number; search?: string;
  kind?: string; active?: boolean; includeArchived?: boolean;
};

export function useIdentities(params: IdentityListParams = {}, options?: ApiQueryOptions) {
  return useApiList<ApiIdentity>(identitiesKey, "/api/identities", params, options);
}

/* ------------------------------------------------------------ organisation */

export function useOrganization(options?: ApiQueryOptions): ApiQueryResult<ApiOrganization> {
  return useApiQuery<ApiOrganization>(organizationKey, "/api/organization", undefined, options);
}

/* ------------------------------------------------------------------ search */

/**
 * GET /api/search — server-side, across every entity.
 *
 * Replaces the client-side scan that could only see what it had already
 * fetched. `enabled` gates it so nothing is requested for a palette nobody
 * has opened, and the query itself is debounced by the caller.
 */
export function useServerSearch(query: string, enabled: boolean): ApiQueryResult<ApiSearchResponse> {
  return useApiQuery<ApiSearchResponse>(
    ["search", query] as const,
    `/api/search?q=${encodeURIComponent(query)}`,
    undefined,
    { enabled: enabled && query.length >= 2, staleTime: 15_000, pollIntervalMs: 0, retry: 1 },
  );
}

/** GET /api/organization/members — the list a remediation owner picker needs. */
export type ApiMember = {
  userId: number;
  email: string;
  role: string;
  memberSince: string;
};

export function useOrgMembers(options?: ApiQueryOptions): ApiQueryResult<ApiMember[]> {
  return useApiQuery<ApiMember[]>(
    ["organization", "members"] as const, "/api/organization/members", undefined, options,
  );
}
