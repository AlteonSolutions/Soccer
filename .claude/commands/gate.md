---
description: Run the full quality gate and report the real result
allowed-tools: Bash(npm run typecheck:*), Bash(npm run lint:*), Bash(npm run format:*), Bash(npm test:*), Bash(npm run build:*)
---

Run the gate, in this order, and do not stop at the first failure — collect all of it:

1. `{{GATE_TYPECHECK_CMD}}` — every package, including the frontend. A package whose typecheck is
   not in this list is unchecked until deploy.
2. `{{GATE_LINT_CMD}}`
3. `{{GATE_FORMAT_CMD}}`
4. `{{GATE_TEST_CMD}}` — this builds first if tests run against compiled output.

Then report, in this shape and nothing longer:

- One line per step: pass/fail plus the failure count.
- For each failure: the file, the line, and what it means in plain words.
- If everything passes, say so plainly. Never write "should pass" or "expected to pass" — if you
  did not run it, say you did not run it.

Do not fix anything as part of this command unless I ask. Report first.
