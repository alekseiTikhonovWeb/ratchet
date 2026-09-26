import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Graph } from "./graph/layers.js";

/** The single contract between the MCP server, Bob, the dashboard and the report. */
export interface RunLog {
  version: 1;
  repo: string;
  /** source dir relative to root ("src" or ".") */
  src: string;
  startedAt: string;
  updatedAt: string;
  graph: {
    layers: string[][];
    cycles: string[][];
    files: Record<string, { lines: number; imports: string[] }>;
    stats: Graph["stats"];
  };
  /** counters after each batch; index 0 = baseline */
  ratchet: { js: number[]; any: number[] };
  batches: Batch[];
}

export interface SemanticChange {
  file: string;
  kind: "optional" | "nullable" | "interface" | "type" | "cast" | "any" | "other";
  symbol: string;
  note?: string;
}

export interface Batch {
  id: string;
  layer: number;
  files: string[];
  status: "pending" | "done" | "rolled_back" | "manual" | "failed";
  startedAt: string;
  finishedAt?: string;
  durationSec?: number;
  checks?: {
    typecheck: { ok: boolean; errors: number };
    tests: { ok: boolean; passed: number; failed: number };
  };
  ratchet?: { js: number; any: number };
  semantic?: SemanticChange[];
  session?: string;
  notes?: string;
  attempts?: number;
}

export const RUN_FILE = "run.json";

export function runPath(root: string): string {
  return join(root, RUN_FILE);
}

export function loadRun(root: string): RunLog | null {
  const p = runPath(root);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as RunLog;
}

export function saveRun(root: string, run: RunLog): void {
  run.updatedAt = new Date().toISOString();
  const p = runPath(root);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(run, null, 2) + "\n");
}

export function graphSnapshot(graph: Graph): RunLog["graph"] {
  const files: RunLog["graph"]["files"] = {};
  for (const [k, v] of Object.entries(graph.files)) files[k] = { lines: v.lines, imports: v.imports };
  return { layers: graph.layers, cycles: graph.cycles, files, stats: graph.stats };
}

export function newRun(root: string, repo: string, src: string, graph: Graph): RunLog {
  const now = new Date().toISOString();
  return {
    version: 1,
    repo,
    src,
    startedAt: now,
    updatedAt: now,
    graph: graphSnapshot(graph),
    ratchet: { js: [], any: [] },
    batches: [],
  };
}

/** path without extension — a file keeps its identity across .js → .ts */
export function stem(f: string): string {
  return f.replace(/\.(jsx?|tsx?|mjs|cjs)$/, "");
}

/** Stems already migrated, handed off, or in a pending batch. */
export function closedStems(run: RunLog): Set<string> {
  const s = new Set<string>();
  for (const b of run.batches) if (b.status !== "rolled_back" && b.status !== "failed") for (const f of b.files) s.add(stem(f));
  for (const c of run.graph.cycles) for (const f of c) s.add(stem(f)); // cycles are always manual
  return s;
}

export function nextBatchId(run: RunLog): string {
  return "b" + String(run.batches.length + 1).padStart(2, "0");
}
