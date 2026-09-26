import { stem, type RunLog } from "./run.js";

const isJs = (f: string) => /\.(js|jsx|mjs|cjs)$/.test(f);

/** Self-contained HTML report: layer map, two counters, batch feed. No external assets. */
export function renderHtml(run: RunLog): string {
  // latest batch status per file stem (a file keeps its identity across .js → .ts)
  const status = new Map<string, string>();
  for (const b of run.batches) for (const f of b.files) status.set(stem(f), b.status);
  const cycleFiles = new Set(run.graph.cycles.flat());

  const color = (f: string) => {
    if (cycleFiles.has(f)) return "#8b5cf6";
    const s = status.get(stem(f));
    if (s === "pending") return "#eab308";
    if (s === "rolled_back" || s === "failed") return isJs(f) ? "#ef4444" : "#22c55e";
    if (s === "manual") return "#8b5cf6";
    return isJs(f) ? "#9ca3af" : "#22c55e"; // what exists on disk decides: .ts = migrated
  };

  const layersHtml = [...run.graph.layers]
    .map((files, i) => ({ files, i }))
    .reverse()
    .map(({ files, i }) => {
      const blocks = files
        .map((f) => {
          const lines = run.graph.files[f]?.lines ?? 10;
          const w = Math.max(14, Math.min(120, Math.round(Math.sqrt(lines) * 4)));
          return `<div class="f" title="${esc(f)} · ${lines} lines" style="width:${w}px;background:${color(f)}"></div>`;
        })
        .join("");
      return `<div class="layer"><div class="lbl">L${i}<span>${files.length}</span></div><div class="row">${blocks}</div></div>`;
    })
    .join("");

  const cyclesHtml = run.graph.cycles.length
    ? `<div class="layer cyc"><div class="lbl">cycles<span>${cycleFiles.size}</span></div><div class="row">${[...cycleFiles].map((f) => `<div class="f" title="${esc(f)}" style="width:20px;background:#8b5cf6"></div>`).join("")}</div></div>`
    : "";

  const js = run.ratchet.js, any = run.ratchet.any;
  const batches = run.batches
    .map(
      (b) => `<div class="b ${b.status}">
  <div class="bh"><b>${b.id}</b> · L${b.layer} · ${b.files.length} files · <em>${b.status}</em>${b.durationSec != null ? ` · ${b.durationSec}s` : ""}</div>
  ${b.checks ? `<div class="chk">typecheck ${b.checks.typecheck.ok ? "✅" : `❌ ${b.checks.typecheck.errors} errors`} · tests ${b.checks.tests.ok ? "✅" : "❌"} ${b.checks.tests.passed} passed${b.checks.tests.failed ? `, ${b.checks.tests.failed} failed` : ""}</div>` : ""}
  ${b.semantic?.length ? `<ul class="sem">${b.semantic.map((s) => `<li><code>${esc(s.kind)}</code> ${esc(s.symbol)} <span>${esc(s.file)}</span>${s.note ? ` — ${esc(s.note)}` : ""}</li>`).join("")}</ul>` : ""}
  <div class="files">${b.files.map(esc).join(", ")}</div>
  ${b.session ? `<div class="sess">session: ${esc(b.session)}</div>` : ""}
</div>`
    )
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Ratchet report — ${esc(run.repo)}</title>
<style>
:root{--bg:#0b0f14;--fg:#e5e7eb;--mut:#9ca3af;--card:#111827;--line:#1f2937}
body{margin:0;font:14px/1.45 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto;background:var(--bg);color:var(--fg)}
.wrap{max-width:1100px;margin:0 auto;padding:24px 16px}
h1{font-size:20px;margin:0 0 4px}.sub{color:var(--mut);margin-bottom:20px}
.grid{display:grid;grid-template-columns:2fr 1fr;gap:16px}@media(max-width:800px){.grid{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
.layer{display:flex;align-items:center;gap:10px;margin:6px 0}.lbl{width:64px;color:var(--mut);font-size:12px}.lbl span{margin-left:6px;color:#6b7280}
.row{display:flex;flex-wrap:wrap;gap:3px}.f{height:14px;border-radius:2px}
.cyc{border-top:1px dashed var(--line);padding-top:8px;margin-top:8px}
.kpi{display:flex;gap:12px}.kpi div{flex:1;background:#0f172a;border-radius:8px;padding:10px}.kpi b{display:block;font-size:28px}.kpi small{color:var(--mut)}
svg{width:100%;height:80px;margin-top:8px}
.b{border-top:1px solid var(--line);padding:10px 0}.b.done .bh em{color:#22c55e}.b.rolled_back .bh em,.b.failed .bh em{color:#ef4444}.b.manual .bh em{color:#8b5cf6}
.chk{color:var(--mut);font-size:13px}.sem{margin:6px 0 0;padding-left:18px;font-size:13px}.sem span{color:var(--mut);margin-left:6px}
.files{color:#6b7280;font-size:12px;margin-top:4px}.sess{color:#6b7280;font-size:12px}
.legend{display:flex;gap:14px;color:var(--mut);font-size:12px;margin-top:10px}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px}
</style></head><body><div class="wrap">
<h1>Ratchet — ${esc(run.repo)}</h1>
<div class="sub">${run.graph.stats.files} files · ${run.graph.stats.layers} layers · ${run.graph.stats.edges} internal imports · ${run.batches.length} batches · started ${run.startedAt.slice(0, 16).replace("T", " ")}</div>
<div class="grid">
  <div class="card">
    <div style="color:var(--mut);font-size:12px;margin-bottom:6px">Layer map (bottom = leaves, top = entry points)</div>
    ${layersHtml}${cyclesHtml}
    <div class="legend"><span><i style="background:#9ca3af"></i>JS untouched</span><span><i style="background:#eab308"></i>in batch</span><span><i style="background:#22c55e"></i>TypeScript</span><span><i style="background:#ef4444"></i>rolled back</span><span><i style="background:#8b5cf6"></i>cycle / manual</span></div>
  </div>
  <div class="card">
    <div class="kpi">
      <div><small>.js / .jsx files</small><b>${js.at(-1) ?? "–"}</b><small>from ${js[0] ?? "–"}</small></div>
      <div><small>any</small><b>${any.at(-1) ?? "–"}</b><small>ceiling ${any[0] ?? "–"} → only down</small></div>
    </div>
    ${spark(js, "#22c55e")}
    ${spark(any, "#eab308")}
  </div>
</div>
<div class="card" style="margin-top:16px">
  <div style="color:var(--mut);font-size:12px">Batches</div>
  ${batches || '<div class="files">No batches yet.</div>'}
</div>
</div></body></html>
`;
}

function spark(v: number[], stroke: string): string {
  if (v.length < 2) return `<svg viewBox="0 0 100 30"><text x="2" y="18" fill="#6b7280" font-size="8">${v.length ? "one point — run a batch" : "no data"}</text></svg>`;
  const max = Math.max(...v, 1), min = Math.min(...v);
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * 100},${28 - ((y - min) / Math.max(1, max - min)) * 24}`).join(" ");
  return `<svg viewBox="0 0 100 30" preserveAspectRatio="none"><polyline fill="none" stroke="${stroke}" stroke-width="1.5" points="${pts}"/></svg>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
