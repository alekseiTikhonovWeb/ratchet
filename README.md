# Ratchet

**Safe, incremental, rollback-able JavaScript → TypeScript migration, run by IBM Bob 2.0.**

A TS migration is a graph-traversal problem wearing a typing costume. Convert files in the wrong order and every change drags in its dependencies; convert them in the right order and every change is boring. Boring is what you delegate to an agent — as long as it cannot go backwards.

Ratchet gives Bob the order (topological layers of the import graph), a hard per-batch contract, checks, two human gates, rollback, and two counters — `.js` files and `any` — that can only go down.

```
graph → layers → batch (≤15 files) → Bob converts → typecheck + tests
  ↑                                        │ red → rollback ─┘
  └── ratchet commits ← human reads types only ← green
```

Built for the [IBM Bob 2.0 Hackathon](https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon), September 25–27, 2026.

## What is in the box

| Path | What |
| --- | --- |
| `packages/mcp` | MCP server (stdio) + CLI: `build_graph`, `next_batch`, `run_checks`, `ratchet`, `record_step`, `render_report` |
| `bob/skills/ratchet-migrate` | Bob Skill — the batch contract and the loop |
| `bob/modes/migrator.md` | Bob custom mode **Migrator** — role, gates, hard limits |
| `ci/ratchet.sh` | The ratchet: two counters that only go down; fails CI otherwise |
| `ci/demo-repo/` | `tsconfig.json` and GitHub Actions workflow to drop into the repo being migrated |
| `packages/dashboard` | Live dashboard: layer map, counters, batch feed (reads `run.json`) |
| `demo/` | A recorded run (`run.json`, `report.html`) — what the dashboard replays |
| `bob_sessions/` | Exported Bob sessions, one per batch |

## Install (5 commands)

```bash
git clone https://github.com/alekseiTikhonovWeb/ratchet && cd ratchet
npm install && npm run build
# in the repo you are migrating:
cp ../ratchet/ci/demo-repo/tsconfig.json tsconfig.json && mkdir -p ci && cp ../ratchet/ci/ratchet.sh ci/
npm i -D typescript @types/node        # React: + @types/react @types/react-dom @types/jest
bash ci/ratchet.sh --init              # baseline: .ratchet/js-count, .ratchet/any-count
```

Add the MCP server to Bob (Settings → MCP):

```json
{
  "ratchet": {
    "command": "node",
    "args": ["/abs/path/ratchet/packages/mcp/dist/server.js"],
    "env": { "RATCHET_ROOT": "/abs/path/repo-being-migrated" }
  }
}
```

Add `bob/skills/ratchet-migrate` in Bob's Skills tab, create the **Migrator** mode from `bob/modes/migrator.md`, switch to it and say:

> Migrate this project to TypeScript with Ratchet.

## CLI (same tools, no Bob)

```bash
npm run ratchet -- graph   /path/repo            # layers, cycles, writes run.json
npm run ratchet -- next    /path/repo --max 15   # next batch + typed deps + contract
npm run ratchet -- checks  /path/repo --batch b01
npm run ratchet -- ratchet /path/repo --mode check|commit|init
npm run ratchet -- record  /path/repo --batch b01 --status done --session bob_sessions/b01.json
npm run ratchet -- report  /path/repo            # report.html
```

## The contract Bob works under

- Only the listed files. Every import is already typed — read it, don't invent it.
- No runtime behavior changes. No refactors "while I'm here".
- `any` allowed when honestly unknown — it is counted. It may only appear in a batch that converts files; every other change may only lower it.
- Every new `?`, `| null`, `| undefined`, interface, type: listed for the human gate. That is where bugs live.
- Finish with checks; paste the output.

## Demo

Demo repo: a fork of [ProjectMirador/mirador](https://github.com/ProjectMirador/mirador) — 329 files, 42 layers, 1038 internal imports, 0 cycles ([why](docs/demo-repo.md)).

Dashboard: _URL_ · Report: [`demo/report.html`](demo/report.html) · Video: _URL_

```bash
cd packages/dashboard && npm run dev   # replays demo/run.json; drop any run.json onto the page
```

## Roadmap

See [`docs/roadmap.md`](docs/roadmap.md). Same engine, next packages: class components → hooks, CRA → Vite, coverage push.

## License

MIT
