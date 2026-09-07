---
description: Run the full quality gate and report the real result
allowed-tools: Bash(pnpm run typecheck:*), Bash(pnpm run lint:*), Bash(pnpm run format:*), Bash(pnpm test:*), Bash(pnpm run build:*)
---

Run the gate, in this order, and do not stop at the first failure — collect all of it:

1. `pnpm run typecheck` — every package, including the frontend. A package whose typecheck is
   not in this list is unchecked until deploy.
2. `pnpm run lint`
3. `pnpm run format:check`
4. `pnpm test` — this builds first if tests run against compiled output.

Then report, in this shape and nothing longer:

- One line per step: pass/fail plus the failure count.
- For each failure: the file, the line, and what it means in plain words.
- If everything passes, say so plainly. Never write "should pass" or "expected to pass" — if you
  did not run it, say you did not run it.

Do not fix anything as part of this command unless I ask. Report first.
