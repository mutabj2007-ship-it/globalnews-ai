import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import type {
  AnalysisApiResponse,
  NewsArticle,
  RelationalEvidenceAssessment,
} from '@globalnews-ai/shared';
import { AnalysisFrameSurface } from './AnalysisFrameSurface';
import { buildRelationalEvidence, assessmentsFor } from './relationalEvidence';
import { fixture } from './frameFixtures';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * R4.2 §9 — RELATIONAL COUNTER-EVIDENCE.
 *
 * THE CRITICAL REGRESSION CASE, required by §9: the fixture below contains
 * an assessment that NO generated claim cites. That is the whole reason the
 * top-level array exists — `relationalComposition` indexes claims, so an
 * uncited assessment has no ClaimReference and is reachable through nothing
 * else. If it stops rendering, the defect this round fixed has returned.
 *
 * Controlled fixture. Shapes mirror the contract exactly:
 * `{ articleId, excerpt, direction }` with `direction` drawn from the six
 * values in `RelationalEvidenceDirection`.
 */
const VP = { width: 1440, height: 900 };

const article = (id: string): NewsArticle =>
  ({
    id, title: `Report ${id}`, summary: `Body ${id}.`, url: `https://o-${id}.test/s`,
    sourceId: `s-${id}`, sourceName: `Outlet ${id}`, category: 'world', sourcesCount: 1,
    publishedAt: '2026-08-20T10:00:00.000Z', sourceLanguage: 'en',
  }) as NewsArticle;

const ARTICLES = [article('a1'), article('a2'), article('a3')];

const A = (
  articleId: string,
  direction: string,
  excerpt: string,
): RelationalEvidenceAssessment => ({ articleId, excerpt, direction }) as RelationalEvidenceAssessment;

/** One of each direction, plus a duplicate and an unmatched articleId. */
const ASSESSMENTS: RelationalEvidenceAssessment[] = [
  A('a1', 'requested-direction', 'EXCERPT_SUPPORTING from the first source.'),
  A('a1', 'reverse-direction', 'EXCERPT_REVERSE contradicting the requested direction.'),
  A('a2', 'association-only', 'EXCERPT_ASSOCIATION observed alongside, not because of.'),
  A('a2', 'unclear', 'EXCERPT_UNCLEAR with no established relationship.'),
  A('a3', 'non-substantive', 'EXCERPT_NONSUBSTANTIVE passing mention.'),
  A('a3', 'bidirectional', 'EXCERPT_BIDIRECTIONAL evidence both ways.'),
  /* Same record referenced twice — must render ONCE. */
  A('a1', 'requested-direction', 'EXCERPT_SUPPORTING from the first source.'),
  /* Names an article that is not in the retrieved set. */
  A('ghost-9', 'reverse-direction', 'EXCERPT_ORPHAN from an article not retrieved.'),
];

const withRelational = (
  assessments: RelationalEvidenceAssessment[] | undefined,
): AnalysisApiResponse => {
  const base = fixture({ articleCount: 0 });
  return {
    ...base,
    articles: ARTICLES,
    analysis:
      base.analysis === null
        ? null
        : {
            ...base.analysis,
            ...(assessments === undefined
              ? {}
              : { relationalEvidenceAssessments: assessments }),
          },
  } as unknown as AnalysisApiResponse;
};

const POPULATED = withRelational(ASSESSMENTS);
const NONE = withRelational(undefined);

/*
 * Rendered through `AnalysisFrameSurface` — the component `/search`
 * actually mounts — rather than `AnalysisFrame` directly. The difference
 * is not cosmetic: the surface is what supplies `onOpenRecord`, so a
 * direct `AnalysisFrame` render has no Complete Record control and a test
 * asserting its presence would fail against a product that has it.
 */
const renderFrame = (response: AnalysisApiResponse, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(AnalysisFrameSurface as never, {
      response, initialViewport: VP, initialDock: 'expanded', ...extra,
    } as never),
  );

/** The dock only, so analysis prose cannot satisfy an assertion. */
/* RETARGETED AT H-ALPHA-VISUAL-1 ITEM A. The invariant is unchanged: the
   relational evidence a response carries must REACH THE READER on the
   reading path — every deduped assessment rendered, none filtered, none
   behind a count that cannot be opened, and unmatched groups shown rather
   than dropped. What moved is the element it renders inside. The reading
   path's miniature dock was rejected by R3; the same `RelationalEvidencePanel`,
   fed by the same `assessmentsFor` lookup, now sits on each image-led
   source card. Asserting the dock markers would assert that the rejected
   presentation is still there. */
const dock = (html: string) => html.slice(html.indexOf('data-paf="sources-reporting"'));

/**
 * One source card, by articleId.
 *
 * The end boundary is the next source card OR the unmatched section,
 * whichever comes first. Without the second bound the LAST card's slice
 * ran on into the unmatched block and picked up the orphan assessment —
 * which made a3 appear to show three assessments instead of two. A helper
 * bug, but the kind that would have hidden a real leak between rows.
 */
const card = (html: string, articleId: string) => {
  const d = dock(html);
  const start = d.indexOf(`data-article-id="${articleId}"`);
  const bounds = [
    d.indexOf('data-paf="source-card-v2"', start + 1),
    d.indexOf('data-paf="relational-unmatched"', start + 1),
  ].filter((i) => i !== -1);
  return d.slice(start, bounds.length === 0 ? undefined : Math.min(...bounds));
};

describe('R4.2 §9.1 — a production-shaped assessment renders', () => {
  it('the excerpt reaches the reader', () => {
    expect(dock(renderFrame(POPULATED))).toContain('EXCERPT_SUPPORTING from the first source.');
  });

  it('it is on the source card itself, not a second list', () => {
    /* RETARGETED: the invariant is "one home, on the source it belongs
       to — never a second parallel list of the same evidence". The home
       was the expanded dock row; it is now the image-led source card. */
    const html = renderFrame(POPULATED);
    expect(html).toContain('data-paf="sources-reporting"');
    expect(card(html, 'a1')).toContain('data-paf="relational-evidence"');
    /* The rejected Original Sources wall does not return. */
    expect(html).not.toMatch(/grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3/);
    /* And the rejected miniature dock is not on the reading path either. */
    expect(html).not.toContain('data-paf="dock-compact"');
  });

  it('every one of the deduped assessments renders — no top-N, no filtering', () => {
    const model = buildRelationalEvidence(POPULATED);
    const html = dock(renderFrame(POPULATED));
    const rendered = (html.match(/data-paf="relational-assessment"/g) ?? []).length;
    expect(rendered).toBe(model.total);
  });
});

describe('R4.2 §9.2 — an assessment no claim cites stays visible (THE CRITICAL CASE)', () => {
  it('the uncited reverse excerpt renders', () => {
    /* Nothing in the fixture's keyFacts references these assessments;
       `relationalComposition` is absent entirely. If visibility depended
       on a claim citing it, this excerpt would vanish. */
    const analysis = POPULATED.analysis as unknown as Record<string, unknown>;
    expect(analysis.relationalComposition).toBeUndefined();
    expect(dock(renderFrame(POPULATED))).toContain('EXCERPT_REVERSE contradicting the requested direction.');
  });

  it('a count the reader cannot open cannot exist: every counted item is rendered', () => {
    const model = buildRelationalEvidence(POPULATED);
    const html = dock(renderFrame(POPULATED));
    const accessible =
      (html.match(/data-paf="relational-assessment"/g) ?? []).length;
    expect(accessible).toBe(model.total);
    expect(model.total).toBe(model.matched.reduce((n, g) => n + g.assessments.length, 0) + model.unmatchedCount);
  });
});

describe('R4.2 §9.3-9.6 — no direction is re-labelled', () => {
  const t = getDictionary('en').analysisFrame;

  it('reverse evidence keeps a reverse label', () => {
    const html = dock(renderFrame(POPULATED));
    expect(html).toContain(t.relationalDirection['reverse-direction']);
    expect(t.relationalDirection['reverse-direction']).toMatch(/REVERSE/i);
  });

  it('association-only is not presented as causation', () => {
    const label = t.relationalDirection['association-only'];
    expect(label).toMatch(/ASSOCIATION/i);
    expect(label).toMatch(/NOT CAUSATION/i);
    expect(dock(renderFrame(POPULATED))).toContain(label);
  });

  it('unclear stays explicitly unclear', () => {
    expect(t.relationalDirection.unclear).toMatch(/UNCLEAR/i);
    expect(dock(renderFrame(POPULATED))).toContain(t.relationalDirection.unclear);
  });

  it('non-substantive remains visible and honestly labelled', () => {
    expect(t.relationalDirection['non-substantive']).toMatch(/NON-SUBSTANTIVE/i);
    const html = dock(renderFrame(POPULATED));
    expect(html).toContain('EXCERPT_NONSUBSTANTIVE passing mention.');
    expect(html).toContain(t.relationalDirection['non-substantive']);
  });

  it('bidirectional is NOT collapsed into requested-direction', () => {
    expect(t.relationalDirection.bidirectional).not.toBe(t.relationalDirection['requested-direction']);
    const html = dock(renderFrame(POPULATED));
    expect(html).toContain('data-direction="bidirectional"');
    expect(html).toContain('data-direction="requested-direction"');
  });

  it('no non-supporting direction is given a generic positive word', () => {
    for (const key of ['reverse-direction', 'association-only', 'unclear', 'non-substantive'] as const) {
      expect(t.relationalDirection[key]).not.toMatch(/\bSUPPORTS?\b|\bSUPPORTING\b|\bCONFIRMS?\b|\bPROVES?\b/i);
    }
  });

  it('the direction shown is the one the response returned, for every record', () => {
    const html = dock(renderFrame(POPULATED));
    for (const a of buildRelationalEvidence(POPULATED).matched.flatMap((g) => g.assessments)) {
      const at = html.indexOf(a.excerpt);
      expect(at).toBeGreaterThan(-1);
      expect(html.slice(Math.max(0, at - 600), at)).toContain(`data-direction="${a.direction}"`);
    }
  });

  it('no category absent from the response is invented', () => {
    const returned = new Set<string>(ASSESSMENTS.map((a) => a.direction));
    const rendered = new Set(
      [...dock(renderFrame(POPULATED)).matchAll(/data-direction="([a-z-]+)"/g)].map((m) => m[1]),
    );
    for (const d of rendered) expect(returned.has(d)).toBe(true);
  });
});

describe('R4.2 §9.7-9.10 — articleId binding', () => {
  it('an assessment binds to the correct source row', () => {
    const html = renderFrame(POPULATED);
    expect(card(html, 'a1')).toContain('EXCERPT_SUPPORTING from the first source.');
    expect(card(html, 'a2')).toContain('EXCERPT_ASSOCIATION observed alongside, not because of.');
  });

  it('one source cannot display another source’s assessment', () => {
    const html = renderFrame(POPULATED);
    expect(card(html, 'a2')).not.toContain('EXCERPT_SUPPORTING from the first source.');
    expect(card(html, 'a1')).not.toContain('EXCERPT_ASSOCIATION observed alongside, not because of.');
    expect(card(html, 'a3')).not.toContain('EXCERPT_REVERSE contradicting the requested direction.');
  });

  it('the lookup is by articleId, and returns nothing for an unknown id', () => {
    const model = buildRelationalEvidence(POPULATED);
    expect(assessmentsFor(model, 'a1').every((a) => a.articleId === 'a1')).toBe(true);
    expect(assessmentsFor(model, 'nope')).toEqual([]);
    /* An unmatched group is never served as if it belonged to a source. */
    expect(assessmentsFor(model, 'ghost-9')).toEqual([]);
  });

  it('a duplicated reference does not duplicate the rendered assessment', () => {
    const html = dock(renderFrame(POPULATED));
    const occurrences = (html.match(/EXCERPT_SUPPORTING from the first source\./g) ?? []).length;
    expect(occurrences).toBe(1);
    expect(buildRelationalEvidence(POPULATED).countsByDirection['requested-direction']).toBe(1);
  });

  it('an unmatched articleId is neither discarded nor given a fabricated source', () => {
    const model = buildRelationalEvidence(POPULATED);
    expect(model.unmatchedCount).toBe(1);
    expect(model.unmatched.map((g) => g.articleId)).toEqual(['ghost-9']);

    const html = dock(renderFrame(POPULATED));
    expect(html).toContain('data-paf="relational-unmatched"');
    expect(html).toContain('EXCERPT_ORPHAN from an article not retrieved.');
    /* No invented publisher, title or link for it. */
    const section = html.slice(html.indexOf('data-paf="relational-unmatched"'));
    expect(section).not.toMatch(/Outlet ghost|https?:\/\/o-ghost/);
    expect(section).toContain('ghost-9');
    /* And it did not silently become a real source card. */
    expect(html).not.toContain('data-article-id="ghost-9" data-highlighted');
  });

  it('source provenance stays visible on every matched row', () => {
    const html = renderFrame(POPULATED);
    for (const id of ['a1', 'a2', 'a3']) {
      const c = card(html, id);
      expect(c).toContain(`Outlet ${id}`);
      expect(c).toMatch(/href="https:\/\/o-/);
    }
  });
});

describe('R4.2 §9.11-9.12 — no new request, no invented empty panel', () => {
  it('nothing in this feature issues a second analysis request', () => {
    for (const f of ['relationalEvidence.ts', 'RelationalEvidencePanel.tsx', 'SourcesDock.tsx']) {
      const src = readFileSync(`${__dirname}/${f}`, 'utf8');
      expect(src).not.toMatch(/analyzeNews\(|\bfetch\s*\(|XMLHttpRequest|EventSource|axios/);
    }
    expect(readFileSync(`${__dirname}/AnalysisFrame.tsx`, 'utf8')).not.toMatch(/analyzeNews\(|\bfetch\s*\(/);
  });

  it('no assessments renders no control, no panel and no zero', () => {
    const html = dock(renderFrame(NONE));
    expect(html).not.toContain('data-paf="relational-evidence"');
    expect(html).not.toContain('data-paf="relational-toggle"');
    expect(html).not.toContain('data-paf="relational-unmatched"');
    const t = getDictionary('en').analysisFrame;
    expect(html).not.toContain(t.relationalHeading);
    expect(html).not.toContain(t.relationalShow);
  });

  it('an empty array is treated exactly like an absent one', () => {
    const empty = buildRelationalEvidence(withRelational([]));
    expect(empty.present).toBe(false);
    expect(empty.total).toBe(0);
    expect(dock(renderFrame(withRelational([])))).not.toContain('data-paf="relational-evidence"');
  });

  it('relational evidence is disclosed on demand, never expanded by default', () => {
    /* RETARGETED: the invariant was that the DEFAULT state does not dump
       every assessment on the reader — the compact dock showed none until
       asked. There is no compact/expanded dock on the reading path any
       more, so the same promise is asserted where it now lives: the
       panel's own disclosure is closed until opened, so no assessment
       body is in the default markup. */
    const compact = renderToStaticMarkup(
      createElement(AnalysisFrameSurface as never, { response: POPULATED, initialViewport: VP } as never),
    );
    expect(compact).toContain('data-paf="sources-reporting"');
    expect(compact).toMatch(/data-paf="relational-evidence"/);
    expect(compact).not.toMatch(/<details[^>]*\bopen\b/);
  });
});

describe('R4.2 §9.13-9.14 — counts and Complete Record', () => {
  it('the disclosure count equals the assessments behind it, per source', () => {
    const model = buildRelationalEvidence(POPULATED);
    const html = renderFrame(POPULATED);
    for (const g of model.matched) {
      const c = card(html, g.articleId);
      const shown = (c.match(/data-paf="relational-assessment"/g) ?? []).length;
      expect({ id: g.articleId, shown }).toEqual({ id: g.articleId, shown: g.assessments.length });
      expect(c).toContain(`>${g.assessments.length}</span>`);
    }
  });

  it('Complete Record remains available', () => {
    expect(renderFrame(POPULATED)).toContain('data-paf="complete-record-entry"');
  });
});

describe('R4.2 §9.15-9.17 — responsive, localized, silent', () => {
  it.each([1440, 1024, 768, 375])('relational evidence survives at %ipx', (width) => {
    const html = dock(
      renderFrame(POPULATED, { initialViewport: { width, height: 800 } }),
    );
    expect(html).toContain('data-paf="relational-evidence"');
    expect(html).toContain('EXCERPT_REVERSE contradicting the requested direction.');
    expect(html).toContain('data-paf="relational-unmatched"');
  });

  it.each(['en', 'pl'] as const)('%s renders its own relational labels', (language) => {
    const t = getDictionary(language).analysisFrame;
    const html = dock(renderFrame(POPULATED, { language }));
    expect(html).toContain(t.relationalShow);
    expect(html).toContain(t.relationalDirection['reverse-direction']);
    expect(html).toContain(t.relationalExcerptVerified);
  });

  it('the two languages actually differ', () => {
    const en = getDictionary('en').analysisFrame;
    const pl = getDictionary('pl').analysisFrame;
    expect(pl.relationalShow).not.toBe(en.relationalShow);
    expect(pl.relationalDirection['reverse-direction']).not.toBe(en.relationalDirection['reverse-direction']);
    expect(Object.keys(pl.relationalDirection).sort()).toEqual(Object.keys(en.relationalDirection).sort());
  });

  it('server rendering stays silent', () => {
    const errors: string[] = [];
    const e = jest.spyOn(console, 'error').mockImplementation((...a) => { errors.push(String(a[0])); });
    const w = jest.spyOn(console, 'warn').mockImplementation((...a) => { errors.push(String(a[0])); });
    try {
      renderToStaticMarkup(createElement(AnalysisFrameSurface as never, { response: POPULATED } as never));
    } finally { e.mockRestore(); w.mockRestore(); }
    expect(errors).toEqual([]);
  });
});

describe('R4.2 §7 — interaction and accessibility', () => {
  it('the disclosure exposes aria-expanded and aria-controls', () => {
    const html = dock(renderFrame(POPULATED));
    expect(html).toMatch(/data-paf="relational-toggle"[^>]*aria-expanded="(true|false)"/);
    expect(html).toMatch(/data-paf="relational-toggle"[^>]*aria-controls="gn-paf-rel-/);
  });

  it('the panel is hidden rather than unmounted, so its content is addressable', () => {
    const html = dock(renderFrame(POPULATED));
    expect(html).toMatch(/data-paf="relational-list"/);
    /* Closed by default — the dock stays compact-by-default in spirit. */
    expect(html).toMatch(/aria-expanded="false"/);
  });

  it('the excerpt is a blockquote, not a paragraph pretending to be prose', () => {
    expect(dock(renderFrame(POPULATED))).toMatch(/<blockquote[^>]*data-paf="relational-excerpt"/);
  });

  it('both confidences are stated on every assessment', () => {
    const t = getDictionary('en').analysisFrame;
    const html = dock(renderFrame(POPULATED));
    const model = buildRelationalEvidence(POPULATED);
    const validations = (html.match(/data-paf="relational-validation"/g) ?? []).length;
    expect(validations).toBe(model.total);
    expect(html).toContain(t.relationalExcerptVerified);
    expect(html).toContain(t.relationalDirectionUnverified);
  });
});

describe('R4.2 — no fixture value reaches production', () => {
  it.each(['relationalEvidence.ts', 'RelationalEvidencePanel.tsx'])(
    '%s contains no fixture excerpt or article id',
    (file: string) => {
      const src = readFileSync(`${__dirname}/${file}`, 'utf8');
      expect(src).not.toMatch(/EXCERPT_|ghost-9|Outlet a\d/);
    },
  );
});
