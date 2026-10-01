/* HUMANITARIAN LANGUAGE QUALIFICATION R1 · the language spec.
   Jest idiom, so it can sit beside the other *Localization.spec.ts files.
   Executed here by `measurements/run-spec.mts`, which supplies describe/it/expect
   and nothing else — the delivered file and the executed file are the same file. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TRANSLATION_STATES, TEXT_UNAVAILABLE_REASONS,
  translationStateOf, qualifyText, sourceLanguageClaimOf,
  isSourceAuthored, mustDiscloseSourceLanguage,
  assertTitleProvenance, assertCitationIdentity,
  type ObservedLanguageMetadata, type TranslationState, type DisplayLanguage,
} from '@globalnews-ai/shared';
import { humanitarianEn, type HumanitarianLanguageStrings } from './humanitarianEn';
import { humanitarianPl } from './humanitarianPl';

/* Integration (Claude Code): the shared contract and its fixtures live in shared/src/humanitarian. */
const SHARED_HUMANITARIAN = join(__dirname, '..', '..', '..', '..', '..', 'shared', 'src', 'humanitarian');

const DICTS: Record<'en' | 'pl', HumanitarianLanguageStrings> = { en: humanitarianEn, pl: humanitarianPl };
const LOCALES = ['en', 'pl'] as const;
const FX = JSON.parse(readFileSync(join(SHARED_HUMANITARIAN, '__fixtures__', 'humanitarian-language-cases.json'), 'utf8'));

function flat(o: unknown, path = '', out: Record<string, string> = {}): Record<string, string> {
  if (typeof o === 'string') { out[path] = o; return out; }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) flat(v, path ? `${path}.${k}` : k, out);
  return out;
}
const EN = flat(humanitarianEn), PL = flat(humanitarianPl);
const observedOf = (c: any): ObservedLanguageMetadata => ({
  declared: c.observed.declared,
  designatedOriginal: c.observed.designatedOriginal,
  sourceSuppliedTranslations: c.observed.sourceSuppliedTranslations,
});

/* ───────────────── AS-1 · the mandated cases, recomputed ─────────────────── */
describe('AS-1 · the seven mandated cases (and their controls) hold when recomputed', () => {
  for (const c of FX.cases) {
    it(`${c.id} — ${c.mandated}`, () => {
      const observed = observedOf(c);
      const state = translationStateOf({
        observed, displayLanguage: c.displayLanguage as DisplayLanguage,
        platformTranslationPresent: c.platformTranslationPresent,
      });
      expect(state).toBe(c.expect.translationState);

      const text = qualifyText({
        observed, displayLanguage: c.displayLanguage as DisplayLanguage,
        platformTranslationPresent: c.platformTranslationPresent,
        sourceTextPresent: c.sourceTextPresent,
      });
      expect(text.kind).toBe(c.expect.text);
      if (c.expect.textReason) expect((text as any).reason).toBe(c.expect.textReason);

      expect(sourceLanguageClaimOf(observed).kind).toBe(c.expect.claim);
    });
  }
  it('every case states why', () => {
    for (const c of FX.cases) expect(c.why.length > 25).toBe(true);
  });
});

/* ───────────────── AS-2 · UNKNOWN outranks everything ───────────────────── */
describe('AS-2 · with no declared language, no translation claim is sayable', () => {
  it('UNKNOWN wins over a present platform translation', () => {
    for (const platform of [true, false]) for (const loc of LOCALES) {
      expect(translationStateOf({
        observed: { declared: [], sourceSuppliedTranslations: [] },
        displayLanguage: loc, platformTranslationPresent: platform,
      })).toBe('UNKNOWN');
    }
  });
  it('UNKNOWN wins over a claimed source translation', () => {
    expect(translationStateOf({
      observed: { declared: [], sourceSuppliedTranslations: ['pl'] },
      displayLanguage: 'pl', platformTranslationPresent: false,
    })).toBe('UNKNOWN');
  });
  it('and the text is withheld rather than shown', () => {
    const t = qualifyText({
      observed: { declared: [], sourceSuppliedTranslations: [] },
      displayLanguage: 'pl', platformTranslationPresent: true, sourceTextPresent: true,
    });
    expect(t.kind).toBe('UNAVAILABLE');
    expect((t as any).reason).toBe('SOURCE_LANGUAGE_NOT_OBSERVED');
  });
});

/* ── AS-3 · SOURCE_TRANSLATION only from source metadata ─────────────────── */
describe('AS-3 · "translated by the source" is never inferred', () => {
  const fr: ObservedLanguageMetadata = { declared: ['fr'], designatedOriginal: 'fr', sourceSuppliedTranslations: ['pl'] };
  it('fires when the source supplied THIS language', () => {
    expect(translationStateOf({ observed: fr, displayLanguage: 'pl', platformTranslationPresent: false })).toBe('SOURCE_TRANSLATION');
  });
  it('OUTRANKS a platform translation of the same record', () => {
    expect(translationStateOf({ observed: fr, displayLanguage: 'pl', platformTranslationPresent: true })).toBe('SOURCE_TRANSLATION');
  });
  it('NEGATIVE CONTROL — does not fire for a language the source translated into some OTHER tongue', () => {
    const other: ObservedLanguageMetadata = { declared: ['fr'], designatedOriginal: 'fr', sourceSuppliedTranslations: ['en'] };
    expect(translationStateOf({ observed: other, displayLanguage: 'pl', platformTranslationPresent: true })).toBe('PLATFORM_TRANSLATED');
    expect(translationStateOf({ observed: other, displayLanguage: 'pl', platformTranslationPresent: false })).toBe('UNTRANSLATED');
  });
  it('only ORIGINAL and SOURCE_TRANSLATION are source-authored', () => {
    const authored = TRANSLATION_STATES.filter(isSourceAuthored);
    expect([...authored]).toEqual(['ORIGINAL', 'SOURCE_TRANSLATION']);
  });
});

/* ── AS-4 · a multilingual record is not resolved by convenience ─────────── */
describe('AS-4 · multilingual records', () => {
  it('several declared and none designated is AMBIGUOUS, even when the display language is among them', () => {
    const o: ObservedLanguageMetadata = { declared: ['en', 'fr', 'ar'], sourceSuppliedTranslations: [] };
    expect(sourceLanguageClaimOf(o).kind).toBe('MULTIPLE_UNDESIGNATED');
    const t = qualifyText({ observed: o, displayLanguage: 'en', platformTranslationPresent: false, sourceTextPresent: true });
    expect(t.kind).toBe('UNAVAILABLE');
    expect((t as any).reason).toBe('SOURCE_LANGUAGE_AMBIGUOUS');
  });
  it('a designated original resolves it, and keeps the others visible', () => {
    const o: ObservedLanguageMetadata = { declared: ['fr', 'en'], designatedOriginal: 'fr', sourceSuppliedTranslations: ['en'] };
    const claim = sourceLanguageClaimOf(o);
    expect(claim.kind).toBe('DESIGNATED');
    expect((claim as any).language).toBe('fr');
    expect([...(claim as any).alsoDeclared]).toEqual(['en']);
  });
  it('a single declared language that is NOT the display language is not an original', () => {
    expect(translationStateOf({
      observed: { declared: ['en'], sourceSuppliedTranslations: [] },
      displayLanguage: 'pl', platformTranslationPresent: false,
    })).toBe('UNTRANSLATED');
  });
});

/* ── AS-5 · a source tag outside LanguageCode survives verbatim ──────────── */
describe('AS-5 · source tags are not coerced into the product\'s language list', () => {
  it('carries an unrecognised tag without changing it', () => {
    for (const tag of ['prs', 'es-419', 'ha', 'ckb']) {
      const o: ObservedLanguageMetadata = { declared: [tag], sourceSuppliedTranslations: [] };
      const claim = sourceLanguageClaimOf(o);
      expect(claim.kind).toBe('SINGLE');
      expect((claim as any).language).toBe(tag);
      expect(translationStateOf({ observed: o, displayLanguage: 'en', platformTranslationPresent: false })).toBe('UNTRANSLATED');
    }
  });
});

/* ── AS-6 · the citation keeps the source's identity ─────────────────────── */
describe('AS-6 · a Polish answer never implies a Polish source', () => {
  const t7 = FX.cases.find((c: any) => c.id === 'T7');
  it('discloses the source language when it differs from the answer language', () => {
    expect(mustDiscloseSourceLanguage(t7.citation)).toBe(true);
  });
  it('discloses it when the source language was not observed — silence would read as agreement', () => {
    expect(mustDiscloseSourceLanguage({ ...t7.citation, sourceLanguage: undefined })).toBe(true);
  });
  it('does NOT demand disclosure when they agree — so the rule is not vacuous', () => {
    expect(mustDiscloseSourceLanguage({ ...t7.citation, sourceLanguage: 'pl' })).toBe(false);
  });
  it('refuses a citation with no original title or no publisher', () => {
    let threw = 0;
    for (const bad of [{ ...t7.citation, originalTitle: '  ' }, { ...t7.citation, publisherName: '' }]) {
      try { assertCitationIdentity(bad as any); } catch { threw++; }
    }
    expect(threw).toBe(2);
  });
  it('POSITIVE CONTROL — a complete citation is accepted', () => {
    let ok = true;
    try { assertCitationIdentity(t7.citation); } catch { ok = false; }
    expect(ok).toBe(true);
  });
});

/* ── AS-7 · a translated title can never stand alone ────────────────────── */
describe('AS-7 · title provenance is structural', () => {
  it('accepts a title that carries its original', () => {
    let ok = true;
    try {
      assertTitleProvenance({
        original: 'Flash Update No. 3: Floods in Eastern Province',
        originalLanguage: 'en',
        display: { text: 'Pilna aktualizacja nr 3: powodzie w Prowincji Wschodniej', language: 'pl', state: 'PLATFORM_TRANSLATED' },
      });
    } catch { ok = false; }
    expect(ok).toBe(true);
  });
  it('refuses a display-only title', () => {
    let threw = false;
    try { assertTitleProvenance({ original: '   ', display: { text: 'x', language: 'pl', state: 'PLATFORM_TRANSLATED' } }); }
    catch { threw = true; }
    expect(threw).toBe(true);
  });
  it('the display state can only be one the source or the platform supplied', () => {
    const allowed = ['SOURCE_TRANSLATION', 'PLATFORM_TRANSLATED'];
    for (const s of TRANSLATION_STATES) {
      const assignable = allowed.includes(s);
      expect(assignable).toBe(s === 'SOURCE_TRANSLATION' || s === 'PLATFORM_TRANSLATED');
    }
  });
});

/* ── AS-8 · EN/PL label completeness ────────────────────────────────────── */
describe('AS-8 · the EN/PL label set is complete', () => {
  it('has no key present in one language only', () => {
    expect(Object.keys(EN).filter((k) => !(k in PL))).toEqual([]);
    expect(Object.keys(PL).filter((k) => !(k in EN))).toEqual([]);
  });
  it('labels all five translation states, short and long, in both languages', () => {
    for (const loc of LOCALES) for (const s of TRANSLATION_STATES) {
      expect(DICTS[loc].translationState[s].length > 0).toBe(true);
      expect(DICTS[loc].translationStateDetail[s].length > 0).toBe(true);
    }
  });
  it('labels all four text-unavailable reasons in both languages', () => {
    for (const loc of LOCALES) for (const r of TEXT_UNAVAILABLE_REASONS) {
      expect(DICTS[loc].textUnavailable[r].length > 0).toBe(true);
    }
  });
  it('labels all four source-language claim kinds in both languages', () => {
    for (const loc of LOCALES) for (const k of ['SINGLE', 'DESIGNATED', 'MULTIPLE_UNDESIGNATED', 'NOT_OBSERVED'] as const) {
      expect(DICTS[loc].sourceLanguageClaim[k].length > 0).toBe(true);
    }
  });
  it('no reader-facing string is English left in place', () => {
    const identical = Object.keys(EN).filter((k) => EN[k] === PL[k] && EN[k].length > 3);
    expect(identical).toEqual([]);
  });
  it('reuses the shipped Polish domain name rather than minting a second one', () => {
    expect(humanitarianPl.domainName).toBe('Pomoc humanitarna');
  });
  it('keeps every interpolation token in both languages', () => {
    for (const k of Object.keys(EN)) {
      const toks = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
      expect(toks(PL[k])).toEqual(toks(EN[k]));
    }
  });
});

/* ── AS-9 · nothing can infer a language from a country ─────────────────── */
describe('AS-9 · language is never inferred', () => {
  it('no contract function accepts a country, region or publisher nationality', () => {
    const src = readFileSync(join(SHARED_HUMANITARIAN, 'language.ts'), 'utf8');
    const signatures = src.match(/export function [\s\S]*?\{/g) ?? [];
    const offenders = signatures.filter((s) => /countr|iso3|iso2|region|nationalit/i.test(s));
    expect(offenders).toEqual([]);
  });
  it('and no label tells a reader a language was detected', () => {
    const bad = [...Object.entries(EN), ...Object.entries(PL)]
      .filter(([, v]) => /\b(detected|detect|rozpozna\w*|wykry\w*)\b/i.test(v)).map(([k]) => k);
    expect(bad).toEqual([]);
  });
  it('POSITIVE CONTROL — that pattern does catch a sentence it should', () => {
    expect(/\b(detected|rozpozna\w*)\b/i.test('Language detected automatically.')).toBe(true);
    expect(/\b(detected|rozpozna\w*)\b/i.test('Język rozpoznany automatycznie.')).toBe(true);
  });
});

/* ── AS-10 · no provider, no "official translation" ─────────────────────── */
describe('AS-10 · scope discipline', () => {
  it('names no translation provider, model or vendor anywhere', () => {
    const src = readFileSync(join(SHARED_HUMANITARIAN, 'language.ts'), 'utf8');
    const all = [src, ...Object.values(EN), ...Object.values(PL)].join('\n');
    const offenders = (all.match(/\b(deepl|google translate|azure translator|aws translate|openai|gpt-|claude-|libretranslate|opus-mt)\b/gi) ?? []);
    expect(offenders).toEqual([]);
  });
  it('never claims an official translation', () => {
    const bad = [...Object.entries(EN), ...Object.entries(PL)]
      .filter(([, v]) => /\b(official translation|t[łl]umaczenie oficjalne|oficjalne t[łl]umaczenie)\b/i.test(v)).map(([k]) => k);
    expect(bad).toEqual([]);
  });
  it('proposes no fetch, client or adapter for any source', () => {
    const src = readFileSync(join(SHARED_HUMANITARIAN, 'language.ts'), 'utf8');
    expect(/\bfetch\(|axios|httpClient|new URL\(['"]https/.test(src)).toBe(false);
  });
  it('keeps the translation-is-not-evidence sentence in both languages', () => {
    for (const loc of LOCALES) expect(DICTS[loc].translationIsNotEvidence.length > 20).toBe(true);
  });
});

/* ── AS-11 · withholding text retains the metadata ──────────────────────── */
describe('AS-11 · a withheld body is not a withheld record', () => {
  it('both languages say the rest of the record is unchanged', () => {
    for (const loc of LOCALES) expect(DICTS[loc].metadataRetainedNote.length > 30).toBe(true);
  });
  it('"not published by the source" and "we are not showing it" are different strings', () => {
    for (const loc of LOCALES) {
      expect(DICTS[loc].textUnavailable.NOT_PUBLISHED_BY_SOURCE !== DICTS[loc].textUnavailableHeading).toBe(true);
      const all = Object.values(DICTS[loc].textUnavailable);
      expect(new Set(all).size).toBe(all.length);
    }
  });
});
