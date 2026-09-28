import type { OkrNode, OkrStatus, Quarter } from "../model";
import { effectiveProgress } from "./traversal";

export function effectiveDateRange(
  node: OkrNode,
  quarter: Quarter,
): { start?: string; due?: string } {
  return {
    start: node.startDate ?? quarter.startDate,
    due: node.dueDate ?? quarter.endDate,
  };
}

export const PREDICTED_SCORE_ON_TRACK = 100;
export const PREDICTED_SCORE_AT_RISK = 70;

function elapsedFraction(start: string, due: string, now: Date): number | null {
  const startT = new Date(start).getTime();
  const dueT = new Date(due).getTime();
  if (dueT <= startT) return null;
  return Math.min(1, Math.max(0, (now.getTime() - startT) / (dueT - startT)));
}

export function predictedScore(
  node: OkrNode,
  quarter: Quarter,
  now: Date = new Date(),
): number | null {
  const { start, due } = effectiveDateRange(node, quarter);
  if (!start || !due) return null;
  const elapsed = elapsedFraction(start, due, now);
  if (elapsed === null) return null;

  const progress = effectiveProgress(node);
  const expectedProgress = elapsed * 100;
  if (expectedProgress === 0) return progress > 0 ? 200 : 100;
  return Math.round((progress / expectedProgress) * 100);
}

export function predictStatus(
  node: OkrNode,
  quarter: Quarter,
  now: Date = new Date(),
): OkrStatus {
  const progress = effectiveProgress(node);
  if (progress >= 100) return "done";

  const { start, due } = effectiveDateRange(node, quarter);
  if (!start || !due) return node.status;
  const elapsed = elapsedFraction(start, due, now);
  if (elapsed === null) return node.status;
  if (elapsed === 0) return progress > 0 ? "on_track" : "not_started";

  const expectedProgress = elapsed * 100;
  const score = Math.round((progress / expectedProgress) * 100);
  if (score >= PREDICTED_SCORE_ON_TRACK) return "on_track";
  if (score >= PREDICTED_SCORE_AT_RISK) return "at_risk";
  return "off_track";
}

export function effectiveStatus(node: OkrNode, quarter: Quarter): OkrStatus {
  if (node.statusMode !== "auto") return node.status;
  return predictStatus(node, quarter);
}
