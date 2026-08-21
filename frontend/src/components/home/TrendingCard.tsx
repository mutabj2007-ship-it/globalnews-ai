import type { CSSProperties } from 'react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { SafeImage } from '@/components/ui/SafeImage';

/**
 * M66.4 — the story card of the Claude Design news-discovery rail
 * (GN-CD-109 -> GN-CD-113), extracted from GlobalDevelopments.tsx.
 *
 * ── ONE ANCHOR, ONE IMAGE, TWO COMPOSITIONS ───────────────────────────────
 *
 * GN-CD-109 authors a genuine recomposition rather than a responsive reflow:
 * desktop is a HORIZONTAL card (fixed 74x78 tile on the left, text column on
 * the right) and mobile is a VERTICAL card (full-width media block on top,
 * body beneath, category label floating over the media as a chip).
 *
 * Rendering both structures and hiding one would double this page's image
 * requests, because a hidden <img> is still fetched. So the two compositions
 * share a single anchor and a single SafeImage: the media element changes
 * shape and position at the breakpoint, and only the category LABEL — plain
 * text, no request — is authored twice so it can appear as a chip over the
 * media on mobile and as a text row above the headline on desktop.
 *
 * Per-card colour arrives as a CSS custom property rather than as a style
 * object, so the released values that differ per viewport (the 12px vs 14px
 * halo radius, the media border) can still be expressed as breakpoint
 * utilities instead of being frozen by an inline declaration.
 *
 * ── WHAT THIS CARD CLAIMS, AND WHAT IT REFUSES TO ─────────────────────────
 *
 * Every value rendered here is a real field of a real NewsArticle from the
 * single homepage getHomeFeed(language) request: title, url, imageUrl,
 * category, publishedAt and sourcesCount. Nothing is fetched here, derived
 * from position, or invented.
 *
 * Three released treatments are deliberately NOT implemented, under CTO rules
 * 2-5:
 *
 *   - GN-CD-109-DB / MB, the urgent card. The design keys it on
 *     `cat === 'BREAKING'`. The repository's own classifier can only ever
 *     return politics, business, technology, science, health, sports,
 *     entertainment or the default world; both DTO boundaries validate
 *     against that list; and the literal token occurs nowhere in the
 *     codebase. The condition cannot be true in production, so no card here
 *     is ever red and the released cd-breaking-* animations stay unused.
 *   - GN-CD-109-DC / MC, the top-story perimeter light. Its rule is
 *     `!urgent && i === 1` — a positional literal the specification itself
 *     flags as a functional gap needing a real editorial signal. No such
 *     signal exists, so lighting the second array element would manufacture
 *     editorial significance out of provider response order.
 *   - The GN-CD-110 subject caption (DIPLOMACY, SUMMIT, MARKETS...). The
 *     specification calls it scaffolding for an image brief, never production
 *     copy, and DEFECT-015 records that screen readers announce it with no
 *     context. It is not shipped.
 *
 * ── MEDIA (CTO decision D-3) ───────────────────────────────────────────────
 *
 * GN-CD-110 contains no image mechanism at all: every media surface in the
 * prototype is a CSS composition derived from the story's category colour.
 * Production shows real provider photography, which is strictly more
 * truthful, so the photograph is kept and the released composition becomes
 * its fallback rather than its replacement.
 *
 * The composition and its texture are painted first and the photograph is
 * laid over them, so a story with no imageUrl shows the released tile
 * directly. When a photograph 404s or times out, SafeImage's existing
 * fallbackSrc prop is pointed at a fully transparent pixel, which reveals the
 * same tile underneath — the design's own fallback, reached through
 * SafeImage's public API rather than by modifying that protected component.
 *
 * ── CATEGORY IDENTITY (CTO decision D-1) ──────────────────────────────────
 *
 * See CATEGORY_CHANNEL below: exact released treatments where the two
 * taxonomies genuinely match, two approved presentation analogues, and ONE
 * existing released neutral for everything else. No new semantic colour is
 * introduced and the neutral asserts nothing about the story.
 *
 * ── ACCESSIBILITY ─────────────────────────────────────────────────────────
 *
 * The whole card is one real anchor with a unique, descriptive, fully
 * localized name (GN-CD-306, CTO decision D-4). It is keyboard-operable
 * because it is a link, not because a handler was wired to a div, and it
 * carries an explicit focus indicator — so GN-CD's DEFECT-014 does not exist
 * here. The photograph is alt="": the card's own accessible name already
 * carries the story title, and a duplicate alt would announce it twice.
 */

/**
 * GN-CD-300 SS-J.3 category channels, as "R,G,B" so the parametric
 * `rgba({RGB},a)` recipes in GN-CD-109 and GN-CD-110 compose directly.
 *
 * EXACT RELEASED MATCHES — the production category and the design category
 * are the same concept, so the released colour is used unchanged:
 *   politics -> POLITICS #60a5fa · technology -> TECHNOLOGY #a78bfa
 *   health   -> HEALTH   #22d3ee
 *
 * APPROVED PRESENTATION ANALOGUES (CTO decision D-1) — a mapping of visual
 * treatment only, never a claim that the two taxonomies are identical:
 *   business -> ECONOMY #34d399 · science -> CLIMATE #fb923c
 *
 * Everything else — world, sports, entertainment, and any value a future
 * provider introduces — resolves to TREND_NEUTRAL_CHANNEL.
 */
export const CATEGORY_CHANNEL: Readonly<Record<string, string>> = {
  politics: '96,165,250',
  technology: '167,139,250',
  health: '34,211,238',
  business: '52,211,153',
  science: '251,146,60',
};

/**
 * The released system cyan (GN-CD-300 SS-J.1 accent.sky, #38bdf8).
 *
 * This is NOT a new category semantic. GN-CD-307 reserves cyan as the neutral
 * system colour that never signals urgency or identity, which is exactly why
 * it is the right choice for a story whose category the design never assigned
 * a colour to. A card wearing it asserts nothing about the story beyond
 * "this is a story".
 */
export const TREND_NEUTRAL_CHANNEL = '56,189,248';

/** A 1x1 fully transparent GIF — reveals the released tile when a photograph fails to load. */
export const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export function categoryChannel(category: string | null | undefined): string {
  if (!category) return TREND_NEUTRAL_CHANNEL;
  return CATEGORY_CHANNEL[category.toLowerCase()] ?? TREND_NEUTRAL_CHANNEL;
}

export interface TrendingCardVisual {
  channel: string;
  tile: string;
  texture: string;
}

/**
 * GN-CD-110's decorate() derivation, ported as the specification asks — the
 * derivation itself, not its output. Every value is computed from the story's
 * real category and nothing is stored.
 */
export function decorate(category: string | null | undefined): TrendingCardVisual {
  const channel = categoryChannel(category);
  return {
    channel,
    tile:
      `linear-gradient(165deg,rgba(${channel},.5),rgba(8,20,40,.85) 58%,rgba(4,8,16,.95)),` +
      ` radial-gradient(70% 45% at 30% 18%,rgba(${channel},.55),transparent 70%)`,
    texture:
      'repeating-linear-gradient(0deg,rgba(255,255,255,.055) 0 1px,transparent 1px 4px),' +
      ` repeating-linear-gradient(115deg,rgba(${channel},.22) 0 2px,transparent 2px 11px)`,
  };
}

interface TrendingCardProps {
  article: NewsArticle;
  language: LanguageCode;
  /** True for the first card only — the one worth fetching eagerly. */
  isLead?: boolean;
}

export function TrendingCard({ article, language, isLead = false }: TrendingCardProps): JSX.Element {
  const dictionary = getDictionary(language);
  const t = dictionary.globalDevelopments;
  const visual = decorate(article.category);

  // The taxonomy is shared across the app, so the map surface's existing
  // labels localize the chip without inventing a second set of keys. A value
  // with no released label (currently sports and entertainment) falls back to
  // the provider's own string rather than to invented copy.
  const categoryLabel = dictionary.map.categories[article.category] ?? article.category;

  const age = formatRelativeTime(article.publishedAt, language);
  const sources =
    article.sourcesCount > 1 ? pluralWithForms(article.sourcesCount, language, t.sourceForms) : '';

  /**
   * GN-CD-306's released card name: "{category}: {headline} — {age}, {n sources}".
   * Assembled entirely from real, already-localized values; the source clause
   * is dropped when the count is not genuinely greater than one, so the name
   * never asserts a corroboration the data does not support.
   */
  const accessibleName = `${categoryLabel}: ${article.title} — ${age}${sources ? `, ${sources}` : ''}`;

  const metadata = (
    <>
      {age}
      {sources ? (
        <>
          <span aria-hidden="true"> &middot; </span>
          {sources}
        </>
      ) : null}
    </>
  );

  return (
    <a
      data-rail-card="1"
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={accessibleName}
      style={{ '--tc-ch': visual.channel } as CSSProperties}
      className="group relative flex w-cd-246 shrink-0 snap-start flex-col overflow-hidden rounded-cd-14 border border-cd-edge-card-mobile bg-cd-fill-trend-card-m shadow-[0_0_12px_rgba(var(--tc-ch),0.07)] focus-visible:border-cd-edge-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-cd-edge-focus cd-hero:w-cd-280 cd-hero:flex-row cd-hero:gap-cd-11 cd-hero:rounded-cd-12 cd-hero:border-cd-edge-card cd-hero:bg-cd-fill-trend-card cd-hero:p-cd-9 cd-hero:shadow-[0_0_14px_rgba(var(--tc-ch),0.07)] cd-hero:transition-[transform,box-shadow] cd-hero:duration-cd-180 cd-hero:hover:border-cd-edge-hover cd-hero:hover:bg-cd-fill-trend-hover cd-hero:hover:shadow-cd-trend-hover cd-hero:motion-safe:hover:-translate-y-cd-2"
    >
      {/*
        GN-CD-110 media. One element, two released geometries: a full-width
        112px block on mobile, a fixed 74x78 tile at the breakpoint.
      */}
      <span className="relative block h-cd-112 w-full flex-none overflow-hidden cd-hero:h-cd-78 cd-hero:w-cd-74 cd-hero:rounded-cd-9 cd-hero:border cd-hero:border-[color:rgba(var(--tc-ch),0.4)]">
        <span aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: visual.tile }} />
        <span
          aria-hidden="true"
          className="absolute inset-0 opacity-70 cd-hero:opacity-75"
          style={{ backgroundImage: visual.texture }}
        />
        {article.imageUrl ? (
          <SafeImage
            src={article.imageUrl}
            alt=""
            fallbackSrc={TRANSPARENT_PIXEL}
            fill
            priority={isLead}
            sizes="(min-width: 1240px) 74px, 246px"
            className="object-cover"
          />
        ) : null}
        {/* GN-CD-109-MA — the mobile media block's own bottom rule. */}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-cd-edge-structural cd-hero:hidden" />
      </span>

      <span className="relative flex min-w-0 flex-col bg-cd-fill-trend-body-m px-cd-12 pb-cd-12 pt-cd-11 cd-hero:bg-transparent cd-hero:p-0">
        {/* GN-CD-111 — desktop: a category row above the headline. */}
        <span className="hidden font-cd-mono text-cd-mono-readout uppercase text-[color:rgb(var(--tc-ch))] cd-hero:block">
          {categoryLabel}
        </span>

        <span className="line-clamp-2 font-cd-body text-cd-card-head-m text-cd-ink-primary cd-hero:mt-cd-5 cd-hero:text-cd-card-head">
          {article.title}
        </span>

        <span className="mt-cd-9 font-cd-mono text-cd-mono-meta-m text-cd-ink-meta cd-hero:mt-cd-7 cd-hero:text-cd-mono-meta">
          {metadata}
        </span>
      </span>

      {/* GN-CD-111 — mobile: the same label as a chip over the media block. */}
      <span className="absolute left-cd-10 top-cd-9 inline-flex items-center rounded-cd-5 border border-[color:rgba(var(--tc-ch),0.4)] bg-cd-fill-chip-m px-cd-7 py-cd-3 font-cd-mono text-cd-mono-chip-m uppercase text-[color:rgb(var(--tc-ch))] cd-hero:hidden">
        {categoryLabel}
      </span>
    </a>
  );
}
