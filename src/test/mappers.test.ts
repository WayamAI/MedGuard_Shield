import { describe, it, expect } from "vitest";
import { toSankeyData, toMatrixRisks } from "@/lib/mappers";
import type { ApiDataFlow, ApiRisk } from "@/lib/apiTypes";

const flow = (over: Partial<ApiDataFlow>): ApiDataFlow => ({
  source: "A", target: "B", phiType: "Demographics", recordsPerDay: 100, encrypted: true, ...over,
});

describe("toSankeyData", () => {
  it("returns empty node and link lists for no flows", () => {
    expect(toSankeyData([])).toEqual({ nodes: [], links: [] });
  });

  it("derives the node set from edge endpoints and dedupes", () => {
    const { nodes } = toSankeyData([
      flow({ source: "Patient Portal", target: "Epic EHR Core" }),
      flow({ source: "Pharmacy System", target: "Epic EHR Core" }),
    ]);
    expect(nodes.map(n => n.id)).toEqual(["patient-portal", "epic-ehr-core", "pharmacy-system"]);
    expect(nodes).toHaveLength(3);
  });

  it("assigns stages by depth from the sources", () => {
    const { nodes } = toSankeyData([
      flow({ source: "Portal", target: "Core" }),
      flow({ source: "Core", target: "Billing" }),
      flow({ source: "Billing", target: "Insurance" }),
    ]);
    const stage = Object.fromEntries(nodes.map(n => [n.id, n.stage]));
    expect(stage).toEqual({ portal: 0, core: 1, billing: 2, insurance: 3 });
  });

  it("uses longest path so a node fed directly and indirectly sits downstream", () => {
    // Core -> Billing -> Ins, and also Core -> Ins. Ins must land at stage 2,
    // otherwise its ribbon from Billing would run backwards.
    const { nodes } = toSankeyData([
      flow({ source: "Core", target: "Billing" }),
      flow({ source: "Billing", target: "Ins" }),
      flow({ source: "Core", target: "Ins" }),
    ]);
    expect(nodes.find(n => n.id === "ins")!.stage).toBe(2);
  });

  it("terminates on a cycle instead of hanging", () => {
    const { nodes } = toSankeyData([
      flow({ source: "A", target: "B" }),
      flow({ source: "B", target: "C" }),
      flow({ source: "C", target: "A" }),
    ]);
    expect(nodes).toHaveLength(3);
    nodes.forEach(n => expect(Number.isFinite(n.stage)).toBe(true));
  });

  it("sets node records to throughput, the larger of inflow and outflow", () => {
    const { nodes } = toSankeyData([
      flow({ source: "P", target: "Core", recordsPerDay: 12400 }),
      flow({ source: "Ph", target: "Core", recordsPerDay: 38900 }),
      flow({ source: "Core", target: "Lab", recordsPerDay: 64200 }),
    ]);
    // Core takes in 51,300 and sends out 64,200 -> the outflow wins.
    expect(nodes.find(n => n.id === "core")!.records).toBe(64200);
  });

  it("maps encrypted=false to a violation tone and Unencrypted label", () => {
    const { nodes, links } = toSankeyData([flow({ source: "Bill", target: "Ins", encrypted: false })]);
    expect(links[0].tone).toBe("violation");
    expect(nodes.every(n => n.encryption === "Unencrypted")).toBe(true);
    expect(nodes.every(n => n.status === "violation")).toBe(true);
  });

  it("lets an explicit status override the encrypted fallback", () => {
    const { links } = toSankeyData([flow({ encrypted: true, status: "warn" })]);
    expect(links[0].tone).toBe("warn");
  });

  it("gives a node the worst tone among the flows touching it", () => {
    const { nodes } = toSankeyData([
      flow({ source: "Core", target: "Lab", encrypted: true }),
      flow({ source: "Core", target: "Bill", encrypted: false }),
    ]);
    expect(nodes.find(n => n.id === "core")!.status).toBe("violation");
    expect(nodes.find(n => n.id === "lab")!.status).toBe("ok");
  });

  it("floors negative record counts at zero so ribbons cannot invert", () => {
    const { links } = toSankeyData([flow({ recordsPerDay: -50 })]);
    expect(links[0].value).toBe(0);
  });
});

const risk = (over: Partial<ApiRisk>): ApiRisk => ({
  id: 1, assetId: 1, assetName: "Billing Engine DB",
  likelihood: 4, impact: 5, exposure: 5, controlGap: 5,
  score: 100, band: "EXTREME", computedAt: "2026-01-01T00:00:00.000Z", ...over,
});

describe("toMatrixRisks", () => {
  it("maps the wire shape onto the matrix's prop names", () => {
    expect(toMatrixRisks([risk({})])[0]).toEqual({
      id: "R-001", name: "Billing Engine DB", L: 4, I: 5, band: "extreme",
    });
  });

  it("passes the API band through rather than deriving one from L x I", () => {
    // L x I = 20 would be "critical" locally, but the backend scored it HIGH
    // using exposure and control gap, which L x I cannot see.
    const [r] = toMatrixRisks([risk({ likelihood: 5, impact: 4, band: "HIGH", score: 48 })]);
    expect(r.band).toBe("high");
  });

  it("carries the full LOW..EXTREME range, including the band the matrix used to lack", () => {
    const bands = toMatrixRisks([
      risk({ id: 1, band: "LOW" }), risk({ id: 2, band: "MODERATE" }),
      risk({ id: 3, band: "HIGH" }), risk({ id: 4, band: "CRITICAL" }),
      risk({ id: 5, band: "EXTREME" }),
    ]).map(r => r.band);
    expect(bands).toEqual(["low", "moderate", "high", "critical", "extreme"]);
  });

  it("zero-pads the id so chips read like the register's R-00n", () => {
    expect(toMatrixRisks([risk({ id: 7 })])[0].id).toBe("R-007");
  });

  it("clamps out-of-range axis values into the 1-5 grid", () => {
    const [low, high] = toMatrixRisks([
      risk({ id: 1, likelihood: 0, impact: -3 }),
      risk({ id: 2, likelihood: 9, impact: 42 }),
    ]);
    expect([low.L, low.I]).toEqual([1, 1]);
    expect([high.L, high.I]).toEqual([5, 5]);
  });

  it("rounds fractional axis values to a cell", () => {
    const [r] = toMatrixRisks([risk({ likelihood: 3.4, impact: 2.6 })]);
    expect([r.L, r.I]).toEqual([3, 3]);
  });

  it("leaves band undefined when the API omits it, so the matrix can fall back", () => {
    const [r] = toMatrixRisks([risk({ band: undefined as never })]);
    expect(r.band).toBeUndefined();
  });
});
