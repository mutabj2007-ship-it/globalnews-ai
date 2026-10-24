import type { AskR2Payload } from '@/lib/api/askV2Api';
import { DISPLAY_LOCALES, type ClaimVerificationState } from '@globalnews-ai/shared';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { askR2View } from './askR2View';

/**
 * CTO R164 P-4 — UNASSESSED: reports exist, but their accessible text (title-only / body
 * unavailable) was insufficient to assess the claim. It is never a positive confirmation, so
 * every locale must carry its own label and the view must never surface the raw code.
 */

const UNASSESSED: ClaimVerificationState = 'UNASSESSED';
/* Restored (E1 ADDENDUM-14 FE-1 / Claude L): an UNASSESSED label never reads as a positive state. */
const POSITIVE = /confirm|corroborat|potwierdz|confirmé|bestätigt|confirmado|مؤكَّد|مؤيِّدة/i;

function withClaim(): AskR2Payload {
  return {
    schema: 'ask-r2-result/1',
    route: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      scopedBy: 'TYPED_GEOGRAPHY',
      refusals: [],
      disclosures: [],
      clarification: [],
      normalization: 'QUALIFIED',
      questionLanguage: 'en',
    },
    chips: { kind: 'NONE' },
    answer: { state: 'INSUFFICIENT', basis: 'x', missingRoles: [] },
    aiExecuted: true,
    modelPriorCitable: false,
    analysis: {
      analysis: null,
      articles: [],
      retrievalContext: {
        dataMode: 'live',
        providers: ['gnews'],
        claimAssessments: [
          {
            id: 'occurrence',
            type: 'OCCURRENCE',
            text: 'A ceasefire was signed',
            state: UNASSESSED,
            supportingArticleIds: [],
            independentFamilies: 0,
            officialFamily: false,
            contradictingArticleIds: [],
          },
        ],
      },
    } as never,
  };
}

describe('CTO finishing order — UNASSESSED reads "Not assessed", distinct from "Not verified"', () => {
  it('English is cause-neutral "Not assessed"; Polish (authored) "Nieocenione"', () => {
    expect(askShellStrings('en').askR2Strings.verification.states.UNASSESSED).toBe('Not assessed');
    expect(askShellStrings('pl').askR2Strings.verification.states.UNASSESSED).toBe('Nieocenione');
  });

  it.each([
    ['fr', 'Non évalué'],
    ['de', 'Nicht bewertet'],
    ['es', 'No evaluado'],
    ['pt', 'Não avaliado'],
    ['ar', 'غير مُقيَّم'],
  ] as const)('%s: carries Claude L’s approved NOT_ASSESSED label %p', (locale, approved) => {
    expect(askShellStrings(locale).askR2Strings.verification.states.UNASSESSED).toBe(approved);
  });

  it.each(DISPLAY_LOCALES.map((l) => [l]))(
    '%s has its own non-empty, non-positive UNASSESSED label, distinct from NOT_VERIFIED',
    (locale) => {
      const s = askShellStrings(locale).askR2Strings.verification.states;
      const english = askShellStrings('en').askR2Strings.verification.states.UNASSESSED;
      expect(typeof s.UNASSESSED).toBe('string');
      expect(s.UNASSESSED!.trim().length).toBeGreaterThan(0);
      expect(s.UNASSESSED).not.toMatch(POSITIVE);
      expect(s.UNASSESSED).not.toBe(s.NOT_VERIFIED);
      if (locale !== 'en') expect(s.UNASSESSED).not.toBe(english);
    },
  );

  it('the guard bites: the positive lexeme catches the old collapsed German value', () => {
    expect('Nicht bestätigt').toMatch(POSITIVE);
    expect('Non évalué').not.toMatch(POSITIVE);
  });

  it.each(DISPLAY_LOCALES.map((l) => [l]))(
    '%s: askR2View shows the UNASSESSED label — never the raw code, never a positive state',
    (locale) => {
      const s = askShellStrings(locale).askR2Strings;
      const v = askR2View(withClaim(), s, locale === 'pl' ? 'pl' : 'en');
      const label = s.verification.states.UNASSESSED!;
      expect(v.verification?.claims).toEqual([
        { text: 'A ceasefire was signed', state: 'UNASSESSED', label },
      ]);
      expect(label).not.toBe('UNASSESSED');
      expect(label).not.toBe(s.verification.states.CONFIRMED);
      expect(label).not.toBe(s.verification.states.CORROBORATED_REPORTING);
      expect(label).not.toBe(s.verification.states.REPORTED);
      expect(label).not.toBe(s.verification.states.NOT_VERIFIED);
    },
  );
});

describe('CTO R175 ruling 1 · German claim-state labels', () => {
  const de = () => askShellStrings('de').askR2Strings.verification;

  it('NOT_VERIFIED / COVERAGE_INCOMPLETE / UNASSESSED carry the ruled values', () => {
    expect(de().states.NOT_VERIFIED).toBe('Nicht verifiziert');
    expect(de().states.COVERAGE_INCOMPLETE).toBe('Nicht verifiziert — Abdeckung unvollständig');
    expect(de().states.UNASSESSED).toBe('Nicht bewertet');
  });

  it('the three non-positive states are distinct and none carries a positive lexeme', () => {
    const { NOT_VERIFIED, COVERAGE_INCOMPLETE, UNASSESSED } = de().states;
    expect(new Set([NOT_VERIFIED, COVERAGE_INCOMPLETE, UNASSESSED]).size).toBe(3);
    for (const label of [NOT_VERIFIED, COVERAGE_INCOMPLETE, UNASSESSED]) expect(label).not.toMatch(POSITIVE);
  });

  it('the attempted-check prose is preserved (its negation describes a check that ran)', () => {
    expect(de().notVerified).toBe(
      'Diese Aussage konnte aus den erfolgreich geprüften Quellen nicht bestätigt werden.',
    );
  });
});
