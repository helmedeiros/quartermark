import { describe, expect, it } from "vitest";
import { STATUS_META, statusMeta } from "./metadata";

describe("statusMeta", () => {
  it("returns the real entry for every known status", () => {
    for (const [status, expected] of Object.entries(STATUS_META)) {
      expect(statusMeta(status)).toEqual(expected);
    }
  });

  it("degrades instead of throwing on a status it does not know", () => {
    const meta = statusMeta("in_progress");
    expect(meta.cls).toBe("neutral");
    expect(meta.label).toContain("in_progress");
  });

  it("says so rather than guessing when the status is missing", () => {
    expect(statusMeta(undefined).cls).toBe("neutral");
    expect(statusMeta(undefined).label).toBe("—");
  });

  it("surfaces the unrecognised value instead of hiding it", () => {
    expect(statusMeta("delivered").label).toBe("delivered (unknown)");
  });
});
