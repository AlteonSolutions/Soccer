---
description: Commit the current work with the house conventions, docs included
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(npm run:*), Bash(npm test:*)
---

Ship what is currently uncommitted. Steps, in order:

1. Run `/gate`. If anything fails, stop and report — do not commit.
2. Check which docs this change makes stale: `README.md`, `SETUP.md`, `.env.example`, `STATUS.md`,
   `docs/`. Update them **in this commit**. Never "later".
3. If this change departs from a recorded decision, add the superseding dated entry to
   `DECISIONS.md` now (see `/decision`).
4. Show me the proposed subject and body before committing.

Message format:

- Subject: imperative, sentence case, no `feat:`/`fix:` prefix, no ticket id. An `Area: ` scope
  prefix is fine. Describe the change, not the files touched.
- Body: prose paragraphs — the problem, the decision, the alternative rejected, the consequence.
  Not a bullet list of the diff.
- Trailers, on every commit:

  ```
  Co-Authored-By: {{CLAUDE_TRAILER}}
  Claude-Session: <this session's url>
  ```

Never `git reset --hard`, force-push, or `git clean` to get to a clean state. Stash instead and say
that you did.
