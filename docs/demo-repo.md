# Demo repo: ProjectMirador/mirador

Chosen Sat 26 Sep. IIIF image viewer, React 19 + MUI, Apache-2.0. Measured on a fresh clone:

| | |
| --- | --- |
| `.js/.jsx` in `src/` | 329 (203 `.js`, 126 `.jsx`; only 1 `.js` contains JSX) |
| Internal import edges | 1038 |
| Layers | 42 — layer 0 = 55 leaf components, layer 41 = entry point |
| Cycles | 0 |
| Tests | Vitest, 87 test files under `__tests__/src/**` mirroring `src/**` — `__tests__/src/components/X.test.jsx` ↔ `src/components/X.jsx` |
| Typecheck | `tsc --noEmit` passes on the untouched repo with our tsconfig (allowJs) |
| First batch dry run | renaming 12 leaf components to `.tsx` surfaces 9 real type errors in 4 files (MUI is strict) — that is Bob's job on camera |

Why not the others: `node-express-boilerplate` needs a live MongoDB for tests; `bookshelf` is GPL with absolute imports; `react-redux-realworld` and `sound-redux` have no tests; `dayjs` has a flat graph (140 locales).

## Prepare the fork (Алексей or Улан, ~15 min)

```bash
# 1. Fork github.com/ProjectMirador/mirador on GitHub, then:
git clone https://github.com/<you>/mirador demo-mirador && cd demo-mirador
npm install

# 2. Types for TS files (React 19, TypeScript is already a devDependency)
npm i -D @types/react@19 @types/react-dom@19

# 3. Ratchet files
cp ../ratchet/ci/demo-repo/tsconfig.json tsconfig.json
mkdir -p ci .github/workflows
cp ../ratchet/ci/ratchet.sh ci/ratchet.sh
cp ../ratchet/ci/demo-repo/ratchet.yml .github/workflows/ratchet.yml
#    the workflow's test step must be Vitest directly (npm test also builds + lints + size-checks):
sed -i 's|npm test -- --watchAll=false|npx vitest run|' .github/workflows/ratchet.yml

# 4. Verify + baseline
npx tsc --noEmit                 # 0 errors expected
npx vitest run __tests__/src/lib # ~20 s, all green (full suite is several minutes — leave it to CI)
bash ci/ratchet.sh --init        # .ratchet/js-count = 329, any-count = 0

git add -A && git commit -m "ratchet: baseline (tsconfig, ratchet.sh, CI, @types/react)" && git push
```

GitHub → Actions should go green on that push. Then one deliberately red run: add `src/tmp.js`, push, screenshot the red check, `git revert`, push.

## Point Ratchet at it

```bash
cd ../ratchet && npm run build
node packages/mcp/dist/cli.js graph ../demo-mirador      # 42 layers, run.json written into the fork
```

Bob MCP config (`RATCHET_ROOT` = absolute path of `demo-mirador`):

```json
{ "ratchet": { "command": "node", "args": ["<abs>/ratchet/packages/mcp/dist/server.js"], "env": { "RATCHET_ROOT": "<abs>/demo-mirador" } } }
```

## Mirador-specific rules for Bob (already in the Skill)

- `.jsx → .tsx`. A `.js` that contains JSX → `.tsx` (there is exactly one). Everything else `.js → .ts`.
- `run_checks` with a `batchId` runs only the batch's related tests (`__tests__/src/<same path>.test.jsx`) — 10–30 s. Full suite stays in CI.
- MUI types are strict. Expected fixes on batch 1: `variant="compact"` on `Paper` (custom variant — augment `PaperPropsVariantOverrides` or cast), `getOverlayAlpha(...)` returns string where a number is expected, `classes` prop typed as `{}` → declare the class keys. None of these change runtime behavior.
- Do not touch `vitest.config.ts`, `vite.config.js`, `eslint.config.js`, `package.json`.

## Golden path on mirador

1. Bob, mode **Migrator**: "Migrate this project to TypeScript with Ratchet. build_graph, then next_batch with maxFiles 12."
2. Map: 42 layers, 329 files, 0 cycles. Batch 1 = 12 leaf components from L0. Approve.
3. Bob converts (subagents ×2 on 6 files each), `run_checks` → tsc shows the MUI errors → Bob fixes types only → green, related tests green.
4. Gate 2: the semantic list (new props interfaces, `?`, `| null`, one `any` for i18n config). Approve → `ratchet commit` 329 → 317.
5. Batch 2: provoke a behavior change (or let Bob "improve" something) → related test red → rollback → retry → green.
6. Batch 3 → `render_report`. Final dashboard: L0 mostly green, counters 329 → 305.
