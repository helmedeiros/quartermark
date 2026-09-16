export type Granularity = "day" | "week" | "month" | "quarter";

export interface DateWindow {
  start: Date;
  end: Date;
}

const GRANULARITY_META: Record<
  Granularity,
  {
    label: string;
    stepUnit: "day" | "month";
    stepAmount: number;
    before: number;
    after: number;
  }
> = {
  day: {
    label: "day",
    stepUnit: "day",
    stepAmount: 1,
    before: 7,
    after: 30,
  },
  week: {
    label: "week",
    stepUnit: "day",
    stepAmount: 7,
    before: 14,
    after: 70,
  },
  month: {
    label: "month",
    stepUnit: "month",
    stepAmount: 1,
    before: 30,
    after: 180,
  },
  quarter: {
    label: "quarter",
    stepUnit: "month",
    stepAmount: 3,
    before: 90,
    after: 365,
  },
};

function addUnits(date: Date, granularity: Granularity, units: number): Date {
  const { stepUnit, stepAmount } = GRANULARITY_META[granularity];
  const d = new Date(date);
  if (stepUnit === "day") d.setDate(d.getDate() + units * stepAmount);
  else d.setMonth(d.getMonth() + units * stepAmount);
  return d;
}

export function defaultTimelineWindow(
  before: number,
  after: number,
  anchor: Date = new Date(),
): DateWindow {
  const start = new Date(anchor);
  start.setDate(start.getDate() - before);
  const end = new Date(anchor);
  end.setDate(end.getDate() + after);
  return { start, end };
}

export function windowForGranularity(
  granularity: Granularity,
  offset = 0,
): DateWindow {
  const anchor =
    offset === 0 ? new Date() : addUnits(new Date(), granularity, offset);
  const { before, after } = GRANULARITY_META[granularity];
  return defaultTimelineWindow(before, after, anchor);
}

export function padByWholeMonths(
  window: DateWindow,
  monthsBefore: number,
  monthsAfter: number,
): DateWindow {
  const start = new Date(
    window.start.getFullYear(),
    window.start.getMonth() - monthsBefore,
    1,
  );
  const afterMonthStart = new Date(
    window.end.getFullYear(),
    window.end.getMonth() + monthsAfter + 1,
    1,
  );
  const end = new Date(afterMonthStart.getTime() - 86400000);
  return { start, end };
}

export function stepLabel(granularity: Granularity): string {
  return GRANULARITY_META[granularity].label;
}

export function formatWindowRange(window: DateWindow): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(window.start)} – ${fmt(window.end)}`;
}
