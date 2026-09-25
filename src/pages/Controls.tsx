import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, Badge, Btn, Input, Select, Textarea, Modal, SlideOver } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataTable, listAsQuery, type Column } from "@/components/DataTable";
import { PageHeader, FilterBar, EntityAvatar, Field, FieldGroup } from "@/components/ui-patterns";
import {
  useControls, useControl, useCreateControl, useUpdateControl,
  type ControlWriteInput,
} from "@/hooks/useGovernance";
import { useListControls } from "@/hooks/useListControls";
import { useCanWrite, useIsAdmin } from "@/hooks/use-auth";
import { describeApiError, toApiError } from "@/lib/apiErrors";
import { notify } from "@/lib/notify";
import type {
  ApiControl, ControlStatus, ControlCategory, ControlEffectiveness,
} from "@/lib/apiTypes";
import type { Tone } from "@/lib/tone";

/**
 * Safeguards in place across the estate.
 *
 * `frameworkRef` is free text the customer typed — "HIPAA 164.312(a)(1)" or
 * similar. It is rendered as a citation and never as a compliance claim,
 * because Drishti stores the reference and asserts nothing about conformance
 * on the strength of it. That distinction is the difference between a tool
 * that helps an audit and one that misleads it.
 */

const STATUS_TONE: Record<ControlStatus, Tone> = {
  IMPLEMENTED: "success",
  PARTIAL: "warning",
  PLANNED: "info",
  NOT_IMPLEMENTED: "danger",
};

const STATUS_LABEL: Record<ControlStatus, string> = {
  IMPLEMENTED: "Implemented",
  PARTIAL: "Partial",
  PLANNED: "Planned",
  NOT_IMPLEMENTED: "Not implemented",
};

const STATUSES: ControlStatus[] = ["IMPLEMENTED", "PARTIAL", "PLANNED", "NOT_IMPLEMENTED"];

const CATEGORIES: ControlCategory[] =
  ["ACCESS", "ENCRYPTION", "MONITORING", "GOVERNANCE", "RESILIENCE", "VENDOR"];

const CATEGORY_LABEL: Record<ControlCategory, string> = {
  ACCESS: "Access", ENCRYPTION: "Encryption", MONITORING: "Monitoring",
  GOVERNANCE: "Governance", RESILIENCE: "Resilience", VENDOR: "Vendor",
};

const EFFECTIVENESS: ControlEffectiveness[] =
  ["EFFECTIVE", "PARTIALLY_EFFECTIVE", "INEFFECTIVE", "NOT_ASSESSED"];

const EFFECTIVENESS_LABEL: Record<ControlEffectiveness, string> = {
  EFFECTIVE: "Effective",
  PARTIALLY_EFFECTIVE: "Partially effective",
  INEFFECTIVE: "Ineffective",
  NOT_ASSESSED: "Not assessed",
};

const EFFECTIVENESS_TONE: Record<ControlEffectiveness, Tone> = {
  EFFECTIVE: "success",
  PARTIALLY_EFFECTIVE: "warning",
  INEFFECTIVE: "danger",
  NOT_ASSESSED: "muted",
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Never";

/** An ISO instant as the yyyy-mm-dd a date input wants. */
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export default function Controls() {
  const canWrite = useCanWrite();
  const isAdmin = useIsAdmin();
  const controls = useListControls<{ status?: ControlStatus }>({ status: undefined });
  const list = useControls(controls.params);

  const [params, setParams] = useSearchParams();
  const openId = params.get("open") ? Number(params.get("open")) : null;
  const [createOpen, setCreateOpen] = useState(false);

  const openControl = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id === null) next.delete("open"); else next.set("open", String(id));
    setParams(next, { replace: true });
  };

  const columns: Column<ApiControl>[] = [
    {
      id: "name",
      header: "Control",
      sortValue: c => c.name,
      cell: c => (
        <div className="flex items-center gap-2.5">
          <EntityAvatar icon="control" tone={STATUS_TONE[c.status]} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-body-md text-primary">{c.name}</div>
            <div className="truncate text-caption text-tertiary">{CATEGORY_LABEL[c.category]}</div>
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: c => c.status,
      cell: c => <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>,
    },
    {
      id: "effectiveness",
      header: "Effectiveness",
      hideBelow: "lg",
      sortValue: c => c.effectiveness,
      cell: c => (
        <Badge tone={EFFECTIVENESS_TONE[c.effectiveness]}>
          {EFFECTIVENESS_LABEL[c.effectiveness]}
        </Badge>
      ),
    },
    {
      id: "assets",
      header: "Applied to",
      align: "right",
      hideBelow: "md",
      sortValue: c => c.appliedAssetCount,
      cell: c => `${c.appliedAssetCount} asset${c.appliedAssetCount === 1 ? "" : "s"}`,
    },
    {
      id: "open",
      header: "Open findings",
      align: "right",
      hideBelow: "lg",
      sortValue: c => c.openRemediations,
      cell: c => c.openRemediations > 0
        ? <Badge tone="warning">{c.openRemediations}</Badge>
        : <span className="text-tertiary">—</span>,
    },
    {
      id: "ref",
      header: "Reference",
      hideBelow: "xl",
      sortValue: c => c.frameworkRef ?? null,
      // A citation the customer supplied, not a conformance assertion.
      cell: c => c.frameworkRef
        ? <span className="font-mono text-caption text-tertiary">{c.frameworkRef}</span>
        : <span className="text-tertiary">—</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon="control"
        title="Controls"
        description="Safeguards recorded against the estate, and how far each one is implemented."
        actions={
          <>
            <Btn variant="outline" onClick={() => void list.refresh()} disabled={list.isFetching}>
              <AppIcon name="refresh" size="sm" spin={list.isFetching} />
              Refresh
            </Btn>
            {/* control:create is ADMIN-only; an ANALYST may assess a control
                but not bring one into existence. */}
            {isAdmin && (
              <Btn variant="primary" onClick={() => setCreateOpen(true)}>
                <AppIcon name="add" size="sm" />
                New control
              </Btn>
            )}
          </>
        }
      />

      <Card className="p-4">
        <DataTable
          label="Controls"
          query={listAsQuery(list)}
          server={{
            meta: list.meta,
            page: controls.page,
            onPageChange: controls.setPage,
            pageSize: controls.pageSize,
            onPageSizeChange: controls.setPageSize,
            onSearch: controls.setSearch,
            searchValue: controls.search,
            isPaging: list.isPaging,
          }}
          columns={columns}
          getRowId={c => c.id}
          onRowClick={c => openControl(c.id)}
          isRowActive={c => c.id === openId}
          searchPlaceholder="Search controls…"
          emptyIcon="locked" emptyArt="emptyControls"
          emptyTitle="No controls recorded"
          emptyMessage={
            isAdmin
              ? "No safeguards have been recorded for this organisation yet. Use New control to record the first one."
              : "No safeguards have been recorded for this organisation yet."
          }
          toolbar={
            <FilterBar
              label="Filter by status"
              value={controls.filters.status ?? "all"}
              onChange={v => controls.setFilter("status", v === "all" ? undefined : (v as ControlStatus))}
              options={[
                { value: "all", label: "All" },
                ...STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s] })),
              ]}
            />
          }
        />
      </Card>

      <p className="text-caption text-tertiary">
        Framework references are citations recorded by your team. Drishti stores
        them as written and makes no conformance claim on their basis.
      </p>

      <ControlDrawer
        id={openId}
        onClose={() => openControl(null)}
        canAssess={canWrite}
        isAdmin={isAdmin}
      />
      {createOpen && <CreateControlModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

/* --------------------------------------------------------------- drawer */

/**
 * One control, and the assessment a reviewer is allowed to record against it.
 *
 * The admin/analyst line runs through this record rather than around it, so
 * the panel is split the same way the API is: status, effectiveness and
 * last-reviewed are assessment and open to ANALYST; name, category, owner and
 * the framework reference are configuration and ADMIN-only. A non-admin sees
 * the configuration as read-only fields rather than as disabled inputs — an
 * input you may never use is just noise.
 */
function ControlDrawer({ id, onClose, canAssess, isAdmin }: {
  id: number | null; onClose: () => void; canAssess: boolean; isAdmin: boolean;
}) {
  const detail = useControl(id);
  const update = useUpdateControl();
  const c = detail.data;

  const [draft, setDraft] = useState<{
    status: ControlStatus; effectiveness: ControlEffectiveness; lastReviewedAt: string;
  } | null>(null);

  // Re-seed the draft whenever a different control is opened.
  const seed = c
    ? { status: c.status, effectiveness: c.effectiveness, lastReviewedAt: toDateInput(c.lastReviewedAt) }
    : null;
  const [seededFor, setSeededFor] = useState<number | null>(null);
  if (c && seededFor !== c.id) {
    setSeededFor(c.id);
    setDraft(seed);
  }

  const dirty = Boolean(c && draft && seed && (
    draft.status !== seed.status
    || draft.effectiveness !== seed.effectiveness
    || draft.lastReviewedAt !== seed.lastReviewedAt
  ));

  const saveAssessment = async () => {
    if (!c || !draft) return;
    try {
      // Send only the assessment fields. Including an untouched configuration
      // field would push the request over the ADMIN line for no reason.
      await update.mutateAsync({
        id: c.id,
        patch: {
          status: draft.status,
          effectiveness: draft.effectiveness,
          lastReviewedAt: draft.lastReviewedAt
            ? new Date(draft.lastReviewedAt).toISOString()
            : null,
        },
      });
      notify.success("Assessment recorded");
    } catch (err) {
      notify.error(describeApiError(toApiError(err)).message);
    }
  };

  return (
    <SlideOver
      open={id !== null}
      onClose={onClose}
      width={520}
      title={c?.name ?? "Control"}
      footer={
        canAssess && c ? (
          <Btn
            variant="primary"
            className="w-full"
            onClick={() => void saveAssessment()}
            disabled={!dirty || update.isPending}
          >
            {update.isPending ? "Recording…" : "Record assessment"}
          </Btn>
        ) : undefined
      }
    >
      {c && draft && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
            <Badge tone={EFFECTIVENESS_TONE[c.effectiveness]}>
              {EFFECTIVENESS_LABEL[c.effectiveness]}
            </Badge>
            <span className="text-body-sm text-tertiary">{CATEGORY_LABEL[c.category]}</span>
          </div>

          <p className="text-body-sm text-secondary">{c.description}</p>

          <FieldGroup title="Record">
            <Field label="Owner" value={c.owner ?? "Unassigned"} />
            <Field
              label="Framework reference"
              value={
                c.frameworkRef
                  ? <span className="font-mono text-body-sm">{c.frameworkRef}</span>
                  : "—"
              }
            />
            <Field label="PHI covered" value={c.phiCovered.toLocaleString()} />
            <Field label="Last reviewed" value={fmtDate(c.lastReviewedAt)} />
          </FieldGroup>

          {/*
            The detail endpoint returns the rows themselves rather than the
            counts the list row carries, so show the rows. A reviewer asking
            "what does this control actually cover?" wants the names.
          */}
          <FieldGroup title={`Applied to ${c.assets.length} asset${c.assets.length === 1 ? "" : "s"}`}>
            {c.assets.length === 0
              ? <p className="py-1 text-body-sm text-tertiary">Not applied to any asset yet.</p>
              : c.assets.map(a => (
                  <div key={a.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="truncate text-body-sm text-primary">{a.name}</span>
                    <span className="shrink-0 text-caption text-tertiary">
                      {a.phiVolume.toLocaleString()} records
                    </span>
                  </div>
                ))}
          </FieldGroup>

          {c.policies.length > 0 && (
            <FieldGroup title={`Cited by ${c.policies.length} polic${c.policies.length === 1 ? "y" : "ies"}`}>
              {c.policies.map(pol => (
                <div key={pol.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="truncate text-body-sm text-primary">{pol.name}</span>
                  <Badge tone="muted">{pol.status}</Badge>
                </div>
              ))}
            </FieldGroup>
          )}

          {c.remediations.length > 0 && (
            <FieldGroup title={`${c.remediations.length} open finding${c.remediations.length === 1 ? "" : "s"}`}>
              {c.remediations.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="truncate text-body-sm text-primary">{r.title}</span>
                  <Badge tone="warning">{r.severity}</Badge>
                </div>
              ))}
            </FieldGroup>
          )}

          {canAssess ? (
            <FieldGroup title="Assessment">
              <label className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-body-sm text-secondary">Status</span>
                <Select
                  value={draft.status}
                  onChange={e => setDraft({ ...draft, status: e.target.value as ControlStatus })}
                  disabled={update.isPending}
                >
                  {STATUSES.map(v => <option key={v} value={v}>{STATUS_LABEL[v]}</option>)}
                </Select>
              </label>
              <label className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-body-sm text-secondary">Effectiveness</span>
                <Select
                  value={draft.effectiveness}
                  onChange={e => setDraft({ ...draft, effectiveness: e.target.value as ControlEffectiveness })}
                  disabled={update.isPending}
                >
                  {EFFECTIVENESS.map(v => <option key={v} value={v}>{EFFECTIVENESS_LABEL[v]}</option>)}
                </Select>
              </label>
              <label className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-body-sm text-secondary">Reviewed on</span>
                <Input
                  type="date"
                  value={draft.lastReviewedAt}
                  onChange={e => setDraft({ ...draft, lastReviewedAt: e.target.value })}
                  disabled={update.isPending}
                />
              </label>
              <p className="pt-1 text-caption text-tertiary">
                Recording an assessment states what your team found. It does not
                change the estate, and it is not a conformance claim.
                {!isAdmin && " Renaming or recategorising a control requires an administrator."}
              </p>
            </FieldGroup>
          ) : (
            <p className="text-caption text-tertiary">
              Your role can read controls but not record an assessment against them.
            </p>
          )}
        </div>
      )}
    </SlideOver>
  );
}

/* ---------------------------------------------------------------- create */

function CreateControlModal({ onClose }: { onClose: () => void }) {
  const create = useCreateControl();
  const [state, setState] = useState<ControlWriteInput>({
    name: "", description: "", category: "ACCESS",
    status: "PLANNED", effectiveness: "NOT_ASSESSED", owner: "", frameworkRef: "",
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!state.name.trim()) { setError("Name is required."); return; }
    if (!state.description.trim()) { setError("Description is required."); return; }
    try {
      await create.mutateAsync({
        name: state.name.trim(),
        description: state.description.trim(),
        category: state.category,
        status: state.status,
        effectiveness: state.effectiveness,
        owner: state.owner?.trim() ? state.owner.trim() : null,
        frameworkRef: state.frameworkRef?.trim() ? state.frameworkRef.trim() : null,
      });
      notify.success(`Control “${state.name.trim()}” recorded`);
      onClose();
    } catch (err) {
      setError(describeApiError(toApiError(err)).message);
    }
  };

  return (
    <Modal open onClose={onClose} title="New control" size="md">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-body-sm text-secondary">Name</span>
          <Input
              className="w-full"
            value={state.name}
            onChange={e => setState({ ...state, name: e.target.value })}
            placeholder="Encryption at rest for PHI stores"
            disabled={create.isPending}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-body-sm text-secondary">What this control does</span>
          <Textarea
            rows={3}
            value={state.description}
            onChange={e => setState({ ...state, description: e.target.value })}
            placeholder="AES-256 at rest on every database holding PHI, with keys in the managed KMS."
            disabled={create.isPending}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-body-sm text-secondary">Category</span>
            <Select
              className="w-full"
              value={state.category}
              onChange={e => setState({ ...state, category: e.target.value as ControlCategory })}
              disabled={create.isPending}
            >
              {CATEGORIES.map(v => <option key={v} value={v}>{CATEGORY_LABEL[v]}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-body-sm text-secondary">Status</span>
            <Select
              className="w-full"
              value={state.status}
              onChange={e => setState({ ...state, status: e.target.value as ControlStatus })}
              disabled={create.isPending}
            >
              {STATUSES.map(v => <option key={v} value={v}>{STATUS_LABEL[v]}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-body-sm text-secondary">Owner</span>
            <Input
              className="w-full"
              value={state.owner ?? ""}
              onChange={e => setState({ ...state, owner: e.target.value })}
              placeholder="Security Engineering"
              disabled={create.isPending}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-body-sm text-secondary">Framework reference</span>
            <Input
              className="w-full"
              value={state.frameworkRef ?? ""}
              onChange={e => setState({ ...state, frameworkRef: e.target.value })}
              placeholder="HIPAA 164.312(a)(2)(iv)"
              disabled={create.isPending}
            />
          </label>
        </div>
        <p className="text-caption text-tertiary">
          A framework reference is stored exactly as you type it. Drishti makes
          no conformance claim on the strength of one.
        </p>
      </div>

      {error && (
        <div role="alert" className="mt-3 rounded-md border border-feedback-error-stroke bg-feedback-error-background px-3 py-2 text-body-sm text-feedback-error">
          {error}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Btn variant="outline" onClick={onClose} disabled={create.isPending}>Cancel</Btn>
        <Btn variant="primary" onClick={() => void submit()} disabled={create.isPending}>
          {create.isPending ? "Recording…" : "Record control"}
        </Btn>
      </div>
    </Modal>
  );
}
