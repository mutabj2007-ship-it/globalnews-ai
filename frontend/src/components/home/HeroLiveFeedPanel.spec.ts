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
    expect(source).toMatch(/const FEED_PANEL_COUNT = 8/);
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

  it('implements GN-CD-073’s scroll region at its released max-height', () => {
    expect(source).toMatch(/max-h-cd-304 flex-1 overflow-y-auto overflow-x-hidden/);
    expect((themeExtend.spacing as unknown as Record<string, string>)['cd-304']).toBe('304px');
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
