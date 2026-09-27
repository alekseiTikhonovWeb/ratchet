# Ratchet

Safe, incremental, rollback-able JavaScript → TypeScript migration, run by IBM Bob 2.0.

Built for the [IBM Bob 2.0 Hackathon](https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon), September 25–27, 2026.

Dashboard: https://ratchetjs.vercel.app · Video: https://youtu.be/vm6SY6j7_tE · Demo repo: [alekseiTikhonovWeb/mirador](https://github.com/alekseiTikhonovWeb/mirador) · Report: [`demo/report.html`](demo/report.html)

## Overview

A TypeScript migration is a graph-traversal problem wearing a typing costume. Convert one file and TypeScript demands types for everything it imports; those imports demand types for theirs; the pull request is now 60 files and nobody reviews it. An AI agent fails the same way, faster: it starts anywhere, invents types for modules it has not read, and "improves" code along the way.

Ratchet turns the migration into a sequence of small, verifiable, rollback-able steps. It reads the internal import graph and sorts files into topological layers, so every batch the agent converts already has typed imports. Bob does the mechanical conversion under a hard contract. The human makes two decisions per batch — approve the file list, approve the list of type claims — and reads nothing else. Two counters in CI, `.js` files and `any`, can only go down.

The run in this repository is real: a fork of [Mirador](https://github.com/ProjectMirador/mirador), an open-source IIIF viewer — 329 JavaScript files, 42 layers, 1,038 internal imports. Five batches, 48 files migrated, one batch rejected and rolled back, full suite of 1,255 tests green throughout. Every step is in `demo/run.json`, every Bob session in `bob_sessions/`.

## How It Works

**The loop, per batch:**

```
build_graph → next_batch (≤ 15 files, lowest open layer)
   → Bob converts under the contract
   → run_checks (tsc + tests related to the batch)
   → gate 2: human reads the type claims only
   → ratchet commit (counters go down) → record_step
   red checks or rejected gate → rollback → retry once → manual
```

**The contract Bob works under:**
- Only the listed files. Every import is already typed — read it, do not invent it.
- No runtime behavior changes. No refactors "while I'm here". No new dependencies.
- Never touch tests, `package.json`, `tsconfig.json` or build config.
- `any` is allowed when the type is honestly unknown — it is counted, and every one is listed at the gate. It may only appear in a batch that converts files; any other change may only lower the count.
- Every new `?`, `| null`, `| undefined`, interface, type and cast is listed for the human. Those are claims about runtime behavior; that is where bugs live.

**What the human sees:** the file list before conversion (gate 1) and the list of semantic type claims after (gate 2). Mechanical changes — `.js → .ts`, `: string` — are never read.

## The Run

Fork of `ProjectMirador/mirador`, measured before the first batch:

| Metric | Value |
|--------|-------|
| Files | 329 `.js/.jsx` · 42 layers · 1,038 internal imports · 0 cycles |
| Batches | 5 run · 4 landed · 1 rolled back |
| Migrated | 48 files (layer 0: 48 of 55) |
| `.js` files | 329 → 281 |
| `any` | 0 → 29 — every one counted and reviewed |
| Type claims reviewed at the gates | 105 (25 interfaces · 21 nullable · 15 optional · 23 `any` · 6 casts) |
| Checks | `tsc` green after every batch · full suite 1,255 tests green |
| Time in Bob | ~38 minutes for 48 files |

**The batch that did not land.** Batch 3 was the same Bob with the Migrator mode switched off and no contract. It converted the twelve files — and cleaned them up, reordered a few things, and converted a file outside the batch. Typecheck green, 1,255 tests green. Rejected at gate 2 anyway, because green tests do not prove behavior did not change, and rolled back. The same files went through under the contract in batch 5 and landed.

We then asked the Migrator mode itself to skip the contract and modernize while converting. It refused and explained why.

## Built on IBM Bob 2.0

| Bob feature | How Ratchet uses it |
|-------------|---------------------|
| Custom mode `Migrator` | The agent's role, the two gates, the hard limits — never touch tests or build config, never proceed without approval |
| Skill `ratchet-migrate` | The batch contract, repeated at the start and end of every batch |
| MCP server | Six tools: `build_graph`, `next_batch`, `run_checks`, `ratchet`, `record_step`, `render_report` |
| Subagents | Parallel conversion of independent files within a batch |
| Rollback | A bad batch undone in one step |
| HTML report | One self-contained file for whoever was not in the session |
| Session export | One file per batch in `bob_sessions/` |

## Technology Stack

- **MCP server / CLI**: Node.js 20, TypeScript, `@modelcontextprotocol/sdk` (stdio transport), zod
- **Import graph**: regex over `import`/`require` with relative paths, Kahn layering, Tarjan for cycles
- **Dashboard**: Vite, React 18, TypeScript, Tailwind v4 — no backend, reads `run.json`
- **Report**: self-contained HTML rendered from `run.json`
- **CI**: 12-line bash ratchet + GitHub Actions
- **Hosting**: Vercel (dashboard)

## Repository Structure

```
ratchet/
├── packages/
│   ├── mcp/            [MCP server + CLI: graph, tools, counters, report]
│   ├── dashboard/      [Vite + React dashboard, reads run.json]
│   └── report/         [reserved: React-based report renderer]
├── bob/
│   ├── skills/         [ratchet-migrate SKILL.md — the batch contract]
│   └── modes/          [Migrator custom mode]
├── ci/
│   ├── ratchet.sh      [the ratchet: two counters that only go down]
│   └── demo-repo/      [tsconfig.json + GitHub Actions workflow for the repo being migrated]
├── demo/               [run.json + report.html from the Mirador run]
├── bob_sessions/       [exported Bob sessions, one per batch]
└── docs/               [demo repo notes, roadmap]
```

## Local Development

**Requirements:**
- Node.js 20+
- IBM Bob IDE 2.0.2+ (free trial)
- A JavaScript repository with a test runner that resolves `.ts` imports (Vitest, Jest via CRA/Babel)

**Setup Steps:**

1. Clone and build:
   ```bash
   git clone https://github.com/alekseiTikhonovWeb/ratchet.git
   cd ratchet && npm install && npm run build
   ```

2. Prepare the repository you are migrating:
   ```bash
   cd ../your-repo
   npm i -D typescript @types/node          # React: + @types/react @types/react-dom
   cp ../ratchet/ci/demo-repo/tsconfig.json tsconfig.json
   mkdir -p ci .github/workflows
   cp ../ratchet/ci/ratchet.sh ci/
   cp ../ratchet/ci/demo-repo/ratchet.yml .github/workflows/
   npx tsc --noEmit                         # expect 0 errors (allowJs, strict off)
   bash ci/ratchet.sh --init                # baseline: .ratchet/js-count, .ratchet/any-count
   ```

3. Build the graph:
   ```bash
   node ../ratchet/packages/mcp/dist/cli.js graph .
   ```

4. Add the MCP server to Bob (Settings → MCP):
   ```json
   {
     "mcpServers": {
       "ratchet": {
         "command": "node",
         "args": ["/abs/path/ratchet/packages/mcp/dist/server.js"],
         "env": { "RATCHET_ROOT": "/abs/path/your-repo" }
       }
     }
   }
   ```

5. In Bob: create the skill `ratchet-migrate` from `bob/skills/ratchet-migrate/SKILL.md`, create the mode `Migrator` from `bob/modes/migrator.md`, open the repository, switch to Migrator and say: *Migrate this project to TypeScript with Ratchet.*

## CLI Usage

The same six tools without Bob, for terminals and CI:

```bash
node packages/mcp/dist/cli.js graph   /path/repo             # layers, cycles → run.json
node packages/mcp/dist/cli.js next    /path/repo --max 12    # next batch + typed deps + contract
node packages/mcp/dist/cli.js checks  /path/repo --batch b01 # tsc + related tests
node packages/mcp/dist/cli.js ratchet /path/repo --mode check|commit|init
node packages/mcp/dist/cli.js record  /path/repo --batch b01 --status done --session bob_sessions/b01.json
node packages/mcp/dist/cli.js report  /path/repo             # report.html
```

Dashboard:
```bash
cd packages/dashboard && npm run dev      # replays demo/run.json; drop any run.json onto the page
```

## Engineering Principles

- **Order is the whole game**: leaves first, so the agent reads types instead of inventing them. Cycles are never handed to an agent.
- **The agent does not choose**: which files, in what order, when to stop — all decided by the tools, not the model.
- **Types only**: a batch that changes behavior is rejected regardless of test results.
- **`any` is counted, not banned**: a counted `any` beats a confident wrong type. Banning it produces confident fiction.
- **Two gates, nothing else**: the human reads the file list and the type claims. Mechanical diffs are skipped.
- **The ratchet outlives the migration**: the CI script stays after the last `.js` is gone.
- **One contract between parts**: `run.json`. The MCP server writes it, the dashboard and the report read it. Bob never talks to the dashboard.

## Deployment

- **Dashboard**: Vercel, Root Directory `packages/dashboard`, framework Vite (`vercel.json`). The committed `src/demo/run.json` is what it replays; `npm run sync-demo` refreshes it from `demo/`.
- **CI on the migrated repo**: `.github/workflows/ratchet.yml` — install, tests, `tsc --noEmit`, `bash ci/ratchet.sh --check`. Fails on any `.js` added or any `any` added without a conversion.

## Testing

```bash
npm run build                                    [tsc, both packages]
node packages/mcp/dist/cli.js graph <repo>       [graph on any JS repo]
bash ci/ratchet.sh --check                       [ratchet, in the migrated repo]
```

The engine was validated on a synthetic fixture (4 layers, 1 cycle, a provoked regression → rollback) and on the Mirador fork above.

## Project Status

**Completed:**
- MCP server with six tools, CLI mirror, ratchet script, CI workflow
- Bob skill and custom mode; five real batches on Mirador with session exports
- Dashboard with replay and `run.json` drag-and-drop; HTML report

**Known limits:**
- Import graph handles relative paths only — path aliases, `baseUrl` and monorepo workspaces are not resolved
- Test-runner detection covers Vitest, Jest, CRA and Mocha
- Bob's native Workflows are not open for authoring yet; the workflow is implemented as mode + skill + MCP

**Future:**
- Same engine, next packages: class components → hooks, Create React App → Vite, test-coverage push
- Dashboard reading `run.json` straight from a GitHub URL
- Granite summaries in the report
- Per-batch git commits from `record_step`

## License & Contact

MIT.

Team: Aleksei Tikhonov (engine, Bob integration, dashboard) · Ulan (infrastructure, CI, deploy) · Sofia (demo repo, pitch, video).

GitHub: alekseiTikhonovWeb
