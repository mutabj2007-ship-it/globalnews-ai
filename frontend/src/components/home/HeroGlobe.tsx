import type { JSX } from 'react';

import {
  HERO_GLOBE_CENTRE,
  HERO_GLOBE_FIELD_ARCS,
  HERO_GLOBE_LAND_PATH,
  HERO_GLOBE_RADIUS,
  HERO_GLOBE_VIEWBOX,
} from '@/components/home/heroGlobeGeometry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE HERO GLOBE — NIGHT EARTH
 * ════════════════════════════════════════════════════════════════════════════
 *
 * BETA HOME FINAL RECOVERY R1, zone Z2, second pass under the HERO CORRECTION
 * RULING. The first pass was refused in terms: *"too large, too flat, too
 * cropped, and positioned incorrectly"*, and *"Do not use the current flat
 * light-blue hemisphere treatment as the final result."* The ruling's target
 * list is the specification this file is written against:
 *
 *     darker night-Earth treatment · strong blue atmospheric rim ·
 *     illuminated land/city-light texture · richer depth ·
 *     subtle cyan intelligence arcs/field lines ·
 *     premium, luminous world-intelligence feeling ·
 *     NO discrete incident/event dots
 *
 * ── THE ONE RULE THAT SHAPES EVERY DECISION BELOW ───────────────────────
 *
 * The ruling grants city-light illumination and withholds event marks in the
 * same breath: *"City-light illumination is allowed as decorative geographic
 * lighting. It must not resemble individual event markers, pulsing incidents,
 * alerts or data points."*
 *
 * The line between the two is not brightness or size. It is **whether the
 * light is located**. An event mark is somewhere in particular; it says
 * *here*. City light is everywhere people are, and says nothing about today.
 *
 * So the city-light layer is a UNIFORM SVG `<pattern>` tiled across the whole
 * land mass at a fixed pitch, clipped to the coastline and graded only by the
 * daylight gradient. Every square degree of land receives the same treatment.
 * That is what makes it unreadable as data: **there is no subset of the world
 * that is lit and no subset that is not**, so no viewer can infer that
 * anything is happening anywhere. It is texture, mathematically — the pattern
 * is position-independent by construction, and a pattern cannot point at a
 * place.
 *
 * Nothing in this file pulses, blinks, animates or changes. There is no
 * `<animate>`, no CSS animation and no JavaScript, so nothing here can ever
 * read as an alert. The arcs are open curves with NO endpoint nodes, because a
 * dot at the end of an arc is exactly the marker shape the ruling excludes.
 *
 * ── DEPTH, WHICH IS WHAT "FLAT" MEANT ───────────────────────────────────
 *
 * The first pass was flat because it had one body gradient and one wash. This
 * one stacks five separable cues, each doing a different job:
 *
 *   1  body gradient, highlight off-centre        the ball
 *   2  city-light pattern clipped to land          the surface
 *   3  daylight wash clipped to land               the lit hemisphere
 *   4  terminator ring, offset toward lower-right  the shadowed limb
 *   5  atmospheric rim + outer bloom               the air above it
 *
 * ── AND IT IS DECORATION, DECLARED AS SUCH ──────────────────────────────
 *
 * `aria-hidden`, no text, no interaction, no data input, no state. Pure SVG:
 * no canvas, no JavaScript, no animation frame, so it cannot shift layout,
 * needs no reduced-motion branch, and adds nothing to the client bundle. It is
 * a Server Component like the hero that hosts it.
 *
 * `HeroWorldVisual` remains RETIRED FROM THE HERO, NOT DELETED. Its own spec
 * reads that file rather than this one and keeps passing.
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
          1 · THE BODY. Night Earth: the ocean is nearly black at the limb and
          only just blue at the highlight, so the land can carry the light. The
          highlight sits up and left of centre, which is what makes a circle
          read as a ball rather than a disc.
        */}
        <radialGradient id="gna-globe-body" cx="36%" cy="27%" r="76%">
          <stop offset="0%" stopColor="#123a63" />
          <stop offset="34%" stopColor="#0a2844" />
          <stop offset="68%" stopColor="#04101f" />
          <stop offset="100%" stopColor="#01060d" />
        </radialGradient>

        {/*
          5 · THE ATMOSPHERE. Transparent through the body and blue only in the
          last few percent, so it reads as a limb rather than a ring drawn
          around the planet — the mistake that made the R5.1 prototype asset
          unusable. Two stops of it: a tight bright rim and a wide soft bloom.
        */}
        <radialGradient id="gna-globe-rim" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(56,189,248,0)" />
          <stop offset="88%" stopColor="rgba(56,189,248,0)" />
          <stop offset="95.5%" stopColor="rgba(96,206,255,0.55)" />
          <stop offset="99%" stopColor="rgba(56,189,248,0.30)" />
          <stop offset="100%" stopColor="rgba(34,211,238,0)" />
        </radialGradient>

        <radialGradient id="gna-globe-bloom" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(34,211,238,0)" />
          <stop offset="78%" stopColor="rgba(34,211,238,0)" />
          <stop offset="92%" stopColor="rgba(56,189,248,0.16)" />
          <stop offset="100%" stopColor="rgba(34,211,238,0)" />
        </radialGradient>

        {/* 3 · The lit hemisphere. A wash, graded, never a point. */}
        <radialGradient id="gna-globe-daylight" cx="34%" cy="26%" r="66%">
          <stop offset="0%" stopColor="rgba(165,220,255,0.42)" />
          <stop offset="42%" stopColor="rgba(96,165,250,0.16)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0)" />
        </radialGradient>

        {/*
          2 · CITY LIGHT. A uniform tile, repeated across the entire land mass.
          The pitch is 18 units in a 1000-unit sphere, so at the sizes this is
          drawn the individual marks fall below a device pixel and resolve as
          grain. Uniformity is the safety property: every part of every
          continent gets the identical treatment, so the texture carries no
          information about anywhere and cannot be read as an observation.
        */}
        <pattern id="gna-globe-citylight" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="1.15" fill="#ffd9a0" opacity="0.55" />
          <circle cx="13" cy="9" r="0.85" fill="#bfe4ff" opacity="0.42" />
          <circle cx="8" cy="14" r="0.7" fill="#ffe3b8" opacity="0.34" />
          <circle cx="16" cy="16" r="0.55" fill="#cfe9ff" opacity="0.26" />
        </pattern>

        {/* The city-light layer is brightest where the sun is, and fades out into the night side. */}
        <radialGradient id="gna-globe-citymask" cx="38%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.58" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.16" />
        </radialGradient>
        <mask id="gna-globe-citymask-m">
          <circle cx={c} cy={c} r={r} fill="url(#gna-globe-citymask)" />
        </mask>

        <clipPath id="gna-globe-land-clip">
          <path d={HERO_GLOBE_LAND_PATH} />
        </clipPath>
        <clipPath id="gna-globe-sphere-clip">
          <circle cx={c} cy={c} r={r} />
        </clipPath>
      </defs>

      {/* Outer bloom — the air the dark-blue field is lit by. */}
      <circle cx={c} cy={c} r={r * 1.06} fill="url(#gna-globe-bloom)" />

      <g clipPath="url(#gna-globe-sphere-clip)">
        <circle cx={c} cy={c} r={r} fill="url(#gna-globe-body)" />

        {/*
          GRATICULE. Meridians as ellipses whose horizontal radius shrinks
          toward the limb is the orthographic behaviour; parallels are flattened
          by latitude. Drawn faint, so the world reads as a modelled sphere at a
          glance without ever competing with the headline.
        */}
        <g fill="none" stroke="#7dd3fc" strokeWidth="1" opacity="0.11">
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

        {/* Land, as a dark continent body one step above the ocean. */}
        <path d={HERO_GLOBE_LAND_PATH} fill="#1b4e7e" fillOpacity="0.78" />

        <g clipPath="url(#gna-globe-land-clip)">
          {/* 3 · daylight across the lit hemisphere */}
          <circle cx={c} cy={c} r={r} fill="url(#gna-globe-daylight)" />
          {/* 2 · city light, uniform over all land, graded by the same sun */}
          <rect
            x="0"
            y="0"
            width={HERO_GLOBE_VIEWBOX}
            height={HERO_GLOBE_VIEWBOX}
            fill="url(#gna-globe-citylight)"
            mask="url(#gna-globe-citymask-m)"
          />
        </g>

        {/* Coastline, so the continents keep their edge against the ocean. */}
        <path d={HERO_GLOBE_LAND_PATH} fill="none" stroke="#9ed6f5" strokeWidth="1.1" opacity="0.38" />

        {/*
          THE INTELLIGENCE FIELD. Open cyan curves over the sphere — the
          ruling's *"subtle cyan intelligence arcs/field lines"*. They have NO
          endpoint nodes: a dot at the end of an arc is precisely the marker
          shape the ruling excludes, so the curves simply begin and end. They
          are decorative geometry and connect nothing.
        */}
        <g fill="none" stroke="#5eead4" strokeWidth="1.5" opacity="0.26" strokeLinecap="round">
          {HERO_GLOBE_FIELD_ARCS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>

        {/* 4 · TERMINATOR. The night side deepening toward the lower-right limb. */}
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="#01050b"
          strokeWidth={r * 0.46}
          opacity="0.50"
          transform={`translate(${r * 0.13} ${r * 0.15})`}
        />
      </g>

      {/* 5 · the rim itself, above the terminator so the limb stays lit. */}
      <circle cx={c} cy={c} r={r} fill="url(#gna-globe-rim)" />
      <circle cx={c} cy={c} r={r - 1} fill="none" stroke="rgba(125,211,252,0.45)" strokeWidth="1.5" />
    </svg>
  );
}
