import { describe, expect, it } from "vitest";
import { STATUS_META, statusMeta } from "./metadata";

describe("statusMeta", () => {
  it("returns the real entry for every known status", () => {
    for (const [status, expected] of Object.entries(STATUS_META)) {
      expect(statusMeta(status)).toEqual(expected);
    }
  });

  // The document is hand-editable JSON and the API stores what it is
  // given, so this is reachable — and indexing the record directly made
  // it "cannot read properties of undefined", which took out the whole
  // Gantt rather than one cell.
  it("degrades instead of throwing on a status it does not know", () => {
    const meta = statusMeta("in_progress");
    expect(meta.cls).toBe("neutral");
    expect(meta.label).toContain("in_progress");
  });

  it("says so rather than guessing when the status is missing", () => {
    expect(statusMeta(undefined).cls).toBe("neutral");
    expect(statusMeta(undefined).label).toBe("—");
  });

  // Echoing the value back matters: silently showing "Not started" for a
  // typo hides the typo.
  it("surfaces the unrecognised value instead of hiding it", () => {
    expect(statusMeta("delivered").label).toBe("delivered (unknown)");
  });
});
