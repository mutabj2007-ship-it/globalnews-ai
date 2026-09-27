import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalysisApiResponse, EventAnchor, SummaryStatement } from '@globalnews-ai/shared';
import { AskCompactResult, COMPACT_SOURCE_LIMIT } from './AskCompactResult';
import { fixture } from '../analysis-frame/frameFixtures';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * ASK INLINE EVIDENCE CITATIONS + INFERENCE LABEL R1 — the compact Ask answer.
 * Every marker comes from a backend-validated statement; every number agrees
 * with the Sources list; inference and unsupported sentences are labelled and
 * never cited; with no statements the brief renders exactly as before.
 */

const withBrief = (
  summary: string,
  statements: SummaryStatement[] | undefined,
  articleCount = 5,
  eventAnchor?: EventAnchor,
): AnalysisApiResponse => {
  const base = fixture({ articleCount }) as AnalysisApiResponse;
  return {
    ...base,
    retrievalContext: { ...base.retrievalContext, ...(eventAnchor ? { eventAnchor } : {}) },
    analysis: { ...base.analysis!, summary, summaryStatements: statements },
  } as AnalysisApiResponse;
};

const render = (response: AnalysisApiResponse, language: 'en' | 'pl' = 'en') =>
  renderToStaticMarkup(
    createElement(AskCompactResult as never, { response, question: 'q', language, context: undefined } as never),
  );

const idOf = (response: AnalysisApiResponse, n: number) => response.analysis!.sources[n - 1].articleId;
const citations = (html: string) => [...html.matchAll(/data-citation="(\d+)"/g)].map((m) => Number(m[1]));

const S1 = 'The aircraft crashed while returning to Kinshasa, killing 14 people.';
const S2 = 'The exact cause remains under investigation.';
const S3 = 'The loss of senior officers could affect command continuity.';

describe('inline citations', () => {
  it('an answer with ONE supporting article: one marker, pointing at that source', () => {
    const r0 = withBrief(S1, []);
    const r = withBrief(S1, [{ text: S1, kind: 'REPORTED_FACT', sourceArticleIds: [idOf(r0, 2)] }]);
    const html = render(r);
    expect(citations(html)).toEqual([2]);
    expect(html).toContain(`href="${r.analysis!.sources[1].url}"`);
  });

  it('MULTIPLE supporting articles: sorted markers after the sentence they support — the CTO example', () => {
    const r0 = withBrief(`${S1} ${S2}`, []);
    const r = withBrief(`${S1} ${S2}`, [
      { text: S1, kind: 'REPORTED_FACT', sourceArticleIds: [idOf(r0, 2), idOf(r0, 1)] },
      { text: S2, kind: 'REPORTED_FACT', sourceArticleIds: [idOf(r0, 4), idOf(r0, 2)] },
    ]);
    const html = render(r);
    expect(citations(html)).toEqual([1, 2, 2, 4]);
    const text = html.replace(/<[^>]+>/g, '');
    expect(text).toContain(`${S1}[1][2] ${S2}[2][4]`);
  });

  it('every marker agrees with the Sources list, including a cited source beyond the compact limit', () => {
    const r0 = withBrief(S1, [], 7);
    const beyond = COMPACT_SOURCE_LIMIT + 2;
    const r = withBrief(S1, [{ text: S1, kind: 'REPORTED_FACT', sourceArticleIds: [idOf(r0, beyond)] }], 7);
    const html = render(r);
    const listed = [...html.matchAll(/data-source-number="(\d+)"/g)].map((m) => Number(m[1]));
    expect(listed).toEqual([1, 2, 3, 4, beyond]);
    for (const n of citations(html)) expect(listed).toContain(n);
    /* The truncation note stays truthful about what is shown. */
    expect(html).toContain('Showing 5 of 7');
  });

  it('a reported consequence is cited like a fact', () => {
    const r0 = withBrief(S1, []);
    const r = withBrief(S1, [{ text: S1, kind: 'REPORTED_CONSEQUENCE', sourceArticleIds: [idOf(r0, 3)] }]);
    expect(citations(render(r))).toEqual([3]);
  });

  it('markers are real links with an accessible name and a 24px tap target', () => {
    const r0 = withBrief(S1, []);
    const r = withBrief(S1, [{ text: S1, kind: 'REPORTED_FACT', sourceArticleIds: [idOf(r0, 1)] }]);
    const html = render(r);
    const marker = html.match(/<a[^>]*data-ask="citation"[^>]*>/)![0];
    expect(marker).toContain('href=');
    expect(marker).toContain(`aria-label="Source 1: ${r.analysis!.sources[0].title}`);
    expect(marker).toContain('min-h-6');
    expect(marker).toContain('min-w-6');
    expect(marker).not.toContain('tabindex="-1"');
  });

  it('an id the backend did not attach is never shown, and a source not in the list is never cited', () => {
    const r = withBrief(S1, [{ text: S1, kind: 'REPORTED_FACT', sourceArticleIds: ['not-a-source'] }]);
    expect(citations(render(r))).toEqual([]);
  });
});

describe('inference and unsupported labels', () => {
  it.each([
    ['en', 'Analytical inference:', 'Not established by the reporting:'],
    ['pl', 'Wniosek analityczny:', 'Nieustalone w doniesieniach:'],
  ] as const)('%s: inference and unsupported sentences are labelled and never cited', (language, inference, unsupported) => {
    const summary = `${S1} ${S3} Rwanda closed its border.`;
    const r0 = withBrief(summary, []);
    const r = withBrief(summary, [
      { text: S1, kind: 'REPORTED_FACT', sourceArticleIds: [idOf(r0, 1)] },
      { text: S3, kind: 'ANALYTICAL_INFERENCE', sourceArticleIds: [] },
      { text: 'Rwanda closed its border.', kind: 'UNSUPPORTED', sourceArticleIds: [] },
    ]);
    const html = render(r, language);
    expect(html).toContain(inference);
    expect(html).toContain(unsupported);
    expect(citations(html)).toEqual([1]);
    expect(html).toMatch(/data-statement-kind="ANALYTICAL_INFERENCE"[^]*<em>The loss of senior officers could affect command continuity\.<\/em>/);
  });

  it('the summary text itself is never altered — only annotated', () => {
    const summary = `${S1} ${S3}`;
    const r0 = withBrief(summary, []);
    const r = withBrief(summary, [
      { text: S1, kind: 'REPORTED_FACT', sourceArticleIds: [idOf(r0, 1)] },
      { text: S3, kind: 'ANALYTICAL_INFERENCE', sourceArticleIds: [] },
    ]);
    const text = render(r)
      .replace(/<a[^>]*data-ask="citation"[^>]*>[^<]*<\/a>/g, '')
      .replace(/<span class="font-mono[^"]*">[^<]*<\/span> /g, '')
      .replace(/<[^>]+>/g, '');
    expect(text).toContain(`${S1} ${S3}`);
  });
});

describe('retained / degraded / absent annotation', () => {
  it('no statements (pre-R1 record, mock, retained evidence): the brief renders as plain paragraphs', () => {
    const r = withBrief(`${S1}\n\n${S2}`, undefined);
    const html = render(r);
    expect(citations(html)).toEqual([]);
    expect(html.match(/data-ask="brief-paragraph"/g)).toHaveLength(2);
    expect(html).toContain(S1);
    expect(html).toContain(S2);
    expect(html).not.toContain('Analytical inference:');
  });

  it('statements are placed paragraph by paragraph', () => {
    const summary = `${S1}\n\n${S2}`;
    const r0 = withBrief(summary, []);
    const r = withBrief(summary, [
      { text: S1, kind: 'REPORTED_FACT', sourceArticleIds: [idOf(r0, 1)] },
      { text: S2, kind: 'REPORTED_FACT', sourceArticleIds: [idOf(r0, 3)] },
    ]);
    const paragraphs = render(r).split('data-ask="brief-paragraph"').slice(1);
    expect(citations(paragraphs[0])).toEqual([1]);
    expect(citations(paragraphs[1])).toEqual([3]);
  });

  it('a withheld brief shows no statements even if some were sent', () => {
    const base = withBrief('', [{ text: S1, kind: 'REPORTED_FACT', sourceArticleIds: ['a1'] }]);
    const r = {
      ...base,
      analysis: {
        ...base.analysis!,
        briefState: { availability: 'withheld-non-compliant', clusters: 2, categories: 2, repairRequested: false, reason: 'x' },
      },
    } as AnalysisApiResponse;
    expect(citations(render(r))).toEqual([]);
  });
});

describe('B3 — the compact evidence note on the Ask dock', () => {
  const ANCHOR: EventAnchor = {
    topic: 'plane crash',
    source: 'prior-question',
    countryIso3: 'COD',
    aspects: { cause: true, effect: true, crossBorder: true },
    directEventArticleIds: ['a1'],
    consequenceArticleIds: [],
    contextArticleIds: [],
    disclosures: ['COUNTRY_INTERPRETED_FROM_EVIDENCE', 'CAUSE_NOT_ESTABLISHED', 'CROSS_BORDER_NOT_ESTABLISHED'],
  };

  it('EN: one line, in the existing fixed disclosure order', () => {
    const html = render(withBrief(S1, undefined, 5, ANCHOR));
    const summaryLine = html.match(/<summary[^>]*>([^]*?)<\/summary>/)![1].replace(/<[^>]+>/g, '');
    expect(summaryLine).toBe(
      'Evidence note · Interpreted as DR Congo / Congo-Kinshasa from reporting · No direct neighbouring-country impact established · Cause not established — Show what this means',
    );
    /* The full backend-disclosure sentences are still there, one tap away. */
    const copy = getDictionary('en').eventAnchor;
    expect(html).toContain(copy.crossBorderNotEstablished);
    expect(html).toContain(copy.causeNotEstablished);
    expect(html).toContain('data-event-anchor-variant="compact"');
  });

  it('PL: the same codes, in Polish', () => {
    const html = render(withBrief(S1, undefined, 5, ANCHOR), 'pl');
    expect(html).toContain('Uwaga o dowodach');
    expect(html).toContain('Przyczyna nieustalona');
    expect(html).toContain(getDictionary('pl').eventAnchor.crossBorderNotEstablished);
  });
});
