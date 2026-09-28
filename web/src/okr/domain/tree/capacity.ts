import type { OkrNode, Quarter } from "../model";
import type { DateWindow } from "../../../lib/dateWindow";
import { weekSpans } from "../../../lib/ganttLayout";
import { collectMilestonesWithObjective, milestoneDateRange } from "./gantt";

export interface WeekCapacityContributor {
  milestoneId: string;
  objectiveId: string;
  title: string;
  weeklyRate: number;
}

export interface WeekCapacity {
  start: Date;
  end: Date;
  demand: number;
  capacity?: number;
  overCommitted: boolean;
  contributors: WeekCapacityContributor[];
}

const FIXED_ENGINEERS = 2;

function weeksBetween(start: Date, end: Date): number {
  return Math.max(1, (end.getTime() - start.getTime()) / (7 * 86400000));
}

export function dueDateAfterWeeks(startDate: string, weeks: number): string {
  const due = new Date(startDate);
  due.setDate(due.getDate() + weeks * 7);
  return due.toISOString().slice(0, 10);
}

export function effortWeeksPatch(
  milestone: OkrNode,
  objective: OkrNode,
  quarter: Quarter,
  effortWeeks: number | undefined,
): Partial<OkrNode> {
  if (effortWeeks == null) return { effortWeeks: undefined };
  const anchorStart =
    milestone.startDate ??
    milestoneDateRange(milestone, objective, quarter)?.start;
  if (!anchorStart) return { effortWeeks };
  return {
    effortWeeks,
    startDate: anchorStart,
    dueDate: dueDateAfterWeeks(anchorStart, effortWeeks),
  };
}

export function objectiveTotalEffortEngineerWeeks(objective: OkrNode): number {
  let total = 0;
  const walk = (node: OkrNode) => {
    if (node.type === "milestone" && node.effortWeeks) {
      total += node.effortWeeks * FIXED_ENGINEERS;
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(objective);
  return total;
}

export function weeklyCapacity(
  quarter: Quarter,
  window: DateWindow,
): WeekCapacity[] {
  const capacity = quarter.teamCapacity;
  const milestonePairs = collectMilestonesWithObjective(quarter);
  return weekSpans(window).map((week) => {
    const contributors: WeekCapacityContributor[] = [];
    let demand = 0;
    for (const { milestone, objective } of milestonePairs) {
      if (!milestone.effortWeeks) continue;
      const range = milestoneDateRange(milestone, objective, quarter);
      if (!range) continue;
      const start = new Date(range.start);
      const end = new Date(range.end);
      if (end < week.start || start > week.end) continue;
      const weeklyRate =
        (milestone.effortWeeks * FIXED_ENGINEERS) / weeksBetween(start, end);
      demand += weeklyRate;
      contributors.push({
        milestoneId: milestone.id,
        objectiveId: objective.id,
        title: milestone.title,
        weeklyRate,
      });
    }
    return {
      start: week.start,
      end: week.end,
      demand,
      capacity,
      overCommitted: capacity != null && demand > capacity,
      contributors,
    };
  });
}
