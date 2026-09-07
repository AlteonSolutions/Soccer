import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

// Flat config, one file for every workspace. Formatting is Prettier's job, so the Prettier config
// goes last and switches off every stylistic rule above it.
export default defineConfig([
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },
  {
    // Env is read in exactly one place. One audited project had 36 scattered `process.env` reads
    // and could only enumerate its own configuration by grep.
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "Read the environment only in packages/shared/src/config.ts.",
        },
      ],
    },
  },
  {
    // The config module reads env; the local dev launchers hand the whole environment to a child
    // process (the Functions host) — neither is an app-code read.
    files: ["packages/shared/src/config.ts", "apps/*/dev.mjs"],
    rules: { "no-restricted-properties": "off" },
  },
  prettier,
]);
