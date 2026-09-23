import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Badge, Btn, Input, Select, Modal, SlideOver, ChartSkeleton, ErrorState } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataTable, listAsQuery, type Column } from "@/components/DataTable";
import {
  PageHeader, MetricCard, RiskBadge, RiskScore, formatScore, Tabs, TabPanel, Field, FieldGroup,
  FilterBar, EntityAvatar, BAND_TONE, bandRank, SENSITIVITY_TONE,
} from "@/components/ui-patterns";
import { DomainIcon } from "@/components/DomainIcon";
import { useAssets, useAsset } from "@/hooks/useAssets";
import { useListControls } from "@/hooks/useListControls";
import { useCreateAsset, useUpdateAsset, useRecomputeAssetRisk } from "@/hooks/useMutations";
import { useCanWrite } from "@/hooks/use-auth";
import { describeApiError, toApiError } from "@/lib/apiErrors";
import { notify } from "@/lib/notify";
import { ASSET_TYPES, type ApiAsset, type AssetType, type RiskBand } from "@/lib/apiTypes";

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
  const canWrite = useCanWrite();

  const [params, setParams] = useSearchParams();
  const openId = params.get("open") ? Number(params.get("open")) : null;
  const [createOpen, setCreateOpen] = useState(false);

  /*
   * Band filtering and search are server-side. Doing either over the current
   * page would answer "no EXTREME assets" for an estate whose extreme assets
   * happen to sit on page two.
   */
  const controls = useListControls<{ band?: RiskBand }>({ band: undefined });
  const assets = useAssets(controls.params);
  const rows = useMemo(() => assets.data ?? [], [assets.data]);

  /*
   * Estate-wide figures, from a second query that asks for the whole
   * inventory rather than the page on screen. Counting the 25 rows in front
   * of the user and calling it "Assets" is the failure this avoids.
   */
  const all = useAssets({ pageSize: 200 });
  const allRows = useMemo(() => all.data ?? [], [all.data]);

  const stats = useMemo(() => {
    if (!all.data) return null;
    return {
      total: all.meta?.total ?? allRows.length,
      phiRecords: allRows.reduce((s, a) => s + a.phiVolume, 0),
      unencrypted: allRows.filter(a => !a.encrypted).length,
      criticalOrExtreme: allRows.filter(a => a.risk?.band === "CRITICAL" || a.risk?.band === "EXTREME").length,
      unscored: allRows.filter(a => a.risk === null).length,
      noMfa: allRows.filter(a => !a.mfaEnabled).length,
    };
  }, [allRows, all.data, all.meta]);

  const bandCounts = useMemo(() => ({
    all: all.meta?.total ?? allRows.length,
    EXTREME: allRows.filter(a => a.risk?.band === "EXTREME").length,
    CRITICAL: allRows.filter(a => a.risk?.band === "CRITICAL").length,
    HIGH: allRows.filter(a => a.risk?.band === "HIGH").length,
    MODERATE: allRows.filter(a => a.risk?.band === "MODERATE").length,
    LOW: allRows.filter(a => a.risk?.band === "LOW").length,
  }), [allRows, all.meta]);

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
      cell: a => <RiskScore score={a.risk?.score} />,
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
          query={listAsQuery(assets)}
          server={{
            meta: assets.meta,
            page: controls.page,
            onPageChange: controls.setPage,
            pageSize: controls.pageSize,
            onPageSizeChange: controls.setPageSize,
            onSearch: controls.setSearch,
            searchValue: controls.search,
            isPaging: assets.isPaging,
          }}
          columns={columns}
          getRowId={a => a.id}
          onRowClick={a => openAsset(a.id)}
          isRowActive={a => a.id === openId}
          initialSort={{ columnId: "score", direction: "desc" }}
          searchPlaceholder="Search assets…"
          emptyIcon="database"
          emptyTitle="No assets yet"
          emptyMessage="Import an asset CSV from Data Import, or create one directly."
          toolbar={
            <FilterBar
              label="Filter by risk band"
              value={controls.filters.band ?? "all"}
              onChange={v => controls.setFilter("band", v === "all" ? undefined : (v as RiskBand))}
              options={[
                { value: "all", label: "All", count: bandCounts.all },
                { value: "EXTREME", label: "Extreme", count: bandCounts.EXTREME },
                { value: "CRITICAL", label: "Critical", count: bandCounts.CRITICAL },
                { value: "HIGH", label: "High", count: bandCounts.HIGH },
                { value: "MODERATE", label: "Moderate", count: bandCounts.MODERATE },
                { value: "LOW", label: "Low", count: bandCounts.LOW },
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
  const navigate = useNavigate();
  const detail = useAsset(id);
  const recompute = useRecomputeAssetRisk();
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);

  const a = detail.data;

  const onRecompute = async () => {
    if (!a) return;
    try {
      const next = await recompute.mutateAsync(a.id);
      notify.success(`Risk rescored: ${formatScore(next.score)} (${next.band})`);
    } catch (err) {
      notify.error(describeApiError(toApiError(err)).message);
    }
  };

  return (
    <SlideOver
      open={id !== null}
      onClose={onClose}
      width={560}
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
              { id: "access", label: "Access", count: a.access?.length ?? 0 },
              { id: "vendors", label: "Vendors", count: a.vendors?.length ?? 0 },
              { id: "threats", label: "Threats", count: a.threats?.length ?? 0 },
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
                    <RiskScore score={a.risk.score} className="font-display text-display-metric tabular text-primary" />
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

                  <FieldGroup title={`Controls applied (${a.controls?.length ?? 0})`}>
                    {(a.controls?.length ?? 0) === 0
                      ? <p className="py-2 text-body-sm text-quaternary">No controls are recorded against this asset.</p>
                      : a.controls.map(c => (
                          <Field key={c.id} label={c.name} value={<Badge tone="muted">{c.status}</Badge>} />
                        ))}
                  </FieldGroup>

                  <FieldGroup title={`Open findings (${a.remediations?.length ?? 0})`}>
                    {(a.remediations?.length ?? 0) === 0
                      ? <p className="py-2 text-body-sm text-quaternary">No remediation has been raised for this asset.</p>
                      : a.remediations.map(r => (
                          <Field key={r.id} label={r.title} value={<Badge tone="muted">{r.status}</Badge>} />
                        ))}
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

          {tab === "access" && (
            <TabPanel>
              {(a.access?.length ?? 0) === 0 ? (
                <Empty>Nobody holds a recorded grant on this asset.</Empty>
              ) : (
                <div className="space-y-2">
                  {a.access.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => navigate(`/access?search=${encodeURIComponent(g.identityName)}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-default p-2.5 text-left transition-colors hover:border-active"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <EntityAvatar icon="identity" tone={g.active ? "muted" : "danger"} size="sm" />
                        <span className="min-w-0">
                          <span className={`block truncate text-body-md text-primary ${!g.active ? "line-through opacity-70" : ""}`}>
                            {g.identityName}
                          </span>
                          <span className="block text-caption text-tertiary">
                            {g.lastUsedAt ? `Last used ${fmtDate(g.lastUsedAt)}` : "Never used"}
                          </span>
                        </span>
                      </span>
                      <span className="flex flex-shrink-0 items-center gap-1.5">
                        {!g.mfaEnabled && <Badge tone="warning">No MFA</Badge>}
                        <Badge tone={g.level === "ADMIN" ? "danger" : g.level === "WRITE" ? "warning" : "muted"}>
                          {g.level}
                        </Badge>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </TabPanel>
          )}

          {tab === "vendors" && (
            <TabPanel>
              {(a.vendors?.length ?? 0) === 0 ? (
                <Empty>No third party reaches this asset.</Empty>
              ) : (
                <div className="space-y-2">
                  {a.vendors.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => navigate(`/vendors?open=${v.id}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-default p-2.5 text-left transition-colors hover:border-active"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <EntityAvatar icon="vendor" tone={v.baaStatus === "SIGNED" ? "success" : "danger"} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-body-md text-primary">{v.name}</span>
                          <span className="block text-caption text-tertiary">
                            Access since {fmtDate(v.grantedAt)}
                          </span>
                        </span>
                      </span>
                      <Badge tone={v.baaStatus === "SIGNED" ? "success" : v.baaStatus === "PENDING" ? "warning" : "danger"}>
                        BAA {v.baaStatus.toLowerCase()}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </TabPanel>
          )}

          {tab === "threats" && (
            <TabPanel>
              {(a.threats?.length ?? 0) === 0 ? (
                <Empty>Nothing has been detected against this asset.</Empty>
              ) : (
                <div className="space-y-2">
                  {a.threats.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => navigate(`/threats?open=${t.id}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-default p-2.5 text-left transition-colors hover:border-active"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <EntityAvatar
                          icon="threat"
                          tone={t.severity === "CRITICAL" || t.severity === "HIGH" ? "danger" : "warning"}
                          size="sm"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-body-md text-primary">{t.title}</span>
                          <span className="block text-caption text-tertiary">
                            Detected {fmtDate(t.detectedAt)}
                          </span>
                        </span>
                      </span>
                      <span className="flex flex-shrink-0 items-center gap-1.5">
                        <Badge tone={t.severity === "CRITICAL" || t.severity === "HIGH" ? "danger" : "warning"}>
                          {t.severity}
                        </Badge>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </TabPanel>
          )}
        </div>
      )}

      {a && editing && <EditAssetModal asset={a} onClose={() => setEditing(false)} />}
    </SlideOver>
  );
}

/** One wording for "this asset has none of these". */
const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="py-6 text-center text-body-sm text-tertiary">{children}</p>
);

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
