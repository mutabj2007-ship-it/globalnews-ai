#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════
 * SPATIAL TOKEN RESOLUTION GATE — C907 §1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE RULING:
 *
 *     ACTIVE SPATIAL CLASS + UNKNOWN sp-* TOKEN = BUILD FAILURE
 *     "The gate must inventory the active Spatial source and verify every used
 *      sp-* colour/utility against Tailwind configuration.
 *      Do not merely assert a selected subset."
 *
 * ── WHY THIS IS A BUILD STEP AND NOT A JEST TEST ────────────────────────────
 *
 * The defect it exists to catch survived every green suite this repository has
 * ever run. `bg-sp-panel`, `text-sp-ink-3` and 43 other names were used 625
 * times across 30 files while `tailwind.config.ts` defined none of them, from
 * the base commit through C906, and not one spec referenced an `sp-*` token.
 * A test that has to be written to catch a class of bug cannot catch the bug
 * class "nobody wrote a test". An INVENTORY can: it starts from the source and
 * asks what it needs, rather than starting from a list and asking whether the
 * list still holds.
 *
 * Tailwind's failure mode is what makes this necessary. An unknown token is
 * not an error — Tailwind emits no rule and says nothing, the element renders
 * with no background and no border, and the page falls through to whatever the
 * body carries. Silence is the whole problem, so the gate supplies the noise.
 *
 * ── WHAT IT READS, AND WHY IT PARSES RATHER THAN IMPORTS ────────────────────
 *
 * `tailwind.config.ts` is TypeScript, and this must run in a plain `node`
 * process during `next build` before any transform is available — so the `sp`
 * block is read by brace-matching and a key regex rather than by importing the
 * module. The parse is deliberately strict: if the `sp` block cannot be found
 * at all, that is a FAILURE, not an empty set. A gate that silently passes
 * when it cannot find its own input is worse than no gate.
 *
 * Usage: node scripts/verify-spatial-tokens.mjs [--worktree <abs>] [--json]
 * Exit 0 = every used token resolves. Exit 1 = at least one does not.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const JSON_OUT = args.includes('--json');

/**
 * The worktree root.
 *
 * `next build` runs this with `frontend/` as the working directory and CI runs
 * it from the repository root, so the root is FOUND rather than assumed:
 * walk up from the working directory until `frontend/tailwind.config.ts`
 * exists. An explicit `--worktree` always wins.
 *
 * A gate that cannot locate its own input must FAIL rather than pass quietly,
 * so an unresolvable root is an error with a message, not an exception with a
 * stack trace.
 */
function findRoot() {
  const explicit = flag('--worktree');
  if (explicit) return resolve(explicit);

  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'frontend', 'tailwind.config.ts'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  console.error('');
  console.error('SPATIAL TOKEN GATE — FAIL');
  console.error(`  Could not locate frontend/tailwind.config.ts from ${process.cwd()}.`);
  console.error('  Pass --worktree <abs> to say where the repository root is.');
  console.error('');
  process.exit(1);
}

const ROOT = findRoot();

const FRONTEND_SRC = join(ROOT, 'frontend', 'src');
const CONFIG = join(ROOT, 'frontend', 'tailwind.config.ts');

/* ── 1 · THE DEFINED SET ──────────────────────────────────────────────────── */

/**
 * The `sp` colour group's keys, by brace-matching from `sp: {`.
 *
 * The opening is matched with its surrounding punctuation so a comment
 * mentioning "sp: {" cannot be picked up instead of the declaration.
 */
function readDefinedTokens() {
  const source = readFileSync(CONFIG, 'utf8');
  const open = source.search(/\n\s+sp:\s*\{/);

  if (open === -1) {
    fail([
      'FATAL: no `sp` colour group found in frontend/tailwind.config.ts.',
      'Every Spatial utility would silently emit no CSS. This is the exact',
      'defect the C907 audit measured on Alpha.',
    ]);
  }

  let depth = 0;
  let i = source.indexOf('{', open);
  const start = i;
  for (; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }

  const block = source.slice(start, i + 1);
  /* Keys only — a value's own text can never be mistaken for a key because the
     match is anchored to a line start and requires the colon-quote that begins
     a value. */
  const keys = new Set(
    [...block.matchAll(/\n\s+'?([A-Za-z0-9][A-Za-z0-9-]*)'?\s*:\s*'/g)].map((m) => m[1]),
  );

  if (keys.size === 0) fail(['FATAL: the `sp` colour group is empty.']);

  return keys;
}

/* ── 2 · THE USED SET ─────────────────────────────────────────────────────── */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Every `…-sp-<token>` utility in the source, with where it was written.
 *
 * The token is everything after the FIRST `-sp-`, minus an opacity modifier.
 * That rule is correct for every utility shape this repository uses —
 * `bg-sp-panel`, `text-sp-ink-2`, `border-l-sp-capability`,
 * `hover:border-sp-cyan/45`, `focus-visible:outline-sp-cyan` — because
 * Tailwind resolves the colour name as the remainder after the utility prefix,
 * and no defined key contains the substring `-sp-`.
 */
function readUsedTokens(files) {
  const used = new Map(); // token -> [{file, line}]
  const dynamic = []; // constructed class names, which cannot be verified OR emitted

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');

    lines.forEach((line, index) => {
      for (const m of line.matchAll(/[A-Za-z][A-Za-z0-9-]*-sp-([A-Za-z0-9-]+)/g)) {
        const token = m[1].replace(/\/\d+$/, '');
        if (!used.has(token)) used.set(token, []);
        used.get(token).push({ file: relative(ROOT, file), line: index + 1 });
      }

      /*
        A class assembled at runtime is invisible to Tailwind's own content
        scanner too, so it would emit no CSS even if the token were defined.
        It is a failure for the same reason an unknown token is.
      */
      if (/-sp-\$\{/.test(line)) {
        dynamic.push({ file: relative(ROOT, file), line: index + 1, text: line.trim().slice(0, 120) });
      }
    });
  }

  return { used, dynamic };
}

/* ── 3 · THE VERDICT ──────────────────────────────────────────────────────── */

function fail(lines) {
  console.error('');
  console.error('SPATIAL TOKEN GATE — FAIL');
  for (const line of lines) console.error(`  ${line}`);
  console.error('');
  process.exit(1);
}

const defined = readDefinedTokens();
const { used, dynamic } = readUsedTokens(walk(FRONTEND_SRC));

const unresolved = [...used.keys()].filter((token) => !defined.has(token)).sort();
const unused = [...defined].filter((token) => !used.has(token)).sort();

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        defined: [...defined].sort(),
        used: [...used.keys()].sort(),
        unresolved,
        unused,
        dynamic,
      },
      null,
      2,
    ),
  );
}

if (unresolved.length > 0 || dynamic.length > 0) {
  const report = [];

  for (const token of unresolved) {
    const sites = used.get(token);
    report.push(`UNRESOLVED  sp-${token}  (${sites.length} use${sites.length === 1 ? '' : 's'})`);
    for (const site of sites.slice(0, 4)) report.push(`              ${site.file}:${site.line}`);
    if (sites.length > 4) report.push(`              … and ${sites.length - 4} more`);
  }

  for (const site of dynamic) {
    report.push(`CONSTRUCTED sp-* class at ${site.file}:${site.line}`);
    report.push(`              ${site.text}`);
    report.push('              Tailwind cannot see a class built at runtime; write it literally.');
  }

  report.push('');
  report.push('An unknown Tailwind token emits NO CSS and fails SILENTLY.');
  report.push('Define it in the `sp` group from an accepted Design source, or repoint');
  report.push('the consumer at a token whose identity is proven. Do not invent a value.');

  fail(report);
}

console.log(
  `SPATIAL TOKEN GATE — PASS · ${used.size} token${used.size === 1 ? '' : 's'} used, ` +
    `${defined.size} defined, 0 unresolved`,
);

/*
  A DEFINED-BUT-UNUSED TOKEN IS A WARNING, NOT A FAILURE.

  It is how this class of defect starts rather than how it ends:
  `REFERENCE_COLOURS.coast` sat correct and unconsumed while the coastline was
  drawn at the border colour, and nothing said so. Worth surfacing; not worth
  blocking a release over, because a token can legitimately land one commit
  before its consumer.
*/
if (unused.length > 0) {
  console.log(`  note: ${unused.length} defined but unused — ${unused.map((t) => `sp-${t}`).join(', ')}`);
}
