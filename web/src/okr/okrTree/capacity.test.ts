import { describe, expect, it } from "vitest";
import type { OkrNode, Quarter } from "../components/types";
import {
  dueDateAfterWeeks,
  effortWeeksPatch,
  objectiveTotalEffortEngineerWeeks,
  weeklyCapacity,
} from "./capacity";

function quarterWith(objectives: Quarter["objectives"]): Quarter {
  return {
    quarterId: "2026-q4",
    label: "Q4 2026",
    startDate: "2026-10-01",
    endDate: "2026-12-31",
    teamCapacity: 3,
    objectives,
  };
}

function objectiveWithMilestones(
  id: string,
  title: string,
  milestones: OkrNode[],
): OkrNode {
  return {
    id,
    type: "objective",
    title,
    status: "on_track",
    progress: 0,
    children: milestones,
  };
}

function milestone(overrides: Partial<OkrNode> & { id: string }): OkrNode {
  return {
    type: "milestone",
    title: overrides.id,
    status: "not_started",
    progress: 0,
    ...overrides,
  };
}

describe("weeklyCapacity", () => {
  it("spreads a milestone's total effort evenly across the weeks it's scheduled in", () => {
    const quarter = quarterWith([
      objectiveWithMilestones("O-1", "Objective one", [
        milestone({
          id: "O-1-M1",
          startDate: "2026-10-05", // Monday
          dueDate: "2026-10-19", // Monday, exactly 14 days later
          effortWeeks: 2,
        }),
      ]),
    ]);
    const window = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) };
    const weeks = weeklyCapacity(quarter, window);
    const active = weeks.filter((w) => w.demand > 0);
    expect(active.length).toBeGreaterThan(0);
    const [first, ...rest] = active;
    for (const week of rest) {
      expect(week.demand).toBeCloseTo(first.demand, 5);
    }
    expect(first.demand * 2).toBeCloseTo(4, 5);
    expect(first.contributors).toEqual([
      {
        milestoneId: "O-1-M1",
        objectiveId: "O-1",
        title: "O-1-M1",
        weeklyRate: first.demand,
      },
    ]);
  });

  it("flags a week as over-committed when demand exceeds team capacity", () => {
    const quarter = quarterWith([
      objectiveWithMilestones("O-1", "Objective one", [
        milestone({
          id: "O-1-M1",
          startDate: "2026-10-05", // Monday
          dueDate: "2026-10-12", // Monday, exactly 7 days later
          effortWeeks: 3,
        }),
      ]),
      objectiveWithMilestones("O-2", "Objective two", [
        milestone({
          id: "O-2-M1",
          startDate: "2026-10-05",
          dueDate: "2026-10-12",
          effortWeeks: 1,
        }),
      ]),
    ]);
    const window = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) };
    const weeks = weeklyCapacity(quarter, window);
    const busyWeek = weeks.find((w) => w.demand > 0)!;
    expect(busyWeek.demand).toBeCloseTo(8, 5); // (2*3) + (2*1) over 1 week each
    expect(busyWeek.capacity).toBe(3);
    expect(busyWeek.overCommitted).toBe(true);
    expect(busyWeek.contributors.map((c) => c.milestoneId)).toEqual([
      "O-1-M1",
      "O-2-M1",
    ]);
  });

  it("never flags overCommitted when the quarter has no configured capacity", () => {
    const quarter = quarterWith([
      objectiveWithMilestones("O-1", "Objective one", [
        milestone({
          id: "O-1-M1",
          startDate: "2026-10-05",
          dueDate: "2026-10-11",
          effortWeeks: 50,
        }),
      ]),
    ]);
    quarter.teamCapacity = undefined;
    const window = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) };
    const weeks = weeklyCapacity(quarter, window);
    expect(weeks.every((w) => !w.overCommitted)).toBe(true);
  });

  it("ignores milestones with no effort configured, and objectives with no milestones", () => {
    const quarter = quarterWith([
      objectiveWithMilestones("O-1", "Objective one", [
        milestone({
          id: "O-1-M1",
          startDate: "2026-10-05",
          dueDate: "2026-10-11",
        }),
      ]),
      objectiveWithMilestones("O-2", "Objective two, no milestones", []),
    ]);
    const window = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) };
    const weeks = weeklyCapacity(quarter, window);
    expect(weeks.every((w) => w.demand === 0)).toBe(true);
  });

  it("finds effort on a milestone nested under a key result", () => {
    const objective: OkrNode = {
      id: "O-1",
      type: "objective",
      title: "Objective with a KR",
      status: "on_track",
      progress: 0,
      children: [
        {
          id: "O-1-KR1",
          type: "key_result",
          title: "A KR",
          status: "not_started",
          progress: 0,
          children: [
            milestone({
              id: "O-1-KR1-M1",
              startDate: "2026-10-05",
              dueDate: "2026-10-11",
              effortWeeks: 1,
            }),
          ],
        },
      ],
    };
    const quarter = quarterWith([objective]);
    const window = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) };
    const weeks = weeklyCapacity(quarter, window);
    expect(weeks.some((w) => w.demand > 0)).toBe(true);
  });
});

describe("objectiveTotalEffortEngineerWeeks", () => {
  it("sums effort across every milestone, including ones nested under a key result", () => {
    const objective: OkrNode = {
      id: "O-1",
      type: "objective",
      title: "Objective one",
      status: "on_track",
      progress: 0,
      children: [
        milestone({ id: "O-1-M1", effortWeeks: 3 }),
        milestone({ id: "O-1-M2" }), // no effort set — contributes 0
        {
          id: "O-1-KR1",
          type: "key_result",
          title: "A KR",
          status: "not_started",
          progress: 0,
          children: [milestone({ id: "O-1-KR1-M1", effortWeeks: 4 })],
        },
      ],
    };
    expect(objectiveTotalEffortEngineerWeeks(objective)).toBe(14);
  });

  it("returns 0 for an objective with no milestones or no effort set", () => {
    const objective: OkrNode = {
      id: "O-1",
      type: "objective",
      title: "Empty",
      status: "not_started",
      progress: 0,
    };
    expect(objectiveTotalEffortEngineerWeeks(objective)).toBe(0);
  });
});

describe("dueDateAfterWeeks", () => {
  it("adds exactly weeks * 7 days to the start date", () => {
    expect(dueDateAfterWeeks("2026-10-05", 2)).toBe("2026-10-19");
    expect(dueDateAfterWeeks("2026-10-05", 1)).toBe("2026-10-12");
  });
});

describe("effortWeeksPatch", () => {
  const objective: OkrNode = {
    id: "O-1",
    type: "objective",
    title: "Objective one",
    status: "on_track",
    progress: 0,
    startDate: "2026-10-01",
    dueDate: "2026-12-31",
  };
  const quarter = quarterWith([objective]);

  it("keeps the milestone's own start date anchored and recomputes only the due date", () => {
    const milestoneWithOwnStart = milestone({
      id: "O-1-M1",
      startDate: "2026-10-06",
      dueDate: "2026-10-08", // stale — should be overwritten
    });
    const patch = effortWeeksPatch(
      milestoneWithOwnStart,
      objective,
      quarter,
      3,
    );
    expect(patch).toEqual({
      effortWeeks: 3,
      startDate: "2026-10-06",
      dueDate: "2026-10-27",
    });
  });

  it("materializes the effective (fallback) start date the first time effort is set", () => {
    const milestoneWithNoOwnDates = milestone({ id: "O-1-M2" });
    const patch = effortWeeksPatch(
      milestoneWithNoOwnDates,
      objective,
      quarter,
      2,
    );
    expect(patch).toEqual({
      effortWeeks: 2,
      startDate: "2026-10-01", // fell back to the objective's own start
      dueDate: "2026-10-15",
    });
  });

  it("clears effortWeeks without touching dates when set back to undefined", () => {
    const milestoneWithDates = milestone({
      id: "O-1-M1",
      startDate: "2026-10-06",
      dueDate: "2026-10-27",
      effortWeeks: 3,
    });
    const patch = effortWeeksPatch(
      milestoneWithDates,
      objective,
      quarter,
      undefined,
    );
    expect(patch).toEqual({ effortWeeks: undefined });
  });
});
