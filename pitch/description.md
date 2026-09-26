# Ratchet — lablab.ai submission description (draft)

_Fill the `—` placeholders on Saturday from run.json. Keep it concrete: numbers, tool names, what Bob did._

## Problem

Migrating a JavaScript codebase to TypeScript is not a typing problem — it is a graph-traversal problem wearing a typing costume. Convert one file and TypeScript demands types for everything it imports; those imports demand types for theirs; the PR is now 60 files and rots in review for three weeks. That is how most migrations die, and it is also how AI agents die at them: asked to "migrate this repo", an agent starts anywhere, invents types for things it has not seen, and "improves" code along the way.

## What Ratchet does

Ratchet turns a migration into a sequence of small, verifiable, rollback-able steps. IBM Bob does the boring conversion; the human makes three decisions and reads nothing else.

1. **Graph.** An MCP tool builds the internal import graph and sorts files into topological layers. Layer 0 has no internal imports; the last layer is the entry points. Cycles are isolated and marked *manual* — agents and humans both migrate cycles badly.
2. **Ratchet.** Two counters in CI — `.js` files and `any` — that can only go down. A batch that raises either fails CI. Every successful batch lowers the ceiling. `any` is allowed but counted: a counted `any` beats a confident wrong type.
3. **Batch.** Up to 15 files from the lowest open layer, with a hard contract: every import is already typed, so read the real types; do not change runtime behavior; do not touch anything outside the list.
4. **Gates.** Bob shows the batch before touching it and the list of semantic type claims (`?`, `| null`, new interfaces) after. Green checks + human approval → ratchet commits. Red → Bob rollback, retry once, then *manual*.
5. **Report.** A self-contained HTML report: layer map, counters, batch feed with Bob session exports.

## Built on IBM Bob 2.0

- Custom mode **Migrator** — the agent's role, the two gates, the hard limits
- Skill **ratchet-migrate** — the batch contract, repeated every batch
- MCP server **ratchet** (Node/TypeScript, stdio) — `build_graph`, `next_batch`, `run_checks`, `ratchet`, `record_step`, `render_report`
- Subagents — parallel conversion of independent files in a layer
- Rollback — a red batch is undone in one step
- HTML report — handed to whoever was not in the session
- — sessions exported to `bob_sessions/` for traceability

## The run

Demo repo: — (— `.js/.jsx` files, — layers, — cycle(s)). — batches, — rollback(s), `.js` — → —, `any` — → —, — real bugs caught at the semantic gate, — production incidents. Built in 48 hours.

## Who it is for

Teams with 5–8-year-old React/Node codebases where the migration sits in the backlog forever; agencies inheriting client apps; tech leads who want to delegate mechanical work to an agent but do not trust it. IBM's Java, COBOL and RPG modernization packages already prove that migration is a workflow with human gates, not a prompt. Ratchet is that workflow for the JS/TS ecosystem — the front end of every IBM Java customer.

## Next

Class components → hooks. CRA → Vite. Coverage push (same engine: graph, batch, ratchet). Granite summaries in the report.
