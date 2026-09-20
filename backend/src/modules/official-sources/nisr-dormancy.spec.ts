/**
 * ════════════════════════════════════════════════════════════════════════════
 * NISR STAYS DORMANT — AND THIS RUNS IN CI, NOT ONLY IN THE MANUAL HARNESS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * This round landed a parser, a media row, a registry row and a numeric path for a source
 * that must not fetch anything. The manual harness checks the gate before it runs, which
 * is necessary and is not sufficient: the harness only runs when a human runs it, and the
 * property that matters is what holds WHEN NOBODY IS LOOKING.
 *
 * So the dormancy facts are asserted here, in the repository suite, where they are checked
 * on every change rather than on every rehearsal.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { installedNisrCpiTextLayerExtractorId, resolveParserBinding } from '@globalnews-ai/shared';

import { OFFICIAL_SOURCES } from './official-source-registry';

const BACKEND = join(__dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('rw-nisr is registered and dormant', () => {
  const entry = OFFICIAL_SOURCES.find((s) => s.id === 'rw-nisr');

  it('is registered, and registration is not activation', () => {
    expect(entry).toBeDefined();
    expect(entry!.enabled).toBe(false);
    expect(entry!.ingestionMethod).toBe('none');
  });

  it('appears in no enabled-source list, so no scheduler can reach it', () => {
    const enabled = OFFICIAL_SOURCES.filter((s) => s.enabled).map((s) => s.id);
    expect(enabled).not.toContain('rw-nisr');
  });

  it('landing a parser did not enable anything — the registry row is not a switch', () => {
    /* The binding exists and resolves. That says what MAY read those bytes if they ever
       arrive through a governed fetch; it causes no fetch, and nothing in `src/` starts
       one. */
    expect(resolveParserBinding('rw-nisr', 'cpi-monthly-en', 'application/pdf')).not.toBeNull();
    expect(entry!.enabled).toBe(false);
  });
});

describe('nothing in the production tree can reach the network harness', () => {
  const sources = walk(join(BACKEND, 'src'));

  it('no file under src/ imports anything from tooling/', () => {
    const offenders = sources.filter((f) => {
      const text = readFileSync(f, 'utf8');
      return /from\s+['"][^'"]*\/tooling\//.test(text) || /require\(\s*['"][^'"]*\/tooling\//.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it('tooling/ is excluded from the production build by an EXISTING rule', () => {
    /* Not by an exemption written to accommodate the harness: `tooling/**` was already
       in this list, and "add an exclude for my file" is the version of this fix that
       quietly weakens the config. */
    const build = readFileSync(join(BACKEND, 'tsconfig.build.json'), 'utf8');
    expect(build).toContain('tooling');
  });

  it('the harness is not a spec, so the repository suite never collects it', () => {
    const toolingDir = join(BACKEND, 'tooling', 'nisr-rehearsal');
    const files = readdirSync(toolingDir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((f) => f.endsWith('.spec.ts'))).toEqual([]);
  });
});

describe('the decoder refuses by default, so a forgotten wiring reads nothing', () => {
  it('has no text-layer extractor installed in an ordinary runtime', () => {
    /* THE SAFE DIRECTION. A deployment that never installs an extractor reads no NISR
       figures; it does not read them badly. The harness installs one for its own run and
       this suite never does. */
    expect(installedNisrCpiTextLayerExtractorId()).toBe('nisr.cpi.no-extractor-installed');
  });

  it('refuses an artifact rather than guessing, with nothing installed', () => {
    const binding = resolveParserBinding('rw-nisr', 'cpi-monthly-en', 'application/pdf')!;
    const out = binding.decode(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.refusalKey).toBe('PARSE_FAILED');
    expect(out.detail).toContain('NISR_PDF_NO_TEXT_LAYER');
  });
});
