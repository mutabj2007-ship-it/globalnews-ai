import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalysisApiResponse, NewsArticle } from '@globalnews-ai/shared';
import { AnalysisFrame } from './AnalysisFrame';
import { buildEvidenceGeography } from './evidenceGeography';
import { fixture } from './frameFixtures';

/**
 * R4.1 §4 — THE IRAN / ISRAEL ACCEPTANCE CASES.
 *
 * CONTROLLED FIXTURES. Every country below is a test input. Nothing here
 * is imported by production code, and `r41NoHardcodedExamples` at the foot
 * of this file asserts that the production modules contain no country name
 * or ISO code at all — the registry supplies them at runtime.
 *
 * The article shapes mirror what `news.service.resolveArticleCountries()`
 * produces: alpha-2 in `NewsArticle.countryCode`, absent when
 * `resolvePrimaryCountry()` found no unique winner.
 */
const VP = { width: 1440, height: 900 };

const article = (id: string, countryCode?: string): NewsArticle =>
  ({
    id,
    title: `Report ${id}`,
    summary: `Body ${id}.`,
    url: `https://outlet-${id}.test/s`,
    sourceId: `s-${id}`,
    sourceName: `Outlet ${id}`,
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-08-20T10:00:00.000Z',
    sourceLanguage: 'en',
    ...(countryCode === undefined ? {} : { countryCode }),
    /*
      SPATIAL M1.0B — mirrors what withDerivedEvidenceFields actually emits:
      geographicPrecision is written on EVERY article, 'country' when a
      countryCode resolved and 'unknown' when none did. This builder omitted
      it, which described a payload the backend does not produce. Every
      assertion in this file is unchanged.
    */
    geographicPrecision: countryCode === undefined ? 'unknown' : 'country',
  }) as NewsArticle;

/** A populated response whose retrieval context carries no country. */
const withArticles = (articles: NewsArticle[], retrieval: Record<string, unknown> = {}) =>
  ({
    ...fixture({ articleCount: 0 }),
    articles,
    retrievalContext: {
      dataMode: 'live',
      providers: ['gnews'],
      articlesRetrieved: articles.length,
      ...retrieval,
    },
  }) as unknown as AnalysisApiResponse;

const render = (response: AnalysisApiResponse) =>
  renderToStaticMarkup(
    createElement(AnalysisFrame as never, { response, initialViewport: VP } as never),
  );

/** The right rail only — so a country named in analysis prose cannot pass. */
const rail = (html: string) =>
  html.slice(html.indexOf('data-paf="location-detail"'), html.indexOf('data-paf="sources-dock"'));

const filled = (html: string) =>
  [...rail(html).matchAll(/data-paf="evidence-country" data-iso3="([A-Z]{3})"/g)].map((m) => m[1]);

describe('R4.1 §4.1 — Iran-only evidence', () => {
  const response = withArticles([article('a1', 'IR'), article('a2', 'IR')]);

  it('fills Iran and does not fill Israel', () => {
    const html = render(response);
    expect(filled(html)).toEqual(['IRN']);
    expect(filled(html)).not.toContain('ISR');
  });

  it('names Iran in the rail', () => {
    expect(rail(render(response))).toContain('Iran');
  });

  it('the model records the per-record basis, not a retrieval filter', () => {
    const m = buildEvidenceGeography(response);
    expect(m.countries.map((c) => [c.iso2, c.basis, c.articleCount])).toEqual([['IR', 'article-evidence', 2]]);
    expect(m.primary?.iso2).toBe('IR');
    expect(m.precisionCeiling).toBe('country');
  });
});

describe('R4.1 §4.2 — Israel-only evidence', () => {
  const response = withArticles([article('a1', 'IL')]);

  it('fills Israel and does not fill Iran', () => {
    const html = render(response);
    expect(filled(html)).toEqual(['ISR']);
    expect(filled(html)).not.toContain('IRN');
  });
});

describe('R4.1 §4.3 — Iran and Israel both supported', () => {
  /* Different ARTICLES resolve to different countries. A single article
     naming both resolves to neither: `resolvePrimaryCountry()` returns the
     unique maximum or nothing, proven against the real backend resolver in
     the R4.1 source trace. */
  const response = withArticles([
    article('a1', 'IR'),
    article('a2', 'IR'),
    article('a3', 'IL'),
  ]);

  it('fills both countries', () => {
    const f = filled(render(response));
    expect(f).toContain('IRN');
    expect(f).toContain('ISR');
    expect(f).toHaveLength(2);
  });

  it('primary and related evidence remain distinguishable', () => {
    const m = buildEvidenceGeography(response);
    expect(m.primary?.iso2).toBe('IR');
    expect(m.countries.map((c) => [c.iso2, c.articleCount])).toEqual([['IR', 2], ['IL', 1]]);
    const html = rail(render(response));
    expect(html).toContain('Iran');
    expect(html).toContain('Israel');
  });

  it('an equal split yields NO primary — a tie is not a finding', () => {
    const m = buildEvidenceGeography(withArticles([article('a1', 'IR'), article('a2', 'IL')]));
    expect(m.countries).toHaveLength(2);
    expect(m.primary).toBeNull();
  });
});

describe('R4.1 §4.4 — the question names a country, the evidence resolves nowhere', () => {
  /* No article resolved. The route carried no country either, so there is
     no country-filtered pool to lean on. */
  const response = withArticles([article('a1'), article('a2')]);

  it('fills nothing at all', () => {
    expect(filled(render(response))).toEqual([]);
  });

  it('states that evidence geography is unresolved', () => {
    const html = rail(render(response));
    expect(html).toContain('data-paf="evidence-unresolved"');
    expect(html).toMatch(/data-precision="unresolved"/);
  });

  it('a country named only in the QUESTION never becomes evidence', () => {
    /* The question mentioning Iran reaches the frontend as retrieval
       context, never as an article country. It may be identified; it may
       not be filled. */
    const m = buildEvidenceGeography(
      withArticles([article('a1')], { countryCode: 'IRN', countryName: 'Iran' }),
    );
    expect(m.countries.every((c) => c.basis !== 'article-evidence')).toBe(true);
    expect(m.countries.some((c) => c.basis === 'article-evidence' && c.iso2 === 'IR')).toBe(false);
  });
});

describe('R4.1 §4.5 — route countryCode disagrees with the evidence', () => {
  /* The route asked about Iran; every retained article resolved Israel. */
  const response = withArticles([article('a1', 'IL'), article('a2', 'IL')], {
    countryCode: 'IRN',
    countryName: 'Iran',
  });

  it('evidence remains authoritative — Israel is filled', () => {
    expect(filled(render(response))).toContain('ISR');
  });

  it('the route country does NOT receive the evidence fill', () => {
    const m = buildEvidenceGeography(response);
    const iran = m.countries.find((c) => c.iso2 === 'IR');
    expect(iran?.basis).not.toBe('article-evidence');

    /* And it is not filled ON SCREEN either — the screenshot caught this
       when the model was right and the map still painted Iran cyan. */
    const r = rail(render(response));
    expect(filled(render(response))).toEqual(['ISR']);
    expect(r).toContain('data-paf="map-query-target"');
    expect(r.slice(r.indexOf('data-paf="map-query-target"'), r.indexOf('</g>', r.indexOf('data-paf="map-query-target"'))))
      .toContain('fill="none"');
  });

  it('the discrepancy is STATED, not smoothed over', () => {
    const m = buildEvidenceGeography(response);
    expect(m.targetDisagreesWithEvidence).toBe(true);
    expect(rail(render(response))).toContain('data-paf="target-not-supported"');
  });
});

describe('R4.1 §5 — precision', () => {
  it('no point marker is plotted merely because a country is known', () => {
    const html = rail(render(withArticles([article('a1', 'IR')])));
    expect(html).not.toContain('data-paf="resolution-marker"');
    expect(html).toContain('NOT A COORDINATE');
  });

  it('the ceiling is country or unresolved — never city', () => {
    for (const r of [withArticles([article('a1', 'IR')]), withArticles([article('a1')])]) {
      expect(['country', 'unresolved']).toContain(buildEvidenceGeography(r).precisionCeiling);
    }
  });

  it('the withdrawn fixture-only precision breakdown is NOT restored', () => {
    const html = render(withArticles([article('a1', 'IR')]));
    expect(html).not.toContain('data-paf="precision-breakdown"');
    expect(html).not.toMatch(/CITY-RESOLVED|COUNTRY-ONLY REPORTS/);
  });
});

describe('R4.1 §7 — absent and failure states never invent geography', () => {
  const empty = (r: AnalysisApiResponse) => filled(render(r));

  it('no articles retrieved fills nothing', () => {
    expect(empty(withArticles([]))).toEqual([]);
  });

  it('provider unavailable fills nothing', () => {
    expect(
      empty(withArticles([], { dataMode: 'unavailable', providers: [] })),
    ).toEqual([]);
  });

  it('a null analysis with no articles fills nothing', () => {
    const r = { ...withArticles([]), analysis: null } as unknown as AnalysisApiResponse;
    expect(empty(r)).toEqual([]);
  });

  it('an empty state renders a statement, not a world map', () => {
    const html = rail(render(withArticles([])));
    expect(html).toContain('data-paf="compact-map"');
    expect(html).toMatch(/data-state="(nothing-to-draw|target-only)"/);
  });
});

describe('R4.1 — no example value is hardcoded in production', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const PRODUCTION = ['evidenceGeography.ts', 'EvidenceMap.tsx'];

  it.each(PRODUCTION)('%s contains no country name or ISO code', (file: string) => {
    const src = fs
      .readFileSync(`${__dirname}/${file}`, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(src).not.toMatch(/\b(Iran|Israel|Kigali|Rwanda|Ukraine|Musanze)\b/i);
    expect(src).not.toMatch(/['"`](IR|IL|RW|UA|IRN|ISR|RWA|UKR)['"`]/);
  });
});
