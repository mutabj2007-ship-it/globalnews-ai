import type { LanguageCode } from '@globalnews-ai/shared';
import { processSteps } from '@/lib/homeContent';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { hudCornerBracketClassName } from '@/components/home/hudPanelGeometry';

interface HowItWorksProps {
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

/**
 * Milestone #48 — step titles/descriptions are GlobalNews AI editorial
 * copy (Category B), now sourced from the dictionary's parallel
 * `howItWorks.steps` array instead of homeContent.ts's `processSteps`
 * strings. `processSteps` still supplies the step NUMBER and ICON
 * (language-independent, unchanged) via array index alignment — the
 * dictionary array and homeContent.ts's array are kept the same length
 * and order by construction.
 *
 * ── M66.8d — HOW IT WORKS DESKTOP REFINEMENT (GN-CD-HIW-001 → 006) ────────
 *
 * THIS COMPONENT NOW CARRIES TWO INDEPENDENTLY AUTHORED COMPOSITIONS, and
 * that is a requirement rather than a convenience. GN-CD-HIW releases DESKTOP
 * ONLY — its own responsive contract, statement B, is that "mobile and tablet
 * remain unresolved and must return to Claude Design for a separate approved
 * specification" — and CTO decision D-4 requires the CURRENT presentation to
 * remain in place, unchanged, below the desktop threshold. So the existing
 * markup is retained verbatim and gated, and the released band is added
 * beside it. This is the pattern M66.3 already established for the Hero,
 * where the console and the mobile card are two authored compositions in one
 * file rather than one scaled into the other.
 *
 *   < cd-header (1400px)   the legacy composition, byte-for-byte as before
 *   >= cd-header           the released GN-CD-HIW band
 *
 * THE THRESHOLD IS `cd-header`, AND IT IS NOT ARBITRARY. GN-CD-HIW-002
 * activates the band "wherever the home wrapper's `min-width:1360px` desktop
 * layout is already in force" — but this repository has no such minimum. M66.1
 * CTO decision D4 refused it (reproducing it fails WCAG 2.1 SC 1.4.10 Reflow
 * and breaks every viewport under 1360px) and `claudeDesignFoundation.spec.ts`
 * permanently locks its absence. So the design's stated threshold does not
 * exist here and had to be resolved to a real one.
 *
 * The choice is decided by the connector, not by taste. Each rail segment sits
 * at `right:-44px; width:52px`, so its left edge is 8px inside its column's
 * right edge, while the body box is `min(400, W)` wide. Clearance is therefore
 * `(W - 8) - min(400, W)`, which is a flat -8px for every column narrower than
 * 400px and only turns positive once `W > 408`, i.e. above a 1404px viewport.
 * Of the thresholds that already exist — lg 1024, cd-hero 1240, xl 1280,
 * cd-engine 1340, cd-header 1400 — cd-header is the only one close enough to
 * be honest, and CTO decision D-b approved it. At 1440 the clearance is +12px;
 * between 1400 and 1407 the segment overlaps the last ~1.3px of an EMPTY body
 * box edge, with no glyph collision. Recorded, not hidden.
 *
 * ONE DELIBERATE DIVERGENCE FROM [DESIGN-EXACT], CTO decision D-a. GN-CD-HIW-003
 * releases the step number as `#5b7fa6` at 9.5px. Measured against the real
 * six-layer composite behind it — void, the two page radials, the 56px page
 * grid, this band's radial and its 132px rules — that is 3.91:1, and 9.5px is
 * not large-scale text, so WCAG 2.1 SC 1.4.3 AA requires 4.5:1. It fails. The
 * step number is the accessible mechanism for step ORDER (GN-CD-HIW-005:
 * "step order is carried by the STEP 01/02/03 text"), so it cannot be
 * sub-threshold. `ink.core-sub` #5b9fd0 — an EXISTING released token, not an
 * invented colour — measures 5.69:1 and ships instead. Reported to Claude
 * Design under UNRESOLVED-011.
 *
 * NO MOTION IS ADDED. The released band has none, and none is invented. The
 * legacy composition below the threshold keeps its existing pulse and its
 * existing `prefers-reduced-motion` handling, exactly as D-4 requires.
 *
 * NOTHING HERE IS INTERACTIVE. No handler, href, role, tabIndex, cursor,
 * hover or focus state exists in the band. Every decorative element — the
 * brackets, the radial, the rule field, the icon glyphs and the whole rail
 * overlay — is `aria-hidden`.
 */
export function HowItWorks({ language = 'en' }: HowItWorksProps): JSX.Element {
  const t = getDictionary(language).howItWorks;

  return (
    <section
      /*
        GN-CD-HIW-006 — the Trust gap. The page rhythm is PageCanvas's
        `lg:gap-cd-18`; the released design wants 14px here and 18px
        everywhere else. `cd-header:mb-[-4px]` is that single local exception,
        owned by this section rather than by Trust.

        Two reasons it lives here. `trustGeometry.spec.ts` asserts Trust's
        `lg:mt-0`, so a negative top margin there would break a protected M66.6
        contract and cost a seventh file. And an exception owned by the section
        that introduced it disappears with that section, rather than leaving
        Trust silently pulling up against whatever happens to precede it.
        PageCanvas's global 18px rhythm is untouched.
      */
      className="relative border-b border-border bg-surface/40 cd-header:mb-[-4px] cd-header:border-0 cd-header:bg-transparent"
      aria-labelledby="how-it-works-heading"
    >
      {/*
        ══ LEGACY COMPOSITION — RETAINED VERBATIM, DESKTOP-HIDDEN ═══════════
        Everything from here to the end of this block is the pre-M66.8d
        presentation, unchanged except for the `cd-header:hidden` gate. CTO
        decision D-4 requires it below the desktop threshold, and no mobile or
        tablet specification exists to replace it.
      */}
      <span aria-hidden="true" className={`${hudCornerBracketClassName('top-left')} cd-header:hidden`} />
      <span aria-hidden="true" className={`${hudCornerBracketClassName('top-right')} cd-header:hidden`} />
      <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 cd-header:hidden">
        <div className="mb-4 flex flex-col gap-1.5 sm:mb-5">
          <span className="font-mono text-xs uppercase tracking-widest text-cyan-400">
            {t.label}
          </span>
          <h2
            id="how-it-works-heading"
            className="font-display text-xl font-medium tracking-tight text-ink-primary sm:text-2xl"
          >
            {t.headline}
          </h2>
        </div>

        <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-5">
          {/* Signal-flow connector — a continuous cyan rail with an explicit pulsing "signal" marker at each midpoint between steps, not just a plain line. */}
          <div className="pointer-events-none absolute left-0 right-0 top-5 hidden sm:block" aria-hidden="true">
            <style>{`
              @keyframes gna-flow-pulse { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.3); } }
              .gna-flow-node { animation: gna-flow-pulse 2.4s ease-in-out infinite; }
              @media (prefers-reduced-motion: reduce) { .gna-flow-node { animation: none !important; opacity: 0.7 !important; transform: none !important; } }
            `}</style>
            <div className="h-0.5 bg-gradient-to-r from-cyan-500/10 via-cyan-500/60 to-cyan-500/10" />
            <div className="absolute inset-0 flex items-center justify-around px-[16.6%]">
              {[0, 1].map((i) => (
                <span
                  key={i}
                  className="gna-flow-node h-1.5 w-1.5 rotate-45 bg-cyan-400"
                  style={{ animationDelay: `${i * 0.8}s` }}
                />
              ))}
            </div>
          </div>

          {processSteps.map((item, index) => {
            const Icon = item.icon;
            const localized = t.steps[index];
            return (
              <div key={item.step} className="relative flex flex-col items-start gap-3">
                <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/40 bg-void text-cyan-300 shadow-[0_0_20px_-6px_rgba(34,211,238,0.4)]">
                  <Icon size={17} strokeWidth={2} />
                </div>
                <div>
                  <div className="mb-1 font-mono text-xs text-ink-tertiary">{item.step}</div>
                  <h3 className="mb-1.5 font-display text-base font-medium text-ink-primary">
                    {localized?.title ?? item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-ink-secondary">
                    {localized?.description ?? item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/*
        ══ GN-CD-HIW BAND — THE RELEASED DESKTOP COMPOSITION ════════════════
        GN-CD-HIW-002: padding 20/26/24, radius 16, NO border, no min-height,
        overflow hidden. The band adds no opaque fill, so the page canvas's
        56px grid stays visible through it (GN-CD-HIW-005).
      */}
      <div className="relative hidden overflow-hidden rounded-cd-16 bg-cd-hiw pb-cd-24 pl-cd-26 pr-cd-26 pt-cd-20 cd-header:block">
        {/* GN-CD-HIW-005 — the 132px vertical rule field. Widest and quietest on the page: Trending 88, Trust 110, here 132. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cd-field-hiw" />

        {/*
          GN-CD-HIW-002 — four 16x16 corner brackets, flush at the band's
          corners, each drawn as two 1px borders. The top pair is deliberately
          brighter than the bottom pair (.55 against .25): the band opens
          strongly and closes quietly. There is no panel border.
        */}
        <span aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-[16px] w-[16px] border-l border-t border-cd-edge-hiw-55" />
        <span aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-[16px] w-[16px] border-r border-t border-cd-edge-hiw-55" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-[16px] w-[16px] border-b border-l border-cd-edge-hiw-25" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-[16px] w-[16px] border-b border-r border-cd-edge-hiw-25" />

        {/*
          GN-CD-HIW-002 — the heading row. Label and title share ONE baseline;
          the design calls this "the single largest space saving and must not
          be re-stacked". The mono label carries flex:none so it never shrinks.

          CTO decision D-2: the title is a real <h2>. The design file renders a
          <div>, which GN-CD-HIW-005 itself records as "a prototype limitation,
          not a design instruction". The eyebrow stays a <span> — it is a
          label, not a heading level.

          CTO decision D-f: the eyebrow keeps the repository's existing CSS
          `uppercase` mechanism rather than rewriting the stored EN/PL strings.
          The rendered result is identical and no translation is touched.
        */}
        <div className="relative flex items-baseline gap-cd-18">
          <span className="shrink-0 font-cd-mono uppercase text-cd-mono-section text-cd-ink-label">
            {t.label}
          </span>
          <h2 id="how-it-works-heading-cd" className="font-cd-display text-cd-hiw-title text-cd-ink-primary">
            {t.headline}
          </h2>
        </div>

        {/* GN-CD-HIW-002 — three equal columns, gap 38, 20px below the heading row. */}
        <div className="relative mt-cd-20">
          {/*
            GN-CD-HIW-004 — THE CONNECTOR RAIL. Two segments, never one.
            A single full-width rail was rejected during review because, once
            the step number and title moved beside the icon, it struck through
            the title text.

            The overlay MIRRORS the steps grid — same three tracks, same 38px
            gap — so each segment lands in an inter-column gap and tracks the
            columns at any container width. Cell 3 is deliberately empty: there
            is no trailing segment after step 03.

            Rail Y = tile top + 20 = the tile's vertical centre, which is why
            the tiles are border-box (GN-CD-HIW's one resolved contradiction:
            40px + 1px border would render 41.6px and put the centre 0.8px off
            the rail).

            NO z-index is declared here or on the steps grid, and the two are
            not reordered: DOM order puts the overlay beneath, and the tiles'
            opaque radial background occludes the arrowheads that reach them.
          */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 top-cd-20 grid grid-cols-3 gap-cd-38"
          >
            {[0, 1].map((cell) => (
              <div key={cell} className="relative h-px">
                <span
                  className={`absolute right-[-44px] top-0 h-px w-[52px] ${cell === 0 ? 'bg-cd-rail-1' : 'bg-cd-rail-2'}`}
                />
                <span
                  className={`absolute right-[-46px] top-[-3.5px] h-0 w-0 border-y-[3.5px] border-l-[6px] border-y-transparent ${
                    cell === 0 ? 'border-l-cd-edge-hiw-55' : 'border-l-cd-edge-hiw-sky-48'
                  }`}
                />
              </div>
            ))}
            <div />
          </div>

          <div className="relative grid grid-cols-3 gap-cd-38">
            {processSteps.map((item, index) => {
              const localized = t.steps[index];
              return (
                <div key={item.step}>
                  {/* GN-CD-HIW-002 — the cluster: icon and text on one band, centred, gap 13. */}
                  <div className="flex items-center gap-cd-13">
                    {/*
                      GN-CD-HIW-004 — the icon tile. 40x40 OUTER box via
                      border-box, radius 11, its own cyan border and inset
                      glow. Deliberately NOT unified with the Trust tile: the
                      released system keeps the two treatments distinct.
                    */}
                    <span
                      aria-hidden="true"
                      className="grid h-[40px] w-[40px] shrink-0 box-border place-items-center rounded-cd-11 border border-cd-edge-hiw-40 bg-cd-tile-hiw shadow-cd-tile-hiw-glow"
                    >
                      {/*
                        GN-CD-HIW-004 — the exact released glyphs, inline. Not
                        rasterised, and not substituted with an icon-library
                        equivalent. Decorative: the step title carries the
                        meaning.
                      */}
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="#7dd3fc"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        focusable="false"
                      >
                        {index === 0 && (
                          <>
                            <circle cx="11" cy="11" r="6.2" />
                            <path d="M15.6 15.6 L19.4 19.4" />
                          </>
                        )}
                        {index === 1 && (
                          <>
                            <path d="M12 4.4 20 8.6 12 12.8 4 8.6 Z" />
                            <path d="M4 12.6 12 16.8 20 12.6" />
                            <path d="M4 16.4 12 20.6 20 16.4" />
                          </>
                        )}
                        {index === 2 && (
                          <>
                            <path d="M12 7.2c-2-1.5-4.2-1.9-6.6-1.7v11c2.4-.2 4.6.2 6.6 1.7 2-1.5 4.2-1.9 6.6-1.7v-11c-2.4-.2-4.6.2-6.6 1.7Z" />
                            <path d="M12 7.2v10.9" />
                          </>
                        )}
                      </svg>
                    </span>

                    {/* min-w-0 so a long title ellipsises rather than overflowing the grid track. */}
                    <div className="min-w-0">
                      {/*
                        GN-CD-HIW-005 / CTO decision D-1 option A — `STEP 01`,
                        localized. `stepPrefix` is the one new dictionary key;
                        the numerals come from the EXISTING processSteps data
                        and are language-independent.

                        The colour is `ink.core-sub`, not the released
                        `ink.meta` — see the D-a divergence in this file's
                        header.
                      */}
                      <span className="block font-cd-mono uppercase text-cd-mono-step text-cd-ink-core-sub">
                        {t.stepPrefix} {item.step}
                      </span>
                      <h3 className="mt-cd-3 font-cd-display text-cd-hiw-step-title text-cd-ink-primary">
                        {localized?.title ?? item.title}
                      </h3>
                    </div>
                  </div>

                  {/*
                    GN-CD-HIW-002 — the body. `max-width:400px` is load-bearing
                    twice over: it forces all three descriptions to two lines,
                    and it is what keeps the rail segments clear of text.
                  */}
                  <p className="mt-cd-11 max-w-[400px] text-pretty font-cd-body text-[12.5px] leading-[1.55] text-cd-ink-secondary">
                    {localized?.description ?? item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
