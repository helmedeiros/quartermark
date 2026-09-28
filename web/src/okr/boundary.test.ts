import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const UNIT_ROOT = resolve(process.cwd(), "src/okr") + "/";

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return filesUnder(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

function importsOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
}

describe("the OKR module's import boundary", () => {
  const files = filesUnder(UNIT_ROOT);

  it("finds the module's files", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it("reaches into none of the host application's sections", () => {
    const forbidden =
      /(^|\/)(engineers?|tabs|team|features|calendar|routines)\//;
    const offenders = files.flatMap((f) =>
      importsOf(f)
        .filter((spec) => spec.startsWith(".") && forbidden.test(spec))
        .map((spec) => `${f.replace(UNIT_ROOT, "")} -> ${spec}`),
    );
    expect(offenders).toEqual([]);
  });

  it("reaches outside itself only for the agreed shared leaves", () => {
    const allowed = new Set([
      "../../api/client",
      "../../api/useTeamBlob",
      "../../api/useOkrSettings",
      "../../lib/dateWindow",
      "../../lib/format",
      "../../lib/ganttLayout",
      "../../lib/markdown",
      "../../lib/markdownEditor",
      "../../lib/scale",
      "../../components/QueryState",
      "../../components/queryStateMessage",
      "../../components/Sparkline",
      "../api/client",
      "../api/useTeamBlob",
      "../api/useOkrSettings",
      "../lib/dateWindow",
      "../lib/format",
      "../lib/ganttLayout",
      "../lib/markdown",
      "../lib/markdownEditor",
      "../lib/scale",
      "../components/QueryState",
      "../components/queryStateMessage",
      "../components/Sparkline",
      "../sections",
      "../useCurrentTeamSlug",
      "../../useCurrentTeamSlug",
    ]);
    const escaping = files.flatMap((f) =>
      importsOf(f)
        .filter((spec) => spec.startsWith("../") && !isInsideUnit(f, spec))
        .filter((spec) => !allowed.has(spec))
        .map((spec) => `${f.replace(UNIT_ROOT, "")} -> ${spec}`),
    );
    expect(escaping).toEqual([]);
  });
});

describe("what the host application may import from the module", () => {
  const hostRoot = resolve(process.cwd(), "src");
  const hostFiles = filesUnder(hostRoot).filter(
    (f) => !f.startsWith(UNIT_ROOT),
  );

  it("reaches the module only through its barrel", () => {
    const deep = hostFiles.flatMap((f) =>
      importsOf(f)
        .filter((spec) => /(^|\/)okr\/.+/.test(spec))
        .map((spec) => `${f.replace(hostRoot + "/", "")} -> ${spec}`),
    );
    expect(deep).toEqual([]);
  });
});

function isInsideUnit(file: string, spec: string): boolean {
  const resolved = join(file, "..", spec);
  return resolved.startsWith(UNIT_ROOT);
}
