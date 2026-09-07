/*
 * @soccer/shared — the one module every app imports its types, schemas and configuration from.
 *
 * Why it exists: without a single shared module, each app redeclares the same shapes locally and
 * they drift. The audit behind this template found the same compute bug fixed by hand three times
 * across three parallel copies of one function. Import from here; never redeclare a shape locally.
 */
export { ConfigError, loadConfig, parseEnv, type Config } from "./config.js";
