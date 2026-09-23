import { Card, Badge, Btn } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataTable, listAsQuery, type Column } from "@/components/DataTable";
import { PageHeader, MetricCard, FilterBar, EntityAvatar } from "@/components/ui-patterns";
import { useIdentities, useOrgMembers, useOrganization } from "@/hooks/useGovernance";
import { useListControls } from "@/hooks/useListControls";
import type { ApiIdentity } from "@/lib/apiTypes";

/**
 * People and service accounts known to the organisation.
 *
 * Two populations, deliberately shown together but labelled apart:
 *
 *   Identities — everyone who can reach a PHI system. Mostly not Drishti
 *                users at all: clinicians, contractors, ETL service accounts.
 *   Members    — the accounts that can sign in to Drishti itself.
 *
 * Conflating them would be a security reporting error, not a layout one: an
 * "inactive" clinician still holding ADMIN on an imaging archive is a finding,
 * and it has nothing to do with whether they can log into this product.
 *
 * Role changes are not offered. The API has no endpoint for them, and a
 * control that silently did nothing would be worse than its absence.
 */
export default function Users() {
  const controls = useListControls<{ kind?: string }>({ kind: undefined });
  const identities = useIdentities(controls.params);
  const members = useOrgMembers();
  const org = useOrganization();

  const columns: Column<ApiIdentity>[] = [
    {
      id: "name",
      header: "Identity",
      sortValue: i => i.displayName,
      cell: i => (
        <div className="flex items-center gap-2.5">
          <EntityAvatar icon="identity" tone={i.active ? "muted" : "danger"} size="sm" />
          <div className="min-w-0">
            <div className={`truncate text-body-md text-primary ${!i.active ? "line-through opacity-70" : ""}`}>
              {i.displayName}
            </div>
            <div className="truncate text-caption text-tertiary">
              {i.email ?? "No email · service account"}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "kind",
      header: "Kind",
      hideBelow: "sm",
      sortValue: i => i.kind,
      cell: i => (
        <Badge tone={i.kind === "SERVICE_ACCOUNT" ? "info" : "muted"}>
          {i.kind === "SERVICE_ACCOUNT" ? "Service" : "User"}
        </Badge>
      ),
    },
    {
      id: "department",
      header: "Department",
      hideBelow: "md",
      sortValue: i => i.department ?? null,
      cell: i => i.department ?? <span className="text-tertiary">—</span>,
    },
    {
      id: "grants",
      header: "Active grants",
      align: "right",
      sortValue: i => i.activeGrants,
      cell: i => i.activeGrants,
    },
    {
      id: "mfa",
      header: "MFA",
      hideBelow: "lg",
      sortValue: i => Number(i.mfaEnabled),
      cell: i => i.mfaEnabled
        ? <Badge tone="success">Enabled</Badge>
        : <Badge tone="warning">Not enabled</Badge>,
    },
    {
      id: "status",
      header: "Status",
      sortValue: i => Number(i.active),
      cell: i => i.active
        ? <Badge tone="success">Active</Badge>
        : <Badge tone="danger">Deactivated</Badge>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon="identity"
        title="Identities & Members"
        description="Everyone who can reach a PHI system, and separately the accounts that can sign in to Drishti."
        actions={
          <Btn variant="outline" onClick={() => void identities.refresh()} disabled={identities.isFetching}>
            <AppIcon name="refresh" size="sm" spin={identities.isFetching} />
            Refresh
          </Btn>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Identities" value={identities.meta?.total} icon="identity" />
        <MetricCard label="Drishti members" value={members.data?.length} icon="access" />
        <MetricCard label="Assets" value={org.data?.counts.assets} icon="database" />
        <MetricCard label="Organisation" value={org.data?.name} icon="facility" />
      </div>

      <Card className="p-4">
        <DataTable
          label="Identities"
          query={listAsQuery(identities)}
          server={{
            meta: identities.meta,
            page: controls.page,
            onPageChange: controls.setPage,
            pageSize: controls.pageSize,
            onPageSizeChange: controls.setPageSize,
            onSearch: controls.setSearch,
            searchValue: controls.search,
            isPaging: identities.isPaging,
          }}
          columns={columns}
          getRowId={i => i.id}
          searchPlaceholder="Search identities…"
          emptyTitle="No identities recorded"
          emptyMessage="No people or service accounts have been recorded yet."
          toolbar={
            <FilterBar
              label="Filter by kind"
              value={controls.filters.kind ?? "all"}
              onChange={v => controls.setFilter("kind", v === "all" ? undefined : v)}
              options={[
                { value: "all", label: "All" },
                { value: "USER", label: "People" },
                { value: "SERVICE_ACCOUNT", label: "Service accounts" },
              ]}
            />
          }
        />
      </Card>

      <Card className="p-4">
        <div className="mb-3">
          <h3 className="font-display text-heading-md text-primary">Drishti members</h3>
          <p className="mt-0.5 text-body-sm text-tertiary">
            Accounts that can sign in to this product. Distinct from the
            identities above, which are the people and services that reach PHI.
          </p>
        </div>
        {members.data === undefined ? (
          <div className="h-20 animate-pulse rounded bg-raised-2" />
        ) : members.data.length === 0 ? (
          <p className="py-4 text-center text-body-sm text-tertiary">No members returned.</p>
        ) : (
          <ul className="divide-y divide-muted">
            {members.data.map(m => (
              <li key={m.userId} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2.5">
                  <EntityAvatar icon="identity" tone="muted" size="sm" />
                  <span className="truncate text-body-md text-primary">{m.email}</span>
                </span>
                <span className="flex flex-shrink-0 items-center gap-3">
                  <span className="text-caption text-tertiary">
                    since {new Date(m.memberSince).toLocaleDateString()}
                  </span>
                  <Badge tone={m.role === "ADMIN" ? "danger" : m.role === "ANALYST" ? "warning" : "muted"}>
                    {m.role}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-caption text-tertiary">
          Roles are managed outside Drishti. The API exposes no endpoint to
          change them, so no control is offered here rather than one that would
          appear to work and not.
        </p>
      </Card>
    </div>
  );
}
