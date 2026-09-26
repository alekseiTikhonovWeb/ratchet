import { useEffect, useReducer, useRef, useState } from "react";
import demoRun from "./demo/run.json";
import { reducer, useView } from "./state";
import type { RunLog } from "./types";
import { LayerMap } from "./components/LayerMap";
import { Counters } from "./components/Counters";
import { BatchFeed } from "./components/BatchFeed";

const demo = demoRun as unknown as RunLog;

export default function App() {
  const [s, dispatch] = useReducer(reducer, { run: demo, revealed: demo.batches.length, playing: false, source: "demo" as const });
  const view = useView(s);
  const [speed, setSpeed] = useState(1200);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!s.playing) return;
    const t = setTimeout(() => dispatch({ type: "step" }), speed);
    return () => clearTimeout(t);
  }, [s.playing, s.revealed, speed]);

  const load = async (f: File) => {
    try {
      const run = JSON.parse(await f.text()) as RunLog;
      if (!run.graph?.layers || !run.batches) throw new Error("not a run.json");
      dispatch({ type: "load", run, source: "file" });
    } catch (e) {
      alert(`Could not load ${f.name}: ${(e as Error).message}`);
    }
  };

  const { run } = s;
  const st = run.graph.stats;

  return (
    <div
      className="mx-auto flex h-screen max-w-[1400px] flex-col gap-3 p-3 md:p-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) load(f); }}
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-[3px] bg-emerald-500" />
          <h1 className="text-lg font-semibold tracking-tight text-slate-100">Ratchet</h1>
          <span className="text-sm text-slate-500">JS → TS Migrator</span>
        </div>
        <div className="font-mono text-xs text-slate-400">
          {run.repo} · {st.files} files · {st.layers} layers · {st.edges} imports{st.cycleFiles ? ` · ${st.cycleFiles} in cycles` : ""}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-slate-500">{s.source === "demo" ? "recorded run" : "loaded file"}</span>
          <button className="btn" onClick={() => dispatch({ type: "replay" })}>▶ Replay</button>
          <button className="btn" onClick={() => dispatch(s.playing ? { type: "pause" } : { type: "play" })} disabled={s.revealed >= run.batches.length && !s.playing}>
            {s.playing ? "❚❚" : "▶"}
          </button>
          <input
            type="range" min={0} max={run.batches.length} value={s.revealed}
            onChange={(e) => dispatch({ type: "reveal", n: Number(e.target.value) })}
            className="w-28 accent-emerald-500" aria-label="batches revealed"
          />
          <span className="w-10 font-mono text-xs text-slate-400">{s.revealed}/{run.batches.length}</span>
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="btn" aria-label="replay speed">
            <option value={2500}>slow</option><option value={1200}>1×</option><option value={500}>fast</option>
          </select>
          <button className="btn" onClick={() => fileRef.current?.click()}>Load run.json</button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ""; }} />
        </div>
      </header>

      <main className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <LayerMap run={run} view={view} />
        <div className="grid min-h-0 min-w-0 grid-rows-[auto_1fr] gap-3">
          <Counters view={view} />
          <BatchFeed batches={view.batches} />
        </div>
      </main>
    </div>
  );
}
