import { describe, expect, it } from "vitest";
import {
  buildClusterAllocationRows,
  buildExportRows,
  DEFAULT_EXPORT_COLUMNS,
} from "./okrExport";
import type { Quarter } from "./components/types";

const quarter: Quarter = {
  quarterId: "2026-q4",
  label: "Q4 2026",
  objectives: [
    {
      id: "O-1",
      type: "objective",
      title: "Ship the thing",
      description: "## Context\nWhy this matters.\n\n**Bold** point.",
      groups: ["Atlas", "Growth"],
      status: "on_track",
      progress: 40,
      allocation: 60,
      children: [
        {
          id: "O-1-KR1",
          type: "key_result",
          title: "Ship to 100% of traffic",
          status: "on_track",
          progress: 40,
          metricType: "percent",
          current: 40,
          target: 100,
          children: [
            {
              id: "O-1-KR1-M1",
              type: "milestone",
              title: "Canary rollout",
              status: "done",
              progress: 100,
              jiraKeys: ["PROJ-1"],
            },
            {
              id: "O-1-KR1-M2",
              type: "milestone",
              title: "Full rollout",
              status: "at_risk",
              progress: 10,
            },
          ],
        },
      ],
    },
    {
      id: "O-2",
      type: "objective",
      title: "Unallocated work",
      groups: ["Atlas", "Keep the Lights On"],
      status: "not_started",
      progress: 0,
    },
  ],
};

describe("buildExportRows with the default column set", () => {
  const rows = buildExportRows(quarter, DEFAULT_EXPORT_COLUMNS);

  it("emits one row per top-level objective, in order", () => {
    expect(rows.map((r) => r["#"])).toEqual(["1", "2"]);
    expect(rows.map((r) => r.Objective)).toEqual([
      "Ship the thing",
      "Unallocated work",
    ]);
  });

  it("resolves the cluster from groups", () => {
    expect(rows[0].Cluster).toBe("Growth");
    expect(rows[1].Cluster).toBe("Keep the Lights On");
  });

  it("joins key result titles and reads the actual/target off the first metric KR", () => {
    expect(rows[0]["Key Results"]).toBe("Ship to 100% of traffic");
    expect(rows[0].Actual).toBe("40%");
    expect(rows[0].Target).toBe("100%");
  });

  it("strips markdown headers/bold and lists milestones recursively, including ones nested under a KR", () => {
    expect(rows[0].Details).toContain("Context\nWhy this matters.");
    expect(rows[0].Details).toContain("Bold point.");
    expect(rows[0].Details).toContain("Milestones:");
    expect(rows[0].Details).toContain("✅ Canary rollout [PROJ-1]");
    expect(rows[0].Details).toContain("🔴 Full rollout");
  });

  it("leaves actual/target/allocation blank when unset", () => {
    expect(rows[1].Actual).toBe("");
    expect(rows[1].Target).toBe("");
    expect(rows[1].Allocation).toBe("");
  });

  it("maps status to its display label", () => {
    expect(rows[0].Status).toBe("On track");
    expect(rows[1].Status).toBe("Not started");
  });
});

describe("buildClusterAllocationRows", () => {
  it("groups allocation by cluster and marks unset allocation in the objective list", () => {
    const rows = buildClusterAllocationRows(quarter);
    const growth = rows.find((r) => r.cluster === "Growth");
    const keepLightsOn = rows.find((r) => r.cluster === "Keep the Lights On");
    expect(growth).toEqual({
      cluster: "Growth",
      totalAllocation: 60,
      objectives: "Ship the thing (60%)",
    });
    expect(keepLightsOn).toEqual({
      cluster: "Keep the Lights On",
      totalAllocation: 0,
      objectives: "Unallocated work (unset)",
    });
  });
});

describe("buildExportRows column injection", () => {
  it("emits exactly the columns it is given, in order", () => {
    const rows = buildExportRows(quarter, [
      { header: "Name", width: 10, value: (c) => c.node.title },
      { header: "Where", width: 10, value: (c) => c.quarterLabel },
    ]);
    expect(Object.keys(rows[0])).toEqual(["Name", "Where"]);
    expect(rows[0].Name).toBe("Ship the thing");
    expect(rows[0].Where).toBe(quarter.label);
  });

  it("defaults to a neutral column set", () => {
    expect(Object.keys(buildExportRows(quarter)[0])).toEqual([
      "#",
      "Quarter",
      "Cluster",
      "Objective",
      "Key Results",
      "Actual",
      "Target",
      "Details",
      "Status",
      "Allocation",
    ]);
  });

  it("computes the shared context once per objective, not once per column", () => {
    let calls = 0;
    buildExportRows(quarter, [
      { header: "A", width: 5, value: (c) => String(++calls && c.index) },
      { header: "B", width: 5, value: (c) => String(++calls && c.index) },
    ]);
    expect(calls).toBe(4);
  });
});
