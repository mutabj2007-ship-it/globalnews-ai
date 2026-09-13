#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRODUCTION PACKAGING GATE — A SUCCESSFUL COMPILE IS NOT A SUCCESSFUL BUILD
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PO ruling, verbatim: *"regression test verifies both source presence AND
 * built-artifact presence... Do not accept a Nest compile as sufficient
 * evidence."*
 *
 * ── THE DEFECT THIS EXISTS TO MAKE IMPOSSIBLE ───────────────────────────────
 *
 * Railway Alpha failed with:
 *
 *     ENOENT /app/backend/dist/modules/geo/data/gazetteer.v1.json
 *
 * `nest build` compiled every TypeScript file without a single error, the
 * Docker build succeeded, the image shipped, and `/geo/search` and
 * `/geo/map-feed` were dead on arrival — because `nest-cli.json` declared no
 * `assets` rule and the compiler copies nothing but `.js`. The build was
 * green and the product was broken, which is the exact failure mode a compile
 * status cannot detect.
 *
 * IT IS THE THIRD INSTANCE OF THIS CLASS IN THIS REPOSITORY. Milestone #54
 * fixed the same shape of bug for the Prisma schema and migrations with an
 * explicit COPY, and nothing generalised the lesson. This script is the
 * generalisation: it is wired into `npm run build --workspace=backend` AFTER
 * `nest build`, so the build itself fails and no image is produced.
 *
 * ── WHAT IT CHECKS, AND WHY BOTH HALVES ARE NEEDED ──────────────────────────
 *
 * 1. READ-SITE. Every `join(__dirname, 'data', …)` in `backend/src` is found
 *    by reading the source, and each filename it resolves must exist in a
 *    runtime `data/` directory. This half catches code that reads a file
 *    nobody shipped.
 *
 * 2. SOURCE-DERIVED. Every file that physically sits in any
 *    `backend/src/**​/data/` directory must be matched by an `assets` glob in
 *    `nest-cli.json`. This half catches a NEW data file added next year with
 *    no packaging rule — whatever its extension.
 *
 * 3. ARTIFACT-DERIVED. Each of those files must then exist under `dist/` at
 *    the same relative path and the same byte length. This half catches a
 *    packaging rule that exists but does not work — a bad glob, a
 *    `deleteOutDir` race, an extension the copier skips, a truncated copy.
 *
 * No half alone is enough. The source half passes if a glob is syntactically
 * present but matches nothing; the artifact half passes if a stale `dist`
 * still holds yesterday's copy; the read-site half says nothing about
 * packaging at all. Together they say the thing we actually need: *the file
 * the code will read at runtime is in the artifact we are about to ship.*
 *
 * ── DISCOVERY IS BY MEASUREMENT, NOT BY A LIST ──────────────────────────────
 *
 * There is no hard-coded inventory of data files here, deliberately. A list
 * would have to be maintained by the same person who forgot the packaging
 * rule. The `data/` directories and the runtime read sites ARE the inventory.
 *
 * USAGE
 *   node scripts/verify-geo-packaging.mjs [--backend <dir>] [--require-dist]
 *
 *   --require-dist   fail when dist/ is absent, instead of reporting the
 *                    source half only. Set automatically when run from the
 *                    backend build script.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/* ── ARGUMENTS ────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const argValue = (flag) => {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
};

const backendDir = resolve(argValue('--backend') ?? join(HERE, '..', 'backend'));
const requireDist = argv.includes('--require-dist');

const srcDir = join(backendDir, 'src');
const distDir = join(backendDir, 'dist');
const nestCliPath = join(backendDir, 'nest-cli.json');

/* ── 0 · WALK ─────────────────────────────────────────────────────────────── */

function walk(dir, predicate, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'generated') continue;
      walk(path, predicate, out);
    } else if (predicate(path)) {
      out.push(path);
    }
  }
  return out;
}

/* ── 1 · FIND EVERY RUNTIME DATA READ, BY READING THE SOURCE ──────────────── */

/**
 * Matches `join(__dirname, 'data', 'name.ext')` and the two-argument form
 * `join(__dirname, 'data', file)` where `file` is a variable. The variable
 * form cannot be resolved statically, so its enclosing file is searched for
 * the literal filenames it can hold — which is how the two Rwanda boundary
 * `.geojson` files are found, since both are read through one `file` binding.
 */
const READ_SITE = /join\(\s*__dirname\s*,\s*['"]data['"]\s*,\s*([^)]+)\)/g;
const LITERAL = /['"]([A-Za-z0-9._-]+\.(?:json|geojson))['"]/g;

function discoverReadNames() {
  const required = new Map(); // filename -> [source files that read it]

  for (const file of walk(srcDir, (p) => p.endsWith('.ts') && !p.endsWith('.spec.ts'))) {
    const text = readFileSync(file, 'utf8');
    if (!READ_SITE.test(text)) continue;
    READ_SITE.lastIndex = 0;

    /*
      The read site proves this module loads SOMETHING from `data/`. Which
      files it can load is then every data-shaped string literal in that same
      module — a deliberate over-collection: naming one file too many makes
      the build assert a file is packaged that nothing reads, which is
      harmless, while naming one too few is the defect this script exists to
      prevent.
    */
    for (const match of text.matchAll(LITERAL)) {
      const name = match[1];
      const readers = required.get(name) ?? [];
      readers.push(relative(backendDir, file));
      required.set(name, readers);
    }
  }

  return required;
}

/**
 * EVERY FILE THAT PHYSICALLY SITS IN A RUNTIME `data/` DIRECTORY.
 *
 * THIS IS THE INVENTORY THAT MATTERS, and it exists because the read-site scan
 * above has a blind spot I measured rather than assumed: it recognises
 * `.json` and `.geojson` literals, so a future data file in another format —
 * a `.yaml` roster, a `.csv` table, a `.pbf` tile — would be read by code the
 * scan sees and named by a literal the scan does not, and would ship missing
 * exactly like the gazetteer did.
 *
 * Widening the literal pattern to "any extension" was the obvious fix and is
 * the wrong one: a version string like `'v1.0'` parses as a filename with
 * extension `0`, and the gate would fail the build over a file that was never
 * meant to exist. So the directory itself is the authority. Anything a
 * developer puts in `src/**​/data/` is data they intend to ship, whatever its
 * extension, and it must be packaged.
 */
function discoverDataDirFiles() {
  const inDataDir = (path) => {
    const rel = relative(srcDir, path).split(sep).join('/');
    return /(^|\/)data\//.test(rel);
  };

  return walk(srcDir, inDataDir).map((path) => relative(srcDir, path).split(sep).join('/'));
}

/* ── 2 · THE ASSET GLOBS DECLARED IN nest-cli.json ────────────────────────── */

function assetGlobs() {
  const config = JSON.parse(readFileSync(nestCliPath, 'utf8'));
  const assets = config?.compilerOptions?.assets ?? [];

  return assets.map((asset) => (typeof asset === 'string' ? asset : asset.include)).filter(Boolean);
}

/**
 * Glob match with node-glob's semantics for `**`, which is the matcher the
 * Nest CLI's asset copier actually uses.
 *
 * THE SUBTLETY THAT MATTERS, AND THAT THIS SCRIPT GOT WRONG ONCE: a `**`
 * segment matches ZERO OR MORE path segments, so `modules/**​/data/**​/*.json`
 * matches `modules/geo/data/gazetteer.v1.json` even though nothing sits
 * between `data/` and the filename. Treating `**` as "one or more" made this
 * verifier report a correct packaging rule as broken — a false failure, which
 * in a build gate is just as damaging as a false pass.
 */
function globMatches(glob, path) {
  const parts = glob.split('/');
  let pattern = '^';

  parts.forEach((part, index) => {
    const last = index === parts.length - 1;

    if (part === '**') {
      pattern += last ? '.*' : '(?:[^/]+/)*';
      return;
    }

    pattern += part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
    if (!last) pattern += '/';
  });

  return new RegExp(`${pattern}$`).test(path);
}

/* ── 3 · RUN ──────────────────────────────────────────────────────────────── */

const failures = [];
const checked = [];

const required = discoverReadNames();
const shipped = discoverDataDirFiles();
const globs = assetGlobs();

if (shipped.length === 0) {
  failures.push(
    'No files were found under any backend/src/**/data/ directory. Either the runtime data was ' +
      'deleted or this scan is broken — both are reasons to stop, not to pass.',
  );
}

if (required.size === 0) {
  failures.push(
    'No runtime data reads were discovered in backend/src. Either the scan is broken or the ' +
      'read pattern changed — both are reasons to stop, not to pass.',
  );
}

if (globs.length === 0) {
  failures.push(
    'backend/nest-cli.json declares no compilerOptions.assets globs. `nest build` therefore ' +
      'copies no data files into dist/, which is the exact defect that produced ' +
      'ENOENT dist/modules/geo/data/gazetteer.v1.json on Alpha.',
  );
}

/*
  3a — READ-SITE HALF: a file the code reads must EXIST in source. This is the
  only thing the read-site scan is responsible for; whether it is packaged is
  decided below, against the directory inventory, which cannot be fooled by an
  unfamiliar extension.
*/
for (const [name, readers] of [...required].sort()) {
  if (!shipped.some((rel) => rel.endsWith(`/${name}`) || rel === name)) {
    failures.push(
      `${name}: read by ${readers.join(', ')} but NOT PRESENT in any backend/src/**/data/ directory.`,
    );
  }
}

{
  for (const relToSrc of shipped.sort()) {
    const sourcePath = join(srcDir, relToSrc);

    /* 3b — SOURCE-DERIVED: a packaging rule must claim this file. */
    if (!globs.some((glob) => globMatches(glob, relToSrc))) {
      failures.push(
        `${relToSrc}: no assets glob in nest-cli.json matches this file, so nest build will ` +
          `not copy it. Declared globs: ${globs.join(', ')}`,
      );
      continue;
    }

    /* 3c — ARTIFACT-DERIVED: the built output must actually contain it. */
    const distPath = join(distDir, relToSrc);
    const sourceBytes = statSync(sourcePath).size;

    if (!existsSync(distDir)) {
      if (requireDist) {
        failures.push(
          `${relToSrc}: dist/ does not exist, so the artifact half cannot be verified. ` +
            'A compile that produced no output is not a build.',
        );
      }
      checked.push({ file: relToSrc, source: sourceBytes, dist: null, packaged: 'UNBUILT' });
      continue;
    }

    if (!existsSync(distPath)) {
      failures.push(
        `${relToSrc}: present in src and matched by an assets glob, but MISSING from dist/. ` +
          'The packaging rule exists and did not work — this is the failure that reaches ' +
          'production as a runtime ENOENT.',
      );
      continue;
    }

    const distBytes = statSync(distPath).size;

    if (distBytes !== sourceBytes) {
      failures.push(
        `${relToSrc}: dist copy is ${distBytes} bytes, source is ${sourceBytes}. A truncated or ` +
          'rewritten data file is not the file the code was verified against.',
      );
      continue;
    }

    checked.push({ file: relToSrc, source: sourceBytes, dist: distBytes, packaged: 'OK' });
  }
}

/* ── 4 · REPORT ───────────────────────────────────────────────────────────── */

const width = Math.max(0, ...checked.map((row) => row.file.length));

process.stdout.write('\nGEO RUNTIME PACKAGING\n');
process.stdout.write(`${'─'.repeat(Math.max(38, width + 34))}\n`);

for (const row of checked) {
  process.stdout.write(
    `  ${row.packaged === 'OK' ? '✓' : '·'} ${row.file.padEnd(width)}  ` +
      `${String(row.source).padStart(9)} B  ${row.packaged}\n`,
  );
}

if (failures.length > 0) {
  process.stderr.write('\nPACKAGING FAILURES\n');
  for (const failure of failures) process.stderr.write(`  ✗ ${failure}\n`);
  process.stderr.write(
    `\n${failures.length} packaging failure(s). The compile may have succeeded; the build did not.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `\n${checked.length} runtime data file(s) verified against ${globs.length} packaging rule(s).\n`,
);
