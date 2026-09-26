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

describe('ASK/SEARCH R1 CLOSURE — the stamped evidence-state fact decides', () => {
  it('stamped degraded-fallback with nothing to show is provider-unavailable, even on a live mode', () => {
    const r = withContext({ dataMode: 'live', evidenceState: 'degraded-fallback' }, { analysis: false });
    expect(resolveFrameEvidence(r, true).state).toBe('provider-unavailable');
  });

  it('stamped no-relevant-evidence is the only "nothing matched" state', () => {
    const r = withContext({ dataMode: 'unavailable', evidenceState: 'no-relevant-evidence' }, { analysis: false });
    expect(resolveFrameEvidence(r, true).state).toBe('no-evidence');
  });

  it('the notice never claims stored reporting was used when nothing was retrieved', () => {
    const html = renderToStaticMarkup(
      createElement(EvidenceFreshnessNotice, {
        retrievalContext: { ...fixture().retrievalContext, dataMode: 'live', evidenceState: 'degraded-fallback', articlesRetrieved: 0 },
        language: 'en',
      }),
    );
    expect(html).toContain('data-evidence-freshness="unavailable"');
    expect(html).not.toContain('Stored reporting');
  });

  it('the "nothing matched" copy no longer says the provider "returned nothing" (EN/PL)', () => {
    const { getDictionary } = jest.requireActual('@/lib/i18n/dictionaries');
    const en = JSON.stringify(getDictionary('en'));
    const pl = JSON.stringify(getDictionary('pl'));
    expect(en).not.toContain('returned nothing for this question');
    expect(pl).not.toContain('nic nie zwróciło dla tego pytania');
  });
});

describe('CTO RULING 2 — a compute-triggering control is never called Open', () => {
  const html = (language: 'en' | 'pl'): string =>
    renderToStaticMarkup(
      createElement(AskCompactResult, {
        response: withContext({ dataMode: 'live' }, { articles: 2 }),
        question: 'What is happening?',
        context: undefined,
        language,
      }),
    );

  it('EN: Run full analysis, with the supporting note', () => {
    const out = html('en');
    expect(out).toContain('Run full analysis');
    expect(out).toContain('Starts a new source-backed analysis.');
    expect(out).not.toContain('Open full analysis');
  });

  it('PL: Uruchom pełną analizę, with the supporting note', () => {
    const out = html('pl');
    expect(out).toContain('Uruchom pełną analizę');
    expect(out).toContain('Rozpoczyna nową analizę opartą na źródłach.');
    expect(out).not.toContain('Otwórz pełną analizę');
  });
});
