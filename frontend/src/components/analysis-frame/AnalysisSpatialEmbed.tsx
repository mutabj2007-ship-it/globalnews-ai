'use client';

import dynamic from 'next/dynamic';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { AnalysisSpatialEvidence } from './spatialEvidenceAdapter';
import { MAP_HEIGHT_COMPRESSED, MAP_HEIGHT_NORMAL } from './GeographicEvidenceMap';

/**
 * ═══ THE ANALYSIS EVIDENCE GEOGRAPHY, DRAWN BY THE SHARED SHELL ════════
 *
 * THE DEFECT THIS CLOSES. The Analysis rail drew its geography with its
 * own inline-SVG renderer (`EvidenceMap` + `EvidenceMapLegend` over
 * `buildEvidenceMapGeometry`). It was a second map implementation, so the
 * workspace read as a second map product next to `/map`. This mounts the
 * SAME `GlobalMapShell` that `/map` mounts, at a different density.
 *
 * `surfaceDensity="EMBED"` IS THE WHOLE CONFIGURATION. Every behaviour
 * the contract asks of this surface is already in EMBED's HUD profile in
 * `lib/map/state/mapState.ts`, and none of it is re-declared here:
 *
 *   `interactive: false`     non-interactive inside the rail
 *   `capturesWheel: false`   the page keeps scrolling — the profile says
 *                            in its own comment that "EMBED must never
 *                            capture wheel events"
 *   `precisionBanner: true`  precision and provenance stay disclosed
 *   modeSwitcher / layerRail / rightRail / search / legend: false
 *
 * That is the architecture's point, stated in the same module: "Surfaces
 * do not choose their own controls; they declare a density and an
 * evidence scope, and the shell DERIVES the HUD." So this component
 * passes a density and an evidence scope, and nothing else — no control
 * flags, no overrides, no second opinion about what a map should show.
 *
 * DYNAMIC, `ssr: false` — the same way `MapPageClient` mounts it. The
 * shell is a WebGL surface; server-rendering it is not possible and
 * pretending otherwise would break the Analysis route's render.
 *
 * THE RAIL FOOTPRINT IS UNCHANGED. Height comes from the SAME two
 * constants the previous renderer used, imported rather than restated, so
 * the Analysis arrangement does not move: 104px normally, 52px compressed.
 *
 * NO REQUEST. This component takes evidence as a prop. It has no client,
 * no fetch, no effect and no provider — the analysis response already
 * loaded is the only source.
 */

/*
  `dynamic()` gives its `loading` component no props, so the compressed
  state is carried in a module-scoped cell written on render. It is a
  layout hint for a placeholder that exists for a few hundred
  milliseconds; nothing reads it as state and nothing branches on it.
*/
let lastCompressed = false;

const GlobalMapShell = dynamic(
  () => import('@/components/map/shell/GlobalMapShell').then((m) => m.GlobalMapShell),
  { ssr: false, loading: () => <EmbedLoadingFallback compressed={lastCompressed} /> },
);

/**
 * ── R3 · THE MINIMUM LEGIBLE HEIGHT, AND WHY IT IS NOT THE COMPRESSED ONE
 *
 * R2 passed `compressed` straight through, so at the dock's compressed
 * state the Spatial engine was asked to draw a world map into 263x52.
 * Measured, and the screenshot is unusable: a country outline, a
 * precision banner and an attribution line cannot coexist in 52px, and
 * the result is not a smaller map but an illegible one.
 *
 * The compressed 52px remains correct for the legacy inline-SVG
 * renderer, which draws a single flat outline and genuinely does shrink;
 * the rollback path keeps it untouched.
 *
 * ── WHY THE FLOOR IS NOT 104px, WHICH IS WHAT I WAS ASKED TO PREFER ───
 *
 * I MEASURED 104px BEFORE ACCEPTING IT, AND IT DOES NOT HOLD. Rendered at
 * the desktop rail's real width, the EMBED HUD is a column of two
 * mandatory boxes:
 *
 *     precision banner   237 x 67   (Part II §2, mandatory; the level
 *                                    plus Part I §G's governing sentence,
 *                                    which wraps to two lines at 237px)
 *     attribution        237 x 45   (GeoNames CC BY 4.0, non-optional,
 *                                    three lines at 237px)
 *     gap + insets       6 + 12 + 12
 *     ------------------------------
 *     REQUIRED                 142px
 *
 * At 104px that column is bottom-anchored and its top lands at y = -27,
 * so the region's `overflow-hidden` CLIPS THE FIRST LINE OF THE TRUST
 * STATEMENT. A trust banner with its top sheared off is a worse failure
 * than the one R3 set out to fix, and it is not visible in a HUD-profile
 * assertion — only in the rendered DOM, which is where it was found.
 * Polish measures the same 67 + 45; mobile is wider (341px) and needs
 * only 115px, so desktop governs.
 *
 * THE VALUE IS COMPOSED FROM THE TWO ACCEPTED CONSTANTS, NOT INVENTED.
 * `MAP_HEIGHT_NORMAL + MAP_HEIGHT_COMPRESSED` = 156px: the smallest
 * height expressible in the rail's own released vocabulary that clears
 * the measured 142px requirement, with 14px of headroom so a longer
 * translation cannot silently reintroduce the clip. No third magic
 * number enters the codebase.
 *
 * THIS IS A DEVIATION FROM THE R3 INSTRUCTION AND IT IS FLAGGED AS ONE.
 * The instruction preferred 104px; the instruction also requires that
 * EMBED show no overlapping attribution/HUD text and no illegible map.
 * At a 263px rail width those two cannot both hold, and the arithmetic
 * above is the proof rather than an opinion. The alternatives that would
 * keep 104px each need authorisation this round does not carry: moving
 * the licence line out of the map box, or giving EMBED a shortened
 * precision banner — and the second weakens the one statement Part I §E
 * calls "the single most important element on the map".
 */
export const SPATIAL_EMBED_MIN_HEIGHT = MAP_HEIGHT_NORMAL + MAP_HEIGHT_COMPRESSED;

export function spatialEmbedHeight(compressed: boolean): number {
  /*
    `compressed` is still read rather than ignored: if a future dock state
    asks for MORE than the floor, it gets it. What cannot happen is less.
  */
  return Math.max(compressed ? MAP_HEIGHT_COMPRESSED : MAP_HEIGHT_NORMAL, SPATIAL_EMBED_MIN_HEIGHT);
}

/**
 * ── R3 · THE FALLBACK RESERVES THE FINAL HEIGHT ───────────────────────
 *
 * The shell is loaded dynamically, so this placeholder holds the space
 * until it arrives. It previously hard-coded `MAP_HEIGHT_NORMAL` while
 * the mounted embed could resolve to 52px — a 104 -> 52 jump the reader
 * sees as the rail collapsing under them. It now computes its height
 * from the SAME function the embed uses, so the two cannot disagree by
 * construction.
 */
function EmbedLoadingFallback({ compressed }: { readonly compressed: boolean }): JSX.Element {
  return (
    <div
      data-paf="evidence-spatial-embed-loading"
      aria-hidden="true"
      className="w-full rounded-[3px] border border-[#101923] bg-[#070b11]"
      style={{ height: spatialEmbedHeight(compressed) }}
    />
  );
}

export interface AnalysisSpatialEmbedProps {
  readonly evidence: AnalysisSpatialEvidence;
  readonly compressed?: boolean;
  readonly language?: LanguageCode;
}

export function AnalysisSpatialEmbed({
  evidence,
  compressed = false,
  language = 'en',
}: AnalysisSpatialEmbedProps): JSX.Element {
  const height = spatialEmbedHeight(compressed);
  lastCompressed = compressed;
  const t = getDictionary(language).analysisFrame;

  /*
    THE SAME ACCESSIBLE LABEL THE PREVIOUS RENDERER BUILT, from the same
    two dictionary keys, so a screen reader hears no change and EN/PL are
    carried without a new string being authored. Names come from the
    adapted records, which are the canonical registry names — never an
    article's prose.
  */
  const named = evidence.evidenceSet.records.map((record) => record.geography.displayName);
  const label =
    named.length > 0 ? t.mapAltCountry.replace('{place}', named.join(', ')) : t.mapAltUnresolved;

  return (
    <div
      data-paf="evidence-spatial-embed"
      data-paf-density="EMBED"
      /*
        `overflow-hidden` is the rail's own containment and is HORIZONTAL
        and VERTICAL framing of a fixed box — it is not a scroll trap: the
        embed never scrolls, because EMBED is not interactive and does not
        capture the wheel. The page's scroll is untouched.
      */
      className="w-full overflow-hidden rounded-[3px] border border-[#101923]"
      style={{ height }}
      role="img"
      aria-label={label}
    >
      <GlobalMapShell
        language={language}
        surfaceDensity="EMBED"
        evidenceSet={evidence.evidenceSet}
        noEvidenceGeography={evidence.noEvidenceGeography}
        availableGeometry={evidence.availableGeometry}
        selection={evidence.selection}
        /*
          PERIOD IS DECLARED, NOT DEFAULTED, AND THE REASON IS TRUTHFULNESS.
          `qualifyingRecords` drops a record older than the period measured
          back from `loadedAt`. This evidence set is already scoped by the
          ANALYSIS — `scope: 'QUESTION'` — not by recency, so a narrower
          period would silently hide countries the analysis actually used.
          The widest period is the only one that draws exactly the evidence
          the reader is being shown facts about.
        */
        period="30D"
        mode="EVIDENCE"
      />
    </div>
  );
}
