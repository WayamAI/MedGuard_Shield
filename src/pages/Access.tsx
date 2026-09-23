import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Badge, Btn, Select, SlideOver } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataTable, listAsQuery, type Column } from "@/components/DataTable";
import {
  PageHeader, MetricCard, Field, FieldGroup, FilterBar, EntityAvatar,
} from "@/components/ui-patterns";
import { useAccess, useAccessSummary } from "@/hooks/useAccess";
import { useListControls } from "@/hooks/useListControls";
import { daysAgo, daysAgoLabel } from "@/lib/dates";
import { useRevokeAccess, useReviewAccess, useUpdateAccess } from "@/hooks/useMutations";
import { useCanWrite } from "@/hooks/use-auth";
import { describeApiError, toApiError } from "@/lib/apiErrors";
import { notify } from "@/lib/notify";
import type { ApiAccessGrant, AccessFlag, AccessLevel } from "@/lib/apiTypes";
import type { Tone } from "@/lib/tone";

/**
 * Access review — who can reach which PHI system, and what is wrong with it.
 *
 * Two data sources on purpose. The table is a page of grants; the headline
 * metrics come from /api/access/summary, which is organisation-wide. Deriving
 * "9 grants, 6 flagged" from whatever 25 rows arrived would report the page,
 * not the estate — and on an access review that understatement is the whole
 * finding.
 */

const FLAG_LABEL: Record<AccessFlag, string> = {
  STALE: "Stale",
  NEVER_USED: "Never used",
  NO_MFA: "No MFA",
  INACTIVE_IDENTITY: "Inactive identity",
  EXCESSIVE_LEVEL: "Excessive level",
};

const FLAG_TONE: Record<AccessFlag, Tone> = {
  STALE: "warning",
  NEVER_USED: "danger",
  NO_MFA: "warning",
  INACTIVE_IDENTITY: "danger",
  EXCESSIVE_LEVEL: "warning",
};

const LEVEL_TONE: Record<AccessLevel, Tone> = {
  ADMIN: "danger",
  WRITE: "warning",
  READ: "muted",
};

const LEVELS: AccessLevel[] = ["ADMIN", "WRITE", "READ"];

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Never";

export default function Access() {
  const canWrite = useCanWrite();
  const summary = useAccessSummary();

  const [params, setParams] = useSearchParams();
  const openId = params.get("open") ? Number(params.get("open")) : null;

  const controls = useListControls<{ level?: AccessLevel; flaggedOnly?: boolean }>({
    level: undefined,
    flaggedOnly: undefined,
  });
  const access = useAccess(controls.params);
  const rows = useMemo(() => access.data ?? [], [access.data]);

  const openGrant = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id === null) next.delete("open");
    else next.set("open", String(id));
    setParams(next, { replace: true });
  };

  /** The single worst grant on this page, for the headline banner. */
  const worst = useMemo(
    () => [...rows].sort((a, b) => b.riskFlagCount - a.riskFlagCount)[0] ?? null,
    [rows],
  );

  const columns: Column<ApiAccessGrant>[] = [
    {
      id: "identity",
      header: "Identity",
      sortValue: g => g.identityName,
      cell: g => (
        <div className="flex items-center gap-2.5">
          <EntityAvatar
            icon="identity"
            tone={g.riskFlagCount > 2 ? "danger" : g.riskFlagCount > 0 ? "warning" : "muted"}
            size="sm"
          />
          <div className="min-w-0">
            <div className={`truncate text-body-md text-primary ${!g.active ? "line-through opacity-70" : ""}`}>
              {g.identityName}
            </div>
            <div className="truncate text-caption text-tertiary">
              {g.kind === "SERVICE_ACCOUNT" ? "Service account" : g.department}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "asset",
      header: "System",
      hideBelow: "sm",
      sortValue: g => g.assetName,
      cell: g => <span className="truncate text-body-sm text-secondary">{g.assetName}</span>,
    },
    {
      id: "level",
      header: "Level",
      sortValue: g => g.level,
      cell: g => <Badge tone={LEVEL_TONE[g.level]}>{g.level}</Badge>,
    },
    {
      id: "lastUsed",
      header: "Last used",
      hideBelow: "md",
      sortValue: g => (g.lastUsedAt ? new Date(g.lastUsedAt).getTime() : null),
      cell: g => (
        <span className={g.lastUsedAt === null || (g.daysSinceUse ?? 0) > 90 ? "text-feedback-warning" : "text-tertiary"}>
          {g.lastUsedAt === null ? "Never used" : daysAgoLabel(g.daysSinceUse)}
        </span>
      ),
    },
    {
      id: "flags",
      header: "Findings",
      sortValue: g => g.riskFlagCount,
      cell: g =>
        g.flags.length === 0 ? (
          <span className="text-tertiary">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {g.flags.map(f => (
              <Badge key={f} tone={FLAG_TONE[f]}>{FLAG_LABEL[f]}</Badge>
            ))}
          </div>
        ),
    },
  ];

  const s = summary.data;

  return (
    <div className="space-y-4">
      <PageHeader
        icon="identity"
        title="Access & Identity Review"
        description="Every identity with access to a PHI system, ordered by how much is wrong with the grant."
        actions={
          <Btn variant="outline" onClick={() => { void access.refresh(); void summary.refresh(); }} disabled={access.isFetching}>
            <AppIcon name="refresh" size="sm" spin={access.isFetching} />
            Refresh
          </Btn>
        }
      />

      {/* Organisation-wide, from /api/access/summary — never from the page. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Access grants" value={s?.total} icon="access" />
        <MetricCard
          label="Flagged"
          value={s?.flagged}
          icon="threats"
          tone="warning"
          emphasis={Boolean(s?.flagged)}
          sub={s ? `of ${s.total} grants` : undefined}
        />
        <MetricCard
          label="Without MFA"
          value={s?.withoutMfa}
          icon="unlocked"
          tone="danger"
          emphasis={Boolean(s?.withoutMfa)}
        />
        <MetricCard
          label="Stale or never used"
          value={s ? s.stale + s.neverUsed : undefined}
          icon="clock"
          tone="warning"
          emphasis={Boolean(s && s.stale + s.neverUsed)}
          sub={s ? `unused past ${s.staleAfterDays} days` : undefined}
        />
      </div>

      {worst && worst.riskFlagCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-feedback-error-stroke bg-feedback-error-background p-3">
          <AppIcon name="threats" size="md" className="text-feedback-error" />
          <span className="text-body-md text-primary">
            <span className="font-semibold">Over-privileged grant:</span> {worst.identityName} holds{" "}
            <strong>{worst.level}</strong> on {worst.assetName}
            {!worst.active && " despite being a deactivated identity"}
            {worst.lastUsedAt === null
              ? ", never used"
              : worst.daysSinceUse !== null && worst.daysSinceUse > 90
                ? `, last used ${daysAgo(worst.daysSinceUse)}`
                : ""}.
          </span>
          <div className="flex-1" />
          <Btn variant="outline" onClick={() => openGrant(worst.id)}>View details</Btn>
        </div>
      )}

      <Card className="p-4">
        <DataTable
          label="Access review"
          query={listAsQuery(access)}
          server={{
            meta: access.meta,
            page: controls.page,
            onPageChange: controls.setPage,
            pageSize: controls.pageSize,
            onPageSizeChange: controls.setPageSize,
            onSearch: controls.setSearch,
            searchValue: controls.search,
            isPaging: access.isPaging,
          }}
          columns={columns}
          getRowId={g => g.id}
          onRowClick={g => openGrant(g.id)}
          isRowActive={g => g.id === openId}
          searchPlaceholder="Search identity or system…"
          emptyTitle="No access grants"
          emptyMessage="No grants were returned for the current filters."
          toolbar={
            <>
              <FilterBar
                label="Filter by level"
                value={controls.filters.level ?? "all"}
                onChange={v => controls.setFilter("level", v === "all" ? undefined : (v as AccessLevel))}
                options={[
                  { value: "all", label: "All levels" },
                  ...LEVELS.map(l => ({ value: l, label: l })),
                ]}
              />
              <FilterBar
                label="Filter by finding"
                value={controls.filters.flaggedOnly ? "flagged" : "any"}
                onChange={v => controls.setFilter("flaggedOnly", v === "flagged" ? true : undefined)}
                options={[
                  { value: "any", label: "All grants" },
                  { value: "flagged", label: "Flagged only", count: s?.flagged },
                ]}
              />
            </>
          }
        />
      </Card>

      <AccessDrawer
        grant={rows.find(g => g.id === openId) ?? null}
        onClose={() => openGrant(null)}
        canWrite={canWrite}
      />
    </div>
  );
}

function AccessDrawer({
  grant, onClose, canWrite,
}: { grant: ApiAccessGrant | null; onClose: () => void; canWrite: boolean }) {
  const navigate = useNavigate();
  const revoke = useRevokeAccess();
  const review = useReviewAccess();
  const update = useUpdateAccess();
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const busy = revoke.isPending || review.isPending || update.isPending;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      notify.success(ok);
    } catch (err) {
      notify.error(describeApiError(toApiError(err)).message);
    }
  };

  return (
    <SlideOver
      open={grant !== null}
      onClose={onClose}
      width={460}
      title={grant?.identityName ?? "Access grant"}
      footer={
        grant && canWrite && grant.revokedAt === null ? (
          <div className="flex w-full flex-col gap-2">
            <div className="flex items-center gap-2">
              <Btn
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => void run(() => review.mutateAsync(grant.id), "Grant reviewed")}
              >
                <AppIcon name="check" size="sm" />
                Mark reviewed
              </Btn>
              <Btn
                variant="danger"
                className="flex-1"
                disabled={busy}
                onClick={() => setConfirmRevoke(true)}
              >
                <AppIcon name="block" size="sm" />
                Revoke
              </Btn>
            </div>
            {confirmRevoke && (
              <div className="rounded-md border border-feedback-error-stroke bg-feedback-error-background p-2.5">
                <p className="mb-2 text-body-sm text-feedback-error">
                  Revoke {grant.level} on {grant.assetName} for {grant.identityName}? The grant's
                  history stays attached and it can be re-granted later.
                </p>
                <div className="flex gap-2">
                  <Btn variant="outline" onClick={() => setConfirmRevoke(false)} disabled={busy}>
                    Cancel
                  </Btn>
                  <Btn
                    variant="danger"
                    disabled={busy}
                    onClick={() =>
                      void run(() => revoke.mutateAsync(grant.id), "Access revoked").then(() => {
                        setConfirmRevoke(false);
                        onClose();
                      })
                    }
                  >
                    {revoke.isPending ? "Revoking…" : "Confirm revoke"}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        ) : undefined
      }
    >
      {grant && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <EntityAvatar
              icon="identity"
              tone={grant.riskFlagCount > 2 ? "danger" : grant.riskFlagCount > 0 ? "warning" : "muted"}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={LEVEL_TONE[grant.level]}>{grant.level}</Badge>
                {!grant.active && <Badge tone="danger">Inactive identity</Badge>}
                {grant.revokedAt && <Badge tone="muted">Revoked</Badge>}
              </div>
              <p className="mt-1.5 text-body-sm text-tertiary">
                {grant.identityEmail ?? "Service account"} · {grant.department}
              </p>
            </div>
          </div>

          {grant.flags.length > 0 && (
            <FieldGroup title={`Findings (${grant.flags.length})`}>
              <div className="flex flex-wrap gap-1.5 py-1">
                {grant.flags.map(f => (
                  <Badge key={f} tone={FLAG_TONE[f]}>{FLAG_LABEL[f]}</Badge>
                ))}
              </div>
            </FieldGroup>
          )}

          <FieldGroup title="Grant">
            <Field label="System" value={grant.assetName} />
            <Field label="Level" value={grant.level} />
            <Field label="Granted" value={`${fmtDate(grant.grantedAt)} · ${daysAgoLabel(grant.daysSinceGrant)}`} />
            <Field
              label="Last used"
              value={grant.lastUsedAt === null ? "Never" : `${fmtDate(grant.lastUsedAt)} · ${daysAgoLabel(grant.daysSinceUse)}`}
            />
            <Field label="Last reviewed" value={fmtDate(grant.lastReviewedAt)} />
            {grant.revokedAt && <Field label="Revoked" value={fmtDate(grant.revokedAt)} />}
          </FieldGroup>

          <FieldGroup title="Identity">
            <Field label="Kind" value={grant.kind === "SERVICE_ACCOUNT" ? "Service account" : "User"} />
            <Field label="Department" value={grant.department} />
            <Field label="Active" value={grant.active ? "Yes" : "No"} />
            <Field
              label="MFA"
              value={grant.mfaEnabled ? "Enabled" : <Badge tone="warning">Not enabled</Badge>}
            />
          </FieldGroup>

          {canWrite && grant.revokedAt === null && grant.level !== "READ" && (
            <FieldGroup title="Reduce level">
              <div className="flex items-center gap-2 py-1">
                <Select
                  value={grant.level}
                  onChange={e =>
                    void run(
                      () => update.mutateAsync({ id: grant.id, level: e.target.value as AccessLevel }),
                      "Access level updated",
                    )
                  }
                  aria-label="Access level"
                  disabled={busy}
                >
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </Select>
                <span className="text-caption text-tertiary">
                  Downgrading keeps the grant and its history.
                </span>
              </div>
            </FieldGroup>
          )}

          <Btn
            variant="outline"
            className="w-full"
            onClick={() => navigate(`/assets?open=${grant.assetId}`)}
          >
            Open {grant.assetName}
          </Btn>
        </div>
      )}
    </SlideOver>
  );
}
