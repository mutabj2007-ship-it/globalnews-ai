import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import type { AnalysisApiResponse, NewsArticle } from '@globalnews-ai/shared';
import { AnalysisFrameSurface } from './AnalysisFrameSurface';
import { CompleteRecordView } from './CompleteRecordView';
import { hasSourceThumbnail, hideFailedSourceThumbnail } from './SourcesDock';
import { hasArticleImage, hideFailedArticleImage } from './SourcesReporting';
import { fixture } from './frameFixtures';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * SOURCES DOCK — VISIBLE ARTICLE IMAGE.
 *
 * The dock rendered publisher, title, time and geography and never read
 * `article.imageUrl`, although the field arrives intact: the provider
 * sets it, the database keeps it, and `buildSourceSupport` attaches the
 * WHOLE `NewsArticle` to every entry. Nothing was lost; the dock simply
 * did not look.
 *
 * These assertions are measured on RENDERED MARKUP wherever markup can
 * carry the answer. The one thing it cannot carry is the `onError`
 * handler — React attaches that on the client and it never appears in a
 * server render — so that path is driven directly through the exported
 * function instead of being asserted by proxy.
 */

/* ── RETARGETED AT H-ALPHA-VISUAL-1 ITEM A ────────────────────────────
   THE INVARIANT IS UNCHANGED AND IS THE WHOLE POINT OF THIS FILE: only
   the retained article's OWN `imageUrl` is ever rendered, every source
   gets exactly one treatment (real image or striped fallback, never both
   and never neither), the stripes live on the wrapper so the failure path
   is free, and no stock photograph is substituted.

   What changed is the element the contract is asserted on. R3 rejected
   the 48px/56px dock thumbnail as the reading presentation, so the slot
   is now `source-image-frame` inside `SourcesReporting.tsx`, and the
   handler is `hideFailedArticleImage`. The dock keeps its own thumbnail
   under the Complete Analysis Record and is asserted there.
   ─────────────────────────────────────────────────────────────────── */
const VP = { width: 1440, height: 900 } as const;

const SENTINEL = 'https://cdn.example-evidence.test/SENTINEL-source-thumb.jpg';

/** The two substitution paths this lane forbids, named so they can be excluded. */
const STOCK_PLACEHOLDER = '/images/article-placeholder.jpg';

function withImages(response: AnalysisApiResponse, count: number): AnalysisApiResponse {
  return {
    ...response,
    articles: response.articles.map((article, i) =>
      i < count ? ({ ...article, imageUrl: `${SENTINEL}?i=${i}` } as NewsArticle) : article,
    ),
  } as AnalysisApiResponse;
}

const render = (response: AnalysisApiResponse, extra: Record<string, unknown> = {}): string =>
  renderToStaticMarkup(
    createElement(AnalysisFrameSurface as never, {
      response,
      initialViewport: VP,
      ...extra,
    } as never),
  );

const NO_IMAGES = fixture();
const ALL_IMAGES = withImages(fixture(), 5);
const MIXED = withImages(fixture(), 2);

/**
 * The dock's own source, with comments removed.
 *
 * Every source-text assertion below reads THIS rather than the raw file.
 * The comments in `SourcesDock.tsx` necessarily name the very things
 * those assertions forbid — `LocationImage`, "remote placeholder
 * service" — because they record WHY those are excluded. Matching the
 * prose instead of the code is a failure this lane has already paid for
 * once; the fix is to assert on code.
 */
const dockCode = (): string =>
  readFileSync(`${__dirname}/SourcesDock.tsx`, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const imgTags = (html: string): string[] => [...html.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
const thumbs = (html: string): string[] =>
  [...html.matchAll(/data-paf="source-image-frame"[^>]*>/g)].map((m) => m[0]);

describe('1 & 2 — a real imageUrl reaches BOTH dock states', () => {
  it('the expanded dock renders the article image at its real URL', () => {
    const html = render(ALL_IMAGES, { initialDock: 'expanded' });
    expect(html).toContain(`${SENTINEL}?i=0`);
    expect(imgTags(html).some((tag) => tag.includes(`${SENTINEL}?i=0`))).toBe(true);
  });

  it('the COMPACT dock renders it too — the default state, with no user action', () => {
    const html = render(ALL_IMAGES);
    expect(html).toContain('data-paf="sources-reporting"');
    expect(html).toContain(`${SENTINEL}?i=0`);
  });

  it('every source with an image gets one, in both states', () => {
    for (const dock of ['compact', 'expanded'] as const) {
      const html = render(ALL_IMAGES, { initialDock: dock });
      const present = thumbs(html).filter((t) => t.includes('data-has-image="true"'));
      expect({ dock, present: present.length }).toEqual({ dock, present: 5 });
    }
  });
});

describe('3 & 4 — a record with no image renders the striped panel and no <img>', () => {
  it('no <img> is emitted for a source that has no imageUrl', () => {
    const html = render(NO_IMAGES, { initialDock: 'expanded' });
    const dockImages = imgTags(html).filter((tag) => tag.includes('object-cover'));
    expect(dockImages).toEqual([]);
  });

  it('the thumbnail slot still exists, marked as carrying no image', () => {
    const html = render(NO_IMAGES, { initialDock: 'expanded' });
    expect(thumbs(html).length).toBe(5);
    expect(thumbs(html).every((t) => t.includes('data-has-image="false"'))).toBe(true);
  });

  it('the striped placeholder is the visible fallback', () => {
    const html = render(NO_IMAGES);
    expect(html).toMatch(/repeating-linear-gradient/);
  });

  it('the stripes are on the WRAPPER, present even when an image IS shown', () => {
    /* This is what makes the broken-image path free: nothing is swapped
       in, the failed <img> is merely hidden and the stripes are already
       underneath it. */
    const html = render(ALL_IMAGES, { initialDock: 'expanded' });
    const withStripes = thumbs(html).filter((t) => t.includes('repeating-linear-gradient'));
    expect(withStripes.length).toBe(5);
  });

  it('a MIXED response gets exactly one treatment per record — never both, never neither', () => {
    const html = render(MIXED, { initialDock: 'expanded' });
    const all = thumbs(html);
    expect(all.length).toBe(5);
    expect(all.filter((t) => t.includes('data-has-image="true"')).length).toBe(2);
    expect(all.filter((t) => t.includes('data-has-image="false"')).length).toBe(3);
  });
});

describe('5 — nothing is ever substituted for a missing article image', () => {
  it.each(['compact', 'expanded'] as const)('%s — no shipped stock photograph', (dock) => {
    const html = render(NO_IMAGES, { initialDock: dock });
    expect(html).not.toContain(STOCK_PLACEHOLDER);
    expect(html).not.toMatch(/\/images\/[a-z-]+\.jpg/);
  });

  it('the location asset map is never consulted by the dock', () => {
    expect(dockCode()).not.toMatch(/locationAssets|resolveLocationImage|LocationImage/);
    expect(dockCode()).not.toContain(STOCK_PLACEHOLDER);
  });

  it('no remote placeholder service is reachable from this file', () => {
    expect(dockCode()).not.toMatch(/placehold|unsplash|picsum|via\.placeholder|dummyimage/i);
  });

  it('SafeImage is NOT used — its error path substitutes the stock photograph', () => {
    expect(dockCode()).not.toMatch(/SafeImage|next\/image/);
  });
});

describe('6 — no empty, undefined or null src ever reaches the DOM', () => {
  it.each(['compact', 'expanded'] as const)('%s — with images', (dock) => {
    for (const tag of imgTags(render(ALL_IMAGES, { initialDock: dock }))) {
      expect(tag).not.toMatch(/src=""/);
      expect(tag).not.toMatch(/src="undefined"/);
      expect(tag).not.toMatch(/src="null"/);
    }
  });

  it.each(['compact', 'expanded'] as const)('%s — without images', (dock) => {
    const html = render(NO_IMAGES, { initialDock: dock });
    expect(html).not.toMatch(/src=""/);
    expect(html).not.toMatch(/src="undefined"/);
    expect(html).not.toMatch(/src="null"/);
  });

  it('the guard function agrees with the render, including the empty string', () => {
    const base = fixture().articles[0];
    expect(hasSourceThumbnail(base)).toBe(false);
    expect(hasSourceThumbnail({ ...base, imageUrl: '' } as NewsArticle)).toBe(false);
    expect(hasSourceThumbnail({ ...base, imageUrl: SENTINEL } as NewsArticle)).toBe(true);
  });

  it('an empty-string imageUrl renders the placeholder, not an empty src', () => {
    const empty = {
      ...fixture(),
      articles: fixture().articles.map((a) => ({ ...a, imageUrl: '' }) as NewsArticle),
    } as AnalysisApiResponse;
    const html = render(empty, { initialDock: 'expanded' });
    expect(html).not.toMatch(/src=""/);
    expect(thumbs(html).every((t) => t.includes('data-has-image="false"'))).toBe(true);
  });
});

describe('7 & 11 — counts are bounded by the response, never invented', () => {
  it.each(['compact', 'expanded'] as const)('%s — thumbnails never exceed the source count', (dock) => {
    for (const articleCount of [0, 1, 3, 5, 9]) {
      const html = render(withImages(fixture({ articleCount }), articleCount), { initialDock: dock });
      expect({ dock, articleCount, thumbs: thumbs(html).length })
        .toEqual({ dock, articleCount, thumbs: articleCount });
    }
  });

  it('the section count is the response count, never a fixed number', () => {
    /* RETARGETED AT H-ALPHA-VISUAL-1 ITEM A: same invariant — the number
       beside the label is `sources.length` and tracks the response — read
       from the reading path's own label instead of the dock's. */
    for (const articleCount of [1, 3, 5, 9]) {
      const html = render(withImages(fixture({ articleCount }), articleCount));
      const t = getDictionary('en').analysisFrame;
      expect(html).toContain(`${t.sourcesReporting.replace('&', '&amp;')} · ${articleCount}`);
    }
  });

  it('an empty response renders no thumbnail and no image at all', () => {
    const html = render(fixture({ articleCount: 0 }));
    expect(thumbs(html)).toEqual([]);
    expect(imgTags(html).filter((tag) => tag.includes('object-cover'))).toEqual([]);
  });
});

describe('8 — everything the card carried before is still on it', () => {
  it.each(['compact', 'expanded'] as const)('%s — publisher, title, timestamp, language, geography', (dock) => {
    const response = withImages(fixture({ countryName: 'Rwanda' }), 5);
    const html = render(response, { initialDock: dock });
    const article = response.articles[0];
    for (const [what, text] of [
      ['publisher', article.sourceName],
      ['title', article.title],
      ['language', (article.sourceLanguage ?? '').toUpperCase()],
    ] as const) {
      expect({ dock, what, present: html.includes(text) }).toEqual({ dock, what, present: true });
    }
    /* An age is rendered rather than a raw ISO timestamp. */
    expect({ dock, age: /\bAGO\b/i.test(html) }).toEqual({ dock, age: true });
  });

  /*
    RETARGETED AT H-ALPHA-VISUAL-1 ITEM A, AND DECLARED TO THE CTO.
    Per-source geography was a DOCK feature. R3's card carries image,
    headline, publisher, timing, language and an open control — geography
    is not among them, and the frame already devotes a whole rail to
    Evidence Geography. So the per-source statement did not disappear: it
    followed the dock into the Complete Analysis Record, and these two
    assertions follow it there rather than being deleted. Both still
    prove the same things: every source carries the element, and an
    UNRESOLVED country is labelled rather than left silent.
  */
  const forensic = (response: AnalysisApiResponse) =>
    renderToStaticMarkup(
      createElement(CompleteRecordView as never, {
        response,
        language: 'en',
        onBack: () => undefined,
      } as never),
    );

  it('forensic dock — the geography element and its resolved flag survive', () => {
    const html = forensic(withImages(fixture(), 5));
    expect(html).toContain('data-paf="source-geography"');
    expect((html.match(/data-paf="source-geography"/g) ?? []).length).toBe(5);
  });

  it('forensic dock — an UNRESOLVED country is still labelled, not hidden behind the image', () => {
    const html = forensic(fixture({ precision: 'unresolved' }));
    expect(html).toContain(getDictionary('en').analysisFrame.sourceGeographyAbsent);
  });

  it('the relational panel still renders inside the expanded card, after the text', () => {
    /* `fixture({ relational: true })` seeds `relationalComposition`, which
       is a different field and renders no per-source panel. The panel is
       driven by `relationalEvidenceAssessments`, so it is seeded here the
       same way `r42RelationalEvidence.spec.ts` seeds it. */
    const base = withImages(fixture(), 5);
    const seeded = {
      ...base,
      analysis: {
        ...base.analysis,
        relationalEvidenceAssessments: [
          {
            articleId: base.articles[0].id,
            direction: 'reverse-direction',
            excerpt: 'EXCERPT_REVERSE contradicting the requested direction.',
          },
        ],
      },
    } as unknown as AnalysisApiResponse;

    const html = render(seeded, { initialDock: 'expanded' });
    const card = html.slice(html.indexOf('data-paf="source-card-v2"'));
    const thumb = card.indexOf('data-paf="source-image-frame"');
    const panel = card.indexOf('data-paf="relational-assessment"');
    expect({ thumb: thumb > -1, panel: panel > -1 }).toEqual({ thumb: true, panel: true });
    expect(thumb).toBeLessThan(panel);
  });
});

describe('9 — Seen / Zauważono observational provenance survives in both languages', () => {
  const observed = (): AnalysisApiResponse => {
    const base = withImages(fixture(), 5);
    return {
      ...base,
      articles: base.articles.map(
        (a) => ({ ...a, publishedAtBasis: 'observed' }) as NewsArticle,
      ),
    } as AnalysisApiResponse;
  };

  it.each(['compact', 'expanded'] as const)('%s — English says Seen', (dock) => {
    const html = render(observed(), { language: 'en', initialDock: dock });
    expect({ dock, seen: /\bSEEN\b/i.test(html) }).toEqual({ dock, seen: true });
  });

  it.each(['compact', 'expanded'] as const)('%s — Polish says Zauważono', (dock) => {
    const html = render(observed(), { language: 'pl', initialDock: dock });
    expect({ dock, seen: /ZAUWA/i.test(html) }).toEqual({ dock, seen: true });
  });

  it('a publisher-asserted time is NOT relabelled as observed', () => {
    const publisher = {
      ...withImages(fixture(), 5),
      articles: withImages(fixture(), 5).articles.map(
        (a) => ({ ...a, publishedAtBasis: 'publisher' }) as NewsArticle,
      ),
    } as AnalysisApiResponse;
    expect(/\bSEEN\b/i.test(render(publisher, { language: 'en' }))).toBe(false);
  });

  it('the two languages still differ once images are present', () => {
    expect(render(ALL_IMAGES, { language: 'en' })).not.toBe(render(ALL_IMAGES, { language: 'pl' }));
  });
});

describe('10 — no new navigation target was introduced', () => {
  it('the expanded card still contains exactly one anchor, the existing source link', () => {
    const html = render(ALL_IMAGES, { initialDock: 'expanded' });
    const ul = html.slice(html.indexOf('data-paf="source-card-v2"'));
    const cards = ul.split('data-paf="source-card-v2"').slice(1);
    for (const card of cards) {
      const body = card.slice(0, card.indexOf('</article>'));
      expect((body.match(/<a\s/g) ?? []).length).toBe(1);
      expect(body).toContain('rel="noopener noreferrer"');
    }
  });

  it('the card is not itself a link, and offers exactly one labelled way out', () => {
    /* RETARGETED AT H-ALPHA-VISUAL-1 ITEM A. The invariant was that a
       source card is not a giant invisible hit area with hidden
       navigation. R3 now REQUIRES "a clear action to inspect/open
       source", so the assertion becomes the sharper form of the same
       promise: the <article> is not an anchor, and it contains exactly
       ONE anchor — the visible, labelled control. */
    const html = render(ALL_IMAGES);
    const row = html.slice(html.indexOf('data-paf="sources-reporting-track"'));
    const cards = row.split('data-paf="source-card-v2"').slice(1);
    expect(cards.length).toBe(5);
    for (const card of cards) {
      const body = card.slice(0, card.indexOf('</article>'));
      expect((body.match(/<a\s/g) ?? []).length).toBe(1);
      expect(body).toContain('data-paf="source-open"');
      expect(body).toContain('rel="noopener noreferrer"');
    }
    /* the card element itself is an <article>, never an <a> */
    /* `<a` also prefixes `<article`, so the whitespace is load-bearing. */
    expect(row).not.toMatch(/<a\s[^>]*data-paf="source-card-v2"/);
  });

  it('the thumbnail is not itself a link or a button in this file', () => {
    const code = dockCode();
    const thumb = code.slice(
      code.indexOf('function SourceThumbnail'),
      code.indexOf('export interface SourcesDockProps'),
    );
    expect(thumb).not.toMatch(/<a\s|<button|onClick|router|href=/);
  });

  it('the thumbnail is decorative, so it is hidden from assistive technology', () => {
    const html = render(ALL_IMAGES, { initialDock: 'expanded' });
    expect(thumbs(html).every((t) => t.includes('aria-hidden="true"'))).toBe(true);
    for (const tag of imgTags(html).filter((x) => x.includes('object-cover'))) {
      expect(tag).toMatch(/alt=""/);
    }
  });
});

describe('THE onError PATH — driven directly, because markup cannot carry it', () => {
  it('the handler hides the failed image so the striped wrapper shows through', () => {
    const style: Record<string, string> = {};
    hideFailedSourceThumbnail({ currentTarget: { style } } as never);
    expect(style.display).toBe('none');
  });

  it('it is stateless — no per-card React state was introduced', () => {
    expect(dockCode()).not.toMatch(/useState|useReducer|useRef\(/);
  });

  it('the rendered <img> is actually wired to that handler', () => {
    /* React does not serialise event handlers, so this is asserted on the
       call site rather than on the markup — the one assertion in this
       file that has no rendered counterpart, and it is labelled as such
       rather than dressed up as a behavioural check. */
    expect(dockCode()).toMatch(/onError=\{hideFailedSourceThumbnail\}/);
  });
});

describe('12 — MUTATION CONTROL: this suite fails if the binding is severed', () => {
  it('the dock reads the article record, not a constant', () => {
    expect(dockCode()).toMatch(/src=\{article\.imageUrl\}/);
    expect(dockCode()).toMatch(/article\.imageUrl === 'string' && article\.imageUrl\.length > 0/);
  });

  it('the guard is not vacuous — a response with no images produces no image markup', () => {
    /* Without this control, every positive assertion above could be
       satisfied by a page that happened to contain the sentinel. */
    const html = render(NO_IMAGES, { initialDock: 'expanded' });
    expect(html).not.toContain(SENTINEL);
    expect(imgTags(html).filter((tag) => tag.includes('object-cover'))).toEqual([]);
  });

  it('the geometry constants were not touched to make room', () => {
    const geometry = readFileSync(`${__dirname}/frameGeometry.ts`, 'utf8');
    expect(geometry).toMatch(/DOCK_COMPACT_NORMAL = 168/);
    expect(geometry).toMatch(/DOCK_COMPACT_COMPRESSED = 128/);
  });
});
