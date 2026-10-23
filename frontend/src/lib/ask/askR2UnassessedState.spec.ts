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

describe('R164 P-4 / CTO B-2 — UNASSESSED reads as the qualified "Not verified" label', () => {
  it('no new reader copy: no locale carries an UNASSESSED string of its own', () => {
    for (const locale of DISPLAY_LOCALES) {
      expect(askShellStrings(locale).askR2Strings.verification.states.UNASSESSED).toBeUndefined();
    }
  });

  it.each(DISPLAY_LOCALES.map((l) => [l]))(
    '%s: askR2View shows the localized NOT_VERIFIED label — never the raw code, never a positive state',
    (locale) => {
      const s = askShellStrings(locale).askR2Strings;
      const v = askR2View(withClaim(), s, locale === 'pl' ? 'pl' : 'en');
      const label = s.verification.states.NOT_VERIFIED!;
      expect(label.trim().length).toBeGreaterThan(0);
      expect(v.verification?.claims).toEqual([
        { text: 'A ceasefire was signed', state: 'UNASSESSED', label },
      ]);
      expect(label).not.toBe('UNASSESSED');
      /* never one of this locale's positive labels ("Nicht bestätigt" is a negation, so compare labels, not words) */
      expect(label).not.toBe(s.verification.states.CONFIRMED);
      expect(label).not.toBe(s.verification.states.CORROBORATED_REPORTING);
      expect(label).not.toBe(s.verification.states.REPORTED);
    },
  );

  it('Arabic (RTL) resolves to its own qualified label, not the English one', () => {
    const ar = askShellStrings('ar').askR2Strings.verification.states.NOT_VERIFIED;
    expect(ar).not.toBe(askShellStrings('en').askR2Strings.verification.states.NOT_VERIFIED);
  });
});
