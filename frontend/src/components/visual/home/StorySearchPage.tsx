import type { JSX } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { HOME_REGION_ORDER, type LanguageCode, type StorySearchResponse } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { HomeR1Gates } from '@/lib/platform/homeR1Gates';
import type { ThemePreference } from '@/lib/theme/theme';
import type { StorySearchParams } from '@/lib/api/homeEditorialApi';
import { HomeSessionProvider } from '@/components/home/reva/HomeSession';
import { Footer } from '@/components/layout/Footer';
import { HomeR1Canvas } from '@/components/home/r1/HomeR1Chrome';
import { StageBHost } from '@/components/home/r1/stageb/StageBHost';
import { fill } from '@/components/home/reva/homeRevaModel';
import { VisualHeader, VisualPhoneNav } from '../VisualChrome';
import { VisualMain } from '../VisualMain';
import { VisualBriefPanel } from '../VisualBriefPanel';
import { HomeStoryCardView } from './HomeStoryCardView';
import { AskAboutQuery } from './AskAboutQuery';
import { regionLabel } from './homeStoryView';

/**
 * PHONE-FIRST HOME CORRECTION R1 · §7 — the story search page body. A plain GET form (no client
 * state to lose): query, region, type, publication window and an explicitly LABELLED broader
 * archive scope. Loading is the browser's own navigation; error, empty and "too short" are stated.
 */
export function StorySearchPage({
  language,
  gates,
  params,
  searchable,
  result,
  theme,
}: {
  readonly language: LanguageCode;
  readonly gates: HomeR1Gates;
  readonly params: StorySearchParams;
  readonly searchable: boolean;
  readonly result: StorySearchResponse | null;
  readonly theme: ThemePreference;
}): JSX.Element {
  const t = getDictionary(language).visual.home;
  const select =
    'min-h-[44px] rounded-[0.5rem] border border-[var(--gt-line)] bg-[var(--gt-card)] px-2 text-[0.875rem] text-[var(--gt-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]';
  const heading =
    params.q === '' && params.region !== null ? fill(t.resultsBrowse, { region: regionLabel(params.region, t) }) : params.q === '' ? t.resultsTitle : fill(t.resultsFor, { query: params.q });

  return (
    <HomeSessionProvider>
      <HomeR1Canvas theme={theme}>
        <div data-visual-home="" data-story-search-page="">
          <VisualHeader language={language} theme={theme} alerts={gates.alertsInApp ? { replies: gates.discussionRead } : null} />
          <VisualMain>
            <div className="mx-auto w-full max-w-[1360px] px-3 min-[360px]:px-4 min-[600px]:px-6 min-[900px]:px-8">
              <a href="/visual" className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-[0.875rem] font-semibold text-[var(--gt-link)] hover:underline">
                <ArrowLeft aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" />
                {t.backHome}
              </a>
              <form action="/stories" method="get" role="search" aria-label={t.searchLabel} className="mt-2 flex flex-col gap-2 rounded-[0.875rem] border border-[var(--gt-line)] bg-[var(--gt-card)] p-3 min-[600px]:p-4">
                <label htmlFor="stories-q" className="text-[0.8125rem] font-semibold text-[var(--gt-ink2)]">
                  {t.searchLabel}
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex min-h-[3rem] min-w-0 flex-1 items-center gap-2 rounded-[0.625rem] border border-[var(--gt-line)] px-3 focus-within:ring-2 focus-within:ring-[var(--gt-act)]">
                    <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--gt-ink3)]" />
                    <input id="stories-q" name="q" type="search" dir="auto" defaultValue={params.q} maxLength={120} enterKeyHint="search" autoComplete="off" placeholder={t.searchPlaceholder} className="min-w-0 flex-1 bg-transparent text-[1rem] text-[var(--gt-ink)] outline-none placeholder:text-[var(--gt-ink3)]" />
                  </div>
                  <button type="submit" className="inline-flex min-h-[3rem] shrink-0 items-center rounded-[0.5rem] bg-[var(--gt-act)] px-4 text-[0.9375rem] font-bold text-white hover:brightness-110">
                    {t.searchButton}
                  </button>
                </div>
                <details open={params.region !== null || params.domain !== null || params.days !== null || params.scope === 'all'} data-story-filters="">
                <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[0.875rem] font-semibold text-[var(--gt-link)]">{t.filters}</summary>
                <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 min-[900px]:grid-cols-4">
                  <label className="flex flex-col gap-1 text-[0.75rem] font-semibold text-[var(--gt-ink2)]">
                    {t.filterRegion}
                    <select name="region" defaultValue={params.region ?? ''} className={select}>
                      <option value="">{t.filterAllRegions}</option>
                      {HOME_REGION_ORDER.map((id) => (
                        <option key={id} value={id}>
                          {regionLabel(id, t)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[0.75rem] font-semibold text-[var(--gt-ink2)]">
                    {t.filterType}
                    <select name="domain" defaultValue={params.domain ?? ''} className={select}>
                      <option value="">{t.filterAllTypes}</option>
                      <option value="business">{t.domainBusiness}</option>
                      <option value="conflict">{t.domainConflict}</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[0.75rem] font-semibold text-[var(--gt-ink2)]">
                    {t.filterDays}
                    <select name="days" defaultValue={params.days === null ? '' : String(params.days)} className={select}>
                      <option value="">{t.filterAnyTime}</option>
                      <option value="3">{t.filterDays3}</option>
                      <option value="7">{t.filterDays7}</option>
                      <option value="30">{t.filterDays30}</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[0.75rem] font-semibold text-[var(--gt-ink2)]">
                    {t.filterScope}
                    <select name="scope" defaultValue={params.scope} className={select}>
                      <option value="home">{t.scopeHome}</option>
                      <option value="all">{t.scopeAll}</option>
                    </select>
                  </label>
                </div>
                </details>
                <p className="text-[0.75rem] text-[var(--gt-ink2)]">{t.searchNote}</p>
              </form>

              <section aria-labelledby="stories-results-title" data-story-results="" className="mt-5 flex flex-col gap-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <h1 id="stories-results-title" dir="auto" className="font-display text-[1.375rem] font-bold leading-tight text-[var(--gt-ink)]">
                    {heading}
                  </h1>
                  {result !== null && result.results.length > 0 && (
                    <p role="status" className="text-[0.8125rem] text-[var(--gt-ink2)]">
                      {fill(t.resultsCount, { count: result.results.length })}
                    </p>
                  )}
                </div>
                {!searchable ? (
                  <p role="status" className="text-[0.875rem] text-[var(--gt-ink2)]">
                    {t.resultsShort}
                  </p>
                ) : result === null ? (
                  <p role="alert" data-story-search-error="" className="rounded-[0.75rem] border border-[var(--gt-line)] bg-[var(--gt-card)] p-4 text-[0.875rem] text-[var(--gt-ink2)]">
                    {t.resultsError}
                  </p>
                ) : result.results.length === 0 ? (
                  <div role="status" data-story-search-empty="" className="flex flex-col items-start gap-2 rounded-[0.75rem] border border-[var(--gt-line)] bg-[var(--gt-card)] p-4">
                    <p className="text-[0.875rem] text-[var(--gt-ink)]">{fill(t.resultsNone, { query: params.q })}</p>
                    {params.q.length >= 2 && <AskAboutQuery query={params.q} language={language} />}
                  </div>
                ) : (
                  <>
                    {result.relaxed && <p className="text-[0.8125rem] text-[var(--gt-ink2)]">{t.resultsRelaxed}</p>}
                    <ul data-story-results-list="" className="grid grid-cols-1 gap-3 min-[600px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-4">
                      {result.results.map((card) => (
                        <li key={card.articleRef} className="flex min-w-0">
                          <HomeStoryCardView card={card} language={language} discussionRead={gates.discussionRead} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </div>
          </VisualMain>
          <Footer language={language} />
          <VisualPhoneNav language={language} />
          {(gates.discussionRead || gates.alertsInApp) && result !== null && (
            <StageBHost
              language={language}
              articleRefs={result.results.slice(0, 60).map((c) => c.articleRef)}
              discussionRead={gates.discussionRead}
              discussionWrite={gates.discussionWrite}
              alertsInApp={gates.alertsInApp}
            />
          )}
          <VisualBriefPanel language={language} discussionRead={gates.discussionRead} alertsInApp={gates.alertsInApp} />
        </div>
      </HomeR1Canvas>
    </HomeSessionProvider>
  );
}
