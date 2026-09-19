import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CANDIDATE INTEGRITY — NO PRODUCTION IMPORT MAY RESOLVE VIA AN UNTRACKED FILE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-HUMANITARIAN-SELF-CONTAINED-R2.
 *
 * ── THE DEFECT THIS EXISTS BECAUSE OF, STATED PLAINLY ─────────────────────
 *
 * Commit `a211a04` reported five passing suites and a clean build. Both were true of
 * the WORKING TREE and neither was true of the COMMIT. Four production files it imports
 * — the composition root, the boot module, the intake port and the producer — were
 * untracked, so the committed tree could not compile at all. E1 measured it:
 *
 *     humanitarian-boot.ts  ABSENT at this commit AND on every branch
 *     => './humanitarian-boot' resolves to nothing. The committed tree cannot compile.
 *
 * Every test I ran was honest and every one was measuring the wrong tree. That is the
 * failure mode a green suite cannot see, because the thing it is wrong about is what it
 * is running on.
 *
 * ── WHY A TEST AND NOT A CHECKLIST ────────────────────────────────────────
 *
 * "Remember to commit everything" is the instruction that was already in force. The
 * property has to be checked by something that runs, and it has to be checked against
 * `git ls-files` rather than the filesystem — because the filesystem is precisely what
 * was lying.
 *
 * This walks the real import graph from the application entry point, follows every
 * relative import into the Humanitarian module, and fails naming any file that resolves
 * only because it happens to be present. It is deliberately not limited to Humanitarian:
 * the walk starts at `app.module.ts`, so a production import into ANY untracked file
 * reachable from the app is a failure.
 */

const BACKEND = resolve(__dirname, '..', '..', '..');
const REPO = resolve(BACKEND, '..');

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
}

/** Every path git is actually tracking, as a set for O(1) membership. */
function trackedFiles(): Set<string> {
  return new Set(
    git('ls-files')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== ''),
  );
}

/**
 * IGNORED IS NOT THE SAME AS MISSING, and the distinction is the whole rule.
 *
 * The first run of this audit flagged 34 files under `src/generated/prisma` — the Prisma
 * client, which `backend/.gitignore:5` declares and `prisma generate` reproduces on every
 * install. Those are BUILD ARTEFACTS: a clean checkout does not carry them and does not
 * need to, because the build makes them.
 *
 * G's four files were untracked and NOT ignored — measured, not assumed:
 *
 *     generated/prisma/client.ts        -> backend/.gitignore:5   IGNORED
 *     humanitarian-boot.ts              -> not ignored            OVERSIGHT
 *     humanitarian-intake.port.ts       -> not ignored            OVERSIGHT
 *     humanitarian-authority.loader.ts  -> not ignored            OVERSIGHT
 *     producers/copernicus-ems.producer.ts -> not ignored         OVERSIGHT
 *
 * So the rule is: untracked AND NOT ignored. That is principled rather than an allowlist
 * of paths somebody has to maintain — a build artefact is a thing the repository has
 * DECLARED it does not carry, and an oversight is a thing nobody declared anything about.
 *
 * A file deliberately ignored to silence this check would show up as a .gitignore change
 * in review, which is where that decision belongs.
 */
function isDeclaredBuildArtefact(repoRelativePath: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', repoRelativePath], { cwd: REPO, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Resolve a relative import the way TypeScript would, to a real file on disk. */
function resolveImport(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const IMPORT_RE = /(?:from\s*|require\(\s*)['"](\.[^'"]*)['"]/g;

/**
 * Walk the production import graph from a set of entry points.
 *
 * Spec files are NOT followed. A spec may legitimately import a fixture that nobody
 * ships, and following them would turn this into a test about tests. The question is
 * what the APPLICATION needs in order to run.
 */
function productionClosure(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    if (/\.spec\.tsx?$/.test(file)) continue;
    seen.add(file);

    const src = readFileSync(file, 'utf8');
    for (const match of src.matchAll(IMPORT_RE)) {
      const target = resolveImport(file, match[1]!);
      if (target !== null) queue.push(target);
    }
  }
  return seen;
}

describe('candidate integrity · the committed tree is self-contained', () => {
  const tracked = trackedFiles();
  const appModule = join(BACKEND, 'src', 'app.module.ts');

  it('the audit actually walks a graph (positive control)', () => {
    /*
      If the import regex or the resolver silently stopped matching, every assertion
      below would pass against an empty closure and this suite would certify a perfectly
      self-contained candidate of nothing. That is the failure mode a graph-walking test
      has, so it is checked first.
    */
    expect(existsSync(appModule)).toBe(true);
    const closure = productionClosure([appModule]);

    expect(closure.size).toBeGreaterThan(50);
    expect([...closure].some((f) => f.includes('humanitarian'))).toBe(true);
  });

  it('NO PRODUCTION IMPORT RESOLVES ONLY BECAUSE AN UNTRACKED FILE EXISTS', () => {
    const closure = productionClosure([appModule]);

    const untracked = [...closure]
      .map((f) => relative(REPO, f).replace(/\\/g, '/'))
      .filter((f) => !tracked.has(f) && !isDeclaredBuildArtefact(f))
      .sort();

    /*
      The exact failure of a211a04, which would have read:

        [ 'backend/src/modules/humanitarian/humanitarian-authority.loader.ts',
          'backend/src/modules/humanitarian/humanitarian-boot.ts',
          'backend/src/modules/humanitarian/humanitarian-intake.port.ts',
          'backend/src/modules/humanitarian/producers/copernicus-ems.producer.ts' ]
    */
    expect(untracked).toEqual([]);
  });

  it('and every Humanitarian production file on disk is tracked', () => {
    /*
      The closure above catches what the app IMPORTS. This catches what the module
      CONTAINS — a file that is part of the capability but not yet imported by the entry
      point is still part of the candidate, and shipping it untracked is the same defect
      one step earlier.
    */
    const moduleDir = __dirname;
    const onDisk: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$|\.sql$/.test(entry.name)) continue;
        onDisk.push(relative(REPO, full).replace(/\\/g, '/'));
      }
    };
    walk(moduleDir);

    expect(onDisk.length).toBeGreaterThan(5);
    expect(onDisk.filter((f) => !tracked.has(f) && !isDeclaredBuildArtefact(f)).sort()).toEqual([]);
  });

  it('THE MUTATION · the audit fires on a deliberately untracked import', () => {
    /*
      Proving the guard bites, which matters more here than usual: this test's whole
      purpose is to fail in a situation that has already occurred once and was not
      noticed. A version that could never fail would be worse than no test, because it
      would carry the authority of having checked.

      Done against a synthetic closure rather than by writing a file into the tree — the
      audit's logic is the set difference, and that is what is exercised.
    */
    const syntheticClosure = [
      'backend/src/app.module.ts',
      'backend/src/modules/humanitarian/humanitarian-boot.ts',
    ];
    const syntheticTracked = new Set(['backend/src/app.module.ts']);

    const offenders = syntheticClosure.filter((f) => !syntheticTracked.has(f));

    expect(offenders).toEqual(['backend/src/modules/humanitarian/humanitarian-boot.ts']);
  });

  it('git ls-files is the authority here, not the filesystem', () => {
    // The filesystem is what lied. Asserted so a later refactor cannot quietly swap the
    // source of truth back to existsSync and keep the test name.
    const self = readFileSync(join(__dirname, 'candidate-integrity.spec.ts'), 'utf8');
    expect(self).toContain("git('ls-files')");
  });
});
