import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, Badge, Btn, Input, Select, Modal, SlideOver, ChartSkeleton, ErrorState } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataTable, withRows, type Column } from "@/components/DataTable";
import {
  PageHeader, MetricCard, RiskBadge, Tabs, TabPanel, Field, FieldGroup,
  FilterBar, EntityAvatar, BAND_TONE, bandRank, SENSITIVITY_TONE,
} from "@/components/ui-patterns";
import { DomainIcon } from "@/components/DomainIcon";
import { useAssets, useAsset } from "@/hooks/useAssets";
import { useCreateAsset, useUpdateAsset, useRecomputeAssetRisk } from "@/hooks/useMutations";
import { useAuth } from "@/hooks/use-auth";
import { describeApiError, toApiError } from "@/lib/apiErrors";
import { notify } from "@/lib/notify";
import { ASSET_TYPES, type ApiAsset, type AssetType } from "@/lib/apiTypes";

/**
 * Asset inventory — the first step of the Drishti model.
 *
 * Everything else hangs off an asset: PHI lives in one, identities reach one,
 * vendors touch one, risk is scored per one. The product had no asset screen
 * at all, while the API had list, detail, create, update and recompute — so
 * this page is new UI over endpoints that already existed.
 */

const TYPE_LABEL: Record<AssetType, string> = {
  EHR: "EHR",
  DATABASE: "Database",
  API: "API",
  CLOUD_STORAGE: "Cloud storage",
  ANALYTICS: "Analytics",
  OTHER: "Other",
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Never";

const daysSince = (iso: string | null) =>
  iso === null ? null : Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export default function Assets() {
  const assets = useAssets();
  const { user } = useAuth();
  const canWrite = user?.role === "ADMIN" || user?.role === "ANALYST";

  const [params, setParams] = useSearchParams();
  const openId = params.get("open") ? Number(params.get("open")) : null;
  const [bandFilter, setBandFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => assets.data ?? [], [assets.data]);

  const filtered = useMemo(() => {
    if (bandFilter === "all") return rows;
    if (bandFilter === "unscored") return rows.filter(a => a.risk === null);
    return rows.filter(a => a.risk?.band === bandFilter);
  }, [rows, bandFilter]);

  /** Headline numbers, all derived from the same response the table renders. */
  const stats = useMemo(() => {
    if (!assets.data) return null;
    return {
      total: rows.length,
      phiRecords: rows.reduce((s, a) => s + a.phiVolume, 0),
      unencrypted: rows.filter(a => !a.encrypted).length,
      criticalOrExtreme: rows.filter(a => a.risk?.band === "CRITICAL" || a.risk?.band === "EXTREME").length,
      unscored: rows.filter(a => a.risk === null).length,
      noMfa: rows.filter(a => !a.mfaEnabled).length,
    };
  }, [rows, assets.data]);

  const bandCounts = useMemo(() => ({
    all: rows.length,
    EXTREME: rows.filter(a => a.risk?.band === "EXTREME").length,
    CRITICAL: rows.filter(a => a.risk?.band === "CRITICAL").length,
    HIGH: rows.filter(a => a.risk?.band === "HIGH").length,
    MODERATE: rows.filter(a => a.risk?.band === "MODERATE").length,
    LOW: rows.filter(a => a.risk?.band === "LOW").length,
    unscored: rows.filter(a => a.risk === null).length,
  }), [rows]);

  const openAsset = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id === null) next.delete("open");
    else next.set("open", String(id));
    setParams(next, { replace: true });
  };

  const columns: Column<ApiAsset>[] = [
    {
      id: "name",
      header: "Asset",
      sortValue: a => a.name,
      searchValue: a => `${a.name} ${a.type}`,
      cell: a => (
        <div className="flex items-center gap-2.5">
          <EntityAvatar icon="asset" tone={a.risk ? BAND_TONE[a.risk.band] : "muted"} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-body-md text-primary">{a.name}</div>
            <div className="text-caption text-tertiary">{TYPE_LABEL[a.type]}</div>
          </div>
        </div>
      ),
    },
    {
      id: "phiVolume",
      header: "PHI records",
      align: "right",
      sortValue: a => a.phiVolume,
      cell: a => a.phiVolume.toLocaleString(),
    },
    {
      id: "protection",
      header: "Protection",
      hideBelow: "md",
      sortValue: a => Number(a.encrypted) + Number(a.mfaEnabled),
      cell: a => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge tone={a.encrypted ? "success" : "danger"}>
            {a.encrypted ? "Encrypted" : "Unencrypted"}
          </Badge>
          {!a.mfaEnabled && <Badge tone="warning">No MFA</Badge>}
        </div>
      ),
    },
    {
      id: "lastAssessed",
      header: "Last assessed",
      hideBelow: "lg",
      sortValue: a => (a.lastAssessedAt ? new Date(a.lastAssessedAt).getTime() : null),
      cell: a => {
        const d = daysSince(a.lastAssessedAt);
        return (
          <span className={d === null || d > 180 ? "text-feedback-warning" : "text-tertiary"}>
            {fmtDate(a.lastAssessedAt)}
            {d !== null && d > 180 && " · overdue"}
          </span>
        );
      },
    },
    {
      id: "score",
      header: "Score",
      align: "right",
      sortValue: a => a.risk?.score ?? null,
      cell: a => <span className="tabular">{a.risk ? a.risk.score : "—"}</span>,
    },
    {
      id: "band",
      header: "Risk",
      sortValue: a => bandRank(a.risk?.band),
      cell: a => <RiskBadge band={a.risk?.band ?? null} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon="asset"
        title="Asset Inventory"
        description="Every system, service and data store Drishti monitors. Risk is scored per asset by the API; this view never re-derives it."
        actions={
          <>
            <Btn variant="outline" onClick={() => void assets.refresh()} disabled={assets.isFetching}>
              <AppIcon name="refresh" size="sm" spin={assets.isFetching} />
              Refresh
            </Btn>
            {canWrite && (
              <Btn variant="primary" onClick={() => setCreateOpen(true)}>
                <AppIcon name="add" size="sm" />
                New asset
              </Btn>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Assets" value={stats?.total} icon="database" />
        <MetricCard
          label="PHI records"
          value={stats ? stats.phiRecords.toLocaleString() : undefined}
          icon="record"
          sub="across all assets"
        />
        <MetricCard
          label="Unencrypted"
          value={stats?.unencrypted}
          icon="unlocked"
          tone="danger"
          emphasis={Boolean(stats?.unencrypted)}
          sub={stats ? `${stats.noMfa} without MFA` : undefined}
        />
        <MetricCard
          label="Critical or extreme"
          value={stats?.criticalOrExtreme}
          icon="threats"
          tone="danger"
          emphasis={Boolean(stats?.criticalOrExtreme)}
          sub={stats?.unscored ? `${stats.unscored} not yet scored` : undefined}
        />
      </div>

      <Card className="p-4">
        <DataTable
          label="Asset inventory"
          query={withRows(assets, filtered)}
          columns={columns}
          getRowId={a => a.id}
          onRowClick={a => openAsset(a.id)}
          isRowActive={a => a.id === openId}
          initialSort={{ columnId: "score", direction: "desc" }}
          searchPlaceholder="Search assets…"
          emptyTitle="No assets yet"
          emptyMessage="Import an asset CSV from Data Import, or create one directly."
          toolbar={
            <FilterBar
              label="Filter by risk band"
              value={bandFilter}
              onChange={setBandFilter}
              options={[
                { value: "all", label: "All", count: bandCounts.all },
                { value: "EXTREME", label: "Extreme", count: bandCounts.EXTREME },
                { value: "CRITICAL", label: "Critical", count: bandCounts.CRITICAL },
                { value: "HIGH", label: "High", count: bandCounts.HIGH },
                { value: "MODERATE", label: "Moderate", count: bandCounts.MODERATE },
                { value: "LOW", label: "Low", count: bandCounts.LOW },
                { value: "unscored", label: "Not scored", count: bandCounts.unscored },
              ]}
            />
          }
        />
      </Card>

      <AssetDrawer id={openId} onClose={() => openAsset(null)} canWrite={canWrite} />
      {createOpen && <CreateAssetModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

/* --------------------------------------------------------------- drawer */

function AssetDrawer({ id, onClose, canWrite }: { id: number | null; onClose: () => void; canWrite: boolean }) {
  const detail = useAsset(id);
  const recompute = useRecomputeAssetRisk();
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);

  const a = detail.data;

  const onRecompute = async () => {
    if (!a) return;
    try {
      const next = await recompute.mutateAsync(a.id);
      notify.success(`Risk rescored: ${next.score} (${next.band})`);
    } catch (err) {
      notify.error(describeApiError(toApiError(err)).message);
    }
  };

  return (
    <SlideOver
      open={id !== null}
      onClose={onClose}
      width={520}
      title={a?.name ?? "Asset"}
      footer={
        a && canWrite ? (
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
      {detail.isLoading && <ChartSkeleton height={340} label="Loading asset" />}

      {!detail.isLoading && detail.isError && (
        <ErrorState
          title={describeApiError(detail.error).title}
          message={describeApiError(detail.error).message}
          onRetry={() => void detail.refresh()}
          height={280}
        />
      )}

      {a && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <EntityAvatar icon="asset" tone={a.risk ? BAND_TONE[a.risk.band] : "muted"} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge band={a.risk?.band ?? null} />
                <Badge tone={a.encrypted ? "success" : "danger"}>
                  {a.encrypted ? "Encrypted" : "Unencrypted"}
                </Badge>
                <Badge tone={a.mfaEnabled ? "success" : "warning"}>
                  {a.mfaEnabled ? "MFA on" : "No MFA"}
                </Badge>
              </div>
              <p className="mt-1.5 text-body-sm text-tertiary">
                {TYPE_LABEL[a.type]} · {a.phiVolume.toLocaleString()} PHI records
              </p>
            </div>
          </div>

          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { id: "overview", label: "Overview" },
              { id: "risk", label: "Risk" },
              { id: "phi", label: "PHI", count: a.phiTypes.length },
              { id: "flows", label: "Flows", count: a.flows.inbound.length + a.flows.outbound.length },
            ]}
          />

          {tab === "overview" && (
            <TabPanel>
              <FieldGroup>
                <Field label="Type" value={TYPE_LABEL[a.type]} />
                <Field label="PHI records" value={a.phiVolume.toLocaleString()} />
                <Field label="Encryption" value={a.encrypted ? "Enabled" : "Not enabled"} />
                <Field label="MFA" value={a.mfaEnabled ? "Enforced" : "Not enforced"} />
                <Field label="Last assessed" value={fmtDate(a.lastAssessedAt)} />
                <Field label="Added" value={fmtDate(a.createdAt)} />
              </FieldGroup>
            </TabPanel>
          )}

          {tab === "risk" && (
            <TabPanel>
              {a.risk ? (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-display-metric tabular text-primary">{a.risk.score}</span>
                    <RiskBadge band={a.risk.band} />
                  </div>
                  <p className="text-body-sm text-tertiary">
                    Scored by the API from four factors. Drishti never recomputes this client-side.
                  </p>
                  <FieldGroup title="Factors">
                    <Field label="Likelihood" value={`${a.risk.likelihood} / 5`} />
                    <Field label="Impact" value={`${a.risk.impact} / 5`} />
                    <Field label="Exposure" value={`${a.risk.exposure} / 5`} />
                    <Field label="Control gap" value={`${a.risk.controlGap} / 5`} />
                    <Field label="Computed" value={fmtDate(a.risk.computedAt)} />
                  </FieldGroup>
                </div>
              ) : (
                <p className="py-6 text-center text-body-sm text-tertiary">
                  This asset has never been scored. Use <strong>Recompute risk</strong> to run the scoring engine.
                </p>
              )}
            </TabPanel>
          )}

          {tab === "phi" && (
            <TabPanel>
              {a.phiTypes.length === 0 ? (
                <p className="py-6 text-center text-body-sm text-tertiary">
                  No PHI categories are mapped to this asset.
                </p>
              ) : (
                <div className="space-y-2">
                  {a.phiTypes.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-default p-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <DomainIcon name="phi" size={18} className="text-icon-tertiary" />
                        <div className="min-w-0">
                          <div className="truncate text-body-md text-primary">{p.name}</div>
                          <div className="text-caption text-tertiary">
                            {p.recordsPerDay.toLocaleString()} records/day
                          </div>
                        </div>
                      </div>
                      <Badge tone={SENSITIVITY_TONE[p.sensitivity]}>{p.sensitivity}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabPanel>
          )}

          {tab === "flows" && (
            <TabPanel>
              <div className="space-y-4">
                <FlowList title="Inbound" items={a.flows.inbound.map(f => ({ name: f.from, ...f }))} direction="in" />
                <FlowList title="Outbound" items={a.flows.outbound.map(f => ({ name: f.to, ...f }))} direction="out" />
              </div>
            </TabPanel>
          )}
        </div>
      )}

      {a && editing && <EditAssetModal asset={a} onClose={() => setEditing(false)} />}
    </SlideOver>
  );
}

function FlowList({
  title, items, direction,
}: {
  title: string;
  items: Array<{ name: string; recordsPerDay: number; encrypted: boolean }>;
  direction: "in" | "out";
}) {
  return (
    <FieldGroup title={`${title} (${items.length})`}>
      {items.length === 0 ? (
        <p className="py-2 text-body-sm text-quaternary">No {title.toLowerCase()} flows.</p>
      ) : (
        items.map(f => (
          <div key={`${direction}-${f.name}`} className="flex items-center justify-between gap-3 border-b border-muted py-2 last:border-0">
            <span className="flex min-w-0 items-center gap-2">
              <AppIcon name={direction === "in" ? "arrowDown" : "arrowUp"} size="sm" className="text-icon-quaternary" />
              <span className="truncate text-body-sm text-primary">{f.name}</span>
            </span>
            <span className="flex flex-shrink-0 items-center gap-2">
              <span className="tabular text-caption text-tertiary">{f.recordsPerDay.toLocaleString()}/day</span>
              {!f.encrypted && <Badge tone="danger">Unencrypted</Badge>}
            </span>
          </div>
        ))
      )}
    </FieldGroup>
  );
}

/* ---------------------------------------------------------------- forms */

type AssetFormState = {
  name: string; type: AssetType; phiVolume: string;
  encrypted: boolean; mfaEnabled: boolean; lastAssessedAt: string;
};

function AssetForm({
  state, setState, disabled,
}: { state: AssetFormState; setState: (s: AssetFormState) => void; disabled?: boolean }) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-label-md text-primary">Name</span>
        <Input
          value={state.name}
          onChange={e => setState({ ...state, name: e.target.value })}
          placeholder="e.g. Cardiology PACS"
          className="w-full"
          required
          disabled={disabled}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-label-md text-primary">Type</span>
        <Select
          value={state.type}
          onChange={e => setState({ ...state, type: e.target.value as AssetType })}
          className="w-full"
          disabled={disabled}
        >
          {ASSET_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
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
      <div className="flex gap-4 pt-1">
        <label className="flex items-center gap-2 text-body-md text-primary">
          <input
            type="checkbox"
            checked={state.encrypted}
            onChange={e => setState({ ...state, encrypted: e.target.checked })}
            disabled={disabled}
          />
          Encrypted at rest
        </label>
        <label className="flex items-center gap-2 text-body-md text-primary">
          <input
            type="checkbox"
            checked={state.mfaEnabled}
            onChange={e => setState({ ...state, mfaEnabled: e.target.checked })}
            disabled={disabled}
          />
          MFA enforced
        </label>
      </div>
    </div>
  );
}

function CreateAssetModal({ onClose }: { onClose: () => void }) {
  const create = useCreateAsset();
  const [state, setState] = useState<AssetFormState>({
    name: "", type: "OTHER", phiVolume: "0", encrypted: false, mfaEnabled: false, lastAssessedAt: "",
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!state.name.trim()) { setError("Name is required."); return; }
    try {
      await create.mutateAsync({
        name: state.name.trim(),
        type: state.type,
        phiVolume: Number(state.phiVolume) || 0,
        encrypted: state.encrypted,
        mfaEnabled: state.mfaEnabled,
        lastAssessedAt: state.lastAssessedAt ? new Date(state.lastAssessedAt).toISOString() : null,
      });
      notify.success(`Asset “${state.name.trim()}” created`);
      onClose();
    } catch (err) {
      setError(describeApiError(toApiError(err)).message);
    }
  };

  return (
    <Modal open onClose={onClose} title="New asset" size="md">
      <AssetForm state={state} setState={setState} disabled={create.isPending} />
      {error && (
        <div role="alert" className="mt-3 rounded-md border border-feedback-error-stroke bg-feedback-error-background px-3 py-2 text-body-sm text-feedback-error">
          {error}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Btn variant="outline" onClick={onClose} disabled={create.isPending}>Cancel</Btn>
        <Btn variant="primary" onClick={() => void submit()} disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create asset"}
        </Btn>
      </div>
    </Modal>
  );
}

function EditAssetModal({
  asset, onClose,
}: { asset: { id: number; name: string; type: AssetType; phiVolume: number; encrypted: boolean; mfaEnabled: boolean; lastAssessedAt: string | null }; onClose: () => void }) {
  const update = useUpdateAsset(asset.id);
  const [state, setState] = useState<AssetFormState>({
    name: asset.name,
    type: asset.type,
    phiVolume: String(asset.phiVolume),
    encrypted: asset.encrypted,
    mfaEnabled: asset.mfaEnabled,
    lastAssessedAt: asset.lastAssessedAt ? asset.lastAssessedAt.slice(0, 10) : "",
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!state.name.trim()) { setError("Name is required."); return; }
    try {
      await update.mutateAsync({
        name: state.name.trim(),
        type: state.type,
        phiVolume: Number(state.phiVolume) || 0,
        encrypted: state.encrypted,
        mfaEnabled: state.mfaEnabled,
        lastAssessedAt: state.lastAssessedAt ? new Date(state.lastAssessedAt).toISOString() : null,
      });
      notify.success("Asset updated");
      onClose();
    } catch (err) {
      setError(describeApiError(toApiError(err)).message);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Edit ${asset.name}`} size="md">
      <AssetForm state={state} setState={setState} disabled={update.isPending} />
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
