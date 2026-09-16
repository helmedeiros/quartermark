import type { DateWindow, Granularity } from "./dateWindow";
import { sortPersonFirst } from "./sortGroups";

export interface GanttRow {
  label: string;
  start: Date;
  end: Date;
  category: string;
  color?: string;
  link?: string;
  person?: string;
  data?: unknown;
}

export interface GanttLane {
  key: string;
  label: string;
  link?: string;
  rows: GanttRow[];
}

export function groupIntoLanes(rows: GanttRow[]): GanttLane[] {
  const lanes = new Map<string, GanttLane>();
  for (const r of rows) {
    const key = r.person ?? r.label;
    const lane = lanes.get(key);
    if (lane) {
      lane.rows.push(r);
      lane.link ??= r.link;
    } else {
      lanes.set(key, { key, label: key, link: r.link, rows: [r] });
    }
  }
  return sortPersonFirst(
    [...lanes.values()],
    (lane) => lane.rows.some((r) => r.person != null),
    (lane) => lane.label,
    (lane) => Math.min(...lane.rows.map((r) => r.start.getTime())),
  );
}

export function monthTicks({ start, end }: DateWindow): Date[] {
  const ticks: Date[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= end) {
    ticks.push(new Date(d));
    d.setMonth(d.getMonth() + 1);
  }
  return ticks;
}

export function dayTicks({ start, end }: DateWindow): Date[] {
  const ticks: Date[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (d <= end) {
    ticks.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return ticks;
}

export function weekTicks({ start, end }: DateWindow): Date[] {
  const ticks: Date[] = [];
  const d = new Date(start);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  while (d <= end) {
    ticks.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return ticks;
}

function clipToWindow(span: DateWindow, window: DateWindow): DateWindow {
  return {
    start: span.start < window.start ? window.start : span.start,
    end: span.end > window.end ? window.end : span.end,
  };
}

export function monthSpans(window: DateWindow): DateWindow[] {
  const spans: DateWindow[] = [];
  let cursor = new Date(window.start.getFullYear(), window.start.getMonth(), 1);
  while (cursor <= window.end) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const end = new Date(next.getTime() - 86400000);
    spans.push(clipToWindow({ start: cursor, end }, window));
    cursor = next;
  }
  return spans;
}

export function weekSpans(window: DateWindow): DateWindow[] {
  const spans: DateWindow[] = [];
  const cursor = new Date(window.start);
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  while (cursor <= window.end) {
    const end = new Date(cursor);
    end.setDate(end.getDate() + 6);
    spans.push(clipToWindow({ start: new Date(cursor), end }, window));
    cursor.setDate(cursor.getDate() + 7);
  }
  return spans;
}

export function quarterTicks({ start, end }: DateWindow): Date[] {
  const ticks: Date[] = [];
  const d = new Date(
    start.getFullYear(),
    Math.floor(start.getMonth() / 3) * 3,
    1,
  );
  while (d <= end) {
    ticks.push(new Date(d));
    d.setMonth(d.getMonth() + 3);
  }
  return ticks;
}

export function isoWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function isoWeekYear(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

export function yearWeekLabel(d: Date): string {
  return `'${String(isoWeekYear(d)).slice(2)} W${isoWeekNumber(d)}`;
}

export function yearWeekRangeLabel(start: Date, end: Date): string {
  const startLabel = yearWeekLabel(start);
  const endLabel = yearWeekLabel(end);
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
}

export function ticksFor(granularity: Granularity, window: DateWindow): Date[] {
  if (granularity === "day") return dayTicks(window);
  if (granularity === "week") return weekTicks(window);
  if (granularity === "quarter") return quarterTicks(window);
  return monthTicks(window);
}

export function tickLabel(granularity: Granularity, d: Date): string {
  if (granularity === "day") {
    return d.getDay() === 1 ? yearWeekLabel(d) : String(d.getDate());
  }
  if (granularity === "week") return yearWeekLabel(d);
  if (granularity === "quarter")
    return `Q${Math.floor(d.getMonth() / 3) + 1} '${String(d.getFullYear()).slice(2)}`;
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}
