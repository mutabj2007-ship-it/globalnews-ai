import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * RELEASE-EXACT-CANDIDATE-FILE-INCLUSION-1 — regression coverage for a release
 * defect that produces NO symptom until after it has shipped.
 *
 * THE DEFECT. `railway up` honours `.gitignore` BY DEFAULT, and it does not
 * consult the git index while doing so. A file can therefore be committed,
 * reviewed, built and tested, and still be silently absent from the uploaded
 * artifact. Nothing reports it: the build succeeds, the container starts, the
 * healthcheck passes, and the deployed tree simply is not the reviewed
 * candidate.
 *
 * It has happened once already. On ALPHA-CANDIDATE-654BE554-DEPLOY-1 exactly
 * one file was caught, by a manual audit rather than by a gate:
 *
 *     .gitignore:20  logs/   ->  frontend/src/app/admin/system/logs/page.tsx
 *
 * A default upload would have shipped 1086 of 1087 files. The mitigation at the
 * time was `--no-gitignore` on the upload; the mitigation here is to stop the
 * rule matching source at all, and to fail this suite if it ever does again.
 *
 * WHY `git check-ignore` WITHOUT `--no-index` CANNOT FIND THIS. By design,
 * check-ignore treats a TRACKED file as not-ignored and exits 1 reporting
 * nothing. That is the right answer for git and the wrong answer for an
 * uploader that walks a directory and never opens the index. `--no-index`
 * makes git evaluate the rules the way the uploader does, and it is the only
 * reason this trap is detectable at all:
 *
 *     git check-ignore -v            <path>   -> exit 1, silent   (MISLEADING)
 *     git check-ignore --no-index -v <path>   -> exit 0, reports  (THE TRUTH)
 *
 * NEGATED PATTERNS ARE NOT TRAPS. `--verbose` prints the last pattern that
 * MATCHED, and a negation such as `!.env.example` matches while meaning
 * "explicitly include". Those entries carry a leading `!` and are filtered out
 * below; counting them reported three `.env.example` files as release blockers
 * when git's own exit status says they ship fine.
 *
 * The full gate, including verification of a prepared upload directory, is
 * `scripts/verify-release-file-inclusion.mjs` (`npm run verify:file-inclusion`).
 * This spec is the always-on subset that runs with the normal test suite.
 */
describe('RELEASE-EXACT-CANDIDATE-FILE-INCLUSION-1 — no tracked source may be ignore-trapped', () => {
  const repoRoot = join(__dirname, '..', '..', '..');

  /**
   * The dynamic sweep needs a real git checkout. A build performed from an
   * exported tarball has no `.git`, and failing there would be a false alarm
   * about the build environment rather than a finding about the repository, so
   * the structural assertion below is the part that always runs.
   */
  const gitAvailable = (() => {
    try {
      execFileSync('git', ['rev-parse', '--git-dir'], { cwd: repoRoot, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  })();

  const maybe = gitAvailable ? it : it.skip;

  maybe('no file in the committed tree is matched by an ignore rule', () => {
    const tracked = execFileSync('git', ['ls-files'], {
      cwd: repoRoot,
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    expect(tracked.length).toBeGreaterThan(0);

    let output = '';
    try {
      output = execFileSync(
        'git',
        ['check-ignore', '--no-index', '--verbose', '--stdin'],
        {
          cwd: repoRoot,
          encoding: 'utf-8',
          input: `${tracked.join('\n')}\n`,
          maxBuffer: 64 * 1024 * 1024,
        },
      );
    } catch (error) {
      // Exit status 1 means NOTHING matched, which is the success case here.
      const err = error as { status?: number; stdout?: string };
      if (err.status === 1) output = err.stdout ?? '';
      else throw error;
    }

    const trapped = output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        /* format: <source>:<lineno>:<pattern>\t<path> */
        const tab = line.lastIndexOf('\t');
        const [source, lineNo, ...patternParts] = line.slice(0, tab).split(':');
        return {
          path: line.slice(tab + 1),
          source,
          line: Number(lineNo),
          pattern: patternParts.join(':'),
        };
      })
      .filter((entry) => !entry.pattern.startsWith('!'));

    // Named explicitly so a failure states which file and which rule, rather
    // than only that a count was non-zero.
    expect(
      trapped.map((t) => `${t.path}  <-  ${t.source}:${t.line} "${t.pattern}"`),
    ).toEqual([]);
  });

  it('keeps the admin system-logs route segment exempt from the runtime `logs/` rule', () => {
    const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf-8').replace(/\r\n/g, '\n');

    // The runtime rule must stay — it is what keeps real log output out of the
    // repository, and narrowing it to `/logs/` would stop ignoring
    // backend/logs/ and frontend/logs/.
    expect(gitignore).toMatch(/^logs\/$/m);

    // The negation is what keeps the Next.js route segment shippable. Removing
    // it silently reintroduces the 1086-of-1087 upload.
    expect(gitignore).toMatch(/^!frontend\/src\/app\/admin\/system\/logs\/$/m);
  });
});
