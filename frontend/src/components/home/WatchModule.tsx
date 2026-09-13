import { findCountryByIso3, type LanguageCode, type NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { formatUtcClock } from '@/lib/formatRelativeTime';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { TodayCard } from '@/components/home/TodayCard';
import { CountryFollowControl } from '@/components/home/CountryFollowControl';
import type { TodayCountryCount } from '@/lib/homeFeedAllocation';
import { accountSignInUrl } from '@/lib/api/accountBase';

/**
 * R4 — WATCH: WHAT DID WE FIRST OBSERVE TODAY IN THE COUNTRIES YOU FOLLOW?
 *
 * ── ZERO IS DRAWN. THIS IS THE MOST IMPORTANT RULE ON THE SURFACE ─────────
 *
 * A followed country with no records in this retrieval RENDERS, with its count
 * of zero and an explicit line: "Nothing retrieved for this country today."
 * NEVER "nothing happened". The homepage universe is twelve articles, so most
 * followed countries legitimately show zero on most visits — and a country
 * nobody queried is NOT a quiet country. Hiding the zero rows would turn our
 * retrieval budget into a claim about the world, which is exactly the failure
 * the design's P4 forbids. So the roster says which of your countries this
 * retrieval reached and which it did not, and both answers are real.
 *
 * ── FOUR STATES, EVERY ONE OF THEM A RESULT ───────────────────────────────
 *
 *   1. Reading        — the follow list has not come back yet.
 *   2. Anonymous      — following needs an account; the module says so once
 *                       and offers the released sign-in path. It never
 *                       disappears, and no dead follow control is drawn
 *                       anywhere on the page for this visitor.
 *   3. Signed in, no follows — an INVITATION naming what following does. No
 *                       default set is ever fabricated, and no country is
 *                       suggested by popularity, geography or address.
 *   4. Signed in, with follows — the roster, its counts, and the records.
 *
 * None of the four is an error, a blank or a skeleton.
 *
 * ── NOT AN ALERT ENGINE ───────────────────────────────────────────────────
 *
 * No timer, no polling, no listener, no socket, no worker, no notification, no
 * forecast, and none of the six information-state words. Watch reports one
 * retrieval; it does not watch the world between page loads, and it says
 * nothing about what changed since a previous visit.
 *
 * ── ONE FILTER OWNER, AND IT IS NOT THIS COMPONENT ────────────────────────
 *
 * `selectedCountry` belongs to TodaySection. Watch reads it and asks for
 * changes; it declares none of its own, so the record list, the country list
 * and this roster cannot disagree. Two consequences the CTO ruled binding:
 * the roster lists EVERY followed country regardless of the active filter,
 * because filtering is a view of today's records and must never look like you
 * stopped following something; and unfollowing the country currently filtered
 * clears the filter — handled by the owner, in TodaySection.
 *
 * ── UNRESOLVED RECORDS ARE STATED, NEVER ABSORBED ─────────────────────────
 *
 * A record with no country cannot match a followed one, so it is not in Watch.
 * It is not attributed to a followed country by source, proximity or any other
 * inference, and it is not drawn as a pseudo-country. It is COUNTED in one
 * line, so Watch's total is never read as everything today.
 *
 * ── ISO-3 IN, ISO-2 OUT, THROUGH THE ONE CANONICAL RESOLVER ───────────────
 *
 * The follow API speaks alpha-3; `NewsArticle.countryCode` is alpha-2. Every
 * conversion in this file goes through `findCountryByIso3`. There is no
 * `slice(0, 2)`, no `substring`, and no second mapping table — "POL".slice(0,2)
 * is "PO", which is not a country, and would silently match nothing forever.
 */
interface WatchModuleProps {
  /** Resolved countries in this retrieval, ISO-2, as allocateToday counted them. */
  countries: TodayCountryCount[];
  /** Every record inside the window — Watch selects its own subset. */
  records: NewsArticle[];
  unresolvedCount: number;
  /** Followed countries as ISO-3, or null when no list is available. */
  follows: string[] | null;
  maxFollows: number | null;
  isLoading: boolean;
  pendingCountry: string | null;
  failedCountry: string | null;
  onFollow: (countryCode: string) => void;
  onUnfollow: (countryCode: string) => void;
  /** ISO-2 of the shared filter, owned by TodaySection. */
  selectedCountry: string | null;
  onSelectCountry: (countryCode: string | null) => void;
  /** ISO-8601 UTC start of the window, for the R-34 contract. */
  windowStart: string;
  updatedAt: string;
  language: LanguageCode;
}

/*
  M-ALPHA-AUTH — a literal homepage destination rather than usePathname(),
  because this is a SERVER component: there is no client-side router hook
  available to it, and this module only ever renders on the homepage anyway.

  CTO requirement 9 is visible here. The user is returned to the page the Watch
  control lives on and presses Follow again. Nothing about this link causes a
  follow to be performed automatically after the OAuth round trip — an
  action replayed on the strength of a value that survived a redirect is a CSRF
  primitive, however well-signed the value is.
*/
const WATCH_RETURN_DESTINATION = '/';

const SHELL = 'rounded-gn-module border border-gn-line-structural bg-gn-panel p-[18px]';

const ROW_BUTTON =
  'flex min-w-0 flex-1 min-h-[44px] items-center justify-between gap-[10px] rounded-gn-cell px-[10px] text-left outline-none transition-colors hover:bg-gn-geo-wash focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-gn-focus';

interface WatchRow {
  iso3: string;
  iso2: string;
  label: string;
  canonicalName: string;
  count: number;
}

export function WatchModule({
  countries,
  records,
  unresolvedCount,
  follows,
  maxFollows,
  isLoading,
  pendingCountry,
  failedCountry,
  onFollow,
  onUnfollow,
  selectedCountry,
  onSelectCountry,
  windowStart,
  updatedAt,
  language,
}: WatchModuleProps): JSX.Element {
  const t = getDictionary(language).today;

  const heading = (
    <>
      <h3 id="today-watch-heading" className="font-gn-mono text-gn-hud-section uppercase text-gn-ink-meta">
        {t.watchHeading}
      </h3>
      <p className="mt-[6px] font-gn-display text-gn-prose text-gn-ink-secondary">{t.watchQuestion}</p>
    </>
  );

  const frame = (body: JSX.Element): JSX.Element => (
    <section id="today-watch" aria-labelledby="today-watch-heading" className={`mt-[14px] ${SHELL}`}>
      {heading}
      {body}
    </section>
  );

  /* STATE 1 — the list has not come back yet. A statement, not a skeleton. */
  if (isLoading) {
    return frame(
      <p className="mt-[10px] font-gn-display text-gn-watch text-gn-ink-tertiary">{t.watchReading}</p>,
    );
  }

  /*
    STATE 2 — ANONYMOUS. The module stays, states the requirement once, and
    offers the SAME released sign-in path the header already uses: a real
    navigation to the backend's Google entry point, because consent happens off
    this origin. No local identifier is minted as a stand-in.
  */
  if (follows === null) {
    return frame(
      <>
        <p className="mt-[10px] font-gn-display text-gn-watch text-gn-ink-watch">{t.watchAnonymous}</p>
        <a
          href={accountSignInUrl(WATCH_RETURN_DESTINATION)}
          className="mt-[10px] inline-flex min-h-[44px] items-center rounded-gn-pill border border-gn-line-pill px-[12px] font-gn-mono text-gn-hud-toggle uppercase text-gn-ink-active outline-none transition-colors hover:border-gn-line-pill-hover hover:bg-gn-pill-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
        >
          {t.watchSignIn}
        </a>
      </>,
    );
  }

  /*
    STATE 3 — SIGNED IN, NOTHING FOLLOWED. An invitation naming what following
    does. The affordance itself is the follow control on each country in the
    list below; nothing is suggested, ranked or pre-selected here.
  */
  if (follows.length === 0) {
    return frame(
      <p className="mt-[10px] font-gn-display text-gn-watch text-gn-ink-watch">{t.watchNoFollows}</p>,
    );
  }

  /*
    STATE 4 — THE ROSTER.

    Every followed country becomes a row whether or not this retrieval reached
    it. Ordering is count-descending, then by CANONICAL ENGLISH NAME so two
    readers in two languages see the same order — the same locale-independent
    rule allocateToday already uses for the country list.
  */
  const rows: WatchRow[] = follows
    .map((iso3): WatchRow | null => {
      const meta = findCountryByIso3(iso3);
      if (meta === undefined) return null;
      const counted = countries.find((row) => row.countryCode === meta.iso2);
      return {
        iso3: meta.iso3,
        iso2: meta.iso2,
        label: getCountryDisplayName(meta.iso2, language, meta.name),
        canonicalName: meta.name,
        count: counted?.count ?? 0,
      };
    })
    .filter((row): row is WatchRow => row !== null)
    .sort((a, b) => b.count - a.count || a.canonicalName.localeCompare(b.canonicalName, 'en'));

  const followedIso2 = new Set(rows.map((row) => row.iso2));
  const watched = records.filter(
    (record) => record.countryCode !== undefined && followedIso2.has(record.countryCode),
  );
  const atLimit = maxFollows !== null && rows.length >= maxFollows;

  /*
    The same R-34 contract R2's geography module carries, for the same reason
    and over the same retrieval: PERIOD is absolute rather than "recent", and
    COVERAGE states "not assessed" rather than being omitted, because silence
    would read as adequate coverage.
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

  return frame(
    <>
      <p className="mt-[10px] font-gn-mono text-gn-hud-cell uppercase text-gn-ink-meta">
        {pluralWithForms(rows.length, language, t.watchFollowedForms)}
        {maxFollows !== null && (
          <>
            {' '}
            <span className="text-gn-hud-faint">
              {t.watchCapacityOf} {maxFollows}
            </span>
          </>
        )}
      </p>

      <ul className="mt-[12px] flex flex-col gap-[2px]">
        {rows.map((row) => (
          <li key={row.iso3} className="flex items-center gap-[6px]">
            <button
              type="button"
              aria-pressed={selectedCountry === row.iso2}
              onClick={() => onSelectCountry(selectedCountry === row.iso2 ? null : row.iso2)}
              className={`${ROW_BUTTON} ${selectedCountry === row.iso2 ? 'bg-gn-geo-tint' : ''}`}
            >
              <span className="min-w-0 font-gn-display text-gn-geo-country text-gn-ink-primary">
                {row.label}
                {row.count === 0 && (
                  /*
                    THE HONESTY LINE. It says what WE did, never what the world
                    did, and it is rendered as real copy rather than a tooltip.
                  */
                  <span className="mt-[2px] block font-gn-display text-gn-hud-meta normal-case text-gn-hud-faint">
                    {t.watchZeroRecords}
                  </span>
                )}
              </span>
              <span
                className={`font-gn-mono text-gn-hud-value ${
                  row.count === 0 ? 'text-gn-hud-faint' : 'text-gn-ink-value'
                }`}
              >
                {row.count}
              </span>
            </button>
            <CountryFollowControl
              countryCode={row.iso3}
              countryLabel={row.label}
              isFollowed
              isPending={pendingCountry === row.iso3}
              hasFailed={failedCountry === row.iso3}
              onFollow={onFollow}
              onUnfollow={onUnfollow}
              language={language}
            />
          </li>
        ))}
      </ul>

      {atLimit && (
        <p className="mt-[8px] font-gn-display text-gn-hud-meta text-gn-ink-tertiary">{t.watchAtLimit}</p>
      )}

      {unresolvedCount > 0 && (
        /*
          Stated once, so Watch's own total is never read as everything today.
          It is a count, not a place, and nothing here attributes it to anyone.
        */
        <p className="mt-[8px] font-gn-display text-gn-hud-meta text-gn-ink-tertiary">
          {unresolvedCount} {t.watchUnresolvedNote}
        </p>
      )}

      {watched.length > 0 && (
        <div className="mt-[12px] flex flex-col gap-[9px]">
          {/* The SAME card the list below uses. No forked card, no second
              analysis link builder, no field this surface adds of its own. */}
          {watched.map((record) => (
            <TodayCard key={record.url} record={record} language={language} />
          ))}
        </div>
      )}

      {watched.length === 0 && (
        <p className="mt-[12px] font-gn-display text-gn-watch text-gn-ink-tertiary">
          {t.watchNothingRetrieved}
        </p>
      )}

      <p className="mt-[12px] border-t border-gn-line-telemetry pt-[8px] font-gn-mono text-gn-hud-micro uppercase leading-[1.6] text-gn-ink-tertiary">
        {contract}
      </p>
    </>,
  );
}
