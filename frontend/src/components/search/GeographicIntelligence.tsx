'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import type { GeographicResolution } from './analysisDimensions';
import { resolveGeographicLink } from './analysisClaims';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * H2D — E-13 Geographic Intelligence.
 *
 * Gives geography a visual role at, and ONLY at, the precision the
 * evidence supports.
 *
 * THE SURFACE IS NOT A MAP OF A POSITION. E-13 is explicit: "The rings
 * are a certainty-area device, deliberately not a pin." The marker sits
 * at the centre of the panel for every resolved analysis, whichever
 * country it is, because nothing in the payload contains a coordinate.
 * The device says "an area of this precision resolved"; the precision
 * tag says which. That is how country-level data drives a geographic
 * visual without implying a point on the earth.
 *
 * WHAT IS NEVER RENDERED. Coordinates. Provinces, districts, counties,
 * voivodeships. A city the payload did not resolve. `matchConfidence` —
 * the contract documents it as a geographic resolution signal unrelated
 * to answer trust, so it is not a number this module is entitled to
 * show. And no "cited by n sources" line: geography here is a RETRIEVAL
 * resolution, and no contract field states how many sources establish
 * it. Where E-13's caption asks for that count, this module prints the
 * resolution provenance it actually has instead.
 *
 * THE WORLD MAP LINK. `/map?country=<iso3>` is the convention the
 * product already uses (WorldMapGateway). No component currently reads
 * that parameter on /map, so the accessible name promises only to open
 * the world map — never to focus this country. When the map lane
 * consumes the parameter, this link starts focusing for free and the
 * wording can be strengthened then.
 */

export interface GeographicIntelligenceProps {
  geography: GeographicResolution;
  language?: LanguageCode;
}

export function GeographicIntelligence({
  geography,
  language = 'en',
}: GeographicIntelligenceProps): JSX.Element {
  const t = getDictionary(language).analysisWorkspace.geography;
  const resolved = geography.precision !== 'unresolved';
  const link = resolveGeographicLink(geography.countryCode);

  const countryLabel =
    link !== null
      ? getCountryDisplayName(link.iso2, language, geography.countryName ?? link.canonicalName)
      : geography.countryName;

  const precisionTag =
    geography.precision === 'city'
      ? t.precision.city
      : geography.precision === 'country'
        ? t.precision.country
        : t.precision.unresolved;

  /* The alternative text names country and precision and nothing else.
     R1/E-13: rings must never be described as coordinates. */
  const alternative = resolved
    ? `${t.moduleLabel}: ${countryLabel ?? t.precision.unresolved}, ${precisionTag}`
    : `${t.moduleLabel}: ${t.noResolution}`;

  return (
    <section
      aria-label={t.moduleLabel}
      className="overflow-hidden rounded-gn-module border border-gn-line-geo bg-gradient-to-b from-gn-geo-wash to-gn-page"
    >
      <header className="flex items-center justify-between gap-3 border-b border-gn-line-geo-soft px-[14px] py-[11px]">
        <span className="font-gn-mono text-gn-hud-label uppercase text-gn-geo-header">
          {t.moduleLabel}
        </span>
        <span className="font-gn-mono text-gn-hud-micro uppercase text-gn-geo-dim">
          {precisionTag}
        </span>
      </header>

      {resolved && (
        <div
          role="img"
          aria-label={alternative}
          className="relative h-[132px] bg-gn-geo-surface bg-gn-geo-grid bg-[length:22px_22px]"
        >
          {/* Centre crosshair axes — E-13 HUD. Decorative. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-1/2 h-px bg-gn-line-geo-soft"
          />
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-1/2 w-px bg-gn-line-geo-soft"
          />
          {/*
            Certainty-area device. Centred by construction: the rings
            express the SIZE of the resolved area, never a location
            within it. A pin here would be a coordinate claim.
          */}
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 h-[56px] w-[56px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gn-line-geo motion-safe:animate-gn-pulse"
          />
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 h-[32px] w-[32px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gn-geo/60"
          />
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gn-geo"
          />
          <span
            aria-hidden="true"
            className="absolute bottom-[9px] left-3 font-gn-mono text-gn-hud-micro uppercase text-gn-geo-dim"
          >
            {t.mapModule}
          </span>
        </div>
      )}

      <div className="px-[14px] py-3">
        {resolved && countryLabel !== null ? (
          <>
            <p className="font-gn-display text-gn-geo-country text-gn-ink-geo">{countryLabel}</p>
            {geography.precision === 'city' && geography.city !== null && (
              <p className="mt-[2px] font-gn-display text-gn-cell-value text-gn-ink-geo-soft">
                {geography.city}
              </p>
            )}
            <p className="mt-2 font-gn-mono text-gn-hud-micro uppercase text-gn-geo-dim">
              {/*
                No "CITED BY n SOURCES" — see this file's header. What the
                payload does support is HOW the location was resolved, and
                the hard statement that nothing finer exists in evidence.
              */}
              {geography.matchedFrom !== null && `${t.resolvedFrom} ${geography.matchedFrom} · `}
              {t.noSubnationalPrecision}
            </p>
            {link !== null && (
              <a
                href={`/map?country=${link.iso3}`}
                aria-label={t.openWorldMap}
                className="mt-3 inline-flex min-h-[44px] items-center font-gn-mono text-gn-hud-toggle uppercase text-gn-geo-header transition-colors duration-[120ms] hover:text-gn-geo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
              >
                {t.openWorldMap} &rarr;
              </a>
            )}
          </>
        ) : (
          /* Unresolved: header and this line only. No surface, no marker,
             no rings — an empty map device would imply a failed lookup of
             something that exists. */
          <p className="font-gn-mono text-gn-hud-meta uppercase text-gn-hud-faint">
            {t.noResolution}
          </p>
        )}
      </div>
    </section>
  );
}
