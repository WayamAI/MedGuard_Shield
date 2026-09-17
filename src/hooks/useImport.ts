/**
 * CSV import: the column contract, the dry run, and the commit.
 *
 * The two writes are deliberately separate hooks rather than one call with a
 * flag. Validate and import hit different endpoints, and the whole point of
 * the flow is that a person decides between them — a single entry point with
 * a boolean is exactly the shape that eventually gets called with the wrong
 * boolean.
 */
import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/apiClient";
import { useApiQuery, type ApiQueryResult, type ApiQueryOptions } from "@/hooks/useApiQuery";
import { assetsKey } from "@/hooks/useAssets";
import { risksKey } from "@/hooks/useRisks";
import { dataFlowsKey } from "@/hooks/useDataFlows";
import { vendorsKey } from "@/hooks/useVendors";
import { accessKey } from "@/hooks/useAccess";
import { threatsKey } from "@/hooks/useThreats";
import type { ImportEntity, ImportEntityContract, ImportReport } from "@/lib/apiTypes";

export const importEntitiesKey = ["import", "entities"] as const;

/** GET /api/import — every entity's columns, types and allowed values. */
export function useImportEntities(options?: ApiQueryOptions): ApiQueryResult<ImportEntityContract[]> {
  return useApiQuery<ImportEntityContract[]>(importEntitiesKey, "/api/import", undefined, {
    // The column contract changes when the server is redeployed, not while
    // someone is filling in a form. No heartbeat needed.
    pollIntervalMs: 60 * 60_000,
    staleTime: 5 * 60_000,
    ...options,
  });
}

/**
 * Every read the imported rows could touch.
 *
 * Deliberately not narrowed to the entity that was imported: an asset import
 * changes the risk register and the flow map through the server's own
 * scoring, and a stale Dashboard after a successful import is a worse failure
 * than four redundant refetches.
 */
const ALL_DATA_KEYS = [assetsKey, risksKey, dataFlowsKey, vendorsKey, accessKey, threatsKey];

/**
 * Pulls the per-row report out of whatever the server returned.
 *
 * A failed import is a 400 whose body carries the same report under
 * `error.report`, so the caller can render one error table for both the dry
 * run and the commit instead of two.
 */
export function reportFromError(err: unknown): ImportReport | null {
  if (!(err instanceof ApiError)) return null;
  const body = err.body;
  if (!body || typeof body !== "object") return null;
  const wrapper = (body as { error?: { report?: unknown } }).error;
  const report = wrapper?.report;
  if (!report || typeof report !== "object") return null;
  const candidate = report as Partial<ImportReport>;
  if (typeof candidate.valid !== "boolean" || !Array.isArray(candidate.errors)) return null;
  return candidate as ImportReport;
}

export type ImportMutation = {
  run: (file: File) => Promise<void>;
  report: ImportReport | null;
  /** Set only for failures that are not a per-row report — 401, 413, offline. */
  error: ApiError | null;
  isPending: boolean;
  reset: () => void;
};

/**
 * One upload, one report.
 *
 * Both endpoints take the same multipart body and answer with the same
 * report, so the difference between a dry run and a commit is the path and
 * what happens afterwards — not the shape of this hook.
 */
function useCsvUpload(path: string, onSuccess?: (report: ImportReport) => void): ImportMutation {
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const mutation = useMutation<ImportReport, ApiError, File>({
    mutationFn: (file: File) => api.upload<ImportReport>(path, file),
    retry: false,
  });

  const { mutateAsync } = mutation;

  const run = useCallback(async (file: File) => {
    setReport(null);
    setError(null);
    try {
      const result = await mutateAsync(file);
      setReport(result);
      onSuccess?.(result);
    } catch (err) {
      // A rejected row set is an answer, not a fault: surface it as a report
      // so one table renders both the dry run and the commit.
      const asReport = reportFromError(err);
      if (asReport) setReport(asReport);
      else setError(err instanceof ApiError ? err : null);
    }
  }, [mutateAsync, onSuccess]);

  const reset = useCallback(() => {
    setReport(null);
    setError(null);
  }, []);

  return { run, report, error, isPending: mutation.isPending, reset };
}

/** POST /api/import/:entity/validate — a dry run. Writes nothing. */
export function useValidateImport(entity: ImportEntity): ImportMutation {
  return useCsvUpload(`/api/import/${entity}/validate`);
}

/**
 * POST /api/import/:entity — the commit.
 *
 * Note the path: there is no /import suffix. The endpoint is the entity
 * itself, and the plausible-looking /api/import/:entity/import is a 404.
 */
export function useRunImport(entity: ImportEntity): ImportMutation {
  const queryClient = useQueryClient();

  const onSuccess = useCallback((report: ImportReport) => {
    if (!report.valid) return;
    for (const key of ALL_DATA_KEYS) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  }, [queryClient]);

  return useCsvUpload(`/api/import/${entity}`, onSuccess);
}

/**
 * Fetches the template and hands it to the browser to save.
 *
 * The anchor is synthetic because the route is ADMIN-only and the token lives
 * in memory: a real link would navigate unauthenticated and get a 401 page
 * instead of a file.
 */
export function useTemplateDownload() {
  const [isDownloading, setDownloading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const download = useCallback(async (entity: ImportEntity) => {
    setDownloading(true);
    setError(null);
    try {
      const { blob, filename } = await api.download(`/api/import/${entity}/template`);
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filename ?? `medguard-${entity}-template.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setDownloading(false);
    }
  }, []);

  return { download, isDownloading, error };
}
