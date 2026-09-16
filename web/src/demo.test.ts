import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { STATUS_META, type OkrNode, type Quarter } from "./okr";

// The demo dataset is the first thing anyone sees, and it is hand-written
// JSON that no compiler checks. A value outside the vocabulary does not
// degrade — STATUS_META[unknown] is undefined and the chart throws — so
// the fixture is validated here instead.
const demo = JSON.parse(
  readFileSync(resolve(process.cwd(), "../demo/okrs.json"), "utf8"),
) as { quarters: Quarter[] };

const METRIC_TYPES = new Set(["percent", "number", "currency", "boolean"]);
const NODE_TYPES = new Set(["objective", "key_result", "milestone"]);

function everyNode(quarters: Quarter[]): OkrNode[] {
  const out: OkrNode[] = [];
  const walk = (n: OkrNode) => {
    out.push(n);
    (n.children ?? []).forEach(walk);
  };
  quarters.forEach((q) => q.objectives.forEach(walk));
  return out;
}

describe("the demo dataset", () => {
  const nodes = everyNode(demo.quarters);

  it("uses only statuses the app can render", () => {
    const unknown = nodes
      .filter((n) => !(n.status in STATUS_META))
      .map((n) => `${n.id}: ${n.status}`);
    expect(unknown).toEqual([]);
  });

  it("uses only metric types the app can format", () => {
    const unknown = nodes
      .filter((n) => n.metricType && !METRIC_TYPES.has(n.metricType))
      .map((n) => `${n.id}: ${n.metricType}`);
    expect(unknown).toEqual([]);
  });

  it("uses only known node types", () => {
    const unknown = nodes
      .filter((n) => !NODE_TYPES.has(n.type))
      .map((n) => `${n.id}: ${n.type}`);
    expect(unknown).toEqual([]);
  });

  it("gives every node a unique id", () => {
    const ids = nodes.map((n) => n.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
});
