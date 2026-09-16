import { describe, expect, it } from "vitest";
import type { OkrNode } from "../components/types";
import { effectiveProgress } from "./traversal";

describe("effectiveProgress", () => {
  it("returns the node's own progress when it has no children", () => {
    const node: OkrNode = {
      id: "O-1",
      type: "objective",
      title: "Leaf",
      status: "on_track",
      progress: 42,
    };
    expect(effectiveProgress(node)).toBe(42);
  });

  it("rolls up from contributing children when progressMode isn't manual", () => {
    const node: OkrNode = {
      id: "O-1",
      type: "objective",
      title: "Parent",
      status: "on_track",
      progress: 60,
      children: [
        {
          id: "O-1-KR1",
          type: "key_result",
          title: "KR",
          status: "on_track",
          progress: 20,
        },
      ],
    };
    expect(effectiveProgress(node)).toBe(20);
  });

  it("uses the node's own stored progress when progressMode is manual, even with contributing children", () => {
    const node: OkrNode = {
      id: "O-1",
      type: "objective",
      title: "Parent",
      status: "on_track",
      progress: 60,
      progressMode: "manual",
      children: [
        {
          id: "O-1-KR1",
          type: "key_result",
          title: "KR",
          status: "on_track",
          progress: 20,
        },
      ],
    };
    expect(effectiveProgress(node)).toBe(60);
  });
});
