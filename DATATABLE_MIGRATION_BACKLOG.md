# DataTable migration backlog

Technical debt note. **Not a blocker for production readiness** — every table
listed here works, paginates correctly, and handles its loading, empty and
error states.

## Status

The shared `DataTable` (`src/components/DataTable.tsx`) is now used by every
list screen in the product:

| Screen | Component | Server pagination | Status |
|---|---|---|---|
| Assets | `DataTable` | ✅ | migrated |
| Vendors | `DataTable` | ✅ | migrated |
| Risk Register | `DataTable` | ✅ | migrated |
| Access & Identity | `DataTable` | ✅ | migrated |
| Threats | `DataTable` | ✅ | migrated |
| Remediation | `DataTable` | ✅ | migrated |
| Controls | `DataTable` | ✅ | migrated |
| Policies | `DataTable` | ✅ | migrated |
| Identities & Members | `DataTable` | ✅ | migrated |
| Audit Trail | `DataTable` | ✅ | migrated |

The migration that was previously deferred as "risky mass migration for visual
uniformity" happened anyway, but for a different reason: pagination. Access
and Threats had to be rewritten to consume the paginated contract, and a
rewrite is the cheap moment to adopt the shared component. Doing it for
correctness rather than for looks is what made it worth the risk.

## Remaining non-DataTable tables

| Location | Implementation | Why it is not DataTable | Risk of migrating | Priority |
|---|---|---|---|---|
| `src/components/ImportTables.tsx` — `ImportPreviewTable` | bespoke `<table>` | Renders arbitrary CSV columns discovered at runtime, not a fixed typed schema. `DataTable` is generic over a known row type with declared columns; a preview has neither | Medium — 66 tests cover the import flow and its column handling | **P3** |
| `src/components/ImportTables.tsx` — `ImportErrorTable` | bespoke `<table>` | Three fixed columns (file line, field, problem), no sorting, filtering or paging wanted. Using `DataTable` would add a toolbar and a footer nobody asked for | Low, but there is nothing to gain | **P3** |
| `src/pages/Users.tsx` — members list | `<ul>` | Three to five rows, no sort/filter/page. A table would be heavier than the content | Low | **P3** |

## Recommendation

**Leave all three.** The import tables are the strongest case for *not*
migrating: they render a shape that is only known at runtime, which is
precisely what the generic, typed `DataTable` is not for. Forcing them through
it would mean weakening `Column<T>` for every other caller.

Revisit only if the import preview grows a requirement for sorting or paging.

## Follow-ups worth doing

| Item | Why | Priority |
|---|---|---|
| Column sorting in server mode still sorts the current page | The header is clickable and reorders 25 rows, which can read as sorting the dataset. Either send `sort`/`order` to the API (assets and risks already accept them) or disable header sorting when `server` is set | **P1** |
| Row selection is declared in the props but unused | No screen needs bulk actions yet. Remove or use | P3 |
| No virtualisation | Page size caps at 200 and the default is 25, so no screen renders enough rows to need it | P3 |
