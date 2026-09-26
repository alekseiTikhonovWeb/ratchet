import type { Batch } from "../types";

const STATUS: Record<Batch["status"], { text: string; cls: string; icon: string }> = {
  done: { text: "done", cls: "text-emerald-400", icon: "✓" },
  pending: { text: "in progress", cls: "text-yellow-400", icon: "…" },
  rolled_back: { text: "rolled back", cls: "text-red-400", icon: "↺" },
  failed: { text: "failed", cls: "text-red-400", icon: "✕" },
  manual: { text: "manual", cls: "text-violet-300", icon: "✎" },
};

export function BatchFeed({ batches }: { batches: Batch[] }) {
  return (
    <section className="card flex min-h-0 min-w-0 flex-col">
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-wide text-slate-400">Batches</h2>
        <span className="text-xs text-slate-500">{batches.length} shown</span>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        {batches.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No batches yet — press Replay.</p>}
        {[...batches].reverse().map((b) => <Card key={b.id} b={b} />)}
      </div>
    </section>
  );
}

function Card({ b }: { b: Batch }) {
  const s = STATUS[b.status];
  return (
    <article className="border-t border-slate-800 py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <b className="font-mono text-slate-100">{b.id}</b>
        <span className="text-slate-400">L{b.layer} · {b.files.length} files</span>
        <span className={`${s.cls}`}>{s.icon} {s.text}</span>
        {b.durationSec != null && <span className="text-slate-500">· {fmt(b.durationSec)}</span>}
        {b.attempts && b.attempts > 1 && <span className="text-slate-500">· attempt {b.attempts}</span>}
      </div>
      {b.checks && (
        <div className="mt-1 text-xs text-slate-400">
          typecheck {b.checks.typecheck.ok ? <Ok /> : <Bad n={b.checks.typecheck.errors} what="errors" />} · tests{" "}
          {b.checks.tests.ok ? <Ok /> : <Bad n={b.checks.tests.failed} what="failed" />} {b.checks.tests.passed} passed
        </div>
      )}
      {b.notes && <p className="mt-1 text-xs text-red-300/90">{b.notes}</p>}
      {b.semantic && b.semantic.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-xs">
          {b.semantic.map((c, i) => (
            <li key={i} className="flex flex-wrap gap-x-1.5">
              <code className="rounded bg-slate-800 px-1 text-[10px] text-slate-300">{c.kind}</code>
              <span className="font-mono text-slate-200">{c.symbol}</span>
              <span className="text-slate-500">{c.file.split("/").pop()}</span>
              {c.note && <span className="text-slate-500">— {c.note}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1.5 truncate text-[11px] text-slate-600" title={b.files.join("\n")}>{b.files.map((f) => f.split("/").pop()).join(", ")}</div>
      {b.session && <div className="text-[11px] text-slate-600">session: {b.session}</div>}
    </article>
  );
}

function Ok() { return <span className="text-emerald-400">✓</span>; }
function Bad({ n, what }: { n: number; what: string }) { return <span className="text-red-400">✕ {n} {what}</span>; }
function fmt(s: number) { return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`; }
