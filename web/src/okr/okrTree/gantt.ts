import type { OkrNode, OkrStatus, Quarter } from "../components/types";
import type { DateWindow } from "../../lib/dateWindow";
import type { GanttRow } from "../../lib/ganttLayout";
import { yearWeekLabel } from "../../lib/ganttLayout";
import { jiraTicketUrl } from "../jira";
import { effectiveDateRange } from "./auto";

function okrLink(teamSlug: string, quarterId: string, nodeId: string): string {
  return `/t/${teamSlug}/okrs/${quarterId}/${nodeId}`;
}

const OBJECTIVE_COLOR_PALETTE = [
  "#2563eb",
  "#f97316",
  "#16a34a",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#ca8a04",
  "#db2777",
  "#4d7c0f",
  "#9333ea",
];

export function objectiveColor(quarter: Quarter, objectiveId: string): string {
  const index = quarter.objectives.findIndex((o) => o.id === objectiveId);
  return OBJECTIVE_COLOR_PALETTE[
    Math.max(0, index) % OBJECTIVE_COLOR_PALETTE.length
  ];
}

export function objectiveGanttRows(
  quarter: Quarter,
  teamSlug: string,
): GanttRow[] {
  const rows: GanttRow[] = [];
  for (const o of quarter.objectives) {
    const { start, due } = effectiveDateRange(o, quarter);
    if (!start || !due) continue;
    rows.push({
      label: `${o.id} ${o.title}`,
      start: new Date(start),
      end: new Date(due),
      category: "Objective",
      color: objectiveColor(quarter, o.id),
      link: okrLink(teamSlug, quarter.quarterId, o.id),
      data: o.id,
    });
  }
  return rows;
}

export interface MilestoneWithObjective {
  milestone: OkrNode;
  objective: OkrNode;
}

export function collectMilestonesWithObjective(
  quarter: Quarter,
): MilestoneWithObjective[] {
  const out: MilestoneWithObjective[] = [];
  const walk = (node: OkrNode, objective: OkrNode) => {
    for (const child of node.children ?? []) {
      if (child.type === "milestone") out.push({ milestone: child, objective });
      walk(child, objective);
    }
  };
  for (const objective of quarter.objectives) walk(objective, objective);
  return out;
}

function firstLinkedJiraDueDate(milestone: OkrNode): string | undefined {
  for (const key of milestone.jiraKeys ?? []) {
    const dueDate = milestone.jiraIssues?.[key]?.dueDate;
    if (dueDate) return dueDate;
  }
  return undefined;
}

export function milestoneDateRange(
  milestone: OkrNode,
  objective: OkrNode,
  quarter: Quarter,
): { start: string; end: string } | null {
  if (milestone.startDate && milestone.dueDate) {
    return { start: milestone.startDate, end: milestone.dueDate };
  }
  const objectiveRange = effectiveDateRange(objective, quarter);
  const jiraDue = firstLinkedJiraDueDate(milestone);
  if (jiraDue && objectiveRange.start) {
    return { start: objectiveRange.start, end: jiraDue };
  }
  if (objectiveRange.start && objectiveRange.due) {
    return { start: objectiveRange.start, end: objectiveRange.due };
  }
  return null;
}

function buildMilestoneRow(
  milestone: OkrNode,
  objective: OkrNode,
  quarter: Quarter,
  teamSlug: string,
): GanttRow | null {
  const range = milestoneDateRange(milestone, objective, quarter);
  if (!range) return null;
  return {
    label: `${milestone.id} ${milestone.title}`,
    start: new Date(range.start),
    end: new Date(range.end),
    category: "Milestone",
    color: objectiveColor(quarter, objective.id),
    link: okrLink(teamSlug, quarter.quarterId, milestone.id),
  };
}

export function milestoneGanttRows(
  quarter: Quarter,
  teamSlug: string,
): GanttRow[] {
  const rows: GanttRow[] = [];
  for (const { milestone, objective } of collectMilestonesWithObjective(
    quarter,
  )) {
    const row = buildMilestoneRow(milestone, objective, quarter, teamSlug);
    if (row) rows.push(row);
  }
  return rows;
}

export type OkrGanttKind = "objective" | "milestone";

export interface OkrGanttBar {
  id: string;
  label: string;
  start: Date;
  end: Date;
  color: string;
  status: OkrStatus;
  link: string;
  kind: OkrGanttKind;
}

export interface ObjectiveGanttGroup {
  objectiveId: string;
  objective: OkrGanttBar;
  milestones: OkrGanttBar[];
}

export function objectiveGanttGroups(
  quarter: Quarter,
  teamSlug: string,
): ObjectiveGanttGroup[] {
  const milestonesByObjective = new Map<string, OkrGanttBar[]>();
  for (const { milestone, objective } of collectMilestonesWithObjective(
    quarter,
  )) {
    const range = milestoneDateRange(milestone, objective, quarter);
    if (!range) continue;
    const bar: OkrGanttBar = {
      id: milestone.id,
      label: `${milestone.id} ${milestone.title}`,
      start: new Date(range.start),
      end: new Date(range.end),
      color: objectiveColor(quarter, objective.id),
      status: milestone.status,
      link: okrLink(teamSlug, quarter.quarterId, milestone.id),
      kind: "milestone",
    };
    const list = milestonesByObjective.get(objective.id) ?? [];
    list.push(bar);
    milestonesByObjective.set(objective.id, list);
  }

  const groups: ObjectiveGanttGroup[] = [];
  for (const o of quarter.objectives) {
    const { start, due } = effectiveDateRange(o, quarter);
    if (!start || !due) continue;
    groups.push({
      objectiveId: o.id,
      objective: {
        id: o.id,
        label: `${o.id} ${o.title}`,
        start: new Date(start),
        end: new Date(due),
        color: objectiveColor(quarter, o.id),
        status: o.status,
        link: okrLink(teamSlug, quarter.quarterId, o.id),
        kind: "objective",
      },
      milestones: milestonesByObjective.get(o.id) ?? [],
    });
  }
  return groups;
}

export interface SprintGanttBar {
  name: string;
  start: Date;
  end: Date;
  isProjected: boolean;
}

function realSprintBars(quarter: Quarter): SprintGanttBar[] {
  const byName = new Map<string, SprintGanttBar>();
  const walk = (node: OkrNode) => {
    for (const snapshot of Object.values(node.jiraIssues ?? {})) {
      for (const sprint of snapshot.sprints ?? []) {
        if (!sprint.startDate || !sprint.endDate || byName.has(sprint.name)) {
          continue;
        }
        byName.set(sprint.name, {
          name: sprint.name,
          start: new Date(sprint.startDate),
          end: new Date(sprint.endDate),
          isProjected: false,
        });
      }
    }
    for (const child of node.children ?? []) walk(child);
  };
  for (const objective of quarter.objectives) walk(objective);
  return [...byName.values()].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const SPRINT_CADENCE_DAYS = 14;

export function sprintGanttBars(
  quarter: Quarter,
  window: DateWindow,
): SprintGanttBar[] {
  const real = realSprintBars(quarter);
  if (real.length === 0) return real;

  const projected: SprintGanttBar[] = [];
  const projectedBar = (start: Date): SprintGanttBar => ({
    name: `${yearWeekLabel(start)} (projected)`,
    start,
    end: addDays(start, SPRINT_CADENCE_DAYS),
    isProjected: true,
  });

  let cursor = real[real.length - 1].end;
  while (cursor <= window.end) {
    projected.push(projectedBar(cursor));
    cursor = addDays(cursor, SPRINT_CADENCE_DAYS);
  }

  cursor = addDays(real[0].start, -SPRINT_CADENCE_DAYS);
  while (cursor >= window.start) {
    projected.push(projectedBar(cursor));
    cursor = addDays(cursor, -SPRINT_CADENCE_DAYS);
  }

  return [...real, ...projected].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
}

export function jiraEpicGanttRows(
  quarter: Quarter,
  jiraBaseUrl: string,
): GanttRow[] {
  const seen = new Map<string, GanttRow>();
  const walk = (node: OkrNode) => {
    for (const [key, snapshot] of Object.entries(node.jiraIssues ?? {})) {
      if (snapshot.issueType !== "Epic" || !snapshot.dueDate) continue;
      if (seen.has(key)) continue;
      const { start } = effectiveDateRange(node, quarter);
      if (!start) continue;
      seen.set(key, {
        label: `${key} ${snapshot.summary ?? ""}`.trim(),
        start: new Date(start),
        end: new Date(snapshot.dueDate),
        category: "Jira Epic",
        link: jiraTicketUrl(jiraBaseUrl, key),
      });
    }
    for (const child of node.children ?? []) walk(child);
  };
  for (const objective of quarter.objectives) walk(objective);
  return [...seen.values()];
}
