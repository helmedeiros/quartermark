import type {
  OkrNode,
  OkrStatus,
  OkrUpdate,
  Quarter,
} from "../components/types";
import { effectiveProgress } from "./traversal";

export type SummaryScope = "overall" | "kr" | "milestone";

function collectByType(nodes: OkrNode[], type: OkrNode["type"]): OkrNode[] {
  const out: OkrNode[] = [];
  const walk = (n: OkrNode) => {
    for (const c of n.children ?? []) {
      if (c.type === type) out.push(c);
      walk(c);
    }
  };
  for (const n of nodes) walk(n);
  return out;
}

export function collectNodesByScope(
  quarter: Quarter,
  scope: SummaryScope,
): OkrNode[] {
  if (scope === "overall") return quarter.objectives;
  if (scope === "kr") return collectByType(quarter.objectives, "key_result");
  return collectByType(quarter.objectives, "milestone");
}

export function averageProgress(nodes: OkrNode[]): number {
  if (!nodes.length) return 0;
  const values = nodes.map(effectiveProgress);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export const STATUS_BREAKDOWN_ORDER: OkrStatus[] = [
  "on_track",
  "at_risk",
  "off_track",
  "not_started",
  "done",
];

export interface StatusCount {
  status: OkrStatus;
  count: number;
}

export function buildStatusBreakdown(nodes: OkrNode[]): StatusCount[] {
  const counts = new Map<OkrStatus, number>();
  for (const n of nodes) counts.set(n.status, (counts.get(n.status) ?? 0) + 1);
  return STATUS_BREAKDOWN_ORDER.map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
}

function dayKey(date: string): string {
  return date.slice(0, 10);
}

export function buildAggregateTrend(nodes: OkrNode[]): OkrUpdate[] {
  if (!nodes.length) return [];

  const dates = new Set<string>();
  for (const n of nodes) {
    for (const u of n.updates ?? []) dates.add(dayKey(u.date));
  }
  const sortedDates = [...dates].sort();
  if (!sortedDates.length) return [];

  return sortedDates.map((date) => {
    const values = nodes.map((n) => {
      const priorUpdates = (n.updates ?? []).filter(
        (u) => dayKey(u.date) <= date,
      );
      if (!priorUpdates.length) return effectiveProgress(n);
      return priorUpdates[priorUpdates.length - 1].progress;
    });
    const progress = Math.round(
      values.reduce((a, b) => a + b, 0) / values.length,
    );
    return {
      date,
      progress,
      status: progress >= 60 ? "on_track" : "at_risk",
    } as OkrUpdate;
  });
}

export function progressDeltaSinceLastWeek(
  trend: OkrUpdate[],
  now: Date,
): number | null {
  if (trend.length < 2) return null;
  const last = trend[trend.length - 1];
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoKey = dayKey(weekAgo.toISOString());

  const priorPoints = trend.filter((t) => t.date <= weekAgoKey);
  const baseline = priorPoints.length
    ? priorPoints[priorPoints.length - 1]
    : trend[0];
  return last.progress - baseline.progress;
}
