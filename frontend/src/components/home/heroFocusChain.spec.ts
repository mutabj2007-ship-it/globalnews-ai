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

  /*
    CONVERTED UNDER CTO DECISION F-1, NOT WEAKENED. This block used to assert
    that the locator took the focused article's CATEGORY channel. F-1 makes the
    colour semantics selection-based instead: cyan/blue is ambient intelligence,
    amber is the CURRENT SELECTION. The property the old assertion protected —
    the field owns no category colour table — is kept verbatim below.
  */
  it('F-1 — the locator is the released amber, and the field still owns no category table', () => {
    // The caller hands the field a PLACE and nothing else.
    expect(hero).toMatch(/const fieldFocus = focusCountryPoint\s*\r?\n?\s*\? \{ lon: focusCountryPoint\[0\], lat: focusCountryPoint\[1\] \}/);
    expect(hero).not.toMatch(/channel: categoryChannel/);
    expect(hero).not.toMatch(/categoryChannel/);

    // The field owns the selected-intelligence colour, as a single constant.
    expect(field).toMatch(/const FOCUS_LOCATOR_COLOR = '#fbbf24';/);
    expect(field).toMatch(/const focusColor = focus \? FOCUS_LOCATOR_COLOR : FOCUS_MARK\.color;/);
    // Still no category colour table here, and no second focal colour.
    expect(field).not.toMatch(/CATEGORY_CHANNEL/);
    expect((field.match(/FOCUS_LOCATOR_COLOR = /g) ?? [])).toHaveLength(1);
  });

  it('F-1 — AMBER MEANS SELECTED: the ambient field keeps its released cyan/blue', () => {
    /*
      The ten decorative marks and the lattice are ambient intelligence and must
      not adopt the focal colour. Asserted by counting: #fbbf24 appears exactly
      once in this file — the locator constant — and never inside the mark table.
    */
    expect((field.match(/#fbbf24/g) ?? [])).toHaveLength(1);
    const markTable = /const DECORATIVE_MARKS[\s\S]*?\];/.exec(field);
    expect(markTable).not.toBeNull();
    expect(markTable![0]).not.toMatch(/#fbbf24/);
  });

  /*
    G2 — THE SELECTED-LOCATION TARGET.

    CTO decision: the selected article's location must be unmistakable, and must
    not resemble an ambient signal. Colour alone could not deliver that — the
    released DECORATIVE_MARKS table already holds three #fb923c marks, one of
    which IS the idle FOCUS_MARK, and #fbbf24 shares its whole red channel. So
    the target is separated by FORM: axis ticks standing off the point, which no
    ambient mark draws. These guards hold it to every part of that decision.
  */
  it('G2 — the reticle exists, is built from ticks, and is drawn in the ONE released amber', () => {
    expect(field).toMatch(/const RETICLE_GAP = \d+;/);
    expect(field).toMatch(/const RETICLE_REACH = \d+;/);
    expect(field).toMatch(/const RETICLE_TICKS: Array<\[number, number\]>/);
    // Ticks are <line>s, and they take the SAME single amber constant — the
    // reticle may not introduce a second focal colour.
    expect(field).toMatch(/RETICLE_TICKS\.map\(/);
    expect(field).toMatch(/stroke=\{FOCUS_LOCATOR_COLOR\}/);
    expect((field.match(/#fbbf24/g) ?? [])).toHaveLength(1);
  });

  it('G2 — the reticle renders ONLY when geography resolved', () => {
    // Gated on `focus`, which Hero sets only from a resolved country centroid.
    expect(field).toMatch(/\{focus \? \(/);
    // And the gate closes: there is an explicit null branch, not a bare &&
    // that could leak a falsy value into the SVG.
    expect(field).toMatch(/\) : null\}/);
  });

  it('G2 — every reticle coordinate derives from focusPoint, so it MOVES with focus and invents nothing', () => {
    const reticle = /RETICLE_TICKS\.map\(([\s\S]*?)\)\)\}/.exec(field);
    expect(reticle).not.toBeNull();
    for (const axis of ['x1=', 'y1=', 'x2=', 'y2=']) {
      expect({ axis, anchored: reticle![1].includes(axis) }).toEqual({ axis, anchored: true });
    }
    expect(reticle![1]).toMatch(/focusPoint\[0\]/);
    expect(reticle![1]).toMatch(/focusPoint\[1\]/);
    // No literal coordinate anywhere in the reticle — nothing is placed by hand.
    expect(reticle![1]).not.toMatch(/lon|lat/);
    expect(field).not.toMatch(/\[0, 0\]/);
  });

  it('G2 — the reticle STANDS OFF the point, so it claims no precision finer than the country', () => {
    const gap = Number(/const RETICLE_GAP = (\d+);/.exec(field)?.[1]);
    const reach = Number(/const RETICLE_REACH = (\d+);/.exec(field)?.[1]);
    // A gap, not a spike: the ticks start away from the centroid.
    expect(gap).toBeGreaterThan(0);
    expect(reach).toBeGreaterThan(gap);
    // And they clear the largest ambient mark halo (r=8), so the reticle reads
    // as a bracket around a REGION rather than a pin on a pixel.
    expect(gap).toBeGreaterThan(8);
    // Four ticks, on the two axes, none of them a fabricated diagonal offset.
    const table = /const RETICLE_TICKS: Array<\[number, number\]> = \[([\s\S]*?)\];/.exec(field);
    expect(table).not.toBeNull();
    const pairs = (table![1].match(/\[-?\d+, -?\d+\]/g) ?? []);
    expect(pairs).toHaveLength(4);
    expect(new Set(pairs).size).toBe(4);
  });

  it('G2 — FORM, NOT ONLY COLOUR: the ambient marks draw no ticks of their own', () => {
    // The decorative nodes are halo / ring / core circles. If a future change
    // gave them ticks too, the selected target would stop being unmistakable.
    const markRender = /\{marks\.map\(([\s\S]*?)\}\)\}/.exec(field);
    expect(markRender).not.toBeNull();
    expect(markRender![1]).not.toMatch(/RETICLE|<line/);
  });

  it('F-1 — UNRESOLVED GEOGRAPHY DRAWS NO LOCATOR', () => {
    /*
      The whole point of the rule. A focused article whose country did not
      resolve yields focusCountryPoint === null, so fieldFocus is null, so the
      emphasis stays on the released decorative mark in its released colour.
      No amber ring is ever drawn for a story whose location is unknown, and no
      coordinate is synthesised to put one somewhere.
    */
    expect(hero).toMatch(/const focusCountryPoint = focus\?\.countryCode \? countryFocusPoint\(focus\.countryCode\) : null;/);
    expect(hero).toMatch(/: null;/);
    // The field's fallback is the DECORATIVE mark, never a fabricated point.
    expect(field).toMatch(/projectPoint\(\[FOCUS_MARK\.lon, FOCUS_MARK\.lat\]\)/);
    expect(field).not.toMatch(/lat: 0|lon: 0|\[0, 0\]/);
  });

  it('STEP 1 — Global Developments drives the SAME focus state, through the SAME function', () => {
    // Two callers now, one canonical action — neither re-implements focus.
    expect(trendingCard).toMatch(/const \{ setFocusFromArticle \} = useHeroFocus\(\);/);
    expect(trendingCard).toMatch(/onMouseEnter=\{\(\) => setFocusFromArticle\(article\)\}/);
    expect(trendingCard).toMatch(/onFocus=\{\(\) => setFocusFromArticle\(article\)\}/);
    expect(panel).toMatch(/onMouseEnter=\{\(\) => setFocusFromArticle\(item\)\}/);
    expect(panel).toMatch(/onFocus=\{\(\) => setFocusFromArticle\(item\)\}/);
    // The provider is still the ONE owner: no second state, no second resolver.
    expect(trendingCard).not.toMatch(/useState|useReducer|countryFocusPoint|resolvePrimaryCountry/);
  });

  it('STEP 1 — the pointer and keyboard paths cannot diverge, and leaving clears nothing', () => {
    for (const [name, source] of [
      ['TrendingCard', trendingCard],
      ['HeroLiveFeedPanel', panel],
    ] as Array<[string, string]>) {
      const enter = (source.match(/onMouseEnter=/g) ?? []).length;
      const focusHandlers = (source.match(/onFocus=/g) ?? []).length;
      expect({ name, paired: enter === focusHandlers && enter > 0 }).toEqual({ name, paired: true });
      // Focus persists after the pointer leaves — asserted, not incidental.
      expect({ name, clears: /onMouseLeave|onBlur|onPointerLeave/.test(source) }).toEqual({
        name,
        clears: false,
      });
    }
  });

  it('STEP 1 — Global Developments introduced NO fetch and NO client boundary of its own', () => {
    expect(trendingCard).not.toMatch(/\bfetch\(|axios|useSWR|useQuery|\/api\//);
    // GlobalDevelopments.spec.ts asserts this file carries no 'use client'.
    // It is legal to use a hook here only while every importer is a Client
    // Component, so that is asserted rather than assumed.
    const sourceOf = (relative: string): string => read(relative);
    for (const importer of [
      'components/home/GlobalDevelopments.tsx',
      'components/home/Hero.tsx',
      'components/home/IntelligenceContextCard.tsx',
    ]) {
      const text = sourceOf(importer);
      if (!/from '@\/components\/home\/TrendingCard'/.test(text)) continue;
      expect({ importer, isClient: text.trimStart().startsWith("'use client'") }).toEqual({
        importer,
        isClient: true,
      });
    }
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

  /*
   * CONVERTED UNDER CTO STEP 1 (F-1 decision sequence).
   *
   * This block previously asserted the INVERSE — that TrendingCard did not yet
   * participate in the focus chain — as a scope fence while B-2 was unapproved.
   * Step 1 is now authorized: Global Developments drives the SAME focus state.
   * The test is therefore converted, not deleted, and it still guards the
   * property that actually mattered: trending joins as a CONSUMER of the one
   * provider and does not grow an architecture of its own.
   */
  it('STEP 1 — trending now participates, and does so through the ONE provider', () => {
    expect(trendingCard).toMatch(/useHeroFocus/);
    expect(trendingCard).toMatch(/setFocusFromArticle/);
    // It consumes the shared hook — it does not reach for the context object or
    // re-mount the provider, and it keeps no focus state of its own.
    expect(trendingCard).toMatch(
      /import \{ useHeroFocus \} from '@\/components\/home\/HeroFocusProvider';/,
    );
    expect(trendingCard).not.toMatch(/HeroFocusContext|<HeroFocusProvider/);
    expect(trendingCard).not.toMatch(/useState/);
  });
});
