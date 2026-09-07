/*
 * Bundles the reminders Function App into dist/ (index.js, package.json, host.json), the folder
 * the deploy workflow zips. Same reasoning as apps/web/build.mjs: @soccer/shared is a workspace
 * package consumed as source, so everything is bundled and nothing is installed on the platform.
 */
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [join(root, "src/index.ts")],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: ["node22"],
  // Provided by the Functions Node worker at runtime; it does not exist at build time.
  external: ["@azure/functions-core"],
  sourcemap: true,
  outfile: join(dist, "index.js"),
  logLevel: "info",
});
cpSync(join(root, "host.json"), join(dist, "host.json"));
writeFileSync(
  join(dist, "package.json"),
  JSON.stringify({ name: "soccer-reminders", private: true, main: "index.js" }, null, 2) + "\n",
);
console.log("reminders: built dist/");
