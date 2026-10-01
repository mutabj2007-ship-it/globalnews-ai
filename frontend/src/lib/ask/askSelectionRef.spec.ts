import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizeArticleUrl } from '@globalnews-ai/shared';
import { HomeCompare } from '@/components/home/HomeCompare';
import {
  articleRefOf,
  askCompareHref,
  askCompareRef,
  compareUrls,
  dashboardCompareContext,
} from './askSelectionRef';

/**
 * UNIFIED INTELLIGENCE BINDING R2H — Home Compare through the ONE Ask: a local choice, a staged
 * /ask arrival, and ONE Ask V2 SELECTION turn on the reader's Ask.
 */

const SRC = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
/** The server's formula (backend news/identity/article-ref.util.ts computeArticleRef). */
const serverRef = (url: string) =>
  createHash('sha256').update(normalizeArticleUrl(url), 'utf8').digest('hex');
const u = (n: number) => `https://news.example/2026/10/01/story-${n}`;

describe('articleRefOf — byte-identical to the server identity', () => {
  it.each([
    'https://news.example/world/2026/10/01/poland-budget-vote',
    'https://WWW.News.Example/a/b/?utm_source=x&id=7#frag',
    'https://news.example/ąęść/żółw?q=Kraków',
  ])('%s', async (url) => {
    const ref = await articleRefOf(url);
    expect(ref).toMatch(/^[0-9a-f]{64}$/);
    expect(ref).toBe(serverRef(url));
  });
});

describe('compare set rules (2..8, distinct by canonical identity)', () => {
  it('bounds and de-duplication', () => {
    expect(compareUrls([u(1)])).toBeUndefined();
    expect(compareUrls([u(1), u(2)])).toEqual([u(1), u(2)]);
    expect(compareUrls([1, 2, 3, 4, 5, 6, 7, 8, 9].map(u))).toBeUndefined();
    expect(compareUrls([u(1), `${u(1)}?utm_source=x`])).toBeUndefined();
    expect(compareUrls([u(1), 'javascript:alert(1)'])).toBeUndefined();
    expect(compareUrls([u(1), u(2), u(1)])).toEqual([u(1), u(2)]);
  });

  it('href → arrival round-trip; the arrival is a draft (no q); crafted lists stage nothing', () => {
    const href = askCompareHref([u(1), u(2), u(3)])!;
    const params = new URLSearchParams(href.slice('/ask?'.length));
    expect(params.get('q')).toBeNull();
    expect(params.get('return')).toBe('/');
    expect(dashboardCompareContext(params)).toEqual([u(1), u(2), u(3)]);
    const crafted = new URLSearchParams();
    for (let i = 0; i < 17; i += 1) crafted.append('compare', u(i));
    expect(dashboardCompareContext(crafted)).toBeUndefined();
    expect(
      dashboardCompareContext(new URLSearchParams('compare=' + encodeURIComponent(u(1)))),
    ).toBeUndefined();
  });

  it('the SELECTION reference carries only kind, action and {articleRef, url} pairs', async () => {
    const ref = (await askCompareRef([u(1), u(2)]))!;
    expect(ref).toEqual({
      kind: 'SELECTION',
      action: 'COMPARE',
      stories: [
        { articleRef: serverRef(u(1)), url: u(1) },
        { articleRef: serverRef(u(2)), url: u(2) },
      ],
    });
  });
});

describe('Home — selection is local; the action is a link; nothing runs on Home', () => {
  const stories = [1, 2, 3].map((n) => ({ title: `Story ${n}`, url: u(n) }));

  it('renders a collapsed disclosure with one checkbox per story and no action until 2 are chosen', () => {
    const html = renderToStaticMarkup(createElement(HomeCompare, { stories, language: 'en' }));
    expect(html).toContain('data-home-compare');
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html.match(/type="checkbox"/g)).toHaveLength(3);
    expect(html).toContain('Choose at least 2 stories');
    expect(html).not.toContain('data-home-compare-action');
    const pl = renderToStaticMarkup(createElement(HomeCompare, { stories, language: 'pl' }));
    expect(pl).toContain('Porównaj artykuły');
  });

  it('fewer than two stories: nothing is drawn', () => {
    expect(
      renderToStaticMarkup(
        createElement(HomeCompare, { stories: stories.slice(0, 1), language: 'en' }),
      ),
    ).toBe('');
  });

  it('the island makes no request, writes no browser storage and runs nothing', () => {
    const src = read('components/home/HomeCompare.tsx');
    expect(src).not.toMatch(
      /fetch\(|askV2Api|useAskR2Conversation|useEffect|localStorage|sessionStorage|indexedDB/,
    );
    expect(src).toContain('askCompareHref(');
  });

  it('Home mounts it with title (display) and url only — the cards are untouched', () => {
    const home = read('components/home/WhatsHappeningNow.tsx');
    expect(home).toContain('<HomeCompare');
    expect(home).toContain('rail.map((article) => ({ title: article.title, url: article.url }))');
  });

  it('/ask sends the COMPARE selection (derived on Ask) ahead of a record or story context', () => {
    const screen = read('components/ask-frame/AskFrameScreen.tsx');
    expect(screen).toContain('dashboardCompareContext(new URLSearchParams(urlKey))');
    expect(screen).toContain('await askCompareRef(compareContext)');
    expect(screen).toContain(
      'compareRef ?? moduleContext?.ref ?? askContextRefOf(context, undefined)',
    );
    expect(screen).toContain('data-ask-context-kind="SELECTION"');
  });
});
