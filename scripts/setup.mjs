#!/usr/bin/env node
/*
 * `pnpm run setup` — take a fresh clone to a working dev environment with one command.
 *
 * Why it exists: every one of the four projects this template came from broke on a fresh clone,
 * and the fix lived in a `.bat` file comment or in someone's head. This script does what it can
 * and, where it cannot, prints the exact command that will.
 *
 * Written as a Node script rather than bash so it runs identically on Windows.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
let failed = false;

function step(title) {
  console.log(`\nsetup: ${title}`);
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

function version(cmd) {
  const result = spawnSync(cmd, ["--version"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

// 1. Node major. `engines.node` is the single source of truth; CI and any IaC repeat it.
step("Node version");
const wantNode = pkg.engines.node;
const haveNode = process.versions.node.split(".")[0];
if (haveNode !== wantNode) {
  failed = true;
  console.error(`  Node ${wantNode} is required; this is Node ${process.versions.node}.`);
  console.error(
    `  Install it from https://nodejs.org/ or with your version manager, e.g. \`nvm install ${wantNode} && nvm use ${wantNode}\`.`,
  );
} else {
  console.log(`  Node ${process.versions.node} ok`);
}

// 2. Package manager. The exact version is pinned in `packageManager`; Corepack provides it.
step("pnpm");
const wantPnpm = pkg.packageManager.split("@")[1];
const havePnpm = version("pnpm");
if (havePnpm === undefined) {
  failed = true;
  console.error(
    `  pnpm is not on PATH. Run: corepack enable && corepack prepare pnpm@${wantPnpm} --activate`,
  );
} else if (havePnpm !== wantPnpm) {
  console.log(
    `  pnpm ${havePnpm} found; ${wantPnpm} is pinned. To match exactly: corepack prepare pnpm@${wantPnpm} --activate`,
  );
} else {
  console.log(`  pnpm ${havePnpm} ok`);
}

if (failed) {
  console.error("\nsetup: fix the above, then run `pnpm run setup` again.");
  process.exit(1);
}

// 3. Dependencies, frozen to the committed lockfile — same as CI.
step("install dependencies (pnpm install --frozen-lockfile)");
if (!run("pnpm", ["install", "--frozen-lockfile"])) {
  console.error(
    "  Install failed. If the lockfile is out of date, run `pnpm install` and commit pnpm-lock.yaml.",
  );
  process.exit(1);
}

// 4. Local environment file. Never committed; .env.example documents every variable.
step(".env");
if (existsSync(join(root, ".env"))) {
  console.log("  .env exists; leaving it alone. Compare against .env.example for new variables.");
} else {
  copyFileSync(join(root, ".env.example"), join(root, ".env"));
  console.log("  Created .env from .env.example. Every variable in it is optional today.");
}

// 5. Git hooks. The pre-commit hook is the fast half of the gate (typecheck + lint + format).
step("git hooks");
if (run("git", ["config", "core.hooksPath", ".githooks"])) {
  console.log("  core.hooksPath = .githooks");
} else {
  console.log("  Could not set hooks path. Run: git config core.hooksPath .githooks");
}

// 6. What to run next. There is no app in `apps/` yet, so `pnpm run dev` has nothing to start;
//    say so rather than pretending a server came up.
step("done");
if (!existsSync(join(root, "apps")) || !hasWorkspaceApp()) {
  console.log(
    "  No app exists in apps/ yet, so `pnpm run dev` starts nothing. Run `pnpm run gate` to verify the toolchain.",
  );
} else {
  console.log(
    "  Run `pnpm run dev` to start the dev server, `pnpm run gate` before calling anything done.",
  );
}

function hasWorkspaceApp() {
  const result = spawnSync(
    "pnpm",
    ["ls", "-r", "--depth", "-1", "--parseable", "--filter", "./apps/*"],
    {
      cwd: root,
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );
  return result.status === 0 && result.stdout.trim().length > 0;
}
