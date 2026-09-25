import type { JSX } from 'react';

import {
  HERO_GLOBE_CENTRE,
  HERO_GLOBE_LAND_PATH,
  HERO_GLOBE_RADIUS,
  HERO_GLOBE_VIEWBOX,
} from '@/components/home/heroGlobeGeometry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE HERO GLOBE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * BETA HOME FINAL RECOVERY R1, zone Z2. The Product Owner rejected the
 * previous hero treatment in terms: *"The current technical map treatment is
 * not accepted as the final Hero"*, and asked for *"large world/globe
 * presence; stronger dark-blue illuminated background"* with *"visual impact
 * comparable to the Product Owner prototype"*.
 *
 * ── WHY A SPHERE AND NOT THE EXISTING FLAT MAP ──────────────────────────
 *
 * `HeroWorldVisual` draws a flat equirectangular world in cyan wireframe with
 * arcs and a focus node. That is precisely the technical treatment the ruling
 * rejects, and no amount of restyling makes a flat wireframe read as the lit
 * Earth in the screenshot. It is RETIRED FROM THE HERO, NOT DELETED — the
 * convention this codebase already applies to TodaySection, LatestNowRail and
 * IntelligenceEngineRing — so the surface it drew stays inspectable beside the
 * one that replaced it, and its spec keeps passing because that spec reads the
 * file rather than this one.
 *
 * ── EVERY LIGHT ON THIS GLOBE IS THE SUN, NOT AN EVENT ──────────────────
 *
 * This is the rule that governs the whole component, and it is why the
 * illumination is built the way it is.
 *
 * The prototype's globe carries small bright points. Reproducing them as
 * discrete marks would put dots on a world map on the product's front page,
 * and a reader would be entirely reasonable to read a dot on a world map as
 * something happening there. The activation forbids exactly that: *"Do not use
 * fake live event marks merely to reproduce the prototype appearance."*
 *
 * So there are NO POINT MARKS ANYWHERE IN THIS FILE. The lit side is a
 * continuous gradient wash and a warm bloom clipped to land — light that
 * falls across a hemisphere, which cannot be mistaken for a located event,
 * because an event is a point and this has no points. The honest render is
 * slightly quieter than the prototype, and that is the correct direction to
 * miss in.
 *
 * ── AND IT IS DECORATION, DECLARED AS SUCH ──────────────────────────────
 *
 * `aria-hidden`, no text, no interaction, no data input, no state. Pure SVG
 * and CSS: no canvas, no JavaScript, no animation frame, so it cannot shift
 * layout, needs no reduced-motion branch, and adds nothing to the client
 * bundle. It is a Server Component like the hero that hosts it.
 */
export function HeroGlobe(): JSX.Element {
  const c = HERO_GLOBE_CENTRE;
  const r = HERO_GLOBE_RADIUS;

  return (
    <svg
      viewBox={`0 0 ${HERO_GLOBE_VIEWBOX} ${HERO_GLOBE_VIEWBOX}`}
      className="h-full w-full"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/*
          THE BODY OF THE SPHERE. The highlight sits up and to the left of
          centre, which is what makes a circle read as a ball rather than a
          disc: the terminator then falls away to the lower right on its own,
          with no second layer painting a shadow on.
        */}
        <radialGradient id="gna-globe-body" cx="34%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#1b558c" />
          <stop offset="38%" stopColor="#123c66" />
          <stop offset="72%" stopColor="#0a2036" />
          <stop offset="100%" stopColor="#030a12" />
        </radialGradient>

        {/*
          THE ATMOSPHERE. Transparent through the body and cyan only in the
          last few percent, so it reads as a limb rather than as a ring drawn
          around the planet — the mistake that made the R5.1 prototype asset
          unusable.
        */}
        <radialGradient id="gna-globe-atmosphere" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(34,211,238,0)" />
          <stop offset="86%" stopColor="rgba(34,211,238,0)" />
          <stop offset="96%" stopColor="rgba(56,189,248,0.42)" />
          <stop offset="100%" stopColor="rgba(34,211,238,0)" />
        </radialGradient>

        {/* The warm side of daylight, clipped to land below. No points. */}
        <radialGradient id="gna-globe-daylight" cx="36%" cy="30%" r="62%">
          <stop offset="0%" stopColor="rgba(198,236,255,0.42)" />
          <stop offset="45%" stopColor="rgba(125,211,252,0.18)" />
          <stop offset="100%" stopColor="rgba(125,211,252,0)" />
        </radialGradient>

        <clipPath id="gna-globe-land-clip">
          <path d={HERO_GLOBE_LAND_PATH} />
        </clipPath>

        <clipPath id="gna-globe-sphere-clip">
          <circle cx={c} cy={c} r={r} />
        </clipPath>
      </defs>

      {/* Outer bloom — the glow the dark-blue field is lit by. */}
      <circle cx={c} cy={c} r={r * 0.99} fill="url(#gna-globe-atmosphere)" opacity="0.9" />

      <g clipPath="url(#gna-globe-sphere-clip)">
        <circle cx={c} cy={c} r={r} fill="url(#gna-globe-body)" />

        {/*
          GRATICULE. Meridians as ellipses whose horizontal radius shrinks
          toward the limb is the orthographic behaviour; parallels are straight
          ellipse arcs flattened by latitude. Drawn at a tenth of an opacity
          step so the world reads as a modelled sphere at a glance and the
          lines are never legible enough to compete with the headline.
        */}
        <g fill="none" stroke="#7dd3fc" strokeWidth="1.1" opacity="0.17">
          {[0.22, 0.48, 0.74, 1].map((k) => (
            <ellipse key={`m${k}`} cx={c} cy={c} rx={r * k} ry={r} />
          ))}
          {[-0.62, -0.32, 0, 0.32, 0.62].map((k) => (
            <ellipse
              key={`p${k}`}
              cx={c}
              cy={c + k * r}
              rx={r * Math.sqrt(Math.max(0, 1 - k * k))}
              ry={r * 0.08 * Math.sqrt(Math.max(0, 1 - k * k))}
            />
          ))}
        </g>

        {/* Land. Reference geography, drawn as a silhouette one step above the ocean. */}
        <path d={HERO_GLOBE_LAND_PATH} fill="#3f8fd0" fillOpacity="0.58" />
        <path d={HERO_GLOBE_LAND_PATH} fill="none" stroke="#a8d8f5" strokeWidth="1.2" opacity="0.34" />

        {/*
          The lit hemisphere, clipped to land so the continents carry the
          daylight and the ocean stays dark — the relationship the prototype's
          Earth has. A wash, never a point.
        */}
        <g clipPath="url(#gna-globe-land-clip)">
          <circle cx={c} cy={c} r={r} fill="url(#gna-globe-daylight)" />
        </g>

        {/* Terminator: the night side deepening toward the lower-right limb. */}
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="#02060c"
          strokeWidth={r * 0.42}
          opacity="0.52"
          transform={`translate(${r * 0.1} ${r * 0.12})`}
        />
      </g>

      {/* The limb itself — one hairline, so the sphere has an edge. */}
      <circle cx={c} cy={c} r={r - 1} fill="none" stroke="rgba(148,220,255,0.55)" strokeWidth="2.5" />
    </svg>
  );
}
