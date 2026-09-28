import type { OkrNode, OkrNodeType, Quarter } from "../model";
import { nextIdFor } from "./ids";
import { TYPE_META } from "./metadata";
import { effectiveProgress, findNode, updateNode } from "./traversal";

function insertChildNode(
  nodes: OkrNode[],
  parentId: string | null,
  newNode: OkrNode,
): OkrNode[] {
  if (parentId === null) return [...nodes, newNode];
  return nodes.map((node) => {
    if (node.id === parentId) {
      return { ...node, children: [...(node.children ?? []), newNode] };
    }
    if (node.children) {
      return {
        ...node,
        children: insertChildNode(node.children, parentId, newNode),
      };
    }
    return node;
  });
}

export function addOkrNode(
  quarters: Quarter[],
  quarterId: string,
  parentId: string | null,
  type: OkrNodeType,
  title: string,
  extra?: Partial<OkrNode>,
): Quarter[] {
  const quarter = quarters.find((q) => q.quarterId === quarterId);
  if (!quarter) return quarters;

  const parent =
    parentId === null ? null : (findNode(quarter.objectives, parentId) ?? null);
  if (parentId !== null && !parent) return quarters;

  const id = nextIdFor(quarters, parentId, parent, type);

  const newNode: OkrNode = {
    status: "not_started",
    progress: 0,
    ...extra,
    id,
    type,
    title,
  };
  return quarters.map((q) =>
    q.quarterId === quarterId
      ? { ...q, objectives: insertChildNode(q.objectives, parentId, newNode) }
      : q,
  );
}

export function removeNode(nodes: OkrNode[], id: string): OkrNode[] {
  const kept: OkrNode[] = [];
  for (const node of nodes) {
    if (node.id === id) continue;
    kept.push(
      node.children
        ? { ...node, children: removeNode(node.children, id) }
        : node,
    );
  }
  return kept;
}

export function removeNodeWithHistory(
  nodes: OkrNode[],
  id: string,
  date: string,
): OkrNode[] {
  const target = findNode(nodes, id);
  const parent = findParentNode(nodes, id);
  const afterRemoval = removeNode(nodes, id);
  if (!target || !parent) return afterRemoval;

  return updateNode(afterRemoval, parent.id, (p) => ({
    ...p,
    updates: [
      ...(p.updates ?? []),
      {
        date,
        status: p.status,
        progress: effectiveProgress(p),
        note: `Removed ${TYPE_META[target.type].label} ${target.id} "${target.title}"`,
      },
    ],
  }));
}

function subtreeContains(node: OkrNode, id: string): boolean {
  if (node.id === id) return true;
  return (node.children ?? []).some((c) => subtreeContains(c, id));
}

export function findParentNode(nodes: OkrNode[], id: string): OkrNode | null {
  for (const n of nodes) {
    if (n.children?.some((c) => c.id === id)) return n;
    if (n.children) {
      const found = findParentNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

function parentAccepts(
  parentType: OkrNodeType | null,
  childType: OkrNodeType,
): boolean {
  if (childType === "objective") {
    return parentType === null || parentType === "objective";
  }
  if (childType === "key_result") {
    return parentType === null || parentType === "objective";
  }
  return (
    parentType === null ||
    parentType === "objective" ||
    parentType === "key_result"
  );
}

export function canDropOkrNode(
  objectives: OkrNode[],
  draggedId: string,
  targetId: string,
  position: "before" | "after" | "onto",
): boolean {
  if (draggedId === targetId) return false;
  const dragged = findNode(objectives, draggedId);
  const target = findNode(objectives, targetId);
  if (!dragged || !target) return false;
  if (subtreeContains(dragged, targetId)) return false;

  if (position === "onto") {
    return parentAccepts(target.type, dragged.type);
  }
  const targetParent = findParentNode(objectives, targetId);
  return parentAccepts(targetParent?.type ?? null, dragged.type);
}

function extractNode(
  nodes: OkrNode[],
  id: string,
): { rest: OkrNode[]; found: OkrNode | null } {
  let found: OkrNode | null = null;
  const rest: OkrNode[] = [];
  for (const node of nodes) {
    if (node.id === id) {
      found = node;
      continue;
    }
    if (node.children) {
      const nested = extractNode(node.children, id);
      if (nested.found) {
        found = nested.found;
        rest.push({ ...node, children: nested.rest });
        continue;
      }
    }
    rest.push(node);
  }
  return { rest, found };
}

export function reparentNode(
  nodes: OkrNode[],
  id: string,
  newParentId: string | null,
): OkrNode[] {
  const { rest, found } = extractNode(nodes, id);
  if (!found) return nodes;
  return insertChildNode(rest, newParentId, found);
}

function insertRelativeTo(
  nodes: OkrNode[],
  targetId: string,
  position: "before" | "after",
  newNode: OkrNode,
): OkrNode[] {
  const idx = nodes.findIndex((n) => n.id === targetId);
  if (idx !== -1) {
    const copy = [...nodes];
    copy.splice(position === "before" ? idx : idx + 1, 0, newNode);
    return copy;
  }
  return nodes.map((n) =>
    n.children
      ? {
          ...n,
          children: insertRelativeTo(n.children, targetId, position, newNode),
        }
      : n,
  );
}

export function moveNodeRelativeTo(
  nodes: OkrNode[],
  id: string,
  targetId: string,
  position: "before" | "after",
): OkrNode[] {
  const { rest, found } = extractNode(nodes, id);
  if (!found) return nodes;
  return insertRelativeTo(rest, targetId, position, found);
}
