import { Badge } from "@/components/ui-bits";
import type { ImportRowError } from "@/lib/apiTypes";

/** Renders a parsed cell without inventing anything the server did not send. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") {
    // The server hands dates back as ISO instants. A date-only column reads
    // better without the midnight that is an artefact of the encoding.
    const iso = /^(\d{4}-\d{2}-\d{2})T00:00:00\.000Z$/.exec(value);
    return iso ? iso[1] : value;
  }
  return String(value);
}

/**
 * The rows as the server parsed them, not as they were typed.
 *
 * This is the point of the dry run: showing the file back would only prove
 * the file was read, whereas showing the parse proves how it was understood —
 * "true" became a boolean, a blank date became nothing at all.
 */
export function ImportPreviewTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return <p className="text-body-sm text-tertiary">No rows to preview.</p>;
  }

  const columns = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-default text-left text-caption uppercase tracking-wider text-tertiary">
            <th className="px-2 py-2 font-normal">#</th>
            {columns.map(c => <th key={c} className="px-2 py-2 font-normal">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-default last:border-0">
              <td className="px-2 py-2 tabular text-tertiary">{i + 1}</td>
              {columns.map(c => (
                <td key={c} className="px-2 py-2 text-primary">{cell(row[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Every rejected field, grouped by the line it came from.
 *
 * `row` is passed through exactly as the server gave it — the line number in
 * the uploaded file with the header counted, so the first data row is line 2.
 * Renumbering to "row 1" would read more naturally and send the person to the
 * wrong line of their own spreadsheet.
 */
export function ImportErrorTable({ errors }: { errors: ImportRowError[] }) {
  if (errors.length === 0) return null;

  const byRow = new Map<number, ImportRowError[]>();
  for (const err of errors) {
    const list = byRow.get(err.row) ?? [];
    list.push(err);
    byRow.set(err.row, list);
  }
  const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-default text-left text-caption uppercase tracking-wider text-tertiary">
            <th className="px-2 py-2 font-normal">File line</th>
            <th className="px-2 py-2 font-normal">Field</th>
            <th className="px-2 py-2 font-normal">Problem</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([row, list]) =>
            list.map((err, i) => (
              <tr key={`${row}-${err.field}-${i}`} className="border-b border-default last:border-0">
                <td className="px-2 py-2 tabular text-primary">
                  {i === 0 ? row : ""}
                </td>
                <td className="px-2 py-2">
                  <Badge tone="danger">{err.field}</Badge>
                </td>
                <td className="px-2 py-2 text-primary">{err.message}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
