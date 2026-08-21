import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * M66.14A — HERO INTERACTION STANDING GUARANTEES.
 *
 * WHY THIS FILE EXISTS. GN-CD-M66.14 §0 records a material contradiction: the
 * request described an automatic active-story progression, and no such system
 * exists in the approved design. What exists is a DECORATIVE staggered row scan
 * that carries no information and drives nothing. Option A — specify what
 * exists — is the approved decision.
 *
 * Every guarantee below is TRUE TODAY. None of them is protected by anything.
 * That is the gap this file closes, and the reason it is written now rather
 * than alongside a future implementation: while the honest answer to "does the
 * scan drive the map?" is still "there is no channel between them", the
 * guarantee is cheap to state and impossible to get wrong. Retrofitted onto a
 * live implementation later, each one becomes an argument.
 *
 * WHAT THIS FILE DOES NOT DO. It implements no interaction and authorises none.
 * Several guards are written in the conditional — IF a future change introduces
 * X, THEN Y must hold — precisely so the future work inherits the constraint
 * instead of rediscovering it.
 *
 * It renders nothing: the repository has no jsdom. These are source contracts,
 * in the established style of this suite.
 */

const HOME = __dirname;
const SRC = join(__dirname, '..', '..');

const read = (relative: string): string => readFileSync(join(SRC, relative), 'utf-8');

/** Every negative guard runs against comment-stripped source. */
const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const feedPanel = codeOnly(read('components/home/HeroLiveFeedPanel.tsx'));
const hero = codeOnly(read('components/home/Hero.tsx'));
const field = codeOnly(read('components/home/HeroIntelligenceField.tsx'));
const trendingCard = codeOnly(read('components/home/TrendingCard.tsx'));
const trendingRail = codeOnly(read('components/home/GlobalDevelopments.tsx'));
const globalsCss = read('app/globals.css');

/** The surfaces a future feed/trending interaction would be built on. */
const INTERACTION_SURFACES: Array<[string, string]> = [
  ['HeroLiveFeedPanel.tsx', feedPanel],
  ['TrendingCard.tsx', trendingCard],
  ['GlobalDevelopments.tsx', trendingRail],
];

/*
  The vocabulary a real intelligence-selection implementation would have to use.
  Named once so every guard below tests the same idea rather than a private
  guess at it. Deliberately NOT a bare /focus/ or /select/ — `focus-visible:`
  classes and `focusable="false"` are ordinary presentation and must stay legal.
*/
const SELECTION_STATE =
  /setFocusSpot|setSignalSel|setSelectedArticle|setActiveArticle|setActiveStory|focusMap|spotForArticle|signalSel|focusSpot/;

describe('M66.14A guarantee A — no automatic article progression', () => {
  it('THE CORE RULE — the feed panel owns no timer, no state and no effect, so nothing can advance a story', () => {
    expect(feedPanel).not.toMatch(/setInterval|setTimeout|requestAnimationFrame/);
    expect(feedPanel).not.toMatch(/useState|useEffect|useReducer|useRef/);
  });

  it('the ONE hero timer is the example-question rotation, and it is bound to exampleQuestions — not to articles', () => {
    // Explicitly permitted by the M66.14A authorization: this timer is correct
    // and must not be prohibited. What must never happen is a SECOND timer, or
    // this one being repointed at feed data.
    const intervals = hero.match(/setInterval\(/g) ?? [];
    expect(intervals).toHaveLength(1);
    const body = /setInterval\(\(\) => \{([\s\S]*?)\}, ROTATION_INTERVAL_MS\);/.exec(hero);
    expect(body).not.toBeNull();
    expect(body![1]).toMatch(/exampleQuestions/);
    // and it touches no feed concept whatsoever
    expect(body![1]).not.toMatch(/article|latestArticles|statusKey|feed/i);
  });

  it('no hero surface holds an active-story index that a timer could drive', () => {
    for (const [name, source] of INTERACTION_SURFACES) {
      expect({ name, hasActiveIndex: /activeIndex|activeStory|activeArticle|currentStory/i.test(source) }).toEqual({
        name,
        hasActiveIndex: false,
      });
    }
  });
});

describe('M66.14A guarantee B — the decorative scan drives nothing', () => {
  it('cd-row-amber appears exactly once, on the row, and nowhere else', () => {
    expect((feedPanel.match(/cd-row-amber/g) ?? [])).toHaveLength(1);
    // M66.14C — the released utility carries the 13s period; the 2.1s stagger
    // stays a formula on an inline animation-delay.
    expect(feedPanel).toMatch(/animate-cd-row-amber/);
    expect(feedPanel).toMatch(/style=\{\{ animationDelay: `\$\{\(index \* 2\.1\)\.toFixed\(1\)\}s` \}\}/);
  });

  it('the scan selects no article, focuses no map, updates no context and scrolls nothing', () => {
    expect(feedPanel).not.toMatch(SELECTION_STATE);
    expect(feedPanel).not.toMatch(/scrollIntoView|scrollTo\(|scrollTop\s*=/);
    // The panel imports no map, signal or context module — there is no channel.
    expect(feedPanel).not.toMatch(/from '@\/components\/(home\/Hero(IntelligenceField|WorldVisual)|map\/)/);
  });

  it('the animation index is a render index only — it is never stored, compared or exported', () => {
    expect(feedPanel).not.toMatch(/index === |=== index|setIndex/);
  });
});

describe('M66.14A guarantee C — a future focus/context selection must persist after pointer-leave', () => {
  it('no selection state exists anywhere yet, so nothing can be erased today', () => {
    for (const [name, source] of INTERACTION_SURFACES) {
      expect({ name, hasSelectionState: SELECTION_STATE.test(source) }).toEqual({ name, hasSelectionState: false });
    }
  });

  it('THE GUARD — neither the feed panel nor a trending card installs a pointer-leave or blur handler', () => {
    // Scoped deliberately to the two SELECTION surfaces. The rail wrapper in
    // GlobalDevelopments legitimately uses onMouseLeave/onBlur to release the
    // carousel auto-advance hold; that is not intelligence context and must
    // stay legal. What must never appear is a leave handler on the surfaces
    // that a future implementation would use to set map/context state — that is
    // exactly how the non-restoring hover of GN-CD-M66.14 §7 gets lost.
    expect(feedPanel).not.toMatch(/onMouseLeave|onPointerLeave|onBlur/);
    expect(trendingCard).not.toMatch(/onMouseLeave|onPointerLeave|onBlur/);
  });
});

describe('M66.14A guarantee D — keyboard equivalence, enforced in advance', () => {
  it('THE GUARD — any surface with onMouseEnter must also have onFocus, so a pointer path can never ship without its keyboard twin', () => {
    for (const [name, source] of INTERACTION_SURFACES) {
      const hasPointerEnter = /onMouseEnter|onPointerEnter/.test(source);
      const hasFocus = /onFocus/.test(source);
      expect({ name, pointerWithoutKeyboard: hasPointerEnter && !hasFocus }).toEqual({
        name,
        pointerWithoutKeyboard: false,
      });
    }
  });

  it('the rail already demonstrates the required pairing, so the rule is the repository\u2019s own convention', () => {
    // GlobalDevelopments pairs onMouseEnter/onMouseLeave with onFocus/onBlur
    // for the carousel hold. The guard above generalises that existing habit.
    expect(trendingRail).toMatch(/onMouseEnter/);
    expect(trendingRail).toMatch(/onFocus/);
  });

  it('the feed rows are reachable by keyboard at all — real anchors, native order, no tabIndex juggling', () => {
    expect(feedPanel).toMatch(/<a\s+href=\{item\.url\}/);
    expect(feedPanel).not.toMatch(/tabIndex/);
  });
});

describe('M66.14A guarantee E — the hero map viewport never moves', () => {
  it('THE CORE RULE — the viewBox is built from constants only and cannot be driven by interaction', () => {
    expect(field).toMatch(/viewBox=\{`0 0 \$\{VIEWPORT\.width\} \$\{VIEWPORT\.height\}`\}/);
    expect((field.match(/viewBox=/g) ?? [])).toHaveLength(1);
  });

  it('the field holds no state and no pointer handler, so there is nothing for a pan or zoom to write to', () => {
    expect(field).not.toMatch(/useState|useReducer/);
    expect(field).not.toMatch(/onWheel|onPointerDown|onMouseDown|onDragStart|onTouchStart/);
    expect(field).not.toMatch(/\bzoom\b|zoomIdentity|panTo|\.translateExtent/);
  });

  it('the field remains decorative and unreachable — aria-hidden and pointer-events-none where the hero mounts it', () => {
    // M66.14B — the desktop instance takes a focus prop; the mount is unchanged.
    expect(hero).toMatch(/aria-hidden="true"[\s\S]{0,200}?<HeroIntelligenceField focus=/);
    expect(field).not.toMatch(/tabIndex|role="button"/);
  });
});

describe('M66.14A guarantee F — map to feed stays asymmetric', () => {
  it('no map surface writes feed-row state, and the feed exposes none to write', () => {
    expect(field).not.toMatch(SELECTION_STATE);
    expect(field).not.toMatch(/feedRow|highlightRow|scrollIntoView/);
    expect(feedPanel).not.toMatch(/data-(active|selected)|aria-current/);
  });
});

describe('M66.14A guarantee G — trending interaction never dims categories', () => {
  it('no layer, dimming or category-filter state exists in the trending surfaces', () => {
    for (const [name, source] of [['TrendingCard.tsx', trendingCard], ['GlobalDevelopments.tsx', trendingRail]] as Array<[string, string]>) {
      expect({ name, dims: /\blayers\b|dimmed|setDimmed|activeCategory|categoryFilter/i.test(source) }).toEqual({
        name,
        dims: false,
      });
    }
  });

  it('no trending surface applies a dimming opacity to anything', () => {
    for (const [name, source] of [['TrendingCard.tsx', trendingCard], ['GlobalDevelopments.tsx', trendingRail]] as Array<[string, string]>) {
      expect({ name, dimClass: /opacity-30|opacity-\[0?\.3/.test(source) }).toEqual({ name, dimClass: false });
    }
  });
});

describe('M66.14A guarantee H — reduced motion keeps working', () => {
  it('the released rule that stops inline animations is intact and untouched', () => {
    expect(globalsCss).toMatch(/\[style\*='animation'\]\s*\{\s*animation:\s*none\s*!important;/);
    expect(globalsCss).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it('THE COUPLING — reduced motion still stops the row scan, now through BOTH released layers', () => {
    /*
      M66.14C — CORRECTED, AND THE GUARANTEE IS STRONGER THAN BEFORE.

      This test used to require the scan to stay an inline shorthand, on the
      reasoning that only [style*='animation'] could neutralise it. That was
      never the whole picture, and the requirement it imposed is what kept the
      keyframe out of the built CSS entirely.

      Reduced motion is covered TWICE, and the scan is caught by both:

        globals.css :21   `*, *::before, *::after` clamps animation-duration to
                          0.01ms and iteration-count to 1 — this catches ANY
                          animation, class-based or inline.
        globals.css :127  [style*='animation'] { animation: none !important }
                          — the row still carries an inline animation-delay, so
                          this attribute selector still matches it.

      The guarantee asserted is the one that matters: the row keeps an inline
      animation-* property so the stricter second layer still applies, and both
      released rules remain intact.
    */
    expect(feedPanel).toMatch(/style=\{\{ animationDelay: `/);
    expect(globalsCss).toMatch(/\*,\s*\r?\n\s*\*::before,\s*\r?\n\s*\*::after \{[\s\S]{0,160}?animation-duration: 0\.01ms !important;/);
    expect(globalsCss).toMatch(/\[style\*='animation'\]\s*\{\s*animation:\s*none\s*!important;/);
  });
});

describe('M66.14A guarantee I — no evidence-precision claim beyond canonical scope', () => {
  it('no hero surface asserts city, country or regional evidence', () => {
    for (const [name, source] of [['HeroLiveFeedPanel.tsx', feedPanel], ['HeroIntelligenceField.tsx', field], ['TrendingCard.tsx', trendingCard]] as Array<[string, string]>) {
      expect({ name, claims: /CITY-LEVEL|COUNTRY-LEVEL|REGIONAL EVIDENCE|EVIDENCE/i.test(source) }).toEqual({
        name,
        claims: false,
      });
    }
  });

  it('no hero surface reads a precision or coordinate field — none of them is populated by any provider', () => {
    for (const [name, source] of INTERACTION_SURFACES) {
      expect({ name, geo: /geographicPrecision|evidencePrecision|latitude|longitude|centroid/.test(source) }).toEqual({
        name,
        geo: false,
      });
    }
  });
});

describe('M66.14A guarantee I2 — one category colour vocabulary, not two', () => {
  it('no hero surface other than TrendingCard defines a category-keyed colour literal', () => {
    // CATEGORY_CHANNEL in TrendingCard.tsx is the ONE released mapping, and its
    // values are RGB channels consumed through categoryChannel(). A future
    // signal/marker colour must read that, never restate it — the same rule
    // M66.13C established for category LABELS, applied to colour.
    const COLOUR_MAP =
      /\b(world|politics|business|technology|science|health|sports|entertainment)\s*:\s*'(#|rgba?\(|\d{1,3},\s*\d{1,3},\s*\d{1,3})/;
    for (const [name, source] of [
      ['HeroLiveFeedPanel.tsx', feedPanel],
      ['HeroIntelligenceField.tsx', field],
      ['GlobalDevelopments.tsx', trendingRail],
      ['Hero.tsx', hero],
    ] as Array<[string, string]>) {
      expect({ name, secondColourMap: COLOUR_MAP.test(source) }).toEqual({ name, secondColourMap: false });
    }
  });
});

describe('M66.14A — the client boundary the feed panel depends on', () => {
  it('every importer of HeroLiveFeedPanel is a Client Component, so its DOM handlers are legal', () => {
    // The panel carries onKeyDown but no 'use client' directive of its own, by
    // deliberate design — its spec asserts it introduces no client boundary.
    // That is only safe while every importer is itself a Client Component.
    // intelligenceModuleClientBoundary.spec.ts exists because this exact
    // arrangement once failed at runtime elsewhere in the codebase.
    const importers = readdirSync(HOME)
      .filter((name: string) => name.endsWith('.tsx'))
      .filter((name: string) => /from '@\/components\/home\/HeroLiveFeedPanel'/.test(readFileSync(join(HOME, name), 'utf-8')));

    expect(importers.length).toBeGreaterThan(0);
    for (const name of importers) {
      const importer = readFileSync(join(HOME, name), 'utf-8');
      expect({ name, isClientComponent: importer.trimStart().startsWith("'use client'") }).toEqual({
        name,
        isClientComponent: true,
      });
    }
  });
});
