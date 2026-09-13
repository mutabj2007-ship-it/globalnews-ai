'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { findCountryByIso3, type LanguageCode, type NewsDataMode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import type { TodayAllocation } from '@/lib/homeFeedAllocation';
import { useCountryFollows } from '@/components/home/useCountryFollows';
import { TodayHeader, type TodayCounters } from '@/components/today/TodayHeader';
import { AnalysePanel } from '@/components/today/AnalysePanel';
import { TodayGeographyPanel } from '@/components/today/TodayGeographyPanel';
import { WatchPanel, type WatchSubject } from '@/components/today/WatchPanel';
import { SourcesDock, type DockTab } from '@/components/today/SourcesDock';
import { useReturnState, countSince } from '@/components/today/useReturnState';
import {
  DOCK_H_COMPACT,
  GEO_COL_W,
  GEO_COL_W_M,
  M_BREAKPOINT,
  HEADER_COLLAPSE_SCROLL,
  S_BREAKPOINT,
  TODAY_FRAME_H,
  TODAY_FRAME_H_S,
  WATCH_COL_W,
  resolveDock,
  resolveGeographyColumnLayout,
  resolveRelocatedGeographyLayout,
} from '@/components/today/todayWorkspaceGeometry';

/**
 * R7 — TODAY, AS A BOUNDED WORKSPACE SECTION INSIDE THE SCROLLING HOMEPAGE.
 *
 * ── WHY THIS IS A SECTION AND NOT A PAGE ─────────────────────────────────
 *
 * R7's prototype is a full-page fixed shell: `html, body { overflow:hidden }`,
 * "the page does not scroll". That rule does NOT transfer here, and the CTO
 * ruled explicitly on it: Hero, Global Developments, the Intelligence Engine,
 * How It Works and Trust are accepted released sections, there is no new
 * route, and production `html`/`body` are never set to `overflow:hidden`.
 *
 * So the fixed shell is scoped to THIS ELEMENT. The section owns a known
 * height; everything inside it resolves against that height instead of against
 * the viewport; and the document outside it scrolls exactly as it did before.
 * Nothing in this file touches `document`, `html` or `body`.
 *
 * ── THE FRAME IS THE ONLY INPUT THE GEOMETRY NEEDS ───────────────────────
 *
 * `08 §4` requires the tier to derive from KNOWN CHROME, never from a measured
 * element. Here the known chrome is complete and local:
 *
 *     column = frame − header track − dock track
 *
 * The header track is `HEADER_H_EXPANDED` or 0; the dock track is one of two
 * constants; the frame is one of two constants. Five numbers, no observer, no
 * `getBoundingClientRect`, and the identical arithmetic the 1,201-height unit
 * test already proves.
 *
 * ── SCROLLING IS CONTAINED IN BOTH DIRECTIONS ────────────────────────────
 *
 * ANALYSE and WATCH scroll internally with `overscroll-contain`, so reaching
 * the end of either does not hand the wheel to the homepage. And because the
 * frame height is fixed, no internal state — expanding the dock, opening a
 * ribbon, collapsing the header — can lengthen the page under the reader.
 *
 * ── BELOW THE S BREAKPOINT THE THREE REGIONS BECOME TABS ─────────────────
 *
 * Three bounded regions side by side need width the S breakpoint does not
 * have, and stacking them would make the section taller than the viewport,
 * which is the one thing a bounded workspace may not do. So one region is on
 * show at a time and the geometry is handed the FULL body height for it — the
 * region is not squeezed, it is the only one there.
 *
 * The breakpoint is read from `matchMedia`, the pattern already established
 * here by GlobalDevelopments and LatestNowTicker. That is a viewport query,
 * not an element measurement: `08 §4`'s prohibition is on measuring the very
 * boxes the result then resizes, and a viewport width is not one of them.
 */
interface TodayWorkspaceProps {
  today: TodayAllocation;
  dataMode: NewsDataMode | null;
  updatedAt: string;
  language: LanguageCode;
}

export function TodayWorkspace({ today, language }: TodayWorkspaceProps): JSX.Element {
  const router = useRouter();
  const t = getDictionary(language).todayWorkspace;
  const watch = useCountryFollows();
  /*
    THE RETURN BOUNDARY, FROM THE AUTHENTICATED CONTRACT.

    Gated on `watch.follows !== null`, which is this surface's existing proof
    that an account exists — the follow read has already succeeded. That gate is
    not politeness: `POST /users/me/seen` sits behind `RequireAuthGuard`, so
    calling it for an anonymous reader would spend a request to be told 401, and
    the signed-out column has no return state to show either way.
  */
  const { previousSeenAt } = useReturnState(watch.follows !== null);

  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [isSmall, setIsSmall] = useState(false);
  /*
    R4 GEOGRAPHY SIZE CHILD — the wide geography column applies only where
    ANALYSE can still spare the width. Same matchMedia mechanism, one more
    query; a viewport width is not an element measurement.
  */
  const [isMedium, setIsMedium] = useState(false);
  const [dockTab, setDockTab] = useState<DockTab>('sources');

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${S_BREAKPOINT - 1}px)`);
    const apply = (): void => setIsSmall(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${M_BREAKPOINT - 1}px)`);
    const apply = (): void => setIsMedium(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  /*
    HYSTERESIS, AND IT IS LOAD-BEARING.

    Collapsing the header gives ANALYSE more height, which can reduce
    `scrollTop` back below a single threshold, which would expand the header,
    which would shrink ANALYSE again. A collapse point of 40 with a restore
    point of 8 makes that oscillation impossible: no scroll position satisfies
    both, so the state cannot flip on its own.
  */
  const onAnalyseScroll = useCallback((scrollTop: number): void => {
    setHeaderCollapsed((current) =>
      current ? scrollTop > 8 : scrollTop > HEADER_COLLAPSE_SCROLL,
    );
  }, []);

  const frameHeight = isSmall ? TODAY_FRAME_H_S : TODAY_FRAME_H;
  /*
    ONE CALL DECIDES ALL THREE TRACKS. `resolveDock` applies `05 §5`'s ceiling
    (ANALYSE never under its floor) and `05 §5.1`'s relocation trigger, and
    returns what is left. Nothing downstream re-derives a height.
  */
  const dock = resolveDock({
    frameHeight,
    headerCollapsed,
    dockExpanded: sourcesExpanded,
    smallViewport: isSmall,
  });
  const bodyHeight = dock.bodyHeight;
  /* GEOGRAPHY is now a FULL-HEIGHT COLUMN, not the lower half of a shared
     rail, so it resolves against the whole body and owns its own CTA. */
  /* The column's WIDTH decides the map's height, so the layout needs both. */
  const geoColumnWidth = isMedium ? GEO_COL_W_M : GEO_COL_W;
  const layout = resolveGeographyColumnLayout(bodyHeight, geoColumnWidth);
  /* In a tab geography is the ONLY region present, so it takes the whole
     tab body — and its own OPEN WORLD MAP is suppressed (`05 §5.1`). */
  const relocatedLayout = resolveRelocatedGeographyLayout(
    Math.max(0, dock.dockHeight - DOCK_H_COMPACT),
  );

  const visible = useMemo(
    () =>
      selectedCountry === null
        ? today.records
        : today.records.filter((record) => record.countryCode === selectedCountry),
    [today.records, selectedCountry],
  );

  const openRecord = useMemo(
    () => today.records.find((record) => record.id === expandedId) ?? null,
    [today.records, expandedId],
  );

  /*
    WATCH SUBJECTS. The follow API speaks ISO-3 and the allocation speaks
    ISO-2, so every crossing goes through `findCountryByIso3` — the canonical
    resolver, never a `slice(0, 2)`.

    A followed country with no records today gets count 0 and the approved zero
    sentence. It is NOT dropped from the list: dropping it would silently
    answer "nothing happened there", which is the one thing the wording exists
    to prevent.
  */
  const subjects: WatchSubject[] = useMemo(() => {
    if (watch.follows === null) return [];
    return watch.follows.map((iso3) => {
      const country = findCountryByIso3(iso3);
      const iso2 = country?.iso2 ?? null;
      const row = iso2 === null ? undefined : today.countries.find((c) => c.countryCode === iso2);
      const forCountry =
        iso2 === null ? [] : today.records.filter((r) => r.countryCode === iso2);
      return {
        code: iso3,
        label:
          iso2 !== null
            ? getCountryDisplayName(iso2, language, country?.name ?? iso3)
            : iso3,
        count: row?.count ?? 0,
        /* A REAL count of real records, or 0 when there is no boundary to
           count from — and the panel draws nothing for the latter. */
        missed: countSince(forCountry, previousSeenAt),
      };
    });
  }, [watch.follows, today.countries, today.records, language, previousSeenAt]);

  /*
    THE PULSE SET, NOW EARNED RATHER THAN EMPTY.

    `03 §3` rations the pulse to state CHANGES since the reader's last visit,
    and C6 caps it at three rows at once. The cap is applied HERE, by the
    caller, so the panel cannot be handed more than three however the list
    grows. With no boundary the set is empty and nothing pulses — which is the
    same honest outcome as before, arrived at from a real absence rather than a
    missing mechanism.
  */
  const pulsingSubjects = useMemo(
    () =>
      new Set(
        subjects
          .filter((s) => s.missed > 0)
          .slice(0, 3)
          .map((s) => s.code),
      ),
    [subjects],
  );

  /* What the reader missed across the whole retrieval. 0 with no boundary is
     never rendered as a finding — the panel falls back to naming what it is
     showing instead. */
  const missedTotal = countSince(today.records, previousSeenAt);

  const counters: TodayCounters = {
    retrieved: today.records.length,
    countries: today.countries.length,
    unresolved: today.unresolvedCount,
    watching: watch.follows === null ? null : watch.follows.length,
    /* `08 §3` — OPTIONAL WHEN AVAILABLE. Available exactly when the
       authenticated contract returns an interval, and absent otherwise. */
    newSinceLastVisit: previousSeenAt === null ? null : missedTotal,
  };

  const selectSubject = useCallback(
    (iso3: string): void => {
      const iso2 = findCountryByIso3(iso3)?.iso2 ?? null;
      if (iso2 === null) return;
      setSelectedCountry((current) => (current === iso2 ? null : iso2));
      setExpandedId(null);
    },
    [],
  );

  const toggleRecord = useCallback((id: string): void => {
    setExpandedId((current) => (current === id ? null : id));
    setSourcesExpanded(false);
  }, []);

  const openSources = useCallback((id: string): void => {
    setExpandedId(id);
    setSourcesExpanded((current) => !current);
  }, []);

  const openWorldMap = useCallback((): void => router.push('/map'), [router]);

  const geographyPanel = (geographyLayout: typeof layout): JSX.Element => (
    <TodayGeographyPanel
      countries={today.countries}
      unresolvedCount={today.unresolvedCount}
      layout={geographyLayout}
      selectedCountry={selectedCountry}
      onSelectCountry={(code) => {
        setSelectedCountry(code);
        setExpandedId(null);
      }}
      onOpenWorldMap={openWorldMap}
      /*
        FOLLOW, RE-WIRED. `useCountryFollows` was already called here and its
        WRITE half — `follow` and `unfollow` — went nowhere: the affordance
        shipped in the retired TodaySection tree and R7 did not carry it
        across, so no route in the product could follow a country. These four
        props connect the hook that was already here to the accepted control
        that already existed.
      */
      followedIso3={watch.follows}
      onFollow={(iso3) => void watch.follow(iso3)}
      onUnfollow={(iso3) => void watch.unfollow(iso3)}
      pendingIso3={watch.pendingCountry}
      failedIso3={watch.failedCountry}
      language={language}
    />
  );

  const watchPanelAt = (height: number): JSX.Element => (
    <WatchPanel
      subjects={subjects}
      isAnonymous={watch.follows === null && !watch.isLoading}
      isLoading={watch.isLoading}
      previousSeenAt={previousSeenAt}
      missedTotal={missedTotal}
      pulsingSubjects={pulsingSubjects}
      height={height}
      selectedCountry={
        selectedCountry === null
          ? null
          : (subjects.find((s) => findCountryByIso3(s.code)?.iso2 === selectedCountry)?.code ?? null)
      }
      onSelectSubject={selectSubject}
      onUnfollow={(iso3) => void watch.unfollow(iso3)}
      pendingIso3={watch.pendingCountry}
      failedIso3={watch.failedCountry}
      language={language}
    />
  );

  const analyse = (
    <AnalysePanel
      records={visible}
      height={bodyHeight}
      expandedId={expandedId}
      onToggleRecord={toggleRecord}
      sourcesExpanded={sourcesExpanded}
      onOpenSources={openSources}
      filterCountry={selectedCountry}
      onClearFilter={() => setSelectedCountry(null)}
      onScrollTop={onAnalyseScroll}
      onOpenWorkspace={() => router.push('/search')}
      language={language}
    />
  );

  return (
    <section
      aria-label={t.header.regionLabel}
      /*
        THE BOUNDED FRAME. A known height and `overflow:hidden` on THIS
        element — never on `html` or `body`, which the CTO ruled out and which
        would break every other section on this page.
      */
      className="mx-auto w-full max-w-[1440px] overflow-hidden rounded-[14px] border border-[#16202e] bg-[#05080d]"
      style={{ height: `${frameHeight}px` }}
    >
      <div className="flex h-full flex-col">
        <TodayHeader counters={counters} collapsed={headerCollapsed} language={language} />

        {/*
          THE CORRECTED DESKTOP COMPOSITION — WATCH | ANALYSE | GEOGRAPHY.

          Three tracks, in that order in the DOM as well as on screen, so the
          keyboard path and the visual path are the same path. Each column is
          exactly `bodyHeight` tall, which is what lets WATCH and GEOGRAPHY both
          be served at full height instead of splitting one rail between them.

          WHAT THE RECOMPOSITION BUYS, MEASURED: geography's canvas resolves to
          330px at a 720 frame instead of the 206px it got as the lower half of
          a shared rail, and its country rows keep their preferred 132px instead
          of compacting to 72 — because the region no longer pays for WATCH out
          of its own height. That is the "canvas remains visually useful"
          requirement, met structurally rather than by a minimum.

          B19 — THE VACATED TRACKS ARE REMOVED, NOT LEFT EMPTY. While relocated
          the template collapses to ONE track. Grid placement moves an element;
          it does not resize the grid, so leaving the 240px and 324px tracks in
          would strand two empty regions beside ANALYSE and keep ANALYSE at its
          old width — asserting "full width" while delivering neither.

          `minmax(0, 1fr)` on the centre is load-bearing: without the 0 minimum
          a long headline sets the track's min-content width and pushes the grid
          wider than the frame it is supposed to be bounded by.
        */}
        <div
          className="grid min-h-0 flex-1"
          style={{
            gridTemplateColumns: dock.relocated
              ? 'minmax(0, 1fr)'
              : `${WATCH_COL_W}px minmax(0, 1fr) ${geoColumnWidth}px`,
          }}
        >
          {!dock.relocated && watchPanelAt(bodyHeight)}
          {analyse}
          {!dock.relocated && geographyPanel(layout)}
        </div>

        <SourcesDock
          record={openRecord}
          expanded={sourcesExpanded}
          onToggle={() => setSourcesExpanded((current) => !current)}
          dockHeight={dock.dockHeight}
          relocation={
            dock.relocated
              ? {
                  tab: dockTab,
                  /* Selecting a tab OPENS the dock. Without this the relocated
                     tabs changed state and showed nothing, because the dock
                     body is gated on `expanded` and the relocated chrome has no
                     expand control of its own. */
                  onSelectTab: (next) => {
                    setDockTab(next);
                    setSourcesExpanded(true);
                  },
                  watchCount: subjects.length,
                  watchPanel: watchPanelAt(Math.max(0, dock.dockHeight - DOCK_H_COMPACT)),
                  geographyPanel: geographyPanel(relocatedLayout),
                }
              : null
          }
          /* Exactly one owner: the dock takes the control precisely when the
             geography region is rendering none — relocated, or at tier E. */
          worldMap={
            dock.relocated || layout.ctaPosition === 'permanent-chrome' ? openWorldMap : null
          }
          language={language}
        />
      </div>
    </section>
  );
}
