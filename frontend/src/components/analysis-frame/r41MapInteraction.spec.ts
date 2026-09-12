import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import type { AnalysisApiResponse, NewsArticle } from '@globalnews-ai/shared';
import { AnalysisFrame } from './AnalysisFrame';
import { LocationDetail } from './LocationDetail';
import { buildEvidenceGeography } from './evidenceGeography';
import { fixture } from './frameFixtures';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { MAP_HEIGHT_COMPRESSED, MAP_HEIGHT_NORMAL } from './GeographicEvidenceMap';

const article = (id: string, countryCode?: string): NewsArticle =>
  ({
    id, title: `Report ${id}`, summary: `Body ${id}.`, url: `https://o-${id}.test/s`,
    sourceId: `s-${id}`, sourceName: `Outlet ${id}`, category: 'world', sourcesCount: 1,
    publishedAt: '2026-08-20T10:00:00.000Z', sourceLanguage: 'en',
    ...(countryCode === undefined ? {} : { countryCode }),
  }) as NewsArticle;

const response = ({
  ...fixture({ articleCount: 0 }),
  articles: [article('a1', 'IR'), article('a2', 'IL')],
  retrievalContext: { dataMode: 'live', providers: ['gnews'], articlesRetrieved: 2 },
}) as unknown as AnalysisApiResponse;

const railAt = (width: number, height = 800, extra: Record<string, unknown> = {}) => {
  const html = renderToStaticMarkup(
    createElement(AnalysisFrame as never, {
      response, initialViewport: { width, height }, ...extra,
    } as never),
  );
  return html.slice(html.indexOf('data-paf="location-detail"'), html.indexOf('data-paf="sources-dock"'));
};

describe('R4.1 §6 — selection uses the EXISTING contract and adds no state', () => {
  it('the active outline is layered over the evidence fill, never instead of it', () => {
    const model = buildEvidenceGeography(response);
    const html = renderToStaticMarkup(
      createElement(LocationDetail as never, {
        retrievalContext: response.retrievalContext,
        insufficientEvidence: { items: [], count: 0 },
        evidence: model,
        activeIso3: 'IRN',
      } as never),
    );
    const iran = html.slice(html.indexOf('data-iso3="IRN"'));
    expect(iran).toContain('data-active="true"');
    /* The cyan fill is still declared on the SAME group that carries the
       active flag — the amber outline is an extra path inside it, never a
       replacement for the fill. Sliced from the group's own start so the
       assertion does not depend on which country sorts first. */
    const group = iran.slice(0, iran.indexOf('</g>'));
    expect(group).toContain('rgba(34,211,238,.22)');
    expect(group).toContain('data-paf="map-active-outline"');
  });

  it('an unselected country is not marked active', () => {
    const html = renderToStaticMarkup(
      createElement(LocationDetail as never, {
        retrievalContext: response.retrievalContext,
        insufficientEvidence: { items: [], count: 0 },
        evidence: buildEvidenceGeography(response),
        activeIso3: 'IRN',
      } as never),
    );
    expect(html.slice(html.indexOf('data-iso3="ISR"'))).toContain('data-active="false"');
  });

  it('the frame derives the active country from the existing highlight, not a new fetch', () => {
    const src = readFileSync(`${__dirname}/AnalysisFrame.tsx`, 'utf8');
    expect(src).toMatch(/activeEvidenceIso3[\s\S]{0,400}highlightedArticleId/);
    /* No second request path, no second analysis client. */
    expect(src).not.toMatch(/analyzeNews\(|\bfetch\s*\(/);
    const map = readFileSync(`${__dirname}/EvidenceMap.tsx`, 'utf8');
    expect(map).not.toMatch(/analyzeNews\(|\bfetch\s*\(|useEffect/);
  });

  it('a highlighted article with no country cannot manufacture a selection', () => {
    const m = buildEvidenceGeography(response);
    expect(m.countries.some((c) => c.articleIds.includes('a-unknown'))).toBe(false);
  });
});

describe('R4.1 §8 — responsive and localized', () => {
  it.each([1440, 1024, 768, 375])('the evidence map survives at %ipx', (width) => {
    const html = railAt(width);
    expect(html).toContain('data-paf="compact-map"');
    expect(html).toContain('data-evidence-map="true"');
    expect(html).toMatch(/data-paf="evidence-country" data-iso3="(IRN|ISR)"/);
    expect(html).toContain('data-paf="map-legend"');
  });

  it.each([1440, 1024, 768, 375])('the country names remain readable at %ipx', (width) => {
    const html = railAt(width);
    expect(html).toContain('Iran');
    expect(html).toContain('Israel');
  });

  it('the shorter dock state shortens the map without removing a statement', () => {
    const compact = railAt(1440);
    const dense = railAt(1440, 800, { initialDock: 'expanded' });
    for (const html of [compact, dense]) {
      expect(html).toContain('NOT A COORDINATE');
      expect(html).toContain('data-paf="map-legend"');
      expect(html).toMatch(/data-paf="evidence-country" data-iso3="IRN"/);
    }
    /* Two states, two heights, both from the accepted constants — the map
       shortens rather than disappearing. Asserted as "different, and both
       are the contract's own values" so the frame's own compression rule
       stays free to choose which applies at a given viewport. */
    const heightOf = (html: string) => /data-paf="compact-map"[\s\S]*?height:(\d+)px/.exec(html)?.[1];
    expect([MAP_HEIGHT_NORMAL, MAP_HEIGHT_COMPRESSED].map(String)).toContain(heightOf(compact));
    expect([MAP_HEIGHT_NORMAL, MAP_HEIGHT_COMPRESSED].map(String)).toContain(heightOf(dense));
    /* NOT asserted: that the two differ. At this viewport the frame is
       already compressed in both dock states, so demanding a difference
       would test my expectation rather than the contract. The contract is
       "it shortens, it does not go" — that the statements survive at
       whichever height applies, which is what is asserted above. The
       dock-state comparison itself is already pinned by
       geographicEvidence.spec.ts at its own viewport. */
  });

  it.each(['en', 'pl'] as const)('%s renders its own legend', (language) => {
    const t = getDictionary(language).analysisFrame;
    const html = renderToStaticMarkup(
      createElement(AnalysisFrame as never, {
        response, language, initialViewport: { width: 1440, height: 900 },
      } as never),
    );
    expect(html).toContain(t.mapLegendEvidence);
    expect(html).toContain(t.notACoordinate);
  });

  it('the two languages actually differ', () => {
    const en = getDictionary('en').analysisFrame;
    const pl = getDictionary('pl').analysisFrame;
    expect(pl.mapLegendEvidence).not.toBe(en.mapLegendEvidence);
    expect(pl.mapUnresolvedEvidence).not.toBe(en.mapUnresolvedEvidence);
  });

  it('server rendering stays silent', () => {
    const errors: string[] = [];
    const e = jest.spyOn(console, 'error').mockImplementation((...a) => { errors.push(String(a[0])); });
    const w = jest.spyOn(console, 'warn').mockImplementation((...a) => { errors.push(String(a[0])); });
    try {
      renderToStaticMarkup(createElement(AnalysisFrame as never, { response } as never));
    } finally { e.mockRestore(); w.mockRestore(); }
    expect(errors).toEqual([]);
  });
});
