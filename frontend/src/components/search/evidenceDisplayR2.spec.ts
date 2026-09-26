import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalysisRetrievalContext } from '@globalnews-ai/shared';
import { EvidenceFreshnessNotice } from './EvidenceFreshnessNotice';
import { RetrievalContextStatus, resolveRetrievalContextText } from './RetrievalContextStatus';
import { displayEvidenceState } from './evidenceDisplay';

/**
 * PR #40 R2 F3 — the shared resolveEvidenceState() contract is the single
 * authority for every evidence-state UI consumer. For each state, a STAMPED
 * payload and a LEGACY payload (no evidenceState; derived from the rendered
 * article count) must produce the same label in the top-level notice and in
 * the Complete Record, and must never show failure or retained evidence as live.
 */

const ctx = (patch: Partial<AnalysisRetrievalContext>): AnalysisRetrievalContext =>
  ({ dataMode: 'live', providers: ['gnews'], articlesRetrieved: 0, ...patch }) as AnalysisRetrievalContext;

const notice = (context: AnalysisRetrievalContext, articleCount: number, language: 'en' | 'pl' = 'en'): string =>
  renderToStaticMarkup(createElement(EvidenceFreshnessNotice, { retrievalContext: context, articleCount, language }));
const record = (context: AnalysisRetrievalContext, articleCount: number, language: 'en' | 'pl' = 'en'): string =>
  renderToStaticMarkup(createElement(RetrievalContextStatus, { retrievalContext: context, articleCount, language }));

interface Case {
  name: string;
  count: number;
  legacy: Partial<AnalysisRetrievalContext>;
  stamped: Partial<AnalysisRetrievalContext>;
  state: string;
  label: string;
  explanation?: string;
  noticeMode: string | null;
}

const CASES: Case[] = [
  {
    name: 'retained evidence (RETAINED_ONLY on a live mode)',
    count: 2,
    legacy: { dataMode: 'live', outcome: 'RETAINED_ONLY' },
    stamped: { dataMode: 'live', outcome: 'RETAINED_ONLY', evidenceState: 'retained' },
    state: 'retained',
    label: 'Stored reporting',
    noticeMode: 'cached',
  },
  {
    name: 'provider unavailable with zero articles',
    count: 0,
    legacy: { dataMode: 'live', outcome: 'PROVIDER_UNAVAILABLE' },
    stamped: { dataMode: 'live', outcome: 'PROVIDER_UNAVAILABLE', evidenceState: 'degraded-fallback' },
    state: 'degraded-fallback',
    label: 'Live data unavailable',
    explanation: 'The live news provider could not be reached, and no stored reporting was available for this question.',
    noticeMode: 'unavailable',
  },
  {
    name: 'degraded fallback serving stored reporting',
    count: 2,
    legacy: { dataMode: 'cached', fallbackReason: 'provider-error' },
    stamped: { dataMode: 'cached', fallbackReason: 'provider-error', evidenceState: 'degraded-fallback' },
    state: 'degraded-fallback',
    label: 'Stored reporting',
    explanation: 'Live reporting was unavailable, so this analysis uses stored reporting.',
    noticeMode: 'cached',
  },
  {
    name: 'genuine no-relevant-evidence',
    count: 0,
    legacy: { dataMode: 'unavailable', fallbackReason: 'no-live-results' },
    stamped: { dataMode: 'unavailable', fallbackReason: 'no-live-results', evidenceState: 'no-relevant-evidence' },
    state: 'no-relevant-evidence',
    label: 'Live data unavailable',
    explanation: 'Live retrieval found nothing usable, and no stored reporting was available for this question.',
    noticeMode: null,
  },
  {
    name: 'live evidence',
    count: 3,
    legacy: { dataMode: 'live' },
    stamped: { dataMode: 'live', evidenceState: 'live' },
    state: 'live',
    label: 'Live reporting',
    noticeMode: null,
  },
];

describe.each(CASES)('$name', (c) => {
  describe.each([
    ['stamped', c.stamped],
    ['legacy', c.legacy],
  ] as const)('%s payload', (_, patch) => {
    const context = ctx(patch);

    it('resolves to the same state through the one authority', () => {
      expect(displayEvidenceState(context, c.count)).toBe(c.state);
    });

    it('Complete Record labels it truthfully', () => {
      const text = resolveRetrievalContextText(context, 'en', c.count);
      expect(text.label).toBe(c.label);
      if (c.explanation) expect(text.explanation).toBe(c.explanation);
      expect(record(context, c.count)).toContain(c.label);
    });

    it('the top-level notice agrees with the Complete Record', () => {
      const html = notice(context, c.count);
      if (c.noticeMode === null) {
        expect(html).toBe('');
      } else {
        expect(html).toContain(`data-evidence-freshness="${c.noticeMode}"`);
        expect(html).toContain(c.label);
      }
    });

    if (c.state !== 'live' && c.state !== 'no-relevant-evidence') {
      it('is never shown as live', () => {
        expect(resolveRetrievalContextText(context, 'en', c.count).label).not.toBe('Live reporting');
        // the LABEL, not the explanation sentence 'Live reporting was unavailable, …'
        expect(record(context, c.count)).not.toMatch(/Live reporting(?! was unavailable)/);
        expect(notice(context, c.count)).not.toMatch(/Live reporting(?! was unavailable)/);
      });
    }
  });
});

describe('PL: the notice and the Complete Record agree for provider failure and retained evidence', () => {
  it.each([
    [ctx({ dataMode: 'live', outcome: 'PROVIDER_UNAVAILABLE' }), 0],
    [ctx({ dataMode: 'live', outcome: 'RETAINED_ONLY' }), 2],
  ] as const)('%#', (context, count) => {
    const label = resolveRetrievalContextText(context, 'pl', count).label;
    expect(notice(context, count, 'pl')).toContain(label);
    expect(record(context, count, 'pl')).toContain(label);
    expect(label).not.toBe('Relacje na żywo');
  });
});

describe('newestArticlePublishedAt is described by its own basis', () => {
  const T = new Date(Date.now() - 3 * 3600_000).toISOString();
  const stored = (basis?: 'publisher' | 'observed') =>
    ctx({
      dataMode: 'cached',
      fallbackReason: 'no-live-results',
      countryName: 'Rwanda',
      newestArticlePublishedAt: T,
      ...(basis === undefined ? {} : { newestArticlePublishedAtBasis: basis }),
    });

  it('publisher basis → publication wording', () => {
    expect(resolveRetrievalContextText(stored('publisher'), 'en', 2).freshnessLine).toMatch(
      /^Newest stored article, published: /,
    );
  });

  it('observed basis → observation wording, never "published"', () => {
    const line = resolveRetrievalContextText(stored('observed'), 'en', 2).freshnessLine ?? '';
    expect(line).toContain('seen by a news aggregator (not its publication time)');
    expect(line).not.toMatch(/published/i);
  });

  it('absent basis → explicitly unverified, never "published"', () => {
    const line = resolveRetrievalContextText(stored(), 'en', 2).freshnessLine ?? '';
    expect(line.startsWith('Newest stored article (time basis unverified): ')).toBe(true);
    expect(line).not.toMatch(/published/i);
  });

  it('PL: each basis has its own localized wording', () => {
    expect(resolveRetrievalContextText(stored('publisher'), 'pl', 2).freshnessLine).toContain('opublikowany:');
    expect(resolveRetrievalContextText(stored('observed'), 'pl', 2).freshnessLine).toContain('nie jest to czas publikacji');
    expect(resolveRetrievalContextText(stored(), 'pl', 2).freshnessLine).toContain('podstawa czasu niezweryfikowana');
  });

  it('the Complete Record renders the basis-aware line', () => {
    expect(record(stored('observed'), 2)).toContain('seen by a news aggregator (not its publication time)');
  });
});
