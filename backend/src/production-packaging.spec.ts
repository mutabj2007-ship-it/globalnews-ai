import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * PRODUCTION PACKAGING — THE REGRESSION TEST THE PO ASKED FOR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ruling, verbatim: "regression test verifies both source presence AND
 * built-artifact presence" and "Do not accept a Nest compile as sufficient
 * evidence."
 *
 * THE DEFECT: `nest build` compiled cleanly, the image shipped, and
 * /geo/search and /geo/map-feed died on
 *
 *     ENOENT /app/backend/dist/modules/geo/data/gazetteer.v1.json
 *
 * because `nest-cli.json` declared no `assets` rule. A green compile said
 * nothing about it, and nothing in this suite would have caught it.
 *
 * ── WHY THIS SPEC SHELLS OUT INSTEAD OF REIMPLEMENTING THE CHECK ────────────
 *
 * The same logic runs in two places — here, under `npm test`, and in
 * `npm run build`, where it is the gate that stops a bad image being produced.
 * If this file reimplemented the rules they would drift, and the version that
 * drifted would be the one nobody ran. So there is ONE implementation,
 * `scripts/verify-geo-packaging.mjs`, and this spec runs it.
 *
 * The build gate is the load-bearing half. This spec is what makes the gate's
 * own behaviour a tested property rather than a hope: it asserts that the gate
 * PASSES on this tree, and — the assertion that actually matters — that it
 * FAILS on the exact configuration that shipped the defect.
 */

const BACKEND_DIR = join(__dirname, '..');
const REPO_DIR = join(BACKEND_DIR, '..');
const VERIFIER = join(REPO_DIR, 'scripts', 'verify-geo-packaging.mjs');

interface VerifierResult {
  readonly status: number;
  readonly output: string;
}

function runVerifier(backendDir: string, requireDist = false): VerifierResult {
  const args = [VERIFIER, '--backend', backendDir, ...(requireDist ? ['--require-dist'] : [])];

  try {
    const output = execFileSync('node', args, { encoding: 'utf8', stdio: 'pipe' });
    return { status: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? 1,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
    };
  }
}

/** Every file that physically sits in a runtime `data/` directory. */
function shippedDataFiles(root: string): string[] {
  const out: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'generated') continue;
        walk(path);
        continue;
      }
      const rel = relative(root, path).split(sep).join('/');
      if (/(^|\/)data\//.test(rel)) out.push(rel);
    }
  };

  walk(root);
  return out.sort();
}

describe('1 · the runtime data this backend reads is declared for packaging', () => {
  it('the gate passes on this tree', () => {
    const result = runVerifier(BACKEND_DIR);

    expect(result.output).toContain('GEO RUNTIME PACKAGING');
    expect(result.status).toBe(0);
  });

  it('every file in a runtime data/ directory is named in the gate report', () => {
    /*
     * The report is the inventory. If a data file exists and the gate does not
     * mention it, the gate is not looking where the data is — which is a
     * failure of the gate, not of the packaging, and is exactly how a checker
     * ends up passing while the product breaks.
     */
    const files = shippedDataFiles(join(BACKEND_DIR, 'src'));
    const { output } = runVerifier(BACKEND_DIR);

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(output).toContain(file);
  });

  it('nest-cli.json declares asset rules that cover .json AND .geojson', () => {
    /*
     * Asserted directly as well as through the gate, because the two Rwanda
     * boundary files are `.geojson` and a rule written for `.json` alone would
     * package the gazetteer, turn the reported symptom green, and leave the
     * NISR geometry missing.
     */
    const config = JSON.parse(readFileSync(join(BACKEND_DIR, 'nest-cli.json'), 'utf8')) as {
      compilerOptions?: { assets?: ({ include?: string } | string)[] };
    };

    const globs = (config.compilerOptions?.assets ?? []).map((asset) =>
      typeof asset === 'string' ? asset : (asset.include ?? ''),
    );

    expect(globs.some((glob) => glob.endsWith('.json'))).toBe(true);
    expect(globs.some((glob) => glob.endsWith('.geojson'))).toBe(true);
  });
});

describe('2 · THE GATE FAILS ON THE CONFIGURATION THAT SHIPPED THE DEFECT', () => {
  let scratch: string;

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), 'gn-packaging-'));
  });

  afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  /**
   * A backend tree that is THIS tree's real `src`, with a different
   * `nest-cli.json` in front of it.
   *
   * `src` is SYMLINKED rather than copied. The runtime data is ~21 MB, three
   * scenarios would copy 65 MB per run, and a slow suite is a deleted suite.
   * The symlink also removes a whole class of false result: every scenario
   * below is measured against the same bytes the product actually ships, so a
   * pass here cannot come from a stale or partial copy.
   */
  function treeWithConfig(name: string, config: unknown): string {
    const root = join(scratch, name);

    mkdirSync(root, { recursive: true });
    symlinkSync(join(BACKEND_DIR, 'src'), join(root, 'src'), 'dir');
    writeFileSync(join(root, 'nest-cli.json'), JSON.stringify(config, null, 2));

    return root;
  }

  it('C903 — no assets rule at all is reported as the ENOENT cause', () => {
    const root = treeWithConfig('no-assets', {
      collection: '@nestjs/schematics',
      sourceRoot: 'src',
      compilerOptions: { deleteOutDir: true },
    });

    const result = runVerifier(root);

    expect(result.status).toBe(1);
    expect(result.output).toContain('declares no compilerOptions.assets globs');
    expect(result.output).toContain('gazetteer.v1.json');
  });

  it('a rule for .json alone still fails, because the boundary files are .geojson', () => {
    const root = treeWithConfig('json-only', {
      collection: '@nestjs/schematics',
      sourceRoot: 'src',
      compilerOptions: {
        deleteOutDir: true,
        assets: [{ include: 'modules/**/data/**/*.json', watchAssets: true }],
      },
    });

    const result = runVerifier(root);

    expect(result.status).toBe(1);
    expect(result.output).toContain('rwanda-boundary-sectors.geojson');
    /* The gazetteer IS covered by that rule, so it must not be reported. */
    expect(result.output).not.toContain('gazetteer.v1.json: no assets glob');
  });

  it('--require-dist refuses to pass when nothing was built', () => {
    /*
     * "Do not accept a Nest compile as sufficient evidence." With no dist at
     * all there is no evidence whatsoever, and the gate must say so rather
     * than reporting the source half and exiting 0.
     */
    const root = treeWithConfig('unbuilt', {
      collection: '@nestjs/schematics',
      sourceRoot: 'src',
      compilerOptions: {
        deleteOutDir: true,
        assets: [
          { include: 'modules/**/data/**/*.json', watchAssets: true },
          { include: 'modules/**/data/**/*.geojson', watchAssets: true },
        ],
      },
    });

    expect(runVerifier(root, false).status).toBe(0);
    expect(runVerifier(root, true).status).toBe(1);
    expect(runVerifier(root, true).output).toContain('dist/ does not exist');
  });
});

describe('3 · the gate is wired into the build, not merely available', () => {
  it('npm run build runs the verifier after nest build', () => {
    /*
     * The whole point of the ruling. A gate that exists but is not wired in is
     * a gate nobody passes through — and the previous two instances of this
     * bug class were both fixed by a change that nothing enforced afterwards.
     */
    const pkg = JSON.parse(readFileSync(join(BACKEND_DIR, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    const build = pkg.scripts?.build ?? '';

    expect(build).toContain('nest build');
    expect(build).toContain('verify-geo-packaging.mjs');
    expect(build).toContain('--require-dist');
  });

  it('the Dockerfile copies the scripts directory into the build stage', () => {
    /*
     * Without this the gate cannot run inside the image and the build fails
     * for the wrong reason — which is how a safety check gets deleted.
     */
    const dockerfile = readFileSync(join(BACKEND_DIR, 'Dockerfile'), 'utf8');

    expect(dockerfile).toMatch(/COPY\s+scripts\s+\.\/scripts/);
  });
});
