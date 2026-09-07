---
description: Verify this clone can actually run before starting work
allowed-tools: Bash(node -v), Bash(git status:*), Bash(git branch:*), Bash(ls:*), Bash(cat:*), Bash(npm run setup:*), Bash(npm ls:*)
---

Every one of the projects this template came from broke on a fresh clone in a different way, and in
every case the explanation existed only in a `.bat` file comment or in someone's head. Check, in
order, and report what is missing rather than guessing:

1. `node -v` matches the Node major in `package.json` `engines`. If it doesn't, stop here — a wrong
   major has already caused one silent production failure.
2. Dependencies are installed, with the project's package manager, in every workspace.
3. `.env` exists and every **required** var in `.env.example` is set. List the missing ones by name.
4. Anything external the app needs — database, emulator, seeded data file, CLI on PATH — is
   present. Name the specific command that would provide it.
5. `git status` is clean and I am on the branch I expect. Name the branch.

Then say, in one line, whether `{{DEV_CMD}}` will work. If it won't, say exactly what to run first.
Do not run `{{SETUP_CMD}}` on your own initiative if the tree is dirty — tell me first.
