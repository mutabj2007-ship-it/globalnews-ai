'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { findCountryByIso3, type LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { useCountryFollows } from '@/components/home/useCountryFollows';
import { MI_FOLLOW_OFF, MI_FOLLOW_ON, MI_PILL, MI_SHEET, MI_TARGET } from './miPresentation';
import { fill } from './MiPrimitives';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE DENSITY R1 — FOLLOWING IS ONE COMPACT CONTROL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Product Owner ruling C: followed countries do not get a large persistent
 * card. Overview shows ONE button — "Following 11 ▾" — and the list opens in a
 * bounded popover (tablet/desktop) or bottom sheet (phone), with its own
 * internal scroll, so eleven or fifty countries never lengthen the page.
 *
 * The list is owned by the EXISTING country Follow client, useCountryFollows()
 * — the same one Home and the Map use — mounted only while the list is open.
 * Opening therefore costs one account read (GET /follows/countries) and no AI
 * and no provider. Follow / Unfollow are that client's own mutations; there is
 * no second follow system, and nothing here touches Watch: cyan/neutral only,
 * never mint, and the dormant-Watch note stays.
 */

/** A local filter appears only when the list is long enough to need one. */
export const FOLLOWING_FILTER_THRESHOLD = 8;

function countryName(iso3: string, language: LanguageCode): string {
  const country = findCountryByIso3(iso3);
  return country === undefined ? iso3 : getCountryDisplayName(country.iso2, language, country.name);
}

export function FollowingList({
  language,
  fallbackFollows,
  newByCountry,
  onCountChange,
  bounded = true,
}: {
  language: LanguageCode;
  /** The follows the page already has (the feed), shown until the live list answers. */
  fallbackFollows: readonly string[] | null;
  newByCountry: Readonly<Record<string, number>>;
  onCountChange?: (count: number) => void;
  bounded?: boolean;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence.following;
  const follows = useCountryFollows();
  const [query, setQuery] = useState('');
  /* Unfollowed this session: kept in view so a mistaken tap can be undone. */
  const [released, setReleased] = useState<readonly string[]>([]);

  const live = follows.follows;
  const followed = useMemo(() => new Set(live ?? fallbackFollows ?? []), [fallbackFollows, live]);

  useEffect(() => {
    if (live !== null) onCountChange?.(live.length);
  }, [live, onCountChange]);

  const rows = useMemo(() => {
    const codes = [...new Set([...(live ?? fallbackFollows ?? []), ...released])];
    const named = codes.map((iso3) => ({ iso3, name: countryName(iso3, language) }));
    named.sort((a, b) => a.name.localeCompare(b.name, language));
    const needle = query.trim().toLocaleLowerCase(language);
    return needle.length === 0 ? named : named.filter((row) => row.name.toLocaleLowerCase(language).includes(needle));
  }, [fallbackFollows, language, live, query, released]);

  const total = followed.size + released.filter((code) => !followed.has(code)).length;

  return (
    <div data-mi-following-list="" className="flex min-h-0 flex-col">
      {total > FOLLOWING_FILTER_THRESHOLD && (
        <label className="mb-2 block">
          <span className="sr-only">{t.filterLabel}</span>
          {/* Local filtering of a list already on screen: free, no request. */}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.filterLabel}
            className="h-[40px] w-full rounded-[10px] border border-[#1d3a5a] bg-[#02101f] px-3 text-[13px] text-[#e4eefb] outline-none focus:border-[#2f6ea8]"
          />
        </label>
      )}

      {total === 0 ? (
        <p className="py-2 text-[13px] text-[#93a7bd]">{t.empty}</p>
      ) : rows.length === 0 ? (
        <p className="py-2 text-[13px] text-[#93a7bd]">{t.noMatch}</p>
      ) : (
        <ul
          data-mi-following-scroll=""
          className={`flex flex-col ${bounded ? 'min-h-0 overflow-y-auto overscroll-contain' : ''}`}
        >
          {rows.map(({ iso3, name }) => {
            const isFollowed = followed.has(iso3);
            const pending = follows.pendingCountry === iso3;
            const count = newByCountry[findCountryByIso3(iso3)?.iso2 ?? iso3] ?? 0;
            return (
              <li
                key={iso3}
                data-mi-following-row={iso3}
                className="flex items-center justify-between gap-3 border-b border-[#0a2744] py-2 last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-[#e4eefb]">{name}</span>
                  <span className="block text-[12px] text-[#7d92aa]">
                    {count > 0 ? fill(t.newSince, { count }) : t.nothingNew}
                  </span>
                  {follows.failedCountry === iso3 && (
                    <span role="status" className="block text-[12px] text-[#ff8d97]">
                      {fill(t.updateFailed, { country: name })}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  data-mi-follow-toggle={isFollowed ? 'following' : 'follow'}
                  disabled={pending}
                  aria-pressed={isFollowed}
                  aria-label={fill(isFollowed ? t.unfollowAria : t.followAria, { country: name })}
                  onClick={() => {
                    if (isFollowed) {
                      setReleased((current) => (current.includes(iso3) ? current : [...current, iso3]));
                      void follows.unfollow(iso3);
                    } else {
                      void follows.follow(iso3);
                    }
                  }}
                  className={`${MI_PILL} ${MI_TARGET} inline-flex h-[40px] min-w-[112px] shrink-0 items-center justify-center gap-1.5 px-3 text-[12.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] disabled:opacity-60 ${
                    isFollowed ? MI_FOLLOW_ON : MI_FOLLOW_OFF
                  }`}
                >
                  {isFollowed && (
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  )}
                  {isFollowed ? t.following : t.follow}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2 flex flex-col gap-2 border-t border-[#0a2744] pt-2.5">
        <Link href="/map" className="text-[12.5px] font-semibold text-[#5abff5]">
          {t.manage}
        </Link>
        <p className="text-[11.5px] leading-[1.45] text-[#7d92aa]">{t.watchDormant}</p>
      </div>
    </div>
  );
}

/**
 * The Overview control: ONE button, and the list in a bounded popout.
 * Opening, filtering and closing are free and local; only the list's own
 * account read happens, once per open.
 */
export function FollowingControl({
  language,
  follows,
  newByCountry,
}: {
  language: LanguageCode;
  follows: readonly string[] | null;
  newByCountry: Readonly<Record<string, number>>;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence.following;
  const [open, setOpen] = useState(false);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const count = liveCount ?? follows?.length ?? 0;

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (target && !panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  return (
    <div data-mi-following-control="" className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className={`${MI_PILL} ${MI_TARGET} inline-flex h-[44px] w-full items-center justify-between gap-2 border border-[#1b6fa8] bg-[#07304f] px-4 text-[13.5px] font-semibold text-[#cfe6ff] outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] md:w-auto`}
      >
        <span>{fill(t.button, { count })}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-[14px] w-[14px] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          {/* Phone scrim; the popover itself needs none. */}
          <div aria-hidden="true" className="fixed inset-0 z-[74] bg-[rgba(2,6,14,0.6)] md:hidden" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={t.listTitle}
            tabIndex={-1}
            data-mi-following-popout=""
            className={`${MI_SHEET} fixed inset-x-0 bottom-0 z-[75] flex max-h-[65dvh] flex-col border border-[#0e2d4d] bg-[#04162b] p-4 pb-[calc(16px+env(safe-area-inset-bottom))] outline-none md:absolute md:bottom-auto md:left-auto md:right-0 md:top-[calc(100%+8px)] md:max-h-[420px] md:w-[380px] md:rounded-[14px] md:pb-4 md:shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)]`}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-bold text-white">{t.listTitle}</h3>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={`${MI_TARGET} rounded-[10px] px-2 text-[13px] font-semibold text-[#5abff5] outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5]`}
              >
                {t.close}
              </button>
            </div>
            <FollowingList
              language={language}
              fallbackFollows={follows}
              newByCountry={newByCountry}
              onCountChange={setLiveCount}
            />
          </div>
        </>
      )}
    </div>
  );
}
