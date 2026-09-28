import { describe, expect, it } from "vitest";
import type { OkrNode } from "./model";
import {
  addOkrNode,
  allowedChildTypesFor,
  canDropOkrNode,
  collectLabels,
  collectOwners,
  contributesToParentGrade,
  currentNumberFor,
  effectiveProgress,
  flattenVisible,
  hasContributingChildren,
  moveNodeRelativeTo,
  objectiveAvgProgress,
  removeNode,
  reparentNode,
  targetNumberFor,
} from "./tree";

function node(
  id: string,
  type: OkrNode["type"],
  children?: OkrNode[],
): OkrNode {
  return { id, type, title: id, status: "not_started", progress: 0, children };
}

function fixture(): OkrNode[] {
  return [
    node("O-1", "objective", [
      node("O-1-KR1", "key_result", [node("O-1-KR1-M1", "milestone")]),
      node("O-1-M1", "milestone"),
    ]),
    node("O-2", "objective", [node("O-2-KR1", "key_result")]),
  ];
}

describe("canDropOkrNode", () => {
  it("allows a milestone to drop onto an objective or a key result", () => {
    const tree = fixture();
    expect(canDropOkrNode(tree, "O-1-M1", "O-2", "onto")).toBe(true);
    expect(canDropOkrNode(tree, "O-1-M1", "O-2-KR1", "onto")).toBe(true);
  });

  it("allows an objective to nest under another objective, but not under a KR/milestone", () => {
    const tree = fixture();
    expect(canDropOkrNode(tree, "O-2", "O-1", "onto")).toBe(true);
    expect(canDropOkrNode(tree, "O-2", "O-1-KR1", "onto")).toBe(false);
    expect(canDropOkrNode(tree, "O-2", "O-1-M1", "onto")).toBe(false);
  });

  it("never allows a key result to be dropped onto another key result", () => {
    const tree = fixture();
    expect(canDropOkrNode(tree, "O-2-KR1", "O-1-KR1", "onto")).toBe(false);
  });

  it("allows a KR to move before a top-level objective, staying top-level", () => {
    const tree = fixture();
    expect(canDropOkrNode(tree, "O-2-KR1", "O-1", "before")).toBe(true);
  });

  it("allows a KR to move before a milestone whose parent is an objective", () => {
    const tree = fixture();
    expect(canDropOkrNode(tree, "O-2-KR1", "O-1-M1", "before")).toBe(true);
  });

  it("rejects moving an objective before a milestone whose parent is a key result", () => {
    const tree = fixture();
    expect(canDropOkrNode(tree, "O-2", "O-1-KR1-M1", "before")).toBe(false);
  });

  it("rejects dropping a node onto or next to itself or its own subtree", () => {
    const tree = fixture();
    expect(canDropOkrNode(tree, "O-1", "O-1", "before")).toBe(false);
    expect(canDropOkrNode(tree, "O-1", "O-1-KR1", "onto")).toBe(false);
    expect(canDropOkrNode(tree, "O-1", "O-1-KR1-M1", "after")).toBe(false);
  });
});

describe("moveNodeRelativeTo", () => {
  it("reorders within the same siblings list", () => {
    const tree = fixture();
    const moved = moveNodeRelativeTo(tree, "O-2", "O-1", "before");
    expect(moved.map((n) => n.id)).toEqual(["O-2", "O-1"]);
  });

  it("reparents when the target lives under a different parent", () => {
    const tree = fixture();
    const moved = moveNodeRelativeTo(tree, "O-2-KR1", "O-1-M1", "after");
    const o1 = moved.find((n) => n.id === "O-1")!;
    expect(o1.children?.map((c) => c.id)).toEqual([
      "O-1-KR1",
      "O-1-M1",
      "O-2-KR1",
    ]);
    const o2 = moved.find((n) => n.id === "O-2")!;
    expect(o2.children ?? []).toEqual([]);
  });
});

describe("reparentNode", () => {
  it("appends the node as the target's last child", () => {
    const tree = fixture();
    const moved = reparentNode(tree, "O-1-M1", "O-2-KR1");
    const kr = moved
      .find((n) => n.id === "O-2")!
      .children!.find((c) => c.id === "O-2-KR1")!;
    expect(kr.children?.map((c) => c.id)).toEqual(["O-1-M1"]);
  });

  it("makes a node top-level when newParentId is null", () => {
    const tree = fixture();
    const moved = reparentNode(tree, "O-1-KR1-M1", null);
    expect(moved.map((n) => n.id)).toContain("O-1-KR1-M1");
  });

  it("nests an objective under another objective, keeping its own subtree", () => {
    const tree = fixture();
    const moved = reparentNode(tree, "O-2", "O-1");
    const o1 = moved.find((n) => n.id === "O-1")!;
    const nested = o1.children?.find((c) => c.id === "O-2");
    expect(nested?.type).toBe("objective");
    expect(nested?.children?.map((c) => c.id)).toEqual(["O-2-KR1"]);
    expect(moved.some((n) => n.id === "O-2")).toBe(false);
  });
});

describe("removeNode", () => {
  it("removes the node and its whole subtree", () => {
    const tree = fixture();
    const result = removeNode(tree, "O-1-KR1");
    const o1 = result.find((n) => n.id === "O-1")!;
    expect(o1.children?.map((c) => c.id)).toEqual(["O-1-M1"]);
  });
});

describe("addOkrNode", () => {
  it("numbers a new top-level node by its own type, not the objective sequence", () => {
    const quarters = [
      { quarterId: "2026-q1", label: "Q1 2026", objectives: fixture() },
    ];
    const result = addOkrNode(
      quarters,
      "2026-q1",
      null,
      "milestone",
      "New milestone",
    );
    const added = result[0].objectives.find((n) => n.title === "New milestone");
    expect(added?.id).toBe("M-1");
  });

  it("numbers a new child against its parent's existing children", () => {
    const quarters = [
      { quarterId: "2026-q1", label: "Q1 2026", objectives: fixture() },
    ];
    const result = addOkrNode(
      quarters,
      "2026-q1",
      "O-1",
      "key_result",
      "New KR",
    );
    const o1 = result[0].objectives.find((n) => n.id === "O-1")!;
    const added = o1.children?.find((c) => c.title === "New KR");
    expect(added?.id).toBe("O-1-KR2");
  });

  it("gives a nested objective a flat O-n id, scanning the whole tree for uniqueness", () => {
    const quarters = [
      { quarterId: "2026-q1", label: "Q1 2026", objectives: fixture() },
    ];
    const result = addOkrNode(
      quarters,
      "2026-q1",
      "O-1",
      "objective",
      "Sub-objective",
    );
    const o1 = result[0].objectives.find((n) => n.id === "O-1")!;
    const added = o1.children?.find((c) => c.title === "Sub-objective");
    expect(added?.id).toBe("O-3");
    expect(added?.type).toBe("objective");
  });

  it("merges extra fields onto the new node without letting them override id/type/title", () => {
    const quarters = [
      { quarterId: "2026-q1", label: "Q1 2026", objectives: fixture() },
    ];
    const result = addOkrNode(
      quarters,
      "2026-q1",
      "O-1",
      "key_result",
      "New KR",
      {
        description: "Why this matters",
        owner: "Jane Doe",
        groups: ["Atlas", "Keep the Lights On"],
        labels: ["urgent"],
        id: "hijacked",
        type: "milestone",
        title: "hijacked title",
      },
    );
    const o1 = result[0].objectives.find((n) => n.id === "O-1")!;
    const children = o1.children ?? [];
    const added = children.find((c) => c.title === "New KR")!;
    expect(added.id).toBe("O-1-KR2");
    expect(added.type).toBe("key_result");
    expect(added.title).toBe("New KR");
    expect(added.description).toBe("Why this matters");
    expect(added.owner).toBe("Jane Doe");
    expect(added.groups).toEqual(["Atlas", "Keep the Lights On"]);
    expect(added.labels).toEqual(["urgent"]);
  });

  it("lets extra.progress/metricType seed a key result's initial metric state", () => {
    const quarters = [
      { quarterId: "2026-q1", label: "Q1 2026", objectives: fixture() },
    ];
    const result = addOkrNode(
      quarters,
      "2026-q1",
      "O-1",
      "key_result",
      "New KR",
      { metricType: "number", target: 340, current: 300, progress: 88 },
    );
    const o1 = result[0].objectives.find((n) => n.id === "O-1")!;
    const added = (o1.children ?? []).find((c) => c.title === "New KR")!;
    expect(added.metricType).toBe("number");
    expect(added.target).toBe(340);
    expect(added.current).toBe(300);
    expect(added.progress).toBe(88);
    expect(added.status).toBe("not_started");
  });
});

describe("allowedChildTypesFor", () => {
  it("lets an objective take a nested objective, a KR, or a milestone", () => {
    expect(allowedChildTypesFor("objective")).toEqual([
      "objective",
      "key_result",
      "milestone",
    ]);
  });

  it("lets a key result take only a milestone", () => {
    expect(allowedChildTypesFor("key_result")).toEqual(["milestone"]);
  });

  it("treats a milestone as a leaf with no allowed children", () => {
    expect(allowedChildTypesFor("milestone")).toEqual([]);
  });
});

describe("flattenVisible", () => {
  it("treats jiraKeys as children: reports hasChildren and hides them until expanded", () => {
    const tree: OkrNode[] = [
      {
        ...node("O-1", "milestone"),
        jiraKeys: ["PROJ-1", "PROJ-2"],
      },
    ];
    const collapsed = flattenVisible(tree, new Set());
    expect(collapsed).toEqual([
      { node: tree[0], depth: 0, hasChildren: true, groups: [] },
    ]);

    const expanded = flattenVisible(tree, new Set(["O-1"]));
    expect(expanded).toHaveLength(3);
    expect(expanded[1]).toMatchObject({ depth: 1, jiraKey: "PROJ-1" });
    expect(expanded[2]).toMatchObject({ depth: 1, jiraKey: "PROJ-2" });
  });

  it("lists jiraKey rows after a node's real children", () => {
    const tree: OkrNode[] = [
      {
        ...node("O-1", "objective", [node("O-1-KR1", "key_result")]),
        jiraKeys: ["PROJ-1"],
      },
    ];
    const rows = flattenVisible(tree, new Set(["O-1"]));
    expect(rows.map((r) => r.jiraKey ?? r.node.id)).toEqual([
      "O-1",
      "O-1-KR1",
      "PROJ-1",
    ]);
  });
});

describe("collectOwners", () => {
  it("gathers unique owners across every quarter and depth, sorted", () => {
    const quarters = [
      {
        quarterId: "2026-q1",
        label: "Q1 2026",
        objectives: [
          {
            ...node("O-1", "objective", [
              { ...node("O-1-KR1", "key_result"), owner: "Ada Lovelace" },
            ]),
            owner: "Grace Hopper",
          },
        ],
      },
      {
        quarterId: "2026-q2",
        label: "Q2 2026",
        objectives: [{ ...node("O-2", "objective"), owner: "Grace Hopper" }],
      },
    ];
    expect(collectOwners(quarters)).toEqual(["Ada Lovelace", "Grace Hopper"]);
  });

  it("returns an empty list when nothing has an owner yet", () => {
    const quarters = [
      {
        quarterId: "2026-q1",
        label: "Q1 2026",
        objectives: [node("O-1", "objective")],
      },
    ];
    expect(collectOwners(quarters)).toEqual([]);
  });
});

describe("collectLabels", () => {
  it("gathers unique labels across every quarter and depth, sorted", () => {
    const quarters = [
      {
        quarterId: "2026-q1",
        label: "Q1 2026",
        objectives: [
          {
            ...node("O-1", "objective", [
              {
                ...node("O-1-KR1", "key_result"),
                labels: ["urgent", "backend"],
              },
            ]),
            labels: ["backend"],
          },
        ],
      },
    ];
    expect(collectLabels(quarters)).toEqual(["backend", "urgent"]);
  });
});

describe("targetNumberFor", () => {
  it("forces boolean targets to 1 regardless of input", () => {
    expect(targetNumberFor("boolean", "")).toBe(1);
    expect(targetNumberFor("boolean", "5")).toBe(1);
  });

  it("parses non-boolean targets, treating blank as unset", () => {
    expect(targetNumberFor("number", "100")).toBe(100);
    expect(targetNumberFor("percent", "")).toBeUndefined();
  });
});

describe("currentNumberFor", () => {
  it("parses a boolean current as 0 or 1", () => {
    expect(currentNumberFor("boolean", "1")).toBe(1);
    expect(currentNumberFor("boolean", "0")).toBe(0);
  });

  it("parses non-boolean currents, treating blank as unset", () => {
    expect(currentNumberFor("number", "42")).toBe(42);
    expect(currentNumberFor("currency", "")).toBeUndefined();
  });
});

describe("contributesToParentGrade", () => {
  it("defaults to true when unset", () => {
    expect(contributesToParentGrade(node("O-1", "objective"))).toBe(true);
  });

  it("is false only when explicitly set to false", () => {
    expect(
      contributesToParentGrade({
        ...node("O-1", "objective"),
        contributesToParentGrade: false,
      }),
    ).toBe(false);
    expect(
      contributesToParentGrade({
        ...node("O-1", "objective"),
        contributesToParentGrade: true,
      }),
    ).toBe(true);
  });
});

describe("hasContributingChildren / effectiveProgress", () => {
  it("falls back to the node's own progress when it has no children", () => {
    const leaf = { ...node("M-1", "milestone"), progress: 42 };
    expect(hasContributingChildren(leaf)).toBe(false);
    expect(effectiveProgress(leaf)).toBe(42);
  });

  it("falls back to the node's own progress when no child contributes", () => {
    const parent = {
      ...node("KR-1", "key_result"),
      progress: 55,
      children: [
        {
          ...node("KR-1-M1", "milestone"),
          progress: 10,
          contributesToParentGrade: false,
        },
      ],
    };
    expect(hasContributingChildren(parent)).toBe(false);
    expect(effectiveProgress(parent)).toBe(55);
  });

  it("averages contributing children's progress, excluding non-contributing ones", () => {
    const parent = {
      ...node("KR-1", "key_result"),
      progress: 999,
      children: [
        { ...node("KR-1-M1", "milestone"), progress: 100 },
        { ...node("KR-1-M2", "milestone"), progress: 0 },
        {
          ...node("KR-1-M3", "milestone"),
          progress: 1000,
          contributesToParentGrade: false,
        },
      ],
    };
    expect(hasContributingChildren(parent)).toBe(true);
    expect(effectiveProgress(parent)).toBe(50);
  });

  it("recurses through multiple levels", () => {
    const tree = {
      ...node("O-1", "objective"),
      progress: 999,
      children: [
        {
          ...node("O-1-KR1", "key_result"),
          progress: 999,
          children: [
            { ...node("O-1-KR1-M1", "milestone"), progress: 20 },
            { ...node("O-1-KR1-M2", "milestone"), progress: 40 },
          ],
        },
        { ...node("O-1-KR2", "key_result"), progress: 60 },
      ],
    };
    expect(effectiveProgress(tree)).toBe(45);
  });
});

describe("objectiveAvgProgress", () => {
  it("uses each objective's effective (rolled-up) progress, not its raw stored value", () => {
    const quarter = {
      quarterId: "2026-q1",
      label: "Q1 2026",
      objectives: [
        {
          ...node("O-1", "objective"),
          progress: 999,
          children: [
            { ...node("O-1-KR1", "key_result"), progress: 100 },
            { ...node("O-1-KR1", "key_result"), progress: 0 },
          ],
        },
      ],
    };
    expect(objectiveAvgProgress(quarter)).toBe(50);
  });
});
