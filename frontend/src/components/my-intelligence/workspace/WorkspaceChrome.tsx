'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LanguageCode } from '@globalnews-ai/shared';
import { findCountryByIso3 } from '@globalnews-ai/shared';
import { ArrowLeft, Building2, Info, Menu, Search, Vote, X } from 'lucide-react';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { electionLiveRouteMayOpen } from '@/lib/election/electionPreview';
import { MI_CARD, MI_FOCUS, MI_SAND_FOCUS, MI_SELECTION_MODE_CONTROL, MI_TARGET } from '../miPresentation';
import { CountryChip, fill } from '../MiPrimitives';
import { ActionPill, MI_ACTIONS, storiesSelectedLabel, type ActionId } from '../MiSelection';
import type { FixtureStory } from '../devFixtures';
import {
  ACCOUNT_SETTINGS_HREF,
  ELECTIONS_PREVIEW_HREF,
  IMIHIGO_HREF,
  RAIL,
  SEARCH_HREF,
  electionsSupportedFor,
} from './miWorkspaceModel';

/* ═══ PHONE WORKSPACE HEADER (D3) ═════════════════════════════════════════ */

/**
 * menu 44 · "GLOBALNEWSAI" micro-label + "My Intelligence" · search 44 ·
 * avatar 44. Search opens the search page WITHOUT a query (a `?q=` would
 * auto-run analysis); the avatar opens account settings.
 */
export function WorkspacePhoneHeader({
  language,
  initial,
  onMenu,
  showMenu,
}: {
  language: LanguageCode;
  initial: string | null;
  onMenu: () => void;
  showMenu: boolean;
}): JSX.Element {
  const mi = getDictionary(language).myIntelligence;
  const w = mi.workspace;

  return (
    <header data-mi-phone-header="" className="sticky top-0 z-40 border-b border-[#0a2744] bg-[rgba(1,10,25,0.94)] pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
      <div className="flex h-[56px] items-center gap-2 px-2">
        {showMenu ? (
          <button type="button" aria-label={w.openMenu} onClick={onMenu} className={`${MI_FOCUS} flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[10px] text-[#cfe2f2]`}>
            <Menu aria-hidden="true" className="h-[22px] w-[22px]" />
          </button>
        ) : (
          <span className="w-2" />
        )}
        <Link href="/" className={`${MI_FOCUS} flex min-h-[44px] min-w-0 flex-1 flex-col justify-center rounded-[8px]`}>
          <span className="block font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#7d92aa]">GLOBALNEWSAI</span>
          <span className="block truncate text-[17px] font-bold leading-[1.15] text-white">{mi.accountMenuItem}</span>
        </Link>
        <Link href={SEARCH_HREF} aria-label={w.search} className={`${MI_FOCUS} flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-[#cfe2f2]`}>
          <Search aria-hidden="true" className="h-[20px] w-[20px]" />
        </Link>
        <Link
          href={ACCOUNT_SETTINGS_HREF}
          aria-label={w.account}
          className={`${MI_FOCUS} flex h-[44px] w-[44px] shrink-0 items-center justify-center`}
        >
          <span className="flex h-[36px] w-[36px] items-center justify-center rounded-full border border-[#1b6fa8] bg-[#07304f] text-[14px] font-bold text-[#cfe6ff]">
            {initial ?? '·'}
          </span>
        </Link>
      </div>
    </header>
  );
}

/* ═══ DESKTOP CONTEXTUAL SELECTION RAIL ═══════════════════════════════════ */

/**
 * SPEC.md — 360px on the right, present ONLY while selection mode is on,
 * closed by Done. Selecting, removing and clearing are local; the six AI
 * actions are the inherited MI_AI_ACTION pills and each opens the existing
 * confirm sheet — nothing runs until Run / Send.
 */
export function SelectionContextRail({
  language,
  stories,
  onRemove,
  onClear,
  onDone,
  onAction,
}: {
  language: LanguageCode;
  stories: readonly FixtureStory[];
  onRemove: (url: string) => void;
  onClear: () => void;
  onDone: () => void;
  onAction: (id: ActionId) => void;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence;
  const count = stories.length;

  return (
    <aside
      data-mi-context-rail=""
      aria-label={t.selection.modeLabel}
      style={{ width: RAIL.contextPx }}
      className="fixed bottom-0 right-0 top-[64px] z-30 hidden flex-col border-l border-[#0a2744] bg-[#020d1d] lg:flex xl:top-[62px]"
    >
      <div className="flex items-center gap-2 border-b border-[#0a2744] px-5 pb-3 pt-4">
        <span className="min-w-0 flex-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fa6c0]">{t.selection.modeLabel}</span>
        {count > 0 && (
          <button type="button" data-mi-control="clear" onClick={onClear} className={`${MI_FOCUS} ${MI_TARGET} rounded-[8px] px-2 text-[13.5px] font-semibold text-[#5abff5]`}>
            {t.selection.clear}
          </button>
        )}
        <button type="button" data-mi-control="selection-mode-done" onClick={onDone} className={`${MI_SAND_FOCUS} ${MI_SELECTION_MODE_CONTROL} ${MI_TARGET} rounded-full px-4 text-[13.5px]`}>
          {t.done}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        <h2 className="mt-3 text-[20px] font-bold text-white" aria-live="polite">
          {count === 0 ? t.selection.statusNone : storiesSelectedLabel(t.selection, count)}
        </h2>
        {count > 0 && (
          <ul className="mt-3 flex flex-col">
            {stories.map((story) => (
              <li key={story.url} className="flex items-start gap-2.5 border-b border-[#0a2744] py-2">
                <span className="mt-[2px] shrink-0">
                  <CountryChip code={story.countryCode} />
                </span>
                <span className="line-clamp-2 min-w-0 flex-1 text-[13.5px] font-semibold leading-[1.3] text-white">{story.title}</span>
                <button
                  type="button"
                  aria-label={fill(t.workspace.selectedRemove, { title: story.title })}
                  onClick={() => onRemove(story.url)}
                  className={`${MI_FOCUS} flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-[#9fb4cb] hover:text-white`}
                >
                  <X aria-hidden="true" className="h-[16px] w-[16px]" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[14px] font-bold text-white">{fill(t.selection.pickAction, { count: MI_ACTIONS.length })}</p>
        <ul className="mt-2 flex flex-col gap-2">
          {MI_ACTIONS.map(({ id, min }) => (
            <li key={id}>
              <ActionPill id={id} min={min} enabled={count >= min} language={language} onPress={() => onAction(id)} block />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] leading-[1.5] text-[#93a7bd]">{t.compute.sandNote}</p>
      </div>
    </aside>
  );
}

/* ═══ SPECIALISTS DESTINATION ═════════════════════════════════════════════ */

/**
 * S3 / S4. Elections is ONE country-aware workspace; the country is context.
 * The chips are the reader's FOLLOWED countries — context the reader already
 * chose — and availability comes from the governed gate
 * (`electionLiveRouteMayOpen`) and the governed country list, never from a
 * list kept here. Today both say no, so every chip shows the truthful
 * unsupported notice and the only open action is the Preview route, which
 * binds no country. Nothing is estimated or filled in.
 */
export function SpecialistsDestination({
  language,
  follows,
  onBack,
}: {
  language: LanguageCode;
  follows: readonly string[] | null;
  onBack: () => void;
}): JSX.Element {
  const mi = getDictionary(language).myIntelligence;
  const s = mi.workspace.specialists;
  const w = mi.workspace;
  const countries = useMemo(() => (follows ?? []).slice(0, 8), [follows]);
  const [country, setCountry] = useState<string | null>(countries[0] ?? null);
  const liveMayOpen = electionLiveRouteMayOpen();

  const nameOf = (iso3: string): string => {
    const found = findCountryByIso3(iso3);
    return found === undefined ? iso3 : getCountryDisplayName(found.iso2, language, found.name);
  };

  const supported = country !== null && electionsSupportedFor(country, liveMayOpen);

  return (
    <section data-mi-view="specialists" aria-labelledby="mi-specialists-page-title" className="min-w-0">
      <div className="flex items-center gap-3">
        <button type="button" aria-label={w.back} onClick={onBack} className={`${MI_FOCUS} flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border border-[#1d3a5a] text-[#cfe2f2]`}>
          <ArrowLeft aria-hidden="true" className="h-[18px] w-[18px]" />
        </button>
        <h2 id="mi-specialists-page-title" className="text-[24px] font-extrabold text-white">{s.pageTitle}</h2>
      </div>
      <p className="mt-3 max-w-[70ch] text-[14px] leading-[1.55] text-[#b9cbe0]">{s.pageNote}</p>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
        {/* ── Elections ─────────────────────────────────────────────── */}
        <article data-mi-specialist="elections" className={`${MI_CARD} p-4 sm:p-5`}>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fa6c0]">{s.elFamily}</p>
          <h3 className="mt-2 flex items-center gap-2 text-[20px] font-bold text-white">
            <Vote aria-hidden="true" className="h-[22px] w-[22px] text-[#5abff5]" />
            {s.elections}
            <span className="rounded-[6px] border border-[#5a4e38] px-1.5 py-[1px] font-mono text-[10px] uppercase tracking-[0.08em] text-[#c9b48c]">{w.preview}</span>
          </h3>
          <p className="mt-2 text-[14px] leading-[1.55] text-[#b9cbe0]">{s.elBody}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fa6c0]">{s.country}</span>
            {countries.length === 0 ? (
              <span className="text-[13px] text-[#93a7bd]">{s.noCountries}</span>
            ) : (
              countries.map((iso3) => (
                <button
                  key={iso3}
                  type="button"
                  aria-pressed={country === iso3}
                  onClick={() => setCountry(iso3)}
                  className={`${MI_FOCUS} min-h-[44px] rounded-full border px-4 text-[14px] font-semibold ${
                    country === iso3 ? 'border-[#1b6fa8] bg-[#07304f] text-white' : 'border-[#1d3a5a] text-[#cfe2f2]'
                  }`}
                >
                  {nameOf(iso3)}
                </button>
              ))
            )}
          </div>

          {country !== null && !supported && (
            <div role="status" data-mi-elections-unsupported={country} className="mt-3 rounded-[10px] border border-dashed border-[#1d3a5a] bg-[#020f20] p-3.5">
              <p className="flex items-center gap-2 text-[15px] font-bold text-white">
                <Info aria-hidden="true" className="h-[17px] w-[17px] shrink-0 text-[#9fb4cb]" />
                {fill(s.unsupportedTitle, { country: nameOf(country) })}
              </p>
              <p className="mt-1.5 text-[13.5px] leading-[1.5] text-[#93a7bd]">{s.unsupportedBody}</p>
            </div>
          )}

          <div className="mt-3 rounded-[10px] border border-[#0e2d4d] p-3">
            <Link href={ELECTIONS_PREVIEW_HREF} className={`${MI_FOCUS} ${MI_TARGET} flex w-full items-center justify-center rounded-full border border-[#1b6fa8] bg-[#07304f] px-4 text-[14.5px] font-bold text-[#cfe6ff]`}>
              {s.openPreview}
            </Link>
            <p className="mt-2 font-mono text-[11.5px] text-[#7d92aa]">{s.previewNote}</p>
          </div>
        </article>

        {/* ── Delivery & Performance · Imihigo ──────────────────────── */}
        <article data-mi-specialist="imihigo" className={`${MI_CARD} p-4 sm:p-5`}>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fa6c0]">{s.dpFamily}</p>
          <p className="mt-2 text-[14px] leading-[1.55] text-[#b9cbe0]">{s.dpBody}</p>
          <div className="mt-3 flex items-center gap-3 rounded-[10px] border border-[#0e2d4d] p-3">
            <Building2 aria-hidden="true" className="h-[26px] w-[26px] shrink-0 text-[#5abff5]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold text-white">{s.imihigo}</span>
              <span className="block text-[13px] text-[#b9cbe0]">{s.imihigoSub}</span>
              <span className="block font-mono text-[11.5px] text-[#7d92aa]">{IMIHIGO_HREF}</span>
            </span>
            <Link href={IMIHIGO_HREF} className={`${MI_FOCUS} ${MI_TARGET} inline-flex shrink-0 items-center rounded-[8px] px-2 text-[14px] font-semibold text-[#5abff5]`}>
              {s.openImihigo}
            </Link>
          </div>
          <p className="mt-3 text-[13px] leading-[1.5] text-[#7d92aa]">{s.dpFuture}</p>
        </article>
      </div>
    </section>
  );
}

/** Back-to-dashboard header for the in-workspace destinations. */
export function DestinationBack({ language, onBack }: { language: LanguageCode; onBack: () => void }): JSX.Element {
  const w = getDictionary(language).myIntelligence.workspace;
  return (
    <button type="button" onClick={onBack} className={`${MI_FOCUS} ${MI_TARGET} inline-flex items-center gap-2 rounded-full border border-[#1d3a5a] px-4 text-[13.5px] font-semibold text-[#cfe2f2]`}>
      <ArrowLeft aria-hidden="true" className="h-[16px] w-[16px]" />
      {w.back}
    </button>
  );
}
