#!/usr/bin/env node
/**
 * ═══ RELEASE-EXACT-CANDIDATE-FILE-INCLUSION-1 ═══════════════════════════
 *
 * THE DEFECT THIS GATE EXISTS TO PREVENT, STATED PLAINLY.
 *
 * `railway up` honours `.gitignore` BY DEFAULT. It does not care whether a
 * file is tracked by git — it applies the ignore rules to the directory it is
 * uploading. So a file that is committed, reviewed, built and tested can still
 * be silently absent from the deployed artifact, and NOTHING reports it: the
 * build succeeds, the container starts, the healthcheck passes, and the
 * deployed tree is simply not the candidate that was approved.
 *
 * This is not hypothetical. On ALPHA-CANDIDATE-654BE554-DEPLOY-1 exactly one
 * file was caught by this trap:
 *
 *     .gitignore:20  logs/
 *     -> frontend/src/app/admin/system/logs/page.tsx
 *
 * A default upload would have shipped 1086 of 1087 files and the deployed
 * artifact would NOT have been candidate 654be554. It was caught by a manual
 * audit and mitigated with `--no-gitignore`. A manual audit is not a gate.
 *
 * ─── WHY `git check-ignore` ALONE DOES NOT FIND IT ──────────────────────
 *
 * By design, `git check-ignore` SKIPS TRACKED FILES — a tracked file is not
 * "ignored" as far as git's own index is concerned, so it exits 1 and reports
 * nothing. That answer is correct for git and WRONG for an uploader that never
 * looks at the index. `--no-index` is what makes git evaluate the rules the way
 * a directory-walking uploader does, and it is the whole reason this trap can
 * sit in a repository unnoticed.
 *
 *     git check-ignore -v            <file>   -> exit 1, silent   (MISLEADING)
 *     git check-ignore --no-index -v <file>   -> exit 0, reports  (THE TRUTH)
 *
 * ─── WHAT THIS SCRIPT CHECKS ────────────────────────────────────────────
 *
 *   MODE 1 (default) — REPO INVARIANT, runs in CI, no deployment needed.
 *     Every file in the git tree is evaluated with `--no-index`. If ANY tracked
 *     file is matched by an ignore rule, the gate FAILS and names the file and
 *     the exact `.gitignore` line that traps it. This is the permanent
 *     regression gate: the trap cannot be reintroduced without failing here.
 *
 *   MODE 2 (--candidate <dir>) — DEPLOYMENT WORKSPACE PROOF.
 *     Verifies a prepared upload directory physically contains every file the
 *     tree says it must, reports missing and unexpected files, and (with
 *     --hash) verifies content byte-for-byte via sha256.
 *
 * Exit code is 0 only when every requested check passes. Anything else is a
 * release blocker.
 *
 * USAGE
 *   node scripts/verify-release-file-inclusion.mjs
 *   node scripts/verify-release-file-inclusion.mjs --tree <sha>
 *   node scripts/verify-release-file-inclusion.mjs --candidate C:/path/to/workspace --hash
 *   node scripts/verify-release-file-inclusion.mjs --json evidence.json
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/* ── argument parsing ─────────────────────────────────────────────────── */

function parseArgs(argv) {
  const opts = { tree: 'HEAD', candidate: null, hash: false, json: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--tree') opts.tree = argv[++i];
    else if (a === '--candidate') opts.candidate = argv[++i];
    else if (a === '--hash') opts.hash = true;
    else if (a === '--json') opts.json = argv[++i];
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return opts;
}

/* ── git helpers ──────────────────────────────────────────────────────── */

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

function git(args, input) {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * Every path in the tree. This is the AUTHORITATIVE expected file set: it is
 * what the reviewed commit contains, which is exactly what must reach the
 * platform.
 */
function treeFiles(tree) {
  return git(['ls-tree', '-r', '--name-only', tree])
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * The trapped set. `--no-index` is load-bearing — see the header.
 *
 * check-ignore exits 1 when NOTHING matches, which is the success case here,
 * so a non-zero exit is not an error unless stderr says otherwise.
 *
 * NEGATED PATTERNS MUST BE FILTERED OUT, AND MISSING THAT IS A REAL BUG.
 * `--verbose` reports the last pattern that MATCHED a path, and a negation such
 * as `!.env.example` matches while meaning "explicitly INCLUDE this". Treating
 * those as trapped reported `.env.example`, `backend/.env.example` and
 * `frontend/.env.example` as release blockers when git's own exit code says
 * they are not ignored at all. The `!` prefix is the discriminator, and the
 * authority for "is this actually ignored" is check-ignore's exit status:
 *
 *     git check-ignore --no-index .env.example                  -> exit 1 (kept)
 *     git check-ignore --no-index frontend/.../logs/page.tsx    -> exit 0 (dropped)
 */
function ignoredTrackedFiles(files) {
  let out = '';
  try {
    out = git(['check-ignore', '--no-index', '--verbose', '--stdin'], files.join('\n') + '\n');
  } catch (err) {
    if (err.status === 1) out = err.stdout ?? '';
    else throw err;
  }
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      /* format: <source>:<lineno>:<pattern>\t<path> */
      const tab = line.lastIndexOf('\t');
      const lhs = line.slice(0, tab);
      const path = line.slice(tab + 1);
      const parts = lhs.split(':');
      return {
        path,
        source: parts[0],
        line: Number(parts[1]),
        pattern: parts.slice(2).join(':'),
      };
    })
    /* A negation means the file is explicitly KEPT — the opposite of trapped. */
    .filter((entry) => !entry.pattern.startsWith('!'));
}

/* ── reporting ────────────────────────────────────────────────────────── */

const results = [];
let failed = false;

function record(name, ok, detail) {
  results.push({ check: name, status: ok ? 'PASS' : 'FAIL', detail });
  if (!ok) failed = true;
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`  [${tag}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function sha256File(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

/* ── main ─────────────────────────────────────────────────────────────── */

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(readFileSync(new URL(import.meta.url)).toString().split('*/')[0]);
    return 0;
  }

  console.log('RELEASE-EXACT-CANDIDATE-FILE-INCLUSION-1');
  console.log('='.repeat(72));
  console.log(`repo   : ${REPO_ROOT}`);
  console.log(`tree   : ${opts.tree} (${git(['rev-parse', `${opts.tree}^{tree}`]).trim()})`);
  console.log(`commit : ${git(['rev-parse', opts.tree]).trim()}`);
  console.log('');

  const expected = treeFiles(opts.tree);
  console.log(`Expected file set: ${expected.length} tracked paths`);
  console.log('');

  /* ── MODE 1 — repo invariant ──────────────────────────────────────── */
  console.log('MODE 1 — IGNORE-TRAP INVARIANT (uploader semantics, --no-index)');
  const trapped = ignoredTrackedFiles(expected);

  if (trapped.length === 0) {
    record('no tracked file is matched by an ignore rule', true, `${expected.length} paths clean`);
  } else {
    record(
      'no tracked file is matched by an ignore rule',
      false,
      `${trapped.length} TRAPPED file(s) would be silently dropped by a default upload`,
    );
    console.log('');
    console.log('  TRAPPED FILES — these are in the reviewed tree but an uploader that');
    console.log('  honours .gitignore will NOT ship them:');
    for (const t of trapped) {
      console.log(`    ${t.path}`);
      console.log(`        trapped by ${t.source}:${t.line}  pattern "${t.pattern}"`);
    }
    console.log('');
    console.log('  REMEDIATION (in order of preference):');
    console.log('    1. Narrow or anchor the ignore rule so it stops matching source');
    console.log('       (e.g. "logs/" -> "/logs/", or add a "!path/" negation).');
    console.log('       This fixes the cause and every future upload is safe.');
    console.log('    2. If the rule must stay broad, the upload MUST use --no-gitignore');
    console.log('       AND that flag must be recorded in the deployment evidence.');
    console.log('');
  }

  /* ── MODE 2 — candidate workspace ─────────────────────────────────── */
  if (opts.candidate) {
    const root = resolve(opts.candidate);
    console.log('');
    console.log(`MODE 2 — CANDIDATE WORKSPACE PROOF (${root})`);

    if (!existsSync(root)) {
      record('candidate directory exists', false, root);
    } else {
      record('candidate directory exists', true, root);

      const missing = [];
      const mismatched = [];
      for (const rel of expected) {
        const abs = join(root, rel.split('/').join(sep));
        if (!existsSync(abs) || !statSync(abs).isFile()) {
          missing.push(rel);
          continue;
        }
        if (opts.hash) {
          const want = git(['rev-parse', `${opts.tree}:${rel}`]).trim();
          const got = createHash('sha1')
            .update(`blob ${statSync(abs).size}\0`)
            .update(readFileSync(abs))
            .digest('hex');
          if (want !== got) mismatched.push({ path: rel, expected: want, actual: got });
        }
      }

      record(
        'every expected file is present in the candidate',
        missing.length === 0,
        missing.length === 0
          ? `${expected.length}/${expected.length} present`
          : `${missing.length} MISSING`,
      );
      for (const m of missing.slice(0, 25)) console.log(`      MISSING: ${m}`);
      if (missing.length > 25) console.log(`      ... and ${missing.length - 25} more`);

      if (opts.hash) {
        record(
          'every present file matches the tree byte-for-byte',
          mismatched.length === 0,
          mismatched.length === 0 ? 'all blobs identical' : `${mismatched.length} MISMATCHED`,
        );
        for (const m of mismatched.slice(0, 25)) {
          console.log(`      MISMATCH: ${m.path}`);
          console.log(`         expected blob ${m.expected}`);
          console.log(`         actual   blob ${m.actual}`);
        }
      }
    }
  }

  /* ── evidence ─────────────────────────────────────────────────────── */
  console.log('');
  console.log('='.repeat(72));
  console.log(failed ? 'RESULT: FAIL — release blocker' : 'RESULT: PASS');

  if (opts.json) {
    const evidence = {
      gate: 'RELEASE-EXACT-CANDIDATE-FILE-INCLUSION-1',
      generatedAt: new Date().toISOString(),
      repoRoot: REPO_ROOT,
      commit: git(['rev-parse', opts.tree]).trim(),
      tree: git(['rev-parse', `${opts.tree}^{tree}`]).trim(),
      expectedFileCount: expected.length,
      trapped,
      candidate: opts.candidate ? resolve(opts.candidate) : null,
      results,
      overall: failed ? 'FAIL' : 'PASS',
    };
    writeFileSync(opts.json, JSON.stringify(evidence, null, 2));
    console.log(`evidence written: ${opts.json}`);
  }

  return failed ? 1 : 0;
}

process.exit(main());
