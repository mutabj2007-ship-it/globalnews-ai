import type { LanguageCode } from '@globalnews-ai/shared';
import { trustItems } from '@/lib/homeContent';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface TrustSectionProps {
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

/**
 * M66.6 — GN-CD-180 → GN-CD-185, "Built on Trust".
 *
 * WHAT CHANGED. The section used to be a full-bleed `border-b border-border
 * bg-void` band wrapping a `max-w-[1480px]` container wrapping an
 * angle-clipped HUD panel — three nested boxes where the design authors one,
 * plus a `clip-path` silhouette and corner brackets that predate Claude
 * Design. GN-CD-180 authors a single bounded panel with a 16px radius, and
 * that is what this file now renders. The M66.1 §D5 leftover retires with it.
 *
 * THE TWO VIEWPORTS INVERT THE CONTAINER RELATIONSHIP, deliberately.
 * Desktop is one bordered panel holding five BORDERLESS columns separated by
 * hairlines. Mobile has NO panel at all and five BORDERED, filled cards. That
 * is authored (GN-CD §D "Structural divergence"), not an accident of
 * responsive CSS, so the container styling here is `lg:`-gated rather than
 * scaled.
 *
 * CTO DECISION D-4 A — one gate, at `lg` (1024px). Measured through the real
 * PageCanvas boundary, the desktop five-column text track is 179.4px at 1440,
 * 147.4px at 1280, but only 96.2px at 1024 and 49.8px at 768 — narrower at 768
 * than the mobile card's own 99.5px column. GN-CD §B declines to author a
 * tablet composition (UNRESOLVED-001, "no composition"), so none is invented:
 * above the gate the released 5-column desktop composition, below it the
 * released 2-column mobile composition, and nothing in between.
 *
 * CTO DECISION D-2 A — THE COPY IS THE REPOSITORY'S, NOT THE DESIGN'S.
 * GN-CD-180's own claim audit flags four of its five card bodies as
 * misleading-claim risks — "All sources linked. Nothing hidden.", "One
 * complete picture.", "Always separated.", and above all "Real-time
 * monitoring. Always fresh.", which it calls the highest-risk claim in the
 * family, contradicted by three known gaps and which "would display unchanged
 * while offline". The shipping copy in `trustSection.items` says what the
 * product actually does, in both languages, and it stays. This file applies
 * the released PRESENTATION to that copy. No dictionary was modified.
 *
 * CTO DECISION D-3 A — the `<h2>` stays. GN-CD-180 authors no headline and
 * renders its section label as a plain `<div>` (DEFECT-009). Keeping the real
 * heading is a deliberate divergence from the released composition: it
 * preserves the document outline, gives `aria-labelledby` a target, and means
 * this family does not reproduce a defect the design itself logs.
 *
 * CTO DECISION D-5 A — all five cards are NON-INTERACTIVE. The released cards
 * are `role="link"` with `tabIndex="0"`, but their `to` values are prototype
 * screen keys, not routes: of the five intents, two would land on `/search`
 * only by stretch, two ("AI ANALYSIS METHODOLOGY", "LIVE INTELLIGENCE") have
 * no page in this repository at all, and the fifth is `null` by design. No
 * route is invented and `/search` is not repurposed for visual fidelity, so
 * nothing here is focusable or clickable. The consequence is that the released
 * hover, focus and pressed treatments are NOT implemented either — a hover
 * glow on an element that cannot be activated is the same lie as a fabricated
 * destination. GN-CD-184's state block returns with interactivity, not before.
 * This also means DEFECT-018 cannot arise here.
 *
 * DEFECT-019 IS REPRODUCED ON PURPOSE (CTO decision D-9): the `border-right`
 * hairline is applied to all five desktop cards, so the fifth sits inside the
 * panel's right padding with nothing after it. GN-CD's acceptance contract is
 * explicit that this is "a reported finding, not licence to remove it".
 *
 * ZERO MOTION. GN-CD's acceptance contract: "presence of any animation is a
 * failure." The family has no keyframes, no animation and — given D-5 A — not
 * even the released `.18s` hover transition, because there is no hover to
 * ease. Nothing in this section moves under any condition.
 *
 * NO DATA. This is the simplest surface on the homepage: five static records,
 * no fetch, no API client, no state, no timer, no numeric value of any kind.
 * GN-CD's own inventory counts zero numbers in the family — unlike every other
 * home section, there is nothing here that looks production-real but is
 * hardcoded.
 */

/**
 * GN-CD-185 — the released two-letter identity glyphs (CTO decision D-4 A),
 * replacing the lucide `ShieldCheck` / `Scale` / `Sparkles` / `RadioTower` /
 * `GraduationCap` icons this section used to render.
 *
 * This is a TRUTHFULNESS improvement as much as a visual one. GN-CD-185 makes
 * the point that abstract letters are "safely non-committal — no shield
 * (security), no checkmark (verification), no globe (coverage), no lock
 * (privacy). Nothing visual over-claims." The retired `ShieldCheck` was
 * precisely a verification mark, sitting on the one card whose claim the
 * product cannot yet substantiate.
 *
 * They are decorative and `aria-hidden` (fixing GN-CD's DEFECT-016, where a
 * screen reader announces "T R" before every card title). They are English
 * initialisms with no localisation path — GN-CD's MLR-04 — which is a visual
 * exposure only, precisely because they are hidden from assistive technology.
 *
 * Index-aligned with `trustItems` and `trustSection.items`, the same alignment
 * contract those two arrays already hold; `dictionaries/index.spec.ts` locks
 * both at five entries in both languages.
 */
const TRUST_GLYPHS = ['TR', 'MV', 'AI', 'LV', 'ED'] as const;

export function TrustSection({ language = 'en' }: TrustSectionProps): JSX.Element {
  const t = getDictionary(language).trustSection;

  return (
    <section
      aria-labelledby="trust-heading"
      className="relative mt-cd-14 lg:mt-0 lg:overflow-hidden lg:rounded-cd-16 lg:border lg:border-cd-edge-section lg:bg-cd-trust lg:px-cd-20 lg:pb-cd-22 lg:pt-cd-18"
    >
      {/*
        GN-CD-181 — the decorative field: a corner bloom sitting below the
        panel's lower-left corner so only its upper edge shows, over vertical
        rules every 110px. Desktop only; mobile has no decorative field.

        The 110px rhythm is this section's own: Hero 44px two-axis, Engine 38px
        two-axis, Trending 88px vertical, Trust 110px vertical — the widest on
        the page, and therefore the quietest. Z01, and decorative only.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden bg-cd-field-trust lg:block"
      />

      {/* Z02 — GN-CD-182 section label, plus the retained semantic heading (D-3 A). */}
      <div className="relative mb-cd-10 lg:mb-cd-16">
        <div className="font-cd-mono uppercase text-cd-mono-section-m text-cd-ink-label lg:text-cd-mono-section">
          {t.label}
        </div>
        {/*
          M66.8d — GN-CD-HIW-006. The ONLY change this milestone makes to Trust:
          the sub-heading moves from 13px to 14px at weight 600, with margin-top
          5px. Nothing else in this section is touched — border, radius,
          gradient, padding, rule field, corner bloom, grid, hairlines, tiles,
          card copy, icons, order and interactivity are all unchanged.

          `cd-trust-subhead` is a NEW token rather than a reuse. Two existing
          candidates were rejected on inspection: `cd-card-head` is 13px and is
          shared with TrendingCard, which locks its exact tuple; and
          `cd-preview-head-m` is a byte-exact ['14px', { fontWeight: '600' }]
          but carries no lineHeight, so adopting it would silently drop this
          heading's 1.32 and change its box height. GN-CD-HIW-006 specifies
          14px / 600 / margin-top 5px and is silent on line-height, so 1.32 is
          preserved deliberately.

          The 14px GAP above this panel is NOT set here — it is owned by
          HowItWorks (`cd-header:mb-[-4px]`), so this section's `lg:mt-0`
          contract is untouched.
        */}
        <h2
          id="trust-heading"
          className="mt-cd-5 font-cd-display text-cd-trust-subhead text-cd-ink-primary"
        >
          {t.headline}
        </h2>
      </div>

      {/*
        Z03 — GN-CD-183 grid. Five equal columns at `gap:16px` on desktop; two
        columns at `gap:9px` on mobile with the fifth card spanning both.

        `role="list"` / `role="listitem"` are explicit because `display:grid`
        strips list semantics from `<ul>`/`<li>` in some browsers. GN-CD's
        DEFECT-021 records that the released cards are "five sibling links with
        no `role="list"`, no group, and no programmatic association with the
        BUILT ON TRUST label"; the design calls the grouping an implementation
        requirement rather than a design change, so it is done here, and the
        section's `aria-labelledby` supplies the association.
      */}
      <ul
        role="list"
        className="relative grid grid-cols-2 gap-cd-9 lg:grid-cols-5 lg:gap-cd-16"
      >
        {trustItems.map((item, index) => {
          const localized = t.items[index];
          return (
            <li
              key={item.title}
              role="listitem"
              className={[
                // GN-CD-184-MA / MB — mobile: a bordered, filled, rounded card.
                'flex min-h-[64px] min-w-0 gap-cd-10 rounded-cd-12 border border-cd-edge-card bg-cd-fill-trust-card px-cd-12 py-cd-11',
                // GN-CD-184-DA — desktop: a borderless column with a right hairline.
                // The padding/negative-margin pair is reproduced exactly: it nets to
                // zero visually and is the released hit-area technique, kept intact so
                // a later interactivity milestone does not have to rediscover it.
                'lg:-my-cd-6 lg:-ml-cd-8 lg:min-h-0 lg:items-start lg:gap-cd-13 lg:rounded-cd-10 lg:border-0 lg:border-r lg:border-r-cd-edge-divider-10 lg:bg-transparent lg:py-cd-6 lg:pl-cd-8 lg:pr-cd-16',
                // GN-CD-183 — the fifth card spans both mobile columns; on desktop it
                // is an ordinary column.
                index === TRUST_GLYPHS.length - 1 ? 'col-span-2 lg:col-span-1' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {/*
                GN-CD-185 — icon tile. Desktop 40/11 with the inset glow and a
                ring at 5px; mobile 30/9 with the ring at 4px and NO glow
                (ERRATUM-008: "not a scaled copy — it drops the inset glow
                entirely"). Entirely decorative, so the whole tile is hidden
                from assistive technology.
              */}
              <span
                aria-hidden="true"
                className="relative grid h-[30px] w-[30px] shrink-0 place-items-center rounded-cd-9 border border-cd-edge-tile-m bg-cd-tile-trust lg:h-[40px] lg:w-[40px] lg:rounded-cd-11 lg:border-cd-edge-tile lg:shadow-cd-tile-glow"
              >
                <span className="absolute inset-[4px] rounded-full border border-cd-hud-cyan-16 lg:inset-[5px]" />
                <span className="relative font-cd-mono text-cd-mono-glyph-m text-cd-ink-label lg:text-cd-mono-glyph">
                  {TRUST_GLYPHS[index]}
                </span>
              </span>

              <span className="flex min-w-0 flex-col">
                {/*
                  `lg:leading-[normal]` is load-bearing, not decoration.
                  ERRATUM-007 releases `line-height:1.4` as part of the MOBILE
                  title role, and GN-CD-301 authors no line-height for the
                  desktop one. A Tailwind fontSize tuple with no `lineHeight`
                  emits no line-height declaration, so `lg:text-cd-mono-trust`
                  alone would leave the mobile 1.4 in force at desktop. This
                  restores the unauthored default explicitly.
                */}
                <span className="font-cd-mono uppercase text-cd-mono-trust-m text-cd-ink-trust-title lg:text-cd-mono-trust lg:leading-[normal]">
                  {localized?.title ?? item.title}
                </span>
                <span className="mt-cd-5 text-cd-trust-body-m text-cd-ink-tertiary lg:mt-0 lg:text-cd-trust-body">
                  {localized?.description ?? item.description}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
