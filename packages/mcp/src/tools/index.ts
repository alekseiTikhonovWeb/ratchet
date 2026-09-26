import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, basename, relative } from "node:path";
import { buildGraph } from "../graph/layers.js";
import { isJs } from "../graph/scan.js";
import { countDebt, readBaseline, writeBaseline } from "../counters.js";
import { loadRun, saveRun, newRun, graphSnapshot, closedStems, stem, nextBatchId, type RunLog, type Batch, type SemanticChange } from "../run.js";
import { renderHtml } from "../report.js";
import type { Graph } from "../graph/layers.js";

function repoName(root: string): string {
  try {
    const url = execSync("git config --get remote.origin.url", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return url.replace(/^git@github\.com:/, "github.com/").replace(/^https?:\/\//, "").replace(/\.git$/, "");
  } catch {
    return basename(root);
  }
}

/** Load run.json and re-scan the repo so layers/paths reflect files as they are now (.js → .ts renames). */
function requireRun(root: string, refresh = true): RunLog {
  const run = loadRun(root);
  if (!run) throw new Error(`No run.json in ${root}. Call build_graph first.`);
  if (refresh) run.graph = graphSnapshot(scanRepo(root, run.src));
  return run;
}

function defaultSrc(root: string): string {
  return existsSync(join(root, "src")) ? "src" : ".";
}

/** Graph with paths relative to the repo root (not to src). */
function scanRepo(root: string, src: string): Graph {
  const graph = buildGraph(join(root, src));
  const prefix = src === "." ? "" : src.replace(/\/$/, "") + "/";
  const p = (f: string) => prefix + f;
  graph.layers = graph.layers.map((l) => l.map(p));
  graph.cycles = graph.cycles.map((c) => c.map(p));
  graph.files = Object.fromEntries(
    Object.entries(graph.files).map(([k, v]) => [p(k), { ...v, path: p(k), imports: v.imports.map(p), importedBy: v.importedBy.map(p) }])
  );
  return graph;
}

// ---------------------------------------------------------------- build_graph
export function build_graph(root: string, opts: { src?: string; reset?: boolean } = {}) {
  const src = opts.src ?? defaultSrc(root);
  const graph = scanRepo(root, src);

  let run = loadRun(root);
  if (!run || opts.reset) {
    run = newRun(root, repoName(root), src, graph);
    const debt = countDebt(root, src);
    run.ratchet = { js: [debt.js], any: [debt.any] };
    if (!readBaseline(root)) writeBaseline(root, debt);
  } else {
    run.src = src;
    run.graph = graphSnapshot(graph);
  }
  saveRun(root, run);
  return {
    runFile: "run.json",
    layers: graph.layers.map((files, i) => ({ layer: i, files: files.length, js: files.filter(isJs).length })),
    cycles: graph.cycles,
    stats: graph.stats,
    hint: graph.cycles.length
      ? `${graph.cycles.length} cycle(s) (${graph.stats.cycleFiles} files) must be migrated by hand — never by an agent.`
      : "No cycles. Every file can be migrated in layer order.",
  };
}

// ---------------------------------------------------------------- next_batch
export function next_batch(root: string, opts: { maxFiles?: number } = {}) {
  const max = Math.max(1, Math.min(opts.maxFiles ?? 15, 25));
  const run = requireRun(root);

  // Idempotent: an open batch is returned again instead of opening a second one.
  const open = run.batches.find((b) => b.status === "pending");
  if (open) {
    saveRun(root, run);
    const typedDeps = [...new Set(open.files.flatMap((f) => run.graph.files[f]?.imports ?? run.graph.files[f.replace(/\.jsx?$/, (m) => (m === ".jsx" ? ".tsx" : ".ts"))]?.imports ?? []))].sort();
    return { batchId: open.id, layer: open.layer, files: open.files, reopened: true, remainingInLayer: null, typedDeps, contract: CONTRACT,
      hint: `Batch ${open.id} is still open (pending). Finish it — run_checks, then record_step — before asking for a new one.` };
  }

  const closed = closedStems(run);
  for (let layer = 0; layer < run.graph.layers.length; layer++) {
    const candidates = run.graph.layers[layer].filter((f) => isJs(f) && !closed.has(stem(f)));
    if (!candidates.length) continue;
    const files = candidates.slice(0, max);
    const typedDeps = [...new Set(files.flatMap((f) => run.graph.files[f]?.imports ?? []))].sort();
    const batch: Batch = { id: nextBatchId(run), layer, files, status: "pending", startedAt: new Date().toISOString(), attempts: 1 };
    run.batches.push(batch);
    saveRun(root, run);
    return {
      batchId: batch.id,
      layer,
      files,
      remainingInLayer: candidates.length - files.length,
      typedDeps,
      contract: CONTRACT,
    };
  }
  return { batchId: null, done: true, message: "No JS files left outside cycles. Migration complete — call render_report." };
}

export const CONTRACT = [
  "Convert ONLY the listed files: .jsx → .tsx; .js → .ts, or .tsx if the file contains JSX (git mv, then annotate).",
  "Every module they import is already typed (typedDeps). READ the real types before writing annotations. Never invent an interface for something you can read.",
  "Do not change runtime behavior: no reordering, no refactors, no var→const sweeps, no error-handling changes, no new dependencies.",
  "Do not touch files outside the list. Do not touch tests, package.json or build config.",
  "`any` is allowed when the type is honestly unknown (external SDK, webhook payload). A counted `any` beats a confident wrong type.",
  "List every new `?`, `| null`, `| undefined`, interface and type you introduced — these are claims about runtime behavior and go to the human gate.",
  "Finish with run_checks and paste both outputs in full.",
];

// ---------------------------------------------------------------- run_checks
/**
 * Typecheck + tests. With a batchId and no explicit testCmd, runs only the tests related to the
 * batch's files (sibling *.test.*, __tests__/ mirror, or same basename anywhere) — fast feedback
 * per batch; the full suite belongs to CI. scope=full forces the whole suite.
 */
export function run_checks(
  root: string,
  opts: { batchId?: string; testCmd?: string; typecheckCmd?: string; scope?: "related" | "full" } = {}
) {
  const typecheckCmd = opts.typecheckCmd ?? "npx tsc --noEmit -p tsconfig.json --pretty false";
  const run = opts.batchId ? requireRun(root, false) : null;
  const batch = run?.batches.find((x) => x.id === opts.batchId);

  let testCmd = opts.testCmd;
  let scope: "related" | "full" = "full";
  let testFiles: string[] = [];
  if (!testCmd) {
    const runner = detectRunner(root);
    if (batch && opts.scope !== "full") {
      testFiles = relatedTests(root, batch.files);
      if (testFiles.length) { scope = "related"; testCmd = `${runner} ${testFiles.map((f) => JSON.stringify(f)).join(" ")}`; }
    }
    testCmd ??= runner;
  }

  const tc = sh(root, typecheckCmd);
  const tcErrors = (tc.output.match(/error TS\d+/g) ?? []).length;
  const te = sh(root, testCmd);
  const tests = parseTests(te.output);

  const result = {
    typecheck: { ok: tc.code === 0, errors: tcErrors, cmd: typecheckCmd, output: tail(tc.output, 60) },
    tests: { ok: te.code === 0, passed: tests.passed, failed: tests.failed, scope, files: testFiles, cmd: testCmd, output: tail(te.output, 60) },
    ok: tc.code === 0 && te.code === 0,
  };

  if (run && batch) {
    batch.checks = { typecheck: { ok: result.typecheck.ok, errors: tcErrors }, tests: { ok: result.tests.ok, passed: tests.passed, failed: tests.failed } };
    saveRun(root, run);
  }
  return result;
}

/** The runner command that accepts a list of test files. */
function detectRunner(root: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const test: string = pkg.scripts?.test ?? "";
    if (deps.vitest || /\bvitest\b/.test(test)) return "npx vitest run";
    if (deps["react-scripts"] || /react-scripts test/.test(test)) return "npx react-scripts test --watchAll=false";
    if (deps.jest || /\bjest\b/.test(test)) return "npx jest";
    if (deps.mocha || /\bmocha\b/.test(test)) return "npx mocha";
    if (test) return "npm test --";
  } catch { /* ignore */ }
  return "npm test --";
}

const TEST_EXT = ["js", "jsx", "ts", "tsx", "mjs"];

/** Test files that exercise the given source files: sibling, __tests__ mirror, or same basename anywhere. */
export function relatedTests(root: string, files: string[]): string[] {
  const found = new Set<string>();
  const all = allTestFiles(root);
  for (const f of files) {
    const s = stem(f);                       // src/lib/foo
    const base = s.split("/").pop()!;        // foo
    const dir = s.includes("/") ? s.slice(0, s.lastIndexOf("/")) : "";
    const patterns = [
      ...TEST_EXT.map((e) => `${s}.test.${e}`),
      ...TEST_EXT.map((e) => `${s}.spec.${e}`),
      ...TEST_EXT.map((e) => `${dir}/__tests__/${base}.test.${e}`),
      ...TEST_EXT.map((e) => `${dir}/__tests__/${base}.${e}`),
      ...["__tests__", "test", "tests", "spec"].flatMap((t) => TEST_EXT.map((e) => `${t}/${s}.test.${e}`)),
      ...["__tests__", "test", "tests", "spec"].flatMap((t) => TEST_EXT.map((e) => `${t}/${s}.spec.${e}`)),
    ];
    let hit = false;
    for (const p of patterns) if (all.has(p)) { found.add(p); hit = true; }
    if (!hit && base !== "index") {
      for (const t of all) if (new RegExp(`(^|/)${escapeRe(base)}\\.(test|spec)\\.[jt]sx?$`).test(t)) found.add(t);
    }
  }
  return [...found].sort();
}

let testFileCache: { root: string; files: Set<string> } | null = null;
function allTestFiles(root: string): Set<string> {
  if (testFileCache && testFileCache.root === root) return testFileCache.files;
  const out = new Set<string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!["node_modules", "dist", "build", ".git", "coverage"].includes(e.name)) walk(join(dir, e.name));
      } else if (/\.(test|spec)\.[jt]sx?$/.test(e.name)) out.add(toPosixRel(root, join(dir, e.name)));
    }
  };
  walk(root);
  testFileCache = { root, files: out };
  return out;
}

function toPosixRel(root: string, p: string): string {
  return relative(root, p).split("\\").join("/");
}
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sh(cwd: string, cmd: string): { code: number; output: string } {
  const r = spawnSync(cmd, {
    cwd, shell: true, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, CI: "true", FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  const strip = (s: string) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  return { code: r.status ?? 1, output: strip((r.stdout ?? "") + (r.stderr ?? "")) };
}

function parseTests(out: string): { passed: number; failed: number } {
  // jest: "Tests: 1 failed, 41 passed, 42 total"
  const m = out.match(/Tests:\s+(?:(\d+)\s+failed,\s+)?(?:(\d+)\s+skipped,\s+)?(\d+)\s+passed/);
  if (m) return { failed: Number(m[1] ?? 0), passed: Number(m[3]) };
  // vitest: "Tests  2 failed | 242 passed (244)" or "Tests  244 passed (244)"
  const v = out.match(/Tests\s+(?:(\d+) failed \| )?(\d+) passed/);
  if (v) return { failed: Number(v[1] ?? 0), passed: Number(v[2]) };
  const vf = out.match(/Tests\s+(\d+) failed/);
  if (vf) return { failed: Number(vf[1]), passed: 0 };
  const mocha = out.match(/(\d+)\s+passing(?:[\s\S]*?(\d+)\s+failing)?/);
  if (mocha) return { passed: Number(mocha[1]), failed: Number(mocha[2] ?? 0) };
  // node --test (TAP): "# pass 3" / "# fail 1"
  const np = out.match(/^# pass (\d+)/m), nf = out.match(/^# fail (\d+)/m);
  if (np || nf) return { passed: Number(np?.[1] ?? 0), failed: Number(nf?.[1] ?? 0) };
  return { passed: 0, failed: 0 };
}

function tail(s: string, lines: number): string {
  const arr = s.trim().split("\n");
  return arr.slice(-lines).join("\n");
}

// ---------------------------------------------------------------- ratchet
export function ratchet(root: string, opts: { mode?: "check" | "commit" | "init"; src?: string } = {}) {
  const mode = opts.mode ?? "check";
  const src = opts.src ?? loadRun(root)?.src ?? defaultSrc(root);
  const current = countDebt(root, src);
  if (mode === "init") {
    writeBaseline(root, current);
    return { mode, current, baseline: current, ok: true, message: "baseline written" };
  }
  const baseline = readBaseline(root);
  if (!baseline) return { mode, current, baseline: null, ok: false, message: "no baseline — run ratchet with mode=init" };
  // 1. js never goes up. 2. `any` may only go up in a change that converts files (js went down);
  //    it is counted and shown at the gate. Any other change may only lower it.
  const converted = current.js < baseline.js;
  const reasons: string[] = [];
  if (current.js > baseline.js) reasons.push(`.js/.jsx count went UP ${baseline.js} → ${current.js}`);
  if (current.any > baseline.any && !converted) reasons.push(`'any' count went UP ${baseline.any} → ${current.any} without converting any file`);
  const ok = reasons.length === 0;
  const anyAdded = current.any > baseline.any && converted ? current.any - baseline.any : 0;
  if (mode === "commit" && ok) {
    writeBaseline(root, current);
    const run = loadRun(root);
    if (run) { run.ratchet.js.push(current.js); run.ratchet.any.push(current.any); saveRun(root, run); }
    return { mode, current, baseline: current, ok, anyAdded, message: `ceiling set to js ${current.js}, any ${current.any}${anyAdded ? ` (+${anyAdded} any introduced by conversion — counted)` : ""}` };
  }
  return { mode, current, baseline, ok, anyAdded, message: ok ? (anyAdded ? `ok (+${anyAdded} any introduced by conversion — list them at the gate)` : "ok") : reasons.join("; ") };
}

// ---------------------------------------------------------------- record_step
export function record_step(
  root: string,
  opts: { batchId: string; status: Batch["status"]; semantic?: SemanticChange[]; session?: string; notes?: string; files?: string[]; force?: boolean }
) {
  const run = requireRun(root);
  let b = run.batches.find((x) => x.id === opts.batchId);
  if (!b) {
    // allow recording a manual step (e.g. a cycle handled by hand) without next_batch
    b = { id: opts.batchId, layer: -1, files: opts.files ?? [], status: "pending", startedAt: new Date().toISOString() };
    run.batches.push(b);
  }
  // A batch is "done" only on green checks. Red checks → rolled_back / failed / manual, or force=true with a reason.
  if (opts.status === "done" && !opts.force) {
    if (!b.checks) throw new Error(`${b.id}: no run_checks recorded for this batch — run run_checks with batchId "${b.id}" first.`);
    if (!b.checks.typecheck.ok || !b.checks.tests.ok) {
      throw new Error(`${b.id}: last run_checks is red (typecheck ${b.checks.typecheck.ok ? "ok" : `${b.checks.typecheck.errors} errors`}, tests ${b.checks.tests.ok ? "ok" : `${b.checks.tests.failed} failed`}). Fix and re-run run_checks, or record it as rolled_back / manual.`);
    }
  }
  b.status = opts.status;
  b.finishedAt = new Date().toISOString();
  b.durationSec = Math.round((Date.parse(b.finishedAt) - Date.parse(b.startedAt)) / 1000);
  if (opts.semantic) b.semantic = opts.semantic;
  if (opts.session) b.session = opts.session;
  if (opts.notes) b.notes = opts.notes;
  if (opts.status === "rolled_back") b.attempts = (b.attempts ?? 1) + 1;
  b.ratchet = countDebt(root, run.src);
  saveRun(root, run);
  const totalJs = run.ratchet.js[0] ?? run.graph.stats.jsFiles;
  return { ok: true, batch: b, progress: { migrated: totalJs - b.ratchet.js, totalJs, remaining: b.ratchet.js } };
}

// ---------------------------------------------------------------- render_report
export function render_report(root: string, opts: { out?: string } = {}) {
  const run = requireRun(root);
  saveRun(root, run);
  const out = opts.out ?? "report.html";
  writeFileSync(join(root, out), renderHtml(run));
  return { path: out, batches: run.batches.length, js: run.ratchet.js, any: run.ratchet.any };
}
