import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RiskScore, formatScore } from "@/components/ui-patterns";
import { EMPTY_VALUE } from "@/lib/empty";

/**
 * The API returns a score as a product of its factors, so some rows come back
 * whole (100, 80) and others fractional (38.4, 11.52). Rendered raw, a single
 * column read "100 / 80 / 38.4 / 28.8 / 11.52" — ragged precision that made
 * the engine look more certain about some rows than others.
 *
 * These pin the contract so the raw value cannot quietly come back.
 */
describe("formatScore", () => {
  it("leaves whole numbers alone", () => {
    expect(formatScore(100)).toBe("100");
    expect(formatScore(80)).toBe("80");
    expect(formatScore(0)).toBe("0");
  });

  it("caps fractional scores at one decimal", () => {
    expect(formatScore(11.52)).toBe("11.5");
    expect(formatScore(28.8)).toBe("28.8");
    expect(formatScore(38.4)).toBe("38.4");
    expect(formatScore(66.666)).toBe("66.7");
  });

  it("drops a trailing zero rather than printing 80.0", () => {
    expect(formatScore(79.98)).toBe("80");
    expect(formatScore(12.03)).toBe("12");
  });
});

describe("<RiskScore />", () => {
  it("renders an em dash for an unscored row", () => {
    render(<RiskScore score={null} />);
    expect(screen.getByText(EMPTY_VALUE)).toBeInTheDocument();
    render(<RiskScore score={undefined} />);
    expect(screen.getAllByText(EMPTY_VALUE)).toHaveLength(2);
  });

  it("shows the formatted value and keeps the exact one on hover", () => {
    render(<RiskScore score={11.52} />);
    const el = screen.getByText("11.5");
    expect(el).toBeInTheDocument();
    // Nothing is hidden by the rounding — the precise figure stays reachable.
    expect(el).toHaveAttribute("title", "11.52");
  });

  it("does not put a misleading title on an already-whole score", () => {
    render(<RiskScore score={64} />);
    expect(screen.getByText("64")).toHaveAttribute("title", "64");
  });

  it("accepts a className so the detail panel can render it large", () => {
    render(<RiskScore score={38.4} className="text-display-metric" />);
    expect(screen.getByText("38.4")).toHaveClass("text-display-metric");
  });
});
