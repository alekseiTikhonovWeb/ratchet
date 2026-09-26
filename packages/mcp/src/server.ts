#!/usr/bin/env node
/**
 * Ratchet MCP server (stdio).
 *
 * Bob config (Settings → MCP → add server):
 *   command: node
 *   args:    ["/abs/path/to/ratchet/packages/mcp/dist/server.js"]
 *   env:     { "RATCHET_ROOT": "/abs/path/to/the/repo/being/migrated" }   (optional; every tool also takes `root`)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolve } from "node:path";
import * as t from "./tools/index.js";

const DEFAULT_ROOT = process.env.RATCHET_ROOT ?? process.cwd();
const rootOf = (r?: string) => resolve(r ?? DEFAULT_ROOT);
const json = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, null, 2) }] });
const fail = (e: unknown) => ({ content: [{ type: "text" as const, text: `ERROR: ${(e as Error).message}` }], isError: true });

const server = new McpServer({ name: "ratchet", version: "0.1.0" });

server.tool(
  "build_graph",
  "Scan the repo, build the internal import graph, sort files into topological layers (layer 0 = no internal imports), detect cycles. Writes run.json. Call this first.",
  { root: z.string().optional().describe("Repo root (default: RATCHET_ROOT)"), src: z.string().optional().describe("Source dir, default 'src' if present"), reset: z.boolean().optional().describe("Start a fresh run.json") },
  async ({ root, src, reset }) => { try { return json(t.build_graph(rootOf(root), { src, reset })); } catch (e) { return fail(e); } }
);

server.tool(
  "next_batch",
  "Return the next batch: up to maxFiles un-migrated .js files from the lowest open layer, plus the already-typed deps the agent must read, plus the migration contract. Records the batch as pending in run.json. If a batch is already open (pending), returns that one again instead of opening a new one.",
  { root: z.string().optional(), maxFiles: z.number().int().min(1).max(25).optional().describe("Default 15") },
  async ({ root, maxFiles }) => { try { return json(t.next_batch(rootOf(root), { maxFiles })); } catch (e) { return fail(e); } }
);

server.tool(
  "run_checks",
  "Run typecheck (tsc --noEmit) and tests. With batchId, runs only the tests related to the batch's files (fast); scope=full runs the whole suite. Returns pass/fail with the tail of both outputs and stores results on the batch.",
  { root: z.string().optional(), batchId: z.string().optional(), scope: z.enum(["related", "full"]).optional(), testCmd: z.string().optional(), typecheckCmd: z.string().optional() },
  async ({ root, batchId, scope, testCmd, typecheckCmd }) => { try { return json(t.run_checks(rootOf(root), { batchId, scope, testCmd, typecheckCmd })); } catch (e) { return fail(e); } }
);

server.tool(
  "ratchet",
  "Count .js files and `any` occurrences and compare with the ceiling in .ratchet/. mode=check: report only. mode=commit: lower the ceiling (only if nothing went up) and append a point to run.json. mode=init: write the baseline.",
  { root: z.string().optional(), mode: z.enum(["check", "commit", "init"]).optional(), src: z.string().optional() },
  async ({ root, mode, src }) => { try { return json(t.ratchet(rootOf(root), { mode, src })); } catch (e) { return fail(e); } }
);

const semantic = z.array(z.object({
  file: z.string(),
  kind: z.enum(["optional", "nullable", "interface", "type", "cast", "any", "other"]),
  symbol: z.string(),
  note: z.string().optional(),
}));

server.tool(
  "record_step",
  "Record the outcome of a batch in run.json: status (done | rolled_back | manual | failed), the list of semantic changes for the human gate, the exported Bob session path, notes.",
  { root: z.string().optional(), batchId: z.string(), status: z.enum(["done", "rolled_back", "manual", "failed"]), semantic: semantic.optional(), session: z.string().optional(), notes: z.string().optional(), files: z.array(z.string()).optional(), force: z.boolean().optional().describe("Record done despite red checks (say why in notes)") },
  async ({ root, ...rest }) => { try { return json(t.record_step(rootOf(root), rest)); } catch (e) { return fail(e); } }
);

server.tool(
  "render_report",
  "Render a self-contained report.html from run.json: layer map, counters, batch feed.",
  { root: z.string().optional(), out: z.string().optional() },
  async ({ root, out }) => { try { return json(t.render_report(rootOf(root), { out })); } catch (e) { return fail(e); } }
);

const transport = new StdioServerTransport();
await server.connect(transport);
