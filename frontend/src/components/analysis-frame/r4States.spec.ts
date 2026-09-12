import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AnalysisFrameSurface } from '@/components/analysis-frame/AnalysisFrameSurface';
import { fixture } from '@/components/analysis-frame/frameFixtures';

/**
 * R4 §5 — all twelve functional states, inside the SAME bounded frame.
 *
 * The contract is not "each state renders"; it is that none of them
 * "falls back to the old long document". So every case asserts the
 * frame's own shell markers are present, and — where the state is about
 * absence — that the frame says WHICH absence, rather than one sentence
 * for all of them.
 */
const VP = { width: 1440, height: 900 };
const r = (response: AnalysisApiResponse, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(AnalysisFrameSurface as never, { response, initialViewport: VP, ...extra } as never),
  );

const withProv = (over: Record<string, unknown>, base = fixture()) =>
  ({ ...base, ...over } as AnalysisApiResponse);

const FRAME = 'data-paf="frame"';

describe('R4 §5 — the bounded frame supports every required state', () => {
  const cases: ReadonlyArray<[string, () => string, RegExp]> = [
    ['1 populated, country-resolved', () => r(fixture({ precision: 'country' })), /data-paf="location-detail"/],
    ['2 populated, city-resolved', () => r(fixture({ precision: 'city', city: 'kigali' })), /Kigali/],
    ['3 limited evidence', () => r(fixture({ articleCount: 1, keyFactCount: 1 })), /data-paf="brief-row"/],
    ['4 unresolved geography', () => r(fixture({ precision: 'unresolved' })), /data-paf="location-detail"/],
    ['5 no articles retrieved', () => r(fixture({ articleCount: 0, analysisNull: true })), /data-evidence-state="(no-evidence|provider-unavailable)"/],
    ['6 AI not attempted, no evidence', () => r(withProv({ analysis: null, articles: [], retrievalContext: { dataMode: 'live', providers: ['gnews'], articlesRetrieved: 0 }, provenance: { provider: 'openai', executionMode: 'production', analysisMode: 'live-ai', status: 'not-attempted', cached: false } })), /data-evidence-state="no-evidence"/],
    ['7 provider unavailable', () => r(withProv({ analysis: null, articles: [], retrievalContext: { dataMode: 'unavailable', providers: [], articlesRetrieved: 0 } })), /data-evidence-state="provider-unavailable"/],
    ['8 rate-limited', () => r(withProv({ analysis: null, analysisError: 'rate limited', provenance: { provider: 'openai', executionMode: 'production', analysisMode: 'live-ai', status: 'failed', cached: false } })), /data-evidence-state="analysis-failed"/],
    ['11a complete record CLOSED', () => r(fixture()), /data-paf="complete-record-entry"/],
    ['11b complete record EXPANDED', () => r(fixture(), { initialDestination: 'record' }), /data-paf="complete-record"/],
    /* RETARGETED AT H-ALPHA-VISUAL-1 ITEM A. The invariant is that the
       required STATE is supported and renders inside the frame. R3
       replaced the dock's compact/expanded pair on the reading path with
       one image-led presentation, so the two rows become the two facts
       that presentation must carry: the section renders, and every source
       gets an image slot whether or not it has an image. */
    ['12a sources & reporting renders', () => r(fixture()), /data-paf="sources-reporting"/],
    ['12b every source gets an image slot', () => r(fixture()), /data-paf="source-image-frame"/],
  ];

  it.each(cases)('%s', (_name, render, marker) => {
    const html = render();
    expect(html).toMatch(marker);
  });

  it.each(cases.filter(([n]) => !n.startsWith('11b')))('%s stays inside the bounded frame', (_n, render) => {
    expect(render()).toContain(FRAME);
  });

  it('the four absence states do NOT share one sentence', () => {
    const states = [
      r(withProv({ analysis: null, articles: [], retrievalContext: { dataMode: 'live', providers: ['g'], articlesRetrieved: 0 } })),
      r(withProv({ analysis: null, articles: [], retrievalContext: { dataMode: 'unavailable', providers: [], articlesRetrieved: 0 } })),
      r(fixture({ analysisNull: true })),
    ].map((h) => (h.match(/data-evidence-state="([a-z-]+)"/) ?? [])[1]);
    expect(new Set(states).size).toBe(states.length);
  });

  /*
   * States 9 and 10 are the page's, not the frame's: a loading response
   * and a /search opened with no question are both states in which there
   * is no analysis to compose. R4 §5 requires them to exist, not to be
   * rendered inside the frame — and the R4 early return must not swallow
   * them. Asserted on the mount site, which is where that risk lives.
   */
  it('9 and 10 — the frame mount does not swallow loading or the no-question entry', () => {
    const client = require('node:fs').readFileSync(
      `${__dirname}/../search/SearchPageClient.tsx`,
      'utf8',
    ) as string;

    /* The early return is gated on a RESPONSE existing... */
    expect(client).toMatch(/if \(showsWorkspace && response !== null\) \{/);
    /* ...and showsWorkspace is false while loading or erroring. */
    expect(client).toMatch(/const showsWorkspace = !isLoading && !fetchError && response !== null;/);

    /* Both states still render, below the early return. */
    const returnAt = client.indexOf('if (showsWorkspace && response !== null) {');
    const rest = client.slice(returnAt);
    expect(rest).toContain('<LoadingStages');
    expect(rest).toContain('searchWorkspaceSubmitLabel');
  });
});
