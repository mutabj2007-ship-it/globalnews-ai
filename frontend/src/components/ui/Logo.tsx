import { useId } from 'react';

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  /**
   * M66.2 — rendered emblem size in px. GN-CD-022: "one identity, four sizes"
   * — 30px desktop header, 28px desktop footer, 26px mobile. **Defaults to
   * the pre-M66.2 28px**, so every existing call site renders byte-identically
   * unless it explicitly asks otherwise (CTO decision D5). Only the desktop
   * header overrides it, to the released 30px.
   */
  size?: number;
  /**
   * M66.2 — gap between the emblem and the wordmark, in px. GN-CD-021 releases
   * `11px` for the desktop header lockup; the mobile (GN-CD-221) and footer
   * (GN-CD-201) lockups are unreleased. **Defaults to the pre-M66.2 10px** so
   * the mobile header and footer are untouched, per CTO authorization §12.
   */
  gapPx?: number;
}

/**
 * C2.1 — GlobalNews AI radar emblem, translated from the approved
 * Claude Design reference (Emblem.dc.html) into a proper reusable
 * React/SVG component. The prototype's own SVG markup was already
 * framework-agnostic and self-contained (no dependency on that
 * file's support.js wrapper — confirmed by direct inspection: the
 * <svg> itself never references anything outside its own <defs>), so
 * the geometry/gradient/filter structure below is a faithful,
 * hand-translated port of that markup — not a copy-paste of the
 * prototype file, and independent of any prototype runtime.
 *
 * M66.2 — GN-CD-021/022/023 corrections, all inside this file:
 *   - `size` and `gapPx` props, so the desktop header can ask for the released
 *     30px box and 11px lockup gap while every other call site keeps today's
 *     28px / 10px byte-identically (CTO decision D5, authorization §12).
 *   - `overflow-visible` on the SVG. GN-CD-022: "declared and is required" —
 *     the cardinal ticks sit inside the viewBox but the blurred core's filter
 *     region extends beyond it, so without this the glow is clipped.
 *   - the wordmark is now the released Space Grotesk 19px / 700 / -0.01em
 *     (`font-cd-display` + `text-cd-wordmark`) instead of 18px / 500 /
 *     -0.025em, and "AI" is the released `#38bdf8` instead of `#22d3ee`.
 *   - the propagating ring and the core now use the released `gnEmbRing`
 *     (4.6s, radius 7 -> 18) and `gnEmbCore` (3.4s, `.62` trough) timings via
 *     the `cd-emb-*` tokens M66.1 added for this purpose.
 * Unchanged and deliberately so: `useId()`, `aria-hidden`, every radius, dash
 * array, stroke width and colour, and the 14s scan, which was already exact.
 *
 * `useId()` gives each rendered instance its own gradient/filter ids
 * — required because this component renders more than once per page
 * (NavBar + Footer, at minimum), and SVG `url(#id)` references must
 * be unique within a single document.
 *
 * Motion: three layered animations. M66.2 brought all three onto the
 * released GN-CD-304 §L.1 declarations —
 *   - rotating scan spoke: `emblem-scan`, 14s linear. This one was
 *     already exact from C2.1 and is unchanged.
 *   - propagating ring: `cd-emb-ring`, 4.6s ease-out, animating the
 *     RADIUS from 7 to 18. C2.1 approximated this with the existing
 *     `ring-pulse` keyframe at 3.2s on a transform scale; the released
 *     keyframe replaces it.
 *   - core: `cd-emb-core`, 3.4s ease-in-out with a .62 trough. C2.1
 *     used Tailwind's built-in pulse utility (2s, .5 trough), which
 *     could not be retimed because four other elements share it.
 * `prefers-reduced-motion` is handled globally already (see
 * globals.css's existing `@media (prefers-reduced-motion: reduce)`
 * block, which forces all CSS animation durations to ~0) — every
 * animation here is a plain CSS `animation`, so it is automatically
 * covered by that existing rule without any new per-component media
 * query.
 */
export function Logo({ className = '', showWordmark = true, size = 28, gapPx = 10 }: LogoProps): JSX.Element {
  const uid = useId();
  const glowId = `gnEmbGlow-${uid}`;
  const blurId = `gnEmbBlur-${uid}`;

  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: `${gapPx}px` }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 overflow-visible"
      >
        <defs>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.42" />
            <stop offset="55%" stopColor="#0e7490" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#04060c" stopOpacity="0" />
          </radialGradient>
          <filter id={blurId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer glow field */}
        <circle cx="20" cy="20" r="19" fill={`url(#${glowId})`} />

        {/* Outer ring: solid base + a brighter dashed accent arc on top */}
        <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(34,211,238,0.62)" strokeWidth="1.3" />
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="rgba(103,232,249,0.95)"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeDasharray="15 98"
        />

        {/* Middle ring */}
        <circle cx="20" cy="20" r="13.5" fill="none" stroke="rgba(34,211,238,0.3)" strokeWidth="1" />

        {/* Inner dashed ring */}
        <circle
          cx="20"
          cy="20"
          r="9"
          fill="none"
          stroke="rgba(34,211,238,0.5)"
          strokeWidth="1"
          strokeDasharray="3 5"
        />

        {/* Crosshair ticks, N/S/E/W */}
        <g stroke="rgba(103,232,249,0.75)" strokeWidth="1.2" strokeLinecap="round">
          <path d="M20 0.6 v3.4" />
          <path d="M20 36 v3.4" />
          <path d="M0.6 20 h3.4" />
          <path d="M36 20 h3.4" />
        </g>

        {/* Rotating scan spoke */}
        <g className="origin-center animate-emblem-scan" style={{ transformBox: 'fill-box' }}>
          <path d="M20 20 L20 4.5" stroke="rgba(103,232,249,0.55)" strokeWidth="1.1" strokeLinecap="round" fill="none" />
        </g>

        {/*
          M66.2 — the released `gnEmbRing` propagating ring: GN-CD-304 §L.1
          animates the RADIUS from 7 to 18 over 4.6s ease-out, not a transform
          scale over 3.2s. The token was added by M66.1 for exactly this
          correction and is consumed here for the first time. `origin-center`
          is gone because nothing transforms any more.
        */}
        <circle cx="20" cy="20" r="7" fill="none" stroke="#67e8f9" strokeWidth="1" className="animate-cd-emb-ring" />

        {/*
          M66.2 — the released `gnEmbCore`: 3.4s ease-in-out with a `.62`
          trough, replacing Tailwind's built-in `animate-pulse` (2s, `.5`).
        */}
        <circle cx="20" cy="20" r="4.6" fill="#22d3ee" filter={`url(#${blurId})`} className="animate-cd-emb-core" />
      </svg>
      {showWordmark && (
        <span className="font-cd-display text-cd-wordmark text-cd-ink-primary">
          GlobalNews <span className="text-cd-ink-wordmark">AI</span>
        </span>
      )}
    </span>
  );
}
