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

describe('CTO finishing order — UNASSESSED reads "Not assessed", distinct from "Not verified"', () => {
  it('English is cause-neutral "Not assessed"; Polish (authored) "Nieocenione"', () => {
    expect(askShellStrings('en').askR2Strings.verification.states.UNASSESSED).toBe('Not assessed');
    expect(askShellStrings('pl').askR2Strings.verification.states.UNASSESSED).toBe('Nieocenione');
  });

  it.each(['fr', 'de', 'es', 'pt', 'ar'] as const)(
    '%s: HELD — reuses its own Claude-L-qualified "Not verified" wording, never English, never machine copy',
    (locale) => {
      const s = askShellStrings(locale).askR2Strings.verification.states;
      expect(s.UNASSESSED).toBe(s.NOT_VERIFIED);
      expect(s.UNASSESSED).not.toBe('Not assessed');
    },
  );

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
      /* the semantic distinction is carried where the wording is authored */
      if (locale === 'en' || locale === 'pl') {
        expect(label).not.toBe(s.verification.states.NOT_VERIFIED);
      }
    },
  );
});
