import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const UNIT_ROOT = resolve(process.cwd(), "src/okr");

const forbidden: Record<string, string[]> = {
  domain: ["application", "adapters", "config"],
  application: ["adapters/inbound"],
  "adapters/outbound": ["adapters/inbound", "application"],
};

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return filesUnder(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

function localImportsOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(/from\s+"(\.[^"]+)"/g)].map((m) =>
    relative(UNIT_ROOT, resolve(dirname(file), m[1])),
  );
}

describe("the OKR module's layers", () => {
  for (const [layer, mustNotReach] of Object.entries(forbidden)) {
    it(`${layer} depends on none of ${mustNotReach.join(", ")}`, () => {
      const offenders = filesUnder(join(UNIT_ROOT, layer)).flatMap((f) =>
        localImportsOf(f)
          .filter((target) =>
            mustNotReach.some((bad) => target.startsWith(bad + "/")),
          )
          .map((target) => `${relative(UNIT_ROOT, f)} -> ${target}`),
      );
      expect(offenders).toEqual([]);
    });
  }

  it("keeps React out of the domain", () => {
    const reaching = filesUnder(join(UNIT_ROOT, "domain"))
      .filter((f) => /from\s+"react"/.test(readFileSync(f, "utf8")))
      .map((f) => relative(UNIT_ROOT, f));
    expect(reaching).toEqual([]);
  });
});
