import type {
  OkrCommitment,
  OkrMetricType,
  OkrNode,
  OkrNodeType,
  OkrStatus,
} from "../components/types";

export interface StatusMeta {
  label: string;
  cls: string;
}

export const STATUS_META: Record<OkrStatus, StatusMeta> = {
  not_started: { label: "Not started", cls: "neutral" },
  on_track: { label: "On track", cls: "good" },
  at_risk: { label: "At risk", cls: "warning" },
  off_track: { label: "Off track", cls: "critical" },
  done: { label: "Done", cls: "good" },
};

export function statusMeta(status: string | undefined): StatusMeta {
  if (status && status in STATUS_META) {
    return STATUS_META[status as OkrStatus];
  }
  return { label: status ? `${status} (unknown)` : "—", cls: "neutral" };
}

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

export const DEFAULT_CLUSTERS = [
  "Growth",
  "Retention",
  "Platform",
  "Reliability",
  "Developer Experience",
  "Discovery",
  "Keep the Lights On",
  "Cost",
];

export type Cluster = string;

export const NON_CLUSTER = "Non-Cluster";

const CLUSTER_PALETTE = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
];

export function clusterColor(
  cluster: Cluster,
  clusters: string[] = DEFAULT_CLUSTERS,
): string | undefined {
  const index = clusters.indexOf(cluster);
  if (index < 0) return undefined;
  return CLUSTER_PALETTE[index % CLUSTER_PALETTE.length];
}

export function resolveCluster(
  groups?: string[],
  clusters: string[] = DEFAULT_CLUSTERS,
): Cluster {
  const raw = groups?.[1]?.trim().toLowerCase();
  if (!raw) return NON_CLUSTER;
  return clusters.find((c) => c.toLowerCase() === raw) ?? NON_CLUSTER;
}

export function effectiveGroups(path: OkrNode[]): string[] {
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i].groups?.length) return path[i].groups!;
  }
  return [];
}
