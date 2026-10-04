import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { completeLocalesOf, leafEntries, namespace, namespaceIds } from './catalogueCoverage';
import { DICTIONARY_DECLARED_KEY_STATES, looksLikeIdentifier } from '@/lib/i18n/declaredKeyStates';
import { QUALIFIED_DICTIONARY_OVERLAYS } from '@/lib/i18n/qualifiedDictionaryOverlays';
import { FALLBACK_NOTICE } from '@/lib/i18n/fallbackNotice';
import { en } from '@/lib/i18n/dictionaries/en';
import { ar, de, es, fr, pt } from '@/lib/i18n/recovered/recoveredCatalogue';
import { renderableLocalesOf, surfaceIds } from '@/lib/i18n/surfaceLocale';

/**
 * T2 · EXHAUSTIVE KEY COVERAGE.
 *
 * For every catalogue namespace and every non-English display locale, the MEASURED gap set must
 * EQUAL the gap set declared in the translation work manifest
 * (docs/convergence/stage2/t2/translation-manifest.json) — equality, not containment. So:
 *
 *   - a NEW English key that is not present in all seven locales and not declared
 *     QUALIFIED_UNCHANGED / NOT_TRANSLATED_BY_DESIGN fails here until the manifest is regenerated
 *     (`node scripts/i18n/t2-reconcile-catalogues.cjs`), which puts it on Claude L's work list;
 *   - a key that L qualifies (it disappears from the measured gaps) also fails until the manifest
 *     is regenerated, so the manifest can never overstate the work either.
 */
const ROOT = join(__dirname, '..', '..', '..', '..');
const manifest = JSON.parse(
  readFileSync(join(ROOT, 'docs', 'convergence', 'stage2', 't2', 'translation-manifest.json'), 'utf8'),
) as {
  locales: DisplayLocale[];
  namespaces: Record<string, { keys: Record<string, { locales: Partial<Record<DisplayLocale, string>> }> }>;
  surfaces: Record<string, Record<DisplayLocale, unknown>>;
};
const LOCALES: DisplayLocale[] = ['pl', 'fr', 'de', 'es', 'pt', 'ar'];

function declaredGaps(id: string, locale: DisplayLocale): string[] {
  const keys = manifest.namespaces[id]?.keys ?? {};
  return Object.entries(keys)
    .filter(([, entry]) => entry.locales[locale] !== undefined)
    .map(([key]) => key)
    .sort();
}

describe('T2 · measured gaps EQUAL the declared translation manifest (namespace × locale)', () => {
  for (const id of namespaceIds()) {
    it.each(LOCALES)(`${id} × %s`, (locale) => {
      const measured = [...namespace(id).gaps(locale)].sort();
      expect(measured).toEqual(declaredGaps(id, locale));
    });
  }

  it('the manifest names no namespace the registry does not measure', () => {
    const known = new Set(namespaceIds());
    for (const id of Object.keys(manifest.namespaces)) expect([id, known.has(id)]).toEqual([id, true]);
  });

  it('the manifest surface table is the current effective-locale result', () => {
    for (const surface of surfaceIds()) {
      const renderable = renderableLocalesOf(surface);
      for (const locale of ['en', ...LOCALES] as DisplayLocale[]) {
        const state = manifest.surfaces[surface]?.[locale];
        expect([surface, locale, state === 'FULL']).toEqual([surface, locale, renderable.includes(locale)]);
      }
    }
  });
});

describe('T2 · completeness facts that must not regress', () => {
  it('English and Polish main dictionaries are complete in every dictionary namespace', () => {
    for (const id of namespaceIds().filter((n) => n.startsWith('dict:'))) {
      expect([id, completeLocalesOf(id).includes('pl')]).toEqual([id, true]);
    }
  });

  it("H's Ask shell is complete in all seven (consumed from askShellCoverage, not re-measured)", () => {
    expect(completeLocalesOf('askShell')).toEqual(['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar']);
    expect(completeLocalesOf('askSeven')).toEqual(['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar']);
  });

  it('the main dictionary has no qualified FR/DE/ES/PT/AR overlay yet — T2 translates nothing', () => {
    expect(Object.keys(QUALIFIED_DICTIONARY_OVERLAYS)).toEqual([]);
    const overlays = readFileSync(join(__dirname, '..', '..', 'lib', 'i18n', 'qualifiedDictionaryOverlays.ts'), 'utf8');
    expect(overlays).not.toMatch(/from ['"].*recovered/);
    const coverage = readFileSync(join(__dirname, 'catalogueCoverage.ts'), 'utf8');
    expect(coverage).not.toMatch(/from ['"].*recovered/);
  });
});

describe('T2 · declared key states are identifiers, never prose', () => {
  const english = leafEntries(en);
  it.each(Object.entries(DICTIONARY_DECLARED_KEY_STATES))('%s (%s)', (key) => {
    const value = english.get(key);
    expect(typeof value).toBe('string');
    expect([key, looksLikeIdentifier(value as string)]).toEqual([key, true]);
  });

  it('every QUALIFIED_UNCHANGED key is also unchanged in all five recovered L catalogues', () => {
    const recovered = [fr, de, es, pt, ar].map((tree) => leafEntries(tree));
    for (const [key, state] of Object.entries(DICTIONARY_DECLARED_KEY_STATES)) {
      if (state !== 'QUALIFIED_UNCHANGED') continue;
      for (const own of recovered) expect([key, own.get(key)]).toEqual([key, english.get(key)]);
    }
  });
});

describe('T2 · the declared-fallback notice', () => {
  it('fr/de/es/pt/ar are verbatim the localisation lane’s languageFallback strings', () => {
    const recovered = { fr, de, es, pt, ar } as unknown as Record<string, { languageFallback: { chromeNotice: string; chromeNoticeShort: string } }>;
    for (const locale of ['fr', 'de', 'es', 'pt', 'ar'] as const) {
      expect(FALLBACK_NOTICE[locale].notice).toBe(recovered[locale].languageFallback.chromeNotice);
      expect(FALLBACK_NOTICE[locale].short).toBe(recovered[locale].languageFallback.chromeNoticeShort);
    }
  });

  it('the notice exists in all seven (the fallback is always declarable)', () => {
    expect(completeLocalesOf('fallbackNotice')).toEqual(['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar']);
  });
});

describe('T2 · reconciliation output', () => {
  it.each(['fr', 'de', 'es', 'pt', 'ar'])('%s: nothing kept for runtime, stale keys dropped, candidates unqualified', (locale) => {
    const reconciled = JSON.parse(
      readFileSync(join(ROOT, 'docs', 'convergence', 'stage2', 't2', 'reconciled', `${locale}.json`), 'utf8'),
    ) as { keptForRuntime: object; droppedStale: string[]; candidates: Record<string, { status: string }> };
    expect(reconciled.keptForRuntime).toEqual({});
    const english = leafEntries(en);
    for (const key of reconciled.droppedStale) expect(english.has(key)).toBe(false);
    for (const [key, candidate] of Object.entries(reconciled.candidates)) {
      expect(english.has(key)).toBe(true);
      expect(candidate.status).toBe('PROVENANCE_UNKNOWN');
    }
  });
});
