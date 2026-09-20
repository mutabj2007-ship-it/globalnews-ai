#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════
 * RELEASE PREFLIGHT — NOTHING ENTERS THE BUILD CONTEXT THAT GIT DOES NOT KNOW
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT THIS EXISTS FOR, MEASURED. `railway up` uploads the working
 * directory, not the commit. This repository carries 21 untracked-but-not-
 * ignored paths — G's `_candidate` trees and per-lane tsconfigs — and they were
 * therefore uploaded into the running backend image and compiled into it
 * (`backend/tsconfig.build.json` declares no `include`). Git has no record of
 * them, so the deployed image was not reconstructible from any commit.
 *
 * THE CTO RULING THIS ENFORCES:
 *
 *   "They are not canonical merely because railway up included them in an
 *    image … exclude them from the release authority until individually
 *    accepted. Do not blanket-ignore them."
 *
 * So this does NOT hide them and must never be 'fixed' by adding them to
 * `.gitignore` or `.railwayignore` — that would conceal the contamination
 * rather than exclude it, and would also make a future accepted landing
 * invisible. It STOPS, names every path, and leaves the decision to a human.
 *
 * ── THE DISTINCTION IT PRESERVES ────────────────────────────────────────────
 *
 *   TRACKED + ACCEPTED        in the commit; part of the release authority
 *   LOCAL CANDIDATE/UNTRACKED on disk only; may exist, must not ship
 *
 * Exit 0 = the build context equals the commit. Exit 1 = STOP.
 * It never deletes, ignores or commits anything; a preflight that can also act
 * is one that will eventually act by mistake.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const sh = (cmd, cwd) =>
  execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const arg = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};

const ROOT = arg('root', process.cwd());
const EXPECTED_BRANCH = arg('branch', null);
const EXPECTED_COMMIT = arg('commit', null);

let stop = false;
const say = (ok, name, detail) => {
  if (!ok) stop = true;
  console.log(`${ok ? 'OK  ' : 'STOP'}  ${name}`);
  if (detail) for (const line of String(detail).split('\n')) console.log(`        ${line}`);
};

console.log('='.repeat(74));
console.log('RELEASE PREFLIGHT');
console.log('='.repeat(74));

/* ── 1 · the build context must equal the commit ───────────────────────── */
const porcelain = sh('git status --porcelain', ROOT).split('\n').filter(Boolean);
const modified = porcelain.filter((l) => !l.startsWith('??'));
const untracked = porcelain.filter((l) => l.startsWith('??')).map((l) => l.slice(3));

say(modified.length === 0, 'no tracked modifications', modified.length
  ? `${modified.length} modified tracked file(s) — the artifact would not be the commit:\n` +
    modified.slice(0, 12).join('\n')
  : 'working tree matches the commit');

/*
  THE CENSUS. Untracked AND not ignored is exactly the set `railway up` would
  upload and Git would not record, which is the contamination class.
*/
say(untracked.length === 0, 'no untracked, non-ignored files in the build context',
  untracked.length
    ? `${untracked.length} path(s) would enter the upload and are in NO commit.\n` +
      'They are LOCAL CANDIDATE, not TRACKED + ACCEPTED. Do not blanket-ignore them:\n' +
      untracked.map((p) => `  ${p}`).join('\n') +
      '\n\nResolve by ACCEPTING each one deliberately (commit it), or by building\n' +
      'from a clean checkout of the commit instead of uploading the worktree.'
    : 'the upload would carry exactly what the commit carries');

/* ── 2 · the ignore files must not have been used to hide the census ────── */
/*
  A future 'fix' that adds `_candidate` or `*-intel` to an ignore file would
  make check 1 pass while changing nothing about what is canonical. The ruling
  forbids it by name, so it is asserted rather than trusted.
*/
const CONCEAL = /(_candidate|-intel\/?|tsconfig\.[a-z]+-strict\.json)/;
for (const f of ['.gitignore', '.railwayignore', '.dockerignore']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  const offending = readFileSync(p, 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && CONCEAL.test(l));
  say(offending.length === 0, `${f} does not conceal the candidate trees`,
    offending.length ? `blanket-ignore rule(s) found — the ruling forbids this:\n${offending.join('\n')}` : 'clean');
}

/* ── 3 · branch and commit are the ones intended ───────────────────────── */
const branch = sh('git rev-parse --abbrev-ref HEAD', ROOT);
const commit = sh('git rev-parse HEAD', ROOT);
if (EXPECTED_BRANCH) say(branch === EXPECTED_BRANCH, 'on the expected release branch', `${branch} (expected ${EXPECTED_BRANCH})`);
if (EXPECTED_COMMIT) {
  const want = sh(`git rev-parse --verify ${EXPECTED_COMMIT}`, ROOT);
  say(commit === want, 'at the expected commit', `${commit.slice(0, 12)} (expected ${want.slice(0, 12)})`);
}

/* ── 4 · the candidate must be reachable on the remote ─────────────────── */
/*
  Model A's whole point: a rebuild triggered by a variable change must
  reproduce these bytes. It cannot if the commit exists only on this machine.
*/
const heads = sh('git ls-remote --heads origin', ROOT).split('\n').filter(Boolean).map((l) => l.split(/\s+/));
const onRemote = heads.find(([sha]) => {
  try { sh(`git merge-base --is-ancestor ${commit} ${sha}`, ROOT); return true; } catch { return false; }
});
say(Boolean(onRemote), 'candidate is reachable on the remote',
  onRemote ? `contained by ${onRemote[1].replace('refs/heads/', '')}`
           : 'NOT on any remote branch — a repo-connected rebuild would not produce this code');

/* ── 5 · migration provenance, recorded with the commit ────────────────── */
const migs = sh(`git ls-tree -r --name-only ${commit} -- backend/prisma/migrations/`, ROOT)
  .split('\n').filter((l) => l.endsWith('migration.sql'));
console.log(`OK    migration set: ${migs.length} files`);
console.log(`        tree ${sh(`git rev-parse ${commit}:backend/prisma/migrations`, ROOT)}`);

console.log('\n' + '='.repeat(74));
console.log(stop ? 'PREFLIGHT: STOP — do not build or deploy' : 'PREFLIGHT: PASS');
console.log('='.repeat(74));
process.exit(stop ? 1 : 0);
