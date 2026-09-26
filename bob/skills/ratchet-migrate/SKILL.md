---
name: ratchet-migrate
description: Migrate a JavaScript codebase to TypeScript one safe batch at a time using the Ratchet MCP tools — layer order, hard batch contract, checks, human gates, rollback, counters that only go down. Use when asked to migrate/convert a repo or folder to TypeScript, or when the user mentions Ratchet.
---

# Ratchet — safe incremental JS → TypeScript migration

You are the agent inside a workflow. The workflow decides **what** to migrate and **in which order**;
you do the mechanical conversion of one batch and nothing else. The human approves twice per batch.

## Why the order matters

A TS migration is a graph-traversal problem wearing a typing costume. Convert a file whose imports
are still untyped and you must invent types for them — and you will invent them wrong. Convert files
whose imports are **already typed** and every annotation can be *read* instead of guessed.
Ratchet gives you files in that order. Never pick files yourself.

## The loop (one batch)

1. `build_graph` — once per run (skip if `run.json` exists and the user did not ask for a reset).
   Report layers, file counts and **cycles**. Files in cycles are migrated by a human, never by you.
2. `next_batch` — returns `files`, `typedDeps` and the contract. If a batch is already open it returns
   that one again (`reopened: true`): finish it, never open a second one. **Stop and show the user the layer
   and the file list. Wait for approval.** (Gate 1)
3. Migrate the batch under the contract below. Use subagents (3–5 files each) when the batch has
   more than 8 files; each subagent gets the same contract; merge before step 4.
4. `run_checks` with the `batchId` — it runs `tsc` and only the tests related to the batch's files
   (fast). Paste both outputs in full. Renaming alone usually surfaces real type errors (strict
   library types): fix them with **types only** — a cast, an interface, a module augmentation —
   never by changing what the code does.
5. `ratchet` with `mode: "check"`. `any` may go up in a converting batch (it is counted, list each
   one at the gate); it may never go up otherwise, and `.js` count may never go up.
6. **Stop and show the user the list of semantic changes** — every new `?`, `| null`, `| undefined`,
   `interface`, `type`, cast and `any` you introduced, with file and symbol. **Wait for approval.** (Gate 2)
   - Approved and green → `ratchet` with `mode: "commit"`, then `record_step` with `status: "done"`
     (it refuses `done` while the last `run_checks` is red),
     the `semantic` list and the exported session path.
   - Red, or rejected → roll the batch back (Bob rollback to the turn before step 3), then
     `record_step` with `status: "rolled_back"` and a one-line reason. Retry once with the reason in mind.
     Second failure → `record_step` with `status: "manual"` and move on.
7. Repeat from 2 until `next_batch` returns `done: true`, then `render_report`.

## Batch contract (non-negotiable)

- Convert **only** the listed files: `git mv x.jsx x.tsx`; `x.js → x.ts`, or `x.tsx` if the file contains JSX. Then annotate.
- Every module the batch imports is already typed (`typedDeps`). **Read those types first.**
  Never invent an interface for something you can read.
- **Do not change runtime behavior.** No reordering, no refactors, no `var→const` sweeps,
  no Promise rewrites, no error-handling changes, no new dependencies, no "while I'm here".
- Do not touch files outside the list. Do not touch tests, `package.json`, `tsconfig.json`, build config.
- `any` is allowed when the type is honestly unknown (external SDK, webhook payload, legacy serializer).
  A counted `any` beats a confident wrong type. Every `any` you add goes on the semantic list.
- Every new `?`, `| null`, `| undefined`, `interface`, `type`, cast — list it. These are claims about
  runtime behavior; that is where the bugs live and what the human reads.
- Finish with `run_checks` and paste both outputs.

## Things that go wrong

- A test fails after conversion → you changed behavior, not just types. Roll back; do not "fix the test".
- `tsc` cannot find `require` / `module` → the repo needs `@types/node` (React: `@types/react`, `@types/jest`).
  Tell the user; do not add dependencies yourself.
- Two files "redeclare" the same name → `tsconfig` needs `"moduleDetection": "force"`. Tell the user.
- The import of a migrated file still says `./x.js` → leave it; bundlers and TS resolve it. Do not rename imports.
