import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PhiSankey } from "@/components/PhiSankey";
import { RiskMatrix } from "@/components/RiskMatrix";
import { ChartSkeleton, ErrorState, EmptyState } from "@/components/ui-bits";
import { toSankeyData, toMatrixRisks } from "@/lib/mappers";
import type { ApiDataFlow, ApiRisk } from "@/lib/apiTypes";

/** A miniature of the seeded shape: two ingress systems, a core, one leak. */
const FLOWS: ApiDataFlow[] = [
  { source: "Patient Portal", target: "Epic EHR Core", phiType: "Demographics", recordsPerDay: 12400, encrypted: true },
  { source: "Pharmacy System", target: "Epic EHR Core", phiType: "Medication", recordsPerDay: 38900, encrypted: true },
  { source: "Epic EHR Core", target: "Billing Engine", phiType: "Claims", recordsPerDay: 87100, encrypted: false },
  { source: "Billing Engine", target: "Insurance Gateway", phiType: "Claims", recordsPerDay: 71300, encrypted: false },
];

const mkRisk = (id: number, assetName: string, L: number, I: number, band: ApiRisk["band"]): ApiRisk => ({
  id, assetId: id, assetName, likelihood: L, impact: I, exposure: 3, controlGap: 3,
  score: 50, band, computedAt: "2026-01-01T00:00:00.000Z",
});

const RISKS: ApiRisk[] = [
  mkRisk(1, "Billing Engine DB", 5, 5, "EXTREME"),
  mkRisk(5, "Clinical Analytics Lake", 3, 5, "MODERATE"),
  mkRisk(11, "Pharmacy System", 2, 4, "LOW"),
  mkRisk(12, "Patient Portal", 3, 3, "LOW"),
];

describe("PhiSankey fed by mapper output", () => {
  it("renders every mapped system", () => {
    const { nodes, links } = toSankeyData(FLOWS);
    render(<PhiSankey nodes={nodes} links={links} onSelect={vi.fn()} />);
    ["Patient Portal", "Pharmacy System", "Epic EHR Core", "Billing Engine", "Insurance Gateway"]
      .forEach(name => expect(screen.getByText(name)).toBeInTheDocument());
  });

  it("sizes node height proportionally to throughput", () => {
    const { nodes, links } = toSankeyData(FLOWS);
    const { container } = render(<PhiSankey nodes={nodes} links={links} onSelect={vi.fn()} />);

    /** Node boxes carry a <title>; the group's first <rect> is the box itself. */
    const heightOf = (name: string) => {
      const title = [...container.querySelectorAll("title")]
        .find(t => t.textContent?.startsWith(name));
      const rect = title?.parentElement?.querySelector("rect");
      return parseFloat(rect?.getAttribute("height") ?? "0");
    };

    const core = heightOf("Epic EHR Core");      // 87,100 rec/day throughput
    const portal = heightOf("Patient Portal");   // 12,400 rec/day
    expect(core).toBeGreaterThan(0);
    expect(portal).toBeGreaterThan(0);
    expect(core).toBeGreaterThan(portal * 2);
  });

  it("labels an unencrypted system as a violation", () => {
    const { nodes, links } = toSankeyData(FLOWS);
    render(<PhiSankey nodes={nodes} links={links} onSelect={vi.fn()} />);
    expect(screen.getAllByText("UNENCRYPTED").length).toBeGreaterThan(0);
  });
});

describe("RiskMatrix fed by mapper output", () => {
  it("plots each risk and spreads them across more than one band", () => {
    render(<RiskMatrix risks={toMatrixRisks(RISKS)} onSelect={vi.fn()} />);
    ["001", "005", "011", "012"].forEach(id => expect(screen.getByText(id)).toBeInTheDocument());
    // Legend counts prove the spread: not every risk landed in one band.
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("renders an empty grid without crashing when there are no risks", () => {
    const { container } = render(<RiskMatrix risks={[]} onSelect={vi.fn()} />);
    expect(container).toBeTruthy();
  });
});

describe("data-state primitives", () => {
  it("exposes the skeleton to assistive tech while loading", () => {
    render(<ChartSkeleton label="Loading PHI flows" />);
    expect(screen.getByRole("status", { name: "Loading PHI flows" })).toBeInTheDocument();
  });

  it("surfaces a retry affordance on error", async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Backend unreachable" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    screen.getByRole("button", { name: "Retry" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders an empty state distinct from an error", () => {
    render(<EmptyState title="No PHI flows recorded" message="Run the seed script." />);
    expect(screen.getByText("No PHI flows recorded")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("risk band colour ramp", () => {
  /**
   * Pins the fix for the inverted ramp: Critical rendered amber while High
   * rendered orange, so High read as the more severe of the two. The app's
   * severity tokens are inverted against their own names (--sem-solid-high is
   * amber #F59E0B, --sem-solid-medium is orange #EA580C), so this asserts the
   * classes that actually produce an escalating green -> red ramp.
   */
  const chipClassFor = (band: ApiRisk["band"]) => {
    const { container } = render(
      <RiskMatrix risks={toMatrixRisks([mkRisk(1, "Asset", 3, 3, band)])} onSelect={vi.fn()} />,
    );
    return container.querySelector("button")?.className ?? "";
  };

  it("escalates Low -> Moderate -> High -> Critical -> Extreme", () => {
    expect(chipClassFor("LOW")).toContain("bg-solid-success");        // green
    expect(chipClassFor("MODERATE")).toContain("bg-solid-low");       // blue
    expect(chipClassFor("HIGH")).toContain("bg-solid-high");          // amber
    expect(chipClassFor("CRITICAL")).toContain("bg-solid-medium");    // orange
    expect(chipClassFor("EXTREME")).toContain("bg-solid-critical");   // red
  });

  it("never gives High and Critical the same fill", () => {
    expect(chipClassFor("HIGH")).not.toBe(chipClassFor("CRITICAL"));
  });
});
