/*
 * @soccer/shared – the one module every app imports its types, schemas, configuration, data
 * access and email from.
 *
 * Why it exists: without a single shared module, each app redeclares the same shapes locally and
 * they drift. The audit behind this template found the same compute bug fixed by hand three times
 * across three parallel copies of one function. Import from here; never redeclare a shape locally.
 *
 * Consumed as source: `exports` points at `.ts`, and every app bundles it with esbuild. The browser
 * client imports types from "@soccer/shared/schemas" and the date/time formatters from
 * "@soccer/shared/format"; both have no Node dependencies.
 */
export { ConfigError, loadConfig, parseEnv, type Config } from "./config.js";
export { AppError, type AppErrorCode } from "./errors.js";
export { withData, type DataRepo } from "./data.js";
export { createMemoryRepo } from "./data-memory.js";
export {
  chunkRecipients,
  clearCapturedEmails,
  MAX_RECIPIENTS_PER_MESSAGE,
  readCapturedEmails,
  sendEmail,
  type EmailMessage,
  type EmailResult,
  type SendEmail,
} from "./email.js";
export * from "./schemas.js";
export * from "./snacks.js";
export { allergyList, dateParts, formatDate, formatKickoff, joinWithAnd } from "./format.js";
export { runReminders, type RunContext, type RunSummary } from "./reminders.js";
export {
  DEFAULT_TEMPLATES,
  EMAIL_TITLES,
  RECIPIENT_LEGEND,
  TEMPLATE_PLACEHOLDERS,
  renderTemplate,
  resolveRecipients,
  type RecipientVars,
  type Recipients,
  type RenderedEmail,
} from "./templates.js";
export { defaultSettings, loadSettings, logoUrlFor, resolveSettings } from "./settings.js";
export { parseScheduleText, type ParsedSchedule } from "./schedule-import.js";
export { parseRosterText, type ParsedRoster } from "./roster-import.js";
