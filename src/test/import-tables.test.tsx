import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ImportPreviewTable, ImportErrorTable } from "@/components/ImportTables";
import type { ImportRowError } from "@/lib/apiTypes";

describe("ImportPreviewTable", () => {
  it("shows the rows as the server parsed them", () => {
    render(<ImportPreviewTable rows={[{ name: "Billing Engine DB", type: "DATABASE" }]} />);
    expect(screen.getByText("Billing Engine DB")).toBeInTheDocument();
    expect(screen.getByText("DATABASE")).toBeInTheDocument();
  });

  it("takes its columns from the payload rather than a hardcoded list", () => {
    // Seven entities with different shapes go through this one table.
    render(<ImportPreviewTable rows={[{ identityName: "Maria Santos", assetName: "Epic EHR Core" }]} />);
    expect(screen.getByText("identityName")).toBeInTheDocument();
    expect(screen.getByText("assetName")).toBeInTheDocument();
  });

  it("renders booleans as words, not as raw true/false", () => {
    render(<ImportPreviewTable rows={[{ encrypted: true, mfaEnabled: false }]} />);
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("renders a false boolean rather than treating it as empty", () => {
    // The bug this guards: falsy-checking a cell turns "not encrypted" into
    // "no data", which is the opposite claim.
    render(<ImportPreviewTable rows={[{ encrypted: false }]} />);
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("renders zero as zero, not as a dash", () => {
    render(<ImportPreviewTable rows={[{ phiVolume: 0 }]} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("groups large numbers so a volume is readable", () => {
    render(<ImportPreviewTable rows={[{ phiVolume: 412000 }]} />);
    expect(screen.getByText("412,000")).toBeInTheDocument();
  });

  it("shows a dash for null and undefined", () => {
    render(<ImportPreviewTable rows={[{ lastAssessedAt: null, note: undefined }]} />);
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("trims the midnight off a date-only value", () => {
    // The server returns an ISO instant; the column is a date.
    render(<ImportPreviewTable rows={[{ lastAssessedAt: "2026-09-01T00:00:00.000Z" }]} />);
    expect(screen.getByText("2026-09-01")).toBeInTheDocument();
  });

  it("leaves a real timestamp alone", () => {
    render(<ImportPreviewTable rows={[{ detectedAt: "2026-09-01T14:30:00.000Z" }]} />);
    expect(screen.getByText("2026-09-01T14:30:00.000Z")).toBeInTheDocument();
  });

  it("numbers the rows it shows", () => {
    render(<ImportPreviewTable rows={[{ name: "A" }, { name: "B" }, { name: "C" }]} />);
    const body = screen.getAllByRole("row").slice(1);
    expect(within(body[0]).getByText("1")).toBeInTheDocument();
    expect(within(body[2]).getByText("3")).toBeInTheDocument();
  });

  it("says so when there is nothing to preview", () => {
    render(<ImportPreviewTable rows={[]} />);
    expect(screen.getByText("No rows to preview.")).toBeInTheDocument();
  });
});

describe("ImportErrorTable", () => {
  const errors: ImportRowError[] = [
    { row: 3, field: "phiVolume", message: 'phiVolume must be a whole number, got "abc"' },
    { row: 2, field: "name", message: "name is required" },
    { row: 2, field: "type", message: 'type must be one of: EHR, DATABASE. Got "NOPE"' },
  ];

  it("lists every field problem, not just the first per row", () => {
    render(<ImportErrorTable errors={errors} />);
    expect(screen.getByText("name is required")).toBeInTheDocument();
    expect(screen.getByText(/type must be one of/)).toBeInTheDocument();
    expect(screen.getByText(/whole number/)).toBeInTheDocument();
  });

  it("labels the column as a file line, because that is what the number is", () => {
    render(<ImportErrorTable errors={errors} />);
    expect(screen.getByText("File line")).toBeInTheDocument();
  });

  it("shows the server's line number untouched", () => {
    // Header counted: the first data row is line 2. Renumbering it to 1 would
    // send someone to the wrong line of their own file.
    render(<ImportErrorTable errors={errors} />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("2")).toBeInTheDocument();
  });

  it("orders by line even when the server did not", () => {
    render(<ImportErrorTable errors={errors} />);
    const cells = screen.getAllByRole("row").slice(1)
      .map(r => r.querySelector("td")?.textContent ?? "");
    // Line 2's two problems first, then line 3.
    expect(cells).toEqual(["2", "", "3"]);
  });

  it("names the offending field", () => {
    render(<ImportErrorTable errors={errors} />);
    expect(screen.getByText("phiVolume")).toBeInTheDocument();
  });

  it("renders nothing at all when there are no errors", () => {
    const { container } = render(<ImportErrorTable errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
