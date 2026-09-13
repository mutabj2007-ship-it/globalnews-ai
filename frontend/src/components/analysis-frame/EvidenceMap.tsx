'use client';

import { useMemo } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildEvidenceMapGeometry } from './geographicEvidenceGeometry';
import { MAP_HEIGHT_COMPRESSED, MAP_HEIGHT_NORMAL } from './GeographicEvidenceMap';
import type { EvidenceGeographyModel } from './evidenceGeography';

/**
 * R4.1 — the evidence map.
 *
 * WHAT THE COLOURS MEAN, AND WHY THEY CANNOT BE SWAPPED.
 *
 *   cyan fill      a country the RETAINED REPORTING supports. The only
 *                  fill on this map. Derived from `articles[].countryCode`
 *                  and nothing else.
 *   neutral outline the QUERY TARGET, drawn only when the evidence does
 *                  NOT support it. It is what the question aimed at. It
 *                  never receives the evidence fill, because the map would
 *                  then assert that reporting exists for a country where
 *                  none was retained.
 *   amber outline  the ACTIVE selection, layered ON TOP of the cyan fill
 *                  rather than replacing it. Selection is a reading state;
 *                  it must not overwrite an evidence claim.
 *   grey           context countries, orientation only, never interactive.
 *
 * NO POINT MARKERS. A country being known is not a coordinate, so the ceiling
 * this component can honestly draw is the country shape. There is no code path
 * here that plots a point.
 *
 * SPATIAL M1.0B — the old wording here ("`geographicPrecision` still has zero
 * writers") is superseded: M1.0A produces that field, and its producible set
 * is COUNTRY and UNKNOWN. The conclusion is UNCHANGED and now rests on the
 * contract instead of on the field being empty. `model.precisionCeiling`
 * arrives already clamped by `evidenceDisplayCeiling`, so a precision finer
 * than a country clamps DOWN to the country shape rather than unlocking a
 * marker this system cannot justify. This component reads the ceiling and
 * derives no geography of its own.
 *
 * EMPTY MEANS EMPTY. When the geometry builder returns null there is
 * nothing to draw, and this renders a statement rather than a world map
 * with arbitrary countries lit up.
 */
export interface EvidenceMapProps {
  model: EvidenceGeographyModel;
  /** ISO3 of the country whose evidence is currently selected, if any. */
  activeIso3?: string | null;
  /** Shorter map, same statements — the accepted two-state contract. */
  compressed?: boolean;
  aspect?: number;
  language?: LanguageCode;
}

export function EvidenceMap({
  model,
  activeIso3 = null,
  compressed = false,
  aspect,
  language = 'en',
}: EvidenceMapProps): JSX.Element {
  /*
   * The heights and the two-state contract are `CompactMap`'s, imported
   * rather than restated. This component REPLACES that map's body with a
   * multi-country one; it does not get to invent its own geometry
   * envelope, and PAF-18 asserts the compact height by value.
   */
  const height = compressed ? MAP_HEIGHT_COMPRESSED : MAP_HEIGHT_NORMAL;
  const boxAspect = aspect ?? 296 / height;
  const dict = getDictionary(language);
  const t = dict.analysisFrame;

  /*
   * WHICH COUNTRIES GET THE FILL.
   *
   * Per-record article evidence, when it exists, is the only thing filled.
   * A 'retrieval-filter' country is then demoted to an outline: the
   * articles resolved their own countries and did not include it, so
   * filling it would let the route's country override the reporting —
   * exactly what §4.5 forbids. The screenshot that caught this had Iran
   * filled cyan beside a statement that the reporting did not support it.
   *
   * When NO article resolved a country, the country-aware retrieval filter
   * is the only evidence there is, and it is filled — that is the accepted
   * G2 basis, and demoting it would claim less than the evidence supports.
   */
  const articleEvidence = model.countries.filter((c) => c.basis === 'article-evidence');
  const filled = articleEvidence.length > 0 ? articleEvidence : model.countries;
  const outlinedIso3 =
    articleEvidence.length > 0
      ? (model.countries.find((c) => c.basis === 'retrieval-filter')?.iso3 ??
         model.queryTarget?.iso3 ??
         null)
      : (model.queryTarget?.iso3 ?? null);

  const geometry = useMemo(
    () => buildEvidenceMapGeometry(filled.map((c) => c.iso3), outlinedIso3, boxAspect),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, boxAspect],
  );

  if (geometry === null) {
    return (
      <div
        data-paf="compact-map"
        data-evidence-map="true"
        data-precision="unresolved"
        data-state="nothing-to-draw"
        className="relative w-full overflow-hidden rounded-[10px] border border-[#16202e] bg-[#071016]"
        style={{ height: `${height}px` }}
      >
        <span className="absolute inset-0 flex items-center justify-center px-3 text-center font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#4a5c73]">
          {t.mapNothingToDraw}
        </span>
      </div>
    );
  }

  /*
   * The accepted alt-text sentences, reused verbatim from the dictionary.
   * `mapAltCountry` carries "Marker indicates the resolved country, not a
   * coordinate." — a truthfulness statement PAF-15 pins, and one this map
   * needs just as much now that it can fill several countries at once.
   */
  const names = filled.map((c) => c.name).join(', ');
  const label = filled.length > 0 ? t.mapAltCountry.replace('{place}', names) : t.mapAltUnresolved;

  return (
    <div
      /*
        `data-paf="compact-map"` and `data-precision` are the ACCEPTED
        contract markers the rail's geometry and truthfulness suites match
        on. This component is a superset of the single-country map, not a
        replacement surface, so it keeps every marker those suites pin and
        adds its own alongside. Renaming them would have made eleven
        accepted assertions "fail" without anything being safer.
      */
      data-paf="compact-map"
      data-evidence-map="true"
      data-precision={model.precisionCeiling}
      data-state={filled.length > 0 ? 'evidence' : 'target-only'}
      data-evidence-count={filled.length}
      role="img"
      aria-label={label}
      className="relative w-full overflow-hidden rounded-[10px] border border-[#16202e] bg-[#071016]"
      style={{ height: `${height}px` }}
    >
      <svg
        viewBox={geometry.viewBox}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        focusable="false"
      >
        {/* Context — orientation only. */}
        <g fill="#0b1a24" stroke="#1b2c3a" strokeWidth="0.6" strokeLinejoin="round">
          {geometry.contextPaths.map((d, i) => (
            <path key={i} d={d} vectorEffect="non-scaling-stroke" />
          ))}
        </g>

        {/* QUERY TARGET — outline only, never the evidence fill. */}
        {geometry.targetPath === null ? null : (
          <g
            data-paf="map-query-target"
            data-iso3={geometry.targetPath.iso3}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.1"
            strokeDasharray="3 2"
            strokeLinejoin="round"
          >
            <path d={geometry.targetPath.d} vectorEffect="non-scaling-stroke" />
          </g>
        )}

        {/* EVIDENCE — the only fill on this map. */}
        {geometry.evidencePaths.map((p) => (
          <g
            key={p.iso3}
            data-paf="evidence-country"
            data-iso3={p.iso3}
            data-active={activeIso3 !== null && activeIso3.toUpperCase() === p.iso3 ? 'true' : 'false'}
            fill="rgba(34,211,238,.22)"
            stroke="#67e8f9"
            strokeWidth="1.2"
            strokeLinejoin="round"
          >
            <path d={p.d} vectorEffect="non-scaling-stroke" />
            {/* ACTIVE — layered over the fill, never instead of it. */}
            {activeIso3 !== null && activeIso3.toUpperCase() === p.iso3 ? (
              <path
                data-paf="map-active-outline"
                d={p.d}
                fill="none"
                stroke="#e0a33d"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </g>
        ))}
      </svg>

      {/*
        BOTH statements, not one.

        `notACoordinate` is an accepted P0 disclaimer: it tells the reader
        this map plots no point. The first draft replaced it with the
        precision label and eight accepted assertions failed — correctly,
        because a precision ceiling and "this is not a coordinate" are
        different promises and the second is the one that stops a country
        fill being read as a location pin.

        The string is the SAME dictionary entry the existing map uses, so
        the two surfaces cannot drift apart in wording.
      */}
      <span
        data-paf="not-a-coordinate"
        className="absolute bottom-[6px] left-[8px] max-w-[46%] font-gn-mono text-[12px] md:text-[11px] uppercase leading-[1.25] tracking-[0.14em] text-[#4b7f8c]"
      >
        {t.notACoordinate}
      </span>
      <span
        data-paf="map-precision-ceiling"
        className="absolute bottom-[6px] right-[8px] max-w-[46%] font-gn-mono text-[12px] md:text-[11px] uppercase leading-[1.25] tracking-[0.14em] text-[#67e8f9] text-right"
      >
        {model.precisionCeiling === 'country' ? t.mapCountryLevel : t.mapLegendUnresolved}
      </span>
    </div>
  );
}

/**
 * The legend. Separated so the rail can place it outside the cropped SVG
 * box, where it cannot be clipped by the projection.
 *
 * Entries appear only when the map actually contains what they describe —
 * a legend that lists ACTIVE EVIDENCE when nothing is selected teaches the
 * reader a distinction the picture is not making.
 */
export function EvidenceMapLegend({
  model,
  activeIso3 = null,
  language = 'en',
}: {
  model: EvidenceGeographyModel;
  activeIso3?: string | null;
  language?: LanguageCode;
}): JSX.Element {
  const t = getDictionary(language).analysisFrame;

  const entries: Array<{ key: string; label: string; swatch: JSX.Element }> = [];

  if (model.countries.length > 0) {
    entries.push({
      key: 'evidence',
      label: t.mapLegendEvidence,
      swatch: (
        <span
          aria-hidden="true"
          className="inline-block h-[7px] w-[10px] rounded-[1px] border border-[#67e8f9] bg-[rgba(34,211,238,.22)]"
        />
      ),
    });
  }

  if (model.queryTarget?.iso3 != null && model.targetDisagreesWithEvidence) {
    entries.push({
      key: 'target',
      label: t.mapLegendQueryTarget,
      swatch: (
        <span
          aria-hidden="true"
          className="inline-block h-[7px] w-[10px] rounded-[1px] border border-dashed border-[#94a3b8]"
        />
      ),
    });
  }

  if (activeIso3 !== null) {
    entries.push({
      key: 'active',
      label: t.mapLegendActive,
      swatch: (
        <span
          aria-hidden="true"
          className="inline-block h-[7px] w-[10px] rounded-[1px] border-2 border-[#e0a33d]"
        />
      ),
    });
  }

  if (model.unresolvedArticleCount > 0 || model.countries.length === 0) {
    entries.push({
      key: 'unresolved',
      label: t.mapLegendUnresolved,
      swatch: (
        <span
          aria-hidden="true"
          className="inline-block h-[7px] w-[10px] rounded-[1px] border border-[#2a3a4d] bg-[#0b1a24]"
        />
      ),
    });
  }

  return (
    <ul data-paf="map-legend" className="mt-[5px] flex flex-wrap gap-x-3 gap-y-[3px]">
      {entries.map((e) => (
        <li
          key={e.key}
          data-paf={`map-legend-${e.key}`}
          className="inline-flex items-center gap-[5px] font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.1em] text-[#4b7f8c]"
        >
          {e.swatch}
          {e.label}
        </li>
      ))}
    </ul>
  );
}
