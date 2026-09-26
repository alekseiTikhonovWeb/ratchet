# Ratchet dashboard

Vite + React 18 + TypeScript + Tailwind v4. One page, no backend, no router.

- Reads `src/demo/run.json` (synced from `../../demo/run.json` by `npm run sync-demo`, also committed so Vercel builds from this folder alone).
- Three zones: layer map (bottom = leaves), two ratchet counters with sparklines, batch feed.
- **Replay** reveals batches one by one; the slider scrubs; **Load run.json** or drag-and-drop shows a real run.
- Colors are the reserved status palette from `src/types.ts` (JS grey · in batch yellow · TS green · rolled back red · cycle/manual purple); the legend and the feed carry the labels, never color alone.

```bash
npm run dev      # http://localhost:5173
npm run build    # tsc + vite → dist/
```

Vercel: Root Directory `packages/dashboard`, framework Vite (see `vercel.json`).
