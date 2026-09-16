import type {
  OkrCommitment,
  OkrMetricType,
  OkrNode,
  OkrNodeType,
  OkrStatus,
} from "../components/types";

export const STATUS_META: Record<OkrStatus, { label: string; cls: string }> = {
  not_started: { label: "Not started", cls: "neutral" },
  on_track: { label: "On track", cls: "good" },
  at_risk: { label: "At risk", cls: "warning" },
  off_track: { label: "Off track", cls: "critical" },
  done: { label: "Done", cls: "good" },
};

export const COMMITMENT_META: Record<
  OkrCommitment,
  { label: string; cls: string }
> = {
  proposed: { label: "Proposed", cls: "neutral" },
  committed: { label: "Committed", cls: "good" },
  if_possible: { label: "If possible", cls: "info" },
  rejected: { label: "Rejected", cls: "critical" },
  extra: { label: "Extra", cls: "warning" },
};

export const METRIC_TYPE_META: Record<OkrMetricType, { label: string }> = {
  percent: { label: "Percent" },
  number: { label: "Number" },
  currency: { label: "Currency" },
  boolean: { label: "Boolean" },
};

export function deriveMetricProgress(
  metricType: OkrMetricType,
  current: number,
  target: number,
): number {
  if (metricType === "boolean") return current >= 1 ? 100 : 0;
  if (target === 0) return 0;
  return Math.round((current / target) * 100);
}

export function targetNumberFor(
  metricType: OkrMetricType,
  target: string,
): number | undefined {
  if (metricType === "boolean") return 1;
  return target.trim() === "" ? undefined : Number(target);
}

export function currentNumberFor(
  metricType: OkrMetricType,
  current: string,
): number | undefined {
  if (metricType === "boolean") return Number(current);
  return current.trim() === "" ? undefined : Number(current);
}

export function formatMetricValue(
  metricType: OkrMetricType | undefined,
  value: number,
  unit?: string,
): string {
  if (metricType === "boolean") return value >= 1 ? "Done" : "Not done";
  if (metricType === "currency") return `${unit ?? "$"}${value}`;
  if (metricType === "percent") return `${value}%`;
  return `${value}${unit ? ` ${unit}` : ""}`;
}

export const TYPE_META: Record<
  OkrNode["type"],
  { label: string; short: string }
> = {
  objective: { label: "Objective", short: "O" },
  key_result: { label: "Key Result", short: "KR" },
  milestone: { label: "Milestone", short: "M" },
};

export const TYPE_BADGE_CLASS: Record<OkrNode["type"], string> = {
  objective: "okr-badge-objective",
  key_result: "okr-badge-kr",
  milestone: "okr-badge-milestone",
};

export function allowedChildTypesFor(nodeType: OkrNodeType): OkrNodeType[] {
  if (nodeType === "objective") {
    return ["objective", "key_result", "milestone"];
  }
  if (nodeType === "key_result") return ["milestone"];
  return [];
}

// The strategic themes objectives are grouped under.
//
// A placeholder set: every organisation words these differently, and
// this list is the one thing in the module that is unavoidably somebody
// else's vocabulary. Treat it as a default to replace, not a taxonomy.
export const CLUSTERS = [
  "Growth",
  "Retention",
  "Platform",
  "Reliability",
  "Developer Experience",
  "Discovery",
  "Keep the Lights On",
  "Cost",
] as const;

export type Cluster = (typeof CLUSTERS)[number] | "Non-Cluster";

export const CLUSTER_COLORS: Record<(typeof CLUSTERS)[number], string> = {
  Growth: "#2a78d6",
  Retention: "#eb6834",
  Platform: "#1baf7a",
  Reliability: "#eda100",
  "Developer Experience": "#e87ba4",
  Discovery: "#008300",
  "Keep the Lights On": "#4a3aa7",
  Cost: "#e34948",
};

// Lower-cased spellings people actually type, mapped onto the canonical
// name. Extend it for your own vocabulary rather than requiring exact
// case and spacing on input.
const CLUSTER_ALIASES: Record<string, Cluster> = Object.fromEntries(
  CLUSTERS.map((c) => [c.toLowerCase(), c]),
);

export function resolveCluster(groups?: string[]): Cluster {
  const raw = groups?.[1]?.trim().toLowerCase();
  if (!raw) return "Non-Cluster";
  return CLUSTER_ALIASES[raw] ?? "Non-Cluster";
}

export function effectiveGroups(path: OkrNode[]): string[] {
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i].groups?.length) return path[i].groups!;
  }
  return [];
}
