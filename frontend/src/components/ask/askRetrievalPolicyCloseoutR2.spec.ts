import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalysisApiResponse, ConversationSubjectAnchor } from '@globalnews-ai/shared';
import { AskCompactResult, sourceDateLabel } from './AskCompactResult';
import { fixture } from '../analysis-frame/frameFixtures';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { AskR2Payload } from '@/lib/api/askV2Api';
import { askR2Strings } from '@/lib/ask/askR2Strings';
import { askR2View } from '@/lib/ask/askR2View';

/**
 * ASK R3 RETRIEVAL POLICY CLOSEOUT R2 — the three presentation defects observed on Alpha
 * (operation 8237863d), display only. Routing, retrieval and conversation semantics are
 * covered by the backend specs; nothing here changes what was asked or fetched.
 */

/* The continued subject as the corrected backend now emits it for 8237863d. */
const KENYA: ConversationSubjectAnchor = {
  subject: 'Kenya’s economy',
  focus: ['ordinary', 'households'],
  focusDisplay: ['ordinary households'],
  retrievalMeaning: 'Kenya’s economy ordinary households impact',
  source: 'prior-question',
  disclosures: [],
};

function r2Payload(conversationSubject?: ConversationSubjectAnchor): AskR2Payload {
  return {
    schema: 'ask-r2-result/1',
    route: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      scopedBy: 'FOLLOW_UP_RELATION',
      refusals: [],
      disclosures: [],
      clarification: [],
      normalization: 'QUALIFIED',
      questionLanguage: 'en',
    },
    chips: { kind: 'NONE' },
    answer: { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [] },
    aiExecuted: true,
    modelPriorCitable: false,
    analysis: {
      analysis: { generatedAt: '2026-09-30T17:50:40Z' },
      articles: [{}],
      retrievalContext: conversationSubject ? { conversationSubject } : {},
    } as never,
  } as AskR2Payload;
}

describe('R2 · 8237863d — an inherited scope is shown truthfully, never as "no scope applied"', () => {
  it('EN: the follow-up names the subject it continued', () => {
    const view = askR2View(r2Payload(KENYA), askR2Strings('en'), 'en');
    expect(view.chips.note).toBe('Follow-up · continues Kenya’s economy');
    expect(view.chips.note).not.toBe(askR2Strings('en').noScope);
  });

  it('PL: the same, in Polish', () => {
    const view = askR2View(r2Payload(KENYA), askR2Strings('pl'), 'pl');
    expect(view.chips.note).toBe('Pytanie uzupełniające · kontynuacja: Kenya’s economy');
  });

  it('a genuinely unscoped question still says so (unchanged)', () => {
    expect(askR2View(r2Payload(), askR2Strings('en'), 'en').chips.note).toBe(
      'General question · no scope applied',
    );
  });
});

const withContext = (over: Record<string, unknown>): AnalysisApiResponse => {
  const base = fixture({ articleCount: 2 }) as AnalysisApiResponse;
  return {
    ...base,
    retrievalContext: { ...base.retrievalContext, ...over },
  } as AnalysisApiResponse;
};

const render = (response: AnalysisApiResponse, language: 'en' | 'pl' = 'en') =>
  renderToStaticMarkup(
    createElement(
      AskCompactResult as never,
      {
        response,
        question: 'q',
        language,
        context: undefined,
      } as never,
    ),
  );

describe('R2 · 8237863d — the continuation label shows the clean subject and the reader’s own phrase', () => {
  it('"Kenya’s economy · ordinary households", never the instruction, never "ordinary and households"', () => {
    const html = render(withContext({ conversationSubject: KENYA }));
    expect(html).toContain('Continuing: Kenya’s economy · ordinary households');
    expect(html).not.toContain('ordinary and households');
    expect(html).not.toMatch(/Give the dates|cite the sources/);
  });

  it('an older payload without focusDisplay keeps the previous list wording (backward compatible)', () => {
    const legacy: ConversationSubjectAnchor = { ...KENYA, focusDisplay: undefined };
    expect(render(withContext({ conversationSubject: legacy }))).toContain(
      'Continuing: Kenya’s economy · ordinary and households',
    );
  });
});

describe('R2 — requested dates: each source’s own date, labelled by what it is', () => {
  const t = getDictionary('en').askAi;

  it('labels by basis; never an event date; nothing when there is no usable date', () => {
    expect(sourceDateLabel('2026-09-08T11:04:02Z', 'publisher', 'en', t)).toBe(
      'Published 8 Sep 2026, 11:04 UTC',
    );
    expect(sourceDateLabel('2026-09-08T11:04:02Z', 'observed', 'en', t)).toBe(
      'First seen by GlobalNewsAI 8 Sep 2026, 11:04 UTC',
    );
    expect(sourceDateLabel('2026-09-08T11:04:02Z', undefined, 'en', t)).toBe(
      'Report date 8 Sep 2026, 11:04 UTC',
    );
    expect(sourceDateLabel(undefined, 'publisher', 'en', t)).toBeNull();
    expect(sourceDateLabel('not a date', 'publisher', 'en', t)).toBeNull();
  });

  it('shown only when the reader asked for dates, with the "not when events happened" note', () => {
    const base = withContext({ datesRequested: true });
    const response = {
      ...base,
      articles: base.articles.map((a) => ({ ...a, publishedAtBasis: 'publisher' as const })),
    } as AnalysisApiResponse;
    const html = render(response);
    expect(html).toContain('data-ask="source-date"');
    expect(html).toContain('Published ');
    expect(html).toContain(t.sourceDatesNote);

    const plain = render(withContext({}));
    expect(plain).not.toContain('data-ask="source-date"');
    expect(plain).not.toContain(t.sourceDatesNote);
  });

  it('PL wording', () => {
    const pl = getDictionary('pl').askAi;
    expect(sourceDateLabel('2026-09-08T11:04:02Z', 'publisher', 'pl', pl)).toMatch(
      /^Opublikowano /,
    );
  });
});
