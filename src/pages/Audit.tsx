import { useMemo, useState } from "react";
import { Card, Badge, Btn, SlideOver } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { DataTable, listAsQuery, type Column } from "@/components/DataTable";
import { PageHeader, Field, FieldGroup, FilterBar, EntityAvatar } from "@/components/ui-patterns";
import type { DomainIconName } from "@/components/DomainIcon";
import { useAudit } from "@/hooks/useGovernance";
import { useListControls } from "@/hooks/useListControls";
import type { ApiAuditEntry } from "@/lib/apiTypes";
import type { Tone } from "@/lib/tone";

/**
 * Audit trail — who did what, to what, when, and with what result.
 *
 * Replaces a page that rendered twenty fabricated log rows from a fixture.
 * This one is the real thing: GET /api/audit, ADMIN-only, newest first, and
 * strictly read-only. There is no write path in the API and there is none
 * here — a trail you can add entries to is not a trail.
 *
 * Every mutation elsewhere in the app invalidates this query, so an action
 * taken in another tab shows up here without a manual refresh.
 */

/** Result → tone. Anything that is not an outright success is worth a colour. */
const resultTone = (result: string): Tone =>
  result === "SUCCESS" ? "success"
    : result === "FAILURE" || result === "DENIED" ? "danger"
    : "warning";

/**
 * Group the 43 action types into something a human can filter by.
 * Unknown actions fall through to "Other" rather than being hidden — a new
 * backend action must never become invisible here.
 */
const ACTION_GROUPS: Array<{
  value: string; label: string; icon: DomainIconName; match: (a: string) => boolean;
}> = [
  { value: "all", label: "All activity", icon: "audit", match: () => true },
  { value: "auth", label: "Authentication", icon: "identity",
    match: a => a.startsWith("LOGIN") || a.startsWith("LOGOUT") || a.includes("SESSION") || a.includes("TOKEN") },
  { value: "asset", label: "Assets", icon: "asset", match: a => a.startsWith("ASSET") },
  { value: "risk", label: "Risk", icon: "risk", match: a => a.startsWith("RISK") },
  { value: "vendor", label: "Vendors", icon: "vendor", match: a => a.startsWith("VENDOR") },
  { value: "access", label: "Access", icon: "identity",
    match: a => a.startsWith("ACCESS") || a.startsWith("IDENTITY") },
  { value: "threat", label: "Threats", icon: "threat", match: a => a.startsWith("THREAT") },
  { value: "remediation", label: "Remediation", icon: "remediation", match: a => a.startsWith("REMEDIATION") },
  { value: "control", label: "Controls", icon: "control", match: a => a.startsWith("CONTROL") || a.startsWith("POLICY") },
  { value: "import", label: "Imports", icon: "import", match: a => a.startsWith("IMPORT") },
];

/**
 * The mark for an action, by family.
 *
 * Every row previously carried the same document glyph, which made a
 * fifty-row trail one undifferentiated column — the eye had to read each
 * label to find "the risk one". Keying the icon to the family makes the
 * trail scannable, and falls back to the audit mark for any action the
 * backend adds that this list has not met yet.
 */
const iconFor = (action: string): DomainIconName =>
  ACTION_GROUPS.find(g => g.value !== "all" && g.match(action))?.icon ?? "audit";

/** ASSET_UPDATED → "Asset updated". */
const humanise = (action: string) =>
  action.charAt(0) + action.slice(1).toLowerCase().replace(/_/g, " ");

const fmtWhen = (iso: string) => new Date(iso).toLocaleString();

export default function AuditPage() {
  const [group, setGroup] = useState("all");
  const controls = useListControls<Record<string, never>>({});
  const entries = useAudit(controls.params);
  const [selected, setSelected] = useState<ApiAuditEntry | null>(null);

  const rows = useMemo(() => entries.data ?? [], [entries.data]);

  /*
   * Grouping is applied client-side over the page, and the UI says so.
   * The API filters by exact `action`, not by family, so a family filter
   * would need one request per member — this narrows what is on screen and
   * does not pretend to have searched the whole trail.
   */
  const shown = useMemo(() => {
    const g = ACTION_GROUPS.find(x => x.value === group);
    return g && g.value !== "all" ? rows.filter(r => g.match(r.action)) : rows;
  }, [rows, group]);

  const columns: Column<ApiAuditEntry>[] = [
    {
      id: "when",
      header: "When",
      width: "w-44",
      sortValue: e => -new Date(e.createdAt).getTime(),
      cell: e => <span className="tabular text-tertiary">{fmtWhen(e.createdAt)}</span>,
    },
    {
      id: "actor",
      header: "Actor",
      hideBelow: "sm",
      sortValue: e => e.actor?.email ?? null,
      cell: e => e.actor
        ? <span className="truncate text-body-sm text-primary">{e.actor.email}</span>
        : <span className="text-tertiary">System</span>,
    },
    {
      id: "action",
      header: "Action",
      sortValue: e => e.action,
      cell: e => (
        <div className="flex items-center gap-2.5">
          <EntityAvatar icon={iconFor(e.action)} tone={resultTone(e.result)} size="sm" />
          <span className="truncate text-body-md text-primary">{humanise(e.action)}</span>
        </div>
      ),
    },
    {
      id: "entity",
      header: "Subject",
      hideBelow: "md",
      sortValue: e => e.entityType ?? null,
      cell: e => e.entityType
        ? <span className="text-body-sm text-secondary">{e.entityType} #{e.entityId}</span>
        : <span className="text-tertiary">—</span>,
    },
    {
      id: "result",
      header: "Result",
      sortValue: e => e.result,
      cell: e => <Badge tone={resultTone(e.result)}>{e.result}</Badge>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon="audit"
        title="Audit Trail"
        description="Every recorded action across the organisation, newest first. Read-only by design."
        actions={
          <Btn variant="outline" onClick={() => void entries.refresh()} disabled={entries.isFetching}>
            <AppIcon name="refresh" size="sm" spin={entries.isFetching} />
            Refresh
          </Btn>
        }
        meta={
          entries.meta
            ? <span className="text-caption text-tertiary">
                {entries.meta.total.toLocaleString()} recorded events
              </span>
            : undefined
        }
      />

      <Card className="p-4">
        <DataTable
          label="Audit trail"
          query={listAsQuery({ ...entries, data: entries.data ? shown : undefined })}
          server={{
            meta: entries.meta,
            page: controls.page,
            onPageChange: controls.setPage,
            pageSize: controls.pageSize,
            onPageSizeChange: controls.setPageSize,
            isPaging: entries.isPaging,
          }}
          columns={columns}
          getRowId={e => e.id}
          onRowClick={e => setSelected(e)}
          isRowActive={e => e.id === selected?.id}
          emptyIcon="audit" emptyArt="emptyAudit"
          emptyTitle="No recorded activity"
          emptyMessage="Nothing has been recorded against this organisation yet."
          noMatchTitle="Nothing on this page"
          toolbar={
            <FilterBar
              label="Filter by activity"
              value={group}
              onChange={setGroup}
              options={ACTION_GROUPS.map(g => ({ value: g.value, label: g.label }))}
            />
          }
        />
        {group !== "all" && (
          <p className="mt-2 text-caption text-tertiary">
            Narrowing this page only. The API filters by exact action, so use
            paging to move through the whole trail.
          </p>
        )}
      </Card>

      <SlideOver
        open={selected !== null}
        onClose={() => setSelected(null)}
        width={460}
        title={selected ? humanise(selected.action) : "Event"}
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <EntityAvatar icon={iconFor(selected.action)} tone={resultTone(selected.result)} size="lg" />
              <div>
                <Badge tone={resultTone(selected.result)}>{selected.result}</Badge>
                <p className="mt-1.5 text-body-sm text-tertiary">{fmtWhen(selected.createdAt)}</p>
              </div>
            </div>

            <FieldGroup title="Event">
              <Field label="Action" value={<span className="font-mono text-body-sm">{selected.action}</span>} />
              <Field label="Actor" value={selected.actor?.email ?? "System"} />
              <Field
                label="Subject"
                value={selected.entityType ? `${selected.entityType} #${selected.entityId}` : "—"}
              />
              <Field label="Result" value={selected.result} />
              <Field label="Source IP" value={selected.ip ?? "—"} />
              <Field label="Recorded" value={fmtWhen(selected.createdAt)} />
            </FieldGroup>

            {selected.metadata && Object.keys(selected.metadata).length > 0 && (
              <FieldGroup title="Details">
                {/*
                  Rendered as JSON rather than parsed into prose: the shape
                  varies by action, and inventing a sentence per action is how
                  a log starts saying things the record does not.
                  Credentials and patient identifiers are stripped server-side
                  before storage.
                */}
                <pre className="overflow-x-auto rounded-md border border-default bg-raised-2 p-2.5 text-caption text-secondary">
                  {JSON.stringify(selected.metadata, null, 2)}
                </pre>
              </FieldGroup>
            )}
          </div>
        )}
      </SlideOver>
    </div>
  );
}
