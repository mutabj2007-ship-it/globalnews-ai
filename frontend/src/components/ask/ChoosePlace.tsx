'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import Link from 'next/link';
import { COUNTRIES, HOME_REGION_ORDER, getLocalizedCountryName, type DisplayLocale, type HomeRegionId } from '@globalnews-ai/shared';
import { d01Strings, fillD01 } from '@/lib/ask/d01Strings';
import { placeResearchDraft } from '@/lib/ask/d01PlaceDraft';
import { MY_UPDATES_HREF } from '@/lib/ask/followedQuestions';
import { browseRegionStories, type PickerSearchResult } from '@/lib/api/storyPickerApi';
import { PICKER_PUBLISHER_CONTENT } from '@/lib/rights/pickerPublisherContent';
import { useCountryFollows } from '@/components/home/useCountryFollows';
import { askDirectionProps, askFormatLocalDayCompact } from '@/lib/ask/askDirection';
import tokens from '../account/settingsTokens.module.css';
import styles from './d01.module.css';

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
  return (
    <main className={`${tokens.settingsScope} ${styles.page}`} {...askDirectionProps(locale)}>
      {place === null ? (
        <PlaceChooser locale={locale} onChoose={setPlace} />
      ) : (
        <PlaceView locale={locale} place={place} onChange={() => setPlace(null)} />
      )}
    </main>
  );
}

function BackToUpdates({ locale }: { readonly locale: DisplayLocale }): JSX.Element {
  const s = d01Strings(locale);
  return (
    <Link href={MY_UPDATES_HREF} prefetch={false} data-ask="place-back" className={styles.back}>
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
    <div data-ask="choose-place" className={styles.pageInner}>
      <BackToUpdates locale={locale} />
      <h1 className={styles.pageTitle}>{s.choosePlace}</h1>
      <p className={styles.pageIntro}>{s.chooseIntro}</p>
      <label className={styles.search} style={{ borderColor: 'var(--ad-line-input, var(--ad-line))' }}>
        <span aria-hidden="true" className={styles.searchGlyph}>⌕</span>
        <input
          type="search"
          data-ask="place-search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={s.searchPlace}
          aria-label={s.searchPlace}
        />
      </label>
      {matches.length > 0 && (
        <ul data-ask="place-matches" className={styles.list}>
          {matches.map((c) => (
            <li key={c.iso3}>
              <button type="button" onClick={() => onChoose({ kind: 'country', ...c })} className={styles.row}>
                <span className={styles.rowMain}>{c.name}</span>
                <span aria-hidden="true" className={styles.chevron}>›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <h2 className={styles.small} style={{ marginTop: 8 }}>{s.focusH}</h2>
      <ul data-ask="coverage-focus-list" className={styles.list}>
        {HOME_REGION_ORDER.map((region) => (
          <li key={region}>
            <button type="button" data-ask={`place-${region}`} onClick={() => onChoose({ kind: 'region', region })} className={styles.row}>
              <span className={styles.rowMain}>{regionLabel(region, locale)}</span>
              <span aria-hidden="true" className={styles.chevron}>›</span>
            </button>
          </li>
        ))}
      </ul>
      <p data-ask="place-browse-note" className={styles.small}>
        {s.browseNote}
      </p>
    </div>
  );
}

function Notice({ kind, children }: { readonly kind: string; readonly children: string }): JSX.Element {
  return (
    <p role="status" data-ask={`place-notice-${kind}`} className={styles.notice}>
      {children}
    </p>
  );
}

/** EN source; not in the D0.1 copy deck. Flagged for Design/Claude L with the NEEDS_BACKEND item. */
const NO_SINGLE_COUNTRY_READ = 'Reporting for a single country you do not follow is not available yet.';

function PlaceView({ locale, place, onChange }: { readonly locale: DisplayLocale; readonly place: Place; readonly onChange: () => void }): JSX.Element {
  const s = d01Strings(locale);
  const name = place.kind === 'region' ? regionLabel(place.region, locale) : place.name;
  /* V-02 — a draft Ask can execute (no unsupported "this week" window); see d01PlaceDraft.ts */
  const research = `/ask?q=${encodeURIComponent(placeResearchDraft(locale, name))}`;
  return (
    <div data-ask="place-view" data-place-kind={place.kind} className={styles.pageInner}>
      <BackToUpdates locale={locale} />
      <div className={styles.titleRow}>
        <h1 className={styles.pageTitle}>{name}</h1>
        <button type="button" data-ask="place-change" onClick={onChange} className={styles.back}>
          {s.change}
        </button>
      </div>
      {place.kind === 'country' && <FollowControl locale={locale} iso3={place.iso3} name={name} />}
      <PlaceRows locale={locale} place={place} />
      <div className={styles.foot} style={{ paddingInline: 0, marginTop: 16 }}>
        <Link href={research} prefetch={false} data-ask="place-research" className={styles.secondary}>
          {s.research}
        </Link>
        <p className={styles.small} style={{ textAlign: 'center' }}>{s.researchNote}</p>
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
      <p data-ask="place-followed" className={styles.small}>
        ✓ {fillD01(s.follow, { p: name })}
      </p>
    );
  }
  return (
    <div className={styles.followRow}>
      <button
        type="button"
        data-ask="place-follow"
        disabled={follows.pendingCountry === iso3}
        onClick={() => void follows.follow(iso3)}
        className={styles.follow}
      >
        + {fillD01(s.follow, { p: name })}
      </button>
      <p className={styles.small} style={{ flex: 1, minWidth: 0 }}>{s.notFollowed}</p>
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
    <ul data-ask="place-rows" className={styles.list}>
      {result.stories.map((story) => (
        <li key={story.articleRef} className={styles.row} style={{ cursor: 'default' }}>
          <span className={styles.rowMain}>
          <span dir="auto" className={styles.rowTitle}>
            {story.title}
          </span>
          <span className={styles.rowMeta}>
            {story.publisher} ·{' '}
            {story.dateBasis === 'publisher'
              ? `${s.published} ${askFormatLocalDayCompact(new Date(story.date), locale, new Date())}`
              : fillD01(s.seenOn, { d: askFormatLocalDayCompact(new Date(story.date), locale, new Date()) })}
          </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
