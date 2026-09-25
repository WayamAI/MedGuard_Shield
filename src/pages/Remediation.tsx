import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Card, Badge, Btn, Input, Select, Textarea, Modal, SlideOver, ChartSkeleton,
} from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataTable, listAsQuery, type Column } from "@/components/DataTable";
import {
  PageHeader, MetricCard, Field, FieldGroup, FilterBar, EntityAvatar,
} from "@/components/ui-patterns";
import {
  useRemediations, useRemediation, useRemediationSummary, useOrgMembers,
  useCreateRemediation, useSetRemediationStatus, useAssignRemediation,
} from "@/hooks/useGovernance";
import { useListControls } from "@/hooks/useListControls";
import { useCanWrite } from "@/hooks/use-auth";
import { describeApiError, toApiError } from "@/lib/apiErrors";
import { notify } from "@/lib/notify";
import type {
  ApiRemediation, RemediationSeverity, RemediationStatus,
  RemediationSource, RemediationSubject,
} from "@/lib/apiTypes";
import type { Tone } from "@/lib/tone";

/**
 * Remediation — findings, owners and what was done about them.
 *
 * Replaces the fake "Remediate Now" wizard that announced "Violation
 * resolved, encryption applied" while writing nothing.
 *
 * One distinction is load-bearing and deliberately preserved from the API:
 * RESOLVED and ACCEPTED are not the same outcome. ACCEPTED means the risk was
 * accepted without fixing. Collapsing the two would turn "we decided to live
 * with this" into "we fixed it", which is exactly the difference an auditor
 * exists to find.
 */

const SEVERITY_TONE: Record<RemediationSeverity, Tone> = {
  CRITICAL: "danger", HIGH: "warning", MEDIUM: "info", LOW: "muted",
};

const STATUS_TONE: Record<RemediationStatus, Tone> = {
  OPEN: "danger",
  REOPENED: "danger",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  ACCEPTED: "info",
};

const STATUS_LABEL: Record<RemediationStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  ACCEPTED: "Risk accepted",
  REOPENED: "Reopened",
};

const SOURCE_LABEL: Record<RemediationSource, string> = {
  RISK: "Raised from risk scoring",
  THREAT: "Raised from a detected threat",
  ACCESS: "Raised from an access review",
  VENDOR: "Raised from a vendor assessment",
  CONTROL: "Raised from a control assessment",
  MANUAL: "Raised manually",
};

/**
 * What a finding points at, as readable pairs.
 *
 * `subject` is always an object with five independently nullable slots, and
 * a finding may fill more than one — an unencrypted asset reachable by a
 * vendor without a BAA fills two. So this returns a list, not a single pair,
 * and the caller decides how much of it to show.
 */
type SubjectRef = { kind: string; label: string; to?: string };

const subjectRefs = (s: RemediationSubject): SubjectRef[] => {
  const out: SubjectRef[] = [];
  if (s.asset) out.push({ kind: "Asset", label: s.asset.name, to: `/assets?open=${s.asset.id}` });
  if (s.vendor) out.push({ kind: "Vendor", label: s.vendor.name, to: `/vendors?open=${s.vendor.id}` });
  if (s.threat) out.push({ kind: "Threat", label: s.threat.title, to: `/threats?open=${s.threat.id}` });
  if (s.control) out.push({ kind: "Control", label: s.control.name, to: `/controls?open=${s.control.id}` });
  if (s.identity) out.push({ kind: "Identity", label: s.identity.name });
  if (s.accessGrantId !== null) {
    out.push({ kind: "Access grant", label: `#${s.accessGrantId}`, to: `/access?open=${s.accessGrantId}` });
  }
  return out;
};

const SEVERITIES: RemediationSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUSES: RemediationStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "ACCEPTED", "REOPENED"];

/** The server's transition table, mirrored only to render sensible buttons. */
const NEXT_STATUSES: Record<RemediationStatus, RemediationStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED", "ACCEPTED"],
  IN_PROGRESS: ["RESOLVED", "ACCEPTED", "OPEN"],
  REOPENED: ["IN_PROGRESS", "RESOLVED", "ACCEPTED"],
  RESOLVED: ["REOPENED"],
  ACCEPTED: ["REOPENED"],
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

export default function Remediation() {
  const canWrite = useCanWrite();
  const summary = useRemediationSummary();

  const [params, setParams] = useSearchParams();
  const openId = params.get("open") ? Number(params.get("open")) : null;
  const [createOpen, setCreateOpen] = useState(false);

  const controls = useListControls<{ status?: RemediationStatus; severity?: RemediationSeverity }>({
    status: undefined, severity: undefined,
  });
  const items = useRemediations(controls.params);

  const openItem = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id === null) next.delete("open");
    else next.set("open", String(id));
    setParams(next, { replace: true });
  };

  const columns: Column<ApiRemediation>[] = [
    {
      id: "severity",
      header: "Severity",
      width: "w-28",
      sortValue: r => SEVERITIES.length - SEVERITIES.indexOf(r.severity),
      cell: r => <Badge tone={SEVERITY_TONE[r.severity]}>{r.severity}</Badge>,
    },
    {
      id: "title",
      header: "Finding",
      sortValue: r => r.title,
      cell: r => (
        <div className="flex items-center gap-2.5">
          <EntityAvatar icon="remediation" tone={SEVERITY_TONE[r.severity]} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-body-md text-primary">{r.title}</div>
            <div className="truncate text-caption text-tertiary">
              {subjectRefs(r.subject).map(x => `${x.kind}: ${x.label}`).join(" · ")
                || SOURCE_LABEL[r.source]}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      hideBelow: "md",
      sortValue: r => r.owner?.email ?? null,
      cell: r => r.owner
        ? <span className="truncate text-body-sm text-secondary">{r.owner.email}</span>
        : <span className="text-tertiary">Unassigned</span>,
    },
    {
      id: "due",
      header: "Due",
      hideBelow: "lg",
      sortValue: r => (r.dueAt ? new Date(r.dueAt).getTime() : null),
      cell: r => (
        <span className={r.overdue ? "text-feedback-error" : "text-tertiary"}>
          {fmtDate(r.dueAt)}{r.overdue && " · overdue"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: r => r.status,
      cell: r => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
    },
  ];

  const s = summary.data;

  return (
    <div className="space-y-4">
      <PageHeader
        icon="remediation"
        title="Remediation"
        description="Findings raised against the estate, who owns them, and what was decided."
        actions={
          <>
            <Btn variant="outline" onClick={() => { void items.refresh(); void summary.refresh(); }} disabled={items.isFetching}>
              <AppIcon name="refresh" size="sm" spin={items.isFetching} />
              Refresh
            </Btn>
            {canWrite && (
              <Btn variant="primary" onClick={() => setCreateOpen(true)}>
                <AppIcon name="add" size="sm" />
                New finding
              </Btn>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/*
          The four cards partition the estate exactly once: awaiting work,
          being worked, and closed. The server's own `open` roll-up is not
          used as a card because it already includes IN_PROGRESS, so showing
          it beside the In progress card would count the same finding twice.
          Overdue is a flag across the open ones, and is labelled as such.
        */}
        <MetricCard
          label="Awaiting work"
          value={s ? s.byStatus.OPEN + s.byStatus.REOPENED : undefined}
          icon="tasks"
          tone="danger"
          emphasis={Boolean(s && s.byStatus.OPEN + s.byStatus.REOPENED)}
          sub={s && s.byStatus.REOPENED ? `${s.byStatus.REOPENED} reopened` : undefined}
        />
        <MetricCard label="In progress" value={s?.byStatus.IN_PROGRESS} icon="clock" tone="warning" />
        <MetricCard
          label="Overdue"
          value={s?.overdue}
          icon="threats"
          tone="danger"
          emphasis={Boolean(s?.overdue)}
          sub={s ? "of the open findings" : undefined}
        />
        <MetricCard
          label="Closed"
          value={s ? s.byStatus.RESOLVED + s.byStatus.ACCEPTED : undefined}
          icon="check"
          tone="success"
          // RESOLVED and ACCEPTED stay named separately: "we fixed it" and
          // "we decided to live with it" are not the same claim.
          sub={s ? `${s.byStatus.RESOLVED} resolved · ${s.byStatus.ACCEPTED} accepted` : undefined}
        />
      </div>

      <Card className="p-4">
        <DataTable
          label="Remediation findings"
          query={listAsQuery(items)}
          server={{
            meta: items.meta,
            page: controls.page,
            onPageChange: controls.setPage,
            pageSize: controls.pageSize,
            onPageSizeChange: controls.setPageSize,
            onSearch: controls.setSearch,
            searchValue: controls.search,
            isPaging: items.isPaging,
          }}
          columns={columns}
          getRowId={r => r.id}
          onRowClick={r => openItem(r.id)}
          isRowActive={r => r.id === openId}
          searchPlaceholder="Search findings…"
          emptyIcon="remediation" emptyArt="emptyRemediation"
          emptyTitle="No findings recorded"
          emptyMessage={
            canWrite
              ? "Nothing has been raised against this estate yet. Use “New finding” to record one."
              : "Nothing has been raised against this estate yet."
          }
          toolbar={
            <>
              <FilterBar
                label="Filter by status"
                value={controls.filters.status ?? "all"}
                onChange={v => controls.setFilter("status", v === "all" ? undefined : (v as RemediationStatus))}
                options={[
                  { value: "all", label: "All" },
                  ...STATUSES.map(st => ({ value: st, label: STATUS_LABEL[st] })),
                ]}
              />
              <FilterBar
                label="Filter by severity"
                value={controls.filters.severity ?? "all"}
                onChange={v => controls.setFilter("severity", v === "all" ? undefined : (v as RemediationSeverity))}
                options={[
                  { value: "all", label: "Any severity" },
                  ...SEVERITIES.map(sev => ({ value: sev, label: sev[0] + sev.slice(1).toLowerCase() })),
                ]}
              />
            </>
          }
        />
      </Card>

      <RemediationDrawer id={openId} onClose={() => openItem(null)} canWrite={canWrite} />
      {createOpen && <CreateRemediationModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function RemediationDrawer({
  id, onClose, canWrite,
}: { id: number | null; onClose: () => void; canWrite: boolean }) {
  const navigate = useNavigate();
  const detail = useRemediation(id);
  const members = useOrgMembers({ enabled: canWrite });
  const setStatus = useSetRemediationStatus();
  const assign = useAssignRemediation();

  const r = detail.data;
  const busy = setStatus.isPending || assign.isPending;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      notify.success(ok);
    } catch (err) {
      notify.error(describeApiError(toApiError(err)).message);
    }
  };

  const transitions = r
    ? (r.allowedTransitions ?? NEXT_STATUSES[r.status] ?? [])
    : [];

  return (
    <SlideOver
      open={id !== null}
      onClose={onClose}
      width={520}
      title={r?.title ?? "Finding"}
      footer={
        r && canWrite && transitions.length > 0 ? (
          <div className="w-full">
            <div className="mb-1.5 text-caption text-tertiary">Change status</div>
            <div className="flex flex-wrap gap-2">
              {transitions.map(next => (
                <Btn
                  key={next}
                  variant={next === "RESOLVED" ? "primary" : "outline"}
                  disabled={busy}
                  onClick={() => void run(() => setStatus.mutateAsync({ id: r.id, status: next }), `Marked ${STATUS_LABEL[next].toLowerCase()}`)}
                >
                  {STATUS_LABEL[next]}
                </Btn>
              ))}
            </div>
          </div>
        ) : undefined
      }
    >
      {detail.isLoading && <ChartSkeleton height={320} label="Loading finding" />}

      {r && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <EntityAvatar icon="remediation" tone={SEVERITY_TONE[r.severity]} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={SEVERITY_TONE[r.severity]}>{r.severity}</Badge>
                <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                {r.overdue && <Badge tone="danger">Overdue</Badge>}
              </div>
              <p className="mt-1.5 text-body-sm text-tertiary">
                {subjectRefs(r.subject).map(x => `${x.kind}: ${x.label}`).join(" · ")
                  || SOURCE_LABEL[r.source]}
              </p>
            </div>
          </div>

          <FieldGroup title="Finding">
            <p className="py-2 text-body-sm text-secondary">{r.description}</p>
          </FieldGroup>

          <FieldGroup title="Recommended action">
            <p className="py-2 text-body-sm text-secondary">{r.recommendation}</p>
          </FieldGroup>

          {canWrite && (
            <FieldGroup title="Owner">
              <div className="flex items-center gap-2 py-1">
                <Select
                  value={r.owner?.id ?? ""}
                  disabled={busy}
                  aria-label="Assign owner"
                  onChange={e =>
                    void run(
                      () => assign.mutateAsync({
                        id: r.id,
                        ownerId: e.target.value === "" ? null : Number(e.target.value),
                      }),
                      e.target.value === "" ? "Owner cleared" : "Finding assigned",
                    )
                  }
                >
                  <option value="">Unassigned</option>
                  {(members.data ?? []).map(m => (
                    <option key={m.userId} value={m.userId}>{m.email}</option>
                  ))}
                </Select>
              </div>
            </FieldGroup>
          )}

          <FieldGroup title="Record">
            <Field label="Severity" value={r.severity} />
            <Field label="Status" value={STATUS_LABEL[r.status]} />
            <Field label="Source" value={SOURCE_LABEL[r.source]} />
            <Field label="Owner" value={r.owner?.email ?? "Unassigned"} />
            <Field label="Raised" value={fmtDate(r.createdAt)} />
            <Field label="Due" value={fmtDate(r.dueAt)} />
            {r.resolvedAt && <Field label="Closed" value={fmtDate(r.resolvedAt)} />}
          </FieldGroup>

          {/*
            The API is explicit that closing a finding records a decision. It
            does not change the estate. Saying so here stops the drawer
            implying the underlying problem went away.
          */}
          <p className="rounded-md border border-default bg-raised-2 px-3 py-2 text-caption text-tertiary">
            Closing a finding records who decided what, and when. It does not
            alter the asset, control or threat it points at. Change those
            directly if the estate itself needs to move.
          </p>

          {/*
            One link per entity the finding actually points at. This was
            previously a single branch on subject.type === "Asset", a field
            that has never existed, so no link ever rendered.
          */}
          {subjectRefs(r.subject).filter(x => x.to).map(x => (
            <Btn key={x.to} variant="outline" className="w-full" onClick={() => navigate(x.to!)}>
              Open {x.label}
            </Btn>
          ))}
        </div>
      )}
    </SlideOver>
  );
}

function CreateRemediationModal({ onClose }: { onClose: () => void }) {
  const create = useCreateRemediation();
  const members = useOrgMembers();
  const [form, setForm] = useState({
    title: "", description: "", recommendation: "",
    severity: "MEDIUM" as RemediationSeverity, ownerId: "", dueAt: "",
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!form.title.trim() || !form.description.trim() || !form.recommendation.trim()) {
      setError("Title, description and recommended action are all required.");
      return;
    }
    try {
      await create.mutateAsync({
        title: form.title.trim(),
        description: form.description.trim(),
        recommendation: form.recommendation.trim(),
        severity: form.severity,
        source: "MANUAL",
        ...(form.ownerId ? { ownerId: Number(form.ownerId) } : {}),
        ...(form.dueAt ? { dueAt: new Date(form.dueAt).toISOString() } : {}),
      });
      notify.success("Finding raised");
      onClose();
    } catch (err) {
      setError(describeApiError(toApiError(err)).message);
    }
  };

  return (
    <Modal open onClose={onClose} title="New finding" size="md">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-label-md text-primary">Title</span>
          <Input
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Billing DB stores PHI unencrypted"
            className="w-full"
            disabled={create.isPending}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-label-md text-primary">What is wrong</span>
          <Textarea
            rows={3}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="87,100 records at rest without encryption."
            disabled={create.isPending}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-label-md text-primary">Recommended action</span>
          <Textarea
            rows={2}
            value={form.recommendation}
            onChange={e => setForm({ ...form, recommendation: e.target.value })}
            placeholder="Enable AES-256 and re-key during the next maintenance window."
            disabled={create.isPending}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-label-md text-primary">Severity</span>
            <Select
              value={form.severity}
              onChange={e => setForm({ ...form, severity: e.target.value as RemediationSeverity })}
              className="w-full"
              disabled={create.isPending}
            >
              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-label-md text-primary">Due</span>
            <Input
              type="date"
              value={form.dueAt}
              onChange={e => setForm({ ...form, dueAt: e.target.value })}
              className="w-full"
              disabled={create.isPending}
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-label-md text-primary">Owner</span>
          <Select
            value={form.ownerId}
            onChange={e => setForm({ ...form, ownerId: e.target.value })}
            className="w-full"
            disabled={create.isPending}
          >
            <option value="">Unassigned</option>
            {(members.data ?? []).map(m => (
              <option key={m.userId} value={m.userId}>{m.email}</option>
            ))}
          </Select>
        </label>
      </div>

      {error && (
        <div role="alert" className="mt-3 rounded-md border border-feedback-error-stroke bg-feedback-error-background px-3 py-2 text-body-sm text-feedback-error">
          {error}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Btn variant="outline" onClick={onClose} disabled={create.isPending}>Cancel</Btn>
        <Btn variant="primary" onClick={() => void submit()} disabled={create.isPending}>
          {create.isPending ? "Raising…" : "Raise finding"}
        </Btn>
      </div>
    </Modal>
  );
}
