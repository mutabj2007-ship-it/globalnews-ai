import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { AnalysisApiResponse, StoryContext } from '@globalnews-ai/shared';
import {
  STORY_TITLE_MAX,
  isTransportableTitle,
  resolveStoryTitle,
  clearStoryContext,
  fullAnalysisHref,
  publishStoryContext,
  peekStoryContextForTest,
  resetStoryContextStoreForTest,
  transportableContext,
} from '@/lib/ask/storyContextStore';
import { buildBriefModel } from '@/components/analysis-frame/briefModel';
import { SPATIAL_FROM, chooseAnchor, type LauncherAnchor } from '@/components/ask/launcherAnchor';
import { fixture } from '@/components/analysis-frame/frameFixtures';

/**
 * ═══ ASK AI REV A — THE CLOSURES, ASSERTED ═══════════════════════════════
 *
 * WHAT THIS FILE IS FOR. Rev A closes three defects and one mobile
 * collision. Two of them (§5 lifecycle, §6 state handling) are BEHAVIOURAL
 * and cannot be caught by reading source strings, so the lifecycle cases
 * below drive the real store rather than grepping for the word "clear".
 *
 * WHERE A SOURCE-STRING ASSERTION IS USED IT IS BECAUSE THE PROPERTY IS
 * STRUCTURAL — "this module has exactly one non-spec importer" is a fact
 * about the repository, not about a render.
 */
const SRC_ROOT = join(__dirname, '..', '..');
const read = (...p: string[]): string => readFileSync(join(SRC_ROOT, ...p), 'utf8');

/** raw source, comments included */
const rawOf = (...p: string[]): string => read(...p);
/**
 * Source with COMMENTS STRIPPED and string literals kept.
 *
 * This distinction is load-bearing and was found by a failing run: these
 * files DISCUSS `AnalysisFrameSurface` and `keyFacts` at length in their
 * doc comments precisely because Rev A rules them out. A naive scan of the
 * raw text reports the prohibition as a violation.
 */
const codeOf = (...p: string[]): string =>
  read(...p)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

const DOCK = 'components/ask/AskAiDock.tsx';
const COMPACT = 'components/ask/AskCompactResult.tsx';
const STORE = 'lib/ask/storyContextStore.ts';
const SEARCH = 'components/search/SearchPageClient.tsx';

/**
 * The `storyContext` memo's own text, comments stripped.
 *
 * SLICED TO THE MEMO'S CLOSING DEPENDENCY LIST, NOT TO
 * `usePublishStoryContext`. The publisher is also IMPORTED at the top of
 * the file, so `indexOf` on its name finds the import — above the memo —
 * and the slice comes out empty. Found by a failing run.
 */
const searchMemo = (): string => {
  const code = codeOf(SEARCH);
  const start = code.indexOf('const storyContext');
  const end = code.indexOf('articleIdParam],', start);
  return code.slice(start, end === -1 ? undefined : end);
};

/* ───────────────────────────── §4 · TRANSPORT ───────────────────────── */

describe('ASK-AI-CONTEXT-1 §4 — the subject survives the transition', () => {
  const ctx: StoryContext = {
    title: 'Sudan: the siege of El Fasher',
    articleId: 'hf-0',
    countryCode: 'SDN',
    url: 'https://example.test/a',
    sourceName: 'Example',
  };

  it('§4.5 — the href carries q, storyTitle, articleId and countryCode, all encoded', () => {
    const href = fullAnalysisHref('what caused it?', ctx);
    const url = new URL(href, 'https://example.test');
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('what caused it?');
    expect(url.searchParams.get('storyTitle')).toBe('Sudan: the siege of El Fasher');
    expect(url.searchParams.get('articleId')).toBe('hf-0');
    expect(url.searchParams.get('countryCode')).toBe('SDN');
    /* encoded, not hand-escaped */
    expect(href).toContain('storyTitle=Sudan%3A+the+siege+of+El+Fasher');
  });

  it('§4.5 — a parameter with no value is OMITTED, never emitted empty or as "undefined"', () => {
    const href = fullAnalysisHref('why?', { title: 'A story', countryCode: 'KEN' });
    expect(href).not.toMatch(/articleId/);
    expect(href).not.toMatch(/undefined/);
    expect(href).not.toMatch(/=(&|$)/);
  });

  it('§4.5 — with no context at all the transition is a plain generic search', () => {
    expect(fullAnalysisHref('who is affected?', undefined)).toBe('/search?q=who+is+affected%3F');
  });

  it('§4.6 — the title is BOUNDED, and the bound omits rather than truncates', () => {
    /*
      A truncated subject is a DIFFERENT subject, so nothing is cut. R2
      corrects what "omit" means: the ANCHOR SET goes with it, because an
      anchor without its subject is paired with the follow-up on arrival.
      The detailed cases are in the R2 finding 3 block below.
    */
    const long = 'x'.repeat(STORY_TITLE_MAX + 1);
    expect(fullAnalysisHref('q', { title: long, articleId: 'a1' })).toBe('/search?q=q');
    expect(fullAnalysisHref('q', { title: 'x'.repeat(STORY_TITLE_MAX), articleId: 'a1' }))
      .toMatch(/storyTitle=x+&articleId=a1/);
  });

  it('§1.1 — only {title, articleId?, countryCode?} is transportable; url and sourceName are dropped', () => {
    expect(transportableContext(ctx)).toEqual({
      title: 'Sudan: the siege of El Fasher',
      articleId: 'hf-0',
      countryCode: 'SDN',
    });
    expect(transportableContext(undefined)).toBeUndefined();
    expect(Object.keys(transportableContext({ title: 'T' }) ?? {})).toEqual(['title']);
  });
});

describe('ASK-AI-CONTEXT-1 §4.2/§4.4 — storyTitle is not an anchor', () => {
  const code = codeOf(SEARCH);

  it('§4.2 — the anchor gate is UNCHANGED: only articleId or countryCode creates a StoryContext', () => {
    /*
      SAME RULE, NEGATED FORM. R2 turned the memo into guard clauses so a
      malformed subject can return before the gate is consulted, so the
      gate reads "neither identifier -> no context" rather than "either
      identifier -> context". `storyTitle` is absent from it either way,
      which is the invariant: a title creates no anchor.
    */
    const memo = searchMemo();
    expect(memo).toMatch(/articleIdParam !== null \|\| countryCodeParam !== null/);
    const gate = memo.slice(memo.indexOf('(articleIdParam !== null'), memo.indexOf('? {'));
    expect(gate).not.toMatch(/storyTitle/);
  });

  it('§4.2 — it only supplies the title of a context that already exists', () => {
    /* R2: the fallback to `query` survives ONLY on the absent branch. */
    expect(code).toMatch(/kind === 'valid' && storyTitleParam !== null\s*\n?\s*\? storyTitleParam\s*\n?\s*: query,/);
    expect(code).not.toMatch(/storyTitle\w*\s*\?\?\s*query/);
  });

  it('§4.4 — a generic /search?q= with no anchor is byte-for-byte unchanged', () => {
    /*
      With neither identifier the memo returns `undefined` and nothing
      else happens — the same expression the baseline evaluated. The dep
      list is still URL primitives only (see the retarget notes in
      `m51PhaseB`, `articleAnchorParity` and `m52aHardening`).
    */
    expect(searchMemo()).toMatch(/:\s*undefined,/);
    expect(code).toMatch(/\[query, storyTitleParam, countryCodeParam, articleIdParam\],/);
  });

  it('§4.6 — the bound lives in ONE place and the page never rewrites the value', () => {
    /*
      R2 moved the conditions into `resolveStoryTitle` so inbound and
      outbound cannot disagree. What this file still guarantees about the
      page is that it does not transform the value at all.
    */
    expect(code).toMatch(/resolveStoryTitle\(storyTitleParam\)/);
    expect(code).not.toMatch(/storyTitleParam\.(slice|substring|replace|toLowerCase|concat|trim)/);
    const store = codeOf(STORE);
    expect(store).toMatch(/param\.length > STORY_TITLE_MAX/);
    expect(store).not.toMatch(/param\.(slice|substring|toLowerCase)/);
  });
});


/* ─────────── R2 FINDING 3 · MALFORMED storyTitle FAILS CLOSED ───────── */

describe('R2 finding 3 — a malformed storyTitle anchors NOTHING and never promotes the follow-up', () => {
  /*
   * THE DEFECT THIS REPLACES WAS MINE, AND IT WAS SUBTLE IN THE WORST
   * WAY. R1 mapped both "absent" and "malformed" to `null` and then
   * wrote `title: storyTitle ?? query`. On a malformed URL the reader
   * therefore got an anchored analysis whose declared SUBJECT was their
   * own follow-up question — the exact inversion Rev A's change log
   * exists to close, reintroduced at the one moment the URL was least
   * trustworthy. It failed OPEN.
   *
   * Absent and malformed are different facts and now take different
   * paths.
   */

  describe('inbound — resolveStoryTitle', () => {
    it('ABSENT is not malformed: no parameter means legacy behaviour', () => {
      expect(resolveStoryTitle(null)).toEqual({ kind: 'absent' });
    });

    it('VALID is carried verbatim — no trim, no normalisation, no truncation', () => {
      const title = '  Sudan: the siege of El Fasher  ';
      expect(resolveStoryTitle(title)).toEqual({ kind: 'valid', title });
      expect(resolveStoryTitle('x'.repeat(STORY_TITLE_MAX)))
        .toEqual({ kind: 'valid', title: 'x'.repeat(STORY_TITLE_MAX) });
    });

    it.each([
      ['empty', ''],
      ['whitespace only', '   '],
      ['tab and newline only', '\t\n '],
    ])('MALFORMED (blank): %s', (_label, value) => {
      expect(resolveStoryTitle(value)).toEqual({ kind: 'malformed', reason: 'blank' });
    });

    it('MALFORMED (over-limit): one character past the bound', () => {
      expect(resolveStoryTitle('x'.repeat(STORY_TITLE_MAX + 1)))
        .toEqual({ kind: 'malformed', reason: 'over-limit' });
    });
  });

  describe('inbound — SearchPageClient suppresses the context entirely', () => {
    const code = codeOf(SEARCH);

    it('the malformed check SHORT-CIRCUITS before the anchor gate, so nothing is built', () => {
      const memo = searchMemo();
      const malformedAt = memo.indexOf("resolveStoryTitle(storyTitleParam).kind !== 'malformed'");
      const gateAt = memo.indexOf('articleIdParam !== null || countryCodeParam !== null');
      expect(malformedAt).toBeGreaterThan(-1);
      expect(gateAt).toBeGreaterThan(-1);
      /*
        ORDER IS THE MECHANISM. `&&` evaluates left to right, so a
        malformed subject never reaches the gate — and the gate itself is
        the accepted one, unchanged, which is why this asserts position
        rather than a rewritten condition.
      */
      expect(malformedAt).toBeLessThan(gateAt);
      expect(memo).toMatch(/kind !== 'malformed' &&\s*\n\s*\(articleIdParam !== null \|\| countryCodeParam !== null\)/);
    });

    it('`storyTitle ?? query` is GONE — the follow-up is never promoted on the malformed path', () => {
      expect(code).not.toMatch(/storyTitle\w*\s*\?\?\s*query/);
      /* `query` is reachable as the subject ONLY from the absent branch */
      expect(code).toMatch(/kind === 'valid' && storyTitleParam !== null\s*\n?\s*\? storyTitleParam\s*\n?\s*: query,/);
    });

    it('and because nothing is built, nothing is published — the same value feeds both', () => {
      expect(code).toMatch(/usePublishStoryContext\(storyContext\);/);
    });
  });

  describe('outbound — fullAnalysisHref emits the anchor set or none of it', () => {
    const anchors = { articleId: 'hf-0', countryCode: 'SDN' };

    it('a transportable subject carries its anchors', () => {
      const url = new URL(fullAnalysisHref('why?', { title: 'A real subject', ...anchors }), 'https://x.test');
      expect(url.searchParams.get('storyTitle')).toBe('A real subject');
      expect(url.searchParams.get('articleId')).toBe('hf-0');
      expect(url.searchParams.get('countryCode')).toBe('SDN');
    });

    it.each([
      ['over-limit', 'x'.repeat(STORY_TITLE_MAX + 1)],
      ['blank', '   '],
      ['empty', ''],
    ])('an untransportable subject (%s) emits NO anchor parameters at all', (_label, title) => {
      /*
        R1 dropped `storyTitle` and kept the anchors, so `/search` paired
        them with the follow-up as subject. Omitting one parameter of a
        set that only means something together is not a safe degradation.
      */
      const href = fullAnalysisHref('why?', { title, ...anchors });
      expect(href).toBe('/search?q=why%3F');
      expect(href).not.toMatch(/storyTitle|articleId|countryCode/);
    });

    it('the two halves cannot drift: the outbound guard asks the inbound resolver', () => {
      expect(isTransportableTitle('A real subject')).toBe(true);
      expect(isTransportableTitle('   ')).toBe(false);
      expect(isTransportableTitle('x'.repeat(STORY_TITLE_MAX + 1))).toBe(false);
      const store = codeOf(STORE);
      expect(store).toMatch(/return resolveStoryTitle\(title\)\.kind === 'valid';/);
    });

    it('round trip: whatever this emits resolves back to VALID on arrival', () => {
      for (const title of ['Sudan: the siege of El Fasher', 'a', 'x'.repeat(STORY_TITLE_MAX)]) {
        const url = new URL(fullAnalysisHref('q', { title, ...anchors }), 'https://x.test');
        expect(resolveStoryTitle(url.searchParams.get('storyTitle')))
          .toEqual({ kind: 'valid', title });
      }
    });
  });
});

/* ──────────────────── §5 · PROVIDER LIFECYCLE (L1–L5) ───────────────── */

describe('ASK-AI-CONTEXT-1 §5 — provider lifecycle, fail closed', () => {
  beforeEach(() => resetStoryContextStoreForTest());
  afterAll(() => resetStoryContextStoreForTest());

  const A: StoryContext = { title: 'Story A', articleId: 'a1', countryCode: 'SDN' };
  const B: StoryContext = { title: 'Story B', articleId: 'b1', countryCode: 'KEN' };

  it('§5.2.4 — the resting state is undefined; nothing initialises to a value', () => {
    expect(peekStoryContextForTest()).toBeUndefined();
    const src = rawOf(STORE);
    expect(src).toMatch(/let current: Entry \| null = null;/);
    /* SSR never leaks one reader's anchor into another reader's markup */
    expect(src).toMatch(/function getServerSnapshot\(\): StoryContext \| undefined \{\s*\n\s*return undefined;/);
  });

  it('§5.2.1 — publishing makes the context readable; republishing the same value is idempotent', () => {
    const token = Symbol('owner');
    publishStoryContext(token, A);
    expect(peekStoryContextForTest()).toEqual(A);
    publishStoryContext(token, { ...A });
    expect(peekStoryContextForTest()).toEqual(A);
  });

  it('L5 — the owning publisher clears its own entry on unmount', () => {
    const token = Symbol('own');
    publishStoryContext(token, A);
    clearStoryContext(token);
    expect(peekStoryContextForTest()).toBeUndefined();
  });

  it('L3 — story A then story B: the anchor is B, and A\u2019s LATE cleanup cannot clear it', () => {
    /*
      THE ORDER HERE IS THE WHOLE TEST. React mounts B's effect BEFORE it
      runs A's cleanup, so a naive `clear()` in cleanup deletes the anchor
      B has already published and the reader silently loses story B's
      context. The ownership token is what makes A's late clear a no-op.
    */
    const tokenA = Symbol('A');
    const tokenB = Symbol('B');
    publishStoryContext(tokenA, A);
    publishStoryContext(tokenB, B);
    clearStoryContext(tokenA);
    expect(peekStoryContextForTest()).toEqual(B);
  });

  it('L1 — after the publisher clears, an Ask carries NO anchor at all', () => {
    const token = Symbol('page');
    publishStoryContext(token, A);
    clearStoryContext(token);
    /* this is exactly what the dock transports on submit */
    expect(transportableContext(peekStoryContextForTest())).toBeUndefined();
  });

  it('L2 — the context-change effect clears when the page\u2019s own context becomes undefined', () => {
    const code = codeOf(STORE);
    /*
      L2 happens on the SAME route — `articleId`/`countryCode` leave the URL
      and no unmount occurs — so an unmount-only cleanup would never fire.
      That is why the publisher runs two effects rather than one.
    */
    expect(code).toMatch(/if \(context === undefined\) \{\s*\n\s*clearStoryContext\(token\);/);
    expect(code).toMatch(/useEffect\(\s*\n?\s*\(\) => \(\) => \{\s*\n\s*clearStoryContext\(token\);/);
  });

  it('L4 — a route with no publisher leaves the context undefined', () => {
    /* structural: the workspace is the ONLY publisher in the product */
    expect(importersOf('usePublishStoryContext')).toEqual(['components/search/SearchPageClient.tsx']);
  });

  it('§5.2.5 — the dock keeps no copy: no state, ref or memo of the context', () => {
    const code = codeOf(DOCK);
    expect(code).toMatch(/const storyContext = useAskStoryContext\(\);/);
    expect(code).not.toMatch(/useState<StoryContext|useRef<StoryContext/);
  });
});

/* ───────────────────────── §2 · RENDER / FRAME ──────────────────────── */

describe('ASK-AI-RENDER-1 §2 — no nested frame, one consumer', () => {
  it('§2.1/§7.6 — the dock neither imports nor renders AnalysisFrameSurface', () => {
    const code = codeOf(DOCK);
    expect(code).not.toMatch(/AnalysisFrameSurface/);
  });

  it('§2.5 — AnalysisFrameSurface has exactly ONE non-spec importer', () => {
    /*
      The invariant was PROSE inside the geometry module, which is why
      breaking it was silent. It is a fact about the repository, so it is
      asserted against the repository.
    */
    expect(importersOf('AnalysisFrameSurface')).toEqual(['components/search/SearchPageClient.tsx']);
  });
});

/* ─────────────────── §6 · COMPACT RESULT / TRUTHFULNESS ─────────────── */

describe('ASK-AI-TRUTHFULNESS-1 §6 — four states, none collapsed', () => {
  const code = codeOf(COMPACT);

  it('§6.1 — nothing is generated: no second call, no dimension concatenation', () => {
    expect(code).not.toMatch(/analyzeNews|fetch\(|axios|XMLHttpRequest/);
    for (const forbidden of ['keyFacts', 'agreements', 'differences', 'join(', 'concat(']) {
      expect(`${forbidden}: ${code.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });

  it('§6.2 — each element comes through the reader Surface B already uses', () => {
    expect(code).toMatch(/AnalysisModeBadge/);
    expect(code).toMatch(/buildBriefModel\(response\)/);
    expect(code).toMatch(/buildBriefTelemetry\(response, null\)/);
    /* the source list is the response's own, not a parallel one */
    expect(code).toMatch(/analysis\?\.sources \?\? \[\]/);
    expect(code).not.toMatch(/sourceEntities|response\.articles/);
  });

  it('§6.2 — an unknown telemetry figure is null, never invented', () => {
    expect(code).toMatch(/buildBriefTelemetry\(response, null\)/);
  });

  it('§6.3 — WITHHELD and ABSENT are different branches with different copy', () => {
    expect(code).toMatch(/data-ask="brief-withheld"/);
    expect(code).toMatch(/data-ask="brief-absent"/);
    expect(code).toMatch(/brief\.briefWithheldReason/);
    /* the withheld reason is rendered verbatim, never re-worded */
    expect(code).not.toMatch(/briefWithheldReason\.(slice|replace|toLowerCase|substring)/);
  });

  it('§6.3 — the withheld/absent distinction exists in the model this reads', () => {
    const withheld = buildBriefModel({
      ...(fixture() as AnalysisApiResponse),
      analysis: {
        ...(fixture() as AnalysisApiResponse).analysis,
        summary: '',
        briefState: {
          availability: 'withheld-non-compliant',
          reason: 'The brief did not meet the structural requirement.',
        },
      },
    } as AnalysisApiResponse);
    expect(withheld.briefWithheld).toBe(true);
    expect(withheld.paragraph).toBe('');

    const absent = buildBriefModel({
      ...(fixture() as AnalysisApiResponse),
      analysis: { ...(fixture() as AnalysisApiResponse).analysis, summary: '' },
    } as AnalysisApiResponse);
    expect(absent.briefWithheld).toBe(false);
    expect(absent.paragraph).toBe('');
  });

  it('§6.3 row 4 — with no analysis there is NO answer body and NO source list', () => {
    const noAnswer = code.slice(code.indexOf('{!hasAnalysis ?'), code.indexOf(') : ('));
    expect(noAnswer).toMatch(/data-ask="no-answer"/);
    expect(noAnswer).not.toMatch(/data-ask="sources"/);
    expect(noAnswer).not.toMatch(/data-ask="brief"/);
  });

  it('§6.4 — the list is bounded BY COUNT and the truncation is DECLARED with figures', () => {
    expect(code).toMatch(/COMPACT_SOURCE_LIMIT/);
    expect(code).toMatch(/data-ask="sources-truncated"/);
    expect(code).toMatch(/\{shown\}/);
    expect(code).toMatch(/\{total\}/);
  });

  it('§6.5 — Open full analysis is the §4.5 transition, as a real link', () => {
    expect(code).toMatch(/data-ask="open-full"/);
    expect(code).toMatch(/href=\{fullAnalysisHref\(question, context\)\}/);
  });

  it('§6.5 — it transitions with the context the QUESTION was asked with', () => {
    const dock = codeOf(DOCK);
    expect(dock).toMatch(/setPhase\(\{ kind: 'answered', question: asked, response, context: sent \}\)/);
    expect(dock).toMatch(/context=\{phase\.context\}/);
  });
});

/* ───────────────── ALPHA-MOBILE-SPATIAL-1C · LAUNCHER ───────────────── */

describe('ALPHA-MOBILE-SPATIAL-1C — the launcher is placed by MEASUREMENT, not by width', () => {
  /*
   * R2 FINDING 2. R1 asserted a width rule — `top-[92px]` below the
   * breakpoint — and the assertion passed while the product was wrong,
   * because the rule itself was wrong: the dock is mounted from the root
   * layout, so one surface's sheet moved the launcher onto every other
   * surface's chrome. What is asserted now is the RULE, its purity, and
   * the fact that desktop cannot be moved by it.
   */

  it('desktop is never measured and never moves', () => {
    for (const width of [SPATIAL_FROM, 1024, 1366, 1440, 1920]) {
      expect(chooseAnchor({ viewportWidth: width, topCollisions: 0, bottomCollisions: 9 }))
        .toBe('bottom');
    }
  });

  it('below the breakpoint the clearer candidate wins, and `bottom` holds ties', () => {
    const at = (topCollisions: number, bottomCollisions: number): LauncherAnchor =>
      chooseAnchor({ viewportWidth: 375, topCollisions, bottomCollisions });
    /* the Map: a sheet with controls along the bottom */
    expect(at(0, 3)).toBe('top');
    /* the Analysis workspace: command bar, badge and the question heading */
    expect(at(3, 0)).toBe('bottom');
    /* neither is clear, or both are: keep the released placement */
    expect(at(0, 0)).toBe('bottom');
    expect(at(2, 2)).toBe('bottom');
    /* a marginally worse bottom is still a reason to move */
    expect(at(1, 2)).toBe('top');
  });

  it('the released placement is the default, so a hook failure degrades to today', () => {
    const raw = rawOf(DOCK);
    const at = raw.indexOf('data-ask="launcher"');
    const from = raw.indexOf('className="', at);
    const classes = raw.slice(from + 'className="'.length, raw.indexOf('"', from + 'className="'.length));
    /* unconditional `bottom-4`, and `spatial:` restores it above the breakpoint */
    expect(classes).toMatch(/(^|\s)bottom-4(\s|$)/);
    expect(classes).toMatch(/\bspatial:bottom-4\b/);
    expect(classes).toMatch(/\bspatial:top-auto\b/);
    /* R1's unconditional top offset is GONE from the class attribute */
    expect(classes).not.toMatch(/\btop-\[92px\]/);
  });

  it('there is no route list — the rule never branches on a pathname', () => {
    /*
      A route list is a second source of truth that goes stale when a
      surface moves its own chrome. `usePathname` is read for TIMING
      only, which this pins by forbidding any comparison against it.
    */
    const hook = codeOf('components/ask/useLauncherAnchor.ts');
    const rule = codeOf('components/ask/launcherAnchor.ts');
    expect(rule).not.toMatch(/pathname|usePathname|'\/map'|"\/map"|'\/search'|"\/search"/);
    expect(hook).not.toMatch(/pathname\s*===|pathname\.(startsWith|includes|match)/);
    expect(hook).toMatch(/const pathname = usePathname\(\);/);
  });

  it('what must not be covered is the Product Owner\u2019s list, as a selector', () => {
    const rule = rawOf('components/ask/launcherAnchor.ts');
    for (const needed of ['nav', 'header', 'h1', 'button', 'a[href]', '[role="navigation"]',
                          '[data-paf="command-bar"]', '[data-gn="mobile-sheet"]']) {
      expect(`${needed}: ${rule.includes(needed)}`).toBe(`${needed}: true`);
    }
  });

  it('the bottom anchor reserves space, scoped and released — it is not the lock that was removed', () => {
    const hook = codeOf('components/ask/useLauncherAnchor.ts');
    expect(hook).toMatch(/body\.style\.paddingBottom/);
    expect(hook).toMatch(/const previous = body\.style\.paddingBottom;/);
    expect(hook).toMatch(/body\.style\.paddingBottom = previous;/);
    /* it must never take the scroll owner away */
    expect(hook).not.toMatch(/style\.overflow/);
  });

  it('the breakpoint is the one the Spatial shell itself switches at', () => {
    const tw = readFileSync(join(SRC_ROOT, '..', 'tailwind.config.ts'), 'utf8');
    expect(tw).toMatch(/spatial: '861px'/);
    expect(SPATIAL_FROM).toBe(861);
  });
});

/* ─────────────────────────────── helpers ────────────────────────────── */

/**
 * Every non-spec file under `src/` that imports `symbol`, as repo-relative
 * paths. Spec files are excluded because a test importing a module is not a
 * product consumer of it.
 */
function importersOf(symbol: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry) || /\.spec\.tsx?$/.test(entry)) continue;
      const text = readFileSync(full, 'utf8');
      const code = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
      const imports = code.match(/^\s*import[\s\S]*?from\s+'[^']+';/gm) ?? [];
      if (imports.some((line) => new RegExp(`\\b${symbol}\\b`).test(line))) {
        found.push(full.slice(SRC_ROOT.length + 1).split(/[\\/]/).join('/'));
      }
    }
  };
  walk(SRC_ROOT);
  return found.sort();
}
