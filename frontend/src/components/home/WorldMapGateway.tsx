import { ArrowUpRight } from 'lucide-react';
import { COUNTRIES, type LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { CARD_INTERACTION_CLASSES } from '@/components/home/interactionStyles';
import { WorldMapAnimatedVisual } from '@/components/home/WorldMapAnimatedVisual';

interface WorldMapGatewayProps {
  language?: LanguageCode;
}

/**
 * Milestone #51 (browser-acceptance UX polish) — redesigned from a
 * plain icon+text+CTA panel into a two-column layout with a genuine
 * animated visual (WorldMapAnimatedVisual — pure SVG/CSS, see its own
 * doc comment) communicating global discovery at a glance, per
 * explicit product feedback that the previous version "does not
 * strongly communicate GLOBAL DISCOVERY."
 *
 * CRITICAL: this file imports nothing from `@/components/map/*`, and
 * nothing from `maplibre-gl`. Text/chips/CTA remain a lightweight
 * static panel — only the added visual is new, and it too is a Server
 * Component (no 'use client' anywhere in this feature).
 *
 * Country chips: built entirely from `COUNTRIES` (shared/src/countries.ts
 * — the SAME canonical list /map itself uses) and the SAME
 * `getCountryDisplayName()` helper already established in M49/M50 for
 * localized names — no second, manually-maintained country translation
 * table. Country links preserve canonical ISO identity: each chip
 * links to `/map?country={iso3}`, never a localized display string.
 *
 * A small, fixed, hand-picked subset of countries is shown — this is
 * presentation curation, not a new retrieval mechanism, so it stays
 * outside the one-homepage-fetch architecture entirely (zero backend
 * calls, exactly as before).
 */
const GATEWAY_ISO3_CODES = ['USA', 'GBR', 'DEU', 'POL', 'FRA', 'ESP'] as const;

export function WorldMapGateway({ language = 'en' }: WorldMapGatewayProps): JSX.Element {
  const t = getDictionary(language).worldMapGateway;
  const chips = GATEWAY_ISO3_CODES.map((iso3) => COUNTRIES.find((c) => c.iso3 === iso3)).filter(
    (c): c is NonNullable<typeof c> => Boolean(c),
  );

  return (
    <section className="border-b border-border bg-void" aria-labelledby="world-map-gateway-heading">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-6 rounded-2xl border border-border bg-surface p-6 sm:p-8 lg:grid-cols-2 lg:items-center lg:gap-10">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">{t.label}</span>
            <h2
              id="world-map-gateway-heading"
              className="mt-1 font-display text-xl font-medium text-ink-primary sm:text-2xl"
            >
              {t.headline}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-secondary">{t.description}</p>

            {chips.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {chips.map((country) => (
                  <li key={country.iso3}>
                    <a
                      href={`/map?country=${country.iso3}`}
                      className={`inline-flex items-center rounded-full border border-border-strong bg-void px-3 py-1 font-mono text-[11px] text-ink-secondary ${CARD_INTERACTION_CLASSES}`}
                    >
                      {getCountryDisplayName(country.iso2, language, country.name)}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <a
              href="/map"
              className="mt-6 inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-bright"
            >
              {t.cta}
              <ArrowUpRight size={16} strokeWidth={2.25} aria-hidden="true" />
            </a>
          </div>

          <div className="h-48 sm:h-56 lg:h-64">
            <WorldMapAnimatedVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
