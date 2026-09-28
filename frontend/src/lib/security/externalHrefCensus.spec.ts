import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · B-1 — THE CENSUS GUARD.
 *
 * E1 counted 14 publisher/provider href surfaces at 6a163fd; the census at the
 * integration base (5e2297a) found 39 in 31 files plus Conflict's own local
 * scheme check. Fixing today's list is not enough — the next component that
 * writes `href={story.url}` must fail here. This guard reads every production
 * .tsx/.ts file under frontend/src and asserts:
 *
 *   1. every `href={…}` whose expression reads a URL-shaped field
 *      (`.url`, `.sourceUrl`, `Url`) goes through the one boundary
 *      (`safeExternalHref(…)`, or Conflict's `sourceHref(…)`, which delegates);
 *   2. every `target="_blank"` anchor carries `noopener` in its rel;
 *   3. no production file outside the shared boundary performs its own
 *      `javascript:` / protocol allowlist check.
 *
 * Each rule has a positive control proving the detector bites.
 */

const SRC = join(__dirname, '..', '..');

function productionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === '__tests__') continue;
      out.push(...productionFiles(full));
    } else if (/\.(tsx|ts)$/.test(name) && !/\.(spec|test)\.(tsx|ts)$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const URL_FIELD = /(\.url\b|\.sourceUrl\b|\bUrl\b|[a-z]Url\b)/;
const GOVERNED = /^(safeExternalHref|sourceHref)\(/;
/* Internal-route builders whose names end in Url/Href but return same-origin paths. */
const INTERNAL_BUILDERS = /^(accountSignInUrl|historyEntryHref|fullAnalysisHref|dashboardHref)\(/;

export function ungovernedHrefs(source: string): string[] {
  const found: string[] = [];
  const re = /href=\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const expr = m[1].trim();
    if (!URL_FIELD.test(expr)) continue;
    if (GOVERNED.test(expr) || INTERNAL_BUILDERS.test(expr)) continue;
    found.push(expr);
  }
  return found;
}

const stripComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

export function blankTargetsWithoutNoopener(source: string): number {
  let bad = 0;
  const tags = stripComments(source).match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? [];
  for (const tag of tags) {
    const rel = /rel=(?:"([^"]*)"|\{([^}]*)\})/.exec(tag);
    const value = rel ? (rel[1] ?? rel[2] ?? '') : '';
    if (!/noopener|EXTERNAL_LINK_REL/.test(value)) bad += 1;
  }
  return bad;
}

const LOCAL_SCHEME_CHECK = /['"]javascript:['"]|\[\s*['"]https?:['"]\s*,\s*['"]https?:['"]\s*\]\.includes/;

describe('B-1 census — every external href goes through the one boundary', () => {
  const files = productionFiles(SRC);

  it('scans the whole production tree', () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it('positive controls: each detector bites', () => {
    expect(ungovernedHrefs('<a href={story.url}>x</a>')).toEqual(['story.url']);
    expect(ungovernedHrefs('<a href={p.sourceUrl} />')).toEqual(['p.sourceUrl']);
    expect(ungovernedHrefs('<a href={safeExternalHref(story.url)}>x</a>')).toEqual([]);
    expect(ungovernedHrefs('<Link href={module.href}>x</Link>')).toEqual([]);
    expect(blankTargetsWithoutNoopener('<a href="x" target="_blank" rel="noreferrer">')).toBe(1);
    expect(blankTargetsWithoutNoopener('<a href="x" target="_blank" rel="noopener noreferrer">')).toBe(0);
    expect(LOCAL_SCHEME_CHECK.test("['http:', 'https:'].includes(url.protocol)")).toBe(true);
  });

  it('no URL-shaped href bypasses safeExternalHref', () => {
    const offenders = files.flatMap((file) =>
      ungovernedHrefs(readFileSync(file, 'utf8')).map((expr) => `${relative(SRC, file)}: href={${expr}}`),
    );
    expect(offenders).toEqual([]);
  });

  it('every target="_blank" anchor carries noopener', () => {
    const offenders = files.filter((file) => blankTargetsWithoutNoopener(readFileSync(file, 'utf8')) > 0).map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it('no component performs its own scheme allowlist', () => {
    const offenders = files.filter((file) => LOCAL_SCHEME_CHECK.test(readFileSync(file, 'utf8'))).map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it('the governed sites use the shared boundary (39 sites in 31 files + Conflict’s delegate)', () => {
    const governed = files.reduce((n, file) => n + (readFileSync(file, 'utf8').match(/href=\{safeExternalHref\(/g) ?? []).length, 0);
    expect(governed).toBeGreaterThanOrEqual(39);
    expect(readFileSync(join(SRC, 'lib/conflict/retained.ts'), 'utf8')).toMatch(/return safeExternalHref\(value\) \?\? null;/);
  });
});
