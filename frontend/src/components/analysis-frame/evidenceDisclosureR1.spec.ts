import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalysisApiResponse, AnalysisRetrievalContext } from '@globalnews-ai/shared';
import { resolveFrameEvidence } from './analysisFrameState';
import { fixture } from './frameFixtures';
import { EvidenceFreshnessNotice, evidenceIsLive } from '@/components/search/EvidenceFreshnessNotice';
import { AskCompactResult } from '@/components/ask/AskCompactResult';

/**
 * ASK/SEARCH ENGINEERING R1 — degraded evidence is never presented as live,
 * and a failed provider is never reported as "nothing matched".
 */

function withContext(
  patch: Partial<AnalysisRetrievalContext>,
  options: { articles?: number; analysis?: boolean } = {},
): AnalysisApiResponse {
  const base = fixture({ articleCount: options.articles ?? 0, analysisNull: options.analysis === false });
  return { ...base, retrievalContext: { ...base.retrievalContext, ...patch } };
}

describe('FAILURE IS NOT ABSENCE — resolveFrameEvidence', () => {
  it('a rate-limited provider is a failure even when another provider answered (live)', () => {
    const r = withContext({ dataMode: 'live', outcome: 'PROVIDER_RATE_LIMITED' }, { analysis: false });
    expect(resolveFrameEvidence(r, true).state).toBe('provider-unavailable');
  });

  it('an unreachable provider outcome is a failure', () => {
    const r = withContext({ dataMode: 'live', outcome: 'PROVIDER_UNAVAILABLE' }, { analysis: false });
    expect(resolveFrameEvidence(r, true).state).toBe('provider-unavailable');
  });

  it('a recorded provider-error with zero reporting is a failure, not "returned nothing"', () => {
    const r = withContext({ dataMode: 'live', fallbackReason: 'provider-error' }, { analysis: false });
    expect(resolveFrameEvidence(r, true).state).toBe('provider-unavailable');
  });

  it('NO_RELEVANT_EVIDENCE is an answered search, whatever the mode', () => {
    const r = withContext({ dataMode: 'unavailable', outcome: 'NO_RELEVANT_EVIDENCE' }, { analysis: false });
    expect(resolveFrameEvidence(r, true).state).toBe('no-evidence');
  });

  it('unchanged: a live search that simply found nothing is no-evidence', () => {
    const r = withContext({ dataMode: 'live' }, { analysis: false });
    expect(resolveFrameEvidence(r, true).state).toBe('no-evidence');
  });
});

describe('RETAINED IS NOT LIVE — EvidenceFreshnessNotice', () => {
  const render = (patch: Partial<AnalysisRetrievalContext>, language: 'en' | 'pl' = 'en'): string =>
    renderToStaticMarkup(
      createElement(EvidenceFreshnessNotice, {
        retrievalContext: { ...fixture().retrievalContext, ...patch },
        language,
      }),
    );

  it('renders nothing for live evidence', () => {
    expect(evidenceIsLive({ ...fixture().retrievalContext, dataMode: 'live' })).toBe(true);
    expect(render({ dataMode: 'live' })).toBe('');
  });

  it('discloses stored reporting and why, in EN and PL', () => {
    const en = render({ dataMode: 'cached', fallbackReason: 'provider-error' });
    expect(en).toContain('data-evidence-freshness="cached"');
    expect(en).toContain('Stored reporting');
    expect(en).toContain('Live reporting was unavailable');
    expect(render({ dataMode: 'cached', fallbackReason: 'provider-error' }, 'pl')).toContain('Relacje z pamięci');
  });

  it('RETAINED_ONLY stamped on a live mode is still disclosed as stored', () => {
    expect(render({ dataMode: 'live', outcome: 'RETAINED_ONLY' })).toContain('data-evidence-freshness="cached"');
  });

  it('discloses demo reporting', () => {
    expect(render({ dataMode: 'mock' })).toContain('data-evidence-freshness="mock"');
  });
});

describe('THE ASK DOCK RESULT carries the disclosure beside the AI badge', () => {
  const html = (response: AnalysisApiResponse): string =>
    renderToStaticMarkup(
      createElement(AskCompactResult, { response, question: 'What is happening?', context: undefined, language: 'en' }),
    );

  it('stored reporting behind a successful analysis is disclosed', () => {
    const out = html(withContext({ dataMode: 'cached', fallbackReason: 'provider-error' }, { articles: 2 }));
    expect(out).toContain('data-evidence-freshness="cached"');
  });

  it('live evidence carries no stored-reporting notice', () => {
    expect(html(withContext({ dataMode: 'live' }, { articles: 2 }))).not.toContain('data-evidence-freshness');
  });

  it('a rate-limited provider with no answer says so, not "no reporting met the threshold"', () => {
    const out = html(withContext({ dataMode: 'live', outcome: 'PROVIDER_RATE_LIMITED' }, { analysis: false }));
    expect(out).toContain('Live reporting could not be retrieved reliably');
  });
});
