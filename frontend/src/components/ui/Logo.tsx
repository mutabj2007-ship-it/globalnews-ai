import { useId } from 'react';

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
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
 * `useId()` gives each rendered instance its own gradient/filter ids
 * — required because this component renders more than once per page
 * (NavBar + Footer, at minimum), and SVG `url(#id)` references must
 * be unique within a single document.
 *
 * Motion: three layered animations, all mapped onto animation
 * utilities that already exist in this codebase rather than
 * introducing a parallel animation system —
 *   - rotating scan line: the ONE new keyframe added this round
 *     (`emblem-scan`, tailwind.config.ts), matching the reference's
 *     14s linear rotation exactly.
 *   - breathing outer ring: reuses the ALREADY-EXISTING `ring-pulse`
 *     keyframe/animation (previously used elsewhere in this HUD
 *     visual language) rather than adding a near-duplicate one.
 *   - pulsing core: Tailwind's own built-in `animate-pulse` utility
 *     — no configuration needed at all.
 * `prefers-reduced-motion` is handled globally already (see
 * globals.css's existing `@media (prefers-reduced-motion: reduce)`
 * block, which forces all CSS animation durations to ~0) — every
 * animation here is a plain CSS `animation`, so it is automatically
 * covered by that existing rule without any new per-component media
 * query.
 */
export function Logo({ className = '', showWordmark = true }: LogoProps): JSX.Element {
  const uid = useId();
  const glowId = `gnEmbGlow-${uid}`;
  const blurId = `gnEmbBlur-${uid}`;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
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

        {/* Breathing outer ring — reuses the existing ring-pulse animation utility */}
        <circle
          cx="20"
          cy="20"
          r="7"
          fill="none"
          stroke="#67e8f9"
          strokeWidth="1"
          className="origin-center animate-ring-pulse"
        />

        {/* Pulsing core — Tailwind's built-in animate-pulse utility */}
        <circle cx="20" cy="20" r="4.6" fill="#22d3ee" filter={`url(#${blurId})`} className="animate-pulse" />
      </svg>
      {showWordmark && (
        <span className="font-display text-lg font-medium tracking-tight text-ink-primary">
          GlobalNews <span className="text-cyan-400">AI</span>
        </span>
      )}
    </span>
  );
}
