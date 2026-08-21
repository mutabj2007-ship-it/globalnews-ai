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
    Visibility IS the focus state — there is no second flag. A focus whose
    country did not resolve renders nothing, which is the honest outcome: the
    card exists to say WHERE a story is, and for that article nobody knows.
  */
  if (focus === null || focus.countryCode === null || focus.countryName === null) {
    return null;
  }

  const categoryLabel = dictionary.map.categories[focus.category] ?? focus.category;
  const countryLabel = getCountryDisplayName(focus.countryCode, language, focus.countryName);
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
      className={`w-cd-280 rounded-cd-12 border border-cd-edge-card bg-cd-fill-feed p-cd-14 shadow-[0_0_14px_rgba(var(--icc-ch),0.10)] ${className}`}
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

      <div className="mt-cd-10 text-cd-body text-cd-ink-primary">{countryLabel}</div>

      {/* Provider text, verbatim and untranslated — M66.13C forbids looking it up. */}
      <p className="mt-cd-10 text-cd-body-sm text-cd-ink-secondary">{focus.headline}</p>

      <div className="mt-cd-14 border-t border-cd-edge-divider pt-cd-10 font-cd-mono text-cd-mono-feed-action uppercase text-cd-ink-label">
        {t.countryEvidence}
      </div>

      {provenance !== null && (
        <div className="mt-cd-10 font-cd-mono text-cd-mono-feed-action uppercase text-cd-ink-label">
          {provenance}
        </div>
      )}
    </aside>
  );
}
