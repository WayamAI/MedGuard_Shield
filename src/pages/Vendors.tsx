import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Badge, Btn, Input, Select, Modal, SlideOver, ChartSkeleton, ErrorState, HeadlineSkeleton } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataTable, listAsQuery, type Column } from "@/components/DataTable";
import {
  PageHeader, MetricCard, RiskBadge, RiskScore, formatScore, Tabs, TabPanel, Field, FieldGroup,
  FilterBar, EntityAvatar, MiniBar, BAND_TONE, BAND_ORDER, bandRank,
  BAA_TONE, BAA_LABEL,
} from "@/components/ui-patterns";
import { useVendors, useVendor } from "@/hooks/useVendors";
import { useListControls } from "@/hooks/useListControls";
import { daysAgoLabel } from "@/lib/dates";
import { useCreateVendor, useUpdateVendor, useRecomputeVendorRisk } from "@/hooks/useMutations";
import { useCanWrite } from "@/hooks/use-auth";
import { describeApiError, toApiError } from "@/lib/apiErrors";
import { notify } from "@/lib/notify";
import type { ApiVendor, BaaStatus } from "@/lib/apiTypes";

/**
 * Vendor risk, backed by /api/vendors.
 *
 * The register deliberately leads with the compliance gap rather than the
 * score. A vendor touching PHI without a signed BAA is a HIPAA breach on its
 * own, whether or not anything has leaked, so that fact is surfaced at the top
 * instead of being one column among many.
 */

const BAA_STATUSES: BaaStatus[] = ["SIGNED", "PENDING", "EXPIRED", "MISSING"];

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Never";

const assessedLabel = (v: ApiVendor) =>
  v.lastAssessedAt === null ? "Never assessed" : daysAgoLabel(v.daysSinceAssessment);

export default function Vendors() {
  const canWrite = useCanWrite();

  const [params, setParams] = useSearchParams();
  const openId = params.get("open") ? Number(params.get("open")) : null;
  const [createOpen, setCreateOpen] = useState(false);

  const controls = useListControls<{ baaStatus?: BaaStatus }>({ baaStatus: undefined });
  const vendors = useVendors(controls.params);
  const rows = useMemo(() => vendors.data ?? [], [vendors.data]);

  /* Whole-register figures, not page figures. */
  const all = useVendors({ pageSize: 200 });
  const allRows = useMemo(() => all.data ?? [], [all.data]);

  const stats = useMemo(() => {
    if (!all.data) return null;
    return {
      total: all.meta?.total ?? allRows.length,
      noBaa: allRows.filter(v => !v.baaCompliant).length,
      overdue: allRows.filter(v => v.assessmentOverdue).length,
      phiVolume: allRows.reduce((s, v) => s + v.phiVolume, 0),
    };
  }, [allRows, all.data, all.meta]);

  const bandCounts = useMemo(
    () => Object.fromEntries(BAND_ORDER.map(b => [b, allRows.filter(v => v.risk?.band === b).length])),
    [allRows],
  );

  /** The headline exposure: no valid BAA *and* the highest score. */
  const worstGap = useMemo(
    () => [...allRows]
      .filter(v => !v.baaCompliant)
      .sort((a, b) => (b.risk?.score ?? -1) - (a.risk?.score ?? -1))[0] ?? null,
    [allRows],
  );

  const openVendor = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id === null) next.delete("open");
    else next.set("open", String(id));
    setParams(next, { replace: true });
  };

  const columns: Column<ApiVendor>[] = [
    {
      id: "name",
      header: "Vendor",
      sortValue: v => v.name,
      searchValue: v => v.name,
      cell: v => (
        <div className="flex items-center gap-2.5">
          <EntityAvatar icon="vendor" tone={v.risk ? BAND_TONE[v.risk.band] : "muted"} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-body-md text-primary" data-testid="vendor-row-name">{v.name}</div>
            <div className="text-caption text-tertiary">
              {v.assetCount} system{v.assetCount === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "baa",
      header: "BAA",
      sortValue: v => v.baaStatus,
      cell: v => <Badge tone={BAA_TONE[v.baaStatus]}>{BAA_LABEL[v.baaStatus]}</Badge>,
    },
    {
      id: "phiVolume",
      header: "PHI records",
      align: "right",
      sortValue: v => v.phiVolume,
      cell: v => v.phiVolume.toLocaleString(),
    },
    {
      id: "assessed",
      header: "Last assessed",
      hideBelow: "lg",
      sortValue: v => (v.lastAssessedAt ? new Date(v.lastAssessedAt).getTime() : null),
      cell: v => (
        <span className={v.assessmentOverdue ? "text-feedback-warning" : "text-tertiary"}>
          {assessedLabel(v)}
          {v.assessmentOverdue && " · overdue"}
        </span>
      ),
    },
    {
      id: "score",
      header: "Score",
      align: "right",
      sortValue: v => v.risk?.score ?? null,
      cell: v => <RiskScore score={v.risk?.score} />,
    },
    {
      id: "band",
      header: "Risk",
      sortValue: v => bandRank(v.risk?.band),
      cell: v => (
        <span data-testid={`vendor-row-band-${v.id}`}>
          <RiskBadge band={v.risk?.band ?? null} />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon="vendor"
        title="Vendor Risk"
        description="Third parties with access to PHI, scored by the same engine as asset risk."
        actions={
          <>
            <Btn variant="outline" onClick={() => void vendors.refresh()} disabled={vendors.isFetching}>
              <AppIcon name="refresh" size="sm" spin={vendors.isFetching} />
              Refresh
            </Btn>
            {canWrite && (
              <Btn variant="primary" onClick={() => setCreateOpen(true)}>
                <AppIcon name="add" size="sm" />
                New vendor
              </Btn>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Vendors" value={stats?.total} icon="facility" />
        <MetricCard
          label="Without a valid BAA"
          value={stats?.noBaa}
          icon="threats"
          tone="danger"
          emphasis={Boolean(stats?.noBaa)}
          sub="missing, expired or pending"
        />
        <MetricCard
          label="Assessment overdue"
          value={stats?.overdue}
          icon="clock"
          tone="warning"
          emphasis={Boolean(stats?.overdue)}
        />
        <MetricCard
          label="PHI records exposed"
          value={stats ? stats.phiVolume.toLocaleString() : undefined}
          icon="record"
          sub="across all vendors"
        />
      </div>

      {/* Reserve the banner's space while loading: a headline that appears
          late shoves the whole table down the screen. */}
      {!all.data && <HeadlineSkeleton label="Loading summary" />}

      {worstGap && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-feedback-error-stroke bg-feedback-error-background p-3">
          <AppIcon name="threats" size="md" className="text-feedback-error" />
          <span className="text-body-md text-primary">
            <span className="font-semibold">BAA gap:</span> {worstGap.name} holds{" "}
            {worstGap.phiVolume.toLocaleString()} PHI records across {worstGap.assetCount} system
            {worstGap.assetCount === 1 ? "" : "s"} with a{" "}
            <strong>{worstGap.baaStatus.toLowerCase()}</strong> business associate agreement
            {worstGap.lastAssessedAt === null && ", never assessed"}.
          </span>
          <div className="flex-1" />
          <Btn variant="outline" onClick={() => openVendor(worstGap.id)}>View details</Btn>
        </div>
      )}

      <Card className="p-4">
        <DataTable
          label="Vendor risk register"
          query={listAsQuery(vendors)}
          server={{
            meta: vendors.meta,
            page: controls.page,
            onPageChange: controls.setPage,
            pageSize: controls.pageSize,
            onPageSizeChange: controls.setPageSize,
            onSearch: controls.setSearch,
            searchValue: controls.search,
            isPaging: vendors.isPaging,
          }}
          columns={columns}
          getRowId={v => v.id}
          onRowClick={v => openVendor(v.id)}
          isRowActive={v => v.id === openId}
          initialSort={{ columnId: "score", direction: "desc" }}
          searchPlaceholder="Search vendors…"
          emptyIcon="facility" emptyArt="emptyVendors"
          emptyTitle="No vendors recorded"
          emptyMessage="Import a vendor CSV from Data Import, or create one directly."
          toolbar={
            <FilterBar
              label="Filter by BAA status"
              value={controls.filters.baaStatus ?? "all"}
              onChange={v => controls.setFilter("baaStatus", v === "all" ? undefined : (v as BaaStatus))}
              options={[
                { value: "all", label: "All", count: all.meta?.total ?? allRows.length },
                ...BAA_STATUSES.map(st => ({
                  value: st,
                  label: BAA_LABEL[st],
                  count: allRows.filter(v => v.baaStatus === st).length,
                })),
              ]}
            />
          }
        />
      </Card>

      <Card className="p-4">
        <div className="mb-2 text-label-sm uppercase tracking-wide text-quaternary">
          Risk by band
        </div>
        <MiniBar
          segments={BAND_ORDER.map(b => ({ value: bandCounts[b] ?? 0, tone: BAND_TONE[b], label: b }))}
        />
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2">
          {BAND_ORDER.map(b => (
            <span key={b} className="flex items-center gap-1.5">
              <RiskBadge band={b} />
              {vendors.data
                ? (
                  <span className="tabular text-caption text-tertiary" data-testid={`band-count-${b}`}>
                    {bandCounts[b] ?? 0}
                  </span>
                )
                : <span className="inline-block h-4 w-3 animate-pulse rounded bg-raised-2" />}
            </span>
          ))}
          {allRows.some(v => v.risk === null) && (
            <span className="flex items-center gap-1.5">
              <RiskBadge band={null} />
              <span className="tabular text-caption text-tertiary">
                {allRows.filter(v => v.risk === null).length}
              </span>
            </span>
          )}
        </div>
      </Card>

      <VendorDrawer id={openId} onClose={() => openVendor(null)} canWrite={canWrite} />
      {createOpen && <CreateVendorModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

/* --------------------------------------------------------------- drawer */

function VendorDrawer({ id, onClose, canWrite }: { id: number | null; onClose: () => void; canWrite: boolean }) {
  const detail = useVendor(id);
  const recompute = useRecomputeVendorRisk();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);

  const v = detail.data;

  const onRecompute = async () => {
    if (!v) return;
    try {
      const next = await recompute.mutateAsync(v.id);
      notify.success(
        next.risk ? `Risk rescored: ${formatScore(next.risk.score)} (${next.risk.band})` : "Vendor rescored",
      );
    } catch (err) {
      notify.error(describeApiError(toApiError(err)).message);
    }
  };

  return (
    <SlideOver
      open={id !== null}
      onClose={onClose}
      width={520}
      title={v?.name ?? "Vendor"}
      footer={
        v && canWrite ? (
          <div className="flex w-full items-center gap-2">
            <Btn variant="outline" onClick={() => setEditing(true)} className="flex-1">
              <AppIcon name="edit" size="sm" />
              Edit
            </Btn>
            <Btn variant="primary" onClick={() => void onRecompute()} disabled={recompute.isPending} className="flex-1">
              <AppIcon name="refresh" size="sm" spin={recompute.isPending} />
              {recompute.isPending ? "Rescoring…" : "Recompute risk"}
            </Btn>
          </div>
        ) : undefined
      }
    >
      {detail.isLoading && <ChartSkeleton height={340} label="Loading vendor" />}

      {!detail.isLoading && detail.isError && (
        <ErrorState
          title={describeApiError(detail.error).title}
          message={describeApiError(detail.error).message}
          onRetry={() => void detail.refresh()}
          height={280}
        />
      )}

      {v && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <EntityAvatar icon="vendor" tone={v.risk ? BAND_TONE[v.risk.band] : "muted"} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={BAA_TONE[v.baaStatus]}>BAA {BAA_LABEL[v.baaStatus]}</Badge>
                <RiskBadge band={v.risk?.band ?? null} />
              </div>
              <p className="mt-1.5 text-body-sm text-tertiary">
                {v.phiVolume.toLocaleString()} PHI records · {v.assets.length} system
                {v.assets.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {!v.baaCompliant && (
            <div className="rounded-md border border-feedback-error-stroke bg-feedback-error-background px-3 py-2 text-body-sm text-feedback-error">
              Under HIPAA, a vendor processing PHI without a signed BAA is a compliance breach in
              itself, independent of whether any data has been exposed.
            </div>
          )}

          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { id: "overview", label: "Overview" },
              { id: "risk", label: "Risk" },
              { id: "assets", label: "Assets", count: v.assets.length },
            ]}
          />

          {tab === "overview" && (
            <TabPanel>
              <FieldGroup>
                <Field label="BAA status" value={<Badge tone={BAA_TONE[v.baaStatus]}>{BAA_LABEL[v.baaStatus]}</Badge>} />
                <Field label="PHI records" value={v.phiVolume.toLocaleString()} />
                <Field label="Systems reachable" value={String(v.assets.length)} />
                <Field label="Last assessed" value={fmtDate(v.lastAssessedAt)} />
                <Field
                  label="Assessment overdue"
                  value={v.assessmentOverdue ? <Badge tone="warning">Yes</Badge> : "No"}
                />
                <Field label="Added" value={fmtDate(v.createdAt)} />
              </FieldGroup>
            </TabPanel>
          )}

          {tab === "risk" && (
            <TabPanel>
              {v.risk ? (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-3">
                    <RiskScore score={v.risk.score} className="font-display text-display-metric tabular text-primary" />
                    <RiskBadge band={v.risk.band} />
                  </div>
                  <FieldGroup title="Factors">
                    <Field label="Likelihood" value={`${v.risk.likelihood} / 5`} />
                    <Field label="Impact" value={`${v.risk.impact} / 5`} />
                    <Field label="Exposure" value={`${v.risk.exposure} / 5`} />
                    <Field label="Control gap" value={`${v.risk.controlGap} / 5`} />
                    <Field label="Computed" value={fmtDate(v.risk.computedAt)} />
                  </FieldGroup>
                </div>
              ) : (
                <p className="py-6 text-center text-body-sm text-tertiary">
                  This vendor has never been scored. Use <strong>Recompute risk</strong> to run the
                  scoring engine.
                </p>
              )}
            </TabPanel>
          )}

          {tab === "assets" && (
            <TabPanel>
              {v.assets.length === 0 ? (
                <p className="py-6 text-center text-body-sm text-tertiary">
                  This vendor is not linked to any asset.
                </p>
              ) : (
                <div className="space-y-2">
                  {v.assets.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => navigate(`/assets?open=${a.id}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-default p-2.5 text-left transition-colors hover:border-active"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <EntityAvatar icon="asset" tone={a.encrypted ? "success" : "danger"} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-body-md text-primary">{a.name}</span>
                          <span className="block text-caption text-tertiary">
                            {a.type.replace(/_/g, " ")}
                          </span>
                        </span>
                      </span>
                      <span className="flex flex-shrink-0 items-center gap-2">
                        {!a.encrypted && <Badge tone="danger">Unencrypted</Badge>}
                        <AppIcon name="chevronRight" size="sm" className="text-icon-quaternary" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </TabPanel>
          )}
        </div>
      )}

      {v && editing && <EditVendorModal vendor={v} onClose={() => setEditing(false)} />}
    </SlideOver>
  );
}

/* ---------------------------------------------------------------- forms */

type VendorFormState = { name: string; baaStatus: BaaStatus; phiVolume: string; lastAssessedAt: string };

function VendorForm({
  state, setState, disabled,
}: { state: VendorFormState; setState: (s: VendorFormState) => void; disabled?: boolean }) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-label-md text-primary">Name</span>
        <Input
          value={state.name}
          onChange={e => setState({ ...state, name: e.target.value })}
          placeholder="e.g. Arcadia Care Logistics"
          className="w-full"
          disabled={disabled}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-label-md text-primary">BAA status</span>
        <Select
          value={state.baaStatus}
          onChange={e => setState({ ...state, baaStatus: e.target.value as BaaStatus })}
          className="w-full"
          disabled={disabled}
        >
          {BAA_STATUSES.map(s => <option key={s} value={s}>{BAA_LABEL[s]}</option>)}
        </Select>
      </label>
      <label className="block">
        <span className="mb-1 block text-label-md text-primary">PHI records</span>
        <Input
          type="number"
          min={0}
          value={state.phiVolume}
          onChange={e => setState({ ...state, phiVolume: e.target.value })}
          className="w-full"
          disabled={disabled}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-label-md text-primary">Last assessed</span>
        <Input
          type="date"
          value={state.lastAssessedAt}
          onChange={e => setState({ ...state, lastAssessedAt: e.target.value })}
          className="w-full"
          disabled={disabled}
        />
      </label>
    </div>
  );
}

function CreateVendorModal({ onClose }: { onClose: () => void }) {
  const create = useCreateVendor();
  const [state, setState] = useState<VendorFormState>({
    name: "", baaStatus: "MISSING", phiVolume: "0", lastAssessedAt: "",
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!state.name.trim()) { setError("Name is required."); return; }
    try {
      await create.mutateAsync({
        name: state.name.trim(),
        baaStatus: state.baaStatus,
        phiVolume: Number(state.phiVolume) || 0,
        lastAssessedAt: state.lastAssessedAt ? new Date(state.lastAssessedAt).toISOString() : null,
      });
      notify.success(`Vendor “${state.name.trim()}” created`);
      onClose();
    } catch (err) {
      setError(describeApiError(toApiError(err)).message);
    }
  };

  return (
    <Modal open onClose={onClose} title="New vendor" size="md">
      <VendorForm state={state} setState={setState} disabled={create.isPending} />
      {error && (
        <div role="alert" className="mt-3 rounded-md border border-feedback-error-stroke bg-feedback-error-background px-3 py-2 text-body-sm text-feedback-error">
          {error}
        </div>
      )}
      <p className="mt-3 text-caption text-tertiary">
        A new vendor has no risk record until the scoring engine runs, so it will show as
        “Not scored” until you recompute it.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Btn variant="outline" onClick={onClose} disabled={create.isPending}>Cancel</Btn>
        <Btn variant="primary" onClick={() => void submit()} disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create vendor"}
        </Btn>
      </div>
    </Modal>
  );
}

function EditVendorModal({
  vendor, onClose,
}: { vendor: { id: number; name: string; baaStatus: BaaStatus; phiVolume: number; lastAssessedAt: string | null }; onClose: () => void }) {
  const update = useUpdateVendor(vendor.id);
  const [state, setState] = useState<VendorFormState>({
    name: vendor.name,
    baaStatus: vendor.baaStatus,
    phiVolume: String(vendor.phiVolume),
    lastAssessedAt: vendor.lastAssessedAt ? vendor.lastAssessedAt.slice(0, 10) : "",
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!state.name.trim()) { setError("Name is required."); return; }
    try {
      await update.mutateAsync({
        name: state.name.trim(),
        baaStatus: state.baaStatus,
        phiVolume: Number(state.phiVolume) || 0,
        lastAssessedAt: state.lastAssessedAt ? new Date(state.lastAssessedAt).toISOString() : null,
      });
      notify.success("Vendor updated");
      onClose();
    } catch (err) {
      setError(describeApiError(toApiError(err)).message);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Edit ${vendor.name}`} size="md">
      <VendorForm state={state} setState={setState} disabled={update.isPending} />
      {error && (
        <div role="alert" className="mt-3 rounded-md border border-feedback-error-stroke bg-feedback-error-background px-3 py-2 text-body-sm text-feedback-error">
          {error}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Btn variant="outline" onClick={onClose} disabled={update.isPending}>Cancel</Btn>
        <Btn variant="primary" onClick={() => void submit()} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </Btn>
      </div>
    </Modal>
  );
}
