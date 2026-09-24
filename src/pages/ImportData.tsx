import { useMemo, useRef, useState } from "react";
import { Card, Badge, Btn, Select, SectionHeader, ChartSkeleton } from "@/components/ui-bits";
import { PageHeader } from "@/components/ui-patterns";
import { AppIcon } from "@/components/AppIcon";
import { DataState } from "@/components/DataState";
import { ImportPreviewTable, ImportErrorTable } from "@/components/ImportTables";
import { describeApiError } from "@/lib/apiErrors";
import {
  useImportEntities, useValidateImport, useRunImport, useTemplateDownload,
} from "@/hooks/useImport";
import { IMPORT_ENTITIES, type ImportEntity } from "@/lib/apiTypes";

/** Client-side first line of defence. The server enforces the same ceiling. */
const MAX_BYTES = 2 * 1024 * 1024;

type Stage = "idle" | "validated" | "imported";

export default function ImportData() {
  const entities = useImportEntities();
  const [entity, setEntity] = useState<ImportEntity>("assets");
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const fileInput = useRef<HTMLInputElement>(null);

  const validate = useValidateImport(entity);
  const commit = useRunImport(entity);
  const template = useTemplateDownload();

  const contract = useMemo(
    () => entities.data?.find(e => e.entity === entity) ?? null,
    [entities.data, entity],
  );

  /** Everything below the picker is about one file; changing entity drops it. */
  const clearFile = () => {
    setFile(null);
    setLocalError(null);
    setStage("idle");
    validate.reset();
    commit.reset();
    if (fileInput.current) fileInput.current.value = "";
  };

  const onEntityChange = (next: ImportEntity) => {
    setEntity(next);
    clearFile();
  };

  const onPick = async (picked: File | null) => {
    setLocalError(null);
    setStage("idle");
    validate.reset();
    commit.reset();

    if (!picked) { setFile(null); return; }
    if (!picked.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setLocalError(`Only .csv files are accepted — "${picked.name}" is not one.`);
      return;
    }
    if (picked.size > MAX_BYTES) {
      setFile(null);
      setLocalError(
        `That file is ${(picked.size / 1024 / 1024).toFixed(1)}MB. The limit is 2MB.`,
      );
      return;
    }

    setFile(picked);
    // Validation is a dry run, so it is safe to fire on selection. The commit
    // never is, and only ever happens from the button below.
    await validate.run(picked);
    setStage("validated");
  };

  const onConfirm = async () => {
    if (!file) return;
    await commit.run(file);
    setStage("imported");
  };

  const report = stage === "imported" ? commit.report : validate.report;
  const blocking = stage === "imported" ? commit.error : validate.error;
  const busy = validate.isPending || commit.isPending;
  const readyToImport = stage === "validated" && report?.valid === true && !busy;
  const imported = stage === "imported" && commit.report?.valid === true;

  return (
    <div className="space-y-4">
      <PageHeader
        icon="import"
        title="Data Import"
        description="Upload a CSV to add records. Every file is checked before anything is written."
      />

      <Card className="p-4">
        <SectionHeader
          title="What are you importing?"
          subtitle="Pick the record type first — changing it clears any file you have chosen."
        />

        <DataState query={entities} height={120} emptyTitle="No importable entities">
          {() => (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="entity" className="mb-1.5 block text-label-md text-primary">
                  Record type
                </label>
                <Select
                  id="entity"
                  value={entity}
                  onChange={e => onEntityChange(e.target.value as ImportEntity)}
                >
                  {IMPORT_ENTITIES.map(slug => {
                    const label = entities.data?.find(e => e.entity === slug)?.label;
                    return <option key={slug} value={slug}>{label ?? slug}</option>;
                  })}
                </Select>
              </div>

              <Btn
                variant="outline"
                onClick={() => template.download(entity)}
                disabled={template.isDownloading}
              >
                <AppIcon name="download" size="sm" />
                {template.isDownloading ? "Preparing…" : "Download template"}
              </Btn>

              <div className="flex-1" />

              {contract && (
                <p className="text-body-sm text-tertiary">
                  Matched on {contract.naturalKeyLabel}.
                </p>
              )}
            </div>
          )}
        </DataState>

        {contract && (
          <div className="mt-4 border-t border-default pt-3">
            <div className="mb-2 text-label-md text-primary">Columns</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {contract.columns.map(col => (
                <span key={col.column} className="flex items-center gap-1.5 text-body-sm">
                  <span className="text-primary">{col.column}</span>
                  <Badge tone={col.required ? "danger" : "muted"}>
                    {col.required ? "required" : "optional"}
                  </Badge>
                  <span className="text-tertiary">{col.type}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionHeader
          title="Upload"
          subtitle="The file is checked first. Nothing is written until you confirm."
        />

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept=".csv"
            aria-label="CSV file"
            disabled={busy}
            onChange={e => void onPick(e.target.files?.[0] ?? null)}
            className="text-body-sm text-primary file:mr-3 file:rounded-md file:border file:border-default file:bg-action file:px-3 file:py-1.5 file:text-label-sm file:text-primary"
          />
          {file && (
            <Btn variant="outline" onClick={clearFile} disabled={busy}>Clear</Btn>
          )}
        </div>

        {localError && (
          <div role="alert" className="mt-3 rounded-md border border-feedback-error-stroke bg-feedback-error-background px-3 py-2 text-body-sm text-feedback-error">
            {localError}
          </div>
        )}

        {busy && <div className="mt-4"><ChartSkeleton height={180} label="Checking the file" /></div>}

        {!busy && blocking && (
          <div role="alert" className="mt-3 rounded-md border border-feedback-error-stroke bg-feedback-error-background px-3 py-2 text-body-sm text-feedback-error">
            <span className="font-semibold">{describeApiError(blocking).title}.</span>{" "}
            {describeApiError(blocking).message}
          </div>
        )}

        {!busy && report && !report.valid && (
          <div className="mt-4 space-y-3">
            <div role="alert" className="flex items-center gap-2 rounded-md border border-feedback-error-stroke bg-feedback-error-background px-3 py-2 text-body-sm text-feedback-error">
              <AppIcon name="threats" size="sm" />
              <span>
                <span className="font-semibold">
                  {report.errors.length} problem{report.errors.length === 1 ? "" : "s"} found
                </span>{" "}
                across {report.totalRows} row{report.totalRows === 1 ? "" : "s"}. Nothing was imported.
              </span>
            </div>
            <ImportErrorTable errors={report.errors} />
          </div>
        )}

        {!busy && report?.valid && !imported && (
          <div className="mt-4 space-y-3">
            <div role="status" className="flex items-center gap-2 rounded-md border border-feedback-success-stroke bg-feedback-success-background px-3 py-2 text-body-sm text-feedback-success">
              <AppIcon name="check" size="sm" />
              <span className="font-semibold">
                {report.totalRows} row{report.totalRows === 1 ? "" : "s"} ready to import
              </span>
            </div>
            <ImportPreviewTable rows={report.preview} />
            <div className="flex items-center gap-3">
              <Btn variant="primary" onClick={() => void onConfirm()} disabled={!readyToImport}>
                Confirm Import
              </Btn>
              <span className="text-body-sm text-tertiary">
                Checked only. Nothing has been written yet.
              </span>
            </div>
          </div>
        )}

        {!busy && imported && commit.report && (
          <div className="mt-4 space-y-3">
            <div role="status" className="flex items-center gap-2 rounded-md border border-feedback-success-stroke bg-feedback-success-background px-3 py-2 text-body-sm text-feedback-success">
              <AppIcon name="check" size="sm" />
              <span>
                {/*
                  "Imported 2 rows into Assets" rather than "Imported 2 Assets
                  rows" — the entity labels are plural nouns ("Assets",
                  "PHI Types", "Access Grants"), so using one as an adjective
                  reads wrong for every entity, not just this one.
                */}
                <span className="font-semibold">
                  Imported {commit.report.imported ?? commit.report.totalRows} row
                  {(commit.report.imported ?? commit.report.totalRows) === 1 ? "" : "s"}
                  {" into "}{contract?.label ?? entity}
                </span>{" "}
                — the dashboard and the other views have been refreshed.
              </span>
            </div>
            <ImportPreviewTable rows={commit.report.preview} />
            <Btn variant="outline" onClick={clearFile}>Import another file</Btn>
          </div>
        )}
      </Card>
    </div>
  );
}
