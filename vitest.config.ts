import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// One Vitest config for every workspace. Tests run against source, not compiled output: editing a
// `.ts` file and re-running the test file must test the edit, not the previous build.
export default defineConfig({
  resolve: {
    alias: {
      // Runtime consumers of @soccer/shared get `dist` via its package `exports`; tests get source.
      // This split is deliberate and stated in CLAUDE.md — do not "fix" one side to match the other.
      "@soccer/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
    },
  },
  test: {
    // Test files mirror the source tree under each package's `test/`.
    include: ["{apps,packages}/*/test/**/*.test.ts"],
    // A package with no tests yet must not fail the gate; a failing test must.
    passWithNoTests: true,
  },
});
