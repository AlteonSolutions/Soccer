<!-- {{PROJECT_NAME}}: the package.json name. {{ONE_LINE_PURPOSE}}: what this is and who uses
     it, in one sentence — enough for a cold reader to tell if a change belongs in this repo. -->
# {{PROJECT_NAME}}

{{ONE_LINE_PURPOSE}}

## Facts

<!-- {{NODE_MAJOR}}: one number, e.g. 22. {{RUNTIME_PINS}}: every other place the runtime version
     is written (CI workflow, Dockerfile, IaC param) — or "none". -->
- Node {{NODE_MAJOR}} is the only Node major here. It appears in `package.json` `engines`, in CI,
  and in {{RUNTIME_PINS}}. Those change in one commit or not at all.
<!-- {{PKG_MANAGER}}: npm | pnpm | yarn, with the version from the packageManager field. -->
- Package manager: {{PKG_MANAGER}}. Lockfile is committed; CI installs frozen. Do not install with another manager.
<!-- {{LAYOUT}}: e.g. "apps/api + apps/web + packages/shared (pnpm workspaces)" or "single package, src/". -->
- Layout: {{LAYOUT}}
<!-- {{SHARED_MODULE}}: where types and zod schemas that more than one side imports live, plus
     whether consumers read its source or its build output — say which, it is never obvious. -->
- Shared types and schemas: {{SHARED_MODULE}}. Import them; never redeclare a shape locally.
<!-- {{SETUP_CMD}} {{DEV_CMD}} {{GATE_CMD}}: the three commands that must always work. -->
- `{{SETUP_CMD}}` on a fresh clone · `{{DEV_CMD}}` to work · `{{GATE_CMD}}` before saying anything is done.

## Working agreement

- Before running anything that changes state (migration, deploy, bulk script, `git` history), say in
  one plain sentence what it will do. Name a concept the first time it comes up; don't assume it.
- Never report a task complete without running `{{GATE_CMD}}` and stating the result. "Should pass"
  is not a result.
- A change that departs from a recorded decision gets a new dated entry in `DECISIONS.md` that
  explicitly supersedes the old one. Never silently contradict a recorded decision.
- Update the affected doc in the **same commit** as the code — never "later". If a doc and reality
  disagree, fix the doc in that commit.
- Any doc describing something not yet true (unapplied IaC, a planned integration) says so in its
  first line.

## Code

- Every non-trivial module opens with a block comment: why it exists and what breaks without it.
  If it exists because something failed once, name the failure.
- Put the reason for a number next to the number — limits, timeouts, page sizes, retry counts.
<!-- {{ENTRY_DIR}}: the folder holding HTTP routes / handlers / pages, e.g. src/functions or src/routes. -->
- `{{ENTRY_DIR}}` holds entry points only, and they stay thin. Logic goes in `lib/` as exported named
  functions with no framework import, so tests call them directly without booting a server or a DOM.
<!-- {{REGISTRATION_STEP}}: the manual wiring a new entry point needs (e.g. "a bare import line in
     src/index.ts", "a mount in app.ts"). Delete this line if the framework auto-discovers routes. -->
- A new entry point also needs {{REGISTRATION_STEP}}. Skipping it fails silently — nothing errors,
  the route just doesn't exist.
- Never create a second copy of logic. Where a copy is genuinely unavoidable (no build step, another
  runtime), prefix every copied symbol with `_` and name the source file in a comment above the block.
- When two similar things are deliberately *not* unified, say so in a comment at the site, or someone
  will "fix" it.
<!-- {{DATA_GUARD}}: the single guarded entry point for data access, e.g. withTenant(), db(), repo/. -->
- All data access goes through `{{DATA_GUARD}}`. The raw client/pool/handle is not exported and is
  never called directly, including in tests and scripts.
- Validate at every boundary with zod (`safeParse`, `.strict()` objects) and reject on failure.
  Payloads from our own UI are not trusted.
- Errors carry a code and remediation text. Raw error to the logs, user-safe message to the UI.
  Never hand the client an error payload it will render as if it were data.
- A secondary side effect — email, notification, webhook, avatar fetch, analytics write — may never
  fail the primary action. Catch it, log it, continue.
- Never present a partial result as if it were complete. Return an explicit `truncated`/`partial`
  flag and surface it in the UI.
- No `TODO`/`FIXME`/`HACK` in committed code. Fix it, or record it as a dated entry in `DECISIONS.md`.
<!-- {{FILE_CASE}}: kebab-case or camelCase for filenames — pick one, note the exception for
     component files. {{UI_COPY_CASE}}: Title Case or sentence case for headings and buttons. -->
- Naming: {{FILE_CASE}} filenames, `PascalCase.tsx` for components, camelCase functions, PascalCase
  types, snake_case for DB columns and JSON fields.
- UI copy uses {{UI_COPY_CASE}} for headings and buttons. Match the existing screens exactly.

## Environment and secrets

- No secret, signed URL, token, or connection string in source. Ever — not "temporarily", not in a
  `.bat` file, not in a test fixture.
- `.env.example` lists **every** variable the code reads, each with a one-line explanation, whether
  it is required or degrades gracefully, and the command to generate it if it is a secret. Add the
  entry in the same commit as the code that reads the var.
<!-- {{CONFIG_MODULE}}: the one module that reads process.env, e.g. src/lib/config.ts. -->
- Env is read only in `{{CONFIG_MODULE}}`, which fails fast with the variable's name on a missing
  required value. No scattered `process.env` reads.
- A fresh clone must reach a working dev server with `{{SETUP_CMD}}` and nothing else. Anything that
  can't be automated (a running container, an account, a file) is checked for by that script, which
  prints what to do. Missing optional integrations degrade — they never crash the app.

## Tests and gates

<!-- {{TEST_RUNNER}}: vitest unless there's a reason. {{TEST_TARGET}}: source or compiled output. -->
- `{{GATE_CMD}}` runs typecheck for **every** package, lint, format check, and {{TEST_RUNNER}}.
  If a package's typecheck isn't in the gate, it isn't checked until deploy — put it in the gate.
- Tests exercise {{TEST_TARGET}}; the test script builds first when that is compiled output. Running
  the test file directly after editing source tests the old build.
- Test files mirror the source tree under `test/`. Fixtures are sanitized and committed; real
  customer data is not, in any format.
- The failures worth testing are the quiet ones: a wrong number that still renders, a dropped tab
  that still builds. Test the pure function in `lib/`, not the framework around it.
- CI runs the gate on every push. Every deploy job declares `needs: test`.

## Git and delivery

<!-- {{TRUNK}}: main | master. {{CLAUDE_TRAILER}}: e.g. Claude Opus 5 <noreply@anthropic.com>. -->
- Commit subject: imperative, sentence case, no conventional-commit prefix, no ticket id. An
  `Area: ` scope prefix is fine. Body is prose: the problem, the decision, the alternative rejected,
  the consequence. The body is not optional on a non-trivial change.
- Trailers on **every** commit, not most: `Co-Authored-By: {{CLAUDE_TRAILER}}` and
  `Claude-Session: <url>`.
- Branches are `<kind>/<slug>` off `{{TRUNK}}`; agent sessions use `claude/<slug>`.
- Never `git reset --hard`, force-push, or `git clean` a tracked tree. Stash, and say that you did.

## Docs

<!-- {{DOC_TOPICS}}: the docs/ subfolders this project needs, e.g. runbooks/, security/, deploy/. -->
- `README.md` — quick start, layout, architecture · `SETUP.md` — fresh-clone checklist ·
  `DECISIONS.md` — dated, newest first, supersede-don't-contradict · `STATUS.md` — where things
  stand, written to be read cold · `docs/{{DOC_TOPICS}}`.
- The editable source of every generated or shipped asset (PDF, deck, image) lives in `docs/`.
  Generated output alone is a file we will lose.

## Pinned preferences

<!-- Corrections that had to be given twice. Add a dated line each time one is given; never delete
     one without a superseding DECISIONS.md entry. Delete this example when the first real one lands. -->
- (YYYY-MM-DD) Example: build time is logged automatically by the session hook — leave it alone.
