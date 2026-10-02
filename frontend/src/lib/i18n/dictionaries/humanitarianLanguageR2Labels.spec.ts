/* HUMANITARIAN LANGUAGE FINALIZATION R2 · the EN/PL LABEL suites (AS-8, AS-11, AS-13, AS-14),
   moved here by Claude Code convergence from L's package spec (handoff item 8.4).
   Original header follows.

   HUMANITARIAN LANGUAGE FINALIZATION R2 · the language spec.
   base 58f80fd4108d3472e5433c7a50e19295788f2544
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
/* Convergence (CTO language-authority ruling): the canonical pair is humanitarianEn/Pl; the claim
   classes are H's shared list. */
import { HUMANITARIAN_CLAIM_CLASSES } from '@globalnews-ai/shared';
import { humanitarianEn as humanitarianLanguageEn, type HumanitarianLanguageStrings } from './humanitarianEn';
import { humanitarianPl as humanitarianLanguagePl } from './humanitarianPl';

const DICTS: Record<'en' | 'pl', HumanitarianLanguageStrings> = { en: humanitarianLanguageEn, pl: humanitarianLanguagePl };
const LOCALES = ['en', 'pl'] as const;
const FX = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'shared', 'src', 'humanitarian', 'language-cases.json'), 'utf8'));

function flat(o: unknown, path = '', out: Record<string, string> = {}): Record<string, string> {
  if (typeof o === 'string') { out[path] = o; return out; }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) flat(v, path ? `${path}.${k}` : k, out);
  return out;
}
const EN = flat(humanitarianLanguageEn), PL = flat(humanitarianLanguagePl);
const observedOf = (c: any): ObservedLanguageMetadata => ({
  declared: c.observed.declared,
  designatedOriginal: c.observed.designatedOriginal,
  sourceSuppliedTranslations: c.observed.sourceSuppliedTranslations,
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
    expect(humanitarianLanguagePl.domainName).toBe('Pomoc humanitarna');
  });
  it('keeps every interpolation token in both languages', () => {
    for (const k of Object.keys(EN)) {
      const toks = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
      expect(toks(PL[k])).toEqual(toks(EN[k]));
    }
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


/* ── AS-13 · R2 · ALL SIX SURFACES COVERED IN EN AND PL ──────────────────── */
describe('AS-13 · six-surface EN/PL coverage', () => {
  const SURFACES = ['humanitarianPage', 'home', 'map', 'myIntelligence', 'admin', 'askDisclosure'] as const;
  it('every surface group exists in both languages', () => {
    for (const loc of LOCALES) for (const s of SURFACES) {
      expect(typeof DICTS[loc][s]).toBe('object');
    }
  });
  it('every surface group has the same keys in both languages, and none is empty', () => {
    for (const s of SURFACES) {
      const en = Object.keys(DICTS.en[s]).sort();
      const pl = Object.keys(DICTS.pl[s]).sort();
      expect(pl).toEqual(en);
      for (const loc of LOCALES) for (const k of en) {
        expect(((DICTS[loc][s] as Record<string, string>)[k] ?? '').length > 0).toBe(true);
      }
    }
  });
  it('labels all five claim classes in both languages', () => {
    for (const loc of LOCALES) for (const c of HUMANITARIAN_CLAIM_CLASSES) {
      expect(DICTS[loc].claimClass[c].length > 0).toBe(true);
    }
  });
});


/* ── AS-14 · R2 · ABSENCE NEVER READS AS REASSURANCE ─────────────────────── */
describe('AS-14 · NOT_ASSESSED never becomes "nothing happened"', () => {
  it('the detail sentence denies it outright, in both languages', () => {
    expect(humanitarianLanguageEn.humanitarianPage.notAssessedDetail).toContain('not a statement that nothing happened');
    expect(humanitarianLanguagePl.humanitarianPage.notAssessedDetail).toContain('nie znaczy, że nic się nie stało');
  });
  it('"not assessed" and "not known" are different strings in both languages', () => {
    for (const loc of LOCALES) {
      expect(DICTS[loc].humanitarianPage.notAssessed !== DICTS[loc].claimClass.UNKNOWN).toBe(true);
    }
  });
  it('FACT is not labelled as a bare truth claim in Polish', () => {
    expect(humanitarianLanguagePl.claimClass.FACT).toBe('Zarejestrowane');
  });
  it('no surface string reassures, in either language', () => {
    const calming = /\b(no cause for concern|situation is under control|nothing to worry|all clear|bez powodu do obaw|sytuacja pod kontrol|nic się nie dzieje)\b/i;
    const hits = [...Object.entries(EN), ...Object.entries(PL)].filter(([, v]) => calming.test(v)).map(([k]) => k);
    expect(hits).toEqual([]);
  });
  it('POSITIVE CONTROL — that pattern does catch a reassurance', () => {
    expect(/\b(all clear|bez powodu do obaw)\b/i.test('All clear in the region.')).toBe(true);
    expect(/\b(all clear|bez powodu do obaw)\b/i.test('Bez powodu do obaw.')).toBe(true);
  });
  it('the map never lets a hazard outline stand for affected people', () => {
    expect(humanitarianLanguageEn.map.hazardNotImpact).toContain('not the people affected');
    expect(humanitarianLanguagePl.map.hazardNotImpact).toContain('nie osoby dotknięte');
  });
});


/* ── CONVERGENCE · one semantic label, one EN owner and one PL owner ─────── */
describe('canonical Humanitarian dictionary pair (CTO language-authority ruling)', () => {
  const dir = __dirname;
  it('the redundant R2 pair is retired', () => {
    for (const f of ['humanitarianLanguageEn.ts', 'humanitarianLanguagePl.ts']) {
      expect(require('node:fs').existsSync(join(dir, f))).toBe(false);
    }
  });
  it('R1 citation and R2 askDisclosure are ONE group (askDisclosure), never two', () => {
    for (const loc of LOCALES) {
      expect(Object.keys(DICTS[loc])).not.toContain('citation');
      expect(Object.keys(DICTS[loc].askDisclosure).sort()).toEqual([
        'answerLanguageDiffers', 'answerUsesTranslatedReporting', 'publishedByLabel',
        'someSourcesWithheldForLanguage', 'sourceLanguageLabel', 'titleShownAsPublished',
      ]);
    }
  });
  it('readers never get a source-topology label; Admin owns source health', () => {
    for (const loc of LOCALES) {
      expect(Object.keys(DICTS[loc].humanitarianPage)).not.toContain('sourceUnavailable');
      expect(DICTS[loc].admin.sourceUnavailable.trim().length).toBeGreaterThan(0);
    }
  });
  it('claim-class labels cover exactly H\'s shared taxonomy', () => {
    for (const loc of LOCALES) {
      expect(Object.keys(DICTS[loc].claimClass).sort()).toEqual([...HUMANITARIAN_CLAIM_CLASSES].sort());
    }
  });
  it('R1 vocabulary labels (Main) survive the merge', () => {
    for (const loc of LOCALES) expect(Object.keys(DICTS[loc].vocabulary).length).toBe(6);
  });
});
