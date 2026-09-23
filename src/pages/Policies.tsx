import { Card, Badge, Btn } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataTable, listAsQuery, type Column } from "@/components/DataTable";
import { PageHeader, FilterBar, EntityAvatar } from "@/components/ui-patterns";
import { usePolicies } from "@/hooks/useGovernance";
import { useListControls } from "@/hooks/useListControls";
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

export default function Policies() {
  const controls = useListControls<{ status?: PolicyStatus }>({ status: undefined });
  const list = usePolicies(controls.params);

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
          <Btn variant="outline" onClick={() => void list.refresh()} disabled={list.isFetching}>
            <AppIcon name="refresh" size="sm" spin={list.isFetching} />
            Refresh
          </Btn>
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
          searchPlaceholder="Search policies…"
          emptyTitle="No policies recorded"
          emptyMessage="No policies have been recorded for this organisation yet."
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
    </div>
  );
}
