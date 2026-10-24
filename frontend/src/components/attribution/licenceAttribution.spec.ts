import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { NewsArticle } from '@globalnews-ai/shared';
import { HomeR1Credited } from '@/components/home/r1/HomeR1Credited';
import { isFullyCredited } from './LicenceAttribution';

/*
  E1 V7 C-B1 — the credit line at the render seam, and a guard ENUMERATED ON THE DATA (E1 EN-1): every
  source file that touches the credited articles is found by scanning for the field, not from a
  hand-list, so a new consumer cannot appear silently.
*/
const BY3 = 'https://creativecommons.org/licenses/by/3.0/';
const article = (patch: Partial<NewsArticle> = {}): NewsArticle =>
  ({
    id: 'rss-1',
    title: 'Venezuela faces a deepening energy crisis as protests grow',
    summary: 'Power cuts spread.',
    url: 'https://globalvoices.org/2026/10/22/venezuela-faces-a-deepening-energy-crisis-as-protests-grow/',
    sourceId: 'feed:globalvoices',
    sourceName: 'Global Voices',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-10-22T20:06:00.000Z',
    publishedAtBasis: 'publisher',
    authorName: 'Gabriela Mesones Rojo',
    licenseId: 'CC-BY-3.0',
    licenseUrl: BY3,
    ...patch,
  }) as NewsArticle;

const render = (articles: NewsArticle[], language = 'en') =>
  renderToStaticMarkup(createElement(HomeR1Credited, { articles, language: language as never }));

describe('E1 V7 C-B1 · the licence credit line', () => {
  it('renders all four CC BY 3.0 conditions plus the house rule, and no image', () => {
    const html = render([article()]);
    expect(html).toContain('Credited reporting');
    expect(html).toMatch(/Written by <bdi data-credit-author="">Gabriela Mesones Rojo<\/bdi>/);
    expect(html).toContain('data-credit-publisher="">Global Voices<');
    expect(html).toMatch(new RegExp(`data-credit-original="" href="${article().url}"`));
    expect(html).toMatch(new RegExp(`data-credit-licence="" href="${BY3}"[^>]*>CC BY 3.0<`));
    expect(html).toContain('Headline shown unchanged');
    expect(html).toContain('Not endorsed');
    expect(html).not.toMatch(/<img|Power cuts spread/);
  });

  it.each([
    ['no author', { authorName: undefined }],
    ['blank author', { authorName: ' ' }],
    ['no licence URL', { licenseUrl: undefined }],
    ['a licence id it cannot name', { licenseId: 'CC-BY-4.0' }],
    ['an unsafe original link', { url: 'javascript:alert(1)' }],
  ])('FAIL CLOSED — %s: the item is not rendered at all', (_case, patch) => {
    expect(isFullyCredited(article(patch))).toBe(false);
    expect(render([article(patch)])).toBe('');
  });

  it.each(['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'])('%s: a credit line in its own catalogue, no bidi control', (language) => {
    const html = render([article()], language);
    expect(html).toContain('data-licence-attribution');
    expect(html).not.toMatch(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C]/u);
  });
});

describe('E1 V7 · guard enumerated on the data, not on a list of components', () => {
  const SRC = resolve(__dirname, '../..');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      if (name === 'node_modules' || name.startsWith('.')) return [];
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return files(path);
      return /\.(ts|tsx)$/.test(name) && !/\.spec\.tsx?$/.test(name) ? [path] : [];
    });
  /* the credited data as CODE touches it: the response field, or the `credited` identifier bound, read or passed */
  const CREDITED_DATA = /creditedArticles|\bcredited\??\s*[:=]|\.credited\b|\{credited\}/;
  const touching = files(SRC)
    .filter((path) => CREDITED_DATA.test(readFileSync(path, 'utf8')))
    .map((path) => relative(SRC, path).split('\\').join('/'))
    .sort();

  it('every file touching the credited data is known; a new consumer fails here and must be reviewed', () => {
    expect(touching).toEqual([
      'app/page.tsx',
      'components/home/r1/HomeR1Credited.tsx',
      'components/home/r1/HomeR1Page.tsx',
      'lib/homeFeed.ts',
    ]);
  });

  it('the only file that RENDERS credited items renders the credit line and gates each item', () => {
    const credited = readFileSync(join(SRC, 'components/home/r1/HomeR1Credited.tsx'), 'utf8');
    expect(credited).toMatch(/<LicenceAttribution article=\{article\}/);
    expect(credited).toMatch(/articles\.filter\(isFullyCredited\)/);
    for (const passThrough of ['app/page.tsx', 'components/home/r1/HomeR1Page.tsx', 'lib/homeFeed.ts']) {
      expect(readFileSync(join(SRC, passThrough), 'utf8')).not.toMatch(/credited[^\n]*\.(title|url)\b/);
    }
  });
});
