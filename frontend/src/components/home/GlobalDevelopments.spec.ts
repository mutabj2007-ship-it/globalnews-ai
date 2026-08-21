import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';
import tailwindConfig from '../../../tailwind.config';

const source = readFileSync(join(__dirname, 'GlobalDevelopments.tsx'), 'utf-8');
const cardSource = readFileSync(join(__dirname, 'TrendingCard.tsx'), 'utf-8');

type ThemeExtend = Record<string, Record<string, unknown>>;
const themeExtend = (tailwindConfig.theme?.extend ?? {}) as unknown as ThemeExtend;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Comments stripped AND import statements removed — see the naming guard below. */
function renderedSource(src: string): string {
  return stripComments(src).replace(/^\s*import[\s\S]*?;\s*$/gm, '');
}

/**
 * M60 Phase 2 established the controlled-carousel recomposition; M66.4
 * reconciles it against GN-CD-100 -> GN-CD-115. Every functional contract
 * below survives unchanged in substance. Where the code moved into
 * TrendingCard.tsx the assertion follows it; where GN-CD supersedes a value
 * the old expectation is REPLACED by one protecting the new contract, never
 * deleted.
 */
describe('GlobalDevelopments (M60 Phase 2 — controlled carousel)', () => {
  it('reuses Phase B semantic allocation (featured -> lead, inFocus -> secondary) — no second allocation truth', () => {
    expect(source).toMatch(/lead: NewsArticle \| null/);
    expect(source).toMatch(/secondary: NewsArticle\[\]/);
    expect(stripComments(source)).not.toMatch(/\.sort\(/);
    expect(stripComments(cardSource)).not.toMatch(/\.sort\(/);
  });

  it('caps the carousel at lead + 5 secondary (6 cards total)', () => {
    expect(source).toMatch(/const SECONDARY_COUNT = 5/);
    expect(source).toMatch(/\[lead, \.\.\.secondary\]\.slice\(0, SECONDARY_COUNT \+ 1\)/);
  });

  it('uses truthful section labels — never "Trending"/"Most read"/"Popular" as rendered copy', () => {
    /*
      M66.4 — this is a TRUTHFULNESS contract, not a presentation lock, and the
      CTO has made it permanent: the Claude Design family is named Trending,
      the product surface is not. `allocateHomeFeed` states in its own contract
      that no popularity or engagement claim is made or implied, so no rendered
      string may suggest one.

      Identifiers may legitimately carry the design family name — the imported
      component is TrendingCard — so the guard now targets what a user can
      actually read: every dictionary value this section renders, in BOTH
      languages, plus the components' source with comments and imports removed.
    */
    for (const language of ['en', 'pl'] as const) {
      const values = Object.values(getDictionary(language).globalDevelopments).flat();
      for (const value of values) {
        expect(String(value).toLowerCase()).not.toMatch(/trending|most read|popular/);
      }
    }
    /*
      Identifiers and design tokens legitimately carry the family name — the
      imported component is TrendingCard and the released section gradient is
      `bg-cd-trending`. What must never carry it is TEXT A USER READS, so the
      second half of this guard checks the JSX text nodes themselves. It also
      proves the stronger property those nodes should have: every one of them
      files comes from the dictionary or from a real article field.
    */
    for (const text of [source, cardSource]) {
      const textNodes = (renderedSource(text).match(/>[^<>{}]+</g) ?? []).map((node) =>
        node.slice(1, -1),
      );
      for (const node of textNodes) {
        expect(node.toLowerCase()).not.toMatch(/trending|most read|popular/);
      }
      // Accessible names are expressions, never English literals.
      expect(renderedSource(text)).not.toMatch(/aria-label="[^"]/);
    }
  });

  it('renders exactly one DataModeLabel — provider status stated once, not per card', () => {
    const usages = (source.match(/<DataModeLabel/g) ?? []).length;
    expect(usages).toBe(1);
    expect(cardSource).not.toMatch(/DataModeLabel/);
  });

  it('every card renders through the ONE shared card component — a single SafeImage usage site, and exactly one image request per story', () => {
    // M66.4 — the card moved to TrendingCard.tsx, which authors BOTH released
    // compositions around a single anchor and a single image. Rendering the
    // desktop and mobile cards as two hidden siblings would have doubled this
    // page's image requests, because a hidden <img> is still fetched.
    expect(source).not.toMatch(/<SafeImage/);
    expect((cardSource.match(/<SafeImage/g) ?? []).length).toBe(1);
    expect((cardSource.match(/<a\s/g) ?? []).length).toBe(1);
    expect(source).toMatch(/<TrendingCard/);
  });

  it('the story image has a real, honest fallback and never a fabricated one', () => {
    // M66.4 — GN-CD-110 has no image mechanism at all: the prototype's media
    // is a CSS composition derived from the category colour. Production keeps
    // the real photograph and adopts that composition as its FALLBACK, so a
    // missing or failed image degrades to the released tile rather than to a
    // stock picture that would misrepresent the story.
    expect(cardSource).toMatch(/article\.imageUrl \? \(/);
    expect(cardSource).toMatch(/fallbackSrc=\{TRANSPARENT_PIXEL\}/);
    expect(cardSource).toMatch(/export const TRANSPARENT_PIXEL/);
    expect(stripComments(cardSource)).not.toMatch(/article-placeholder\.jpg/);
  });

  it('renders a safe unavailable state when there is no lead story', () => {
    expect(source).toMatch(/!lead \?/);
    expect(source).toMatch(/\{t\.unavailable\}/);
  });

  it('article links carry a localized accessible name built from real fields, not hardcoded English', () => {
    // M66.4 (CTO decision D-4) — GN-CD-306's released card name is
    // "{category}: {headline} — {age}, {n sources}". Every part is a real,
    // already-localized value, so the richer pattern needs no new dictionary
    // key. The source clause is dropped when the count is not genuinely
    // greater than one.
    expect(cardSource).toMatch(
      /const accessibleName = `\$\{categoryLabel\}: \$\{article\.title\} — \$\{age\}\$\{sources \? `, \$\{sources\}` : ''\}`/,
    );
    expect(cardSource).toMatch(/aria-label=\{accessibleName\}/);
    expect(cardSource).toMatch(/formatRelativeTime\(article\.publishedAt, language\)/);
    expect(cardSource).toMatch(/pluralWithForms\(article\.sourcesCount, language, t\.sourceForms\)/);
    expect(cardSource).toMatch(/dictionary\.map\.categories\[article\.category\] \?\? article\.category/);
  });

  it('only shows a source count when it is genuinely more than one, for any card — no fabricated single-source count claim', () => {
    expect(cardSource).toMatch(/article\.sourcesCount > 1 \?/);
  });

  describe('carousel behavior (Correction 2, reconciled in M66.4)', () => {
    it('is a client component — the auto-advance timer and manual controls both require it', () => {
      expect(source.trimStart().startsWith("'use client'")).toBe(true);
      // The card itself needs no client boundary of its own.
      expect(cardSource.trimStart().startsWith("'use client'")).toBe(false);
    });

    it('advances approximately one card at a time on an interval, not perpetual pixel scrolling', () => {
      expect(source).toMatch(/AUTO_ADVANCE_INTERVAL_MS = 6000/);
      expect(source).toMatch(/const railStep = useCallback\(/);
      expect(stripComments(source)).not.toMatch(/requestAnimationFrame/);
    });

    it('pauses on hover and on focus within the rail, and re-arms after a control activation instead of latching', () => {
      /*
        M66.4 — GN-CD-108 requires TWO independent pause flags and says a single
        merged flag was tried during design and failed: touch and keyboard users
        never fire mouseleave, so the pause latched permanently and the rail died
        after one arrow tap. The pre-M66.4 implementation had exactly that single
        flag, with onPointerDown setting it and nothing clearing it.
      */
      expect(source).toMatch(/holdRef\.current = true;/);
      expect(source).toMatch(/holdRef\.current = false;/);
      expect(source).toMatch(/pausedRef\.current = true;/);
      expect(source).toMatch(/MANUAL_REARM_MS = 9000/);
      expect(source).toMatch(/pausedRef\.current = false;\s*\}, MANUAL_REARM_MS\)/);
      expect(source).toMatch(/if \(!holdRef\.current && !pausedRef\.current\) railStep\(1\);/);
      // The merged flag, and the handler that latched it, must not return.
      expect(stripComments(source)).not.toMatch(/setIsPaused/);
      expect(stripComments(source)).not.toMatch(/onPointerDown/);
    });

    it('registers no auto-advance timer at all when the user prefers reduced motion — not a timer that silently no-ops', () => {
      expect(source).toMatch(/if \(prefersReducedMotion \|\| !canScroll\) return;/);
      expect(source).toMatch(/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
    });

    it('scrolls with behavior:auto under reduced motion, so the arrows jump rather than glide', () => {
      expect(source).toMatch(/behavior: prefersReducedMotion \? 'auto' : 'smooth'/);
    });

    it('provides manual previous/next controls, and never renders a control that cannot act', () => {
      expect(source).toMatch(/railNudge\(-1\)/);
      expect(source).toMatch(/railNudge\(1\)/);
      // GN-CD records that a rail shorter than its viewport leaves the arrows
      // with nothing to scroll, "appearing broken". Real overflow is measured.
      expect(source).toMatch(/el\.scrollWidth > el\.clientWidth \+ 1/);
      expect(source).toMatch(/new ResizeObserver\(measure\)/);
      expect((source.match(/\{canScroll && /g) ?? []).length).toBe(2);
    });

    it('uses native CSS scroll-snap for touch swipe, not a custom touch-event handler', () => {
      expect(source).toMatch(/snap-x snap-mandatory/);
      expect(cardSource).toMatch(/snap-start/);
      expect(stripComments(source)).not.toMatch(/onTouchStart|onTouchMove|onTouchEnd/);
    });

    it('introduces no new fetch — the rail renders only the already-provided lead/secondary props', () => {
      expect(stripComments(source)).not.toMatch(/fetch\(/);
      expect(stripComments(cardSource)).not.toMatch(/fetch\(/);
    });
  });
});

/* ───────────────────── M66.4 — GN-CD-100 → GN-CD-115 ───────────────────── */

describe('M66.4 — released section canvas and header', () => {
  it('is a bordered panel on the released gradient at the desktop composition, and NO container at all below it', () => {
    const backgroundImage = themeExtend.backgroundImage as unknown as Record<string, string>;
    expect(backgroundImage['cd-trending']).toBe(
      'linear-gradient(180deg, rgba(9,16,32,.9), rgba(5,9,18,.9))',
    );
    expect(source).toMatch(/cd-hero:rounded-cd-16 cd-hero:border cd-hero:border-cd-edge-section cd-hero:bg-cd-trending cd-hero:px-cd-18 cd-hero:py-cd-16/);
    // GN-CD-100: on mobile the block has no border, radius, background or
    // padding. Every container utility must therefore be breakpoint-gated.
    const container = source.slice(source.indexOf('<div className="relative cd-hero:overflow-hidden'));
    const opening = container.slice(0, container.indexOf('>'));
    for (const ungated of ['rounded-cd-16', 'bg-cd-trending', 'px-cd-18', 'py-cd-16']) {
      expect(opening).not.toMatch(new RegExp(`(^|\\s)${ungated}`));
    }
  });

  it('carries the released 88px vertical rule field, desktop only and decorative', () => {
    const backgroundImage = themeExtend.backgroundImage as unknown as Record<string, string>;
    expect(backgroundImage['cd-rules-trending']).toBe(
      'repeating-linear-gradient(90deg, rgba(56,189,248,.05) 0 1px, transparent 1px 88px)',
    );
    expect(source).toMatch(/aria-hidden="true"[\s\S]{0,120}bg-cd-rules-trending cd-hero:block/);
  });

  it('keeps the real semantic heading rather than reproducing GN-CD DEFECT-009', () => {
    expect(source).toMatch(/<h2\s+id="global-developments-heading"/);
    expect(source).toMatch(/aria-labelledby="global-developments-heading"/);
    expect((source.match(/<h1/g) ?? []).length).toBe(0);
  });

  it('applies the released mono treatment to the section label at both viewports', () => {
    expect(source).toMatch(/text-cd-mono-section-m uppercase text-cd-ink-label cd-hero:text-cd-mono-section/);
    const fontSize = themeExtend.fontSize as unknown as Record<string, [string, Record<string, string>]>;
    expect(fontSize['cd-mono-section'][0]).toBe('12px');
    expect(fontSize['cd-mono-section'][1].letterSpacing).toBe('0.18em');
    expect(fontSize['cd-mono-section-m'][0]).toBe('10.5px');
    expect(fontSize['cd-mono-section-m'][1].letterSpacing).toBe('0.16em');
  });

  it('carries its own mobile separation from the hero, without touching the protected PageCanvas', () => {
    // GN-CD requires 14px between the hero and this section on mobile.
    // PageCanvas declares `lg:gap-cd-18` only and is protected (CTO decision D-6).
    expect(source).toMatch(/mt-cd-14 cd-hero:mt-0/);
  });
});

describe('M66.4 — released rail and controls', () => {
  it('uses the released gaps and mobile bleed', () => {
    expect(source).toMatch(/gap-cd-11 [\s\S]{0,200}cd-hero:gap-cd-12/);
    expect(source).toMatch(/-mx-cd-14 /);
    expect(source).toMatch(/px-cd-14 pb-cd-4/);
    expect(source).toMatch(/cd-hero:mx-0 cd-hero:gap-cd-12 cd-hero:px-0 cd-hero:pb-cd-2/);
  });

  it('contains the horizontal swipe so it cannot chain into the page back-gesture', () => {
    expect(source).toMatch(/overscroll-x-contain/);
    expect(source).toMatch(/\[-webkit-overflow-scrolling:touch\]/);
  });

  it('suppresses the rail scrollbar on every engine — GN-CD DEFECT-010 is Firefox-only suppression', () => {
    expect(source).toMatch(/\[scrollbar-width:none\]/);
    expect(source).toMatch(/\[&::-webkit-scrollbar\]:hidden/);
  });

  it('places the desktop arrows at the released offset, size and stacking', () => {
    expect(source).toMatch(/h-cd-34 w-cd-34/);
    expect(source).toMatch(/left-\[-19px\]/);
    expect(source).toMatch(/right-\[-19px\]/);
    expect(source).toMatch(/z-\[3\]/);
    expect(source).toMatch(/bg-cd-fill-rail-arrow/);
    expect(source).toMatch(/backdrop-blur-\[6px\]/);
    const spacing = themeExtend.spacing as unknown as Record<string, string>;
    expect(spacing['cd-34']).toBe('34px');
    expect(spacing['cd-19']).toBe('19px');
  });

  it('meets the 44px touch floor on the mobile arrows — an intentional correction to GN-CD DEFECT-011', () => {
    // GN-CD-106/107 authors 36x44, which its own GN-CD-302 SS-E.3 floor rejects
    // on the horizontal axis. CTO decision D-7 corrects it to 44x44.
    expect(source).toMatch(/h-cd-touch w-cd-touch cd-hero:hidden/);
    expect((themeExtend.minHeight as unknown as Record<string, string>)['cd-touch']).toBe('44px');
    expect(source).not.toMatch(/w-cd-36/);
  });

  it('keeps the released negative-margin cluster, which GN-CD-302 calls load-bearing', () => {
    expect(source).toMatch(/-mx-cd-4 -my-cd-16 flex items-center gap-cd-2/);
  });

  it('uses the released glyphs, not icons', () => {
    expect(source).toMatch(/&#8249;/);
    expect(source).toMatch(/&#8250;/);
    expect(stripComments(source)).not.toMatch(/lucide|ChevronLeft|ChevronRight|&larr;|&rarr;/);
  });

  it('exposes the rail as a named carousel region', () => {
    expect(source).toMatch(/role="region"/);
    expect(source).toMatch(/aria-roledescription="carousel"/);
    expect(source).toMatch(/aria-label=\{t\.headline\}/);
  });

  it('omits VIEW ALL rather than inventing a destination', () => {
    // GN-CD-104 marks the destination UNRESOLVED-006 and says the prototype's
    // own choice of the search screen is "a prototype convenience, not an
    // intent". No trending listing route exists (CTO decision D-2).
    const code = stripComments(source);
    expect(code).not.toMatch(/VIEW ALL|viewAll/i);
    expect(code).not.toMatch(/href="\/trending"/);
    expect(code).not.toMatch(/href="\/search/);
  });
});
