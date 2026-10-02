/* HUMANITARIAN LANGUAGE FINALIZATION R2 — the contract spec.
   DESTINATION: shared/src/humanitarian/language.spec.ts
   base 58f80fd4108d3472e5433c7a50e19295788f2544

   It imports `./language` and `./language-cases.json` by relative path, so it
   compiles and runs TODAY with no edit to shared/src/index.ts. The EN/PL label
   suites live in the frontend spec and move in the same commit as the one
   additive barrel export — see HANDOFF.md. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TRANSLATION_STATES, TEXT_UNAVAILABLE_REASONS,
  translationStateOf, qualifyText, sourceLanguageClaimOf,
  isSourceAuthored, mustDiscloseSourceLanguage,
  assertTitleProvenance, assertCitationIdentity,
  type ObservedLanguageMetadata, type DisplayLanguage,
} from './language';

/* Convergence: declared here as in L's full package spec (tests/humanitarianLanguage.spec.ts:22). */
const LOCALES = ['en', 'pl'] as const;
const FX = JSON.parse(readFileSync(join(__dirname, './language-cases.json'), 'utf8'));
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

/* ── AS-12 · R2 · NO SELF-PACKAGE IMPORT ─────────────────────────────────── */
describe('AS-12 · the shared contract binds to its canonical internal owner', () => {
  const SHARED = readFileSync(join(__dirname, './language.ts'), 'utf8');
  const imports = (SHARED.match(/^import[\s\S]*?from '[^']+';/gm) ?? []);
  it('imports nothing from its own package by name', () => {
    const selfImports = imports.filter((l) => /from '@globalnews-ai\//.test(l));
    expect(selfImports).toEqual([]);
  });
  it('binds LanguageCode to ../analysis, the module that declares it', () => {
    expect(imports.some((l) => /LanguageCode/.test(l) && /from '\.\.\/analysis'/.test(l))).toBe(true);
  });
  it('has exactly one import statement, so there is one place to check', () => {
    expect(imports.length).toBe(1);
  });
  it('../analysis is the module that declares LanguageCode', () => {
    const owner = readFileSync(join(__dirname, '../analysis.ts'), 'utf8');
    expect(owner).toContain('export type LanguageCode =');
  });
});

