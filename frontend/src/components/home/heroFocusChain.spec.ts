import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * M66.14B — THE FEED -> COUNTRY -> MAP CHAIN.
 *
 * Source contracts, in this suite's established style: the repository has no
 * jsdom, so nothing here renders. What these prove is that the chain is wired
 * to the ONE canonical country relation, that the pointer and keyboard paths
 * are the same action, and that every prohibition the milestone was granted
 * under still holds.
 */

const SRC = join(__dirname, '..', '..');
const read = (relative: string): string => readFileSync(join(SRC, relative), 'utf-8');
const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const provider = codeOnly(read('components/home/HeroFocusProvider.tsx'));
const panel = codeOnly(read('components/home/HeroLiveFeedPanel.tsx'));
const hero = codeOnly(read('components/home/Hero.tsx'));
const field = codeOnly(read('components/home/HeroIntelligenceField.tsx'));
const target = codeOnly(read('lib/heroFocusTarget.ts'));
const page = codeOnly(read('app/page.tsx'));
const trendingCard = codeOnly(read('components/home/TrendingCard.tsx'));

describe('M66.14B — one owner, final architecture from the first commit', () => {
  it('THE CORE RULE — HeroFocusProvider is the only holder of focus state', () => {
    expect(provider).toMatch(/const \[focus, setFocus\] = useState<HeroFocus \| null>\(null\)/);
    // Nobody else keeps a copy: the panel, Hero and the field all read or write
    // through the provider and store nothing of their own.
    expect(panel).not.toMatch(/useState/);
    expect(field).not.toMatch(/useState/);
    expect(hero).not.toMatch(/useState<HeroFocus|setFocus\b/);
  });

  it('wraps BOTH Hero and GlobalDevelopments, so B-2 adds a consumer rather than replacing an architecture', () => {
    expect(page).toMatch(/<HeroFocusProvider[\s\S]*?<Hero [\s\S]*?<GlobalDevelopments[\s\S]*?<\/HeroFocusProvider>/);
  });

  it('preserves the Server Component boundary — the provider renders children it receives as a prop', () => {
    expect(provider).toMatch(/children: ReactNode/);
    expect(provider).toMatch(/\{children\}<\/HeroFocusContext\.Provider>/);
    // page.tsx itself must NOT become a client module.
    expect(read('app/page.tsx').trimStart().startsWith("'use client'")).toBe(false);
  });

  it('exactly one focus state exists — visibility is derived from it, never tracked separately', () => {
    expect(provider).not.toMatch(/isCardOpen|setVisible|showCard|cardVisible/);
  });
});

describe('M66.14B — hover and keyboard focus are the same action', () => {
  it('THE CORE RULE — both handlers invoke the one canonical action with the same article', () => {
    expect(panel).toMatch(/onMouseEnter=\{\(\) => setFocusFromArticle\(item\)\}/);
    expect(panel).toMatch(/onFocus=\{\(\) => setFocusFromArticle\(item\)\}/);
  });

  it('the two handler bodies are IDENTICAL apart from the event name — not merely both present', () => {
    const enter = /onMouseEnter=\{(.*?)\}\r?\n/.exec(panel);
    const focus = /onFocus=\{(.*?)\}\r?\n/.exec(panel);
    expect(enter).not.toBeNull();
    expect(focus).not.toBeNull();
    expect(enter![1]).toBe(focus![1]);
  });

  it('the canonical action is defined ONCE, in the provider, and is deterministic', () => {
    expect(provider).toMatch(/const setFocusFromArticle = useCallback\(\(article: NewsArticle\) => \{/);
    expect((panel.match(/setFocusFromArticle/g) ?? []).length).toBe(3);
    // Nothing time-, random- or order-dependent can enter the focus object.
    expect(provider).not.toMatch(/Date\.now|Math\.random|new Date\(\)/);
  });

  it('M66.14A keyboard behaviour survives — native anchors, Enter, Space and the cyan ring', () => {
    expect(panel).toMatch(/<a\s+href=\{item\.url\}/);
    expect(panel).toMatch(/onKeyDown=\{activateAnchorOnSpace\}/);
    expect(panel).toMatch(/focus-visible:outline-cd-edge-focus/);
    expect(panel).not.toMatch(/role="link"|tabIndex/);
  });
});

describe('M66.14B — pointer-leave persistence and the unresolved-article rule', () => {
  it('THE CORE RULE — nothing resets focus on leave or blur', () => {
    expect(panel).not.toMatch(/onMouseLeave|onPointerLeave|onBlur/);
    expect(trendingCard).not.toMatch(/onMouseLeave|onPointerLeave|onBlur/);
  });

  it('an unresolved article CLEARS the country context instead of leaving the previous one showing', () => {
    // The action always writes. An article with no country writes null, so the
    // map and card cannot keep describing a different article's place.
    expect(provider).toMatch(/countryCode: article\.countryCode \?\? null/);
    expect(provider).toMatch(/countryName: article\.countryName \?\? null/);
    // Not a conditional that would skip the write.
    expect(provider).not.toMatch(/if \(!article\.countryCode\)[\s\S]{0,40}?return;/);
  });

  it('a null country produces a null map target, so the field returns to its idle render', () => {
    expect(hero).toMatch(/focus\?\.countryCode \? countryFocusPoint\(focus\.countryCode\) : null/);
  });
});

describe('M66.14B — the map target is real, country-only, and never moves the viewport', () => {
  it('reuses the existing country geometry and projection — no new geography', () => {
    expect(target).toMatch(/computeFeatureCenter/);
    expect(target).toMatch(/getCountryFeatureCollection/);
    expect(target).toMatch(/COUNTRIES/);
    // No new library, no override table, no invented coordinate.
    expect(target).not.toMatch(/d3-geo|geoCentroid|CENTROID_OVERRIDES/);
    expect(target).not.toMatch(/lat: [0-9-]|lon: [0-9-]/);
  });

  it('COUNTRY PRECISION ONLY — nothing reads or asserts a finer scope', () => {
    for (const [name, source] of [
      ['HeroFocusProvider', provider],
      ['heroFocusTarget', target],
      ['Hero', hero],
      ['HeroLiveFeedPanel', panel],
    ] as Array<[string, string]>) {
      /*
        The lookbehind excludes hyphenated Tailwind tokens: `text-cd-feed-region`
        is a released TYPE-SCALE role, not a geographic claim, and a guard that
        a font-size class can trip is a guard someone deletes. A real claim
        would read `region:`, `article.region` or `regionName`.
      */
      expect({ name, finer: /geographicPrecision|evidencePrecision|(?<!-)\bcity\b|(?<!-)\bregion\b/i.test(source) }).toEqual({
        name,
        finer: false,
      });
    }
  });

  it('THE CORE RULE — the viewBox is still built from constants and cannot be driven by focus', () => {
    expect(field).toMatch(/viewBox=\{`0 0 \$\{VIEWPORT\.width\} \$\{VIEWPORT\.height\}`\}/);
    expect((field.match(/viewBox=/g) ?? [])).toHaveLength(1);
    expect(field).not.toMatch(/onWheel|onPointerDown|onMouseDown|\bzoom\b|panTo/);
  });

  it('the ring stack MOVES rather than multiplying — same base, same multipliers, same marks', () => {
    expect(field).toMatch(/const DECORATIVE_RING_BASE = 14;/);
    expect(field).toMatch(/const focusPoint = focus/);
    // Still exactly ten decorative marks and one ring stack.
    expect((field.match(/\{ lon: /g) ?? [])).toHaveLength(10);
  });

  it('the signal colour comes from the ONE released category vocabulary', () => {
    expect(hero).toMatch(/channel: categoryChannel\(focus\?\.category\)/);
    // The field is handed a channel; it owns no colour table of its own.
    expect(field).not.toMatch(/CATEGORY_CHANNEL/);
  });
});

describe('M66.14B — no progression, no second fetch, no duplicate resolver', () => {
  it('no timer anywhere in the chain can advance a story', () => {
    for (const [name, source] of [
      ['HeroFocusProvider', provider],
      ['HeroLiveFeedPanel', panel],
      ['heroFocusTarget', target],
    ] as Array<[string, string]>) {
      expect({ name, timer: /setInterval|setTimeout|requestAnimationFrame/.test(source) }).toEqual({
        name,
        timer: false,
      });
    }
  });

  it('THE CORE RULE — no new fetch, route or API call was introduced', () => {
    for (const [name, source] of [
      ['HeroFocusProvider', provider],
      ['HeroLiveFeedPanel', panel],
      ['heroFocusTarget', target],
      ['Hero', hero],
    ] as Array<[string, string]>) {
      expect({ name, fetches: /\bfetch\(|axios|useSWR|useQuery|\/api\//.test(source) }).toEqual({
        name,
        fetches: false,
      });
    }
    // page.tsx still makes exactly one feed call.
    expect((page.match(/getHomeFeed\(/g) ?? [])).toHaveLength(1);
  });

  it('no frontend surface re-implements country relevance — the resolution is the backend\u2019s', () => {
    for (const [name, source] of [
      ['HeroFocusProvider', provider],
      ['heroFocusTarget', target],
      ['Hero', hero],
    ] as Array<[string, string]>) {
      expect({ name, resolver: /scoreCountryRelevance|resolvePrimaryCountry|demonym|isRelevant/.test(source) }).toEqual({
        name,
        resolver: false,
      });
    }
  });

  it('B-2 work is genuinely absent — trending does not participate yet', () => {
    expect(trendingCard).not.toMatch(/useHeroFocus|setFocusFromArticle/);
  });
});
