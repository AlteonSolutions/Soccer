/*
 * Local dev for the web app: loads the repo's .env into this process (the Functions host does not
 * read .env; it inherits our environment) and starts the Static Web Apps CLI, which serves
 * dist/client, runs dist/api through Azure Functions Core Tools, and emulates SWA auth so you can
 * sign in as "admin" at /login without Azure.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const envFile = join(root, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const result = spawnSync(
  "pnpm",
  ["exec", "swa", "start", "dist/client", "--api-location", "dist/api", "--port", "4280"],
  { stdio: "inherit", shell: process.platform === "win32" },
);
process.exit(result.status ?? 1);
