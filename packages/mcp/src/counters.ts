import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { listSourceFiles, isJs } from "./graph/scan.js";

const ANY_RE = /:\s*any\b|\bas any\b|<any>/g;

/** Same numbers ci/ratchet.sh computes, so CI and the MCP agree. */
export function countDebt(root: string, src = "src"): { js: number; any: number } {
  const base = existsSync(join(root, src)) ? join(root, src) : root;
  const files = listSourceFiles(base, true, false);
  let js = 0, any = 0;
  for (const f of files) {
    if (isJs(f)) { js++; continue; }
    const text = readFileSync(join(base, f), "utf8");
    any += (text.match(ANY_RE) ?? []).length;
  }
  return { js, any };
}

export function readBaseline(root: string): { js: number; any: number } | null {
  const dir = join(root, ".ratchet");
  if (!existsSync(join(dir, "js-count")) || !existsSync(join(dir, "any-count"))) return null;
  return {
    js: Number(readFileSync(join(dir, "js-count"), "utf8").trim()),
    any: Number(readFileSync(join(dir, "any-count"), "utf8").trim()),
  };
}

export function writeBaseline(root: string, v: { js: number; any: number }): void {
  const dir = join(root, ".ratchet");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "js-count"), String(v.js) + "\n");
  writeFileSync(join(dir, "any-count"), String(v.any) + "\n");
}
