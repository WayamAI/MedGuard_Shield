import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, Badge, Btn, Input, Select, Textarea, Modal, SlideOver } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataTable, listAsQuery, type Column } from "@/components/DataTable";
import { PageHeader, FilterBar, EntityAvatar, Field, FieldGroup } from "@/components/ui-patterns";
import {
  usePolicies, usePolicy, useCreatePolicy, useUpdatePolicy,
  type PolicyWriteInput,
} from "@/hooks/useGovernance";
import { useListControls } from "@/hooks/useListControls";
import { useIsAdmin } from "@/hooks/use-auth";
import { describeApiError, toApiError } from "@/lib/apiErrors";
import { notify } from "@/lib/notify";
import type { ApiPolicy, PolicyStatus } from "@/lib/apiTypes";
import type { Tone } from "@/lib/tone";

/** Written policy, its owner, and when it is next due for review. */

const STATUS_TONE: Record<PolicyStatus, Tone> = {
  ACTIVE: "success",
  DRAFT: "info",
  UNDER_REVIEW: "warning",
  ARCHIVED: "muted",
};

const STATUS_LABEL: Record<PolicyStatus, string> = {
  ACTIVE: "Active",
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  ARCHIVED: "Archived",
};

const STATUSES: PolicyStatus[] = ["ACTIVE", "DRAFT", "UNDER_REVIEW", "ARCHIVED"];

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

/** An ISO instant as the yyyy-mm-dd a date input wants. */
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export default function Policies() {
  const isAdmin = useIsAdmin();
  const controls = useListControls<{ status?: PolicyStatus }>({ status: undefined });
  const list = usePolicies(controls.params);

  const [params, setParams] = useSearchParams();
  const openId = params.get("open") ? Number(params.get("open")) : null;
  const [createOpen, setCreateOpen] = useState(false);

  const openPolicy = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id === null) next.delete("open"); else next.set("open", String(id));
    setParams(next, { replace: true });
  };

  const columns: Column<ApiPolicy>[] = [
    {
      id: "name",
      header: "Policy",
      sortValue: p => p.name,
      cell: p => (
        <div className="flex items-center gap-2.5">
          <EntityAvatar icon="audit" tone={STATUS_TONE[p.status]} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-body-md text-primary">{p.name}</div>
            <div className="truncate text-caption text-tertiary">
              {p.owner ?? "No owner recorded"}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: p => p.status,
      cell: p => <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>,
    },
    {
      id: "controls",
      header: "Controls",
      align: "right",
      hideBelow: "md",
      sortValue: p => p.controlCount,
      cell: p => p.controlCount,
    },
    {
      id: "review",
      header: "Review due",
      hideBelow: "lg",
      sortValue: p => (p.reviewDueAt ? new Date(p.reviewDueAt).getTime() : null),
      cell: p => (
        <span className={p.reviewOverdue ? "text-feedback-warning" : "text-tertiary"}>
          {fmtDate(p.reviewDueAt)}{p.reviewOverdue && " · overdue"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon="audit"
        title="Policies"
        description="Written policy, who owns it, and when it is next due for review."
        actions={
          <>
            <Btn variant="outline" onClick={() => void list.refresh()} disabled={list.isFetching}>
              <AppIcon name="refresh" size="sm" spin={list.isFetching} />
              Refresh
            </Btn>
            {/* Every field of a policy is configuration, so unlike controls
                there is no analyst carve-out: writing is ADMIN-only. */}
            {isAdmin && (
              <Btn variant="primary" onClick={() => setCreateOpen(true)}>
                <AppIcon name="add" size="sm" />
                New policy
              </Btn>
            )}
          </>
        }
      />

      <Card className="p-4">
        <DataTable
          label="Policies"
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
          getRowId={p => p.id}
          onRowClick={p => openPolicy(p.id)}
          isRowActive={p => p.id === openId}
          searchPlaceholder="Search policies…"
          emptyIcon="document" emptyArt="emptyAudit"
          emptyTitle="No policies recorded"
          emptyMessage={
            isAdmin
              ? "No policies have been recorded for this organisation yet. Use New policy to record the first one."
              : "No policies have been recorded for this organisation yet."
          }
          toolbar={
            <FilterBar
              label="Filter by status"
              value={controls.filters.status ?? "all"}
              onChange={v => controls.setFilter("status", v === "all" ? undefined : (v as PolicyStatus))}
              options={[
                { value: "all", label: "All" },
                ...STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s] })),
              ]}
            />
          }
        />
      </Card>

      <PolicyDrawer id={openId} onClose={() => openPolicy(null)} isAdmin={isAdmin} />
      {createOpen && <CreatePolicyModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

/* --------------------------------------------------------------- drawer */

/**
 * One policy, with the lifecycle move an administrator can make on it.
 *
 * `evidenceRef` is a pointer the customer typed — a wiki URL, a DMS id. The
 * API stores it without dereferencing it, and this drawer renders it as text
 * rather than as a link: turning unvalidated customer input into a live
 * anchor in a compliance tool is how a reviewer ends up somewhere nobody
 * vouched for.
 */
function PolicyDrawer({ id, onClose, isAdmin }: {
  id: number | null; onClose: () => void; isAdmin: boolean;
}) {
  const detail = usePolicy(id);
  const update = useUpdatePolicy();
  const p = detail.data;

  const [status, setStatus] = useState<PolicyStatus | null>(null);
  const [seededFor, setSeededFor] = useState<number | null>(null);
  if (p && seededFor !== p.id) {
    setSeededFor(p.id);
    setStatus(p.status);
  }

  const dirty = Boolean(p && status && status !== p.status);

  const save = async () => {
    if (!p || !status) return;
    try {
      await update.mutateAsync({ id: p.id, patch: { status } });
      notify.success(`Policy moved to ${STATUS_LABEL[status]}`);
    } catch (err) {
      notify.error(describeApiError(toApiError(err)).message);
    }
  };

  return (
    <SlideOver
      open={id !== null}
      onClose={onClose}
      width={520}
      title={p?.name ?? "Policy"}
      footer={
        isAdmin && p ? (
          <Btn
            variant="primary"
            className="w-full"
            onClick={() => void save()}
            disabled={!dirty || update.isPending}
          >
            {update.isPending ? "Saving…" : "Save status"}
          </Btn>
        ) : undefined
      }
    >
      {p && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
            {p.reviewOverdue && <Badge tone="warning">Review overdue</Badge>}
          </div>

          <p className="text-body-sm text-secondary">{p.description}</p>

          <FieldGroup title="Record">
            <Field label="Owner" value={p.owner ?? "No owner recorded"} />
            <Field
              label="Evidence reference"
              value={
                p.evidenceRef
                  ? <span className="break-all font-mono text-body-sm">{p.evidenceRef}</span>
                  : "—"
              }
            />
            <Field
              label="Review due"
              value={p.reviewDueAt ? `${fmtDate(p.reviewDueAt)}${p.reviewOverdue ? " · overdue" : ""}` : "Not scheduled"}
            />
            <Field label="Recorded" value={fmtDate(p.createdAt)} />
          </FieldGroup>

          {/* The detail endpoint returns the control rows, not a count. */}
          <FieldGroup title={`Cites ${p.controls.length} control${p.controls.length === 1 ? "" : "s"}`}>
            {p.controls.length === 0
              ? <p className="py-1 text-body-sm text-tertiary">No controls cited by this policy yet.</p>
              : p.controls.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="truncate text-body-sm text-primary">{c.name}</span>
                    <Badge tone="muted">{c.status}</Badge>
                  </div>
                ))}
          </FieldGroup>

          {isAdmin ? (
            <FieldGroup title="Lifecycle">
              <label className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-body-sm text-secondary">Status</span>
                <Select
                  value={status ?? p.status}
                  onChange={e => setStatus(e.target.value as PolicyStatus)}
                  disabled={update.isPending}
                >
                  {STATUSES.map(v => <option key={v} value={v}>{STATUS_LABEL[v]}</option>)}
                </Select>
              </label>
              <p className="pt-1 text-caption text-tertiary">
                Moving a policy records where the document stands. It does not
                change any control or asset.
              </p>
            </FieldGroup>
          ) : (
            <p className="text-caption text-tertiary">
              Changing a policy requires an administrator.
            </p>
          )}
        </div>
      )}
    </SlideOver>
  );
}

/* ---------------------------------------------------------------- create */

function CreatePolicyModal({ onClose }: { onClose: () => void }) {
  const create = useCreatePolicy();
  const [state, setState] = useState<PolicyWriteInput & { reviewDueAt: string }>({
    name: "", description: "", status: "DRAFT", owner: "", evidenceRef: "", reviewDueAt: "",
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
        status: state.status,
        owner: state.owner?.trim() ? state.owner.trim() : null,
        evidenceRef: state.evidenceRef?.trim() ? state.evidenceRef.trim() : null,
        reviewDueAt: state.reviewDueAt ? new Date(state.reviewDueAt).toISOString() : null,
      });
      notify.success(`Policy “${state.name.trim()}” recorded`);
      onClose();
    } catch (err) {
      setError(describeApiError(toApiError(err)).message);
    }
  };

  return (
    <Modal open onClose={onClose} title="New policy" size="md">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-body-sm text-secondary">Name</span>
          <Input
              className="w-full"
            value={state.name}
            onChange={e => setState({ ...state, name: e.target.value })}
            placeholder="PHI Access Control Policy"
            disabled={create.isPending}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-body-sm text-secondary">What this policy says</span>
          <Textarea
            rows={3}
            value={state.description}
            onChange={e => setState({ ...state, description: e.target.value })}
            placeholder="Access to systems holding PHI is granted least-privilege and reviewed quarterly."
            disabled={create.isPending}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-body-sm text-secondary">Status</span>
            <Select
              className="w-full"
              value={state.status}
              onChange={e => setState({ ...state, status: e.target.value as PolicyStatus })}
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
              placeholder="Privacy Office"
              disabled={create.isPending}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-body-sm text-secondary">Review due</span>
            <Input
              className="w-full"
              type="date"
              value={state.reviewDueAt}
              onChange={e => setState({ ...state, reviewDueAt: e.target.value })}
              disabled={create.isPending}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-body-sm text-secondary">Evidence reference</span>
            <Input
              className="w-full"
              value={state.evidenceRef ?? ""}
              onChange={e => setState({ ...state, evidenceRef: e.target.value })}
              placeholder="wiki/privacy/access-control"
              disabled={create.isPending}
            />
          </label>
        </div>
        <p className="text-caption text-tertiary">
          The evidence reference is stored exactly as you type it. Drishti never
          fetches or inspects what it points at.
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
          {create.isPending ? "Recording…" : "Record policy"}
        </Btn>
      </div>
    </Modal>
  );
}
