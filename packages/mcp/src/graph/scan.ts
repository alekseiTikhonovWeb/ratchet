import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative, extname } from "node:path";

export const JS_EXT = [".js", ".jsx", ".mjs", ".cjs"];
export const TS_EXT = [".ts", ".tsx"];
export const ALL_EXT = [...JS_EXT, ...TS_EXT];

const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", "coverage", ".next", "out"]);
const TEST_RE = /\.(test|spec)\.[jt]sx?$/;

/** Every .js/.jsx/.ts/.tsx source file under root (relative POSIX paths). */
export function listSourceFiles(root: string, includeTs = true, includeTests = false): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(full);
        continue;
      }
      const ext = extname(name);
      if (!JS_EXT.includes(ext) && !(includeTs && TS_EXT.includes(ext))) continue;
      if (name.endsWith(".d.ts")) continue;
      if (!includeTests && TEST_RE.test(name)) continue;
      out.push(toPosix(relative(root, full)));
    }
  };
  walk(root);
  return out.sort();
}

const IMPORT_RE =
  /(?:^|[^\w$])(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+[\s\S]*?\s+from\s+|require\s*\(\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;

/** Relative import specifiers (./x, ../y) found in a file, resolved to existing files. */
export function importsOf(root: string, file: string, known: Set<string>): string[] {
  const src = readFileSync(join(root, file), "utf8");
  const deps = new Set<string>();
  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1];
    if (!spec.startsWith(".")) continue; // external package or alias — ignored (alias support: roadmap)
    const target = resolveSpec(root, file, spec, known);
    if (target && target !== file) deps.add(target);
  }
  return [...deps].sort();
}

function resolveSpec(root: string, from: string, spec: string, known: Set<string>): string | null {
  const base = toPosix(relative(root, resolve(root, dirname(from), spec)));
  const candidates = [
    base,
    ...ALL_EXT.map((e) => base + e),
    ...ALL_EXT.map((e) => `${base}/index${e}`),
  ];
  for (const c of candidates) if (known.has(c)) return c;
  // .js spec pointing at an already-migrated .ts file (ESM style imports keep .js)
  if (/\.[cm]?jsx?$/.test(base)) {
    const stripped = base.replace(/\.[cm]?jsx?$/, "");
    for (const e of TS_EXT) if (known.has(stripped + e)) return stripped + e;
  }
  return null;
}

export function linesOf(root: string, file: string): number {
  return readFileSync(join(root, file), "utf8").split("\n").length;
}

export function toPosix(p: string): string {
  return p.split("\\").join("/");
}

export function isJs(file: string): boolean {
  return JS_EXT.includes(extname(file));
}

export function exists(root: string, rel: string): boolean {
  return existsSync(join(root, rel));
}
