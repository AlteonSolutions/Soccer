/*
 * Local run of the reminders Function App: loads .env, points the Functions host at Azurite for
 * its own bookkeeping, and starts it from dist/. The timer fires at 14:00 UTC; to run it now:
 *   curl -X POST http://localhost:7071/admin/functions/send-reminders -H 'content-type: application/json' -d '{}'
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envFile = join(here, "..", "..", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const result = spawnSync("func", ["start"], {
  cwd: join(here, "dist"),
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    AzureWebJobsStorage: "UseDevelopmentStorage=true",
    FUNCTIONS_WORKER_RUNTIME: "node",
  },
});
process.exit(result.status ?? 1);
