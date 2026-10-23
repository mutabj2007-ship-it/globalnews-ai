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

describe('R164 P-4 — UNASSESSED claim state', () => {
  const english = askShellStrings('en').askR2Strings.verification.states.UNASSESSED;

  it('English and Polish carry the exact CTO labels', () => {
    expect(english).toBe('Not assessed — report text unavailable');
    expect(askShellStrings('pl').askR2Strings.verification.states.UNASSESSED).toBe(
      'Nieocenione — brak dostępnego tekstu doniesień',
    );
  });

  it.each(DISPLAY_LOCALES.map((l) => [l]))(
    '%s has its own non-empty, non-positive UNASSESSED label',
    (locale) => {
      const label = askShellStrings(locale).askR2Strings.verification.states.UNASSESSED;
      expect(typeof label).toBe('string');
      expect(label!.trim().length).toBeGreaterThan(0);
      expect(label).not.toMatch(POSITIVE);
      if (locale !== 'en') expect(label).not.toBe(english);
    },
  );

  it.each(DISPLAY_LOCALES.map((l) => [l]))('%s: askR2View renders the label, never the raw code', (locale) => {
    const s = askShellStrings(locale).askR2Strings;
    const v = askR2View(withClaim(), s, locale === 'pl' ? 'pl' : 'en');
    expect(v.verification?.claims).toEqual([
      { text: 'A ceasefire was signed', state: 'UNASSESSED', label: s.verification.states.UNASSESSED },
    ]);
    expect(v.verification?.claims[0]?.label).not.toBe('UNASSESSED');
  });
});
