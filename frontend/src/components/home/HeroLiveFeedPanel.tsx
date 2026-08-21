import type { KeyboardEvent } from 'react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import type { LiveStatusKey } from '@/lib/liveStatus';
import { useHeroFocus } from '@/components/home/HeroFocusProvider';

/**
 * M66.3 — HeroLiveFeedPanel. GN-CD-070 → GN-CD-076, the Hero's right region,
 * extracted from Hero.tsx so the released construction is reviewable on its own
 * and so the one part of the Hero that consumes article data is isolated.
 *
 * ── REAL DATA, ZERO NEW FETCH ──────────────────────────────────────────────
 *
 * `articles` is `feed.latestUpdates` from the SINGLE homepage
 * `getHomeFeed(language)` request that page.tsx already makes. This component
 * has no fetch, no client, no effect and no timer. Every visible value —
 * headline, relative age, context label, destination — is a real field of a real
 * NewsArticle. GN-CD-074's eight-row content table is prototype demonstration
 * copy and is not ported.
 *
 * ── WHAT THE DESIGN CLAIMS THAT PRODUCTION CANNOT ─────────────────────────
 *
 * Per CTO decision L-8, none of the following is implemented, because no
 * backend route supplies it and rendering it would be fabrication:
 *
 *   - GN-CD-074's `crit` / red headline treatment. The design identifies its
 *     critical item by a hardcoded prototype article id (`f.a === 'a5'`);
 *     NewsArticle carries no `critical` flag;
 *   - GN-CD-074's row-hover -> map-focus behaviour, which needs a signal-to-
 *     article join that does not exist;
 *   - any source count, evidence scope or geolocation.
 *
 * ── WHERE PRODUCTION IS ALREADY AHEAD OF THE DESIGN, AND STAYS ────────────
 *
 *   - GN-CD-075 leaves loading, empty, error and stale states UNRESOLVED and
 *     asserts "LIVE" unconditionally, which the specification itself flags as a
 *     functional gap. This panel keeps the honest two-branch presentation the
 *     repository already had: real articles, or a truthful source-status panel
 *     that never disappears and never fabricates a headline or a timestamp;
 *   - the attention dot renders only when real articles are present, so the
 *     amber "live" cue is never shown over an unavailable feed;
 *   - GN-CD-074 DEFECT-005 and GN-CD-076 DEFECT-006 report that the rows and the
 *     footer are not keyboard-reachable. Here they are real anchors, so they
 *     always were and still are.
 *
 * ── PRESENTATION NOTES ─────────────────────────────────────────────────────
 *
 * GN-CD-071 / ERRATUM-004: the amber perimeter sweep is a 1100x1100
 * conic-gradient PLANE rotating behind the panel, revealed only through the
 * 1.5px gap left by an inset mask — not a border animation. The mask also
 * carries the panel's inner amber glow, so mask and glow are one element.
 *
 * GN-CD-074's row scan is a formula, not a token: `(i * 2.1)s` on a 13s cycle
 * with a 20% duty, so at most two rows overlap briefly and the panel reads as
 * one row lighting at a time. GN-CD-304 §V requires the stagger stay a formula
 * so the pattern survives a change in list length. It is applied through an
 * inline `style`, which the M66.1 reduced-motion layer in globals.css
 * (`[style*='animation'] { animation: none !important }`) neutralises exactly as
 * GN-CD's own implementation caveat anticipates.
 *
 * GN-CD-070 §U.4: the panel has NO border and NO radius. It is a region of the
 * Hero surface, not a card.
 */

/**
 * GN-CD-073/074 — the released row count. The scroll region shows about five at
 * `max-height:304px`; the rest are reachable by scroll. If the real feed carries
 * fewer, only the real ones render — the list is never padded.
 */
const FEED_PANEL_COUNT = 8;

/*
  M66.14A — SPACE ACTIVATION ON THE PANEL'S REAL ANCHORS.

  Every row and the footer action are already REAL anchors, so Tab reaches
  them natively and Enter activates them natively. This closes the one
  remaining half of the keyboard contract: a native anchor does NOT activate
  on Space — the browser scrolls the page instead — and GN-CD-M66.14 §9
  prescribes Space as an activation key.

  Deliberately a module-level function, not a per-render closure: it reads
  nothing from props or state, so one shared reference serves every row.

  SCOPING, EXACTLY AS AUTHORIZED:
    - attached to the two anchors only, never to document or window, so no
      global key handler exists to interfere with anything else on the page;
    - `event.target !== event.currentTarget` means a key pressed while some
      descendant holds focus is ignored — only the anchor itself activates;
    - `event.repeat` is ignored, so holding Space cannot open a burst of tabs;
    - Enter is never intercepted. It keeps its native behaviour untouched.

  `.click()` on the anchor — rather than a synthesised navigation — is what
  keeps href, target and rel authoritative. Article URLs and navigation
  provenance are unchanged: this adds a second way to press the same link,
  nothing more. Because the call happens inside a trusted key event, the
  target="_blank" open counts as user-activated and is not popup-blocked.

  ' ' is the modern KeyboardEvent.key value; 'Spacebar' is the legacy value
  still emitted by older engines. Both are accepted; neither is guessed.

  NO 'use client' DIRECTIVE IS ADDED, AND THAT IS CORRECT. This module's only
  importer is Hero.tsx, which IS a Client Component, so the panel already
  compiles into the client graph and a DOM handler here is legal. Adding the
  directive would ALSO have worked, but it would have made this file a client
  entry point of its own and broken the standing contract in this file's spec
  that the panel introduces no client boundary — a contract that is still true
  and still worth keeping. The React import is `import type`, so it is erased
  at compile time and adds no runtime import either.

  The residual risk is real and is guarded rather than assumed away: if this
  panel were ever rendered from a Server Component it would fail at runtime,
  which is the exact bug class intelligenceModuleClientBoundary.spec.ts was
  written for. heroInteractionContract.spec.ts now asserts that every importer
  of this file is a Client Component, so that can never happen silently.
*/
/*
  M66.14A — THE VISIBLE KEYBOARD FOCUS TREATMENT.

  Declared once and appended to both anchors so the two surfaces cannot
  drift apart. It reuses the ONE canonical focus colour already in the
  theme — `edge-focus`, rgba(34,211,238,0.70) — which is exactly the value
  GN-CD-M66.14 §9 prescribes. No second focus colour is introduced.

  The offset is NEGATIVE, unlike the +2px used by TrendingCard and the
  carousel controls. That is required, not stylistic: these anchors are
  full-bleed inside a clipped `overflow-hidden` panel, so an outward offset
  would be cropped at the panel edge and the focused row would look
  unfocused. §9 calls for `outline-offset:-2px` for this reason.

  The hover wash is repeated on focus so that focus is at least as visible
  as hover — the equivalence GN-CD-M66.14 §9 requires. `focus-visible`, not
  `focus`, so a pointer click never paints a ring.
*/
const FOCUS_RING =
  ' focus-visible:bg-cd-hud-sky-07 focus-visible:outline focus-visible:outline-1' +
  ' focus-visible:outline-offset-[-2px] focus-visible:outline-cd-edge-focus';

function activateAnchorOnSpace(event: KeyboardEvent<HTMLAnchorElement>): void {
  if (event.key !== ' ' && event.key !== 'Spacebar') return;
  if (event.repeat) return;
  if (event.target !== event.currentTarget) return;
  event.preventDefault();
  event.currentTarget.click();
}

interface HeroLiveFeedPanelProps {
  /** Real HomeFeed articles, already fetched by page.tsx. Never fetched here. */
  articles: NewsArticle[];
  language: LanguageCode;
  /**
   * M66.13 — the AUTHORITATIVE provenance state, resolved once by Hero through
   * resolveLiveStatus() and handed down. This panel does not compute it, does not
   * receive dataMode, and must never re-derive liveness from anything else.
   *
   * THE DEFECT THIS CLOSES. The panel used to receive articles and nothing else,
   * so its heading was a static "Live feed" and its amber cue was gated on
   * `hasArticles`. With MockNewsProvider supplying the feed, the panel announced
   * live reporting over sample content while the DATA STATUS row two rows away
   * truthfully read DEMO MODE — one fetch, two contradictory provenance claims.
   *
   * `articles.length` is a MEASUREMENT of how much came back. It is not evidence
   * of where it came from, and it is never again used as a liveness proxy.
   */
  statusKey: LiveStatusKey;
  /** Breakpoint gating, supplied by Hero so the panel owns no layout decision of its own. */
  className?: string;
}

export function HeroLiveFeedPanel({
  articles,
  language,
  statusKey,
  className = '',
}: HeroLiveFeedPanelProps): JSX.Element {
  /*
    M66.14B — THE CANONICAL FOCUS ACTION.

    setFocusFromArticle is defined ONCE, in the provider, and both handlers
    below call that same function with the same article. Pointer hover and
    keyboard focus therefore cannot diverge: they do not merely both exist,
    they invoke identical work and produce identical state. The action is
    deterministic — the same article always yields a deeply equal focus — which
    is what makes the equivalence real rather than a claim about syntax.

    THERE IS NO onMouseLeave AND NO onBlur, deliberately. The last focus
    persists until another interaction replaces it (GN-CD-M66.14 §7), and
    heroInteractionContract.spec.ts fails the build if either appears here.

    Every row gets a handler, including articles with no resolved country —
    those set a focus whose countryCode is null, which CLEARS the map and card.
    Attaching nothing would leave the previous article's country on screen
    while a different row is highlighted, which is a false geographic claim
    made by silence.
  */
  const { setFocusFromArticle } = useHeroFocus();
  const t = getDictionary(language).hero;
  const status = getDictionary(language).liveStatusStrip;
  /*
    M66.13C — APPLICATION TAXONOMY IS LOCALIZED; ARTICLE CONTENT IS NOT.

    NewsArticle.category is a machine token from the shared NewsCategory
    union ('world', 'technology', ...) — a KEY, not a label. Printing it
    directly put raw English tokens into the Polish homepage.

    The repository already owns exactly one localized taxonomy mapping,
    keyed by that same NewsCategory value, and TrendingCard on this very
    page already reads it. This reuses it rather than adding a second
    mapper. The `map.` prefix is historical (M49, the map filter bar); the
    group is the application-wide category vocabulary, not a map-only one.

    The `?? item.category` fallback means an unmapped category degrades to
    its raw token rather than to a blank chip — visible, never silent.
    homepageLocalization.spec.ts asserts the mapping stays complete over
    the canonical NEWS_CATEGORIES set, so that fallback stays unreachable.

    item.title, item.url and item.publishedAt are provider content and are
    NOT translated here. That boundary is asserted, not merely intended.
  */
  const categoryLabels = getDictionary(language).map.categories;
  const rows = articles.slice(0, FEED_PANEL_COUNT);
  const hasArticles = rows.length > 0;

  /*
    M66.13 — the panel's status line now says what the data actually is.

    `feedPanelHeading` ("Live feed") is kept for the ONE state where it is true.
    Every other state reuses the SAME liveStatusStrip labels the DATA STATUS row
    and the mobile strip already use, so the two surfaces cannot word the same
    fetch differently — there is one provenance vocabulary, not two.

    CTO decision D: this governs the PROVENANCE CLAIM only. The amber sweep, the
    amber rule, the row scan and the panel's whole motion identity are untouched
    and keep running in every state. Only the pulsing status dot and the heading
    assert liveness, so only those two are gated.
  */
  const isLiveFeed = statusKey === 'live';
  const statusHeading =
    statusKey === 'live'
      ? t.feedPanelHeading
      : statusKey === 'cached'
        ? status.cached
        : statusKey === 'mock'
          ? status.mock
          : statusKey === 'unavailable'
            ? status.unavailable
            : statusKey === 'reconnecting'
              ? status.reconnecting
              : status.unknown;

  return (
    <div className={`relative flex-col overflow-hidden bg-cd-fill-feed ${className}`}>
      {/* GN-CD-071 — the masked rotating conic plane. Decorative; see ERRATUM-004. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-cd-feed-sweep absolute left-1/2 top-1/2 -ml-cd-550 -mt-cd-550 h-cd-1100 w-cd-1100 bg-cd-sweep" />
        <div className="shadow-cd-sweep-glow absolute inset-[1.5px] bg-cd-sweep-mask" />
      </div>

      {/* GN-CD-072 — the two-tone header: the section name stays cyan, only the status line goes amber. */}
      <div className="relative border-b border-cd-edge-amber px-cd-16 pb-cd-10 pt-cd-15">
        <span className="block font-cd-mono text-cd-mono-feed uppercase text-cd-ink-label">
          {t.feedPanelEyebrow}
        </span>
        <span className="animate-cd-amber-text mt-cd-6 flex items-center gap-cd-8 font-cd-mono text-cd-mono-panel uppercase text-cd-ink-attention">
          {/* M66.13 — the pulsing cue is a LIVE claim, so it is gated on real live
              status, never on whether any article happens to be present. */}
          {isLiveFeed && (
            <span aria-hidden="true" className="animate-cd-amber-dot h-cd-7 w-cd-7 shrink-0 rounded-full bg-cd-amber" />
          )}
          {statusHeading}
        </span>
      </div>

      {hasArticles ? (
        /* GN-CD-073 — the scroll region. */
        <ul className="relative max-h-cd-304 flex-1 overflow-y-auto overflow-x-hidden">
          {rows.map((item, index) => (
            <li key={item.id}>
              {/*
                GN-CD-074 row geometry over a REAL anchor. The design's rows are
                <div>s with no role, tabIndex or key handler (DEFECT-005); these
                are links, so keyboard users reach every story.
              */}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={() => setFocusFromArticle(item)}
                onFocus={() => setFocusFromArticle(item)}
                onKeyDown={activateAnchorOnSpace}
                className={`animate-cd-row-amber grid grid-cols-[36px_1fr] gap-cd-10 border-b border-cd-edge-divider px-cd-16 py-cd-11 transition-colors hover:bg-cd-hud-sky-07${FOCUS_RING}`}
                style={{ animationDelay: `${(index * 2.1).toFixed(1)}s` }}
              >
                <span className="flex items-center gap-cd-5 pt-cd-2 font-cd-mono text-cd-feed-time text-cd-ink-meta">
                  {formatRelativeTime(item.publishedAt, language)}
                </span>

                <span className="min-w-0">
                  <span className="line-clamp-2 block font-cd-body text-cd-row-head text-cd-ink-primary">
                    {item.title}
                  </span>
                  <span className="mt-cd-3 block truncate font-cd-body text-cd-feed-region text-cd-ink-muted">
                    {categoryLabels[item.category] ?? item.category}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        /*
          GN-CD-075 leaves every non-default state UNRESOLVED. This is the
          repository's own honest answer, preserved verbatim in substance: the
          panel stays present, states plainly that the live feed is unavailable,
          and lists the subsystems that genuinely still work. No headline is
          invented and no timestamp is formatted here.
        */
        <div className="relative flex flex-1 flex-col gap-cd-12 px-cd-16 py-cd-13">
          <div>
            <span className="inline-flex items-center gap-cd-6 font-cd-mono text-cd-mono-preview-cat-m uppercase text-cd-ink-attention">
              <span aria-hidden="true" className="h-cd-6 w-cd-6 rounded-full bg-cd-amber" />
              {t.feedPanelUnavailableHeading}
            </span>
            <p className="mt-cd-6 font-cd-body text-cd-feed-region leading-relaxed text-cd-ink-secondary">
              {t.feedPanelUnavailableBody}
            </p>
          </div>

          <dl className="flex flex-col gap-cd-6 border-t border-cd-edge-divider pt-cd-10">
            {[t.feedPanelSearchStatus, t.feedPanelCountryStatus, t.feedPanelMapStatus].map((label) => (
              <div key={label} className="flex items-center justify-between gap-cd-8">
                <dt className="font-cd-mono text-cd-mono-preview-cat-m uppercase text-cd-ink-muted">{label}</dt>
                <dd className="inline-flex items-center gap-cd-5 font-cd-body text-cd-feed-region text-cd-ink-live">
                  <span aria-hidden="true" className="h-cd-4 w-cd-4 rounded-full bg-cd-live" />
                  {t.feedPanelAvailable}
                </dd>
              </div>
            ))}
          </dl>

          <p className="font-cd-body text-cd-feed-region leading-relaxed text-cd-ink-muted">
            {t.feedPanelUnavailableFooter}
          </p>
        </div>
      )}

      {/* GN-CD-076 — the footer action. A real link, so DEFECT-006 does not exist here either. */}
      <a
        href="/map"
        onKeyDown={activateAnchorOnSpace}
        className={`relative mt-auto flex items-center gap-cd-10 border-t border-cd-edge-amber-rule px-cd-16 py-cd-14 font-cd-mono text-cd-mono-feed-action uppercase text-cd-ink-label transition-colors hover:bg-cd-hud-sky-07${FOCUS_RING}`}
      >
        <span aria-hidden="true" className="h-cd-16 w-cd-16 shrink-0 rounded-full border border-cd-accent-sky" />
        <span className="min-w-0 flex-1 truncate">{t.feedPanelViewMap}</span>
        <span aria-hidden="true">&rarr;</span>
      </a>
    </div>
  );
}
