import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { ASK_DICTIONARY_CANONICAL_ALIASES, askDictionary } from './askDictionary';
import { askShellAdditive, askShellStrings } from './askShellCatalogue';
import { ASK_SHELL_ADDITIVE_QUALIFIED_UNCHANGED } from './askShellQualifiedUnchanged';
import { askComparisonCoverageLines } from '../askComparisonCoverage';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO SINGLE-SOURCE RULING — CLAUDE L R6 IS PROVENANCE, THE OVERLAY IS THE RUNTIME SOURCE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * L's R6 delivery is vendored byte-for-byte under provenance/claude-l-r6/ as EVIDENCE: it is read
 * by this spec only. The runtime source of every R6 string is the locale overlay's `additive`
 * block, served by askShellAdditive (askShellCatalogue). This spec proves the two agree, so nobody
 * hand-maintains two copies and hopes they stay in step:
 *   1. the vendored files are L's (sha256 against L's own SHA256SUMS);
 *   2. every one of L's 50 keys per locale is integrated exactly once, with L's exact value:
 *      43 AUTHORED_R6 in the overlay, 7 REUSED_VERBATIM_FROM_527 resolved from the shell key;
 *   3. the overlay holds nothing L did not deliver;
 *   4. QUALIFIED_UNCHANGED for these keys is exactly "L's value equals L's English";
 *   5. no runtime module reads the delivery or a separate R6 table.
 */
const PV = join(__dirname, 'provenance', 'claude-l-r6');
const NEW = ['fr', 'de', 'es', 'pt', 'ar'] as const;
type NewLocale = (typeof NEW)[number];
const L_FILE: Record<NewLocale, string> = {
  fr: 'R6-RENDERED-50-fr.json',
  de: 'R6-RENDERED-50-de.json',
  es: 'R6-RENDERED-50-es.json',
  pt: 'R6-RENDERED-50-pt-BR.json',
  ar: 'R6-RENDERED-50-ar.json',
};
const L_COLUMN: Record<NewLocale, string> = { fr: 'fr', de: 'de', es: 'es', pt: 'pt-BR', ar: 'ar' };

interface ManifestRow {
  key: string;
  en: string;
  provenance: 'AUTHORED_R6' | 'REUSED_VERBATIM_FROM_527';
  source_key: string | null;
  [locale: string]: string | null;
}
const manifest = JSON.parse(readFileSync(join(PV, 'ASK-ADDITIVE-KEYS-FILLED.json'), 'utf8')) as {
  keys: ManifestRow[];
};
const delivery = (l: NewLocale): Record<string, string> =>
  (JSON.parse(readFileSync(join(PV, L_FILE[l]), 'utf8')) as { strings: Record<string, string> })
    .strings;

const at = (t: unknown, p: string): unknown =>
  p
    .split('.')
    .reduce<unknown>(
      (n, k) => (n !== null && typeof n === 'object' ? (n as Record<string, unknown>)[k] : undefined),
      t,
    );
const leafPaths = (t: unknown, p = ''): string[] =>
  typeof t === 'string'
    ? [p]
    : t !== null && typeof t === 'object'
      ? Object.entries(t).flatMap(([k, v]) => leafPaths(v, p === '' ? k : `${p}.${k}`))
      : [];

/** The integrated value of one of L's keys, read through the runtime path only. */
function integrated(l: NewLocale, key: string): unknown {
  if (key.startsWith('dict.')) return at(askDictionary(l), key.slice('dict.'.length));
  if (key.startsWith('askComparisonCoverage.'))
    return at(askShellAdditive(l)?.comparisonCoverage, key.slice('askComparisonCoverage.'.length));
  return undefined;
}

describe('Claude L R6 — vendored delivery is L’s, byte for byte', () => {
  const sums = new Map(
    readFileSync(join(PV, 'SHA256SUMS.txt'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/))
      .map(([sha, file]) => [file, sha] as const),
  );
  const vendored = readdirSync(PV).filter((f) => f !== 'SHA256SUMS.txt');

  it('every vendored file is listed in L’s SHA256SUMS and matches it', () => {
    expect(vendored.sort()).toEqual(
      [...Object.values(L_FILE), 'ASK-ADDITIVE-KEYS-FILLED.json', 'QUALIFICATION-STATUS-R6.json'].sort(),
    );
    for (const file of vendored) {
      const sha = createHash('sha256').update(readFileSync(join(PV, file))).digest('hex');
      expect([file, sha]).toEqual([file, sums.get(file)]);
    }
  });

  it('the per-locale files and the manifest carry the same 50 keys and values', () => {
    expect(manifest.keys).toHaveLength(50);
    for (const l of NEW) {
      const strings = delivery(l);
      expect(Object.keys(strings).sort()).toEqual(manifest.keys.map((r) => r.key).sort());
      for (const row of manifest.keys) expect(strings[row.key]).toBe(row[L_COLUMN[l]]);
    }
  });
});

describe('Claude L R6 — integrated exactly once, through the governed resolver', () => {
  it.each(NEW)('%s: all 50 of L’s values reach the reader unchanged', (l) => {
    const strings = delivery(l);
    for (const [key, value] of Object.entries(strings)) expect([key, integrated(l, key)]).toEqual([key, value]);
  });

  it('the 7 reused keys are aliases of the source shell key, not overlay copies', () => {
    const reused = manifest.keys.filter((r) => r.provenance === 'REUSED_VERBATIM_FROM_527');
    expect(
      Object.fromEntries(reused.map((r) => [r.key.slice('dict.'.length), r.source_key])),
    ).toEqual(ASK_DICTIONARY_CANONICAL_ALIASES);
    for (const l of NEW)
      for (const r of reused) {
        expect(at(askShellAdditive(l)?.dict, r.key.slice('dict.'.length))).toBeUndefined();
        expect(integrated(l, r.key)).toBe(at(askShellStrings(l), r.source_key as string));
      }
  });

  it.each(NEW)('%s: the overlay holds nothing L did not deliver (43 authored keys)', (l) => {
    const authored = manifest.keys.filter((r) => r.provenance === 'AUTHORED_R6').map((r) => r.key);
    const additive = askShellAdditive(l);
    const held = [
      ...leafPaths(additive?.dict).map((p) => `dict.${p}`),
      ...leafPaths(additive?.comparisonCoverage).map((p) => `askComparisonCoverage.${p}`),
    ];
    expect(held.sort()).toEqual(authored.sort());
  });

  it('L’s English is still today’s English for every dictionary key (else it goes back to L)', () => {
    for (const row of manifest.keys.filter((r) => r.key.startsWith('dict.')))
      expect([row.key, at(getDictionary('en'), row.key.slice('dict.'.length))]).toEqual([row.key, row.en]);
  });

  it('QUALIFIED_UNCHANGED for the additive keys is exactly “L’s value equals L’s English”', () => {
    for (const l of NEW) {
      const derived = manifest.keys.filter((r) => r[L_COLUMN[l]] === r.en && r.provenance === 'AUTHORED_R6');
      expect([l, derived.map((r) => r.key).sort()]).toEqual([
        l,
        [...(ASK_SHELL_ADDITIVE_QUALIFIED_UNCHANGED[l as DisplayLocale] ?? [])].sort(),
      ]);
    }
  });

  it('the comparison templates render L’s sentence with interpolation intact', () => {
    const member = {
      iso3: 'KEN',
      countryName: 'Kenya',
      finalQualifyingEvidenceCount: 3,
      finalLiveEvidenceCount: 2,
      finalRetainedEvidenceCount: 1,
      retrievalState: 'LIVE',
      providerFailureKinds: ['timeout'],
      localSourceProvenance: 'NOT_ESTABLISHED',
    } as unknown as Parameters<typeof askComparisonCoverageLines>[0][number];
    for (const l of NEW) {
      const [line] = askComparisonCoverageLines([member], l);
      const copy = askShellAdditive(l)?.comparisonCoverage;
      expect(line).not.toMatch(/\{(count|live|retained|name|evidence|notes)\}/);
      expect(line).toContain(copy?.timedOut.trim() ?? '∅');
      expect(line).toContain(copy?.localityNotEstablished.trim() ?? '∅');
    }
  });
});

describe('no second runtime source', () => {
  const SRC = join(__dirname, '..', '..', '..');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return files(path);
      return /\.(ts|tsx)$/.test(name) && !/\.spec\.tsx?$/.test(name) ? [path] : [];
    });

  it('the separate L R6 runtime table is gone', () => {
    expect(existsSync(join(__dirname, 'askDictionaryAdditionsL.ts'))).toBe(false);
  });

  /* Imports only: the overlay headers CITE the provenance path in comments, which is the point. */
  const RUNTIME_READ =
    /(?:from\s+|import\(\s*|require\(\s*)['"][^'"]*(?:provenance\/claude-l-r6|askDictionaryAdditionsL|R6-RENDERED-50)/;

  it('no runtime module imports the L delivery or a separate R6 table', () => {
    const offenders = files(SRC)
      .filter((f) => RUNTIME_READ.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).replace(/\\/g, '/'));
    expect(offenders).toEqual([]);
  });
});
