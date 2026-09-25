/**
 * ════════════════════════════════════════════════════════════════════════════
 * HERO GLOBE — DECORATIVE ASSET RENDERER  (BUILD TOOL, NEVER SHIPPED)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * DESKTOP FIDELITY CORRECTION R2 §2 authorises this:
 *
 *   "If procedural SVG cannot produce this convincingly, do not keep forcing
 *    it. Create/export a dedicated decorative Hero globe asset from the design
 *    lane and use it as a presentation asset."
 *
 * It could not, and this is that export. The previous SVG globe obeyed a rule
 * the ruling has now lifted — that every square degree of land be lit
 * identically — and a uniform texture is exactly why it read as flat. The
 * ruling replaces it: decorative lighting MAY be spatially non-uniform,
 * provided it is decorative, aria-hidden, not clickable, not animated as
 * alerts, not labelled by a legend, not tied to current news, and carries no
 * discrete pulsating incident dots.
 *
 * ── WHAT THE LIGHT ACTUALLY IS ──────────────────────────────────────────
 *
 * City glow at the positions of roughly 140 of the world's largest urban
 * areas, which is a geographic fact about where people live and has nothing
 * to do with what happened today. Each is a soft bloom, not a crisp mark, of a
 * radius set by a coarse size tier — so Europe, India, East Asia and the US
 * seaboards read bright and the Sahara, Siberia and the oceans read dark,
 * exactly as a night Earth does.
 *
 * It cannot be read as reporting, and the reasons are structural rather than
 * stylistic: the asset is a FLAT IMAGE baked at build time, so it is identical
 * on every load and cannot vary with the feed; nothing on the page reads it;
 * it carries no legend, no label and no interaction; and it is drawn with soft
 * falloff at fixed positions that never change.
 *
 * ── RUN ─────────────────────────────────────────────────────────────────
 *     node scripts/hero-globe/render-hero-globe.mjs
 *   Writes frontend/public/images/hero-globe-night.png
 *
 * This file is a BUILD TOOL. It is not imported by the application, is not in
 * the Next bundle, and runs only when the asset is regenerated.
 */
