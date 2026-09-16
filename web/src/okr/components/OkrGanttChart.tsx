import { Fragment, useRef, useState } from "react";
import type { DateWindow, Granularity } from "../../lib/dateWindow";
import {
  dayTicks,
  isoWeekNumber,
  monthSpans,
  weekSpans,
} from "../../lib/ganttLayout";
import {
  STATUS_META,
  weeklyCapacity,
  type ObjectiveGanttGroup,
  type OkrGanttBar,
  type SprintGanttBar,
} from "../okrTree";
import type { Quarter } from "./types";

const ROW_HEIGHT_OBJECTIVE = 28;
const ROW_HEIGHT_MILESTONE = 46;
const ROW_HEIGHT_SPRINTS = 28;

const HEADER_MONTH_H = 18;
const HEADER_WEEK_H = 16;
const HEADER_DAY_H = 26;
const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

interface VisibleRow {
  key: string;
  bar: OkrGanttBar;
  isCollapsible: boolean;
  isExpanded: boolean;
  objectiveId: string;
  height: number;
}

function flattenVisible(
  groups: ObjectiveGanttGroup[],
  collapsed: Set<string>,
): VisibleRow[] {
  const rows: VisibleRow[] = [];
  for (const group of groups) {
    const isCollapsible = group.milestones.length > 0;
    const isExpanded = isCollapsible && !collapsed.has(group.objectiveId);
    rows.push({
      key: group.objectiveId,
      bar: group.objective,
      isCollapsible,
      isExpanded,
      objectiveId: group.objectiveId,
      height: ROW_HEIGHT_OBJECTIVE,
    });
    if (isExpanded) {
      for (const milestone of group.milestones) {
        rows.push({
          key: `${group.objectiveId}-${milestone.label}`,
          bar: milestone,
          isCollapsible: false,
          isExpanded: false,
          objectiveId: group.objectiveId,
          height: ROW_HEIGHT_MILESTONE,
        });
      }
    }
  }
  return rows;
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weeksBetween(start: Date, end: Date): number {
  return Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (7 * 86400000)),
  );
}

// Milestones should always land on a sprint's start when moved, so a plan
// stays aligned to real (or projected) sprint boundaries rather than
// drifting to an arbitrary day. Falls back to the raw day-shifted date
// when there are no sprints at all to align to.
function nearestSprintStart(
  date: Date,
  sprints: SprintGanttBar[],
): Date | null {
  if (sprints.length === 0) return null;
  let closest = sprints[0].start;
  let bestDiff = Math.abs(date.getTime() - closest.getTime());
  for (const sprint of sprints) {
    const diff = Math.abs(date.getTime() - sprint.start.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = sprint.start;
    }
  }
  return closest;
}

function movedMilestoneRange(
  bar: OkrGanttBar,
  deltaDays: number,
  sprints: SprintGanttBar[],
): { start: Date; end: Date } {
  const rawStart = new Date(bar.start);
  rawStart.setDate(rawStart.getDate() + deltaDays);
  const start = nearestSprintStart(rawStart, sprints) ?? rawStart;
  const durationMs = bar.end.getTime() - bar.start.getTime();
  const end = new Date(start.getTime() + durationMs);
  return { start, end };
}

const DRAG_CLICK_THRESHOLD_PX = 4;

type DragMode = "move" | "resize-start" | "resize-end";

export function OkrGanttChart({
  quarter,
  groups,
  sprints,
  dateWindow,
  granularity,
  onMoveMilestone,
  onResizeMilestone,
}: {
  quarter: Quarter;
  groups: ObjectiveGanttGroup[];
  sprints: SprintGanttBar[];
  dateWindow: DateWindow;
  granularity: Granularity;
  onMoveMilestone: (
    milestoneId: string,
    startDate: string,
    dueDate: string,
  ) => void;
  onResizeMilestone: (
    milestoneId: string,
    startDate: string,
    dueDate: string,
    effortWeeks: number,
  ) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [drag, setDrag] = useState<{
    id: string;
    mode: DragMode;
    startClientX: number;
    deltaPx: number;
  } | null>(null);
  const dragMovedRef = useRef(false);
  const toggle = (objectiveId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(objectiveId)) next.delete(objectiveId);
      else next.add(objectiveId);
      return next;
    });

  const rows = flattenVisible(groups, collapsed);
  const days = dayTicks(dateWindow);
  const width = granularity === "day" ? Math.max(720, days.length * 22) : 720;
  const headerDayH = granularity === "day" ? HEADER_DAY_H : 0;
  const padding = {
    top: HEADER_MONTH_H + HEADER_WEEK_H + headerDayH + 4,
    bottom: 4,
  };
  const sprintsRowHeight = sprints.length ? ROW_HEIGHT_SPRINTS : 0;

  let cumulativeY = padding.top + sprintsRowHeight;
  const rowTops: number[] = [];
  for (const row of rows) {
    rowTops.push(cumulativeY);
    cumulativeY += row.height;
  }
  const plotH = cumulativeY - padding.top;
  const height = padding.top + plotH + padding.bottom;

  const totalMs = dateWindow.end.getTime() - dateWindow.start.getTime();
  const xFor = (d: Date) =>
    ((d.getTime() - dateWindow.start.getTime()) / totalMs) * width;
  const dayWidth = width / days.length;
  const overCommittedWeeks = weeklyCapacity(quarter, dateWindow).filter(
    (w) => w.overCommitted,
  );

  const startBarDrag = (
    e: React.PointerEvent<HTMLElement>,
    id: string,
    mode: DragMode,
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragMovedRef.current = false;
    setDrag({ id, mode, startClientX: e.clientX, deltaPx: 0 });
  };
  const handleBarPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!drag) return;
    const deltaPx = e.clientX - drag.startClientX;
    if (Math.abs(deltaPx) > DRAG_CLICK_THRESHOLD_PX)
      dragMovedRef.current = true;
    setDrag({ ...drag, deltaPx });
  };
  const handleBarPointerUp = (bar: OkrGanttBar) => {
    if (!drag) return;
    const { mode, deltaPx } = drag;
    setDrag(null);

    if (mode === "move") {
      const deltaDays = Math.round(deltaPx / dayWidth);
      if (deltaDays !== 0) {
        const { start, end } = movedMilestoneRange(bar, deltaDays, sprints);
        onMoveMilestone(bar.id, toIsoDate(start), toIsoDate(end));
      }
      return;
    }

    // Resizing always lands on a whole number of weeks.
    const weeksDelta = Math.round(deltaPx / (dayWidth * 7));
    if (weeksDelta === 0) return;
    const currentWeeks = weeksBetween(bar.start, bar.end);
    if (mode === "resize-end") {
      const newWeeks = Math.max(1, currentWeeks + weeksDelta);
      const newEnd = new Date(bar.start);
      newEnd.setDate(newEnd.getDate() + newWeeks * 7);
      onResizeMilestone(
        bar.id,
        toIsoDate(bar.start),
        toIsoDate(newEnd),
        newWeeks,
      );
    } else {
      const newWeeks = Math.max(1, currentWeeks - weeksDelta);
      const newStart = new Date(bar.end);
      newStart.setDate(newStart.getDate() - newWeeks * 7);
      onResizeMilestone(
        bar.id,
        toIsoDate(newStart),
        toIsoDate(bar.end),
        newWeeks,
      );
    }
  };
  const handleBarClick = (e: React.MouseEvent) => {
    if (dragMovedRef.current) e.preventDefault();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr" }}>
      <div>
        <div style={{ height: padding.top }} />
        {sprints.length > 0 && (
          <div
            className="small muted"
            style={{
              height: ROW_HEIGHT_SPRINTS,
              display: "flex",
              alignItems: "center",
              paddingRight: 8,
            }}
          >
            Sprints
          </div>
        )}
        {rows.map((vr) => (
          <div
            key={vr.key}
            className="small"
            title={vr.bar.label}
            style={{
              height: vr.height,
              display: "flex",
              alignItems: "center",
              gap: 4,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              paddingLeft: vr.bar.kind === "milestone" ? 20 : 0,
              paddingRight: 8,
            }}
          >
            {vr.isCollapsible ? (
              <button
                type="button"
                className="expandable-caret okr-caret"
                onClick={() => toggle(vr.objectiveId)}
                aria-label={vr.isExpanded ? "Collapse" : "Expand"}
              >
                {vr.isExpanded ? "▾" : "▸"}
              </button>
            ) : vr.bar.kind === "objective" ? (
              <span className="okr-caret-spacer" />
            ) : null}
            <a href={vr.bar.link}>{vr.bar.label}</a>
          </div>
        ))}
      </div>
      <div style={{ overflowX: "auto" }}>
        <div
          style={{ position: "relative", width, height }}
          role="presentation"
        >
          {overCommittedWeeks.map((week) => {
            const x1 = xFor(week.start);
            const x2 = Math.min(width, xFor(week.end) + dayWidth);
            const tooltip = `Over capacity: ${week.demand.toFixed(1)} engineers needed vs. ${week.capacity} available (${week.contributors
              .map((c) => `${c.title}: ${c.weeklyRate.toFixed(1)}`)
              .join(", ")})`;
            return (
              <div
                key={week.start.toISOString()}
                title={tooltip}
                style={{
                  position: "absolute",
                  left: x1,
                  top: 0,
                  bottom: 0,
                  width: Math.max(2, x2 - x1),
                  background: "var(--status-critical)",
                  opacity: 0.1,
                }}
              />
            );
          })}
          {monthSpans(dateWindow).map((span) => {
            const label = span.start.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            });
            const x1 = xFor(span.start);
            const x2 = Math.min(width, xFor(span.end) + dayWidth);
            return (
              <div key={label + span.start.toISOString()}>
                <div
                  style={{
                    position: "absolute",
                    left: x1,
                    top: 0,
                    bottom: 0,
                    borderLeft: "1px solid var(--text-muted)",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: x1 + 4,
                    top: 2,
                    width: Math.max(0, x2 - x1 - 8),
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
          {weekSpans(dateWindow).map((span) => {
            const label = `W${isoWeekNumber(span.start)}`;
            const x1 = xFor(span.start);
            const x2 = Math.min(width, xFor(span.end) + dayWidth);
            return (
              <div key={label + span.start.toISOString()}>
                <div
                  style={{
                    position: "absolute",
                    left: x1,
                    top: HEADER_MONTH_H,
                    bottom: 0,
                    borderLeft: "1px solid var(--border)",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: x1 + 3,
                    top: HEADER_MONTH_H + 1,
                    width: Math.max(0, x2 - x1 - 6),
                    fontSize: 10,
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
          {granularity === "day" &&
            days.map((d) => {
              const x = xFor(d);
              return (
                <div key={d.toISOString()}>
                  <div
                    style={{
                      position: "absolute",
                      left: x,
                      top: HEADER_MONTH_H + HEADER_WEEK_H,
                      bottom: 0,
                      borderLeft: "1px solid var(--border)",
                      opacity: 0.5,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: x,
                      top: HEADER_MONTH_H + HEADER_WEEK_H + 2,
                      width: dayWidth,
                      textAlign: "center",
                      fontSize: 9,
                      color: "var(--text-muted)",
                      lineHeight: 1.3,
                    }}
                  >
                    <div>{WEEKDAY_LETTERS[d.getDay()]}</div>
                    <div style={{ fontWeight: 600, color: "var(--text)" }}>
                      {d.getDate()}
                    </div>
                  </div>
                </div>
              );
            })}
          {sprints.map((sprint) => {
            const x1 = Math.max(0, xFor(sprint.start));
            const x2 = Math.min(width, xFor(sprint.end));
            const isCurrent =
              sprint.start <= new Date() && new Date() <= sprint.end;
            const tooltip = `${sprint.name}: ${toIsoDate(sprint.start)} → ${toIsoDate(sprint.end)}${
              sprint.isProjected
                ? " — projected from the real sprint cadence, not yet created in Jira"
                : ""
            }`;
            return (
              <div
                key={sprint.name}
                title={tooltip}
                style={{
                  position: "absolute",
                  left: x1,
                  top: padding.top + 3,
                  width: Math.max(2, x2 - x1),
                  height: ROW_HEIGHT_SPRINTS - 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  opacity: sprint.isProjected ? 0.7 : 1,
                  background: sprint.isProjected
                    ? "transparent"
                    : isCurrent
                      ? withAlpha("#2563eb", 0.12)
                      : "var(--surface-2)",
                  border: sprint.isProjected
                    ? "1px dashed var(--text-muted)"
                    : isCurrent
                      ? "1px solid var(--series-1)"
                      : "1px solid var(--border)",
                  color: sprint.isProjected
                    ? "var(--text-muted)"
                    : isCurrent
                      ? "var(--series-1)"
                      : "inherit",
                }}
              >
                {sprint.name}
              </div>
            );
          })}
          {rows.map((vr, i) => {
            const bar = vr.bar;
            const isDragging = drag?.id === bar.id;
            const dragDeltaPx = isDragging ? drag.deltaPx : 0;
            const dragMode = isDragging ? drag.mode : null;
            const clippedLeft = bar.start < dateWindow.start;
            const clippedRight = bar.end > dateWindow.end;
            const x1 =
              Math.max(0, xFor(bar.start)) +
              (dragMode === "move" || dragMode === "resize-start"
                ? dragDeltaPx
                : 0);
            const x2 =
              Math.min(width, xFor(bar.end)) +
              (dragMode === "move" || dragMode === "resize-end"
                ? dragDeltaPx
                : 0);
            const barWidth = Math.max(2, x2 - x1);
            const status = STATUS_META[bar.status];
            const previewDates = (() => {
              if (dragMode === "move") {
                const deltaDays = Math.round(dragDeltaPx / dayWidth);
                const { start, end } = movedMilestoneRange(
                  bar,
                  deltaDays,
                  sprints,
                );
                return `${toIsoDate(start)} → ${toIsoDate(end)}`;
              }
              if (dragMode === "resize-end") {
                const weeksDelta = Math.round(dragDeltaPx / (dayWidth * 7));
                const newWeeks = Math.max(
                  1,
                  weeksBetween(bar.start, bar.end) + weeksDelta,
                );
                const newEnd = new Date(bar.start);
                newEnd.setDate(newEnd.getDate() + newWeeks * 7);
                return `${toIsoDate(bar.start)} → ${toIsoDate(newEnd)} (${newWeeks}w)`;
              }
              if (dragMode === "resize-start") {
                const weeksDelta = Math.round(dragDeltaPx / (dayWidth * 7));
                const newWeeks = Math.max(
                  1,
                  weeksBetween(bar.start, bar.end) - weeksDelta,
                );
                const newStart = new Date(bar.end);
                newStart.setDate(newStart.getDate() - newWeeks * 7);
                return `${toIsoDate(newStart)} → ${toIsoDate(bar.end)} (${newWeeks}w)`;
              }
              return null;
            })();
            const tooltip = previewDates
              ? `${bar.label}: ${previewDates}`
              : `${bar.label}: ${bar.start
                  .toISOString()
                  .slice(0, 10)} → ${bar.end.toISOString().slice(0, 10)}${
                  clippedLeft || clippedRight
                    ? " (continues outside this window — widen the range or check Details for full dates)"
                    : ""
                }`;

            if (bar.kind === "objective") {
              return (
                <a
                  key={vr.key}
                  href={bar.link}
                  title={tooltip}
                  style={{
                    position: "absolute",
                    left: x1,
                    top: rowTops[i] + 3,
                    width: barWidth,
                    height: ROW_HEIGHT_OBJECTIVE - 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "0 8px",
                    borderRadius: 4,
                    background: withAlpha(bar.color, 0.18),
                    border: `1px solid ${withAlpha(bar.color, 0.6)}`,
                    color: "var(--text)",
                    fontWeight: 600,
                    fontSize: 12,
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                  }}
                >
                  <span className="okr-badge" style={{ background: bar.color }}>
                    O
                  </span>
                  {bar.label}
                </a>
              );
            }

            const handleWidth = 8;
            const resizeHandleStyle = (
              side: "start" | "end",
            ): React.CSSProperties => ({
              position: "absolute",
              left: (side === "start" ? x1 : x2) - handleWidth / 2,
              top: rowTops[i] + 3,
              width: handleWidth,
              height: ROW_HEIGHT_MILESTONE - 8,
              cursor: "ew-resize",
              touchAction: "none",
            });

            return (
              <Fragment key={vr.key}>
                <a
                  href={bar.link}
                  title={tooltip}
                  draggable={false}
                  data-testid={`gantt-bar-${bar.id}`}
                  onPointerDown={(e) => startBarDrag(e, bar.id, "move")}
                  onPointerMove={handleBarPointerMove}
                  onPointerUp={() => handleBarPointerUp(bar)}
                  onClick={handleBarClick}
                  style={{
                    position: "absolute",
                    left: x1,
                    top: rowTops[i] + 3,
                    width: barWidth,
                    height: ROW_HEIGHT_MILESTONE - 8,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: 2,
                    padding: "4px 8px",
                    borderRadius: 4,
                    background: withAlpha(bar.color, isDragging ? 0.2 : 0.1),
                    border: `1px solid ${withAlpha(bar.color, isDragging ? 0.7 : 0.4)}`,
                    color: "var(--text)",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    cursor: dragMode === "move" ? "grabbing" : "grab",
                    touchAction: "none",
                  }}
                >
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      className="okr-badge"
                      style={{ background: bar.color }}
                    >
                      M
                    </span>
                    <span style={{ fontWeight: 600 }}>{bar.label}</span>
                  </span>
                  <span
                    className="small muted"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span className={`chip ${status.cls}`}>{status.label}</span>
                    <span>{weeksBetween(bar.start, bar.end)}w</span>
                  </span>
                </a>
                <div
                  data-testid={`gantt-bar-${bar.id}-resize-start`}
                  title={tooltip}
                  onPointerDown={(e) => startBarDrag(e, bar.id, "resize-start")}
                  onPointerMove={handleBarPointerMove}
                  onPointerUp={() => handleBarPointerUp(bar)}
                  style={resizeHandleStyle("start")}
                />
                <div
                  data-testid={`gantt-bar-${bar.id}-resize-end`}
                  title={tooltip}
                  onPointerDown={(e) => startBarDrag(e, bar.id, "resize-end")}
                  onPointerMove={handleBarPointerMove}
                  onPointerUp={() => handleBarPointerUp(bar)}
                  style={resizeHandleStyle("end")}
                />
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
