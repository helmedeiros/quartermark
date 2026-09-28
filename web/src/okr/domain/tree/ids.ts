import type { OkrNode, OkrNodeType, Quarter } from "../model";

const TOP_LEVEL_ID_PREFIX: Record<OkrNodeType, string> = {
  objective: "O",
  key_result: "KR",
  milestone: "M",
};

function nextTopLevelId(allObjectives: OkrNode[][], type: OkrNodeType): string {
  const prefix = TOP_LEVEL_ID_PREFIX[type];
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const objectives of allObjectives) {
    for (const o of objectives) {
      const m = pattern.exec(o.id);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  return `${prefix}-${max + 1}`;
}

function nextObjectiveId(allObjectives: OkrNode[][]): string {
  let max = 0;
  const scan = (nodes: OkrNode[]) => {
    for (const n of nodes) {
      if (n.type === "objective") {
        const m = /^O-(\d+)$/.exec(n.id);
        if (m) max = Math.max(max, Number(m[1]));
      }
      if (n.children) scan(n.children);
    }
  };
  for (const objectives of allObjectives) scan(objectives);
  return `O-${max + 1}`;
}

function nextChildId(parent: OkrNode, childType: OkrNodeType): string {
  const base = `${parent.id}-${TOP_LEVEL_ID_PREFIX[childType]}`;
  let max = 0;
  for (const c of parent.children ?? []) {
    if (c.id.startsWith(base)) {
      const n = Number(c.id.slice(base.length));
      if (Number.isInteger(n) && n > max) max = n;
    }
  }
  return `${base}${max + 1}`;
}

export function nextIdFor(
  quarters: Quarter[],
  parentId: string | null,
  parent: OkrNode | null,
  type: OkrNodeType,
): string {
  const allObjectives = quarters.map((q) => q.objectives);
  if (type === "objective") return nextObjectiveId(allObjectives);
  if (parentId === null) return nextTopLevelId(allObjectives, type);
  return nextChildId(parent!, type);
}
