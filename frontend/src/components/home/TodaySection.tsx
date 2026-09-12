'use client';

import { useState } from 'react';
import { findCountryByIso3, type LanguageCode, type NewsDataMode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { DataModeLabel } from '@/components/ui/DataModeLabel';
import { TodayCard } from '@/components/home/TodayCard';
import { TodayGeographicIntelligence } from '@/components/home/TodayGeographicIntelligence';
import { WatchModule } from '@/components/home/WatchModule';
import { useCountryFollows } from '@/components/home/useCountryFollows';
import type { TodayAllocation } from '@/lib/homeFeedAllocation';

/**
 * R2 — TODAY. THE ONE QUESTION: what did GlobalNews AI first observe today?
 *
 * ── ONE SURFACE, ONE STATE OWNER, ZERO NEW REQUESTS ───────────────────────
 *
 * Everything rendered here derives from `feed.today`, which allocateToday()
 * computed from the SAME single getHomeFeed() response the Hero and Global
 * Developments already read. No fetch, no route, no client of its own, and the
 * corpus width is unchanged at twelve. The only state is the country filter,
 * held here so the list and the country rows cannot disagree about what is
 * selected — the same single-owner pattern HeroFocusProvider established.
 *
 * ── WHAT IS DELIBERATELY ABSENT ───────────────────────────────────────────
 *
 * No state badge and no state filter row. The approved design gives Today six
 * information states, and every one of them derives from ANALYSIS records
 * while this surface lists RETRIEVED ARTICLES — so all six have zero instances
 * here, and the design's own rule is that a state with zero instances is not
 * rendered as an empty chip. The row is ABSENT, not empty; nothing is greyed
 * out and nothing says "coming soon". What fills the space is real: the
 * geography, the provenance and the first-observation time.
 *
 * No chart of any kind. The only immutable time basis available is our own
 * first-observation timestamp, which measures RETRIEVAL BEHAVIOUR — so every
 * upward slope in a plotted version would be an artefact of us querying more,
 * read by every viewer as world activity. Two counters and a list, with the
 * contract stated, say exactly as much as the data supports.
 *
 * ── THE COUNTS SAY WHAT THEY COUNTED ──────────────────────────────────────
 *
 * Both counters are qualified "in this retrieval", because this page can see
 * one response and not the database. A day-wide total would need an aggregate
 * endpoint that does not exist and is not this lane's to add. The bias line is
 * rendered as real copy rather than a tooltip: a country nobody queried has no
 * records here and is NOT quiet, and the reader is told so rather than left to
 * infer it.
 *
 * ── DEGRADED IS A DESIGNED STATE, NOT AN EMPTY ONE ────────────────────────
 *
 * firstSeenAt is absent whenever persistence did not record an article. That
 * is honest and it is not "old", so the two zero-record cases are separated:
 * nothing observed today, versus no first-observation recorded at all. Neither
 * hides the articles, and neither is styled as an error — both are results.
 */
interface TodaySectionProps {
  today: TodayAllocation;
  dataMode: NewsDataMode | null;
  /** The page-render instant, shared with the DATA STATUS row. */
  updatedAt: string;
  language: LanguageCode;
}

export function TodaySection({
  today,
  dataMode,
  updatedAt,
  language,
}: TodaySectionProps): JSX.Element {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  /*
    R4 — THE ONE FOLLOW-STATE INSTANCE ON THIS PAGE.

    The hook is called HERE and nowhere else, then handed down. Two surfaces
    draw follow controls — this section's Watch module and the country list —
    and a hook call in each would mean two reads of the follow API on a single
    mount. One call, one read: the same single-owner rule the country filter
    below already follows.

    NOTE WHAT THIS DOES NOT ADD TO THIS COMPONENT: no state, no effect, no
    timer and no request. The mount read lives inside the hook, and this file
    still owns exactly one piece of state — the country filter.
  */
  const watch = useCountryFollows();
  const t = getDictionary(language).today;

  const { records, countries, unresolvedCount, withoutFirstSeenCount, windowStart } = today;
  const hasRecords = records.length > 0;

  const visible =
    selectedCountry === null
      ? records
      : records.filter((record) => record.countryCode === selectedCountry);

  const atFollowLimit =
    watch.follows !== null && watch.maxFollows !== null && watch.follows.length >= watch.maxFollows;

  /*
    R4 — UNFOLLOWING THE COUNTRY YOU ARE FILTERED TO CLEARS THE FILTER.

    Leaving the list pinned to a country the reader just dropped is a stale
    selection — the same defect class as the stale reticle Step 4 chased down,
    and it belongs to whoever owns the state, which is this component. The
    follow API speaks ISO-3 and the filter is ISO-2, so the comparison goes
    through `findCountryByIso3`, the canonical resolver. Never a truncation.
  */
  async function unfollowCountry(countryCode: string): Promise<void> {
    const wasFiltered = findCountryByIso3(countryCode)?.iso2 === selectedCountry;
    await watch.unfollow(countryCode);
    if (wasFiltered) setSelectedCountry(null);
  }

  const followProps = {
    followedCodes: watch.follows,
    atFollowLimit,
    pendingCountry: watch.pendingCountry,
    failedCountry: watch.failedCountry,
    onFollow: (countryCode: string) => void watch.follow(countryCode),
    onUnfollow: (countryCode: string) => void unfollowCountry(countryCode),
  };

  /*
    Design 08 §1 — the three-second answer is the FIRST content in the DOM and
    is a text statement, not a visual. With no information states to name it is
    composed of counts alone, which is what the data supports.

    IT BRANCHES ON THE SAME CONDITION AS THE VISIBLE PANEL, deliberately. A
    render probe caught it saying "nothing first observed today" while the panel
    below said "no first-observation record" — two different results told to two
    different readers. A screen-reader summary that disagrees with the screen is
    worse than none.
  */
  const threeSecondAnswer = hasRecords
    ? `${pluralWithForms(records.length, language, t.recordForms)} ${t.summaryAcross} ${pluralWithForms(
        countries.length,
        language,
        t.countryForms,
      )}${unresolvedCount > 0 ? `, ${unresolvedCount} ${t.summaryUnresolvedSuffix}` : ''}.`
    : `${withoutFirstSeenCount > 0 ? t.degradedHeading : t.emptyHeading}.`;

  return (
    <section aria-labelledby="today-heading" className="py-[22px]">
      <p className="sr-only">{threeSecondAnswer}</p>

      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <div>
          <span className="block font-gn-mono text-gn-hud-label uppercase text-gn-ink-meta">
            {t.eyebrow}
          </span>
          <h2 id="today-heading" className="mt-[4px] font-gn-display text-gn-title text-gn-ink-strong">
            {t.heading}
          </h2>
        </div>
        <DataModeLabel dataMode={dataMode} language={language} />
      </div>

      {/*
        The two approved counters. Both carry the retrieval qualifier in their
        own label, so the number is never read as a day-wide total.
      */}
      <dl className="mt-[14px] grid grid-cols-1 gap-[10px] sm:grid-cols-2">
        <div className="rounded-gn-cell border border-gn-line-telemetry bg-gn-elevated p-[14px]">
          <dt className="font-gn-mono text-gn-hud-cell-label uppercase text-gn-ink-meta">
            {t.counterRecordsLabel}
          </dt>
          <dd className="mt-[6px] font-gn-display text-gn-cell-value text-gn-ink-strong">
            {records.length}
          </dd>
        </div>
        <div className="rounded-gn-cell border border-gn-line-telemetry bg-gn-elevated p-[14px]">
          <dt className="font-gn-mono text-gn-hud-cell-label uppercase text-gn-ink-meta">
            {t.counterCountriesLabel}
          </dt>
          <dd className="mt-[6px] font-gn-display text-gn-cell-value text-gn-ink-strong">
            {countries.length}
          </dd>
        </div>
      </dl>

      <p className="mt-[8px] font-gn-display text-gn-hud-meta text-gn-ink-tertiary">{t.biasNote}</p>

      {/*
        R2.1 C5 — A COMPACT GEOGRAPHIC SUMMARY, NOT A MOVED MODULE.

        The geography module stays where it is. What rises above the cards is one
        44px line that answers "where?" in the three seconds before anyone
        scrolls, and then hands off: it is an anchor to the module below, not a
        second copy of it.

        NO NEW DATA. Both numbers are already computed by allocateToday and
        already rendered further down — this restates them, adds nothing, and
        introduces no request, no field and no derivation.

        It renders only when there is something to say. With no resolved country
        and nothing unresolved there is no summary to give, and an empty strip
        would be chrome pretending to be information.
      */}
      {hasRecords && (countries.length > 0 || unresolvedCount > 0) && (
        <a
          href="#today-geography"
          aria-label={t.geoSummaryLink}
          className="mt-[8px] inline-flex min-h-[44px] items-center gap-[8px] rounded-gn-cell font-gn-mono text-gn-hud-cell uppercase text-gn-ink-toggle outline-none transition-colors hover:text-gn-ink-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
        >
          <span>{pluralWithForms(countries.length, language, t.countryCountForms)}</span>
          <span aria-hidden="true">&middot;</span>
          <span className="text-gn-hud-faint">
            {unresolvedCount} {t.unresolvedShort}
          </span>
          <span aria-hidden="true">&rarr;</span>
        </a>
      )}

      {/*
        R4 — WATCH, RENDERED IN EVERY STATE.

        It sits OUTSIDE the hasRecords branch deliberately. A reader who follows
        three countries must be told that this retrieval reached none of them,
        and that is precisely the case where there are no records at all — the
        state in which a module tucked inside the grid would silently vanish.

        Full width rather than inside the right-hand column: Watch answers a
        different question from the country list ("what did we first observe in
        YOUR countries?" rather than "where is this retrieval from?"), it carries
        its own R-34 contract, and it renders real cards, none of which fits a
        336px rail. The country list keeps its column and its position.
      */}
      <WatchModule
        countries={countries}
        records={records}
        unresolvedCount={unresolvedCount}
        follows={watch.follows}
        maxFollows={watch.maxFollows}
        isLoading={watch.isLoading}
        pendingCountry={watch.pendingCountry}
        failedCountry={watch.failedCountry}
        onFollow={followProps.onFollow}
        onUnfollow={followProps.onUnfollow}
        selectedCountry={selectedCountry}
        onSelectCountry={setSelectedCountry}
        windowStart={windowStart}
        updatedAt={updatedAt}
        language={language}
      />

      {hasRecords ? (
        <div className="mt-[14px] grid grid-cols-1 gap-[14px] lg:grid-cols-[minmax(0,1fr)_336px]">
          <div className="flex flex-col gap-[9px]">
            {visible.map((record) => (
              /* R0.5: identity is the URL. `id` is a 32-bit hash and two
                 providers carrying one story produce two ids for one row. */
              <TodayCard key={record.url} record={record} language={language} />
            ))}
          </div>

          <TodayGeographicIntelligence
            countries={countries}
            unresolvedCount={unresolvedCount}
            totalRecords={records.length}
            selectedCountry={selectedCountry}
            onSelectCountry={setSelectedCountry}
            windowStart={windowStart}
            updatedAt={updatedAt}
            {...followProps}
            language={language}
          />
        </div>
      ) : (
        <div className="mt-[14px] rounded-gn-module border border-gn-line-structural bg-gn-panel p-[18px]">
          <h3 className="font-gn-display text-gn-card-title text-gn-ink-primary">
            {withoutFirstSeenCount > 0 ? t.degradedHeading : t.emptyHeading}
          </h3>
          <p className="mt-[6px] font-gn-display text-gn-prose text-gn-ink-secondary">
            {withoutFirstSeenCount > 0 ? t.degradedBody : t.emptyBody}
          </p>
        </div>
      )}
    </section>
  );
}
