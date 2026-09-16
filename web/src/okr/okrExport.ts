import type { OkrNode, Quarter } from "./components/types";
import {
  DEFAULT_CLUSTERS,
  formatMetricValue,
  resolveCluster,
  STATUS_META,
} from "./okrTree/metadata";

// A row is keyed by column header, so the shape follows whatever columns
// the caller supplies rather than one fixed set.
export type ExportRow = Record<string, string>;

// Everything a column might want, computed once per objective so that
// twenty columns don't each re-walk the tree.
export interface ExportContext {
  node: OkrNode;
  index: number;
  quarterLabel: string;
  // The team's cluster vocabulary. Passed in rather than imported so the
  // exporter works for any team, not just one whose words match a
  // built-in list.
  clusters: string[];
  keyResults: OkrNode[];
  milestones: OkrNode[];
  actual: string;
  target: string;
}

export interface ExportColumn {
  header: string;
  width: number;
  value: (ctx: ExportContext) => string;
}

// The generic column set. An organisation whose planning vocabulary
// differs supplies its own instead of editing this one — see
// okrExportColumns.ts for the one this repo actually exports with.
export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  { header: "#", width: 4, value: (c) => String(c.index + 1) },
  { header: "Quarter", width: 10, value: (c) => c.quarterLabel },
  {
    header: "Cluster",
    width: 16,
    value: (c) => resolveCluster(c.node.groups, c.clusters),
  },
  { header: "Objective", width: 32, value: (c) => c.node.title },
  {
    header: "Key Results",
    width: 34,
    value: (c) => formatKeyResults(c.keyResults),
  },
  { header: "Actual", width: 10, value: (c) => c.actual },
  { header: "Target", width: 10, value: (c) => c.target },
  {
    header: "Details",
    width: 60,
    value: (c) => buildDetails(c.node, c.milestones),
  },
  {
    header: "Status",
    width: 12,
    value: (c) => STATUS_META[c.node.status].label,
  },
  {
    header: "Allocation",
    width: 12,
    value: (c) =>
      c.node.allocation !== undefined ? String(c.node.allocation) : "",
  },
];

const MILESTONE_ICON: Record<string, string> = {
  done: "✅",
  on_track: "🟡",
  at_risk: "🔴",
  off_track: "🔴",
};

function stripMarkdownForExport(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^#{1,6}\s*/, ""))
    .join("\n")
    .replace(/\*\*(.+?)\*\*/g, "$1");
}

function collectKeyResults(node: OkrNode): OkrNode[] {
  return (node.children ?? []).filter((c) => c.type === "key_result");
}

function collectMilestones(node: OkrNode): OkrNode[] {
  const out: OkrNode[] = [];
  const walk = (n: OkrNode) => {
    for (const c of n.children ?? []) {
      if (c.type === "milestone") out.push(c);
      walk(c);
    }
  };
  walk(node);
  return out;
}

function formatMilestoneLine(m: OkrNode): string {
  const icon = MILESTONE_ICON[m.status] ?? "⚪";
  const jira = m.jiraKeys?.length ? ` [${m.jiraKeys.join(", ")}]` : "";
  return `${icon} ${m.title}${jira}`;
}

export function buildDetails(node: OkrNode, milestones: OkrNode[]): string {
  const parts: string[] = [];
  if (node.description) parts.push(stripMarkdownForExport(node.description));
  if (milestones.length) {
    parts.push(
      "Milestones:\n" + milestones.map(formatMilestoneLine).join("\n"),
    );
  }
  return parts.join("\n\n");
}

function buildContext(
  node: OkrNode,
  index: number,
  quarterLabel: string,
  clusters: string[],
): ExportContext {
  const keyResults = collectKeyResults(node);
  const milestones = collectMilestones(node);

  // The first key result that carries a metric stands in for the
  // objective's headline number; objectives often have several key
  // results but only one is the number people quote.
  const withMetric = keyResults.find(
    (k) => k.current !== undefined || k.target !== undefined,
  );
  const format = (v: number | undefined) =>
    v !== undefined && withMetric
      ? formatMetricValue(withMetric.metricType, v, withMetric.unit)
      : "";

  return {
    node,
    index,
    quarterLabel,
    clusters,
    keyResults,
    milestones,
    actual: format(withMetric?.current),
    target: format(withMetric?.target),
  };
}

export function formatKeyResults(keyResults: OkrNode[]): string {
  return keyResults.map((k) => k.title).join("; ");
}

export function buildExportRows(
  quarter: Quarter,
  columns: ExportColumn[] = DEFAULT_EXPORT_COLUMNS,
  clusters: string[] = DEFAULT_CLUSTERS,
): ExportRow[] {
  return quarter.objectives.map((node, index) => {
    const ctx = buildContext(node, index, quarter.label, clusters);
    const row: ExportRow = {};
    for (const column of columns) {
      row[column.header] = column.value(ctx);
    }
    return row;
  });
}

export interface ClusterAllocationRow {
  cluster: string;
  totalAllocation: number;
  objectives: string;
}

export function buildClusterAllocationRows(
  quarter: Quarter,
  clusters: string[] = DEFAULT_CLUSTERS,
): ClusterAllocationRow[] {
  const byCluster = new Map<string, { total: number; objs: string[] }>();
  for (const o of quarter.objectives) {
    const cluster = resolveCluster(o.groups, clusters);
    const alloc = o.allocation ?? 0;
    const entry = byCluster.get(cluster) ?? { total: 0, objs: [] };
    entry.total += alloc;
    entry.objs.push(
      `${o.title} (${o.allocation !== undefined ? `${o.allocation}%` : "unset"})`,
    );
    byCluster.set(cluster, entry);
  }
  return [...byCluster.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cluster, { total, objs }]) => ({
      cluster,
      totalAllocation: total,
      objectives: objs.join(", "),
    }));
}

// Re-exported so a caller supplying its own column set can build the
// same cells the default ones do without reaching into the module.
export { resolveCluster, STATUS_META } from "./okrTree/metadata";
