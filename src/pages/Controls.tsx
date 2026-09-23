import { Card, Badge, Btn } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataTable, listAsQuery, type Column } from "@/components/DataTable";
import { PageHeader, FilterBar, EntityAvatar } from "@/components/ui-patterns";
import { useControls } from "@/hooks/useGovernance";
import { useListControls } from "@/hooks/useListControls";
import type { ApiControl, ControlStatus } from "@/lib/apiTypes";
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

export default function Controls() {
  const controls = useListControls<{ status?: ControlStatus }>({ status: undefined });
  const list = useControls(controls.params);

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
            <div className="truncate text-caption text-tertiary">{c.category}</div>
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
          <Btn variant="outline" onClick={() => void list.refresh()} disabled={list.isFetching}>
            <AppIcon name="refresh" size="sm" spin={list.isFetching} />
            Refresh
          </Btn>
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
          searchPlaceholder="Search controls…"
          emptyTitle="No controls recorded"
          emptyMessage="No safeguards have been recorded for this organisation yet."
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
    </div>
  );
}
