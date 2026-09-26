import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalysisApiResponse, EventAnchor } from '@globalnews-ai/shared';
import { EventAnchorNotice, resolveAmbiguousCountryQuestion, resolveEventAnchorLines } from './EventAnchorNotice';
import { ZeroReportRecovery } from '../analysis-frame/ZeroReportRecovery';
import { AnalysisFrameSurface } from '../analysis-frame/AnalysisFrameSurface';
import { AskCompactResult } from '../ask/AskCompactResult';
import { resolveFrameEvidence } from '../analysis-frame/analysisFrameState';
import { fixture } from '../analysis-frame/frameFixtures';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * ASK CONVERSATIONAL EVIDENCE ANCHORING R1 — the backend's anchor codes, worded
 * once and shown on BOTH the Ask dock and the analysis frame; the ambiguous
 * country is asked about, never chosen and never reported as "no evidence".
 */

const ANCHOR: EventAnchor = {
  topic: 'plane crash',
  source: 'prior-question',
  countryIso3: 'COD',
  aspects: { cause: true, effect: true, crossBorder: true },
  directEventArticleIds: ['crash-1'],
  consequenceArticleIds: [],
  contextArticleIds: ['ebola-1'],
  disclosures: ['COUNTRY_INTERPRETED_FROM_EVIDENCE', 'CAUSE_NOT_ESTABLISHED', 'CROSS_BORDER_NOT_ESTABLISHED', 'CONTEXT_SEPARATED'],
  contextOnlyClaimsWithheld: 1,
};

const anchored = (): AnalysisApiResponse => {
  const base = fixture({}) as AnalysisApiResponse;
  return { ...base, retrievalContext: { ...base.retrievalContext, eventAnchor: ANCHOR } } as AnalysisApiResponse;
};

const ambiguous = (): AnalysisApiResponse => {
  const base = fixture({ analysisNull: true }) as AnalysisApiResponse;
  return {
    ...base,
    articles: [],
    retrievalContext: {
      ...base.retrievalContext,
      dataMode: 'unavailable',
      fallbackReason: 'no-live-results',
      articlesRetrieved: 0,
      retrievalOutcome: 'CLARIFICATION_REQUIRED',
      clarificationReason: 'AMBIGUOUS_COUNTRY',
      clarificationCandidates: ['COD', 'COG'],
    },
  } as AnalysisApiResponse;
};

describe('the disclosure lines', () => {
  it('EN: the interpretation provenance comes first and the cross-border sentence is the required one', () => {
    const lines = resolveEventAnchorLines(anchored().retrievalContext, 'en').map((l) => l.text);
    expect(lines[0]).toBe('Interpreted as DR Congo / Congo-Kinshasa from the event evidence.');
    expect(lines).toContain(
      'The available reporting does not yet establish a direct impact on neighbouring countries from the event itself.',
    );
    expect(lines).toContain(getDictionary('en').eventAnchor.contextSeparated);
    expect(lines).toContain(getDictionary('en').eventAnchor.contextClaimsWithheld);
  });

  it('PL: the same codes, in Polish, with the Polish country name', () => {
    const lines = resolveEventAnchorLines(anchored().retrievalContext, 'pl').map((l) => l.text);
    expect(lines[0]).toContain('DR Konga / Kongo-Kinszasa');
    expect(lines).toContain(getDictionary('pl').eventAnchor.crossBorderNotEstablished);
  });

  it('nothing at all without an anchor', () => {
    const plain = fixture({}) as AnalysisApiResponse;
    expect(resolveEventAnchorLines(plain.retrievalContext, 'en')).toEqual([]);
    expect(
      renderToStaticMarkup(createElement(EventAnchorNotice, { retrievalContext: plain.retrievalContext, language: 'en' })),
    ).toBe('');
  });
});

describe('both surfaces render the same notice', () => {
  const crossBorder = getDictionary('en').eventAnchor.crossBorderNotEstablished;

  it('the Ask dock', () => {
    const html = renderToStaticMarkup(
      createElement(AskCompactResult as never, { response: anchored(), question: 'q', language: 'en', context: undefined } as never),
    );
    expect(html).toContain('data-event-anchor="notice"');
    expect(html).toContain(crossBorder);
  });

  it('the analysis frame', () => {
    const html = renderToStaticMarkup(
      createElement(AnalysisFrameSurface as never, { response: anchored(), initialViewport: { width: 1280, height: 900 } } as never),
    );
    expect(html).toContain('data-event-anchor="notice"');
    expect(html).toContain(crossBorder);
  });
});

describe('an ambiguous country is asked about, never chosen', () => {
  it('the frame state carries AMBIGUOUS_COUNTRY', () => {
    expect(resolveFrameEvidence(ambiguous(), true)).toMatchObject({
      state: 'clarification-required',
      clarificationReason: 'AMBIGUOUS_COUNTRY',
    });
  });

  it.each(['en', 'pl'] as const)('%s: recovery names BOTH countries and does not claim nothing was searched', (language) => {
    const html = renderToStaticMarkup(
      createElement(ZeroReportRecovery as never, {
        response: ambiguous(),
        state: 'clarification-required',
        clarificationReason: 'AMBIGUOUS_COUNTRY',
        language,
        onRetry: () => undefined,
        onEdit: () => undefined,
      } as never),
    );
    const copy = getDictionary(language).eventAnchor;
    expect(html).toContain(copy.stateAmbiguousCountry);
    expect(html).toContain(copy.ambiguousCountryQuestion);
    expect(html).toContain(copy.countryNamesFull.COD);
    expect(html).toContain(copy.countryNamesFull.COG);
    expect(html).not.toContain(getDictionary(language).analysisFrame.stateClarificationRequired);
  });

  it('the dock asks the same question instead of "no evidence"', () => {
    const html = renderToStaticMarkup(
      createElement(AskCompactResult as never, { response: ambiguous(), question: 'q', language: 'en', context: undefined } as never),
    );
    const q = resolveAmbiguousCountryQuestion(ambiguous().retrievalContext, 'en')!;
    expect(html).toContain(q.question);
    expect(html).toContain('Democratic Republic of the Congo (Congo-Kinshasa)');
    expect(html).not.toContain(getDictionary('en').askAi.resultNoAnswerEvidence);
  });
});
