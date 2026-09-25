import type { JSX } from 'react';
import Image from 'next/image';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE HERO GLOBE — DECORATIVE NIGHT-EARTH ASSET
 * ════════════════════════════════════════════════════════════════════════════
 *
 * DESKTOP FIDELITY CORRECTION R2 §2, which both lifted a constraint and
 * authorised a different technique:
 *
 *   "Your safety conclusion — no fake event marks — is correct. Your
 *    implementation rule — every square degree of land must be treated
 *    identically — is not required. It is making the globe visually flat."
 *
 *   "If procedural SVG cannot produce this convincingly, do not keep forcing
 *    it. Create/export a dedicated decorative Hero globe asset from the design
 *    lane and use it as a presentation asset."
 *
 * It could not, so this is that asset. The SVG globe is gone from this file.
 *
 * ── WHERE THE IMAGE COMES FROM ──────────────────────────────────────────
 *
 * `scripts/hero-globe/render.py`, a build tool that is never imported by the
 * application and never enters the bundle. It renders an orthographic Earth
 * framed on Europe and Africa from the repository's own `world-atlas`
 * coastline, adds a sun-lit hemisphere with a terminator, a cloud veil, a
 * coastal rim, a soft atmosphere and warm urban glow, and writes
 * `public/images/hero-globe-night.png`. Re-running it reproduces the asset
 * byte for byte: every value in it is fixed and its noise is seeded.
 *
 * ── WHY THE URBAN GLOW IS NOT REPORTING ─────────────────────────────────
 *
 * The lighting is now spatially non-uniform, as the ruling permits, and it
 * sits at the positions of about 150 of the world's largest urban areas. That
 * is a fact about where people live; it says nothing about what happened
 * today. The reasons it cannot be read as reporting are structural, not
 * stylistic:
 *
 *   · it is a FLAT IMAGE baked at build time, identical on every load, so it
 *     cannot vary with the feed even in principle;
 *   · nothing on the page reads it, and no value is derived from it;
 *   · no legend names it, no label points at it, nothing is clickable;
 *   · each city is a CLUSTER of soft blooms with no single centre, not one
 *     crisp mark — there is no point a reader could take as "here";
 *   · nothing animates, so nothing can read as an alert.
 *
 * The ruling's remaining prohibition — no discrete pulsating incident dots —
 * is met on all three counts: not discrete, not pulsating, not incidents.
 *
 * ── DECORATION, DECLARED ────────────────────────────────────────────────
 *
 * `aria-hidden`, empty `alt`, `pointer-events-none` at the call site, no
 * state, no interaction. It is a Server Component like the hero that hosts it.
 */
export function HeroGlobe(): JSX.Element {
  return (
    <Image
      src="/images/hero-globe-night.png"
      alt=""
      aria-hidden="true"
      width={1600}
      height={1600}
      priority
      sizes="(min-width: 1024px) 720px, 60vw"
      className="h-full w-full select-none object-contain"
    />
  );
}
