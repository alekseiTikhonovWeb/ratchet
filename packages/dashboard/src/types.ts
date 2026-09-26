// Mirror of packages/mcp/src/run.ts — the run.json contract.
export interface SemanticChange {
  file: string;
  kind: "optional" | "nullable" | "interface" | "type" | "cast" | "any" | "other";
  symbol: string;
  note?: string;
}

export type BatchStatus = "pending" | "done" | "rolled_back" | "manual" | "failed";

export interface Batch {
  id: string;
  layer: number;
  files: string[];
  status: BatchStatus;
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

export interface RunLog {
  version: 1;
  repo: string;
  src?: string;
  startedAt: string;
  updatedAt: string;
  graph: {
    layers: string[][];
    cycles: string[][];
    files: Record<string, { lines: number; imports: string[] }>;
    stats: { files: number; jsFiles: number; tsFiles: number; edges: number; layers: number; cycleFiles: number };
  };
  ratchet: { js: number[]; any: number[] };
  batches: Batch[];
}

export const stem = (f: string) => f.replace(/\.(jsx?|tsx?|mjs|cjs)$/, "");
export const isJs = (f: string) => /\.(js|jsx|mjs|cjs)$/.test(f);

/** File color = status. Reserved status palette; never reused for series. */
export type FileState = "js" | "ts" | "pending" | "rolled_back" | "manual";
export const STATE_COLOR: Record<FileState, string> = {
  js: "#64748b",          // untouched JavaScript
  ts: "#22c55e",          // TypeScript (migrated or pre-existing)
  pending: "#eab308",     // in the current batch
  rolled_back: "#ef4444", // last attempt rolled back
  manual: "#a78bfa",      // cycle / by hand
};
export const STATE_LABEL: Record<FileState, string> = {
  js: "JS untouched",
  ts: "TypeScript",
  pending: "in batch",
  rolled_back: "rolled back",
  manual: "cycle / manual",
};
