import { useState } from "react";
import type { View } from "../state";

export function Counters({ view }: { view: View }) {
  return (
    <section className="card min-w-0">
      <h2 className="mb-3 text-xs uppercase tracking-wide text-slate-400">Ratchet</h2>
      <div className="grid grid-cols-2 gap-3">
        <Kpi label=".js / .jsx files" series={view.js} color="#22c55e" fromLabel="baseline" upIsBad />
        <Kpi label="any (counted, not banned)" series={view.any} color="#eab308" fromLabel="ceiling" />
      </div>
      <p className="mt-3 text-[11px] leading-snug text-slate-500">
        Two counters in <code className="text-slate-400">.ratchet/</code>, enforced in CI. <span className="text-slate-400">.js</span> never goes up.{" "}
        <span className="text-slate-400">any</span> may only appear in a batch that converts files — and is listed at the gate; every other change may only lower it.
        {view.migrated > 0 && <> <span className="text-slate-300">{view.migrated} of {view.total}</span> files migrated so far.</>}
      </p>
    </section>
  );
}

function Kpi({ label, series, color, fromLabel, upIsBad = false }: { label: string; series: number[]; color: string; fromLabel: string; upIsBad?: boolean }) {
  const now = series.at(-1) ?? 0;
  const first = series[0] ?? 0;
  const delta = now - first;
  const tone = delta < 0 ? "text-emerald-400" : delta > 0 ? (upIsBad ? "text-red-400" : "text-yellow-400") : "text-slate-500";
  return (
    <div className="rounded-lg bg-[#0f172a] p-3">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums text-slate-100">{now}</span>
        <span className={`text-xs tabular-nums ${tone}`}>
          {delta === 0 ? `${fromLabel} ${first}` : `${delta > 0 ? "+" : ""}${delta}`}
        </span>
      </div>
      <Spark series={series} color={color} />
    </div>
  );
}

function Spark({ series, color }: { series: number[]; color: string }) {
  const [hi, setHi] = useState<number | null>(null);
  const W = 220, H = 56, P = 6;
  if (series.length < 2) {
    return <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-14 w-full"><text x="2" y="34" fill="#475569" fontSize="11">one point — waiting for the first batch</text></svg>;
  }
  const max = Math.max(...series), min = Math.min(...series);
  const x = (i: number) => P + (i / (series.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / Math.max(1, max - min)) * (H - 2 * P);
  const d = series.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-14 w-full" onMouseLeave={() => setHi(null)}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {series.map((v, i) => (
        <g key={i} onMouseEnter={() => setHi(i)}>
          <rect x={x(i) - 10} y={0} width={20} height={H} fill="transparent" />
          <circle cx={x(i)} cy={y(v)} r={hi === i ? 4 : 2.5} fill="#0f172a" stroke={color} strokeWidth={2} />
        </g>
      ))}
      {hi !== null && (
        <text x={Math.min(W - 40, Math.max(4, x(hi) - 12))} y={y(series[hi]) < 20 ? y(series[hi]) + 16 : y(series[hi]) - 8} fill="#e2e8f0" fontSize="11" fontFamily="ui-monospace, monospace">
          {hi === 0 ? "base" : `b${hi}`} {series[hi]}
        </text>
      )}
    </svg>
  );
}
