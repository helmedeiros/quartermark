import { describe, expect, it } from "vitest";
import type { OkrNode, Quarter } from "../components/types";
import {
  effectiveDateRange,
  effectiveStatus,
  predictedScore,
  predictStatus,
} from "./auto";

const quarter: Quarter = {
  quarterId: "2026-q4",
  label: "Q4 2026",
  startDate: "2026-10-01",
  endDate: "2026-12-31",
  objectives: [],
};

function node(overrides: Partial<OkrNode>): OkrNode {
  return {
    id: "O-1",
    type: "objective",
    title: "Test",
    status: "on_track",
    progress: 0,
    ...overrides,
  };
}

describe("effectiveDateRange", () => {
  it("uses the node's own dates when set", () => {
    expect(
      effectiveDateRange(
        node({ startDate: "2026-11-01", dueDate: "2026-11-30" }),
        quarter,
      ),
    ).toEqual({ start: "2026-11-01", due: "2026-11-30" });
  });

  it("falls back to the quarter's dates per-field when the node doesn't set them", () => {
    expect(
      effectiveDateRange(node({ startDate: "2026-11-01" }), quarter),
    ).toEqual({
      start: "2026-11-01",
      due: "2026-12-31",
    });
    expect(effectiveDateRange(node({}), quarter)).toEqual({
      start: "2026-10-01",
      due: "2026-12-31",
    });
  });
});

describe("predictedScore", () => {
  it("returns null when neither the node nor the quarter has a date range", () => {
    const noDatesQuarter: Quarter = {
      ...quarter,
      startDate: undefined,
      endDate: undefined,
    };
    expect(predictedScore(node({}), noDatesQuarter)).toBeNull();
  });

  it("scores exactly on pace as 100", () => {
    const tenDayQuarter: Quarter = {
      ...quarter,
      startDate: "2026-01-01",
      endDate: "2026-01-11",
    };
    const n = node({ progress: 50 });
    const now = new Date("2026-01-06T00:00:00Z");
    expect(predictedScore(n, tenDayQuarter, now)).toBe(100);
  });

  it("scores ahead of pace above 100", () => {
    const n = node({ progress: 80 });
    const now = new Date("2026-11-15T00:00:00Z");
    expect(predictedScore(n, quarter, now)).toBeGreaterThan(100);
  });

  it("scores behind pace below 100", () => {
    const n = node({ progress: 20 });
    const now = new Date("2026-11-15T00:00:00Z");
    expect(predictedScore(n, quarter, now)).toBeLessThan(100);
  });

  it("treats any progress before the start date as ahead of schedule", () => {
    const n = node({ progress: 10 });
    const now = new Date("2026-09-01T00:00:00Z");
    expect(predictedScore(n, quarter, now)).toBe(200);
  });
});

describe("predictStatus", () => {
  it("is done once progress reaches 100, regardless of pace", () => {
    const n = node({ progress: 100 });
    expect(predictStatus(n, quarter, new Date("2026-10-05"))).toBe("done");
  });

  it("is not_started before the start date with zero progress", () => {
    const n = node({ progress: 0 });
    expect(predictStatus(n, quarter, new Date("2026-09-01"))).toBe(
      "not_started",
    );
  });

  it("is on_track when on or ahead of pace", () => {
    const n = node({ progress: 55 });
    expect(predictStatus(n, quarter, new Date("2026-11-15"))).toBe("on_track");
  });

  it("is at_risk when moderately behind pace", () => {
    const n = node({ progress: 40 });
    expect(predictStatus(n, quarter, new Date("2026-11-15"))).toBe("at_risk");
  });

  it("is off_track when far behind pace", () => {
    const n = node({ progress: 5 });
    expect(predictStatus(n, quarter, new Date("2026-11-15"))).toBe("off_track");
  });

  it("falls back to the stored status when there is no date range", () => {
    const noDatesQuarter: Quarter = {
      ...quarter,
      startDate: undefined,
      endDate: undefined,
    };
    const n = node({ progress: 10, status: "at_risk" });
    expect(predictStatus(n, noDatesQuarter)).toBe("at_risk");
  });
});

describe("effectiveStatus", () => {
  it("returns the stored status when statusMode is not auto", () => {
    const n = node({ status: "off_track", progress: 5 });
    expect(effectiveStatus(n, quarter)).toBe("off_track");
  });

  it("returns the predicted status when statusMode is auto", () => {
    const n = node({ status: "off_track", progress: 100, statusMode: "auto" });
    expect(effectiveStatus(n, quarter)).toBe("done");
  });
});
