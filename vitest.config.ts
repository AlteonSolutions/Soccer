import { defineConfig } from "vitest/config";

// One Vitest config for every workspace. Tests run against source, not compiled output: editing a
// `.ts` file and re-running the test file must test the edit, not the previous build.
// @soccer/shared resolves to its source through its package `exports`; no alias is needed.
export default defineConfig({
  test: {
    // Test files mirror the source tree under each package's `test/`.
    include: ["{apps,packages}/*/test/**/*.test.ts"],
    // A package with no tests yet must not fail the gate; a failing test must.
    passWithNoTests: true,
  },
});
