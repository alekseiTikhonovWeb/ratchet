// Copies ../../demo/run.json into src/demo/run.json so the dashboard bundles the recorded run
// (Vercel builds from packages/dashboard; the copy is committed too, so the build never depends on ../..).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../../demo/run.json");
const dst = resolve(here, "../src/demo/run.json");
if (existsSync(src)) { mkdirSync(dirname(dst), { recursive: true }); copyFileSync(src, dst); console.log("demo synced"); }
else console.log("no ../../demo/run.json — keeping committed copy");
