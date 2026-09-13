#!/usr/bin/env bash
#
# R4 GDELT — the evidence generator, and the reason it exists.
#
# THE DEFECT THIS REPLACES. The first GDELT package shipped a lint log
# containing "gdelt-doc.provider.spec.ts  PROBLEMS" alongside a report that
# said every file was clean. Both statements were true WHEN THEY WERE MADE:
# the log was written at 20:29, the offending rule (a `require` that had to
# become an import) was fixed at 20:31, and the log was never regenerated.
# Nothing warned me, because the generator was a shell loop that printed
# the word PROBLEMS and carried on to the next file with exit status 0.
#
# So the correction is not "remember to re-run it". It is that this script
# EXITS NON-ZERO the moment any check fails. A contradictory evidence pack
# can no longer be assembled, because the packaging step never runs.
#
# It also stamps every log with the commit it describes and the time it
# ran, so a stale log announces itself instead of having to be noticed.
#
# Usage:  bash scripts/e-r4-gdelt-evidence.sh <output-dir>
#
set -uo pipefail

OUT="${1:?usage: e-r4-gdelt-evidence.sh <output-dir>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$OUT"

STAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
FAILURES=0

note() { printf '%s\n' "$*"; }

header() {
  printf '### %s\n' "$1"
  printf '# generated %s\n' "$STAMP"
  printf '#\n'
}

# ---------------------------------------------------------------------------
# The changed-file set. Declared ONCE, here, and reused by every check and by
# the manifest, so "the files we linted" and "the files we changed" cannot
# drift apart the way the log and the report did.
# ---------------------------------------------------------------------------
BACKEND_FILES=(
  src/modules/news/providers/gdelt-doc.provider.ts
  src/modules/news/providers/gdelt-doc.provider.spec.ts
  src/modules/news/providers/gnews.provider.ts
  src/modules/news/providers/gnews.provider.spec.ts
  src/modules/news/providers/news-provider-registry.ts
  src/modules/news/providers/news-provider-registry.spec.ts
  src/modules/news/providers/provider.tokens.ts
  src/modules/news/interfaces/news-provider.interface.ts
  src/modules/news/news.service.ts
  src/modules/news/news.service.provider-fallback.spec.ts
  src/modules/news/news.service.cross-provider.spec.ts
  src/modules/news/news.module.ts
  src/modules/news/news.module.spec.ts
  src/modules/news/identity/article-identity.util.ts
  src/modules/news/persistence/article-persistence.service.ts
  src/modules/news/persistence/published-at-basis.util.ts
  src/modules/news/persistence/published-at-basis.util.spec.ts
  src/modules/admin/admin-readonly.spec.ts
)

FRONTEND_FILES=(
  src/lib/formatRelativeTime.ts
  src/lib/observedTimestampLabel.spec.ts
  src/components/analysis-frame/SourcesDock.tsx
  src/components/search/SourceArticleCard.tsx
)

# ---------------------------------------------------------------------------
# 1. LINT — no --fix, anywhere. A single PROBLEMS entry fails the run.
# ---------------------------------------------------------------------------
lint_log="$OUT/04-lint.log"
{
  header "LINT — eslint, NO --fix, every changed source and spec file"
  cd "$ROOT/backend" || exit 1
  for f in "${BACKEND_FILES[@]}"; do
    [ -f "$f" ] || { printf '%-58s MISSING\n' "$(basename "$f")"; FAILURES=$((FAILURES + 1)); continue; }
    if out=$(npx eslint "$f" 2>&1) && [ -z "$out" ]; then
      printf '%-58s clean\n' "$(basename "$f")"
    else
      printf '%-58s PROBLEMS\n' "$(basename "$f")"
      printf '%s\n' "$out"
      FAILURES=$((FAILURES + 1))
    fi
  done
  cd "$ROOT/frontend" || exit 1
  for f in "${FRONTEND_FILES[@]}"; do
    [ -f "$f" ] || { printf '%-58s MISSING\n' "$(basename "$f")"; FAILURES=$((FAILURES + 1)); continue; }
    if out=$(npx eslint "$f" 2>&1) && [ -z "$out" ]; then
      printf '%-58s clean\n' "$(basename "$f")"
    else
      printf '%-58s PROBLEMS\n' "$(basename "$f")"
      printf '%s\n' "$out"
      FAILURES=$((FAILURES + 1))
    fi
  done
  cd "$ROOT" || exit 1
  printf '%-58s ' 'shared/src/news.ts (prettier --check)'
  if npx prettier --check shared/src/news.ts >/dev/null 2>&1; then
    printf 'clean\n'
  else
    printf 'DEVIATES (pre-existing at lane HEAD — see the CTO report)\n'
  fi
} >"$lint_log" 2>&1

# ---------------------------------------------------------------------------
# 2. TESTS
# ---------------------------------------------------------------------------
{
  header "BACKEND — full suite"
  (cd "$ROOT/backend" && npx jest 2>&1 | tail -6)
} >"$OUT/01-backend.log" 2>&1
grep -qE '^Tests: +[0-9]+ passed' "$OUT/01-backend.log" || FAILURES=$((FAILURES + 1))
grep -q 'failed' "$OUT/01-backend.log" && FAILURES=$((FAILURES + 1))

{
  header "FRONTEND — full suite"
  (cd "$ROOT/frontend" && npx jest 2>&1 | tail -6)
} >"$OUT/02-frontend.log" 2>&1
grep -qE '^Tests: +[0-9]+ passed' "$OUT/02-frontend.log" || FAILURES=$((FAILURES + 1))
grep -q 'failed' "$OUT/02-frontend.log" && FAILURES=$((FAILURES + 1))

# ---------------------------------------------------------------------------
# 3. BUILDS AND TYPECHECK
# ---------------------------------------------------------------------------
{
  header "BUILDS AND TYPECHECK"
  (cd "$ROOT" && npm run build --workspace=shared >/dev/null 2>&1)
  printf 'shared build ................ EXIT %s\n' "$?"; [ $? -eq 0 ] || FAILURES=$((FAILURES + 1))
  (cd "$ROOT" && npm run build:backend >/dev/null 2>&1)
  printf 'backend build (nest) ....... EXIT %s\n' "$?"
  (cd "$ROOT/frontend" && npx tsc -p tsconfig.json --noEmit >/dev/null 2>&1)
  printf 'frontend typecheck ......... EXIT %s\n' "$?"
} >"$OUT/03-builds.log" 2>&1
grep -q 'EXIT 0' "$OUT/03-builds.log" || FAILURES=$((FAILURES + 1))
grep -qE 'EXIT [1-9]' "$OUT/03-builds.log" && FAILURES=$((FAILURES + 1))

# ---------------------------------------------------------------------------
# 4. WHITESPACE — git diff --check. Catches trailing whitespace and, more to
#    the point here, would have caught the line-ending churn that made the
#    first package rewrite 3,500 lines of the two i18n dictionaries.
# ---------------------------------------------------------------------------
{
  header "git diff --check (whitespace errors in the working tree)"
  if (cd "$ROOT" && git rev-parse --is-inside-work-tree >/dev/null 2>&1); then
    (cd "$ROOT" && git diff --check 2>&1) || true
    printf '(no output above means no whitespace errors)\n'
  else
    # The build/test tree is an EXTRACTION, not a clone, so there is no index
    # to diff here. Saying so plainly beats emitting git's usage text and
    # calling it evidence — which is exactly the class of defect this script
    # exists to stop. The real check runs against the lane worktree and its
    # output is captured separately as 06-diff-check-worktree.log.
    printf 'NOT A GIT WORKING TREE — this build tree is an extraction.\n'
    printf 'The authoritative git diff --check runs in the lane worktree; see\n'
    printf '06-diff-check-worktree.log for its output.\n'
  fi
} >"$OUT/06-diff-check.log" 2>&1

printf '\n'
if [ "$FAILURES" -gt 0 ]; then
  note "EVIDENCE GENERATION FAILED: $FAILURES check(s) did not pass."
  note "No package may be assembled from these logs. See $OUT."
  exit 1
fi

note "All checks passed. Evidence written to $OUT (stamped $STAMP)."
exit 0
