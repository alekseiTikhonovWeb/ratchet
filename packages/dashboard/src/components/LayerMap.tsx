import { useEffect, useRef, useState } from "react";
import { STATE_COLOR, STATE_LABEL, type RunLog, type FileState } from "../types";
import type { View } from "../state";

const ORDER: FileState[] = ["js", "pending", "ts", "rolled_back", "manual"];

export function LayerMap({ run, view }: { run: RunLog; view: View }) {
  const [hover, setHover] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const layers = run.graph.layers;
  const cycles = run.graph.cycles.flat();
  const info = hover ? run.graph.files[hover] : null;
  const hb = hover ? view.batchOf(hover) : undefined;

  // the action starts at the leaves (bottom) — open the map there
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [run]);

  return (
    <section className="card flex min-h-0 min-w-0 flex-col">
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-wide text-slate-400">Layer map</h2>
        <span className="text-xs text-slate-500">bottom = leaves · top = entry points · {layers.length} layers</span>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-auto pr-1">
        {[...layers].map((files, i) => ({ files, i })).reverse().map(({ files, i }) => (
          <div key={i} className="flex items-start gap-2 py-[3px]">
            <div className="w-14 shrink-0 pt-[1px] text-right font-mono text-[11px] text-slate-500">
              L{i}<span className="ml-1 text-slate-600">{files.length}</span>
            </div>
            <div className="flex flex-wrap gap-[3px]">
              {files.map((f) => <Block key={f} file={f} lines={run.graph.files[f]?.lines ?? 10} state={view.stateOf(f)} onHover={setHover} />)}
            </div>
          </div>
        ))}
        {cycles.length > 0 && (
          <div className="mt-2 flex items-start gap-2 border-t border-dashed border-slate-800 pt-2">
            <div className="w-14 shrink-0 text-right font-mono text-[11px] text-violet-300">cycles<span className="ml-1 text-slate-600">{cycles.length}</span></div>
            <div className="flex flex-wrap gap-[3px]">
              {cycles.map((f) => <Block key={f} file={f} lines={run.graph.files[f]?.lines ?? 10} state="manual" onHover={setHover} />)}
            </div>
          </div>
        )}
      </div>

      <footer className="mt-3 border-t border-slate-800 pt-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-x-4 overflow-hidden whitespace-nowrap">
          {ORDER.map((k) => (
            <span key={k} className="flex shrink-0 items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: STATE_COLOR[k] }} />{STATE_LABEL[k]}</span>
          ))}
        </div>
        <div className="mt-1 h-5 truncate font-mono leading-5 text-slate-500" title={hover ?? undefined}>
          {hover ? (
            <>
              <span className="text-slate-300">{hover}</span>
              <span> · {info?.lines ?? "?"} lines · {info?.imports.length ?? 0} imports</span>
              {hb && <span> · {hb.id} <span style={{ color: STATE_COLOR[view.stateOf(hover)] }}>{hb.status}</span></span>}
            </>
          ) : "hover a file"}
        </div>
      </footer>
    </section>
  );
}

function Block({ file, lines, state, onHover }: { file: string; lines: number; state: FileState; onHover: (f: string | null) => void }) {
  const w = Math.max(10, Math.min(72, Math.round(Math.sqrt(lines) * 2.6)));
  return (
    <div
      className="h-[11px] rounded-[2px] transition-colors duration-500 hover:ring-2 hover:ring-white/70"
      style={{ width: w, background: STATE_COLOR[state] }}
      aria-label={`${file} · ${lines} lines · ${STATE_LABEL[state]}`}
      onMouseEnter={() => onHover(file)}
      onMouseLeave={() => onHover(null)}
    />
  );
}
