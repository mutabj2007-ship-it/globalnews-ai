'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildFocusGeometry } from './geographicEvidenceGeometry';
import type { EvidencePrecision } from './geographicEvidenceState';

/**
 * PAF-R1.2 (P0) — the persistent rail's real geographic surface.
 *
 * WHAT IT SHOWS AND WHAT THAT MEANS:
 *   country outline, filled  the geography the EVIDENCE supports
 *   neighbouring outlines    orientation only, never a claim
 *   anchor dot               a LABEL ANCHOR at the country's bbox centre
 *   `NOT A COORDINATE`       retained verbatim from the geo-precision contract
 *
 * NO INVENTED COORDINATE. Nothing in the analysis contract carries a point
 * for a city, a story or an event. The anchor is computed from the country
 * polygon itself, so it cannot encode information the payload does not have.
 * Even when `evidencePrecision` is `'city'`, the anchor does NOT move — there
 * is no city coordinate to move it to, and inventing one is exactly the
 * failure §7 exists to prevent. City precision changes the LABEL, never the
 * geometry.
 *
 * NO ZOOM, PAN OR RE-CENTRE at any size, and no interactive map library:
 * this renders inline SVG from geometry the repository already ships. The
 * `/map` route and its own WebGL surface are untouched. The spec asserts the
 * absence against this file's source text, so no library name is written
 * here.
 */

export const MAP_HEIGHT_NORMAL = 104;
export const MAP_HEIGHT_COMPRESSED = 52;
const MAP_ASPECT = 232 / 104;

export interface GeographicEvidenceMapProps {
  /** ISO alpha-3 of the country the evidence supports. Null when unresolved. */
  evidenceCountryCode: string | null;
  evidenceCountryName: string | null;
  /** REQUIRED. The map never derives precision for itself. */
  evidencePrecision: EvidencePrecision;
  compressed?: boolean;
  language?: LanguageCode;
}

export function GeographicEvidenceMap({
  evidenceCountryCode,
  evidenceCountryName,
  evidencePrecision,
  compressed = false,
  language = 'en',
}: GeographicEvidenceMapProps): JSX.Element {
  const t = getDictionary(language).analysisFrame;
  const height = compressed ? MAP_HEIGHT_COMPRESSED : MAP_HEIGHT_NORMAL;

  const geometry =
    evidencePrecision === 'unresolved' ? null : buildFocusGeometry(evidenceCountryCode, MAP_ASPECT);

  const place = evidenceCountryName ?? '';
  const label =
    evidencePrecision === 'city'
      ? t.mapAltCity.replace('{place}', place)
      : evidencePrecision === 'country'
        ? t.mapAltCountry.replace('{place}', place)
        : t.mapAltUnresolved;

  return (
    <div
      data-paf="compact-map"
      data-precision={evidencePrecision}
      role="img"
      aria-label={label}
      className="relative w-full overflow-hidden rounded-[10px] border border-[#16202e] bg-[#071016]"
      style={{ height: `${height}px` }}
    >
      {geometry === null ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 block"
          style={{
            backgroundImage:
              'linear-gradient(rgba(34,211,238,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.10) 1px, transparent 1px)',
            backgroundSize: compressed ? '14px 14px' : '22px 22px',
          }}
        />
      ) : (
        <svg
          viewBox={geometry.viewBox}
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
          focusable="false"
        >
          {/* Neighbouring countries — orientation only. */}
          <g fill="#0b1a24" stroke="#1b2c3a" strokeWidth="0.6" strokeLinejoin="round">
            {geometry.contextPaths.map((d, index) => (
              <path key={index} d={d} vectorEffect="non-scaling-stroke" />
            ))}
          </g>

          {/* The evidence country. The FILL is what carries the claim. */}
          <g
            data-paf="evidence-country"
            fill="rgba(34,211,238,.22)"
            stroke="#67e8f9"
            strokeWidth="1.2"
            strokeLinejoin="round"
          >
            <path d={geometry.focusPath} vectorEffect="non-scaling-stroke" />
          </g>

          {/* Label anchor. Derived from the polygon; not an event location. */}
          <circle
            data-paf="evidence-anchor"
            cx={geometry.anchorX}
            cy={geometry.anchorY}
            r={compressed ? 1.6 : 2.2}
            fill="#67e8f9"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      <span
        data-paf="not-a-coordinate"
        className={
          compressed
            ? 'absolute right-[6px] top-[5px] max-w-[46%] text-right font-gn-mono text-[12px] md:text-[11px] uppercase leading-[1.25] tracking-[0.14em] text-[#4b7f8c]'
            : 'absolute bottom-[6px] left-[8px] max-w-[46%] font-gn-mono text-[12px] md:text-[11px] uppercase leading-[1.25] tracking-[0.14em] text-[#4b7f8c]'
        }
      >
        {t.notACoordinate}
      </span>
    </div>
  );
}
