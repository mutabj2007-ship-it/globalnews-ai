import { getCountryFeatureCollection, type CountryFeature } from '@/lib/map/countryGeometry';
import { geometryToPathD, type ProjectionViewport } from '@/lib/geo/equirectangularProjection';

/**
 * CTO directive (mobile pass), Section 7 — "Do NOT merely hide the
 * entire world intelligence visual... Create a lightweight mobile
 * representation." This is that representation: a compact,
 * partial-horizon strip using the SAME real geometry and projection
 * utilities as the desktop HeroWorldVisual (nothing duplicated at the
 * data/math layer), but deliberately lighter — a shorter viewport
 * (cropping to a horizontal equatorial band rather than the full
 * world height), fewer ambient nodes, a coarser coordinate-decimation
 * factor, and no radar-sweep wedge (the desktop's heavier decorative
 * element) — genuinely inexpensive to render on a phone, not the
 * desktop visual simply scaled down in CSS.
 *
 * Server Component: zero client JS, same as the desktop version.
 */
const MOBILE_VIEWPORT: ProjectionViewport = { width: 400, height: 140 };
const MOBILE_KEEP_EVERY_NTH_POINT = 7;

interface MobileNode {
  x: number;
  y: number;
  color: string;
}

/** Fixed, arbitrary decorative positions — never derived from real article/country data, same discipline as the desktop version. */
const MOBILE_NODES: MobileNode[] = [
  { x: 90, y: 55, color: '#22d3ee' },
  { x: 190, y: 40, color: '#34d399' },
  { x: 260, y: 75, color: '#fbbf24' },
  { x: 320, y: 50, color: '#a78bfa' },
];

export function HeroWorldVisualMobile(): JSX.Element {
  const collection = getCountryFeatureCollection();

  return (
    <div aria-hidden="true" className="relative h-full w-full overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-b from-[#040914] to-[#020509]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.14),transparent_65%)]" />

      <svg viewBox={`0 0 ${MOBILE_VIEWPORT.width} ${MOBILE_VIEWPORT.height}`} className="relative h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <style>
          {`
            @keyframes gna-hero-mobile-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
            .gna-hero-mobile-node { animation: gna-hero-mobile-pulse 3.2s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) { .gna-hero-mobile-node { animation: none !important; opacity: 0.7 !important; } }
          `}
        </style>

        <g stroke="#22d3ee" strokeWidth="0.5" fill="#0e7490" fillOpacity="0.1" opacity="0.75">
          {collection.features.map((feature: CountryFeature) => (
            <path
              key={feature.properties.numericId}
              d={geometryToPathD(
                feature.geometry as { type: 'Polygon' | 'MultiPolygon'; coordinates: any },
                MOBILE_VIEWPORT,
                MOBILE_KEEP_EVERY_NTH_POINT,
              )}
            />
          ))}
        </g>

        {MOBILE_NODES.map((node, index) => (
          <circle
            key={index}
            cx={node.x}
            cy={node.y}
            r="2"
            fill={node.color}
            className="gna-hero-mobile-node"
            style={{ animationDelay: `${index * 0.5}s` }}
          />
        ))}
      </svg>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020509]/70 via-transparent to-transparent" />
    </div>
  );
}
