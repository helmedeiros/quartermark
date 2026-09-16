import type { OkrNode, OkrUpdate, Quarter } from "../components/types";

export interface FlatOkrRow {
  node: OkrNode;
  depth: number;
  hasChildren: boolean;
  groups: string[];
  jiraKey?: string;
}

function matches(node: OkrNode, query: string): boolean {
  const q = query.toLowerCase();
  return (
    node.title.toLowerCase().includes(q) || node.id.toLowerCase().includes(q)
  );
}

function subtreeMatches(node: OkrNode, query: string): boolean {
  if (!query) return true;
  if (matches(node, query)) return true;
  return (node.children ?? []).some((c) => subtreeMatches(c, query));
}

export function flattenVisible(
  nodes: OkrNode[],
  expanded: Set<string>,
  query = "",
  depth = 0,
  parentGroups: string[] = [],
): FlatOkrRow[] {
  const rows: FlatOkrRow[] = [];
  for (const node of nodes) {
    if (!subtreeMatches(node, query)) continue;
    const groups = node.groups?.length ? node.groups : parentGroups;
    const hasChildren = !!node.children?.length || !!node.jiraKeys?.length;
    rows.push({ node, depth, hasChildren, groups });
    const forceOpen = !!query && subtreeMatches(node, query);
    if (hasChildren && (expanded.has(node.id) || forceOpen)) {
      if (node.children?.length) {
        rows.push(
          ...flattenVisible(node.children, expanded, query, depth + 1, groups),
        );
      }
      for (const jiraKey of node.jiraKeys ?? []) {
        rows.push({
          node,
          depth: depth + 1,
          hasChildren: false,
          groups,
          jiraKey,
        });
      }
    }
  }
  return rows;
}

export function findNode(nodes: OkrNode[], id: string): OkrNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = node.children && findNode(node.children, id);
    if (found) return found;
  }
  return undefined;
}

export function findPath(nodes: OkrNode[], id: string): OkrNode[] | undefined {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const childPath = node.children && findPath(node.children, id);
    if (childPath) return [node, ...childPath];
  }
  return undefined;
}

export function sortedUpdates(node: OkrNode): OkrUpdate[] {
  return [...(node.updates ?? [])].sort((a, b) => a.date.localeCompare(b.date));
}

export function latestUpdate(node: OkrNode): OkrUpdate | undefined {
  const updates = sortedUpdates(node);
  return updates[updates.length - 1];
}

export function countNodes(nodes: OkrNode[]): number {
  return nodes.reduce(
    (sum, n) => sum + 1 + (n.children ? countNodes(n.children) : 0),
    0,
  );
}

export function updateNode(
  nodes: OkrNode[],
  id: string,
  updater: (node: OkrNode) => OkrNode,
): OkrNode[] {
  return nodes.map((node) => {
    if (node.id === id) return updater(node);
    if (node.children) {
      return { ...node, children: updateNode(node.children, id, updater) };
    }
    return node;
  });
}

export function sortedNotes(node: OkrNode) {
  return [...(node.notes ?? [])].sort((a, b) => b.date.localeCompare(a.date));
}

export function contributesToParentGrade(node: OkrNode): boolean {
  return node.contributesToParentGrade !== false;
}

export function hasContributingChildren(node: OkrNode): boolean {
  return !!node.children?.some(contributesToParentGrade);
}

export function effectiveProgress(node: OkrNode): number {
  if (node.progressMode === "manual") return node.progress;
  const contributing = (node.children ?? []).filter(contributesToParentGrade);
  if (!contributing.length) return node.progress;
  const values = contributing.map(effectiveProgress);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function objectiveAvgProgress(quarter: Quarter): number | null {
  if (!quarter.objectives.length) return null;
  const values = quarter.objectives.map(effectiveProgress);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function collectAcrossTree<T>(
  quarters: Quarter[],
  pick: (node: OkrNode) => T[],
): T[] {
  const seen = new Set<T>();
  const walk = (nodes: OkrNode[]) => {
    for (const node of nodes) {
      for (const value of pick(node)) seen.add(value);
      if (node.children) walk(node.children);
    }
  };
  for (const quarter of quarters) walk(quarter.objectives);
  return [...seen].sort();
}

export function collectOwners(quarters: Quarter[]): string[] {
  return collectAcrossTree(quarters, (n) => (n.owner ? [n.owner] : []));
}

export function collectLabels(quarters: Quarter[]): string[] {
  return collectAcrossTree(quarters, (n) => n.labels ?? []);
}
