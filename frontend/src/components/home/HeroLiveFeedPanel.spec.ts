import { readFileSync } from 'fs';
import { join } from 'path';
import tailwindConfig from '../../../tailwind.config';

/**
 * `theme` on a Tailwind `Config` is optional and loosely typed, so released
 * values are read through the same narrowed view M66.2's headerSourcePort.spec
 * established rather than by indexing an optional chain.
 */
type ThemeExtend = Record<string, Record<string, unknown>>;
const themeExtend = (tailwindConfig.theme?.extend ?? {}) as unknown as ThemeExtend;

const source = readFileSync(join(__dirname, 'HeroLiveFeedPanel.tsx'), 'utf-8');
const heroSource = readFileSync(join(__dirname, 'Hero.tsx'), 'utf-8');

/*
  STEP 5A - the country vocabulary must exist in BOTH dictionaries, not merely
  be referenced by the component. `Dictionary = typeof en` already makes a
  missing Polish key a compile error; this reads the files so the contract is
  also visible in the suite that owns the panel.
*/
const enDictionary = readFileSync(join(__dirname, '..', '..', 'lib', 'i18n', 'dictionaries', 'en.ts'), 'utf-8');
const plDictionary = readFileSync(join(__dirname, '..', '..', 'lib', 'i18n', 'dictionaries', 'pl.ts'), 'utf-8');


/** M66.2's helper: every negative guard runs against comment-stripped source. */
const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const code = codeOnly(source);

/**
 * M66.3 — GN-CD-070 → GN-CD-076.
 *
 * This panel was extracted from Hero.tsx so the released construction is
 * reviewable on its own. The contracts below fall into three groups: the
 * released presentation, the real-data guarantees the repository already had
 * and must keep, and the prototype claims that must never appear because no
 * backend supplies them.
 */

describe('HeroLiveFeedPanel — real data, zero new fetch', () => {
  it('consumes only the NewsArticle[] Hero hands it', () => {
    expect(source).toMatch(/articles: NewsArticle\[\]/);
    expect(source).toMatch(/language: LanguageCode/);
    expect(heroSource).toMatch(/articles=\{latestArticles\}/);
  });

  it('introduces no fetch, no client boundary, no effect and no timer', () => {
    expect(code).not.toMatch(/fetch\(/);
    expect(code).not.toMatch(/'use client'/);
    expect(code).not.toMatch(/useEffect|useState|useRef|setInterval|setTimeout/);
  });

  it('renders only real NewsArticle fields', () => {
    expect(source).toMatch(/item\.url/);
    expect(source).toMatch(/item\.title/);
    expect(source).toMatch(/item\.category/);
    expect(source).toMatch(/formatRelativeTime\(item\.publishedAt, language\)/);
    expect(source).toMatch(/key=\{item\.id\}/);
  });

  it('bounds the panel at the released row count and never pads a short feed (CTO decision L-4A)', () => {
    /*
      CONVERTED UNDER CTO-APPROVED STEP 4: 8 -> 12. This raises what the stream
      may CARRY, never what is simultaneously visible — the Hero's height
      decides that, and has since 045e017. The twelve come from the same single
      getHomeFeed() response; `latestUpdates` already held all twelve and eight
      were being dropped.
    */
    expect(source).toMatch(/const FEED_PANEL_COUNT = 12/);
    expect(source).toMatch(/articles\.slice\(0, FEED_PANEL_COUNT\)/);
    // No fill, no placeholder, no repeat.
    expect(code).not.toMatch(/Array\.from|new Array|\.concat\(|padEnd/);
  });

  it('takes every string from the dictionary — no hardcoded English prototype chrome', () => {
    expect(source).toMatch(/getDictionary\(language\)\.hero/);
    for (const key of [
      't.feedPanelEyebrow',
      't.feedPanelHeading',
      't.feedPanelViewMap',
      't.feedPanelUnavailableHeading',
      't.feedPanelUnavailableBody',
      't.feedPanelUnavailableFooter',
      't.feedPanelSearchStatus',
      't.feedPanelCountryStatus',
      't.feedPanelMapStatus',
      't.feedPanelAvailable',
    ]) {
      expect(source).toContain(key);
    }
    expect(code).not.toMatch(/GLOBAL INTELLIGENCE|LIVE FEED|VIEW WORLD MAP/);
  });
});

describe('HeroLiveFeedPanel — GN-CD-070 → 076 released presentation', () => {
  it('is a REGION of the hero surface, not a card: no border and no radius of its own (GN-CD §U.4)', () => {
    const rootMatch = source.match(/<div className=\{`([^`]*)\$\{className\}`\}>/);
    expect(rootMatch).not.toBeNull();
    const root = rootMatch![1];
    expect(root).toContain('bg-cd-fill-feed');
    expect(root).toContain('overflow-hidden');
    expect(root).not.toMatch(/rounded-/);
    expect(root).not.toMatch(/\bborder\b/);
    expect((themeExtend.colors.cd as Record<string, string>)['fill-feed']).toBe('rgba(4,8,16,0.90)');
  });

  it('builds GN-CD-071 as a masked rotating conic PLANE, not a border animation — the exact mistake ERRATUM-004 warns against', () => {
    expect(source).toMatch(/h-cd-1100 w-cd-1100/);
    expect(source).toMatch(/-ml-cd-550 -mt-cd-550/);
    expect(source).toMatch(/bg-cd-sweep\b/);
    expect(source).toMatch(/inset-\[1\.5px\] bg-cd-sweep-mask/);
    expect(source).toMatch(/shadow-cd-sweep-glow/);
    expect(source).toMatch(/animate-cd-feed-sweep/);
    expect((themeExtend.animation as unknown as Record<string, string>)['cd-feed-sweep']).toBe('cd-spin 6.5s linear infinite');
    const spacing = themeExtend.spacing as unknown as Record<string, string>;
    expect(spacing['cd-1100']).toBe('1100px');
    expect(spacing['cd-550']).toBe('550px');
    // A border animation would look like this. It must not.
    expect(code).not.toMatch(/animate-\w*border|border-.*animate/);
  });

  it('carries GN-CD-072’s two-tone header, its amber rule and its released type roles', () => {
    expect(source).toMatch(/border-b border-cd-edge-amber px-cd-16 pb-cd-10 pt-cd-15/);
    expect(source).toMatch(/text-cd-mono-feed uppercase text-cd-ink-label/);
    expect(source).toMatch(/text-cd-mono-panel uppercase text-cd-ink-attention/);
    expect(source).toMatch(/animate-cd-amber-text/);
    expect(source).toMatch(/animate-cd-amber-dot h-cd-7 w-cd-7/);
    const fontSize = themeExtend.fontSize as unknown as Record<string, [string, Record<string, string>]>;
    expect(fontSize['cd-mono-feed'][0]).toBe('12px');
    expect(fontSize['cd-mono-feed'][1].letterSpacing).toBe('0.16em');
    expect(fontSize['cd-mono-panel'][0]).toBe('11.5px');
  });

  /*
    CONVERTED UNDER CTO DECISION F-4 / STEP 3 — AND IT NOW PROVES MORE.

    This block required the scroll region to carry `max-h-cd-304`. That cap was
    the defect: the panel root is a grid item under `cd-hero:items-stretch`, so
    it already fills the Hero column, and `flex-1` already asked the list to do
    the same — but a 304px max-height overrode it while `mt-auto` held VIEW
    WORLD MAP at the foot. The remainder fell out as dead space between the last
    row and the footer, growing 1:1 with the Hero: measured at 19px on the 428px
    frame floor, 111px at 520 and 191px at 600.

    The contract is now BEHAVIOURAL rather than a number, which is why it needs
    no re-tuning if the Hero's height ever changes.
  */
  it('GN-CD-073’s scroll region FILLS its column and scrolls internally — no height cap', () => {
    /* `[scrollbar-gutter:stable]` appended under the scrollbar-stability
       ruling: the gutter is reserved so the 15px bar cannot change the content
       width as rows arrive. Every class this assertion was written to protect —
       min-h-0, flex-1, overflow-y-auto — is still required, in order. */
    expect(source).toMatch(
      /<ul className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden \[scrollbar-gutter:stable\]">/,
    );

    /*
      min-h-0 IS LOAD-BEARING, NOT DECORATION. A flex item defaults to
      `min-height: auto`, so without it the rendered rows would push the panel —
      and with it the whole Hero grid row — taller instead of scrolling. Losing
      this one class silently reintroduces exactly what Step 3 was told not to
      do: expand the Hero.
    */
    const list = /<ul className="([^"]*)">/.exec(source);
    expect(list).not.toBeNull();
    expect(list![1].split(' ')).toEqual(
      expect.arrayContaining(['min-h-0', 'flex-1', 'overflow-y-auto', 'overflow-x-hidden']),
    );

    // No height cap of any kind may return to the list.
    expect(list![1]).not.toMatch(/max-h-/);
    expect(list![1]).not.toMatch(/\bh-\[|\bh-cd-/);

    /*
      THE THREE PARTS THAT MAKE THE GEOMETRY WORK, HELD TOGETHER:
      a clipped full-height root, a growing scroll region, and a footer pinned
      to the foot. Any one of them alone is not the contract.
    */
    expect(source).toMatch(/<div className=\{`relative flex-col overflow-hidden bg-cd-fill-feed h-0 min-h-full \$\{className\}`\}>/);
    expect(source).toMatch(/relative mt-auto flex items-center/);

    /*
      The released token is deliberately LEFT IN tailwind.config.ts — removing an
      unused released token is a separate decision (CTO, Step 3). Asserted so
      that neither the token's removal nor its silent reuse passes unnoticed.
    */
    expect((themeExtend.spacing as unknown as Record<string, string>)['cd-304']).toBe('304px');
    expect(source).not.toMatch(/cd-304/);
  });

  it('STEP 3 IS GEOMETRY ONLY — content depth and the row contract are unchanged', () => {
    // Step 3 held this at 8 and deferred 8 -> 12 to Step 4, which has now
    // authorized it. What Step 3 actually protects is that the count never
    // reaches the Hero's height — asserted below and in the geometry test.
    expect(source).toMatch(/const FEED_PANEL_COUNT = 12/);
    expect(source).toMatch(/articles\.slice\(0, FEED_PANEL_COUNT\)/);
    // And no second retrieval was introduced to fill the taller region.
    expect(source).not.toMatch(/\bfetch\(|axios|useSWR|useQuery|\/api\//);
  });

  /*
    STEP 3 CORRECTION — THE PANEL MAY NOT SIZE THE HERO.

    Browser acceptance caught what the source contract above could not: removing
    the list's cap let the panel's CONTENT set the Hero's auto-sized grid row.
    Eight rows measured 612px, the panel 717px, and the panel overtook column 1
    as the tallest grid item — so GLOBAL DEVELOPMENTS was pushed down the page.

    These guard the fix as a PAIR, because either class alone is broken:
      h-0 alone       -> the panel collapses to nothing.
      min-h-full alone -> content still sizes the row; the defect returns.
  */
  it('STEP 3 CORRECTION — the panel contributes NO height to the Hero row, then fills it', () => {
    const root = /className=\{`([^`]*) \$\{className\}`\}/.exec(source);

    expect(root).not.toBeNull();

    const classes = root![1].split(' ');

    // Both halves must be present — see the pair note above.
    expect(classes).toEqual(expect.arrayContaining(['h-0', 'min-h-full']));

    /*
      AND NEITHER MAY CARRY A BREAKPOINT PREFIX. This file owns no layout
      decision of its own; Hero supplies `hidden cd-hero:flex`. That separation
      is asserted elsewhere in this suite over the whole source, and repeated
      here against the root specifically so the fix cannot be the thing that
      breaks it.
    */
    expect(classes).not.toContain('cd-hero:h-0');
    expect(classes).not.toContain('cd-hero:min-h-full');

    /*
      NO MAGIC NUMBER MAY COME BACK. The visible row count must follow the Hero's
      own height, not a hardcoded cap — measured 7 rows at the Hero's natural
      height and 4 at the cd-hero-frame floor, with the rest reachable by scroll.
    */
    const list = /<ul className="([^"]*)">/.exec(source);
    expect(list![1]).not.toMatch(/max-h-|h-\[|h-cd-/);
    expect(list![1]).toMatch(/min-h-0/);

    // And nothing was truncated to make the layout fit.
    expect(source).toMatch(/const FEED_PANEL_COUNT = 12/);
  });

  it('STEP 3 CORRECTION — the Hero still mounts the panel exactly as before', () => {
    // The correction lives entirely in the panel. Hero.tsx is untouched, so the
    // desktop-only gate and the grid it sits in are unchanged.
    expect(heroSource).toMatch(/className="hidden cd-hero:flex"/);
    expect(heroSource).toMatch(/cd-hero:grid-cols-\[minmax\(0,470px\)_minmax\(0,1fr\)_312px\]/);
    expect(heroSource).toMatch(/cd-hero:min-h-cd-hero-frame/);
  });

  it('implements GN-CD-074’s row geometry and type', () => {
    expect(source).toMatch(/grid grid-cols-\[36px_1fr\] gap-cd-10 border-b border-cd-edge-divider px-cd-16 py-cd-11/);
    expect(source).toMatch(/hover:bg-cd-hud-sky-07/);
    expect(source).toMatch(/text-cd-feed-time text-cd-ink-meta/);
    expect(source).toMatch(/text-cd-row-head text-cd-ink-primary/);
    expect(source).toMatch(/text-cd-feed-region text-cd-ink-muted/);
    const fontSize = themeExtend.fontSize as unknown as Record<string, [string, Record<string, string>]>;
    expect(fontSize['cd-row-head'][0]).toBe('13.5px');
    expect(fontSize['cd-row-head'][1].fontWeight).toBe('600');
    expect(fontSize['cd-feed-region'][0]).toBe('11.5px');
    expect(fontSize['cd-feed-time'][0]).toBe('11px');
    expect((themeExtend.colors.cd as Record<string, string>)['edge-divider']).toBe('rgba(56,189,248,0.08)');
  });

  it('emits GN-CD-074’s 13s / 2.1s / 20%-duty scan as a FORMULA, per GN-CD-304 §V', () => {
    // M66.14C — 13s now lives on the released utility (tailwind.config.ts), the
    // 2.1s stagger stays the per-row formula. Both halves asserted.
    expect(source).toMatch(/animate-cd-row-amber/);
    expect(source).toMatch(/animationDelay: `\$\{\(index \* 2\.1\)\.toFixed\(1\)\}s`/);
    // Not a hand-written delay list, which would silently break if the row
    // count ever changed.
    expect(code).not.toMatch(/0\.0s|2\.1s infinite'|\['0', '2\.1'/);
  });

  it('implements GN-CD-076’s footer action with its rule, circle and arrow', () => {
    expect(source).toMatch(/border-t border-cd-edge-amber-rule px-cd-16 py-cd-14/);
    expect(source).toMatch(/text-cd-mono-feed-action uppercase text-cd-ink-label/);
    expect(source).toMatch(/h-cd-16 w-cd-16 shrink-0 rounded-full border border-cd-accent-sky/);
    expect(source).toMatch(/&rarr;/);
  });

  it('owns no layout decision of its own — Hero supplies the breakpoint gate', () => {
    expect(source).toMatch(/className\?: string/);
    expect(code).not.toMatch(/cd-hero:/);
    expect(heroSource).toMatch(/className="hidden cd-hero:flex"/);
  });
});

describe('HeroLiveFeedPanel — honest states and keyboard reach', () => {
  it('keeps the panel present with zero articles, as a ternary rather than a && short-circuit', () => {
    expect(source).toMatch(/hasArticles \? \(/);
    expect(code).not.toMatch(/hasArticles && \(\s*<ul/);
    expect(source).toMatch(/\{t\.feedPanelUnavailableHeading\}/);
    expect(source).toMatch(/\{t\.feedPanelUnavailableBody\}/);
  });

  it('never fabricates a headline or a timestamp in the unavailable state', () => {
    const fallback = source.slice(
      source.indexOf('feedPanelUnavailableHeading'),
      source.indexOf('feedPanelViewMap'),
    );
    expect(fallback).not.toMatch(/formatRelativeTime/);
    expect(fallback).not.toMatch(/item\./);
    expect(fallback).not.toMatch(/Date|toLocale/);
  });

  it('lists the real subsystems that genuinely remain available — the evidence-backed empty state, preserved from the pre-M66.3 Hero', () => {
    expect(source).toMatch(
      /\[t\.feedPanelSearchStatus, t\.feedPanelCountryStatus, t\.feedPanelMapStatus\]\.map/,
    );
    expect(source).toMatch(/\{t\.feedPanelAvailable\}/);
  });

  it('gates the amber attention dot on REAL LIVE STATUS, not on whether articles happen to exist', () => {
    // M66.13 — RE-AIMED, NOT REMOVED.
    //
    // This test used to assert `{hasArticles && (` and its title claimed that
    // gate meant "a live cue is never shown over an unavailable feed". That was
    // half true: it correctly suppressed the cue over an EMPTY feed and left it
    // running over a MOCK one, because MockNewsProvider supplies articles and
    // `hasArticles` cannot tell sample content from live reporting.
    //
    // The gate was right in shape and wrong in variable. It now reads the
    // authoritative statusKey, so the rule the original test was reaching for —
    // the amber cue is a live claim and appears only when the data is live —
    // holds for every state rather than only the empty one.
    expect(source).toMatch(/const isLiveFeed = statusKey === 'live';/);
    expect(source).toMatch(/\{isLiveFeed && \(/);
    // And articles.length can never become a liveness proxy again.
    expect(code).not.toMatch(/hasArticles && \(\s*<span[^>]*animate-cd-amber-dot/);
  });

  it('makes every row and the footer a REAL link — GN-CD-074 DEFECT-005 and GN-CD-076 DEFECT-006 report the prototype’s are not keyboard-reachable', () => {
    expect(source).toMatch(/<a\s+href=\{item\.url\}/);
    expect(source).toMatch(/target="_blank"/);
    expect(source).toMatch(/rel="noopener noreferrer"/);
    expect(source).toMatch(/<a\s+href="\/map"/);
    // No role/tabIndex simulation of a link on a non-interactive element.
    expect(code).not.toMatch(/role="link"|role="button"|tabIndex/);
  });

  it('marks every decorative element aria-hidden and none of the content', () => {
    expect(source).toMatch(/aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden"/);
    const hidden = (code.match(/aria-hidden="true"/g) ?? []).length;
    expect(hidden).toBeGreaterThanOrEqual(4);
    expect(code).not.toMatch(/aria-hidden="true"[^>]*>\{item\./);
  });
});

describe('HeroLiveFeedPanel — prototype claims that must never appear (CTO decision L-8)', () => {
  it('renders no critical flag, no red panel item and no titleColor branch', () => {
    expect(code).not.toMatch(/crit\b|critical/i);
    expect(code).not.toMatch(/titleColor/);
    expect(code).not.toMatch(/cd-ink-critical|#fca5a5/);
    // GN-CD-307 §W: the panel itself never turns red either.
    expect(code).not.toMatch(/bg-cd-red|text-cd-red\b/);
  });

  it('renders no source count, evidence scope or geolocation', () => {
    expect(code).not.toMatch(/SOURCES|EVIDENCE|lat\b|lon\b|scope/i);
  });

  /*
    M66.14B — RE-AIMED, NOT REMOVED, AND HERE IS EXACTLY WHY.

    This test forbade onMouseEnter, and its stated reason was that row-hover
    map focus 'would need a signal-to-article join that does not exist'. That
    reason has expired: ArticleCountry is a canonical persisted join, it is now
    exposed on NewsArticle, and the interaction is CTO-authorized.

    The rule the original was protecting has NOT expired — the panel must not
    invent geography of its own. So the guard now forbids the panel deriving,
    computing or storing a place, while permitting it to hand the article it
    was given to the one canonical focus action. It is a stricter statement of
    the same intent, not a weaker one.
  */
  it('hands the article to the canonical focus action and derives no geography of its own', () => {
    // Both paths call the SAME provider action with the SAME article.
    expect(code).toMatch(/onMouseEnter=\{\(\) => setFocusFromArticle\(item\)\}/);
    expect(code).toMatch(/onFocus=\{\(\) => setFocusFromArticle\(item\)\}/);
    // It computes no place, projects no point and stores no selection.
    expect(code).not.toMatch(/focusMap|spotForArticle|projectPoint|computeFeatureCenter|countryFocusPoint/);
    expect(code).not.toMatch(/useState|latitude|longitude|centroid/);
    // And it still never resets on leave.
    expect(code).not.toMatch(/onMouseLeave|onPointerLeave|onBlur/);
  });

  it('reproduces none of GN-CD-074’s eight prototype headlines', () => {
    for (const headline of [
      'Climate accord update',
      'Market volatility spikes',
      'Severe weather alert',
      'Tech breakthrough',
      'Health report update',
      'Corridor talks confirmed',
      'Energy pricing review',
      'Export data revised',
    ]) {
      expect(code).not.toContain(headline);
    }
  });
});

/*
  M66.14A — THE KEYBOARD CONTRACT, COMPLETED.

  GN-CD-M66.14 reports the design prototype's feed rows and footer action as
  DEFECT-051 and DEFECT-052: pointer-only <div>s with no role, tabIndex, key
  handler or focus style. Neither defect exists in this repository — M66.3 built
  both as real anchors (asserted above), so Tab and Enter have always worked.

  Two halves of the contract were genuinely missing, and these tests hold them:

    1. a VISIBLE focus treatment. Focus was reaching the rows and painting
       nothing, so focus was strictly weaker than hover.
    2. SPACE activation. A native anchor does not activate on Space — the
       browser scrolls instead — and §9 prescribes Space as an activation key.

  These are behavioural assertions, not a restatement of the class string: each
  one names the property that must hold and would fail if the property were
  removed, which is what makes them regression protection rather than a mirror.
*/
describe('HeroLiveFeedPanel — M66.14A keyboard contract', () => {
  it('gives every row and the footer action a VISIBLE focus treatment, so focus is never weaker than hover', () => {
    // One shared fragment, so the two surfaces cannot drift apart.
    expect(code).toMatch(/const FOCUS_RING =/);
    // M66.14C — anchored on the grid template rather than the START of the class
    // list, because the row now also carries the released animate-cd-row-amber
    // utility. The contract is that the row template ends with FOCUS_RING.
    const rowAnchor = /className=\{`[^`]*grid-cols-\[36px_1fr\][^`]*\$\{FOCUS_RING\}`\}/;
    const footerAnchor = /className=\{`relative mt-auto flex items-center[^`]*\$\{FOCUS_RING\}`\}/;
    expect(code).toMatch(rowAnchor);
    expect(code).toMatch(footerAnchor);
  });

  it('reuses the ONE canonical focus colour and introduces no second one', () => {
    expect(code).toMatch(/focus-visible:outline-cd-edge-focus/);
    // The released token, and the exact value GN-CD-M66.14 §9 prescribes.
    // `edge-*` keys are NESTED under colors.cd, unlike the flat `fill-*` group.
    const cd = themeExtend.colors.cd as Record<string, string>;
    expect(cd['edge-focus']).toBe('rgba(34,211,238,0.70)');
    // No literal focus colour anywhere in the panel.
    expect(code).not.toMatch(/focus-visible:outline-\[/);
    expect(code).not.toMatch(/outline-color/i);
  });

  it('offsets the outline INWARD, because an outward ring would be cropped by the clipped panel', () => {
    expect(code).toMatch(/focus-visible:outline-offset-\[-2px\]/);
    // Not the +2px used by surfaces that are not full-bleed inside a clip.
    expect(code).not.toMatch(/focus-visible:outline-offset-2\b/);
  });

  it('repeats the hover wash on focus, so a keyboard user sees at least what a pointer user sees', () => {
    expect(code).toMatch(/focus-visible:bg-cd-hud-sky-07/);
    expect(code).toMatch(/hover:bg-cd-hud-sky-07/);
  });

  it('uses focus-visible, never focus, so a pointer click never paints a ring', () => {
    expect(code).not.toMatch(/[^-]\bfocus:(?!visible)/);
  });

  it('activates on Space, and does so on the anchors themselves — never on document or window', () => {
    expect(code).toMatch(/function activateAnchorOnSpace\(event: KeyboardEvent<HTMLAnchorElement>\): void \{/);
    expect(code).toMatch(/event\.key !== ' ' && event\.key !== 'Spacebar'/);
    expect(code).toMatch(/event\.preventDefault\(\);/);
    expect(code).toMatch(/event\.currentTarget\.click\(\);/);
    // Attached to both anchors, and to exactly those.
    expect((code.match(/onKeyDown=\{activateAnchorOnSpace\}/g) ?? []).length).toBe(2);
    // No global listener of any kind.
    expect(code).not.toMatch(/document\.addEventListener|window\.addEventListener/);
  });

  it('leaves Enter entirely alone — the handler returns before touching any other key', () => {
    const handler = /function activateAnchorOnSpace[\s\S]*?\n\}/.exec(code);
    expect(handler).not.toBeNull();
    expect(handler![0]).not.toMatch(/'Enter'/);
  });

  it('ignores held keys and descendant targets, so Space cannot open a burst of tabs or fire from a child', () => {
    expect(code).toMatch(/if \(event\.repeat\) return;/);
    expect(code).toMatch(/if \(event\.target !== event\.currentTarget\) return;/);
  });

  it('changes no article URL and no navigation provenance — Space presses the SAME link', () => {
    // .click() on the anchor keeps href/target/rel authoritative.
    expect(code).not.toMatch(/window\.open|location\.(href|assign|replace)|router\.(push|replace)/);
    expect(source).toMatch(/<a\s+href=\{item\.url\}/);
    expect(source).toMatch(/target="_blank"/);
    expect(source).toMatch(/rel="noopener noreferrer"/);
  });

  it('adds no role, no tabIndex and no synthetic element — the anchors stay native and so does DOM order', () => {
    expect(code).not.toMatch(/role="link"|role="button"|tabIndex/);
    expect(code).not.toMatch(/<button/);
    // The rows are still list items in source order; nothing reorders them.
    expect(code).not.toMatch(/\.sort\(|\.reverse\(/);
  });
});


/*
  STEP 5A - COUNTRY-SPECIFIC LIVE INTELLIGENCE. `LIVE \u00b7 <COUNTRY>`.

  WHAT STEP 5A IS. The panel names the country the reader is currently focused
  on, and states in words how much of the current global stream genuinely
  belongs to that country. That is a FOCUS-CONTEXT claim, not a provenance
  claim about the rows.

  WHAT STEP 5A DELIBERATELY IS NOT, and why each is asserted below rather than
  merely intended:

    - it does not FILTER. The homepage carries twelve current stories in total
      and country resolution spreads them across many distinct countries, so a
      filtered panel would usually show one row - the story already under the
      pointer - and would reopen the empty band checkpoint 045e017 closed;
    - it does not REORDER. The rows themselves set focus on hover, so moving
      them would slide the hovered row out from under the pointer and fire the
      next row's handler. Order stability is correctness here, not taste;
    - it does not FETCH. Nothing is retrieved, and the homepage's single-request
      architecture is untouched;
    - it never claims LIVE over non-live data.
*/
describe('HeroLiveFeedPanel - STEP 5A country focus context', () => {
  it('reads the focused country from the CANONICAL provider and derives no geography of its own', () => {
    expect(code).toMatch(/const \{ focus, setFocusFromArticle \} = useHeroFocus\(\);/);
    // Still no place computed here: the country arrives already resolved.
    expect(code).not.toMatch(/countryFocusPoint|computeFeatureCenter|projectPoint|latitude|longitude|centroid/);
    // And still no state, effect, timer or request of any kind.
    expect(code).not.toMatch(/useEffect|useState|useRef|setInterval|setTimeout/);
    expect(code).not.toMatch(/fetch\(/);
    expect(code).not.toMatch(/'use client'/);
  });

  it('A/C - a resolved country qualifies the heading in the APPROVED SHORT FORM, and an unresolved one falls back to the released heading', () => {
    /*
      One expression with exactly two branches, so there is no third state in
      which a country could linger. `focusCountryLabel === null` is the same
      null that an unresolved article produces, which is what makes B and C
      structural rather than coincidental.
    */
    expect(code).toMatch(
      /const focusHeading =\s*focusCountryLabel === null \? null : `\$\{t\.feedPanelFocusLive\} \\u00b7 \$\{focusCountryLabel\}`;/,
    );
    // The SHORT form: the released long heading is never composed with a country.
    expect(code).not.toMatch(/feedPanelHeading\}[^\n]*focusCountryLabel/);
    expect(source).toMatch(/\{focusHeading === null \? statusHeading : focusHeading\}/);
    /*
      statusHeading is left INTACT as the provenance value and is still what
      renders in the global state, so feedProvenance.spec.ts's released
      assertion keeps protecting the same property and needed no conversion.
    */
    expect(code).toMatch(/const statusHeading =/);
  });

  it('B - the country context is one derivation from focus, so nothing can retain a previous country', () => {
    /*
      focus is a single nullable object the provider rewrites on every
      interaction. The panel holds no copy of it - asserted by the absence of
      state above - so an article with no countryCode yields null here on the
      SAME render that clears the map reticle. There is nowhere for a previous
      country to survive.
    */
    expect(code).toMatch(/const focusCountryCode = isLiveFeed \? \(focus\?\.countryCode \?\? null\) : null;/);
    expect(code).toMatch(/focusCountryCode !== null && focus\?\.countryName/);
    // No fallback, no default, no last-known value.
    expect(code).not.toMatch(/previousCountry|lastCountry|\|\| 'U|countryCode \?\? '/);
  });

  it('F - the qualifier is gated on REAL LIVE STATUS, so DEMO, CACHED or UNAVAILABLE can never render as LIVE followed by a country', () => {
    // isLiveFeed is the same gate the pulsing amber dot already uses.
    expect(code).toMatch(/const isLiveFeed = statusKey === 'live';/);
    expect(code).toMatch(/const focusCountryCode = isLiveFeed \?/);
    /*
      And the fallback in every non-live state is the released provenance
      heading itself, unchanged - not a country-qualified variant of it.
    */
    expect(code).toMatch(/focusHeading === null \? statusHeading : focusHeading/);
  });

  it('D - the match line states a REAL count, and says so explicitly when the count is zero', () => {
    expect(code).toMatch(/const focusMatchLine =/);
    expect(code).toMatch(/focusMatchCount === 0/);
    expect(code).toMatch(/\$\{t\.feedPanelFocusNone\} \$\{focusCountryLabel\}/);
    expect(code).toMatch(/\$\{focusMatchCount\} \$\{t\.feedPanelFocusOf\}/);
    // The zero branch renders the line rather than hiding it.
    expect(source).toMatch(/\{focusMatchLine !== null && \(/);
    expect(source).toMatch(/\{focusMatchLine\}/);
  });

  it('D - the total in the match line is what the panel actually shows, never a padded or invented figure', () => {
    expect(code).toMatch(/pluralWithForms\(\s*rows\.length,/);
    expect(code).not.toMatch(/FEED_PANEL_COUNT\}| 12 stories|totalStories = 12/);
  });

  it('E - a row is marked ONLY when its OWN countryCode matches, so no row geography is inferred or guessed', () => {
    expect(code).toMatch(/rows\.filter\(\(item\) => item\.countryCode === focusCountryCode\)\.length/);
    expect(code).toMatch(/focusCountryCode !== null && item\.countryCode === focusCountryCode \?/);
    /*
      An article with no countryCode is never marked: `undefined === 'US'` is
      false, and there is no ?? fallback anywhere near the comparison that
      could turn absence into a match.
    */
    expect(code).not.toMatch(/item\.countryCode \?\?|item\.countryName ===|sourceName|item\.url\.includes/);
  });

  it('E - the row marker is TEXT, so a match is never carried by colour alone', () => {
    expect(source).toMatch(/<span className="text-cd-ink-attention">\{` \\u00b7 \$\{focusCountryLabel\}`\}<\/span>/);
  });

  it('THE CRITICAL SEMANTIC RULE - the rows are neither filtered, reordered nor refetched', () => {
    // The rendered list is still the released slice, in released order.
    expect(code).toMatch(/const rows = articles\.slice\(0, FEED_PANEL_COUNT\);/);
    expect(source).toMatch(/\{rows\.map\(\(item, index\) => \(/);
    // articles is never filtered, sorted or reversed for RENDERING.
    expect(code).not.toMatch(/articles\.filter\(|articles\.sort\(|articles\.reverse\(/);
    expect(code).not.toMatch(/\.sort\(|\.reverse\(/);
    /*
      The one .filter in the file counts matches for the match line. It is not
      used to build the list: rows is assigned once, from the slice.
    */
    expect((code.match(/\.filter\(/g) ?? [])).toHaveLength(1);
    expect((code.match(/const rows = /g) ?? [])).toHaveLength(1);
  });

  it('LOCALIZATION - the country name goes through the ONE canonical resolver, never printed raw and never re-implemented', () => {
    expect(code).toMatch(/import \{ getCountryDisplayName \} from '@\/lib\/countryDisplayName';/);
    expect(code).toMatch(/getCountryDisplayName\(focusCountryCode, language, focus\.countryName\)/);
    // No second Intl.DisplayNames, and the canonical English name is never rendered directly.
    expect(code).not.toMatch(/Intl\.DisplayNames/);
    expect(source).not.toMatch(/\{focus\.countryName\}|\{focus\?\.countryName\}/);
  });

  it('LOCALIZATION - every new string comes from the dictionary, in BOTH languages', () => {
    for (const key of ['t.feedPanelFocusLive', 't.feedPanelFocusOf', 't.feedPanelFocusStoryForms', 't.feedPanelFocusNone']) {
      expect(source).toContain(key);
    }
    for (const key of ['feedPanelFocusLive', 'feedPanelFocusOf', 'feedPanelFocusStoryForms', 'feedPanelFocusNone']) {
      expect(enDictionary).toContain(`${key}:`);
      expect(plDictionary).toContain(`${key}:`);
    }
    // Polish grammar comes from the shared helper, not from a second rule here.
    expect(code).toMatch(/import \{ pluralWithForms \} from '@\/lib\/i18n\/pluralize';/);
    expect(code).not.toMatch(/endsWith\('s'\)|count === 1 \?/);
    // And no English chrome is hardcoded - the released guard, restated for the new strings.
    expect(code).not.toMatch(/LIVE \\u00b7|'Live'|current stories|resolve to/);
  });
});
