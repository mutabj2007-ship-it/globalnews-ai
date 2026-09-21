import { useState } from 'react';
import { findCountryByIso2, type LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { CountryFollowControl } from '@/components/home/CountryFollowControl';
import { formatUtcClock } from '@/lib/formatRelativeTime';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import type { TodayCountryCount } from '@/lib/homeFeedAllocation';

/**
 * R2 — TODAY GEOGRAPHIC INTELLIGENCE, AT COUNTRY PRECISION AND NO FINER.
 *
 * ── WHY THIS IS A LIST AND NOT THE APPROVED TILE GRID ─────────────────────
 *
 * The design's geographic comparison is a two-channel device: an observed
 * ACTIVITY ramp and a source COVERAGE state, with two adjacent legends that
 * are never merged, because an uncovered unit must never read as a quiet one.
 * This surface can compute the first channel honestly — these are real records
 * in hand — and cannot compute the second at all: coverage needs outlet and
 * cluster counts per country, which do not exist for a retrieved headline.
 *
 * The design's own rule decides it: a component that cannot fill every
 * applicable field does not render. So the tile grid is not drawn, and the
 * documented fallback ships instead — the values as a labelled list. The tiles
 * arrive when coverage does.
 *
 * NO SHAPED MAP AND NO CHOROPLETH, EVER — not as a fallback and not at any
 * tier. A shape implies an area measurement this product has never made.
 *
 * ── PRECISION CEILING ─────────────────────────────────────────────────────
 *
 * NewsArticle carries countryCode and countryName and nothing finer; its own
 * contract says COUNTRY PRECISION ONLY. No coordinate, region, district,
 * county or voivodeship exists in any contract or table, so none can appear
 * here. The spec enforces that as a source guard rather than trusting review.
 *
 * ── ABSENCE IS A ROW, NOT A GAP ───────────────────────────────────────────
 *
 * Records whose country did not resolve get their own first-class row with
 * their own count. Hiding them would let the country list read as a complete
 * account of the retrieval when it is not, and absence here means "we do not
 * know", never "nowhere".
 *
 * ── THE WORLD MAP LINK PROMISES ONLY WHAT IT DELIVERS ─────────────────────
 *
 * It carries the current canonical country-selection URL: both the legacy
 * `country=<iso3>` scope key and the semantic `sel=country:<iso3>` identity.
 * Map selection therefore survives navigation without any provider read; the
 * destination remains geographic scope until the reader explicitly requests
 * country intelligence.
 */
interface TodayGeographicIntelligenceProps {
  countries: TodayCountryCount[];
  unresolvedCount: number;
  /** Total records inside the window — the denominator every row is a share of. */
  totalRecords: number;
  /** ISO-2 of the active filter, or null for "all countries". */
  selectedCountry: string | null;
  onSelectCountry: (countryCode: string | null) => void;
  /** ISO-8601 UTC start of the window this list describes. */
  windowStart: string;
  /** The page-render instant, for the contract footer's UPDATED field. */
  updatedAt: string;
  /*
    R4 — FOLLOW STATE, PASSED IN AND NEVER FETCHED HERE.

    This component issues no request of its own and holds no follow state: the
    ONE hook instance lives in TodaySection, so a single mount produces a single
    read of the follow API rather than one read per surface that draws a control.

    `followedCodes` is null when no follow list is available to this visitor —
    anonymous, or a read that did not succeed. In that case NO CONTROL IS
    RENDERED AT ALL, rather than a disabled one: a dead affordance invites a tap
    that cannot work and takes a 44px target from a row that needs it. The
    invitation lives once, in the Watch module, where there is room to explain it.

    Codes here are ISO-3, the alphabet the follow API speaks. The row's own
    `countryCode` is ISO-2. The two are joined through `findCountryByIso2`, the
    canonical resolver this file already imports — never by truncation.
  */
  followedCodes: string[] | null;
  /** True once the account holds as many follows as the server itself permits. */
  atFollowLimit: boolean;
  pendingCountry: string | null;
  failedCountry: string | null;
  onFollow: (countryCode: string) => void;
  onUnfollow: (countryCode: string) => void;
  language: LanguageCode;
}

const ROW_BUTTON =
  'flex min-w-0 flex-1 min-h-[44px] items-center justify-between gap-[10px] rounded-gn-cell px-[10px] text-left outline-none transition-colors hover:bg-gn-geo-wash focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-gn-focus';

export function TodayGeographicIntelligence({
  countries,
  unresolvedCount,
  totalRecords,
  selectedCountry,
  onSelectCountry,
  windowStart,
  updatedAt,
  followedCodes,
  atFollowLimit,
  pendingCountry,
  failedCountry,
  onFollow,
  onUnfollow,
  language,
}: TodayGeographicIntelligenceProps): JSX.Element {
  /*
    R2.1 C8 — DISCLOSURE STATE, HELD HERE AND NOWHERE ELSE.

    This replaces a native <details>. The correction requires aria-expanded
    BOUND TO STATE, and a static aria-expanded on a <summary> would have been a
    claim the attribute did not actually track. A real button with real state
    tracks it honestly, keeps Enter and Space native, and lets the chevron be
    driven by the same value the assistive-technology state comes from.

    This is DISCLOSURE state only. It is not selection state: the country filter
    still has exactly one owner in TodaySection, and nothing here duplicates it.
  */
  const [valuesShown, setValuesShown] = useState(false);
  const t = getDictionary(language).today;

  const label = (row: TodayCountryCount): string =>
    getCountryDisplayName(row.countryCode, language, row.countryName);

  /*
    R4 — THE ONE CONVERSION, THROUGH THE ONE CANONICAL RESOLVER.

    `row.countryCode` is ISO-2; the follow API is ISO-3. `findCountryByIso2` is
    the released lookup this file already uses for the World Map link, so the
    two call sites cannot disagree. There is no `slice(0, 2)` and no second
    mapping table anywhere in this lane: "POL".slice(0, 2) is "PO", which is not
    a country, and a truncation like that fails silently and forever.
  */
  const followCodeFor = (row: TodayCountryCount): string | undefined =>
    findCountryByIso2(row.countryCode)?.iso3;

  /*
    The R-34 contract line, in the order the visualization system fixes:
    METRIC · UNIT · GEOGRAPHY · PERIOD · BASIS · UPDATED · COVERAGE.

    PERIOD is absolute, never "recent": the ISO date of the UTC day plus its
    explicit bounds. COVERAGE states "not assessed" rather than being omitted,
    because silence would read as adequate coverage — and coverage genuinely
    was not measured here.
  */
  const period = `${windowStart.slice(0, 10)} 00:00–24:00 UTC`;
  const contract = [
    `${t.contractMetricLabel} ${t.contractMetricValue}`,
    `${t.contractUnitLabel} ${t.contractUnitValue}`,
    `${t.contractGeographyLabel} ${t.contractGeographyValue}`,
    `${t.contractPeriodLabel} ${period}`,
    `${t.contractBasisLabel} ${t.contractBasisValue}`,
    `${t.contractUpdatedLabel} ${formatUtcClock(updatedAt)}`,
    `${t.contractCoverageLabel} ${t.contractCoverageValue}`,
  ].join(' · ');

  return (
    <section
      id="today-geography"
      aria-labelledby="today-geo-heading"
      className="rounded-gn-module border border-gn-line-structural bg-gn-panel p-[18px]"
    >
      <h3
        id="today-geo-heading"
        className="font-gn-mono text-gn-hud-section uppercase text-gn-ink-meta"
      >
        {t.geoHeading}
      </h3>
      {/* Design 06 §2: the question line is the suppression test, so it is mandatory. */}
      <p className="mt-[6px] font-gn-display text-gn-prose text-gn-ink-secondary">{t.geoQuestion}</p>

      <ul className="mt-[12px] flex flex-col gap-[2px]">
        <li className="flex items-center gap-[6px]">
          <button
            type="button"
            aria-pressed={selectedCountry === null}
            onClick={() => onSelectCountry(null)}
            className={`${ROW_BUTTON} ${selectedCountry === null ? 'bg-gn-geo-tint' : ''}`}
          >
            <span className="font-gn-display text-gn-geo-country text-gn-ink-primary">
              {t.filterAll}
            </span>
            <span className="font-gn-mono text-gn-hud-value text-gn-ink-value">{totalRecords}</span>
          </button>
        </li>

        {countries.map((row) => {
          const followCode = followCodeFor(row);
          const isFollowed = followCode !== undefined && (followedCodes?.includes(followCode) ?? false);
          /*
            The control renders ONLY when pressing it can actually do something:
            never for a visitor with no follow list, never for a country the
            resolver could not place, and never to add a country once the account
            is at the ceiling the server itself reports. Unfollowing always
            remains available, because a reader must be able to undo what they
            did even at the limit.
          */
          const showControl =
            followedCodes !== null && followCode !== undefined && (isFollowed || !atFollowLimit);

          return (
            <li key={row.countryCode} className="flex items-center gap-[6px]">
              <button
                type="button"
                aria-pressed={selectedCountry === row.countryCode}
                onClick={() => onSelectCountry(row.countryCode)}
                className={`${ROW_BUTTON} ${selectedCountry === row.countryCode ? 'bg-gn-geo-tint' : ''}`}
              >
                <span className="font-gn-display text-gn-geo-country text-gn-ink-primary">
                  {label(row)}
                </span>
                <span className="font-gn-mono text-gn-hud-value text-gn-ink-value">{row.count}</span>
              </button>
              {showControl && (
                <CountryFollowControl
                  countryCode={followCode as string}
                  countryLabel={label(row)}
                  isFollowed={isFollowed}
                  isPending={pendingCountry === followCode}
                  hasFailed={failedCountry === followCode}
                  onFollow={onFollow}
                  onUnfollow={onUnfollow}
                  language={language}
                />
              )}
            </li>
          );
        })}

        {unresolvedCount > 0 && (
          /*
            NOT a filter, deliberately. "No country resolved" is an absence of
            evidence, not a place, and offering it as a selectable unit beside
            real countries would quietly turn it into one.
          */
          <li className="mt-[6px] border-t border-gn-line-telemetry pt-[8px]">
            <div className="flex items-center justify-between gap-[10px] px-[10px]">
              {/*
                R2.1 C3 — SUBORDINATE, AND STILL FULLY PRESENT.

                gn-hud-faint is #4a5c73, the hue the design reserves for UNKNOWN
                and deliberately keeps outside the six semantic ones, because "we
                did not look" is not a finding. That is exactly what an
                unresolved country is. The count and the caption stay: making it
                quieter must never make it disappear.
              */}
              <span className="font-gn-display text-gn-geo-country text-gn-hud-faint">
                {t.unresolvedLabel}
              </span>
              <span className="font-gn-mono text-gn-hud-value text-gn-hud-faint">
                {unresolvedCount}
              </span>
            </div>
            <p className="mt-[4px] px-[10px] font-gn-display text-gn-hud-meta text-gn-hud-faint">
              {t.unresolvedNote}
            </p>
          </li>
        )}
      </ul>

      {/*
        Design 08 §3 makes an on-demand data table the accessible equivalent of
        every statistical component. A native <details> carries it with no
        state, no script and full keyboard support.
      */}
      <div className="mt-[12px]">
        <button
          type="button"
          aria-expanded={valuesShown}
          aria-controls="today-geo-values"
          aria-label={t.geoValuesToggleAria}
          onClick={() => setValuesShown((shown) => !shown)}
          className="inline-flex min-h-[44px] items-center gap-[6px] font-gn-mono text-gn-hud-toggle uppercase text-gn-ink-toggle outline-none transition-colors hover:text-gn-ink-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
        >
          {/* A TEXT chevron, not an icon: this component draws no SVG, and the
              rotation direction is the same cue sighted readers already know. */}
          <span aria-hidden="true">{valuesShown ? '\u25be' : '\u25b8'}</span>
          {valuesShown ? t.hideValues : t.showValues}
        </button>

        {valuesShown && (
          <table id="today-geo-values" className="mt-[8px] w-full border-collapse text-left">
            <caption className="sr-only">{t.tableCaption}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-b border-gn-line-telemetry py-[6px] font-gn-mono text-gn-hud-cell-label uppercase text-gn-ink-meta"
                >
                  {t.tableCountryHeading}
                </th>
                <th
                  scope="col"
                  className="border-b border-gn-line-telemetry py-[6px] text-right font-gn-mono text-gn-hud-cell-label uppercase text-gn-ink-meta"
                >
                  {t.tableCountHeading}
                </th>
              </tr>
            </thead>
            <tbody>
              {countries.map((row) => (
                <tr key={row.countryCode}>
                  <th
                    scope="row"
                    className="py-[5px] font-gn-display text-gn-hud-cell font-normal text-gn-ink-secondary"
                  >
                    {label(row)}
                  </th>
                  <td className="py-[5px] text-right font-gn-mono text-gn-hud-cell text-gn-ink-value">
                    {row.count}
                  </td>
                </tr>
              ))}
              {unresolvedCount > 0 && (
                <tr>
                  <th
                    scope="row"
                    className="py-[5px] font-gn-display text-gn-hud-cell font-normal text-gn-hud-faint"
                  >
                    {t.unresolvedLabel}
                  </th>
                  <td className="py-[5px] text-right font-gn-mono text-gn-hud-cell text-gn-hud-faint">
                    {unresolvedCount}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <a
        href={
          selectedCountry === null
            ? '/map'
            : (() => { const iso3 = findCountryByIso2(selectedCountry)?.iso3 ?? selectedCountry; return `/map?country=${encodeURIComponent(iso3)}&sel=${encodeURIComponent(`country:${iso3}`)}`; })()
        }
        aria-label={t.openWorldMap}
        className="mt-[12px] inline-flex min-h-[44px] items-center rounded-gn-pill border border-gn-line-pill px-[12px] font-gn-mono text-gn-hud-toggle uppercase text-gn-ink-active outline-none transition-colors hover:border-gn-line-pill-hover hover:bg-gn-pill-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
      >
        {t.openWorldMap}
      </a>

      <p className="mt-[12px] border-t border-gn-line-telemetry pt-[8px] font-gn-mono text-gn-hud-micro uppercase leading-[1.6] text-gn-ink-tertiary">
        {contract}
      </p>
      <p className="mt-[6px] font-gn-display text-gn-hud-meta text-gn-ink-tertiary">
        {pluralWithForms(totalRecords, language, t.recordForms)} {t.summaryAcross}{' '}
        {pluralWithForms(countries.length, language, t.countryForms)}
      </p>
    </section>
  );
}
