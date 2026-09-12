'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { categoryChannel } from '@/components/home/TrendingCard';
import { useHeroFocus } from '@/components/home/HeroFocusProvider';

/**
 * M66.14B — THE DESKTOP INTELLIGENCE CONTEXT CARD.
 *
 * Renders only what is true. Every slot below is either application chrome from
 * the dictionary, the ONE canonical taxonomy, or provider text passed through
 * untouched. Nothing is derived, inferred or filled in.
 *
 * WHAT IS DELIBERATELY ABSENT, AND WHY:
 *
 *   {n} SOURCES   OMITTED by CTO decision. gnews.provider.ts hardcodes
 *                 sourcesCount: 1 on every live article while the mock provider
 *                 supplies 32/15/31/9, so the line would read "1 SOURCE" on real
 *                 reporting and "32 SOURCES" in demo mode — richer when the data
 *                 is fake. Hero.spec.ts:73 independently forbids it.
 *   city/region   No data. geographicPrecision is populated by nothing.
 *   related       No causal relationship exists in any contract.
 *   timestamps    Not invented here; the feed row already shows real ones.
 *
 * ACCESSIBILITY. This card is a SIBLING of the hero's decorative map, never a
 * child of it: HeroIntelligenceField is mounted aria-hidden and
 * pointer-events-none, so anything inside it is invisible to assistive
 * technology. role="status" with aria-live="polite" means a keyboard user hears
 * what focusing a feed row produced, which is the entire point of the chain.
 *
 * DESKTOP ONLY in B-1. The mobile in-flow presentation is B-2 and is not
 * implemented here; the card is gated to the cd-hero breakpoint and up.
 *
 * ── PHASE 1 — WHY THIS CARD GREW, AND WHAT BOUNDS IT NOW ───────────────────
 *
 * The two prose lines below were styled `text-cd-body` and `text-cd-body-sm`.
 * NEITHER CLASS EXISTED. `cd-body` is a fontFamily key in tailwind.config.ts,
 * not a fontSize one, and `cd-body-sm` is not defined anywhere at all — so
 * Tailwind emitted no rule for either, both lines inherited the page's 16px
 * with `line-height: normal`, and the headline had no clamp. A long provider
 * title in a 280px column then grew the card without limit. That was the
 * reported "oversized card": not a design budget that needed lowering, but two
 * dead class names and a missing clamp.
 *
 * The bound is now explicit and countable:
 *   width      w-cd-280, fixed. Never w-auto, never max-w-.
 *   place      cd-card-head (13px/1.32), ONE line, truncated.
 *   headline   cd-preview-summary (11.5px/1.45), at most TWO lines.
 *   height     max-h-[260px]. Computed from the tokens above: 28 padding +
 *              18 eyebrow + 28 category + 28 place + 44 headline + 43
 *              evidence + 28 provenance = 217px, so 260 is a backstop with
 *              headroom for font-metric variance, not a layout target.
 * Every token used here already exists; this milestone adds none.
 *
 * Truncation is deliberate over growth: the card is an overlay on the hero
 * map, and a card that expands to fit its content is a card that eventually
 * covers the map it is annotating.
 */
interface IntelligenceContextCardProps {
  language: LanguageCode;
  className?: string;
}

export function IntelligenceContextCard({
  language,
  className = '',
}: IntelligenceContextCardProps): JSX.Element | null {
  const { focus, statusKey } = useHeroFocus();
  const dictionary = getDictionary(language);
  const t = dictionary.heroContext;

  /*
    VISIBILITY IS THE FOCUS STATE — and ONLY the focus state. There is no second
    flag, no default-open, no timer: the card exists exactly while a reader is
    hovering or keyboard-focusing a feed row, and vanishes on blur.

    WHAT CHANGED, AND WHY IT HAD TO. This used to also require a resolved
    country, and returned null without one. Measured against the twelve articles
    the demo provider serves, `resolvePrimaryCountry()` resolves ZERO of them —
    every fixture headline is deliberately country-neutral ("Global markets
    steady...", "Trade negotiators reconvene..."), and none reaches the scorer's
    35-point threshold. The card was therefore structurally incapable of
    rendering on that dataset, and partially capable on live GNews depending on
    whether a headline happens to name a place. A reader could not distinguish
    "this row does nothing" from "the feature is broken".

    ONE SLOT WAS UNKNOWN, AND IT DISCARDED FIVE. Category, headline, evidence
    scope and provenance are all available for every focused article; only PLACE
    depends on the country join. So place is now the conditional element, and
    the card is not.

    THIS ASSERTS LESS, NOT MORE. No country is invented, defaulted or guessed —
    `resolved` is a straight read of what the resolver returned, and when it
    returned nothing the card SAYS so in words. Absence reported is honest;
    absence shown as silence was not.
  */
  if (focus === null) {
    return null;
  }

  const resolved = focus.countryCode !== null && focus.countryName !== null;

  const categoryLabel = dictionary.map.categories[focus.category] ?? focus.category;
  /*
    Narrowed on the fields themselves rather than through `resolved`, so the
    call needs NO type assertion. That is deliberate: `as string` is exactly
    where a null would later slip past the compiler and reach the display
    helper, and a display helper is exactly where a placeholder country would
    then appear. There is no fallback branch here at all.
  */
  const countryLabel =
    focus.countryCode !== null && focus.countryName !== null
      ? getCountryDisplayName(focus.countryCode, language, focus.countryName)
      : null;
  const channel = categoryChannel(focus.category);
  const status = dictionary.liveStatusStrip;

  /*
    PROVENANCE. statusKey comes from the provider's single resolveLiveStatus()
    call — never re-derived here. A live feed needs no qualifier; every other
    state reuses the SAME wording the DATA STATUS row uses, so one fetch can
    never be described two ways. This is the M66.13 rule applied to a new
    surface: a card showing a country and a category beside DEMO content would
    re-assert currency exactly the way the old "Live feed" heading did.
  */
  const provenance =
    statusKey === 'live'
      ? null
      : statusKey === 'cached'
        ? status.cached
        : statusKey === 'mock'
          ? status.mock
          : statusKey === 'unavailable'
            ? status.unavailable
            : statusKey === 'reconnecting'
              ? status.reconnecting
              : status.unknown;

  return (
    <aside
      role="status"
      aria-live="polite"
      style={{ ['--icc-ch' as string]: channel }}
      className={`max-h-[260px] w-cd-280 overflow-hidden rounded-cd-12 border border-cd-edge-card bg-cd-fill-feed p-cd-14 shadow-[0_0_14px_rgba(var(--icc-ch),0.10)] ${className}`}
    >
      <div className="font-cd-mono text-cd-mono-feed-action uppercase tracking-[0.16em] text-cd-ink-label">
        {t.heading}
      </div>

      <div className="mt-cd-10 flex items-center gap-cd-10">
        <span
          aria-hidden="true"
          className="h-cd-7 w-cd-7 shrink-0 rounded-full"
          style={{ background: `rgb(${channel})` }}
        />
        <span className="font-cd-mono text-cd-mono-feed-action uppercase text-cd-ink-primary">
          {categoryLabel}
        </span>
      </div>

      {/*
        ONE line. Country names are bounded, but the Polish forms are long.

        Unresolved renders in the SECONDARY ink role, not the primary one: it is
        a report about missing data, not the card's subject, and it must not
        read at the same weight as a real place name.
      */}
      {resolved ? (
        <div className="mt-cd-10 truncate text-cd-card-head text-cd-ink-primary">{countryLabel}</div>
      ) : (
        <div className="mt-cd-10 truncate text-cd-card-head text-cd-ink-tertiary">{t.locationUnresolved}</div>
      )}

      {/* Provider text, verbatim and untranslated — M66.13C forbids looking it up. */}
      <p className="mt-cd-10 line-clamp-2 text-cd-preview-summary text-cd-ink-secondary">{focus.headline}</p>

      {/*
        THE SCOPE MUST MATCH THE JOIN. `countryEvidence` is a claim about an
        article-to-country join; with no join it would be false, so it is not
        shown. `articleEvidence` names what is actually in hand — the retrieved
        article — which is a LOWER scope, never a finer one.
      */}
      <div className="mt-cd-14 border-t border-cd-edge-divider pt-cd-10 font-cd-mono text-cd-mono-feed-action uppercase text-cd-ink-label">
        {resolved ? t.countryEvidence : t.articleEvidence}
      </div>

      {provenance !== null && (
        <div className="mt-cd-10 font-cd-mono text-cd-mono-feed-action uppercase text-cd-ink-label">
          {provenance}
        </div>
      )}
    </aside>
  );
}
