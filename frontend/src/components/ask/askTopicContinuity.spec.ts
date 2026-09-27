import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalysisApiResponse, ConversationSubjectAnchor } from '@globalnews-ai/shared';
import { AskCompactResult } from './AskCompactResult';
import { fixture } from '../analysis-frame/frameFixtures';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * ASK CONVERSATIONAL TOPIC CONTINUITY R1 — the continued subject is visible,
 * reversible, worded in the reader's language, and says so when the question
 * about GlobalNewsAI itself cannot be answered from external reporting.
 */

const withSubject = (subject?: ConversationSubjectAnchor): AnalysisApiResponse => {
  const base = fixture({}) as AnalysisApiResponse;
  return {
    ...base,
    retrievalContext: { ...base.retrievalContext, ...(subject ? { conversationSubject: subject } : {}) },
  } as AnalysisApiResponse;
};

const render = (response: AnalysisApiResponse, language: 'en' | 'pl', extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(AskCompactResult as never, { response, question: 'q', language, context: undefined, ...extra } as never),
  );

const EU: ConversationSubjectAnchor = {
  subject: 'EU AI regulation',
  focus: [],
  retrievalMeaning: 'EU AI regulation',
  source: 'prior-question',
  disclosures: ['PRODUCT_APPLICABILITY_NOT_ESTABLISHED'],
};

describe('D.1 — the current focus, shown and disclosed', () => {
  const POLAND: ConversationSubjectAnchor = {
    subject: 'inflation high Poland',
    focus: ['consumers'],
    retrievalMeaning: 'inflation high Poland consumers impact',
    source: 'prior-question',
    disclosures: [],
  };

  it('the chip names the subject and the focus, never the retrieval plumbing', () => {
    const html = render(withSubject(POLAND), 'en');
    expect(html).toContain('Continuing: inflation high Poland · consumers');
    expect(html).not.toContain('retrievalMeaning');
    expect(html).not.toContain('data-ask="focus-not-in-evidence"');
  });

  it.each(['en', 'pl'] as const)('%s: an unaddressed focus is disclosed in the reader’s language', (language) => {
    const html = render(withSubject({ ...POLAND, disclosures: ['FOCUS_NOT_IN_EVIDENCE'] }), language);
    expect(html).toContain('data-ask="focus-not-in-evidence"');
    expect(html).toContain(getDictionary(language).askAi.focusNotInEvidence.replace('{focus}', 'consumers'));
  });
});

describe('the continued subject on the Ask dock', () => {
  it.each(['en', 'pl'] as const)('%s: "Continuing: …" and the product-applicability note', (language) => {
    const t = getDictionary(language).askAi;
    const html = render(withSubject(EU), language, { onStartNewTopic: () => undefined });
    expect(html).toContain(t.continuingSubject.replace('{subject}', 'EU AI regulation'));
    expect(html).toContain(t.productApplicabilityNotEstablished);
    expect(html).toContain(t.startNewTopic);
    expect(html).toContain('data-ask="new-topic"');
  });

  it('EN wording, exactly as the ruling describes it', () => {
    const html = render(withSubject(EU), 'en');
    expect(html).toContain('Continuing: EU AI regulation');
    expect(html).not.toMatch(/prior-question|conversationSubject|PRODUCT_APPLICABILITY/);
  });

  it('after "Start a new topic" the control says the next question starts fresh', () => {
    const html = render(withSubject(EU), 'en', { onStartNewTopic: () => undefined, newTopicStarted: true });
    expect(html).toContain(getDictionary('en').askAi.newTopicStarted);
    expect(html).toContain('aria-pressed="true"');
  });

  it('past turns show the subject but offer no control', () => {
    expect(render(withSubject(EU), 'en')).not.toContain('data-ask="new-topic"');
  });

  it('no product question → no product note; no continued subject → nothing at all', () => {
    const plainSubject = render(withSubject({ ...EU, disclosures: [] }), 'en');
    expect(plainSubject).toContain('Continuing: EU AI regulation');
    expect(plainSubject).not.toContain('data-ask="product-applicability"');
    expect(render(withSubject(undefined), 'en')).not.toContain('data-ask="continuing"');
  });
});

describe('PRE-MI QUALITY CLOSURE — the resolved compact result carries B and D together', () => {
  it('Continuing chip + compact event note + inline citations + inference label in one answer', () => {
    const base = fixture({}) as AnalysisApiResponse;
    const firstSource = base.analysis!.sources[0];
    const fact = 'The regulation sets obligations for high-risk AI providers.';
    const inference = 'It could affect many online services.';
    const response = {
      ...base,
      retrievalContext: {
        ...base.retrievalContext,
        conversationSubject: EU,
        eventAnchor: {
          topic: 'plane crash',
          source: 'prior-question',
          aspects: { cause: true, effect: true, crossBorder: true },
          directEventArticleIds: [],
          consequenceArticleIds: [],
          contextArticleIds: [],
          disclosures: ['CAUSE_NOT_ESTABLISHED'],
        },
      },
      analysis: {
        ...base.analysis!,
        summary: `${fact} ${inference}`,
        summaryStatements: [
          { text: fact, kind: 'REPORTED_FACT', sourceArticleIds: [firstSource.articleId] },
          { text: inference, kind: 'ANALYTICAL_INFERENCE', sourceArticleIds: [] },
        ],
      },
    } as AnalysisApiResponse;

    const html = render(response, 'en', { onStartNewTopic: () => undefined });
    expect(html).toContain('Continuing: EU AI regulation');
    expect(html).toContain('data-ask="product-applicability"');
    expect(html).toContain('data-event-anchor-variant="compact"');
    expect(html).toContain('data-citation="1"');
    expect(html).toContain('Analytical inference:');
    /* D's block sits before the (compact) event note, which sits before the brief. */
    expect(html.indexOf('data-ask="continuing"')).toBeLessThan(html.indexOf('data-event-anchor="notice"'));
    expect(html.indexOf('data-event-anchor="notice"')).toBeLessThan(html.indexOf('data-ask="brief"'));
  });
});
