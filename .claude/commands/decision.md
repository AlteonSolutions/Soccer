---
description: Record a decision in DECISIONS.md, superseding rather than contradicting
allowed-tools: Bash(git log:*), Bash(date:*)
---

Record: $ARGUMENTS

1. Read `DECISIONS.md` and find any existing entry this touches.
2. If one exists and this changes it, do **not** edit or delete the old entry. Add a new entry at
   the top that names the old one and says it supersedes it, and add a `Superseded by <date>` note
   on the old entry.
3. New entry format, newest first:

```
### YYYY-MM-DD — <the decision in one imperative line>
**Context.** What forced the choice.
**Decision.** What we are doing.
**Rejected.** What we are not doing, and why.
**Consequence.** What this now costs or constrains. Supersedes: <date of prior entry, or "none">.
```

4. If the decision changes a rule Claude follows, also update the matching line in `CLAUDE.md` in
   the same commit — a decision that only lives in `DECISIONS.md` will not be applied.
