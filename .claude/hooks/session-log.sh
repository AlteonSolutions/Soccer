#!/usr/bin/env bash
# Build-time ledger. Exists because "how many hours has this taken" had no answer on two prior
# projects, and the one project that tracked it by hand started the ledger months late — the
# pre-squash history was unrecoverable estimates. Automating it on day one is the whole point.
#
# Writes event,timestamp,session_id rows to .claude/sessions.csv and persists them to a dedicated
# `worklog` branch using git plumbing, so the working tree, index and current branch are never
# touched. On session start it restores the file from that branch, so a fresh container picks the
# history back up.
#
# A hook must never block work: every failure path exits 0.
#
# Usage: session-log.sh start|end|report

set -uo pipefail

EVENT="${1:-}"
BRANCH="worklog"
FILE=".claude/sessions.csv"

git rev-parse --git-dir >/dev/null 2>&1 || exit 0
cd "$(git rev-parse --show-toplevel)" || exit 0

restore() {
  git rev-parse --verify -q "refs/heads/$BRANCH" >/dev/null || return 0
  git show "$BRANCH:sessions.csv" >"$FILE" 2>/dev/null || true
}

persist() {
  local blob tree commit parent
  blob=$(git hash-object -w "$FILE" 2>/dev/null) || return 0
  tree=$(printf '100644 blob %s\tsessions.csv\n' "$blob" | git mktree 2>/dev/null) || return 0
  if parent=$(git rev-parse -q --verify "refs/heads/$BRANCH" 2>/dev/null); then
    commit=$(git commit-tree "$tree" -p "$parent" -m "worklog: $EVENT" 2>/dev/null) || return 0
  else
    commit=$(git commit-tree "$tree" -m "worklog: $EVENT" 2>/dev/null) || return 0
  fi
  git update-ref "refs/heads/$BRANCH" "$commit" 2>/dev/null || true
}

append() {
  mkdir -p .claude
  [ -f "$FILE" ] || echo "event,timestamp,session_id" >"$FILE"
  echo "$1,$(date -u +%Y-%m-%dT%H:%M:%SZ),${CLAUDE_SESSION_ID:-unknown}" >>"$FILE"
}

case "$EVENT" in
  start)
    restore
    append start
    persist
    ;;
  end)
    append end
    persist
    ;;
  report)
    [ -f "$FILE" ] || restore
    [ -f "$FILE" ] || { echo "no sessions logged yet"; exit 0; }
    awk -F, 'NR>1 && $1=="start"{s[$3]=$2} NR>1 && $1=="end" && s[$3]{
        cmd="date -u -d " s[$3] " +%s"; cmd|getline a; close(cmd)
        cmd="date -u -d " $2 " +%s";    cmd|getline b; close(cmd)
        d=(b-a)/3600; day=substr(s[$3],1,10); per[day]+=d; total+=d; delete s[$3]
      } END{
        for (k in per) printf "%s  %5.2f h\n", k, per[k]
        printf "total  %5.2f h\n", total
      }' "$FILE" | sort
    ;;
  *)
    echo "usage: session-log.sh start|end|report" >&2
    ;;
esac

exit 0
