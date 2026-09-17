/**
 * THE AUTHORITY'S OWN GUARD.
 *
 * The authority is one string. Its value is worth nothing if it can drift back into
 * being derived from the artefact it judges, or if a future edit quietly re-pins a
 * literal beside it. These tests hold both properties down, and each is written so a
 * mutation can make it bite.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CURRENT_EXPECTED_PWA_GENERATION } from './pwaGenerationTestAuthority';

const pwaDir = __dirname;
const authorityPath = join(pwaDir, 'pwaGenerationTestAuthority.ts');
const authoritySource = readFileSync(authorityPath, 'utf-8');

/** Comments carry prose that names the very tokens we forbid, so scan CODE only. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}
const authorityCode = stripComments(authoritySource);

const CONSUMERS = ['serviceWorkerCacheFailure.spec.ts', 'supportOfflineCopy.spec.ts'];
const readSpec = (f: string) => readFileSync(join(pwaDir, f), 'utf-8');

describe('A · the authority is INDEPENDENT of the artefact it judges', () => {
  it('A1 · it exports a bare string literal, and reads, imports and derives nothing', () => {
    expect(authorityCode).toMatch(
      /export const CURRENT_EXPECTED_PWA_GENERATION = '[^']+';/,
    );
    // Nothing that could pull a value in from anywhere.
    expect(authorityCode).not.toMatch(/\bimport\b/);
    expect(authorityCode).not.toMatch(/\brequire\s*\(/);
    expect(authorityCode).not.toMatch(/readFileSync|readFile|createRequire/);
    expect(authorityCode).not.toMatch(/process\.env/);
    // And specifically not the artefact under test, by any route.
    expect(authorityCode).not.toMatch(/sw\.js/);
    expect(authorityCode).not.toMatch(/\bVERSION\b/);
  });

  it('A2 · POSITIVE CONTROL — the comment stripper and the scanner both really work', () => {
    // The doc comment DOES contain the forbidden prose; the raw source proves the
    // scanner would have fired had it not been stripped, so A1 cannot pass vacuously.
    expect(authoritySource).toMatch(/import/);
    expect(authoritySource).toMatch(/VERSION/);
    expect(authoritySource).toMatch(/sw\.js/);
    expect(stripComments('/* import VERSION sw.js */ const a = 1;')).not.toMatch(/VERSION/);
  });

  it('A3 · the exported value is a well-formed generation, and not a superseded one', () => {
    expect(CURRENT_EXPECTED_PWA_GENERATION).toMatch(/^gna-pwa-v[0-9]+$/);
    // A generation is never reused for different bytes. v5 and earlier are spent.
    const n = Number(CURRENT_EXPECTED_PWA_GENERATION.replace('gna-pwa-v', ''));
    expect(n).toBeGreaterThanOrEqual(6);
  });
});

describe('B · both consumers use the SAME authority, and neither re-pins a literal', () => {
  it.each(CONSUMERS)('B1 · %s imports the authority', (file) => {
    expect(readSpec(file)).toContain(
      "import { CURRENT_EXPECTED_PWA_GENERATION } from './pwaGenerationTestAuthority'",
    );
  });

  it.each(CONSUMERS)('B2 · %s asserts the generation AGAINST the authority', (file) => {
    expect(readSpec(file)).toContain('expect(version).toBe(CURRENT_EXPECTED_PWA_GENERATION)');
  });

  it.each(CONSUMERS)('B3 · %s equality-pins no generation literal', (file) => {
    // Narrow on purpose: a purge list or a harness input may legitimately name an
    // old generation. What may not exist is an EQUALITY ASSERTION against a literal.
    expect(stripComments(readSpec(file))).not.toMatch(/toBe\(\s*'gna-pwa-v[0-9]+'\s*\)/);
  });

  it('B4 · POSITIVE CONTROL — B3 would catch a re-pinned literal', () => {
    expect("expect(version).toBe('gna-pwa-v5');").toMatch(/toBe\(\s*'gna-pwa-v[0-9]+'\s*\)/);
    // and the legitimate shapes it must NOT catch:
    expect("for (const g of ['gna-pwa-v2', 'gna-pwa-v3'])").not.toMatch(
      /toBe\(\s*'gna-pwa-v[0-9]+'\s*\)/,
    );
    expect("expect(version).not.toBe('gna-pwa-v1');").toMatch(/toBe\(\s*'gna-pwa-v[0-9]+'\s*\)/);
  });
});

describe('C · the authority is TEST SUPPORT and never ships', () => {
  it('C1 · no non-spec module under src/ imports it', () => {
    const { execSync } = require('child_process') as typeof import('child_process');
    const root = join(pwaDir, '..', '..');
    const out = execSync(
      `grep -rl "pwaGenerationTestAuthority" ${JSON.stringify(root)} || true`,
      { encoding: 'utf-8' },
    )
      .split('\n')
      .filter(Boolean)
      .map((p) => p.split('/').pop() as string)
      .filter((f) => f !== 'pwaGenerationTestAuthority.ts');

    expect(out.length).toBeGreaterThan(0); // the grep really found something
    for (const f of out) expect(f).toMatch(/\.spec\.ts$/);
  });
});
