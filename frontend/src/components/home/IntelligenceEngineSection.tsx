import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { IntelligenceEngineRing } from '@/components/home/IntelligenceEngineRing';

interface IntelligenceEngineSectionProps {
  language?: LanguageCode;
}

/**
 * M66.5 — GN-CD-130 → GN-CD-156, the Intelligence Engine section canvas.
 *
 * WHAT CHANGED FROM M65.1. The section used to be a full-bleed
 * `border-b border-border bg-void` band wrapping a `max-w-[1800px]`
 * inner container that wrapped a second, rounded panel. That is three
 * nested boxes where the design authors one, and the extra
 * `px-4 sm:px-6 lg:px-8` inset cost the panel 64px of the 1388px content
 * box PageCanvas already gives it. GN-CD-130 authors exactly one bounded
 * panel; that is what this file now renders, and the M66.1 §D5 leftover
 * is retired with it.
 *
 * LAYER ORDER IS DOM ORDER. GN-CD-151 records that this family declares
 * NO `z-index` anywhere; stacking is pure source order. Z00 section base
 * and radial → Z01 grid → Z02 HUD construction SVG → Z03 heading → and
 * everything from Z04 up inside the ring. Introducing explicit indices
 * here would be a silent departure, so none is introduced.
 *
 * `overflow:hidden` IS LOAD-BEARING (GN-CD-151): the HUD's r430 and r560
 * rings (desktop) and r250 (mobile) are cropped by the panel edge on
 * purpose. GN-CD-134 calls that crop "the larger invisible network" read
 * and requires it preserved.
 *
 * RESPONSIVE — CTO decision D-3 C. The engine has three bands:
 *   • `< md` (768px)          released MOBILE composition
 *   • `md … cd-engine`        the retained accessible stacked composition
 *   • `≥ cd-engine` (1340px)  released DESKTOP composition
 * The SECTION CANVAS itself has only the two authored treatments, gated
 * at `md`: below it the released mobile canvas, at and above it the
 * released desktop canvas — whose radial is sized to its own box and so
 * reads correctly across the whole intermediate band, where the mobile
 * canvas's fixed `300px 240px` ellipse would not. The third band exists
 * in the RING, which is where GN-CD-153 / UNRESOLVED-001 actually bites.
 * Nothing is scaled: `transform:scale()` on the desktop canvas is
 * prohibited by GN-CD-154 and NON-NEGOTIABLE #13.
 *
 * SERVER COMPONENT. Everything here is static — canvas, grid, HUD,
 * heading. Only the ring, which owns hover/focus emphasis and the
 * reduced-motion subscription, is a client boundary. That is the same
 * narrow-boundary discipline every previous engine milestone kept.
 *
 * `id="intelligence-modules"` stays here: MobileBottomNav's
 * "Intelligence" tab links to it, and GN-CD-130 confirms the mobile
 * canvas is a scroll target, "not a route".
 *
 * ACCESSIBLE NAMING. GN-CD-135 authors the eyebrow as a plain styled
 * div. It is a real `<h2>` here, because the section needs a semantic
 * heading and because CTO decision D-8 B/D-8a makes the hub's own core
 * title decorative and relies on this heading for the accessible name.
 * Every decorative layer below is `aria-hidden` per GN-CD §N.1.
 */
export function IntelligenceEngineSection({ language = 'en' }: IntelligenceEngineSectionProps): JSX.Element {
  const t = getDictionary(language).intelligenceModules;

  /*
    G-001 — the only change this milestone makes to this file, and it is
    VISUALLY INERT.

    `id="intelligence-modules"` is a real fragment target: MobileBottomNav's
    "Intelligence" tab ships `href: '#intelligence-modules'`. NavBar is
    `sticky top-0 z-50`, so without a scroll margin that tab lands this
    section's top edge underneath the header.

    `scroll-margin-top` participates in no layout, paint or stacking pass —
    the browser reads it only while performing a scroll-into-view. Every
    released value on this element is untouched: the radius, the border, both
    background fields, all six padding tokens and `overflow-hidden`
    (GN-CD-151's load-bearing HUD crop) are exactly as approved. Touching this
    file was authorized for this one property.

    `cd-header` mirrors the breakpoint the header itself switches on, so the
    offset stays correct by construction. GlobalDevelopments.tsx carries the
    full G-001 note and the measurement.
  */
  return (
    <section
      id="intelligence-modules"
      aria-labelledby="intelligence-engine-heading"
      className="relative scroll-mt-[65px] overflow-hidden rounded-cd-16 border border-cd-edge-section bg-cd-engine-m px-cd-11 pb-cd-14 pt-cd-13 md:bg-cd-engine md:px-cd-24 md:pb-cd-30 md:pt-cd-26 cd-header:scroll-mt-[75px]"
    >
      {/*
        Z01 — GN-CD-132, the engine's single grid layer. GN-CD-133 records
        that the minor grid is deliberately ABSENT from this family, so one
        layer is the correct count, not an omission.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cd-grid-engine bg-cd-grid-30 md:bg-cd-grid-38"
      />

      {/*
        Z02 — GN-CD-134, the HUD construction geometry, verbatim.

        Mobile is a RECOMPOSITION, not a scale: three rings instead of
        four, four radial lines instead of eight, one sweep at a different
        dash ratio. GN-CD-134 requires it never be replaced by a scaled
        desktop layer, so the two are separate SVGs gated at `md`.

        `preserveAspectRatio="xMidYMid slice"` plus the section's
        `overflow:hidden` is what crops the outer rings. The `translate`
        offsets align the HUD's notional centre with the canvas hub once
        the heading block is accounted for.

        The sweep arc uses the released `animate-cd-hud-sweep-engine`
        tokens (M66.1: `cd-spin 120s` / `110s`) rather than an inline
        `animation`, so `globals.css`'s universal reduced-motion rule
        reaches it and it simply rests at its start position — GN-CD-155's
        required behaviour, with no layout shift.
      */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 330 400"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden md:hidden"
      >
        <g fill="none" stroke="rgba(56,189,248,.07)" transform="translate(10,52)">
          <circle cx="155" cy="174" r="110" />
          <circle cx="155" cy="174" r="170" strokeDasharray="2 10" />
          <circle cx="155" cy="174" r="250" stroke="rgba(56,189,248,.04)" />
          <g stroke="rgba(56,189,248,.05)">
            <path d="M155 174 L -30 174" />
            <path d="M155 174 L 340 174" />
            <path d="M155 174 L 155 -40" />
            <path d="M155 174 L 155 400" />
          </g>
          <g stroke="rgba(34,211,238,.15)">
            <path d="M45 168 v12" />
            <path d="M265 168 v12" />
            <path d="M149 64 h12" />
            <path d="M149 284 h12" />
          </g>
          <circle
            cx="155"
            cy="174"
            r="170"
            stroke="rgba(34,211,238,.13)"
            strokeDasharray="60 1010"
            className="animate-cd-hud-sweep-engine-m"
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        </g>
      </svg>

      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 1240 600"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-hidden md:block"
      >
        <g fill="none" stroke="rgba(56,189,248,.07)" transform="translate(0,42)">
          <circle cx="620" cy="250" r="200" />
          <circle cx="620" cy="250" r="300" strokeDasharray="2 10" />
          <circle cx="620" cy="250" r="430" stroke="rgba(56,189,248,.05)" />
          <circle cx="620" cy="250" r="560" stroke="rgba(56,189,248,.04)" strokeDasharray="4 14" />
          <g stroke="rgba(56,189,248,.05)">
            <path d="M620 250 L 20 250" />
            <path d="M620 250 L 1220 250" />
            <path d="M620 250 L 620 -40" />
            <path d="M620 250 L 620 560" />
            <path d="M620 250 L 140 -30" />
            <path d="M620 250 L 1100 -30" />
            <path d="M620 250 L 140 530" />
            <path d="M620 250 L 1100 530" />
          </g>
          <g stroke="rgba(34,211,238,.16)">
            <path d="M420 244 v12" />
            <path d="M820 244 v12" />
            <path d="M614 50 h12" />
            <path d="M614 450 h12" />
          </g>
          <circle
            cx="620"
            cy="250"
            r="300"
            stroke="rgba(34,211,238,.14)"
            strokeDasharray="90 1790"
            className="animate-cd-hud-sweep-engine"
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        </g>
      </svg>

      {/* Z03 — GN-CD-135/136, the heading block. Centred at both viewports. */}
      <div className="relative text-center">
        <h2
          id="intelligence-engine-heading"
          className="font-cd-mono uppercase text-cd-mono-eyebrow-m text-cd-accent-blue md:text-cd-mono-eyebrow"
        >
          {t.hubLabel}
        </h2>
        <p className="mt-cd-4 font-cd-body text-cd-engine-sub-m text-cd-ink-tertiary md:mt-cd-7 md:text-cd-engine-sub">
          {t.canvasSubtitle}
        </p>
      </div>

      {/* Z04 and above — GN-CD-145 → GN-CD-148, the engine itself. */}
      <IntelligenceEngineRing language={language} />
    </section>
  );
}
