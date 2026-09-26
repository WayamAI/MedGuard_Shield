import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { DataTable, withRows, type Column } from "@/components/DataTable";
import type { ApiQueryResult } from "@/hooks/useApiQuery";
import { EMPTY_VALUE } from "@/lib/empty";

/**
 * DataTable is the one table in the product, so a defect here is a defect on
 * every list screen at once. These cover the behaviours that are easy to get
 * subtly wrong and impossible to spot by looking: null ordering, the
 * loading/empty distinction, and keyboard access.
 */

type Row = { id: number; name: string; score: number | null };

const ROWS: Row[] = [
  { id: 1, name: "Billing Engine DB", score: 100 },
  { id: 2, name: "Epic EHR Core", score: 48 },
  { id: 3, name: "Patient Portal", score: 8 },
  { id: 4, name: "Telehealth Gateway", score: null },
];

const columns: Column<Row>[] = [
  {
    id: "name", header: "Name",
    sortValue: r => r.name, searchValue: r => r.name,
    cell: r => <span data-testid="cell-name">{r.name}</span>,
  },
  {
    id: "score", header: "Score", align: "right",
    sortValue: r => r.score,
    cell: r => <span>{r.score ?? EMPTY_VALUE}</span>,
  },
];

const names = () => screen.getAllByTestId("cell-name").map(n => n.textContent);

describe("DataTable ordering", () => {
  it("sorts by the column you click, and reverses on the second click", () => {
    render(<DataTable label="Test" rows={ROWS} columns={columns} getRowId={r => r.id} />);

    fireEvent.click(screen.getByRole("button", { name: /Name/ }));
    expect(names()[0]).toBe("Billing Engine DB");

    fireEvent.click(screen.getByRole("button", { name: /Name/ }));
    expect(names()[0]).toBe("Telehealth Gateway");
  });

  it("sinks null values to the bottom in both directions", () => {
    render(<DataTable label="Test" rows={ROWS} columns={columns} getRowId={r => r.id} />);

    // Ascending: nulls must not lead just because they are "smallest".
    fireEvent.click(screen.getByRole("button", { name: /Score/ }));
    expect(names()[names().length - 1]).toBe("Telehealth Gateway");

    // Descending: and they must not lead here either.
    fireEvent.click(screen.getByRole("button", { name: /Score/ }));
    expect(names()[names().length - 1]).toBe("Telehealth Gateway");
  });

  it("announces sort direction to assistive tech", () => {
    render(<DataTable label="Test" rows={ROWS} columns={columns} getRowId={r => r.id} />);

    const header = screen.getByRole("columnheader", { name: /Score/ });
    expect(header).toHaveAttribute("aria-sort", "none");
    fireEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "ascending");
  });
});

describe("DataTable search", () => {
  it("filters on the columns that declare a search value", () => {
    render(<DataTable label="Test" rows={ROWS} columns={columns} getRowId={r => r.id} />);

    fireEvent.change(screen.getByLabelText("Search…"), { target: { value: "epic" } });
    expect(names()).toEqual(["Epic EHR Core"]);
  });

  it("says nothing matched rather than showing a bare empty table", () => {
    render(<DataTable label="Test" rows={ROWS} columns={columns} getRowId={r => r.id} />);

    fireEvent.change(screen.getByLabelText("Search…"), { target: { value: "zzzz" } });
    expect(screen.getByText(/No matches/)).toBeInTheDocument();
    expect(screen.getByText(/zzzz/)).toBeInTheDocument();
  });
});

describe("DataTable rows", () => {
  it("opens a row on click and on Enter", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable label="Test" rows={ROWS} columns={columns} getRowId={r => r.id} onRowClick={onRowClick} />,
    );

    fireEvent.click(screen.getByTestId("row-1"));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);

    fireEvent.keyDown(screen.getByTestId("row-2"), { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
  });

  it("does not make rows focusable when there is nothing to open", () => {
    render(<DataTable label="Test" rows={ROWS} columns={columns} getRowId={r => r.id} />);
    expect(screen.getByTestId("row-1")).not.toHaveAttribute("tabindex");
  });
});

describe("DataTable column visibility", () => {
  it("hides a column when switched off, and refuses to hide the last one", () => {
    render(<DataTable label="Test" rows={ROWS} columns={columns} getRowId={r => r.id} />);

    fireEvent.click(screen.getByLabelText("Choose columns"));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Score" }));
    expect(screen.queryByRole("columnheader", { name: /Score/ })).not.toBeInTheDocument();

    // One column left: switching it off would leave an unreadable table.
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Name" }));
    expect(screen.getByRole("columnheader", { name: /Name/ })).toBeInTheDocument();
  });
});

describe("withRows", () => {
  /*
   * The trap this exists for: pages compute `filtered` from `data ?? []`, so
   * spreading `{...query, data: filtered}` turns a *loading* query into a
   * successful empty one. The skeleton disappears and the table claims there
   * is nothing to show, which is a different and wrong statement.
   */
  const base = (over: Partial<ApiQueryResult<Row[]>>): ApiQueryResult<Row[]> => ({
    data: undefined, isLoading: false, isFetching: false, isError: false,
    isReconnecting: false, error: null,
    refetch: vi.fn() as never, refresh: vi.fn(),
    ...over,
  });

  it("keeps undefined data undefined while loading", () => {
    const out = withRows(base({ isLoading: true }), []);
    expect(out.data).toBeUndefined();
    expect(out.isLoading).toBe(true);
  });

  it("keeps undefined data undefined on error", () => {
    const out = withRows(base({ isError: true }), []);
    expect(out.data).toBeUndefined();
    expect(out.isError).toBe(true);
  });

  it("passes the narrowed rows through once data has arrived", () => {
    const out = withRows(base({ data: ROWS }), [ROWS[0]]);
    expect(out.data).toEqual([ROWS[0]]);
  });

  it("preserves a genuinely empty result", () => {
    const out = withRows(base({ data: [] }), []);
    expect(out.data).toEqual([]);
  });
});
