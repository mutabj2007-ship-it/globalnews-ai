/**
 * Milestone #51 (browser-acceptance UX polish) — a lightweight,
 * purely decorative animated world visual for WorldMapGateway.tsx.
 *
 * CRITICAL: this file imports nothing from `maplibre-gl`,
 * `@/components/map/*`, or `next/dynamic`. It is inline SVG with a
 * `<style>` block defining slow CSS keyframe animations — no Canvas,
 * no WebGL, no animation library, no client-side JavaScript at all.
 * This is deliberately a Server Component (no 'use client'): every
 * animation here is pure CSS (`transform`/`opacity`), which the
 * browser can run entirely on the compositor thread — GPU-friendly,
 * zero React re-renders, zero client bundle cost.
 *
 * The world outline is a deliberately ABSTRACT/stylized dot-grid
 * silhouette, not a real geographic projection — this sidesteps
 * needing real map geometry data (which would start reintroducing the
 * dependency this component exists specifically to avoid) while still
 * reading clearly as "a world map" at a glance.
 *
 * The pulsing nodes are placed at FIXED, arbitrary positions and are
 * NOT tied to any real country, coordinate, or article — per explicit
 * product guidance, this codebase has no geocoded article data, so
 * placing markers that implied "a story happened here" would be a
 * false claim. These are ambient decoration only, `aria-hidden`,
 * conveying "live global activity" as a feeling, never as data.
 *
 * Reduced motion: every animated element uses Tailwind's
 * `motion-reduce:` variant to freeze in place — the visual remains
 * fully present and attractive, only the movement stops.
 */
export function WorldMapAnimatedVisual(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="relative h-full w-full overflow-hidden rounded-xl border border-border-strong bg-void"
    >
      <svg viewBox="0 0 320 200" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <style>
          {`
            @keyframes gna-drift {
              0%   { transform: translateX(-4px); }
              50%  { transform: translateX(4px); }
              100% { transform: translateX(-4px); }
            }
            @keyframes gna-pulse {
              0%, 100% { opacity: 0.35; r: 2.2; }
              50%      { opacity: 0.95; r: 3.2; }
            }
            .gna-drift-group {
              animation: gna-drift 14s ease-in-out infinite;
            }
            .gna-node {
              animation: gna-pulse 3.6s ease-in-out infinite;
              transform-box: fill-box;
              transform-origin: center;
            }
            @media (prefers-reduced-motion: reduce) {
              .gna-drift-group, .gna-node {
                animation: none !important;
              }
            }
          `}
        </style>

        {/* Latitude/longitude grid — static, gives the silhouette its "globe" read. */}
        <g stroke="currentColor" className="text-border-strong" strokeWidth="0.5" fill="none" opacity="0.5">
          <ellipse cx="160" cy="100" rx="150" ry="92" />
          <ellipse cx="160" cy="100" rx="150" ry="55" />
          <ellipse cx="160" cy="100" rx="90" ry="92" />
          <line x1="10" y1="100" x2="310" y2="100" />
        </g>

        {/* Abstract stylized landmass dot-grid — slow horizontal drift. */}
        <g className="gna-drift-group text-signal/70" fill="currentColor">
          {[
            [40, 70], [48, 78], [56, 72], [64, 82], [44, 90], [52, 96],
            [130, 55], [140, 62], [150, 58], [160, 68], [170, 60], [135, 75], [148, 80],
            [220, 75], [230, 68], [240, 78], [250, 72], [225, 90], [238, 95], [248, 88],
            [90, 120], [100, 128], [110, 122], [80, 132],
            [260, 130], [270, 122], [255, 140],
          ].map(([cx, cy], index) => (
            <circle key={index} cx={cx} cy={cy} r="1.6" opacity="0.55" />
          ))}
        </g>

        {/* Ambient "activity" pulses — fixed positions, not tied to real data. */}
        <g className="text-signal-bright" fill="currentColor">
          {[
            [56, 76],
            [150, 62],
            [238, 82],
            [100, 124],
            [262, 128],
          ].map(([cx, cy], index) => (
            <circle key={index} cx={cx} cy={cy} r="2.2" className="gna-node" style={{ animationDelay: `${index * 0.7}s` }} />
          ))}
        </g>
      </svg>

      {/* Subtle vignette so the visual recedes into the panel rather than reading as a hard-edged inset box. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void/60 via-transparent to-transparent" />
    </div>
  );
}
