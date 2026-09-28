import { describe, expect, it } from "vitest";
import type { OkrNode } from "../model";
import { removeNodeWithHistory } from "./mutations";

function tree(): OkrNode[] {
  return [
    {
      id: "O-1",
      type: "objective",
      title: "Objective",
      status: "on_track",
      progress: 0,
      children: [
        {
          id: "O-1-KR1",
          type: "key_result",
          title: "KR one",
          status: "on_track",
          progress: 50,
          children: [
            {
              id: "O-1-KR1-M1",
              type: "milestone",
              title: "Milestone one",
              status: "done",
              progress: 100,
            },
            {
              id: "O-1-KR1-M2",
              type: "milestone",
              title: "Milestone two",
              status: "not_started",
              progress: 0,
            },
          ],
        },
      ],
    },
  ];
}

describe("removeNodeWithHistory", () => {
  it("removes the node itself", () => {
    const result = removeNodeWithHistory(tree(), "O-1-KR1-M2", "2026-09-23");
    const kr1 = result[0].children![0];
    expect(kr1.children!.map((c) => c.id)).toEqual(["O-1-KR1-M1"]);
  });

  it("logs a removal note on the immediate parent's updates, with the parent's post-removal effective progress", () => {
    const result = removeNodeWithHistory(tree(), "O-1-KR1-M2", "2026-09-23");
    const kr1 = result[0].children![0];
    expect(kr1.updates).toEqual([
      {
        date: "2026-09-23",
        status: "on_track",
        progress: 100,
        note: 'Removed Milestone O-1-KR1-M2 "Milestone two"',
      },
    ]);
  });

  it("does not touch other branches of the tree", () => {
    const result = removeNodeWithHistory(tree(), "O-1-KR1-M2", "2026-09-23");
    expect(result[0].updates).toBeUndefined();
  });

  it("is a no-op when removing a top-level objective (no parent to log on)", () => {
    const result = removeNodeWithHistory(tree(), "O-1", "2026-09-23");
    expect(result).toEqual([]);
  });

  it("appends to existing history rather than replacing it", () => {
    const withHistory = tree();
    withHistory[0].children![0].updates = [
      { date: "2026-09-01", status: "not_started", progress: 0 },
    ];
    const result = removeNodeWithHistory(
      withHistory,
      "O-1-KR1-M1",
      "2026-09-23",
    );
    expect(result[0].children![0].updates).toHaveLength(2);
  });
});
