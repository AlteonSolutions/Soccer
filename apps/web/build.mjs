/*
 * Builds the deployable Static Web App into dist/:
 *   dist/client  static files + bundled app.js/admin.js   → SWA app_location
 *   dist/api     bundled Functions app (index.js, package.json, host.json) → SWA api_location
 *
 * Why esbuild and not `tsc`: the api imports @soccer/shared, a workspace package consumed as
 * source. Oryx (the SWA build service) cannot install `workspace:` dependencies, so CI builds
 * here, bundles every dependency into one file, and deploys with skip_api_build. There is nothing
 * left for the platform to install.
 */
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "client"), { recursive: true });
mkdirSync(join(dist, "api"), { recursive: true });

// Client: native ESM in the browser, no framework. Target the last two years of browsers.
await build({
  entryPoints: [join(root, "client/app.ts"), join(root, "client/admin.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  sourcemap: true,
  outdir: join(dist, "client"),
  logLevel: "info",
});
for (const file of [
  "index.html",
  "forbidden.html",
  "styles.css",
  "logo.svg",
  "staticwebapp.config.json",
]) {
  cpSync(join(root, "client", file), join(dist, "client", file));
}
// The coach's page lives at /admin/ so the documented `/admin/*` route rule can gate it.
mkdirSync(join(dist, "client", "admin"), { recursive: true });
cpSync(join(root, "client", "admin.html"), join(dist, "client", "admin", "index.html"));

// API: one CommonJS file for the Functions Node worker. CJS avoids the ESM `require` shim that
// the Azure SDKs otherwise need when bundled.
await build({
  entryPoints: [join(root, "api/src/routes/index.ts")],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: ["node22"],
  // Provided by the Functions Node worker at runtime; it does not exist at build time.
  external: ["@azure/functions-core"],
  sourcemap: true,
  outfile: join(dist, "api", "index.js"),
  logLevel: "info",
});
cpSync(join(root, "api/host.json"), join(dist, "api", "host.json"));
writeFileSync(
  join(dist, "api", "package.json"),
  JSON.stringify({ name: "soccer-web-api", private: true, main: "index.js" }, null, 2) + "\n",
);
console.log("web: built dist/client and dist/api");
