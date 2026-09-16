import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { objectiveGanttGroups, sprintGanttBars } from "../okrTree";
import { OkrGanttChart } from "./OkrGanttChart";
import type { Quarter } from "./types";

const quarter: Quarter = {
  quarterId: "2026-q4",
  label: "Q4 2026",
  startDate: "2026-10-01",
  endDate: "2026-10-31",
  objectives: [
    {
      id: "O-1",
      type: "objective",
      title: "Objective one",
      status: "on_track",
      progress: 0,
      children: [
        {
          id: "O-1-M1",
          type: "milestone",
          title: "Milestone one",
          status: "not_started",
          progress: 0,
          startDate: "2026-10-05",
          dueDate: "2026-10-12",
        },
      ],
    },
  ],
};

const dateWindow = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) };

// Mirrors OkrGanttChart's own day-granularity width math for this exact
// window (31 days), so a drag distance maps to a precise, non-ambiguous
// number of days when rounded — this is what the component itself computes
// internally, duplicated here only so the test can pick an exact pixel
// delta rather than guessing at rounding boundaries.
const WIDTH = Math.max(720, 31 * 22);
const DAY_WIDTH = WIDTH / 31;

const WEEK_WIDTH = DAY_WIDTH * 7;

const quarterWithSprint: Quarter = {
  quarterId: "2026-q4",
  label: "Q4 2026",
  startDate: "2026-10-01",
  endDate: "2026-10-31",
  objectives: [
    {
      id: "O-1",
      type: "objective",
      title: "Objective one",
      status: "on_track",
      progress: 0,
      children: [
        {
          id: "O-1-M1",
          type: "milestone",
          title: "Milestone one",
          status: "not_started",
          progress: 0,
          startDate: "2026-10-05",
          dueDate: "2026-10-12",
          jiraKeys: ["PROJ-1"],
          jiraIssues: {
            "PROJ-1": {
              summary: "linked issue",
              sprints: [
                {
                  name: "Sprint A",
                  startDate: "2026-10-01",
                  endDate: "2026-10-14",
                },
              ],
            },
          },
        },
      ],
    },
  ],
};

function renderChart({
  onMoveMilestone = vi.fn(),
  onResizeMilestone = vi.fn(),
} = {}) {
  const groups = objectiveGanttGroups(quarter, "demo-squad");
  render(
    <OkrGanttChart
      quarter={quarter}
      groups={groups}
      sprints={sprintGanttBars(quarter, dateWindow)}
      dateWindow={dateWindow}
      granularity="day"
      onMoveMilestone={onMoveMilestone}
      onResizeMilestone={onResizeMilestone}
    />,
  );
  return { onMoveMilestone, onResizeMilestone };
}

describe("OkrGanttChart milestone drag", () => {
  it("shifts both dates by the number of whole days dragged", () => {
    const onMoveMilestone = vi.fn();
    renderChart({ onMoveMilestone });
    const bar = screen.getByTestId("gantt-bar-O-1-M1");

    fireEvent.pointerDown(bar, { clientX: 0 });
    fireEvent.pointerMove(bar, { clientX: DAY_WIDTH * 3 });
    fireEvent.pointerUp(bar);

    expect(onMoveMilestone).toHaveBeenCalledTimes(1);
    expect(onMoveMilestone).toHaveBeenCalledWith(
      "O-1-M1",
      "2026-10-08", // 2026-10-05 + 3 days
      "2026-10-15", // 2026-10-12 + 3 days
    );
  });

  it("shifts dates backward when dragged left", () => {
    const onMoveMilestone = vi.fn();
    renderChart({ onMoveMilestone });
    const bar = screen.getByTestId("gantt-bar-O-1-M1");

    fireEvent.pointerDown(bar, { clientX: 200 });
    fireEvent.pointerMove(bar, { clientX: 200 - DAY_WIDTH * 2 });
    fireEvent.pointerUp(bar);

    expect(onMoveMilestone).toHaveBeenCalledWith(
      "O-1-M1",
      "2026-10-03",
      "2026-10-10",
    );
  });

  it("does not move the milestone for a tiny drag within the click threshold", () => {
    const onMoveMilestone = vi.fn();
    renderChart({ onMoveMilestone });
    const bar = screen.getByTestId("gantt-bar-O-1-M1");

    fireEvent.pointerDown(bar, { clientX: 0 });
    fireEvent.pointerMove(bar, { clientX: 2 });
    fireEvent.pointerUp(bar);

    expect(onMoveMilestone).not.toHaveBeenCalled();
  });

  it("lets a real click through (does not prevent default) when there was no drag", () => {
    renderChart();
    const bar = screen.getByTestId("gantt-bar-O-1-M1");
    const notPrevented = fireEvent.click(bar);
    expect(notPrevented).toBe(true);
  });

  it("suppresses the click's default action after a real drag, so it doesn't also navigate", () => {
    const onMoveMilestone = vi.fn();
    renderChart({ onMoveMilestone });
    const bar = screen.getByTestId("gantt-bar-O-1-M1");

    fireEvent.pointerDown(bar, { clientX: 0 });
    fireEvent.pointerMove(bar, { clientX: DAY_WIDTH * 3 });
    fireEvent.pointerUp(bar);
    const notPrevented = fireEvent.click(bar);

    expect(notPrevented).toBe(false);
  });
});

describe("OkrGanttChart milestone resize", () => {
  it("grows the due date by whole weeks when the right handle is dragged right", () => {
    const { onResizeMilestone } = renderChart();
    const handle = screen.getByTestId("gantt-bar-O-1-M1-resize-end");

    fireEvent.pointerDown(handle, { clientX: 0 });
    fireEvent.pointerMove(handle, { clientX: WEEK_WIDTH * 2 });
    fireEvent.pointerUp(handle);

    // 1 week (the fixture's own span) + 2 weeks dragged = 3 weeks
    expect(onResizeMilestone).toHaveBeenCalledWith(
      "O-1-M1",
      "2026-10-05",
      "2026-10-26",
      3,
    );
  });

  it("clamps the right handle so it never shrinks below one week", () => {
    const { onResizeMilestone } = renderChart();
    const handle = screen.getByTestId("gantt-bar-O-1-M1-resize-end");

    fireEvent.pointerDown(handle, { clientX: 0 });
    fireEvent.pointerMove(handle, { clientX: -WEEK_WIDTH * 5 });
    fireEvent.pointerUp(handle);

    expect(onResizeMilestone).toHaveBeenCalledWith(
      "O-1-M1",
      "2026-10-05",
      "2026-10-12",
      1,
    );
  });

  it("pushes the start date earlier by whole weeks when the left handle is dragged left", () => {
    const { onResizeMilestone } = renderChart();
    const handle = screen.getByTestId("gantt-bar-O-1-M1-resize-start");

    fireEvent.pointerDown(handle, { clientX: 0 });
    fireEvent.pointerMove(handle, { clientX: -WEEK_WIDTH });
    fireEvent.pointerUp(handle);

    // dragging the start handle left grows the milestone by a week
    expect(onResizeMilestone).toHaveBeenCalledWith(
      "O-1-M1",
      "2026-09-28",
      "2026-10-12",
      2,
    );
  });

  it("does not move or resize when dragging one handle, only the other end", () => {
    const { onMoveMilestone, onResizeMilestone } = renderChart();
    const handle = screen.getByTestId("gantt-bar-O-1-M1-resize-end");

    fireEvent.pointerDown(handle, { clientX: 0 });
    fireEvent.pointerMove(handle, { clientX: WEEK_WIDTH });
    fireEvent.pointerUp(handle);

    expect(onMoveMilestone).not.toHaveBeenCalled();
    const [, startDate] = onResizeMilestone.mock.calls[0];
    expect(startDate).toBe("2026-10-05"); // start untouched
  });
});

describe("OkrGanttChart milestone move — sprint alignment", () => {
  it("snaps the moved start to the nearest sprint start (real or projected), preserving duration", () => {
    const onMoveMilestone = vi.fn();
    const groups = objectiveGanttGroups(quarterWithSprint, "demo-squad");
    render(
      <OkrGanttChart
        quarter={quarterWithSprint}
        groups={groups}
        sprints={sprintGanttBars(quarterWithSprint, dateWindow)}
        dateWindow={dateWindow}
        granularity="day"
        onMoveMilestone={onMoveMilestone}
        onResizeMilestone={vi.fn()}
      />,
    );
    const bar = screen.getByTestId("gantt-bar-O-1-M1");

    // Real sprint: Oct 1 - Oct 14. The fixed 14-day cadence anchors the
    // next projected sprint exactly on Oct 14 (this one's own close date),
    // then Oct 28, within this 31-day window. Dragging the milestone
    // (Oct 5 - Oct 12, a 7-day span) by 9 days puts its raw new start at
    // Oct 14 — an exact sprint-start match — so it should land there.
    fireEvent.pointerDown(bar, { clientX: 0 });
    fireEvent.pointerMove(bar, { clientX: DAY_WIDTH * 9 });
    fireEvent.pointerUp(bar);

    expect(onMoveMilestone).toHaveBeenCalledWith(
      "O-1-M1",
      "2026-10-14",
      "2026-10-21", // duration (7 days) preserved
    );
  });

  it("falls back to the raw day-shifted date when there are no sprints to align to", () => {
    const onMoveMilestone = vi.fn();
    renderChart({ onMoveMilestone });
    const bar = screen.getByTestId("gantt-bar-O-1-M1");

    fireEvent.pointerDown(bar, { clientX: 0 });
    fireEvent.pointerMove(bar, { clientX: DAY_WIDTH * 9 });
    fireEvent.pointerUp(bar);

    expect(onMoveMilestone).toHaveBeenCalledWith(
      "O-1-M1",
      "2026-10-14",
      "2026-10-21",
    );
  });
});
