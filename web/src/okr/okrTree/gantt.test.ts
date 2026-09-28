import { describe, expect, it } from "vitest";
import type { Quarter } from "../components/types";
import {
  jiraEpicGanttRows,
  milestoneGanttRows,
  objectiveColor,
  objectiveGanttGroups,
  objectiveGanttRows,
  sprintGanttBars,
} from "./gantt";

const quarter: Quarter = {
  quarterId: "2026-q4",
  label: "Q4 2026",
  startDate: "2026-10-01",
  endDate: "2026-12-31",
  objectives: [
    {
      id: "O-1",
      type: "objective",
      title: "First objective",
      status: "on_track",
      progress: 0,
      children: [
        {
          id: "O-1-M1",
          type: "milestone",
          title: "Has its own dates",
          status: "not_started",
          progress: 0,
          startDate: "2026-10-05",
          dueDate: "2026-10-20",
        },
        {
          id: "O-1-M2",
          type: "milestone",
          title: "Falls back to linked Jira due date",
          status: "not_started",
          progress: 0,
          jiraKeys: ["PROJ-1"],
          jiraIssues: {
            "PROJ-1": {
              summary: "Ship it",
              issueType: "Epic",
              dueDate: "2026-11-15",
            },
          },
        },
        {
          id: "O-1-M3",
          type: "milestone",
          title: "Falls back to the objective's own dates",
          status: "not_started",
          progress: 0,
        },
        {
          id: "O-1-KR1",
          type: "key_result",
          title: "A KR",
          status: "not_started",
          progress: 0,
          jiraKeys: ["PROJ-1"],
          jiraIssues: {
            "PROJ-1": {
              summary: "Ship it",
              issueType: "Epic",
              dueDate: "2026-11-15",
            },
          },
          children: [
            {
              id: "O-1-KR1-M1",
              type: "milestone",
              title: "Nested under a KR",
              status: "not_started",
              progress: 0,
            },
          ],
        },
      ],
    },
    {
      id: "O-2",
      type: "objective",
      title: "Second objective",
      status: "not_started",
      progress: 0,
      jiraKeys: ["PROJ-2", "PROJ-3"],
      jiraIssues: {
        "PROJ-2": {
          summary: "Not an epic",
          issueType: "Story",
          dueDate: "2026-11-01",
        },
        "PROJ-3": { summary: "No due date yet", issueType: "Epic" },
      },
    },
  ],
};

describe("objectiveGanttRows", () => {
  it("emits one row per objective, falling back to the quarter's dates when unset", () => {
    const rows = objectiveGanttRows(quarter, "demo-squad");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      label: "O-1 First objective",
      start: new Date("2026-10-01"),
      end: new Date("2026-12-31"),
      category: "Objective",
      color: objectiveColor(quarter, "O-1"),
      link: "/t/demo-squad/okrs/2026-q4/O-1",
      data: "O-1",
    });
  });

  it("gives each objective a distinct, stable color", () => {
    const rows = objectiveGanttRows(quarter, "demo-squad");
    expect(rows[0].color).not.toBe(rows[1].color);
    expect(rows[0].color).toBe(objectiveColor(quarter, "O-1"));
    expect(rows[1].color).toBe(objectiveColor(quarter, "O-2"));
  });
});

describe("milestoneGanttRows", () => {
  const rows = milestoneGanttRows(quarter, "demo-squad");

  it("collects milestones recursively, including ones nested under a KR", () => {
    expect(rows.map((r) => r.label)).toEqual([
      "O-1-M1 Has its own dates",
      "O-1-M2 Falls back to linked Jira due date",
      "O-1-M3 Falls back to the objective's own dates",
      "O-1-KR1-M1 Nested under a KR",
    ]);
  });

  it("uses the milestone's own dates when set", () => {
    expect(rows[0].start).toEqual(new Date("2026-10-05"));
    expect(rows[0].end).toEqual(new Date("2026-10-20"));
  });

  it("falls back to the first linked Jira issue's due date, anchored at the objective's start", () => {
    expect(rows[1].start).toEqual(new Date("2026-10-01"));
    expect(rows[1].end).toEqual(new Date("2026-11-15"));
  });

  it("falls back to the parent objective's own effective date range otherwise", () => {
    expect(rows[2].start).toEqual(new Date("2026-10-01"));
    expect(rows[2].end).toEqual(new Date("2026-12-31"));
  });

  it("a milestone nested under a KR still falls back through its ancestor objective", () => {
    expect(rows[3].start).toEqual(new Date("2026-10-01"));
    expect(rows[3].end).toEqual(new Date("2026-12-31"));
  });

  it("colors every milestone with its parent objective's color, not its own", () => {
    const objectiveOneColor = objectiveColor(quarter, "O-1");
    for (const row of rows) {
      expect(row.color).toBe(objectiveOneColor);
    }
  });
});

describe("objectiveGanttGroups", () => {
  it("groups each objective with its own milestones, in objective order", () => {
    const groups = objectiveGanttGroups(quarter, "demo-squad");
    expect(groups.map((g) => g.objectiveId)).toEqual(["O-1", "O-2"]);
    expect(groups[0].objective.label).toBe("O-1 First objective");
    expect(groups[0].milestones.map((m) => m.label)).toEqual([
      "O-1-M1 Has its own dates",
      "O-1-M2 Falls back to linked Jira due date",
      "O-1-M3 Falls back to the objective's own dates",
      "O-1-KR1-M1 Nested under a KR",
    ]);
    expect(groups[1].objective.label).toBe("O-2 Second objective");
    expect(groups[1].milestones).toEqual([]);
  });

  it("gives an objective's group the same color on the objective row and every milestone row", () => {
    const groups = objectiveGanttGroups(quarter, "demo-squad");
    const objectiveOneColor = objectiveColor(quarter, "O-1");
    expect(groups[0].objective.color).toBe(objectiveOneColor);
    for (const milestone of groups[0].milestones) {
      expect(milestone.color).toBe(objectiveOneColor);
    }
  });

  it("carries each node's own status and a kind tag distinguishing objectives from milestones", () => {
    const groups = objectiveGanttGroups(quarter, "demo-squad");
    expect(groups[0].objective.status).toBe("on_track");
    expect(groups[0].objective.kind).toBe("objective");
    expect(groups[0].milestones[0].status).toBe("not_started");
    expect(groups[0].milestones[0].kind).toBe("milestone");
  });

  it("carries each bar's own node id, for identifying which node to update on a drag", () => {
    const groups = objectiveGanttGroups(quarter, "demo-squad");
    expect(groups[0].objective.id).toBe("O-1");
    expect(groups[0].milestones[0].id).toBe("O-1-M1");
  });
});

describe("jiraEpicGanttRows", () => {
  it("keeps only Epic-typed issues that have a due date", () => {
    const rows = jiraEpicGanttRows(quarter, "https://example.atlassian.net");
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("PROJ-1 Ship it");
    expect(labels.some((l) => l.startsWith("PROJ-2"))).toBe(false);
    expect(labels.some((l) => l.startsWith("PROJ-3"))).toBe(false);
  });

  it("dedupes an epic linked from more than one node", () => {
    const rows = jiraEpicGanttRows(quarter, "https://example.atlassian.net");
    expect(rows.filter((r) => r.label.startsWith("PROJ-1"))).toHaveLength(1);
  });

  it("anchors the epic's start at the linking node's effective start", () => {
    const rows = jiraEpicGanttRows(quarter, "https://example.atlassian.net");
    const proj1 = rows.find((r) => r.label.startsWith("PROJ-1"))!;
    expect(proj1.end).toEqual(new Date("2026-11-15"));
    expect(proj1.link).toBe("https://example.atlassian.net/browse/PROJ-1");
  });
});

describe("sprintGanttBars", () => {
  const sprintQuarter: Quarter = {
    quarterId: "2026-q4",
    label: "Q4 2026",
    startDate: "2026-10-01",
    endDate: "2026-12-31",
    objectives: [
      {
        id: "O-1",
        type: "objective",
        title: "First objective",
        status: "on_track",
        progress: 0,
        children: [
          {
            id: "O-1-M1",
            type: "milestone",
            title: "Linked to a dated sprint, twice",
            status: "not_started",
            progress: 0,
            jiraKeys: ["PROJ-1", "PROJ-2"],
            jiraIssues: {
              "PROJ-1": {
                summary: "Ship it",
                sprints: [
                  {
                    name: "OG Sprint 41",
                    startDate: "2026-08-31",
                    endDate: "2026-09-14",
                  },
                ],
              },
              "PROJ-2": {
                summary: "Ship it too",
                sprints: [
                  {
                    name: "OG Sprint 41",
                    startDate: "2026-08-31",
                    endDate: "2026-09-14",
                  },
                  { name: "OG Sprint 42" },
                ],
              },
            },
          },
        ],
      },
    ],
  };

  it("collects one bar per sprint, deduped by name, skipping sprints without a full date range", () => {
    const narrowWindow = {
      start: new Date("2026-08-31"),
      end: new Date("2026-09-13"),
    };
    const bars = sprintGanttBars(sprintQuarter, narrowWindow);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toEqual({
      name: "OG Sprint 41",
      start: new Date("2026-08-31"),
      end: new Date("2026-09-14"),
      isProjected: false,
    });
  });

  it("projects sprints forward and backward from the real ones to fill a wider window", () => {
    const wideWindow = {
      start: new Date("2026-08-01"),
      end: new Date("2026-10-15"),
    };
    const bars = sprintGanttBars(sprintQuarter, wideWindow);
    expect(bars.some((b) => !b.isProjected)).toBe(true);
    expect(bars.some((b) => b.isProjected)).toBe(true);
    for (const bar of bars) {
      expect(bar.start.getTime() >= wideWindow.start.getTime()).toBe(true);
      expect(bar.start.getTime() <= wideWindow.end.getTime()).toBe(true);
    }
    const projectedForward = bars.find(
      (b) =>
        b.isProjected && b.start.getTime() === new Date("2026-09-14").getTime(),
    );
    expect(projectedForward).toBeDefined();
    expect(projectedForward!.name).toContain("projected");
  });

  it("returns nothing when there are no real sprints to anchor a projection on", () => {
    const noSprintQuarter: Quarter = {
      quarterId: "2026-q4",
      label: "Q4 2026",
      startDate: "2026-10-01",
      endDate: "2026-12-31",
      objectives: [],
    };
    const bars = sprintGanttBars(noSprintQuarter, {
      start: new Date("2026-10-01"),
      end: new Date("2026-12-31"),
    });
    expect(bars).toEqual([]);
  });
});
