'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import Link from 'next/link';
import { COUNTRIES, HOME_REGION_ORDER, getLocalizedCountryName, type DisplayLocale, type HomeRegionId } from '@globalnews-ai/shared';
import { d01Strings, fillD01 } from '@/lib/ask/d01Strings';
import { askDiscoverStrings } from '@/lib/ask/askDiscoverStrings';
import { MY_UPDATES_HREF } from '@/lib/ask/followedQuestions';
import { browseRegionStories, type PickerSearchResult } from '@/lib/api/storyPickerApi';
import { PICKER_PUBLISHER_CONTENT } from '@/lib/rights/pickerPublisherContent';
import { useCountryFollows } from '@/components/home/useCountryFollows';
import { askFormatLocalDayCompact } from '@/lib/ask/askDirection';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK D0.1 · D2 — MY UPDATES › CHOOSE A PLACE (S07) AND THE PLACE VIEW (S08)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A separate drill-in from My updates; the followed-question page is untouched (D06).
 *
 *   CHOOSING IS EPHEMERAL (D03, G1-2). The selected place lives in this component's state only.
 *            Nothing is written: no CountryFollow, no preference, no URL the account remembers.
 *            The country search filters the static registry in the browser — no request — and
 *            the reader's location is never used (no IP geolocation).
 *   FOLLOW IS EXPLICIT (G1-3). Only the Follow button POSTs /follows/countries, through the
 *            existing useCountryFollows hook (existing multiple follows preserved).
 *   ROWS ARE GATED. Under the HOLD default no reporting is requested (pickerPublisherContent);
 *            the accepted rights-hold notice is shown. When E1 clears the surface:
 *              coverage region  → the existing bounded retained browse (q='' + region, N1);
 *              single country   → NO read path exists for an unfollowed country (S07 NEEDS_BACKEND),
 *                                 and the followed-country feed is itself under E1 hold (G1-4).
 *                                 That is stated, never simulated.
 *   "ADDED SINCE YOUR LAST VISIT" (G1-5, Q7) needs the account's visit boundary, which today is
 *            served only inside the feed together with publisher rows. Under HOLD it is therefore
 *            not shown — never invented.
 *   RESEARCH NEW CHANGES (G1-6) opens Ask with a draft (/ask?q=…). Nothing runs until Send.
 */
type Place =
  | { readonly kind: 'region'; readonly region: HomeRegionId }
  | { readonly kind: 'country'; readonly iso3: string; readonly iso2: string; readonly name: string };

function countryName(iso2: string, fallback: string, locale: DisplayLocale): string {
  return getLocalizedCountryName(iso2, locale) ?? fallback;
}

export function ChoosePlace({ locale }: { readonly locale: DisplayLocale }): JSX.Element {
  const [place, setPlace] = useState<Place | null>(null);
  return place === null ? (
    <PlaceChooser locale={locale} onChoose={setPlace} />
  ) : (
    <PlaceView locale={locale} place={place} onChange={() => setPlace(null)} />
  );
}

function BackToUpdates({ locale }: { readonly locale: DisplayLocale }): JSX.Element {
  const s = d01Strings(locale);
  return (
    <Link href={MY_UPDATES_HREF} prefetch={false} data-ask="place-back" className="inline-flex min-h-11 items-center text-[15px] font-medium text-signal">
      ‹ {s.updates}
    </Link>
  );
}

function regionLabel(region: HomeRegionId, locale: DisplayLocale): string {
  const s = d01Strings(locale);
  return region === 'region:east-africa' ? s.ea : region === 'region:european-union' ? s.eu : s.me;
}

function PlaceChooser({ locale, onChoose }: { readonly locale: DisplayLocale; readonly onChoose: (place: Place) => void }): JSX.Element {
  const s = d01Strings(locale);
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const term = q.trim().toLocaleLowerCase();
    if (term.length < 2) return [];
    return COUNTRIES.map((c) => ({ iso3: c.iso3, iso2: c.iso2, name: countryName(c.iso2, c.name, locale) }))
      .filter((c) => c.name.toLocaleLowerCase().includes(term))
      .slice(0, 8);
  }, [q, locale]);

  return (
    <div data-ask="choose-place" className="mx-auto flex max-w-3xl flex-col gap-3">
      <BackToUpdates locale={locale} />
      <h1 className="font-display text-[26px] font-semibold text-ink-primary">{s.choosePlace}</h1>
      <p className="text-[15px] leading-snug text-ink-secondary">{s.chooseIntro}</p>
      <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-3">
        <span aria-hidden="true" className="text-ink-tertiary">⌕</span>
        <input
          type="search"
          data-ask="place-search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={s.searchPlace}
          aria-label={s.searchPlace}
          className="w-full bg-transparent text-[15px] text-ink-primary outline-none placeholder:text-ink-tertiary"
        />
      </label>
      {matches.length > 0 && (
        <ul data-ask="place-matches" className="overflow-hidden rounded-xl border border-border bg-surface">
          {matches.map((c) => (
            <li key={c.iso3} className="border-b border-border last:border-b-0">
              <button type="button" onClick={() => onChoose({ kind: 'country', ...c })} className="flex min-h-12 w-full items-center justify-between px-3.5 text-start text-[15px] text-ink-primary">
                {c.name}
                <span aria-hidden="true" className="text-ink-tertiary">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-2 text-[14px] text-ink-secondary">{s.focusH}</h2>
      <ul data-ask="coverage-focus-list" className="overflow-hidden rounded-xl border border-border bg-surface">
        {HOME_REGION_ORDER.map((region) => (
          <li key={region} className="border-b border-border last:border-b-0">
            <button type="button" data-ask={`place-${region}`} onClick={() => onChoose({ kind: 'region', region })} className="flex min-h-12 w-full items-center justify-between px-3.5 text-start text-[15px] text-ink-primary">
              {regionLabel(region, locale)}
              <span aria-hidden="true" className="text-ink-tertiary">›</span>
            </button>
          </li>
        ))}
      </ul>
      <p data-ask="place-browse-note" className="text-[13px] text-ink-tertiary">
        {s.browseNote}
      </p>
    </div>
  );
}

function Notice({ kind, children }: { readonly kind: string; readonly children: string }): JSX.Element {
  return (
    <p role="status" data-ask={`place-notice-${kind}`} className="rounded-xl bg-surface-raised px-3.5 py-3 text-[14px] leading-snug text-ink-primary">
      {children}
    </p>
  );
}

/** EN source; not in the D0.1 copy deck. Flagged for Design/Claude L with the NEEDS_BACKEND item. */
const NO_SINGLE_COUNTRY_READ = 'Reporting for a single country you do not follow is not available yet.';

function PlaceView({ locale, place, onChange }: { readonly locale: DisplayLocale; readonly place: Place; readonly onChange: () => void }): JSX.Element {
  const s = d01Strings(locale);
  const g = askDiscoverStrings(locale);
  const name = place.kind === 'region' ? regionLabel(place.region, locale) : place.name;
  const research = `/ask?q=${encodeURIComponent(`${g.draftRegion}${name}`)}`;
  return (
    <div data-ask="place-view" data-place-kind={place.kind} className="mx-auto flex max-w-3xl flex-col gap-3">
      <BackToUpdates locale={locale} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[26px] font-semibold text-ink-primary">{name}</h1>
        <button type="button" data-ask="place-change" onClick={onChange} className="min-h-11 text-[15px] font-medium text-signal">
          {s.change}
        </button>
      </div>
      {place.kind === 'country' && <FollowControl locale={locale} iso3={place.iso3} name={name} />}
      <PlaceRows locale={locale} place={place} />
      <div className="mt-4 flex flex-col items-center gap-2">
        <Link href={research} prefetch={false} data-ask="place-research" className="flex min-h-12 w-full items-center justify-center rounded-full border border-border bg-surface px-4 text-[15px] font-semibold text-ink-primary">
          {s.research}
        </Link>
        <p className="text-center text-[13px] text-ink-tertiary">{s.researchNote}</p>
      </div>
    </div>
  );
}

function FollowControl({ locale, iso3, name }: { readonly locale: DisplayLocale; readonly iso3: string; readonly name: string }): JSX.Element {
  const s = d01Strings(locale);
  const follows = useCountryFollows();
  const followed = follows.follows?.includes(iso3) === true;
  if (followed) {
    return (
      <p data-ask="place-followed" className="text-[13px] text-ink-secondary">
        ✓ {fillD01(s.follow, { p: name })}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        data-ask="place-follow"
        disabled={follows.pendingCountry === iso3}
        onClick={() => void follows.follow(iso3)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-signal px-4 text-[15px] font-semibold text-ink-primary"
      >
        + {fillD01(s.follow, { p: name })}
      </button>
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-tertiary">{s.notFollowed}</p>
    </div>
  );
}

function PlaceRows({ locale, place }: { readonly locale: DisplayLocale; readonly place: Place }): JSX.Element {
  const s = d01Strings(locale);
  const [result, setResult] = useState<PickerSearchResult | null>(null);
  useEffect(() => {
    if (PICKER_PUBLISHER_CONTENT !== 'CLEARED' || place.kind !== 'region') return undefined;
    let live = true;
    void browseRegionStories(place.region).then((next) => live && setResult(next));
    return () => {
      live = false;
    };
  }, [place]);

  if (PICKER_PUBLISHER_CONTENT !== 'CLEARED') return <Notice kind="rights-hold">{s.rightsHold}</Notice>;
  if (place.kind === 'country') return <Notice kind="no-single-country-read">{NO_SINGLE_COUNTRY_READ}</Notice>;
  if (result === null) return <></>;
  if (result.kind === 'UNAVAILABLE' || result.kind === 'NETWORK' || result.kind === 'TOO_SHORT') return <Notice kind="unavailable">{s.unavailable}</Notice>;
  if (result.kind === 'RIGHTS_HOLD') return <Notice kind="rights-hold">{s.rightsHold}</Notice>;
  return (
    <ul data-ask="place-rows" className="overflow-hidden rounded-xl border border-border bg-surface">
      {result.stories.map((story) => (
        <li key={story.articleRef} className="border-b border-border px-3.5 py-3 last:border-b-0">
          <span dir="auto" className="block text-[15px] font-medium leading-snug text-ink-primary">
            {story.title}
          </span>
          <span className="mt-1 block text-[13px] text-ink-tertiary">
            {story.publisher} ·{' '}
            {story.dateBasis === 'publisher'
              ? `${s.published} ${askFormatLocalDayCompact(new Date(story.date), locale, new Date())}`
              : fillD01(s.seenOn, { d: askFormatLocalDayCompact(new Date(story.date), locale, new Date()) })}
          </span>
        </li>
      ))}
    </ul>
  );
}
