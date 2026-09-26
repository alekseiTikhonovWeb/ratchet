import { useMemo } from "react";
import { stem, isJs, type RunLog, type Batch, type FileState } from "./types";

export interface State {
  run: RunLog;
  /** how many batches are shown (replay) */
  revealed: number;
  playing: boolean;
  source: "demo" | "file";
}

export type Action =
  | { type: "load"; run: RunLog; source: State["source"] }
  | { type: "reveal"; n: number }
  | { type: "step" }
  | { type: "play" }
  | { type: "pause" }
  | { type: "replay" };

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "load": return { run: a.run, revealed: a.run.batches.length, playing: false, source: a.source };
    case "reveal": return { ...s, revealed: Math.max(0, Math.min(a.n, s.run.batches.length)) };
    case "step": {
      const n = s.revealed + 1;
      return n > s.run.batches.length ? { ...s, playing: false } : { ...s, revealed: n };
    }
    case "play": return { ...s, playing: true, revealed: s.revealed >= s.run.batches.length ? 0 : s.revealed };
    case "pause": return { ...s, playing: false };
    case "replay": return { ...s, revealed: 0, playing: true };
  }
}

export interface View {
  batches: Batch[];                     // visible batches
  js: number[]; any: number[];          // counter series up to the visible point
  stateOf: (file: string) => FileState; // color of a file on the map
  batchOf: (file: string) => Batch | undefined;
  cycleSet: Set<string>;
  migrated: number; total: number;
}

export function useView(s: State): View {
  return useMemo(() => {
    const { run, revealed } = s;
    const batches = run.batches.slice(0, revealed);
    const latest = new Map<string, Batch>();          // stem → latest visible batch
    for (const b of batches) for (const f of b.files) latest.set(stem(f), b);
    const inAnyBatch = new Set<string>();
    for (const b of run.batches) for (const f of b.files) inAnyBatch.add(stem(f));
    const cycleSet = new Set(run.graph.cycles.flat().map(stem));

    const stateOf = (file: string): FileState => {
      const k = stem(file);
      if (cycleSet.has(k)) return "manual";
      const b = latest.get(k);
      if (b) {
        if (b.status === "pending") return "pending";
        if (b.status === "rolled_back" || b.status === "failed") return "rolled_back";
        if (b.status === "manual") return "manual";
        return "ts";
      }
      if (inAnyBatch.has(k)) return "js";  // touched later in the run — not yet, in replay
      return isJs(file) ? "js" : "ts";
    };

    const doneStatuses = batches.filter((b) => b.status === "done").length;
    // counters: index 0 = baseline, one point per committed (done) batch
    const pts = Math.min(run.ratchet.js.length, doneStatuses + 1);
    const total = run.ratchet.js[0] ?? run.graph.stats.jsFiles;
    const js = run.ratchet.js.slice(0, Math.max(1, pts));
    const any = run.ratchet.any.slice(0, Math.max(1, pts));
    return {
      batches, js, any, stateOf, cycleSet,
      batchOf: (f) => latest.get(stem(f)),
      migrated: total - (js.at(-1) ?? total), total,
    };
  }, [s]);
}
