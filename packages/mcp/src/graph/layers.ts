import { listSourceFiles, importsOf, linesOf, isJs } from "./scan.js";

export interface FileNode {
  path: string;
  lines: number;
  imports: string[];   // internal deps (relative imports resolved)
  importedBy: string[];
}

export interface Graph {
  root: string;
  files: Record<string, FileNode>;
  /** layers[0] = files with no internal imports; last = entry points */
  layers: string[][];
  /** strongly connected components of size > 1 — handle by hand */
  cycles: string[][];
  stats: { files: number; jsFiles: number; tsFiles: number; edges: number; layers: number; cycleFiles: number };
}

export function buildGraph(root: string): Graph {
  const all = listSourceFiles(root, true, false);
  const known = new Set(all);
  const files: Record<string, FileNode> = {};
  for (const f of all) files[f] = { path: f, lines: linesOf(root, f), imports: importsOf(root, f, known), importedBy: [] };
  for (const f of all) for (const d of files[f].imports) files[d].importedBy.push(f);

  const cycles = tarjanCycles(all, files);
  const inCycle = new Set(cycles.flat());
  const layers = kahnLayers(all.filter((f) => !inCycle.has(f)), files, inCycle);

  const edges = all.reduce((n, f) => n + files[f].imports.length, 0);
  return {
    root,
    files,
    layers,
    cycles,
    stats: {
      files: all.length,
      jsFiles: all.filter(isJs).length,
      tsFiles: all.length - all.filter(isJs).length,
      edges,
      layers: layers.length,
      cycleFiles: inCycle.size,
    },
  };
}

/** Kahn: layer N = files whose internal imports are all in layers < N (cycle files count as "already done"). */
function kahnLayers(nodes: string[], files: Record<string, FileNode>, ignore: Set<string>): string[][] {
  const remaining = new Set(nodes);
  const done = new Set<string>(ignore);
  const out: string[][] = [];
  while (remaining.size) {
    const layer = [...remaining].filter((f) => files[f].imports.every((d) => done.has(d)));
    if (!layer.length) { out.push([...remaining].sort()); break; } // should not happen after SCC removal
    layer.sort();
    out.push(layer);
    for (const f of layer) { remaining.delete(f); done.add(f); }
  }
  return out;
}

/** Tarjan SCC; returns components with >1 node (real cycles). */
function tarjanCycles(nodes: string[], files: Record<string, FileNode>): string[][] {
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const comps: string[][] = [];

  const strong = (v: string) => {
    idx.set(v, index); low.set(v, index); index++;
    stack.push(v); onStack.add(v);
    for (const w of files[v].imports) {
      if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, idx.get(w)!));
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      let w: string;
      do { w = stack.pop()!; onStack.delete(w); comp.push(w); } while (w !== v);
      if (comp.length > 1) comps.push(comp.sort());
    }
  };
  for (const n of nodes) if (!idx.has(n)) strong(n);
  return comps.sort((a, b) => b.length - a.length);
}
