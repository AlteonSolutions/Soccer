# Runs on every branch, not just the trunk: two of the four source projects had no CI at all and
# their only real regression check ran against nothing automatically.
#
# The `test` job is the gate. Any deploy job you add must declare `needs: test`.
name: CI

on:
  push:
  pull_request:
  workflow_dispatch:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # {{NODE_MAJOR}} must equal package.json engines and any IaC runtime param.
      - uses: actions/setup-node@v4
        with:
          node-version: "{{NODE_MAJOR}}"
          cache: "{{PKG_MANAGER}}"

      - name: Install
        run: {{CI_INSTALL_CMD}}   # frozen lockfile

      - name: Typecheck (all packages)
        run: {{GATE_TYPECHECK_CMD}}

      - name: Lint
        run: {{GATE_LINT_CMD}}

      - name: Format check
        run: {{GATE_FORMAT_CMD}}

      - name: Test
        run: {{GATE_TEST_CMD}}
