import { describe, expect, it } from "vitest";
import type { Quarter } from "../model";
import {
  averageProgress,
  buildAggregateTrend,
  buildStatusBreakdown,
  collectNodesByScope,
  progressDeltaSinceLastWeek,
} from "./summary";

const quarter: Quarter = {
  quarterId: "2026-q4",
  label: "Q4 2026",
  objectives: [
    {
      id: "O-1",
      type: "objective",
      title: "First",
      status: "on_track",
      progress: 60,
      updates: [
        { date: "2026-09-01", status: "not_started", progress: 0 },
        { date: "2026-09-15", status: "on_track", progress: 60 },
      ],
      children: [
        {
          id: "O-1-KR1",
          type: "key_result",
          title: "KR one",
          status: "at_risk",
          progress: 30,
          children: [
            {
              id: "O-1-KR1-M1",
              type: "milestone",
              title: "Milestone one",
              status: "done",
              progress: 100,
            },
          ],
        },
      ],
    },
    {
      id: "O-2",
      type: "objective",
      title: "Second",
      status: "not_started",
      progress: 0,
    },
  ],
};

describe("collectNodesByScope", () => {
  it("returns top-level objectives for 'overall'", () => {
    expect(collectNodesByScope(quarter, "overall").map((n) => n.id)).toEqual([
      "O-1",
      "O-2",
    ]);
  });

  it("recursively collects key results for 'kr'", () => {
    expect(collectNodesByScope(quarter, "kr").map((n) => n.id)).toEqual([
      "O-1-KR1",
    ]);
  });

  it("recursively collects milestones for 'milestone', including ones nested under a KR", () => {
    expect(collectNodesByScope(quarter, "milestone").map((n) => n.id)).toEqual([
      "O-1-KR1-M1",
    ]);
  });
});

describe("averageProgress", () => {
  it("averages effective progress across nodes, rolling up through contributing children", () => {
    expect(averageProgress(collectNodesByScope(quarter, "overall"))).toBe(50);
  });

  it("returns 0 for an empty scope", () => {
    expect(averageProgress([])).toBe(0);
  });
});

describe("buildStatusBreakdown", () => {
  it("counts nodes per status in the fixed display order", () => {
    const breakdown = buildStatusBreakdown(
      collectNodesByScope(quarter, "overall"),
    );
    expect(breakdown).toEqual([
      { status: "on_track", count: 1 },
      { status: "at_risk", count: 0 },
      { status: "off_track", count: 0 },
      { status: "not_started", count: 1 },
      { status: "done", count: 0 },
    ]);
  });
});

describe("buildAggregateTrend", () => {
  it("averages carried-forward progress per node at each distinct update date", () => {
    const trend = buildAggregateTrend(collectNodesByScope(quarter, "overall"));
    expect(trend).toEqual([
      { date: "2026-09-01", progress: 0, status: "at_risk" },
      { date: "2026-09-15", progress: 30, status: "at_risk" },
    ]);
  });

  it("returns an empty trend when no node in scope has any update history", () => {
    expect(buildAggregateTrend(collectNodesByScope(quarter, "kr"))).toEqual([]);
  });
});

describe("progressDeltaSinceLastWeek", () => {
  it("returns null when there are fewer than two trend points", () => {
    expect(progressDeltaSinceLastWeek([], new Date())).toBeNull();
    expect(
      progressDeltaSinceLastWeek(
        [{ date: "2026-09-01", progress: 10, status: "on_track" }],
        new Date("2026-09-20"),
      ),
    ).toBeNull();
  });

  it("diffs the latest point against the point at or before 7 days ago", () => {
    const trend = [
      { date: "2026-09-01", progress: 0, status: "not_started" as const },
      { date: "2026-09-10", progress: 40, status: "on_track" as const },
      { date: "2026-09-20", progress: 55, status: "on_track" as const },
    ];
    expect(progressDeltaSinceLastWeek(trend, new Date("2026-09-20"))).toBe(15);
  });
});
