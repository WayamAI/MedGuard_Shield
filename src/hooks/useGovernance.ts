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
  ApiControl, ApiPolicy, ApiRemediation, ApiRemediationDetail,
  ApiRemediationSummary, ApiAuditEntry, ApiIdentity, ApiOrganization,
  ApiSearchResponse, ControlStatus, PolicyStatus,
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

export function useControl(id: number | null): ApiQueryResult<ApiControl> {
  return useApiQuery<ApiControl>(
    ["control", id] as const, `/api/controls/${id}`, undefined, { enabled: id !== null },
  );
}

/* ---------------------------------------------------------------- policies */

export type PolicyListParams = {
  page?: number; pageSize?: number; search?: string;
  status?: PolicyStatus; includeArchived?: boolean;
};

export function usePolicies(params: PolicyListParams = {}, options?: ApiQueryOptions) {
  return useApiList<ApiPolicy>(policiesKey, "/api/policies", params, options);
}

export function usePolicy(id: number | null): ApiQueryResult<ApiPolicy> {
  return useApiQuery<ApiPolicy>(
    ["policy", id] as const, `/api/policies/${id}`, undefined, { enabled: id !== null },
  );
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
