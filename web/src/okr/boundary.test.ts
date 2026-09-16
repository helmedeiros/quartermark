import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// vitest runs with the web/ package as cwd.
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

// The module is meant to lift out into its own package. Anything it
// reaches for has to come with it, so the set of things it may reach for
// is the boundary — and a boundary nobody checks is a boundary that
// erodes one convenient import at a time.
describe("the OKR module's import boundary", () => {
  const files = filesUnder(UNIT_ROOT);

  it("finds the module's files", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  // These are the host application's own areas — HR dossiers, delivery
  // metrics, engagement. None of it has anything to do with OKRs.
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

  // Whatever it does reach for outside itself is what a package split
  // has to carry or replace. Keeping that list short and explicit is the
  // whole point; adding to it should be a deliberate act.
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

// The other direction: the host may depend on the module, but only on
// what the module publishes. A deep import into its internals is a
// dependency the package split would silently break.
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

// An import is still inside the unit if resolving it stays under okr/.
function isInsideUnit(file: string, spec: string): boolean {
  const resolved = join(file, "..", spec);
  return resolved.startsWith(UNIT_ROOT);
}
