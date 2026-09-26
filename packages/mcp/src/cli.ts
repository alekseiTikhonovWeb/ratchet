#!/usr/bin/env node
/**
 * CLI mirror of the MCP tools — for terminals, CI and when Bob's MCP is not wired yet.
 *
 *   ratchet graph   [root] [--src src] [--reset]
 *   ratchet next    [root] [--max 15]
 *   ratchet checks  [root] [--batch b01]
 *   ratchet ratchet [root] [--mode check|commit|init]
 *   ratchet record  [root] --batch b01 --status done|rolled_back|manual|failed [--session path] [--notes "..."]
 *   ratchet report  [root] [--out report.html]
 */
import { resolve } from "node:path";
import * as t from "./tools/index.js";

const [, , cmd, ...rest] = process.argv;
const flags: Record<string, string | boolean> = {};
const pos: string[] = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith("--")) {
    const k = a.slice(2);
    const v = rest[i + 1];
    if (v !== undefined && !v.startsWith("--")) { flags[k] = v; i++; } else flags[k] = true;
  } else pos.push(a);
}
const root = resolve(pos[0] ?? process.env.RATCHET_ROOT ?? process.cwd());
const s = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string) : undefined);

function out(v: unknown) { console.log(JSON.stringify(v, null, 2)); }

try {
  switch (cmd) {
    case "graph": out(t.build_graph(root, { src: s("src"), reset: flags.reset === true })); break;
    case "next": out(t.next_batch(root, { maxFiles: s("max") ? Number(s("max")) : undefined })); break;
    case "checks": out(t.run_checks(root, { batchId: s("batch"), scope: s("scope") as "related" | "full" | undefined, testCmd: s("test"), typecheckCmd: s("typecheck") })); break;
    case "ratchet": out(t.ratchet(root, { mode: (s("mode") as "check" | "commit" | "init") ?? "check", src: s("src") })); break;
    case "record": {
      if (!s("batch") || !s("status")) throw new Error("record needs --batch and --status");
      out(t.record_step(root, { batchId: s("batch")!, status: s("status") as "done", session: s("session"), notes: s("notes") }));
      break;
    }
    case "report": out(t.render_report(root, { out: s("out") })); break;
    default:
      console.error("usage: ratchet <graph|next|checks|ratchet|record|report> [root] [flags]");
      process.exit(2);
  }
} catch (e) {
  console.error("ERROR:", (e as Error).message);
  process.exit(1);
}
