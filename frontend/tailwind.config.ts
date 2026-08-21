import type { Config } from 'tailwindcss';

/**
 * M66.1 — CLAUDE DESIGN HOMEPAGE FOUNDATION.
 *
 * This file now carries TWO token systems side by side, deliberately:
 *
 *   1. The EXISTING GlobalNews AI system (`void`, `surface`, `border`,
 *      `signal`, `ink-*`, and the four original keyframes). Consumed by
 *      every route in the product, including six that have not been
 *      redesigned yet — /search, /map, /history, /workspace, /privacy and
 *      /terms. **Not one value in it is changed by M66.1.** `ink-tertiary`
 *      alone has 24 non-homepage consumers; `font-mono` has 27.
 *      Redefining any of them to obtain Claude Design fidelity on the
 *      homepage would silently restyle screens no one has designed.
 *
 *   2. The NEW `cd-*` Claude Design system, added below. Every name in it
 *      is new, so it has zero existing consumers and cannot change the
 *      appearance of anything that does not explicitly opt in.
 *
 * ADD, NEVER REDEFINE. That is the whole architecture of this milestone,
 * and `claudeDesignFoundation.spec.ts` asserts both halves of it: that
 * every `cd-*` value equals its released GN-CD value verbatim, and that
 * every pre-existing value is untouched.
 *
 * PROVENANCE. Every `cd-*` value below is quoted from the released
 * cross-cutting specification GN-CD-300 → GN-CD-307 (release 2026-08-18),
 * with its section cited. GN-CD-300 §V sets the acceptance contract:
 * exact match, no rounding of alpha. `.03`, `.035`, `.045` and `.05` are
 * four distinct grid tokens and are kept distinct here.
 *
 * NOT ADDED, and why:
 *   - The mobile device-frame values (GN-CD-300 §F.1 screen `#05070d`,
 *     bezel `#0a0e16`, notch `#000`) describe the prototype's phone
 *     mock-up chrome, not the product. GN-CD-006/007 are excluded from
 *     the design's own scope.
 *   - The 32 panel fills of GN-CD-300 §F.4. The specification lists each
 *     one *with the single element that uses it*, precisely so a fill is
 *     never applied to the wrong surface. Promoting them to global tokens
 *     would invite exactly that. They stay component-local.
 *   - The parametric `rgba({RGB},…)` forms (§F.5, §H, §K). Module and
 *     category identity is computed from a channel map, not tokenised.
 *   - `gnShimmer`, `gnRowNew` and `gnAmber`. GN-CD-304 §L.1 records all
 *     three as defined-but-unreferenced and says "retain or prune at
 *     implementation; they carry no visual obligation". Pruned, to avoid
 *     adding to the dead-token problem this repository already has.
 *   - `#fcd34d`. GN-CD-300 §W.4: it "does not exist and must not appear".
 *     The spec asserts its continued absence from the whole tree.
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        /**
         * F1.b — THE ADMIN PLATFORM SYSTEM (`adm-*`).
         *
         * A THIRD token namespace, added under the same rule this file
         * already states for `cd-*`: ADD, NEVER REDEFINE. Every name below
         * is new, so it has zero existing consumers and cannot change the
         * appearance of anything that does not explicitly opt in — not the
         * homepage, not /search, /map, /history, /workspace, /privacy or
         * /terms.
         *
         * WHY A THIRD SYSTEM RATHER THAN REUSING `cd-*`. The Admin Platform
         * is a different released surface from the public site: its base is
         * `#050b11` (not the homepage's `#04060c`), its field is a single
         * 1100x520 radial anchored at 18%/-12% (not the homepage's two-layer
         * composite), and it carries a 252px sidebar the public site has no
         * equivalent of. Values are transcribed verbatim from the approved
         * `Admin Platform.dc.html`; `adminVisualContract.spec.ts` asserts
         * each one and asserts that no `cd-*` or legacy value moved.
         */
        adm: {
          void: '#050b11',
          'rail-from': '#071219',
          'rail-to': '#050d13',
          topbar: 'rgba(6,15,21,.86)',
          card: '#08161e',
          'card-soft': 'rgba(8,22,30,.7)',

          edge: '#123040',
          'edge-soft': '#133441',
          'edge-input': '#143644',
          'edge-mute': '#112b38',

          ink: '#e8f4f8',
          'ink-2': '#cbe4ee',
          'ink-3': '#9fbccb',
          'ink-4': '#8fb0bf',
          'ink-mute': '#7fa0b0',
          'ink-dim': '#5f8595',
          'ink-faint': '#4f707f',
          'ink-ghost': '#3f6272',

          accent: '#2dd4e8',
          'accent-hi': '#8ceef8',
          'accent-wash': 'rgba(45,212,232,.13)',
          'accent-hover': 'rgba(45,212,232,.06)',

          val: '#e8f4f8',
          'val-mute': '#5f8595',
          'val-warn': '#e0b25e',
          'val-bad': '#f2938d',

          'chip-good-edge': '#1c4c40',
          'chip-good-bg': 'rgba(20,60,50,.42)',
          'chip-good-ink': '#7fe0bb',
          'chip-warn-edge': '#5a4620',
          'chip-warn-bg': 'rgba(58,44,16,.42)',
          'chip-warn-ink': '#e0b25e',
          'chip-bad-edge': '#6d3535',
          'chip-bad-bg': 'rgba(70,25,25,.4)',
          'chip-bad-ink': '#f2938d',
          'chip-info-edge': '#1d5666',
          'chip-info-bg': 'rgba(20,60,72,.42)',
          'chip-info-ink': '#6fdcef',
          'chip-violet-edge': '#3d3266',
          'chip-violet-bg': 'rgba(45,36,80,.45)',
          'chip-violet-ink': '#b9a2f0',
          'chip-mute-edge': '#1d3340',
          'chip-mute-bg': '#0a141a',
          'chip-mute-ink': '#7fa0b0',
        },

        // ── EXISTING SYSTEM — UNCHANGED. Do not repoint these. ──────────
        void: '#080b12',
        surface: {
          DEFAULT: '#0f1420',
          hover: '#141b2b',
          raised: '#161d2c',
        },
        border: {
          DEFAULT: '#1e2636',
          strong: '#2a3548',
        },
        signal: {
          DEFAULT: '#3d6fff',
          bright: '#6c93ff',
          dim: '#1e3a8a',
        },
        ice: '#a8c5ff',
        ink: {
          primary: '#edeff5',
          secondary: '#93a0b8',
          tertiary: '#5c6780',
        },

        // ── M66.1: CLAUDE DESIGN SYSTEM (additive) ──────────────────────
        cd: {
          /** GN-CD-300 §F.1 — page base. `body { background:#04060c }`. */
          void: '#04060c',

          /**
           * GN-CD-300 §I — the complete typography colour set, keyed by
           * the role the specification assigns each value. All 26.
           */
          ink: {
            primary: '#e8f1ff',
            summary: '#dce8f6',
            hamburger: '#dbeafe',
            'glyph-header': '#cfe3f5',
            keyfact: '#c3d4e6',
            caption: '#b6cee4',
            secondary: '#a7c0d8',
            'chip-active': '#a5f3fc',
            glyph: '#9fc6e8',
            tertiary: '#9fbdd8',
            control: '#9db8d2',
            'link-quiet': '#8fb4d6',
            'trust-title': '#8ab4ff',
            muted: '#7f9dbd',
            label: '#7dd3fc',
            'core-sub': '#5b9fd0',
            meta: '#5b7fa6',
            provenance: '#8b7fb5',
            live: '#6ee7b7',
            attention: '#fde68a',
            critical: '#fca5a5',
            'link-hover': '#67e8f9',
            link: '#22d3ee',
            wordmark: '#38bdf8',
            'on-submit': '#ffffff',
            signin: '#eaf6ff',
          },

          /** GN-CD-300 §J.1 — the cyan/blue accent ladder, all 10. */
          accent: {
            cyan: '#22d3ee',
            sky: '#38bdf8',
            'cyan-light': '#67e8f9',
            'sky-light': '#7dd3fc',
            'cyan-pale': '#a5f3fc',
            blue: '#60a5fa',
            'blue-soft': '#8ab4ff',
            'blue-strong': '#2563eb',
            'blue-deep': '#1d4ed8',
            teal: '#0e7490',
          },

          /**
           * GN-CD-300 §J.2 and GN-CD-307 §J — the four semantic bindings
           * plus the two supporting ones. GN-CD-307 §W is binding on use:
           * cyan never signals urgency; red is never decorative; the Live
           * Feed stays amber and only its individual critical items go
           * red; every colour-carried meaning also has a text carrier.
           */
          live: '#34d399',
          'live-text': '#6ee7b7',
          amber: '#fbbf24',
          'amber-text': '#fde68a',
          red: '#f87171',
          'red-text': '#fca5a5',
          violet: '#a78bfa',
          'violet-light': '#c4b5fd',
          orange: '#fb923c',

          /**
           * GN-CD-300 §H — border and glow roles. Alpha is load-bearing
           * and is preserved to the digit.
           */
          'edge-structural': 'rgba(56,189,248,0.12)',
          'edge-card': 'rgba(56,189,248,0.14)',
          'edge-card-mobile': 'rgba(56,189,248,0.15)',
          'edge-section': 'rgba(56,189,248,0.16)',
          'edge-header': 'rgba(56,189,248,0.18)',
          'edge-control': 'rgba(56,189,248,0.20)',
          'edge-control-alt': 'rgba(56,189,248,0.22)',
          'edge-control-active': 'rgba(56,189,248,0.28)',
          'edge-control-active-30': 'rgba(56,189,248,0.30)',
          'edge-control-active-32': 'rgba(56,189,248,0.32)',
          'edge-control-active-35': 'rgba(56,189,248,0.35)',
          'edge-emphasis': 'rgba(56,189,248,0.45)',
          'edge-emphasis-50': 'rgba(56,189,248,0.50)',
          'edge-divider': 'rgba(56,189,248,0.08)',
          'edge-divider-10': 'rgba(56,189,248,0.10)',
          'edge-hover': 'rgba(34,211,238,0.50)',
          'edge-focus': 'rgba(34,211,238,0.70)',
          'edge-focus-strong': 'rgba(34,211,238,0.80)',
          'edge-focus-halo': 'rgba(34,211,238,0.35)',
          'edge-amber': 'rgba(251,191,36,0.20)',
          'edge-amber-rule': 'rgba(251,191,36,0.16)',

          /**
           * M66.2 — GN-CD-024's nav hover fill. A distinct token rather than
           * a reuse of `edge-divider`, which carries the same value but means
           * something else; the HUD ladder has .07 and .09 but not .08.
           */
          'nav-hover': 'rgba(56,189,248,0.08)',

          /**
           * GN-CD-300 §G — grid and technical-field line colours. Four
           * distinct alphas; GN-CD-300 §W.2 forbids collapsing them.
           *
           * Named `rule-*` rather than `grid-*` on purpose: Tailwind emits
           * `colors`, `backgroundImage` AND `backgroundSize` keys all under
           * the `bg-` prefix, so a colour called `grid-page` would collide
           * with the `cd-grid-page` background image below and one of the
           * two would be unreachable.
           */
          'rule-page': 'rgba(56,189,248,0.045)',
          'rule-hero': 'rgba(56,189,248,0.035)',
          'rule-engine': 'rgba(56,189,248,0.03)',
          'rule-map': 'rgba(56,189,248,0.05)',

          /**
           * GN-CD-300 §G — the complete HUD construction stroke ladder.
           * NON-NEGOTIABLE (§W.1): the ladder tops out at .22. No HUD line
           * may render brighter than that, at any viewport, in any state.
           * The spec asserts no value above .22 exists on either channel.
           */
          'hud-sky-04': 'rgba(56,189,248,0.04)',
          'hud-sky-05': 'rgba(56,189,248,0.05)',
          /**
           * M66.11 — GN-CD-M66.11 §2/§9, the language trigger's keyboard-focus
           * fill. Additive and name-conformant: it takes the one free slot in the
           * existing hud-sky-{04,05,07,09,10,11} ladder and sits far below the
           * hud-* .22 alpha ceiling. No neighbour is repointed — .05 and .07 are
           * other families' values and the released design is exact at .06.
           */
          'hud-sky-06': 'rgba(56,189,248,0.06)',
          'hud-sky-07': 'rgba(56,189,248,0.07)',
          'hud-sky-09': 'rgba(56,189,248,0.09)',
          'hud-sky-10': 'rgba(56,189,248,0.10)',
          'hud-sky-11': 'rgba(56,189,248,0.11)',
          'hud-sky-13': 'rgba(56,189,248,0.13)',
          'hud-sky-14': 'rgba(56,189,248,0.14)',
          'hud-cyan-07': 'rgba(34,211,238,0.07)',
          'hud-cyan-10': 'rgba(34,211,238,0.10)',
          'hud-cyan-13': 'rgba(34,211,238,0.13)',
          'hud-cyan-14': 'rgba(34,211,238,0.14)',
          'hud-cyan-15': 'rgba(34,211,238,0.15)',
          'hud-cyan-16': 'rgba(34,211,238,0.16)',
          'hud-cyan-20': 'rgba(34,211,238,0.20)',
          'hud-cyan-22': 'rgba(34,211,238,0.22)',

          /**
           * M66.3 — GN-CD-040→076 Hero family. The sky ladder's own .22 rung,
           * released by GN-CD-045 for the map sphere outline. GN-CD-300 §W.1
           * caps the ladder at .22, so this is its top rung, not an exception.
           */
          'hud-sky-22': 'rgba(56,189,248,0.22)',

          /**
           * M66.3 — GN-CD-040→076 surface fills. Alpha is load-bearing and is
           * preserved to the digit. Named `fill-*` rather than folded into the
           * ink/accent ladders because these are SURFACES, not text or stroke
           * colours, and GN-CD-300 §W.2 forbids collapsing distinct roles that
           * happen to share a channel.
           */
          'fill-feed': 'rgba(4,8,16,0.90)',
          'fill-ask': 'rgba(6,13,26,0.90)',
          'fill-ask-m': 'rgba(5,11,22,0.94)',
          'fill-action': 'rgba(6,12,24,0.72)',
          'fill-badge': 'rgba(8,44,70,0.50)',
          'fill-live': 'rgba(16,72,55,0.50)',
          'fill-country': 'rgba(13,48,88,0.62)',

          /** GN-CD-056 — the LIVE pill's own border. */
          'edge-live': 'rgba(52,211,153,0.45)',

          /** GN-CD-047 — country stroke. A map role, not a chrome edge. */
          'edge-country': 'rgba(56,189,248,0.42)',

          /**
           * GN-CD-046 — graticule strokes, desktop and compact. Kept as two
           * distinct names for the same reason the four `rule-*` grid colours
           * are: the compact value coincides with `hud-sky-07` but means
           * something else, and §W.2 forbids collapsing them.
           */
          'rule-graticule': 'rgba(56,189,248,0.085)',
          'rule-graticule-m': 'rgba(56,189,248,0.07)',

          /** GN-CD-050 — the decorative connection lattice. Presentation only. */
          'link-decor': 'rgba(96,165,250,0.30)',

          /**
           * M66.4 — GN-CD-100 -> GN-CD-115 Trending family surfaces.
           *
           * The card fills are three distinct alphas of the same channel and
           * GN-CD-300 SS-W.2 forbids collapsing them: `.70` is the desktop card
           * over the section gradient, `.85` the mobile card, `.92` the mobile
           * body under its own media block.
           */
          'fill-trend-card': 'rgba(7,13,26,0.70)',
          'fill-trend-card-m': 'rgba(7,13,26,0.85)',
          'fill-trend-body-m': 'rgba(7,13,26,0.92)',
          'fill-trend-hover': 'rgba(12,24,44,0.80)',
          'fill-chip-m': 'rgba(4,8,16,0.72)',

          /** GN-CD-106/107 — the desktop rail arrow plate. */
          'fill-rail-arrow': 'rgba(6,12,24,0.92)',

          /**
           * M66.11 — GN-CD-M66.11 §3/§5, the language popup surface. Both
           * viewports use it. Deliberately NOT `fill-rail-arrow`: that is .92 and
           * this is .97, and the released specification states outright that the
           * near-opaque .97 is what stops page content bleeding through a floating
           * menu. "Close but not identical; do not substitute."
           */
          'fill-popup': 'rgba(6,12,24,0.97)',

          /**
           * M66.11 — GN-CD-M66.11 §2, the language trigger's pressed/open fill.
           * The only deep-blue control fill in the token set; every other control
           * state in this file is a cyan or sky alpha over the page base, which is
           * precisely why the open trigger reads as pressed rather than hovered.
           */
          'fill-control-open': 'rgba(20,58,110,0.40)',

          /**
           * GN-CD-101 — the Trending rule field. Its value coincides with
           * `rule-map`, but the two are different sections at different
           * rhythms (88px vs 44px) and GN-CD-300 SS-G keeps every grid colour
           * separately named. Same precedent as `nav-hover` in M66.2.
           *
           * Named `rule-trending` while the IMAGE that consumes it is
           * `cd-rules-trending` (plural), for the same reason M66.1 split
           * `rule-page` from `cd-grid-page`: Tailwind emits `colors`,
           * `backgroundImage` and `backgroundSize` all under the `bg-` prefix,
           * so an identical key in two of them makes one unreachable with no
           * build error. The collision audit in `trendingGeometry.spec.ts`
           * catches this class of mistake.
           */
          'rule-trending': 'rgba(56,189,248,0.05)',

          /**
           * M66.5 — GN-CD-137 -> GN-CD-142, the Intelligence Engine hub rings
           * and core border. Five released `[DESIGN-EXACT]` alphas, one per hub
           * layer, carried separately rather than collapsed.
           *
           * DELIBERATELY NOT IN THE `hud-` LADDER. GN-CD-300 §W.1 makes the HUD
           * CONSTRUCTION STROKE ladder non-negotiable at alpha <= .22, and
           * `claudeDesignFoundation.spec.ts` enforces it across every `hud-*`
           * key. These are a different role: they are the hub's own rings and
           * core edge (GN-CD-137-142), not background construction geometry,
           * and the design authors them well above .22. Filing them under
           * `hud-` would have forced a choice between breaking an M66.1
           * non-negotiable and shipping the wrong colour. `hub-` keeps both
           * intact, and keeps the token name honest about what it draws.
           *
           * The `bg-` namespace collision audit was re-run against
           * `backgroundImage` and `backgroundSize` before these were added;
           * none of the five, and none of the seven images below, shares a key
           * with either.
           */
          'hub-dash': 'rgba(34,211,238,0.18)',
          'hub-breath': 'rgba(34,211,238,0.30)',
          'hub-breath-m': 'rgba(34,211,238,0.38)',
          'hub-core': 'rgba(34,211,238,0.55)',
          'hub-core-m': 'rgba(34,211,238,0.60)',

          /**
           * M66.6 — GN-CD-184/185, the Trust family's own surfaces.
           *
           * `edge-tile` / `edge-tile-m` deliberately duplicate the VALUES of
           * `edge-control-active-30` / `edge-control-active` rather than reuse
           * those keys. GN-CD-300 SS-H names border tokens by ROLE, and an icon
           * tile is not an interactive control; borrowing a control token here
           * would make a later change to control borders silently restyle the
           * Trust tiles. Same reasoning that filed the M66.5 hub rings under
           * `hub-` rather than `hud-`.
           *
           * `fill-trust-card` is the MOBILE card fill. Desktop cards have no
           * background at all (GN-CD-184-DA) — the two viewports invert the
           * container relationship, so there is deliberately no desktop twin.
           */
          'edge-tile': 'rgba(56,189,248,0.30)',
          'edge-tile-m': 'rgba(56,189,248,0.28)',
          'fill-trust-card': 'rgba(7,13,26,0.80)',

          /**
           * M66.7 — GN-CD-200/204, the Footer.
           *
           * `fill-footer` is the family's whole fill story. GN-CD-200's layer
           * inventory is a list of absences — no gradient, no technical grid,
           * no decorative rules, no glow, no shadow, no mask — because "the
           * page ends by removing every technical layer: the visual full
           * stop". That is why this milestone adds no backgroundImage and no
           * boxShadow token at all.
           *
           * `edge-plate` is the tagline plate's border (GN-CD-204) and is the
           * strongest edge in the footer — stronger than the section's own .14,
           * which is what makes the plate the far-right terminus. It duplicates
           * the VALUE of `edge-control-active-30` and `edge-tile` on purpose:
           * GN-CD-300 SS-H names border tokens by ROLE, and a tagline plate is
           * neither an active control nor an icon tile. Same reasoning that
           * filed the M66.5 hub rings under `hub-` and the M66.6 icon tiles
           * under `edge-tile`.
           *
           * The remaining released footer edges already exist and are reused
           * unchanged: `edge-card` (.14, desktop section), `edge-structural`
           * (.12, mobile section) and `edge-control` (.20, mobile legal
           * divider).
           */
          'fill-footer': 'rgba(6,11,22,0.85)',
          'edge-plate': 'rgba(56,189,248,0.30)',

          /**
           * M66.8d — GN-CD-HIW-002 / GN-CD-HIW-004, the How It Works bracket
           * band. Four decorative stroke values, all on channels the released
           * system already uses.
           *
           * NAMED BY ALPHA, NOT BY ELEMENT, and deliberately: `edge-hiw-55`
           * serves BOTH the two top corner brackets and arrowhead 1. They are
           * one role — a 1-alpha decorative construction stroke on the accent
           * cyan channel inside this band — at one value, so they are one
           * token. A key called `edge-hiw-bracket-top` used on an arrowhead
           * would read as a mistake. The `-NN` suffix follows the convention
           * already established by `edge-control-active-30/-32/-35` and
           * `edge-emphasis-50`.
           *
           * NOT FILED UNDER `hud-`. `claudeDesignFoundation.spec.ts` §W.1
           * asserts that every `hud-` key holds alpha <= .22 AND matches
           * `^hud-(sky|cyan)-\d{2}$`; `.55` and `.25` would break it on both
           * counts. M66.5 hit exactly this trap with the hub-ring alphas.
           *
           * `rgba(34,211,238,0.55)` DOES already exist, as `hub-core` — and is
           * deliberately NOT reused. That is the M66.5 Intelligence Engine
           * hub-geometry namespace; borrowing an Engine token for a How It
           * Works bracket would cross-wire two released families. Same
           * reasoning that produced `edge-plate` above rather than reusing
           * `edge-tile`.
           *
           * The tile border is `.40` cyan where Trust's is `.30` sky:
           * GN-CD-HIW-004 states the two tile treatments "must not be unified
           * — they are separate treatments in the released system".
           */
          'edge-hiw-55': 'rgba(34,211,238,0.55)',
          'edge-hiw-25': 'rgba(34,211,238,0.25)',
          'edge-hiw-40': 'rgba(34,211,238,0.40)',
          'edge-hiw-sky-48': 'rgba(56,189,248,0.48)',
        },
      },

      fontFamily: {
        // ── EXISTING — UNCHANGED. `font-body` is still Inter, so no
        // undesigned route changes typeface. See CTO decision D3.
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],

        /**
         * M66.1 — GN-CD-301 §I.1, the exact authored stacks.
         *
         * All three point at their OWN variables rather than reusing the
         * legacy ones, even where the family is already correct. The
         * released weight lists are wider than the legacy ones, and adding
         * a weight to a family in use is not inert: `font-mono
         * font-semibold` appears in 7 files outside the homepage that
         * currently fall back because IBM Plex Mono is loaded at 400/500
         * only. Loading 600 into `--font-mono` would have restyled /map and
         * /search. Separate variables keep the legacy rendering exactly as
         * it is. See the note in app/layout.tsx.
         *
         * GN-CD-301 §I.1: "No additional fallback may be inserted."
         */
        'cd-display': ['var(--font-cd-display)', 'sans-serif'],
        'cd-body': ['var(--font-cd-body)', 'system-ui', 'sans-serif'],
        'cd-mono': ['var(--font-cd-mono)', 'monospace'],
      },

      /**
       * GN-CD-301 §I.2–I.4 — the three role scales, verbatim. Named by the
       * role the specification assigns, so a later milestone consumes
       * `text-cd-mono-label` rather than re-deriving `11px/.16em` by hand.
       * GN-CD-301 §V: family, size, weight, line-height and letter-spacing
       * are all exact-match. GN-CD-301 §W: the tracking values from .02em
       * through .18em are all meaningfully distinct.
       */
      fontSize: {
        // Display (Space Grotesk) — GN-CD-301 §I.2
        'cd-hero': ['clamp(34px,3.5vw,54px)', { lineHeight: '1.05', letterSpacing: '-0.026em', fontWeight: '700' }],
        'cd-article': ['38px', { lineHeight: '1.12', letterSpacing: '-0.02em', fontWeight: '700' }],
        'cd-hero-m': ['26px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'cd-screen-title': ['26px', { letterSpacing: '-0.01em', fontWeight: '600' }],
        'cd-brief-title': ['21px', { fontWeight: '600' }],
        'cd-menu-row': ['20px', { fontWeight: '500' }],
        'cd-wordmark': ['19px', { letterSpacing: '-0.01em', fontWeight: '700' }],
        'cd-wordmark-m': ['17px', { fontWeight: '700' }],
        'cd-lockup': ['15px', { lineHeight: '1.35', fontWeight: '600' }],
        'cd-preview-head': ['15px', { fontWeight: '600' }],
        'cd-card-head-m': ['14.5px', { lineHeight: '1.32', fontWeight: '600' }],
        'cd-preview-head-m': ['14px', { fontWeight: '600' }],
        'cd-lockup-m': ['7.5px', { lineHeight: '1.25', fontWeight: '600' }],

        // Body (IBM Plex Sans) — GN-CD-301 §I.3
        'cd-hero-copy': ['16px', { lineHeight: '1.55', fontWeight: '400' }],
        'cd-summary': ['15.5px', { lineHeight: '1.65', fontWeight: '400' }],
        'cd-input': ['14px', { fontWeight: '400' }],
        'cd-keyfacts': ['14px', { lineHeight: '1.55', fontWeight: '400' }],
        'cd-row-head': ['13.5px', { lineHeight: '1.35', fontWeight: '600' }],
        'cd-card-head': ['13px', { lineHeight: '1.32', fontWeight: '600' }],
        'cd-hero-copy-m': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        'cd-action': ['13px', { fontWeight: '400' }],
        'cd-trust-body': ['12.5px', { lineHeight: '1.5', fontWeight: '400' }],
        'cd-bullet': ['12.5px', { fontWeight: '400' }],
        'cd-module-desc': ['12px', { lineHeight: '1.35', fontWeight: '400' }],
        'cd-preview-summary': ['11.5px', { lineHeight: '1.45', fontWeight: '400' }],
        'cd-footer-desc': ['11.5px', { lineHeight: '1.6', fontWeight: '400' }],
        'cd-engine-sub-m': ['11px', { fontWeight: '400' }],

        /**
         * M66.2 — GN-CD-020..027 ERRATUM-009. GN-CD-301 §I.3 omitted three
         * header type roles; the header family released them, so they arrive
         * here additively rather than by bending an existing token.
         *
         * `cd-nav-item` is NOT `cd-row-head`: that token is also 13.5px but
         * at weight 600 with line-height 1.35, which is a different role.
         * `cd-signin` is NOT `cd-action`: ERRATUM-009 corrects the Sign In
         * label's weight from 400 to 600.
         *
         * The third role ERRATUM-009 released — the language caret at 10px in
         * `#5b7fa6` — needs no token: `text-[10px]` with `text-cd-ink-meta`
         * already expresses it exactly.
         */
        'cd-nav-item': ['13.5px', { fontWeight: '400' }],
        'cd-signin': ['13px', { fontWeight: '600' }],

        // Mono (IBM Plex Mono) — GN-CD-301 §I.4
        'cd-mono-eyebrow': ['14px', { letterSpacing: '0.18em' }],
        'cd-mono-feed': ['12px', { letterSpacing: '0.16em' }],
        'cd-mono-section': ['12px', { letterSpacing: '0.18em' }],
        'cd-mono-glyph': ['12.5px', {}],
        'cd-mono-panel': ['11.5px', { letterSpacing: '0.15em' }],
        'cd-mono-trust': ['11.5px', { letterSpacing: '0.13em' }],
        'cd-mono-status': ['11px', { letterSpacing: '0.16em' }],
        'cd-mono-nav': ['11px', { letterSpacing: '0.14em' }],
        'cd-mono-module': ['11px', { letterSpacing: '0.05em' }],
        'cd-mono-code': ['11px', {}],
        'cd-mono-category': ['10.5px', { letterSpacing: '0.14em' }],
        'cd-mono-chip': ['10.5px', { letterSpacing: '0.13em' }],
        'cd-mono-meta': ['10.5px', {}],
        'cd-mono-readout': ['10px', { letterSpacing: '0.14em' }],
        'cd-mono-lang-m': ['10px', { letterSpacing: '0.10em' }],
        'cd-mono-module-m': ['10px', { letterSpacing: '0.02em' }],
        'cd-mono-preview-cat': ['9.5px', { letterSpacing: '0.14em' }],
        'cd-mono-inspect': ['9.5px', { letterSpacing: '0.12em' }],
        'cd-mono-meta-m': ['9.5px', { letterSpacing: '0.10em' }],
        'cd-mono-preview-cat-m': ['9px', { letterSpacing: '0.13em' }],
        'cd-mono-chip-m': ['9px', { letterSpacing: '0.12em' }],
        'cd-mono-badge': ['9px', { letterSpacing: '0.04em' }],
        'cd-mono-badge-m': ['9px', { letterSpacing: '0' }],
        'cd-mono-core-sub': ['8.5px', { letterSpacing: '0.16em' }],
        'cd-mono-subject-m': ['8.5px', { letterSpacing: '0.12em' }],
        'cd-mono-category-m': ['8.5px', { letterSpacing: '0.10em' }],
        'cd-mono-bullet-m': ['8.5px', { letterSpacing: '0.08em' }],
        'cd-mono-subject': ['7.5px', { letterSpacing: '0.12em' }],

        /**
         * M66.3 — GN-CD-068/074/076. Four roles the M66.1 release did not
         * cover. `cd-mono-expand` and `cd-mono-category` carry the same two
         * values; they are separate names because they are separate roles
         * (GN-CD-068 vs GN-CD-066), following the `nav-hover` precedent.
         */
        'cd-feed-region': ['11.5px', { fontWeight: '400' }],
        'cd-feed-time': ['11px', { fontWeight: '400' }],
        'cd-mono-feed-action': ['12px', { letterSpacing: '0.14em' }],
        'cd-mono-expand': ['10.5px', { letterSpacing: '0.14em' }],

        /** M66.4 — GN-CD-103, the mobile Trending section title. */
        'cd-mono-section-m': ['10.5px', { letterSpacing: '0.16em' }],

        /**
         * M66.5 — GN-CD-135/136/143/148. Five roles the earlier releases did
         * not provision. `cd-mono-eyebrow` (14px/.18em) and `cd-engine-sub-m`
         * (11px) already existed and are reused unchanged.
         *
         * `cd-core-title-m` is 7px, not 7.5px: GN-CD-130's own ERRATA against
         * the previous release corrects that value, and the corrected figure
         * is what ships. It is legible only as texture, which is why CTO
         * decision D-8 B marks the duplicated core title decorative.
         */
        'cd-mono-eyebrow-m': ['10px', { letterSpacing: '0.14em' }],
        'cd-mono-tile': ['12px', {}],
        'cd-engine-sub': ['14px', { fontWeight: '400' }],
        'cd-core-title': ['15px', { lineHeight: '1.35', fontWeight: '600' }],
        'cd-core-title-m': ['7px', { lineHeight: '1.25', fontWeight: '600' }],

        /**
         * M66.6 — ERRATUM-007. GN-CD-301 released only the DESKTOP Trust type
         * roles (`cd-mono-trust` 11.5px/.13em, `cd-trust-body` 12.5px/1.5,
         * `cd-mono-glyph` 12.5px — all three already provisioned by M66.1 and
         * reused unchanged). The three mobile roles below were missing and are
         * released additively by GN-CD-180 SS-ERRATA. No previously released
         * value is disproved.
         */
        'cd-mono-trust-m': ['9.5px', { letterSpacing: '0.11em', lineHeight: '1.4' }],

        /**
         * M66.8d — GN-CD-HIW-003. Four type roles, each verified to have no
         * existing equivalent rather than assumed to be new:
         *
         *   23px      no 23px token exists anywhere in the scale.
         *   15.5px    `cd-summary` is 15.5px but 1.65/400; this is 1.3/600.
         *   9.5px     four 9.5px mono tokens exist — at .14em, .12em, .10em
         *             and .11em. NONE at .18em.
         *   14px/600  `cd-preview-head-m` is a byte-exact match for
         *             ['14px', { fontWeight: '600' }] — and is deliberately
         *             NOT reused. It carries no lineHeight, and a fontSize
         *             tuple without one emits no line-height declaration, so
         *             adopting it would silently drop the Trust heading's
         *             existing 1.32 and change its box height. GN-CD-HIW-006
         *             specifies 14px / 600 / margin-top 5px and is silent on
         *             line-height, so 1.32 is preserved. (M66.6 was bitten by
         *             exactly this tuple behaviour.)
         *
         * `cd-card-head` is NOT repointed 13 -> 14: it is shared with
         * TrendingCard, which locks its exact tuple.
         */
        'cd-hiw-title': ['23px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'cd-hiw-step-title': ['15.5px', { lineHeight: '1.3', fontWeight: '600' }],
        'cd-mono-step': ['9.5px', { letterSpacing: '0.18em' }],
        'cd-trust-subhead': ['14px', { lineHeight: '1.32', fontWeight: '600' }],
        'cd-trust-body-m': ['11.5px', { lineHeight: '1.45' }],
        'cd-mono-glyph-m': ['10.5px', {}],

        /**
         * M66.7 — ERRATUM-013. GN-CD-301 released only the DESKTOP footer type
         * roles; `cd-lockup` (15px/600) and `cd-footer-desc` (11.5px/1.6) were
         * already provisioned by M66.1 and are reused unchanged. The three
         * mobile roles below were missing and are released additively.
         *
         * The `.1em` mono tracking on `cd-mono-tagline-m` did not previously
         * exist anywhere in the scale — ERRATUM-013 records that the released
         * ladder carried .08em, .12em and .16em at that size but not .1em.
         *
         * `cd-mono-plate` is GN-CD-204's plate role. It is NOT `cd-mono-expand`
         * (also 10.5px / .14em) because the plate declares `line-height:1.7`
         * and a Tailwind fontSize tuple with no `lineHeight` emits none — the
         * cascade trap M66.6 hit with `line-clamp`. A separate role token with
         * the line-height baked in cannot be caught by it.
         */
        'cd-footer-ident-m': ['13px', { fontWeight: '600' }],
        'cd-mono-tagline-m': ['8.5px', { letterSpacing: '0.1em' }],
        'cd-footer-legal-m': ['10.5px', {}],
        'cd-footer-link': ['13px', {}],
        'cd-mono-plate': ['10.5px', { letterSpacing: '0.14em', lineHeight: '1.7' }],
      },

      /**
       * GN-CD-302 §E.1 — the authored spacing scale, as px. `cd-18` is the
       * NON-NEGOTIABLE desktop section rhythm (§W).
       */
      spacing: {
        'cd-2': '2px',
        'cd-4': '4px',
        'cd-5': '5px',
        'cd-6': '6px',
        'cd-7': '7px',
        'cd-8': '8px',
        'cd-9': '9px',
        'cd-10': '10px',
        'cd-11': '11px',
        'cd-12': '12px',
        'cd-13': '13px',
        'cd-14': '14px',
        'cd-16': '16px',
        'cd-18': '18px',
        'cd-20': '20px',
        'cd-22': '22px',
        'cd-26': '26px',
        'cd-28': '28px',
        'cd-30': '30px',
        'cd-36': '36px',
        'cd-60': '60px',

        /** M66.3 — GN-CD-040→076 released values not already in the scale. */
        'cd-3': '3px',
        'cd-15': '15px',
        'cd-17': '17px',
        'cd-24': '24px',
        'cd-38': '38px',
        'cd-44': '44px',
        'cd-304': '304px',
        'cd-550': '550px',
        'cd-1100': '1100px',

        /** M66.4 — GN-CD-100 -> 115 released fixed dimensions. */
        'cd-19': '19px',
        'cd-34': '34px',
        'cd-74': '74px',
        'cd-78': '78px',
        'cd-112': '112px',
        'cd-246': '246px',
        'cd-280': '280px',
      },

      /**
       * GN-CD-302 §E.2 — the radius scale. `46px` (prototype device frame)
       * and `50%` are omitted: the former is prototype-only chrome, the
       * latter is already `rounded-full`.
       */
      borderRadius: {
        'cd-2': '2px',
        'cd-3': '3px',
        'cd-4': '4px',
        'cd-5': '5px',
        'cd-6': '6px',
        'cd-8': '8px',
        'cd-9': '9px',
        'cd-10': '10px',
        'cd-11': '11px',
        'cd-12': '12px',
        'cd-13': '13px',
        'cd-14': '14px',
        'cd-16': '16px',
        'cd-18': '18px',
        'cd-pill': '999px',
      },

      /**
       * GN-CD-302 §E.1 — the desktop presentation boundary.
       *
       * `max-width:1500px` is implemented. `min-width:1360px` is
       * DELIBERATELY NOT, per CTO decision D4: the prototype does not
       * reflow below 1360px, it scrolls horizontally (GN-CD-302 §M, flagged
       * `[UNRESOLVED]` by the design itself as a product behaviour). That
       * would fail WCAG 2.1 SC 1.4.10 Reflow and break every viewport
       * under 1360px. The divergence is authorized and is locked by
       * `claudeDesignFoundation.spec.ts`.
       */
      maxWidth: {
        'cd-page': '1500px',

        /** M66.3 — GN-CD-059, the supporting-copy measure at both viewports. */
        'cd-copy': '340px',
        'cd-copy-m': '300px',
      },

      /**
       * M66.2 (CTO decision D1) — the width at which the released desktop
       * header can actually be rendered.
       *
       * GN-CD-020..027 puts nine non-wrapping nav items, a brand lockup and a
       * three-control utility cluster in one 62px flex row with exact 28px
       * gaps and no overflow strategy of any kind. MLR-10 states the design
       * has "no overflow menu, no priority-plus pattern, and no breakpoint at
       * which nav items collapse", so the row must simply fit.
       *
       * Measured from the released geometry and the real EN/PL dictionary
       * strings, the corrected header needs ~1313px in English and ~1388px in
       * Polish. The production header previously activated at `lg` (1024px),
       * where it was ~289px / ~364px short — Polish already overflowed at
       * 1440px before this milestone. This breakpoint is the authorized
       * production answer: render the released header only where its own
       * geometry fits, and keep the existing mobile chrome below it.
       *
       * Additive: a new screen name has zero existing consumers, and `sm`,
       * `md`, `lg`, `xl` and `2xl` are all untouched.
       */
      /**
       * F1.b — Admin shell geometry.
       *
       * DELIBERATELY `width`, NOT `spacing`. M66.1's
       * claudeDesignFoundation.spec.ts asserts that EVERY key in
       * theme.spacing matches /^cd-\d+$/ and equals its own pixel value —
       * a released GN-CD contract this milestone must not weaken. Adding
       * `adm-rail` to spacing would have broken it, so the two Admin
       * measurements live under `width`, which no released spec
       * constrains. Nothing in the GN-CD spacing ladder is touched.
       */
      width: {
        'adm-rail': '252px',
        'adm-icon-rail': '68px',
      },

      screens: {
        /**
         * F1.b — the two Admin shell breakpoints, min-width like every
         * Tailwind screen, so the base (mobile-first) state is the drawer:
         *   below 900px             drawer
         *   `adm-rail`  >= 900px    collapsed 68px icon rail
         *   `adm-full`  >= 1280px   full 252px sidebar
         * Exactly the responsive behaviour ADMIN-01 specifies. Additive:
         * two new screen names with zero existing consumers.
         */
        'adm-rail': '900px',
        'adm-full': '1280px',

        'cd-header': '1400px',

        /**
         * M66.3 (CTO decision L-1A) — the width at which the released
         * three-column Hero console can actually be composed.
         *
         * GN-CD-040 fixes tracks 1 and 3 at 470px and 312px with no gap, so
         * the map track is whatever remains. The homepage content box is
         * `min(vw,1500) - 52` (GN-CD-302 §E.1, implemented by PageCanvas), so
         * the map track is `min(vw,1500) - 834`. At the previous `lg` gate
         * (1024px) that is 138px — the map is a sliver. At 1240px it is 354px
         * and at the 1280px acceptance viewport 394px, both of which hold the
         * composition. GN-CD §B leaves 768–1360 `[UNRESOLVED-001/002]` and the
         * prototype's own answer there is an 80px horizontal scroll, which
         * M66.1 decision D4 already rejected. This breakpoint is the
         * authorized production answer: the console above it, the authored
         * mobile Hero card below it, and no horizontal scroll at any width.
         *
         * Additive: a new screen name has zero existing consumers, and `sm`,
         * `md`, `lg`, `xl`, `2xl` and `cd-header` are all untouched.
         */
        'cd-hero': '1240px',

        /**
         * M66.5 — the Intelligence Engine desktop floor, CTO decision D-3 C.
         *
         * DERIVED, not chosen: PageCanvas gives `min(vw,1500) - 52`, and the
         * engine section's own released padding is 24px per side, so the
         * released 1240px canvas needs `1240 + 48 = 1288px` of content box,
         * i.e. a 1340px viewport. At 1440 that yields the 1388px content box
         * and the 74px canvas clearance GN-CD-130 §B/§C state themselves.
         *
         * `cd-hero` (1240px) is deliberately NOT reused: at a 1240px viewport
         * the content box is 1188px and the engine canvas does not fit. The
         * two surfaces have different floors and now say so.
         *
         * Below this, Tailwind's stock `md` (768px) supplies the lower gate,
         * so D-3 C's three compositions need only ONE new breakpoint.
         */
        'cd-engine': '1340px',
      },

      /** GN-CD-302 §E.3 — the 44px mobile hit-target floor (§W, §O). */
      minHeight: {
        'cd-touch': '44px',

        /** M66.3 — GN-CD-040, the Hero composition's own min-height floor. */
        'cd-hero-frame': '428px',
      },
      minWidth: {
        'cd-touch': '44px',
      },

      backgroundImage: {
        /**
         * F1.b — the Admin page field, transcribed verbatim from the
         * approved artifact's own `body` declaration. One radial layer,
         * not the homepage's two-layer composite.
         */
        'adm-page': 'radial-gradient(1100px 520px at 18% -12%, #0b2432 0%, #050b11 62%)',
        'adm-rail': 'linear-gradient(180deg, #071219, #050d13)',

        // ── EXISTING — UNCHANGED (both currently have zero consumers). ──
        'grid-pattern':
          'linear-gradient(to right, rgba(61,111,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(61,111,255,0.06) 1px, transparent 1px)',
        'hero-glow':
          'radial-gradient(circle at 50% 0%, rgba(61,111,255,0.22), transparent 60%)',

        /**
         * M66.1 — GN-CD-300 §F.2, the composite desktop page background.
         * The two radial layers only; the `#04060c` base beneath them is
         * applied as a background COLOUR (`bg-cd-void`), which composites
         * identically to the specification's single shorthand. GN-CD-300
         * §V: gradient stop positions are exact-match.
         */
        'cd-page':
          'radial-gradient(1100px 600px at 62% -10%, rgba(14,55,110,.55), transparent 70%), radial-gradient(700px 500px at 8% 30%, rgba(20,90,150,.22), transparent 70%)',

        /**
         * GN-CD-300 §G — the page technical grid, at the released colour
         * `rgba(56,189,248,.045)`.
         *
         * DERIVED CONSTRUCTION, declared as such: §G fixes the grid's
         * COLOUR and SPACING and states that "grid geometry belongs to
         * each element's own specification" — GN-CD-003, which is not yet
         * released. The 1px orthogonal rule construction below follows
         * both the design's other released grids and this repository's
         * existing convention. Confirm against GN-CD-003 when it releases.
         */
        'cd-grid-page':
          'linear-gradient(to right, rgba(56,189,248,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.045) 1px, transparent 1px)',

        /**
         * M66.3 — GN-CD-040, the Hero surface's own radial field, both
         * viewports. As with `cd-page`, the `#04060c` base beneath the desktop
         * layer is applied as a background COLOUR (`bg-cd-void`), which
         * composites identically to the specification's single shorthand.
         * GN-CD §V: gradient stop positions are exact-match.
         */
        'cd-hero': 'radial-gradient(1200px 620px at 58% 40%, rgba(11,52,100,.5), rgba(4,7,14,.97) 72%)',
        'cd-hero-m': 'radial-gradient(320px 260px at 92% 6%, rgba(13,58,112,.75), rgba(6,10,20,.96) 72%)',

        /** GN-CD-041 — the Hero technical grid. Desktop only; no mask, no fade. */
        'cd-grid-hero':
          'linear-gradient(rgba(56,189,248,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.035) 1px, transparent 1px)',

        /** GN-CD-053 / GN-CD-054 — the two Hero edge scrims. */
        'cd-scrim-l': 'linear-gradient(90deg, rgba(4,6,12,.95), rgba(4,6,12,0))',
        'cd-scrim-r': 'linear-gradient(270deg, rgba(4,6,12,.92), rgba(4,6,12,0))',

        /** GN-CD-026 — the two mobile map-bleed scrims. */
        'cd-map-scrim-a':
          'linear-gradient(90deg, rgba(6,10,20,.94), rgba(6,10,20,.35) 30%, rgba(6,10,20,0) 52%)',
        'cd-map-scrim-b': 'linear-gradient(0deg, rgba(6,10,20,.8), rgba(6,10,20,0) 44%)',

        /** GN-CD-044 — the map atmosphere, as a CSS radial rather than an SVG def. */
        'cd-map-atm':
          'radial-gradient(circle at 50% 52%, rgba(14,58,107,.72), rgba(10,36,71,.42) 58%, rgba(4,6,12,0) 100%)',

        /**
         * GN-CD-071 (ERRATUM-004) — the Live Feed perimeter sweep is a masked
         * rotating conic PLANE, not a border animation. `cd-sweep` is the
         * plane; `cd-sweep-mask` is the inset cover that reveals only a 1.5px
         * rim.
         */
        'cd-sweep':
          'conic-gradient(from 0deg, transparent 0 80%, rgba(251,191,36,.95) 90%, transparent 96%)',
        'cd-sweep-mask': 'linear-gradient(180deg, rgba(12,11,16,.97), rgba(4,8,16,.97))',

        /**
         * M66.4 — GN-CD-100, the Trending section canvas. Desktop only: the
         * design authors NO container on mobile, where the block sits
         * unbounded in the content stack.
         */
        'cd-trending': 'linear-gradient(180deg, rgba(9,16,32,.9), rgba(5,9,18,.9))',

        /**
         * GN-CD-101 — the Trending rule field: 1px vertical rules every 88px,
         * no horizontal component, no mask, no fade. Deliberately a different
         * rhythm from the hero's 44px two-axis grid (GN-CD-300 SS-G).
         */
        'cd-rules-trending':
          'repeating-linear-gradient(90deg, rgba(56,189,248,.05) 0 1px, transparent 1px 88px)',

        /**
         * M66.5 — GN-CD-131, the engine section's own radial field. The
         * radial centre coincides with the hub centre, so the hub sits in the
         * brightest part of the field; GN-CD-131 warns that moving the hub
         * without moving the gradient breaks the depth read.
         *
         * Mobile is NOT the desktop gradient rescaled: it is an explicit
         * `300px 240px` ellipse at `50% 45%` with its own stops.
         */
        'cd-engine': 'radial-gradient(circle at 50% 50%, rgba(11,50,96,.5), rgba(5,9,18,.96) 68%)',
        'cd-engine-m':
          'radial-gradient(300px 240px at 50% 45%, rgba(11,52,100,.55), rgba(5,9,18,.97) 74%)',

        /**
         * GN-CD-132 — the engine's single grid layer at `rgba(56,189,248,.03)`
         * (`colors.cd.rule-engine`, released in M66.1). GN-CD-133 records that
         * the minor grid is deliberately ABSENT here; one layer is correct.
         * Sizes come from the existing `cd-grid-38` / `cd-grid-30`.
         */
        'cd-grid-engine':
          'linear-gradient(rgba(56,189,248,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.03) 1px, transparent 1px)',

        /**
         * GN-CD-140 — the hub's segmented radar band. 2 degrees lit every 15
         * gives 24 desktop segments; mobile's 16-degree period gives 22. It
         * must remain a CSS conic gradient (GN-CD §T: nothing in this family
         * may be rasterised).
         */
        'cd-radar':
          'repeating-conic-gradient(from 0deg, rgba(34,211,238,.11) 0deg 2deg, transparent 2deg 15deg)',
        'cd-radar-m':
          'repeating-conic-gradient(from 0deg, rgba(34,211,238,.12) 0deg 2deg, transparent 2deg 16deg)',

        /** GN-CD-142 — the hub core disc. Desktop and mobile differ in both centre and stop. */
        'cd-core': 'radial-gradient(circle at 50% 38%, rgba(13,45,86,.98), rgba(4,8,16,.98) 72%)',
        'cd-core-m': 'radial-gradient(circle at 50% 36%, rgba(13,45,86,.98), rgba(4,8,16,.98) 74%)',

        /**
         * M66.6 — GN-CD-180/181/185.
         *
         * `cd-trust` is INTENTIONALLY the same string as `cd-trending`.
         * GN-CD-180 SS-Trust-Trending records a deliberate two-tier system —
         * Hero and the Engine are system surfaces (radial fields, two-axis
         * grids, high motion); Trending and Trust are content surfaces sharing
         * one linear gradient, vertical-only rules and little or no motion —
         * and warns that "if Trending and Trust are built with different panel
         * treatments, the rhythm collapses". Two role-named keys with an
         * asserted equality say that out loud; one shared key would only say it
         * by accident. `trustGeometry.spec.ts` locks them equal.
         *
         * `cd-field-trust` carries BOTH released decorative layers in one
         * declaration, in the released order: the corner bloom below the
         * panel's lower-left corner, then the 110px vertical rules. Desktop
         * only — mobile has no decorative field.
         */
        'cd-trust': 'linear-gradient(180deg, rgba(9,16,32,.9), rgba(5,9,18,.9))',
        'cd-field-trust':
          'radial-gradient(420px 130px at 12% 120%, rgba(34,211,238,.09), transparent 70%), repeating-linear-gradient(90deg, rgba(56,189,248,.045) 0 1px, transparent 1px 110px)',
        'cd-tile-trust': 'radial-gradient(circle at 50% 30%, rgba(16,52,94,.9), rgba(6,14,28,.9))',

        /**
         * M66.8d — GN-CD-HIW-004 / GN-CD-HIW-005. Five single-consumer
         * gradients, registered rather than inlined because arbitrary Tailwind
         * values cannot carry commas cleanly — the same reason `cd-trust`,
         * `cd-field-trust`, `cd-tile-trust` and `cd-rules-trending` above are
         * tokens.
         *
         * `cd-field-hiw` needs NO paired backgroundSize entry: the 132px
         * interval lives inside the repeating gradient, exactly as
         * `cd-rules-trending` (88px) and `cd-field-trust` (110px) already do.
         * Only the two-axis `cd-grid-*` fields need a backgroundSize twin.
         *
         * The 132px interval and its .04 alpha are both genuinely new: the
         * released rule intervals are 88px (Trending) and 110px (Trust), and
         * the released grid-alpha ladder holds .03, .035, .045 and .05.
         *
         * `cd-rail-2` is deliberately cooler and dimmer than `cd-rail-1`
         * (#38bdf8 at .42 against #22d3ee at .5) — GN-CD-HIW-004: "Both values
         * are required; do not normalise them." Each fades from alpha 0 at its
         * left edge to full alpha at 34%, so the segment emerges out of the
         * preceding column rather than starting with a hard cap.
         */
        'cd-hiw': 'radial-gradient(900px 300px at 20% 0%, rgba(11,50,96,.34), transparent 72%)',
        'cd-field-hiw':
          'repeating-linear-gradient(90deg, rgba(56,189,248,.04) 0 1px, transparent 1px 132px)',
        'cd-tile-hiw': 'radial-gradient(circle at 50% 28%, rgba(16,58,104,.98), rgba(5,10,20,.98))',
        'cd-rail-1':
          'linear-gradient(90deg, rgba(34,211,238,0), rgba(34,211,238,.5) 34%, rgba(34,211,238,.5))',
        'cd-rail-2':
          'linear-gradient(90deg, rgba(34,211,238,0), rgba(56,189,248,.42) 34%, rgba(56,189,248,.42))',
      },

      backgroundSize: {
        // ── EXISTING — UNCHANGED (zero consumers). ──
        grid: '48px 48px',

        /**
         * GN-CD-300 §G — released grid spacings, all four, kept distinct.
         * Keyed by the px value, again to stay clear of the `bg-` prefix
         * collision described above: `bg-cd-grid-56` is a SIZE,
         * `bg-cd-grid-page` is the IMAGE, and the two compose.
         */
        'cd-grid-56': '56px 56px',
        'cd-grid-44': '44px 44px',
        'cd-grid-38': '38px 38px',
        'cd-grid-30': '30px 30px',
      },

      /** GN-CD-304 §L.1 — the reusable glow declarations. */
      boxShadow: {
        'cd-breath': '0 0 60px rgba(34,211,238,.18) inset, 0 0 30px rgba(34,211,238,.1)',
        'cd-breath-peak': '0 0 84px rgba(34,211,238,.3) inset, 0 0 42px rgba(34,211,238,.18)',
        'cd-focus-halo': '0 0 0 1px rgba(34,211,238,.35)',
        'cd-trust-hover': '0 0 20px rgba(34,211,238,.12), inset 0 0 0 1px rgba(34,211,238,.28)',

        /** M66.3 — GN-CD-071, the sweep mask's own inner amber glow. */
        'cd-sweep-glow': '0 0 26px rgba(251,191,36,.14) inset',

        /**
         * M66.4 — GN-CD-109-DA hover. The card's RESTING halo is parametric
         * (`0 0 14px rgba({RGB},.07)`, tinted by the story's own category) and
         * is therefore computed per card rather than tokenised — exactly as
         * this file's own header note anticipated: category identity is
         * computed from a channel map, not tokenised.
         */
        'cd-trend-hover': '0 8px 24px rgba(4,10,22,.6)',

        /**
         * M66.5 — GN-CD-142/137. The core's dual shadow IS the hub's outer
         * glow: GN-CD-137 records that the glow is not a separate element and
         * must not be implemented twice. Mobile carries a single, tighter
         * shadow.
         */
        'cd-core-glow': '0 0 46px rgba(34,211,238,.26), 0 0 90px rgba(37,99,235,.16)',
        'cd-core-glow-m': '0 0 26px rgba(34,211,238,.32)',

        /**
         * M66.6 — GN-CD-185. The icon tile's inset glow, DESKTOP ONLY:
         * ERRATUM-008 records that the mobile tile "is not a scaled copy — it
         * drops the inset glow entirely", so there is deliberately no mobile
         * twin of this token.
         */
        'cd-tile-glow': '0 0 20px rgba(34,211,238,.12) inset',

        /**
         * M66.8d — GN-CD-HIW-004. 22px at .14, against the Trust tile's 20px
         * at .12 directly above. Close, and deliberately not collapsed: the
         * specification requires the two tile treatments to stay distinct.
         */
        'cd-tile-hiw-glow': '0 0 22px rgba(34,211,238,.14) inset',

        /**
         * M66.11 — GN-CD-M66.11 §3, the desktop language popup. THREE layers,
         * not one, and the specification is explicit that all three are required:
         * a drop shadow for lift, an inset hairline for edge definition, and an
         * outer cyan bloom for HUD family membership. Centralized here rather
         * than written as an arbitrary value because this file already holds
         * every other released composite shadow.
         */
        'cd-popup':
          '0 14px 34px rgba(2,6,14,.62), 0 0 0 1px rgba(34,211,238,.06) inset, 0 0 26px rgba(34,211,238,.08)',

        /**
         * M66.11 — GN-CD-M66.11 §5, the mobile variant. The inset hairline is
         * DROPPED, per the released desktop→mobile difference table ("Shadow
         * layers: 3 → 2"). The two surviving layers are byte-identical to the
         * desktop ones, so the two tokens can never drift apart in colour.
         */
        'cd-popup-m': '0 14px 34px rgba(2,6,14,.62), 0 0 26px rgba(34,211,238,.08)',

        /** M66.11 — GN-CD-M66.11 §2, the language trigger's pressed/open glow. */
        'cd-control-open': '0 0 18px rgba(34,211,238,.12)',
      },

      /** GN-CD-304 §L.6 — the five authored transition durations. */
      transitionDuration: {
        'cd-150': '150ms',
        'cd-160': '160ms',
        'cd-180': '180ms',
        'cd-200': '200ms',
      },

      keyframes: {
        // ── EXISTING — UNCHANGED. ────────────────────────────────────────
        'ring-pulse': {
          '0%': { transform: 'scale(0.85)', opacity: '0.55' },
          '70%': { opacity: '0' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
        'fade-slide-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-slide-out': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-6px)' },
        },
        // C2.1 — radar emblem scan sweep (Logo.tsx). A single new
        // keyframe, not a broader token rewrite: the emblem's other
        // two motions (breathing outer ring, pulsing core) reuse the
        // ALREADY-EXISTING `ring-pulse` keyframe above and Tailwind's
        // own built-in `animate-pulse` utility respectively — nothing
        // new needed for those.
        'emblem-scan': {
          to: { transform: 'rotate(360deg)' },
        },

        /**
         * M66.1 — GN-CD-304 §L.1, verbatim. `gnShimmer`, `gnRowNew` and
         * `gnAmber` are pruned per §L.1's own instruction (defined but
         * unreferenced; no visual obligation).
         */
        'cd-pulse': {
          '0%, 100%': { opacity: '.9', transform: 'scale(1)' },
          '50%': { opacity: '.35', transform: 'scale(1.6)' },
        },
        'cd-ring': {
          '0%': { opacity: '.55', transform: 'scale(.6)' },
          '100%': { opacity: '0', transform: 'scale(1.8)' },
        },
        'cd-spin': {
          to: { transform: 'rotate(360deg)' },
        },
        'cd-fade': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'cd-dash': {
          to: { strokeDashoffset: '-200' },
        },
        'cd-urgent': {
          '0%, 100%': { boxShadow: '0 0 0 rgba(248,113,113,0)', borderColor: 'rgba(248,113,113,.34)' },
          '50%': { boxShadow: '0 0 20px rgba(248,113,113,.26)', borderColor: 'rgba(248,113,113,.62)' },
        },
        'cd-breath': {
          '0%, 100%': { boxShadow: '0 0 60px rgba(34,211,238,.18) inset, 0 0 30px rgba(34,211,238,.1)' },
          '50%': { boxShadow: '0 0 84px rgba(34,211,238,.3) inset, 0 0 42px rgba(34,211,238,.18)' },
        },
        'cd-field': {
          '0%, 100%': {
            borderColor: 'rgba(56,189,248,.32)',
            boxShadow: '0 0 30px rgba(37,99,235,.16) inset, 0 0 0 rgba(34,211,238,0)',
          },
          '50%': {
            borderColor: 'rgba(34,211,238,.6)',
            boxShadow: '0 0 34px rgba(37,99,235,.22) inset, 0 0 18px rgba(34,211,238,.18)',
          },
        },
        'cd-caret': {
          '0%, 45%': { opacity: '.9' },
          '55%, 100%': { opacity: '0' },
        },
        'cd-btn': {
          '0%, 100%': { boxShadow: '0 0 16px rgba(37,99,235,.4)' },
          '50%': { boxShadow: '0 0 26px rgba(56,189,248,.55)' },
        },
        'cd-slide': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '12%': { opacity: '.9' },
          '60%': { opacity: '.9' },
          '100%': { transform: 'translateX(220%)', opacity: '0' },
        },
        'cd-row-amber': {
          '0%': { background: 'rgba(251,191,36,.02)', boxShadow: 'inset 2px 0 0 rgba(251,191,36,0)' },
          '3%': { background: 'rgba(251,191,36,.16)', boxShadow: 'inset 2px 0 0 rgba(251,191,36,.95)' },
          '11%': { background: 'rgba(251,191,36,.08)', boxShadow: 'inset 2px 0 0 rgba(251,191,36,.5)' },
          '20%, 100%': { background: 'transparent', boxShadow: 'inset 2px 0 0 rgba(251,191,36,0)' },
        },
        'cd-amber-dot': {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(251,191,36,.55), 0 0 10px rgba(251,191,36,.9)',
            opacity: '1',
          },
          '50%': {
            boxShadow: '0 0 0 5px rgba(251,191,36,.06), 0 0 18px rgba(251,191,36,.7)',
            opacity: '.6',
          },
        },
        'cd-amber-text': {
          '0%, 100%': { textShadow: '0 0 10px rgba(251,191,36,.45)' },
          '50%': { textShadow: '0 0 18px rgba(251,191,36,.8)' },
        },
        'cd-pulse-soft': {
          '0%, 100%': { opacity: '.5' },
          '50%': { opacity: '1' },
        },
        /**
         * Emblem-local keyframes from `Emblem.dc.html`, GN-CD-304 §L.1.
         * Added so the GN-CD-020/200 emblem milestone can adopt the exact
         * released timings in one coherent step. **Nothing consumes these
         * yet, deliberately** — see the deferral recorded in the M66.1
         * implementation report: retiming the emblem today would change
         * its appearance on six routes that have not been designed.
         */
        'cd-emb-ring': {
          '0%': { r: '7', opacity: '.55' },
          '70%': { opacity: '0' },
          '100%': { r: '18', opacity: '0' },
        },
        'cd-emb-core': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.62' },
        },
        'cd-emb-scan': {
          to: { transform: 'rotate(360deg)' },
        },
      },

      animation: {
        // ── EXISTING — UNCHANGED. `ring-pulse` stays at 3.2s. ────────────
        'ring-pulse': 'ring-pulse 3.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
        'fade-slide-in': 'fade-slide-in 0.4s ease-out forwards',
        'fade-slide-out': 'fade-slide-out 0.4s ease-in forwards',
        'emblem-scan': 'emblem-scan 14s linear infinite',

        /**
         * M66.1 — GN-CD-304 §L.2, the fixed assignments, named by the role
         * the specification gives each one. The formula-generated staggers
         * (feed rows, engine connector pulses, map rings) are deliberately
         * NOT tokenised: GN-CD-304 §V requires they be implemented as
         * formulas so the pattern survives list changes.
         */
        'cd-live-dot': 'cd-pulse 1.8s infinite',
        'cd-critical-dot': 'cd-pulse 2.2s infinite',
        'cd-breaking-dot': 'cd-pulse 2.4s ease-in-out infinite',
        'cd-breaking-card': 'cd-urgent 4.4s ease-in-out infinite',
        'cd-topstory-sweep': 'cd-spin 7s linear infinite',
        'cd-topstory-sweep-m': 'cd-spin 8s linear infinite',
        'cd-feed-sweep': 'cd-spin 6.5s linear infinite',
        /*
          M66.14C — WITHOUT THIS ENTRY THE KEYFRAME IS NEVER EMITTED.

          Tailwind writes an @keyframes block only when it generates an
          animation utility that references it. `cd-row-amber` had a keyframes
          definition but no animation entry and no `animate-` class, so the JIT
          had no reason to emit it: the built CSS contained ZERO occurrences of
          cd-row-amber while cd-amber-dot, one line below, was present. The feed
          row named a keyframe that did not exist and the browser silently did
          nothing — which is exactly what browser acceptance saw.

          The delay is deliberately absent here. GN-CD-304 SS-V requires a
          FORMULA stagger, so the per-row 2.1s delay stays an inline
          animation-delay; this entry supplies only name, duration, easing and
          iteration. Tokenising the animation and computing the stagger by
          formula were never in conflict — the earlier arrangement assumed they
          were, and that assumption is what hid the scan.
        */
        'cd-row-amber': 'cd-row-amber 13s ease-out infinite',
        'cd-amber-dot': 'cd-amber-dot 2.6s ease-in-out infinite',
        'cd-amber-text': 'cd-amber-text 3.4s ease-in-out infinite',
        'cd-status-underline': 'cd-slide 7s ease-in-out infinite',
        'cd-ask-field': 'cd-field 5.2s ease-in-out infinite',
        'cd-ai-halo': 'cd-ring 3.8s ease-out infinite',
        'cd-ai-core': 'cd-pulse-soft 3.2s ease-in-out infinite',
        'cd-caret': 'cd-caret 1.25s steps(1, end) infinite',
        'cd-submit': 'cd-btn 4.6s ease-in-out infinite',
        'cd-engine-orbit': 'cd-spin 90s linear infinite',
        'cd-engine-radar': 'cd-spin 34s linear infinite',
        'cd-engine-breath': 'cd-breath 7.5s ease-in-out infinite',
        'cd-engine-dashed': 'cd-spin 44s linear infinite reverse',
        'cd-hub-outer-m': 'cd-spin 70s linear infinite',
        'cd-hub-radar-m': 'cd-spin 28s linear infinite',
        'cd-hud-sweep-hero': 'cd-spin 90s linear infinite',
        'cd-hud-sweep-engine': 'cd-spin 120s linear infinite',
        'cd-hud-sweep-engine-m': 'cd-spin 110s linear infinite',
        'cd-preview-entry': 'cd-fade .2s ease-out',
        'cd-menu-entry': 'cd-fade .18s ease-out',
        'cd-emb-ring': 'cd-emb-ring 4.6s ease-out infinite',
        'cd-emb-core': 'cd-emb-core 3.4s ease-in-out infinite',
        'cd-emb-scan': 'cd-emb-scan 14s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
