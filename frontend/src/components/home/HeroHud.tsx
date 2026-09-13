/**
 * M66.3 — HeroHud. GN-CD-042 (desktop) and GN-CD-042b (mobile), the Hero's
 * construction / HUD layer, transcribed verbatim from the released
 * specification.
 *
 * BOTH VIEWPORTS ARE AUTHORED SEPARATELY, NOT SCALED. GN-CD-042b is a
 * recomposition — 2 rings, 1 trajectory, 1 crosshair, 4 ticks and NO sweep
 * against the desktop layer's 23 sub-layers. The design's own responsive table
 * forbids "reusing the desktop HUD at small size", so this file renders two
 * independent SVGs and lets the `cd-hero` breakpoint choose between them,
 * exactly as the Hero itself hands off.
 *
 * PRESENTATION ONLY — DATA SOURCE: NONE (GN-CD §P). Every path here is
 * construction geometry. Nothing is measured, nothing is counted, nothing is
 * derived from any article, signal, country or timestamp, and nothing here may
 * ever be described to a user as intelligence. The whole layer is
 * `aria-hidden` and `pointer-events-none`.
 *
 * THE CROSSHAIR IS DELIBERATELY OFF-CENTRE (GN-CD §U.12). In the 1500-unit
 * desktop viewBox, (900,200) is 60% of the width, which after
 * `preserveAspectRatio="xMidYMid slice"` lands over the map's eastern
 * hemisphere. It reads as a targeting reticle, not as a centre mark. The
 * mobile crosshair at (250,80) preserves the same relationship under the
 * mobile map bleed at top-right.
 *
 * STROKE CEILING. GN-CD-300 §W.1 caps the HUD construction ladder at .22 on
 * both the sky and cyan channels. The brightest stroke below is the crosshair
 * at `rgba(34,211,238,.22)`; `heroGeometry.spec.ts` asserts that no stroke in
 * this file exceeds it.
 *
 * MOTION. The desktop sweep arc is the released `animate-cd-hud-sweep-hero`
 * (`cd-spin 90s linear infinite`, GN-CD-304 §L.2). Under
 * `prefers-reduced-motion: reduce` the universal rule in globals.css zeroes its
 * duration, so the arc simply rests at its start position with no layout
 * shift — GN-CD's own required reduced-motion behaviour for this element.
 */
export function HeroHud(): JSX.Element {
  return (
    <>
      {/* GN-CD-042 — desktop. Renders only where the three-column console does. */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 1500 430"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-hidden cd-hero:block"
      >
        <g fill="none" stroke="rgba(56,189,248,.09)">
          <circle cx="900" cy="200" r="560" />
          <circle cx="900" cy="200" r="420" strokeDasharray="2 9" />
          <circle cx="1320" cy="470" r="330" stroke="rgba(34,211,238,.07)" />
          <path d="M120 400 C 420 250 760 120 1420 60" strokeDasharray="3 10" stroke="rgba(56,189,248,.11)" />
          <path d="M-40 120 C 380 200 700 330 1500 300" strokeDasharray="3 12" stroke="rgba(56,189,248,.07)" />

          <g stroke="rgba(56,189,248,.07)">
            <path d="M900 200 L 470 30" />
            <path d="M900 200 L 1500 420" />
            <path d="M900 200 L 300 400" />
            <path d="M900 200 L 1460 40" />
          </g>

          <g stroke="rgba(34,211,238,.22)">
            <path d="M872 200 h18" />
            <path d="M910 200 h18" />
            <path d="M900 172 v18" />
            <path d="M900 210 v18" />
          </g>

          <g stroke="rgba(56,189,248,.14)">
            <path d="M60 418 v-7" />
            <path d="M120 418 v-11" />
            <path d="M180 418 v-7" />
            <path d="M240 418 v-7" />
            <path d="M300 418 v-11" />
            <path d="M360 418 v-7" />
            <path d="M1140 14 h-7" />
            <path d="M1140 34 h-11" />
            <path d="M1140 54 h-7" />
          </g>

          <circle
            cx="900"
            cy="200"
            r="250"
            stroke="rgba(34,211,238,.1)"
            strokeDasharray="70 620"
            className="animate-cd-hud-sweep-hero"
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        </g>
      </svg>

      {/* GN-CD-042b — mobile. A recomposition, not a scale: no sweep, no radials, no edge ticks on the right. */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 340 300"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden cd-hero:hidden"
      >
        <g fill="none" stroke="rgba(56,189,248,.09)">
          <circle cx="250" cy="80" r="180" />
          <circle cx="250" cy="80" r="120" strokeDasharray="2 9" />
          <path d="M-20 240 C 90 190 190 120 360 70" strokeDasharray="3 10" stroke="rgba(56,189,248,.1)" />

          <g stroke="rgba(34,211,238,.2)">
            <path d="M234 80 h12" />
            <path d="M254 80 h12" />
            <path d="M250 64 v12" />
            <path d="M250 84 v12" />
          </g>

          <g stroke="rgba(56,189,248,.13)">
            <path d="M20 292 v-6" />
            <path d="M50 292 v-9" />
            <path d="M80 292 v-6" />
            <path d="M110 292 v-6" />
          </g>
        </g>
      </svg>
    </>
  );
}
