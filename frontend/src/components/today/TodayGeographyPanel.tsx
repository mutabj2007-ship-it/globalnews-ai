'use client';

import { useMemo } from 'react';
import { findCountryByIso2, type LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { CountryFollowControl } from '@/components/home/CountryFollowControl';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import type { TodayCountryCount } from '@/lib/homeFeedAllocation';
import { TodayWorldCanvas } from '@/components/today/TodayWorldCanvas';
import {
  GEO_HEADER_H,
  GEO_FOOTER_CTA_H,
  type GeographyLayout,
} from '@/components/today/todayWorkspaceGeometry';

/**
 * R5.9 — THE TODAY GEOGRAPHY REGION. FROZEN, AND IMPLEMENTED AS FROZEN.
 *
 * All geometry comes from `todayWorkspaceGeometry.ts`, which derives it from
 * KNOWN CHROME and never from a measured element (`08 §4`: "a stale measurement
 * re-clips the region"). This component renders the resolved layout; it does
 * not compute one, and it owns no ResizeObserver.
 *
 * ── THE CANVAS IS THE REGION'S DOMINANT ELEMENT (§A2, §A7, F13) ───────────
 *
 * `flex:1 1 auto` with the tier's minimum, so surplus column height goes to
 * the canvas before it goes to padding or to the rows. The rows and the footer
 * are `flex:0 0 auto` at fixed heights, which is what makes F16 structurally
 * true rather than a hope: the canvas's `flex:1` resolves against what remains
 * and cannot be clipped by either.
 *
 * ── IT NEVER DISAPPEARS, AND IT IS NEVER TEXT (F15, F19) ──────────────────
 *
 * The canvas renders at every tier, floors at 72px, and keeps its grid even
 * when NOTHING resolved — because the four provenance classes are distinguished
 * partly by whether and how a thing is placed, and that needs a surface to
 * place it on. An unresolved region draws the grid, no markers, and says so in
 * words. It is never swapped for a plain text label.
 *
 * NOTE, REPORTED RATHER THAN ABSORBED: `06 §A7`'s tier TABLE still carries an
 * older revision in which the map is "dropped, label as text" at 96/52/0. The
 * same section's prose reverses it — "that is reversed" — F15 forbids the text
 * label outright, and the CTO's ruling says "must never disappear; absolute
 * floor 72px". Three sources against one stale table, so the floor is what is
 * built here.
 *
 * ── NO COORDINATE IS EVER IMPLIED (geography precision rules) ─────────────
 *
 * The canvas is a SCHEMATIC INDEX. Markers are laid out on a deterministic
 * grid derived from the row order — never from a latitude, a longitude, a
 * centroid or a projection, none of which exist in any contract this surface
 * can read. The label says `SCHEMATIC INDEX · NOT COORDINATES` so the reader is
 * told, not left to infer.
 */
interface TodayGeographyPanelProps {
  countries: TodayCountryCount[];
  /*
    FOLLOW — RE-WIRED, NOT INVENTED.

    The follow affordance shipped in the retired `TodaySection` tree, where the
    COUNTRY LIST carried the follow control and the Watch roster carried the
    unfollow. R7 replaced that whole surface with `TodayWorkspace` and the
    control was not carried across, so on the release line `useCountryFollows`
    is READ by the workspace and never WRITTEN by anything: there is no way for
    a signed-in reader to follow a country anywhere in the product. Measured,
    not assumed — `page.tsx` names `TodaySection` only in a comment.

    These props re-instate the ACCEPTED control (`CountryFollowControl`, its
    released geometry, its existing EN/PL strings) in the surface that replaced
    its old host. Nothing here is a new design.

    Optional, so every existing caller and spec compiles unchanged; the control
    renders only when a follow list genuinely exists for this visitor.
  */
  /** ISO-3 codes the caller follows, or null when no list is available. */
  followedIso3?: readonly string[] | null;
  onFollow?: (iso3: string) => void;
  onUnfollow?: (iso3: string) => void;
  pendingIso3?: string | null;
  failedIso3?: string | null;
  unresolvedCount: number;
  layout: GeographyLayout;
  selectedCountry: string | null;
  onSelectCountry: (countryCode: string | null) => void;
  onOpenWorldMap: () => void;
  language: LanguageCode;
}

const CTA_CLASS =
  'inline-flex min-h-[44px] items-center rounded-[7px] border border-[#2a3a4d] bg-[#1b2634] px-[13px] font-gn-mono text-[9.5px] font-bold uppercase tracking-[.08em] text-[#94a3b8] outline-none transition-colors hover:border-[#3c526a] hover:text-[#cbd5e1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dc0ff]';

export function TodayGeographyPanel({
  countries,
  followedIso3 = null,
  onFollow,
  onUnfollow,
  pendingIso3 = null,
  failedIso3 = null,
  unresolvedCount,
  layout,
  selectedCountry,
  onSelectCountry,
  onOpenWorldMap,
  language,
}: TodayGeographyPanelProps): JSX.Element {
  const t = getDictionary(language).todayWorkspace.geography;
  const resolved = countries.length > 0;
  /* Evidence countries as ISO-2, which is the alphabet both the allocation and
     the geometry primitive's curated metadata speak. Unresolved records
     contribute nothing here — they have no country to contribute. */
  const evidenceIso2 = useMemo(
    () => new Set(countries.map((row) => row.countryCode)),
    [countries],
  );

  const worldMapButton = (
    <button type="button" onClick={onOpenWorldMap} className={CTA_CLASS}>
      {t.openWorldMap} &rarr;
    </button>
  );

  return (
    <section
      aria-label={t.regionLabel}
      className="flex min-h-0 flex-col overflow-hidden bg-[#070c12]"
      style={
        /* A tab whose picture is taller than the slot must be allowed to be
           taller than the slot; the dock body is the scroll surface. */
        layout.canvasAspect !== null ? undefined : { height: `${layout.regionHeight}px` }
      }
    >
      {/* §A7 — header, 27px, flex-shrink:0. `COUNTRY-LEVEL` lives here
          permanently, so the precision statement is never lost to a tier. */}
      <header
        className="flex shrink-0 items-center justify-between gap-[8px] px-[13px]"
        style={{ height: `${GEO_HEADER_H}px` }}
      >
        <span className="flex items-baseline gap-[8px]">
          <span className="font-gn-mono text-[9px] font-bold uppercase tracking-[.16em] text-[#67e8f9]">
            {t.regionLabel}
          </span>
          <span className="font-gn-mono text-[8px] uppercase tracking-[.12em] text-[#4a5c73]">
            {t.countryLevel}
          </span>
        </span>
        {/* F17 — position two of three. Compact, because the header is 27px. */}
        {layout.ctaPosition === 'region-header' && (
          <button
            type="button"
            onClick={onOpenWorldMap}
            className="shrink-0 font-gn-mono text-[8px] font-bold uppercase tracking-[.10em] text-[#94a3b8] outline-none transition-colors hover:text-[#cbd5e1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dc0ff]"
          >
            {t.worldMapCompact} &rarr;
          </button>
        )}
      </header>

      {/*
        THE CANVAS. flex:1 1 auto with the tier's own minimum, so every surplus
        pixel in the column lands here (F14) and nothing below can clip it (F16).
      */}
      <div
        role="img"
        aria-label={
          resolved
            ? `${t.regionLabel}: ${t.countryOutlines}, ${countries.length}`
            : `${t.regionLabel}: ${t.noneResolved}`
        }
        className="relative shrink-0 grow overflow-hidden border-y border-[#101923] bg-[#080d14]"
        /*
          R4 GEOGRAPHY SIZE CHILD — the canvas grows ONLY where F14 says it may.

          In the frozen rail and in a dock tab it still takes every surplus
          pixel, exactly as validated. In the three-column composition it is
          pinned to the map's own height, because a canvas taller than its map
          is not a bigger map — it is the same map with more void around it.
        */
        style={{
          flex: layout.canvasGrows ? '1 1 auto' : '0 0 auto',
          /* R4 ZOOM — three cases, and only three. GROWS: F14's surplus, as
             validated. ASPECT: the width is unknown, so the box takes the
             frame's ratio and matches the picture at any width. Otherwise: a
             pixel height computed from a known width. */
          ...(layout.canvasAspect !== null
            ? { width: '100%', aspectRatio: `${layout.canvasAspect}`, height: 'auto' }
            : {
                height: layout.canvasGrows ? undefined : `${layout.canvasHeight}px`,
                minHeight: `${layout.canvasHeight}px`,
              }),
          backgroundImage:
            'linear-gradient(rgba(34,211,238,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.05) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        {/*
          R4 CORRECTION 1 — A REAL GEOGRAPHIC VISUAL.

          Country OUTLINES from the repository's existing geometry primitive,
          with the evidence countries filled in the same cyan the ordinal
          markers used. Precision is the country's own shape and nothing finer:
          a dot inside a country would assert WHERE inside it, and nothing in
          the payload supports that. Unresolved records are not plotted at all —
          they are counted in the rows below, in words.
        */}
        <TodayWorldCanvas evidenceIso2={evidenceIso2} selectedIso2={selectedCountry} />

        {/* The precision statement travels WITH the picture, as it did when
            the picture was a schematic. Only the true sentence changed. */}
        <span className="pointer-events-none absolute bottom-[7px] left-[11px] rounded-[3px] bg-[rgba(8,13,20,.72)] px-[4px] py-[1px] font-gn-mono text-[7.5px] uppercase tracking-[.10em] text-[#4a5c73]">
          {t.countryOutlines}
        </span>

        {/* F19 — nothing resolved still draws the grid, and states the count. */}
        {!resolved && (
          <span className="pointer-events-none absolute inset-x-[11px] top-1/2 -translate-y-1/2 text-center font-gn-mono text-[8px] uppercase tracking-[.10em] text-[#7d92aa]">
            {t.noneResolved}
          </span>
        )}
      </div>

      {/* §A7 — the country rows: a compact bounded secondary layer that scrolls
          internally. flex:0 0 auto, so it can never take from the canvas.

          R4 CORRECTION — THE LAST VISIBLE ROW NOW READS AS CUT, NOT BROKEN.

          The list is deliberately shorter than its contents and always has
          been; what it lacked was any sign of that. A bottom fade is the whole
          fix: `pointer-events-none`, no height change, no effect on the tier
          arithmetic or on any measured box — purely the affordance that tells
          the reader a half-row means "keep scrolling" rather than "this broke".
          Under `prefers-reduced-motion` it is unaffected, because it is not
          motion. */}
      <ul
        className="relative shrink-0 overflow-y-auto overflow-x-hidden [mask-image:linear-gradient(180deg,#000_0,#000_calc(100%-14px),transparent_100%)]"
        style={{ flex: '0 0 auto', height: `${layout.rowsHeight}px` }}
      >
        {/*
          DESIGN-C2 LOCK 8 / A1-C2-36 — THE RETRIEVAL CONTEXT CLASS.

          It states what THIS retrieval found and nothing wider, so a reader can
          never take the list for a census of the world.
        */}
        <li
          data-paf="today-geo-retrieval-context"
          className="border-b border-[#101923] px-[13px] py-[6px] font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[.10em] text-[#54687f]"
        >
          {t.retrievalContext.replace('{n}', String(countries.length))}
        </li>

        {/*
          LOCK 8 — THE BROWSING SELECTION CLASS. Slate, and deliberately WITHOUT
          a precision tag: browsing carries no precision claim, so attaching one
          would be the overstatement this lock exists to prevent.
        */}
        {selectedCountry !== null ? (
          <li
            data-paf="today-geo-viewing"
            className="border-b border-[#101923] px-[13px] py-[6px] font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[.10em] text-[#94a3b8]"
          >
            {t.viewing.replace(
              '{country}',
              getCountryDisplayName(
                selectedCountry,
                language,
                countries.find((c) => c.countryCode === selectedCountry)?.countryName ?? selectedCountry,
              ),
            )}
          </li>
        ) : null}

        {countries.map((row) => {
          const label = getCountryDisplayName(row.countryCode, language, row.countryName);
          const iso3 = findCountryByIso2(row.countryCode)?.iso3 ?? row.countryCode;
          const canFollow = followedIso3 !== null && onFollow !== undefined && onUnfollow !== undefined;
          return (
            <li key={row.countryCode} className="flex items-center gap-[6px] pr-[10px]">
              <button
                type="button"
                aria-pressed={selectedCountry === row.countryCode}
                onClick={() => onSelectCountry(selectedCountry === row.countryCode ? null : row.countryCode)}
                className={`flex w-full items-center gap-[8px] px-[13px] py-[6px] text-left outline-none transition-colors hover:bg-[#0a1119] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7dc0ff] ${
                  selectedCountry === row.countryCode ? 'bg-[#0a1119]' : ''
                }`}
              >
                <span aria-hidden="true" className="h-[5px] w-[5px] shrink-0 rounded-full bg-[#22d3ee]" />
                {/*
                  DESIGN-C2 LOCK 8 — an evidence label NEVER renders without its
                  precision tag, and the tag never wraps away from the place it
                  qualifies. The place truncates; the tag is `shrink-0`, so a
                  narrow column loses letters of the country name rather than the
                  claim about how precisely it was resolved.
                */}
                <span
                  data-paf="today-geo-evidence-label"
                  className="flex min-w-0 flex-1 items-center gap-[6px] whitespace-nowrap"
                >
                  <span className="min-w-0 truncate font-gn-display text-[12px] md:text-[11.5px] text-[#67e8f9]">
                    {label}
                  </span>
                  <span
                    data-paf="today-geo-precision-tag"
                    className="shrink-0 rounded-[4px] border border-[rgba(34,211,238,.35)] px-[4px] font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[.10em] text-[#67e8f9]"
                  >
                    {t.countryPrecision}
                  </span>
                </span>
                <span className="shrink-0 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[.08em] text-[#a9bccf]">
                  {row.count} {getDictionary(language).analysisFrame.mapReportsSuffix}
                </span>
                <span className="sr-only">{iso3}</span>
              </button>
              {/*
                A SIBLING OF THE FILTER BUTTON, NEVER NESTED INSIDE IT. A button
                inside a button is invalid markup and, more to the point, would
                make one control do two jobs: selecting a country to look at and
                committing to follow it are different acts and must be different
                targets.
              */}
              {canFollow && (
                <CountryFollowControl
                  countryCode={iso3}
                  countryLabel={label}
                  isFollowed={followedIso3.includes(iso3)}
                  isPending={pendingIso3 === iso3}
                  hasFailed={failedIso3 === iso3}
                  onFollow={onFollow}
                  onUnfollow={onUnfollow}
                  language={language}
                />
              )}
            </li>
          );
        })}

        {/* §A4 — the unresolved block is reachable at every tier, and it is a
            row of its own rather than an omission. Never selectable: an absence
            of evidence is not a place. */}
        {unresolvedCount > 0 && (
          <li className="border-t border-[#101923] px-[13px] py-[7px]">
            <span className="flex items-center gap-[8px]">
              <span aria-hidden="true" className="h-[5px] w-[5px] shrink-0 rounded-full border border-[#4a5c73]" />
              <span className="min-w-0 flex-1 font-gn-display text-[11.5px] text-[#7d92aa]">
                {t.unresolvedLabel}
              </span>
              <span className="shrink-0 font-gn-mono text-[10px] text-[#7d92aa]">{unresolvedCount}</span>
            </span>
            {/*
              C2-39 — THE ABSENCE SENTENCE IS NOT SHOUTED.

              It said "we do not know", in caps, in mono, at 7.5px with letter
              spacing — a label's treatment for the one line on this surface that
              is an admission rather than a readout. `uppercase` is removed and
              the sentence renders in the display face at the panel's own reading
              size. The accepted baseline copy is restored with it; the caps were
              carrying a rewritten fragment, not the sentence.
            */}
            <span className="mt-[3px] block font-gn-display text-[11.5px] leading-[1.45] tracking-[0] text-[#4a5c73]">
              {t.unresolvedNote}
            </span>
          </li>
        )}
      </ul>

      {/* F17 — position one of three. flex:0 0 auto at 51px including margin,
          so it is visible without scrolling and cannot clip the canvas. */}
      {layout.ctaPosition === 'region-footer' && (
        <div
          className="flex shrink-0 items-center border-t border-[#101923] px-[13px]"
          style={{ flex: '0 0 auto', height: `${GEO_FOOTER_CTA_H}px` }}
        >
          {worldMapButton}
        </div>
      )}
    </section>
  );
}
