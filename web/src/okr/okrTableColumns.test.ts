import { describe, expect, it } from "vitest";
import {
  initialColumnWidths,
  MIN_COLUMN_WIDTH,
  OKR_COLUMNS,
  resizeColumn,
} from "./okrTableColumns";

describe("initialColumnWidths", () => {
  it("sums to (approximately) the available width", () => {
    const widths = initialColumnWidths(1000);
    const total = OKR_COLUMNS.reduce((sum, key) => sum + widths[key], 0);
    expect(total).toBeGreaterThanOrEqual(990);
    expect(total).toBeLessThanOrEqual(1010);
  });

  it("gives the title column the largest share", () => {
    const widths = initialColumnWidths(1000);
    for (const key of OKR_COLUMNS) {
      if (key !== "title") expect(widths.title).toBeGreaterThan(widths[key]);
    }
  });

  it("never sizes a column below the minimum, even on a narrow viewport", () => {
    const widths = initialColumnWidths(300);
    for (const key of OKR_COLUMNS) {
      expect(widths[key]).toBeGreaterThanOrEqual(MIN_COLUMN_WIDTH);
    }
  });
});

describe("resizeColumn", () => {
  it("grows the target column by the delta and leaves others untouched", () => {
    const before = initialColumnWidths(1000);
    const after = resizeColumn(before, "title", 40);
    expect(after.title).toBe(before.title + 40);
    expect(after.cluster).toBe(before.cluster);
  });

  it("shrinks the target column but clamps at the minimum width", () => {
    const before = initialColumnWidths(1000);
    const after = resizeColumn(before, "progress", -10000);
    expect(after.progress).toBe(MIN_COLUMN_WIDTH);
  });
});
