/**
 * Master Frontend Recomposition, Checkpoint 1 — the ONE canonical
 * intelligence-module configuration. Both the desktop radial
 * experience and the mobile grid render from this SAME array; no
 * second, independent module list exists anywhere in the codebase.
 *
 * Origin note: `frontend/src/app/workspace/page.tsx` (an older,
 * unlinked internal prototype — not part of the public product,
 * confirmed via NavBar audit to have zero inbound navigation links)
 * contained a `capabilityModules` array with genuinely useful,
 * already-honest status semantics (`Foundation ready` / `In
 * development` / `Planned`). Per CTO decision, that thinking is
 * reused here — mapped onto the approved product vocabulary
 * (`active` / `preview` / `comingSoon`) — but this file is now the
 * SOLE source of truth going forward; workspace/page.tsx's own array
 * is not imported from or kept in sync with this one.
 *
 * CTO's explicit active/preview/comingSoon assignments for the nine
 * MVP modules take precedence over workspace's own status labels —
 * Country Intelligence and Evidence & Source Comparison were already
 * 'Foundation ready' in workspace and remain active here; AI Research
 * Assistant and World Intelligence were 'In development' in
 * workspace, but the CTO's spec explicitly lists both as MVP-active
 * (real, working foundations: Search/Q&A for the former, the
 * homepage feed/allocation pipeline for the latter) — a deliberate,
 * CTO-directed promotion, not an unreviewed upgrade.
 *
 * Every `destination` is a real, existing route, or specifically
 * `undefined` — never a fabricated/placeholder link.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * FINAL-9-MODULE-ENGINE-CONVERGENCE-R1 — THE NINE ARE NOW THE SPECIALIST FAMILY
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Four stale top-level headings left the Engine and four specialist dashboards
 * took their slots, per the Product Owner's §4 mapping:
 *
 *   AI Research Assistant        -> Security Intelligence
 *   Evidence & Source Comparison -> Politics Intelligence
 *   Timeline Intelligence        -> Humanitarian Intelligence
 *   Forecast & Watchlist         -> Energy Intelligence
 *
 * SLOTS, NOT JUST NAMES. Each replacement keeps its predecessor's released ring
 * position, coordinates, colour, opacity and code tile; only the KEY is
 * respelled in `intelligenceEngineGeometry.ts`, and every value there is
 * byte-identical to what Claude Design released. No geometry was redesigned and
 * no card moved.
 *
 * NOT ONE CAPABILITY WAS DELETED, and each slot comment below says where its
 * predecessor's capability still lives. A card is a reader-facing taxonomy
 * entry; removing one removes a heading, not a feature.
 *
 * THE BADGES NOW COME FROM MEASURED PRODUCT STATE, not from the card existing.
 * Only `/map` and the homepage feed anchor are open user surfaces, so only two
 * modules are ACTIVE. Six have an approved surface whose route is prepared but
 * deliberately not opened — PREVIEW. One has no surface at all — COMING SOON.
 * `isModuleNavigable` is unchanged and remains the sole gate, so no preview or
 * coming-soon card can be clicked whatever its badge says.
 *
 * The status vocabulary is the Engine's own (`active` / `preview` /
 * `comingSoon`, rendered from `stateLabels`); §7 forbids inventing a second one
 * and none is invented.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * R2 — ROUTE AND STATE CORRECTION. NO GEOMETRY, NO COPY, NO REDESIGN.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * R1 was accepted structurally and corrected here on one axis only: which cards
 * open, and what each badge claims. Ring positions, coordinates, connectors,
 * colours, code tiles and responsive behaviour are untouched, and
 * `engineGeometry.spec.ts` still reproduces GN-CD-145 row for row.
 *
 * THE ONE SEMANTIC ERROR R1 CARRIED. It equated PREVIEW with inert. R2 §11
 * rules that PREVIEW means *"an approved Alpha surface users may inspect"* and
 * that it MAY be clickable — so a badge describing the DATA was deciding the
 * NAVIGATION, and five real surfaces were unreachable from Home as a result.
 * `isModuleNavigable` is widened below; it is not loosened.
 *
 * WHAT MOVED, AND WHY EACH MOVEMENT IS A MEASUREMENT:
 *
 *   World         ACTIVE  -> COMING SOON, destination removed. Main's canonical
 *                 foundation rules World a SURFACE distinct from Home, Map and
 *                 Country — and R1's destination was Home's own anchor.
 *   Security      + `/security-visual-preview`. Code has deployed it; it is
 *                 present in the converged worktree. The R1 conflict is ruled.
 *   Market        + `/market`.                     verified Alpha surface
 *   Economy       + `/economy-visual-preview`.     `/economy` stays gated
 *   Humanitarian  + `/humanitarian`.               verified Alpha surface
 *   Politics      unchanged, inert. Its routes are ABSENT from the converged
 *                 worktree — measured, see its slot comment.
 *   Conflict      unchanged, inert. No deterministic entry distinct from the
 *                 generic `/map` exists — measured, see its slot comment.
 *   Country       unchanged. `/map` remains the governed Country entry.
 *   Energy        unchanged. No surface of any kind.
 *
 * The totals follow the matrix rather than the other way round: 1 ACTIVE,
 * 6 PREVIEW, 2 COMING SOON — 5 clickable, 4 inert.
 */

export type IntelligenceModuleState = 'active' | 'preview' | 'comingSoon';

export type IntelligenceModuleAccent =
  | 'amber'
  | 'emerald'
  | 'blue'
  | 'violet'
  | 'cyan'
  | 'red'
  | 'purple'
  | 'magenta'
  | 'orange'
  | 'lime';

export interface IntelligenceModuleConfig {
  id: string;
  /** Key into dictionary().intelligenceModules.modules[key] */
  dictionaryKey: string;
  /**
   * M65.1 — the two-letter identifier the approved Claude Design
   * Intelligence Engine shows on every capability panel. Deliberately
   * part of the canonical configuration rather than a lookup table in a
   * component, so a module can never render with someone else's mark,
   * and so uniqueness is testable at the source.
   *
   * NOT localized: these are short product identifiers, in the same
   * class as the module `id` itself, not user-facing prose. The visible
   * title and description remain fully dictionary-driven.
   */
  code: string;
  accent: IntelligenceModuleAccent;
  /** lucide-react icon name, resolved by the renderer — kept as a string here so this config has zero UI-library import surface. */
  icon: 'Search' | 'Globe2' | 'MapPinned' | 'ScanSearch' | 'LineChart' | 'ShieldAlert' | 'TrendingUp' | 'History' | 'Radar';
  state: IntelligenceModuleState;
  /** A real, existing route, or undefined — never a fabricated/placeholder link. */
  destination?: string;
}

export const INTELLIGENCE_MODULES: IntelligenceModuleConfig[] = [
  /*
    ── SLOT 1 · AI RESEARCH ASSISTANT -> SECURITY INTELLIGENCE ──────────────
    FINAL-9-MODULE-ENGINE-CONVERGENCE-R1 §4. The SLOT is preserved: released
    ring position, coordinates, colour and code tile are untouched and move
    with the key rename in `intelligenceEngineGeometry.ts`. Only the identity
    changes.

    AND THE CAPABILITY IS NOT DELETED. §3 and §9: Ask AI / AI Research remains
    the question-specific Analysis experience at `/search`, reachable from the
    global Ask dock, the mobile bottom-nav "Ask AI" tab and the map HUD. What it
    no longer occupies is a specialist-dashboard slot in the nine-card Engine,
    which is a taxonomy fact rather than a removal.

    R2 §2 — THE CONFLICT R1 RAISED IS NOW RULED, AND THE CARD OPENS.

    R1 withheld the destination because MAIN-SECURITY-PARTIX-FINAL-VISUAL-
    AUTHORITY-R1 ruled the preview must carry no home card *"because a card on
    the home surface asserts the product exists."* The Product Owner has now
    ruled that the final-nine instruction supersedes that pre-implementation
    condition, and the premise has changed underneath it besides: Code has
    deployed the preview, and it is present in the converged worktree.

    PREVIEW, NOT ACTIVE. `/security` stays 404 and unactivated. What the card
    now says is that there is something to look at, which is true.
  */
  {
    id: 'security',
    dictionaryKey: 'security',
    code: 'SE',
    accent: 'amber',
    icon: 'Search',
    state: 'preview',
    destination: '/security-visual-preview',
  },
  /*
    ── R2 §1 · WORLD INTELLIGENCE IS A SURFACE, AND IT DOES NOT EXIST YET ───

    `MAIN-WORLD-INTELLIGENCE-CANONICAL-FOUNDATION-R1` rules that World
    Intelligence is a SURFACE, not a specialist domain, and that it is distinct
    from Home/Public Today, from Map and from Country Intelligence.

    That makes R1's arrangement stale rather than wrong-at-the-time. R1 kept the
    released contract — ACTIVE, pointing at `/#global-developments-heading`,
    the homepage feed section the card described — because that anchor was real
    and the capability behind it was live. Under the new ruling the anchor is
    Home, and Home is precisely one of the three things World is NOT.

    So the destination is removed rather than repointed, and the badge follows
    it down. §1 is explicit on both halves: *"Do not remove the World card. Do
    not route it to Home merely to make it clickable."* The card holds its
    released ring position and waits for its own surface.
  */
  {
    id: 'world-intelligence',
    dictionaryKey: 'worldIntelligence',
    code: 'WD',
    accent: 'emerald',
    icon: 'Globe2',
    state: 'comingSoon',
  },
  {
    id: 'country-intelligence',
    dictionaryKey: 'countryIntelligence',
    code: 'CO',
    accent: 'blue',
    icon: 'MapPinned',
    state: 'active',
    destination: '/map',
  },
  /*
    ── SLOT 4 · EVIDENCE & SOURCE COMPARISON -> POLITICS INTELLIGENCE ───────
    §10: removing the card removes no capability. Source comparison,
    provenance, citations, the Sources Dock, the Complete Analysis Record and
    evidence comparison all remain exactly where they are — inside the analysis
    and specialist workspaces that use them. Not one of those files is touched
    by this round.

    R2 §6's MEASUREMENT HAS BEEN ANSWERED, SO THE CARD MOVES — AND ONLY THE CARD.

    §6 recorded a measurement, not a rule: `app/politics-visual-preview`,
    `components/politics` and `lib/politics` were ABSENT from the convergence
    lineage, so the card was left inert and the missing package was named. That
    was the *"if no"* branch, conditional by construction.

    `H-POLITICS-ALPHA-VISUAL-CONVERGENCE-R2` supplies exactly those three trees.
    They are PRESENT here now — landed byte-identically in this commit and
    re-measured on this worktree, not inferred:

      app/politics-visual-preview/page.tsx           PRESENT
      app/politics-visual-preview/compact/page.tsx   PRESENT
      components/politics · lib/politics             PRESENT

    So this is R2 §8's *"two-line change once its package converges"*, taken on
    its own terms and no further.

    THE BADGE DOES NOT MOVE WITH THE DESTINATION. PREVIEW describes the DATA,
    and Politics producer coverage is still 0 of 24 (G-POLITICS-CAP-1). What
    changed is only that the product now has a surface AND names it, which is
    the whole of what `isModuleNavigable` asks.

    THE GATED ROUTE IS NOT THIS ROUTE. `/politics` stays 404 and unactivated —
    asserted against the filesystem by `politicsVisualFrame.spec.ts` §12 — and
    `/politics-visual-preview` is `noindex`. Opening it activates no provider.
    §6's other instruction still binds and is still honoured: this does not
    point at `/search`, which no card does any more.
  */
  {
    id: 'politics',
    dictionaryKey: 'politics',
    code: 'PO',
    accent: 'violet',
    icon: 'ScanSearch',
    state: 'preview',
    destination: '/politics-visual-preview',
  },
  /*
    R2 §4 — the VISUAL preview opens; the gated data route does not.

    `/economy` remains 404 and gated: `shared/src/economy/route-eligibility.ts`
    holds eight conditions and three are unmet, all of them DATA conditions, and
    Main's accepted entry states *"not one of the eight is visual readiness."*
    So the card points at `/economy-visual-preview`, which is what a reader can
    actually inspect, and §4's instruction not to link `/economy` is structural
    here rather than remembered — that route does not exist to link to.
  */
  {
    id: 'economy',
    dictionaryKey: 'economy',
    code: 'EC',
    // M65.1 — realigned to the approved reference, which shows this
    // panel in the same green family as World Intelligence.
    accent: 'emerald',
    icon: 'LineChart',
    state: 'preview',
    destination: '/economy-visual-preview',
  },
  /*
    ── R2 §7 · CONFLICT DISTINCT ENTRY SEAM = PENDING ──────────────────────

    §7 asks whether a DETERMINISTIC entry state opens Conflict rather than
    merely opening the same generic `/map` experience Country already uses.
    MEASURED, in `lib/map/state/mapState.ts`:

      MAP_MODES        WORLD · EVIDENCE · SITUATIONS · WATCH · CHANGE · SOURCES
      LIVE_MAP_MODES   WORLD · EVIDENCE

    There is no CONFLICT mode. `SITUATIONS` is the nearest concept and it is not
    live — the accepted rule is that *"a mode with no data is UNAVAILABLE rather
    than empty."* The accepted D1 Conflict workspace reaches the reader through
    the Spatial map shell, which is behind `NEXT_PUBLIC_MAP_SHELL` and defaults
    OFF. And `/map` without a distinguishing parameter IS the Country entry, so
    pointing Conflict there would give two cards one destination and make the
    distinction the Engine exists to draw invisible.

    So PREVIEW is preserved and the card is left INERT, per §7's own second
    branch. No route is invented to make it clickable.
  */
  {
    id: 'conflict',
    dictionaryKey: 'conflict',
    code: 'CF',
    accent: 'red',
    icon: 'ShieldAlert',
    state: 'preview',
  },
  /*
    ── SLOT 7 · MARKET · COMING SOON -> PREVIEW, AND THE DESTINATION STAYS OFF ─
    §7: the badge must come from actual product state. `/market` and
    `/market/compact` exist and render the accepted Part VII Alpha visual
    frame, so COMING SOON — *"not yet available to inspect"* — is no longer
    true. PREVIEW is.

    R2 §3 — AND THE DESTINATION IS NOW GIVEN. The Product Owner has verified
    `/market` as an Alpha surface and ruled the card clickable.

    `noindex` AND CLICKABLE ARE NOT IN TENSION, which is worth saying once
    because R1 treated them as if they were. `robots` tells a SEARCH ENGINE not
    to list a page; a Home card tells a READER where to look. The route stays
    `noindex` — nothing here changes its metadata — and it now has one honest
    inbound link from a card badged PREVIEW.

    Opening it activates no provider: the Part VII frame is data-neutral and
    issues no external call.
  */
  {
    id: 'market',
    dictionaryKey: 'market',
    code: 'MK',
    accent: 'cyan',
    icon: 'TrendingUp',
    state: 'preview',
    destination: '/market',
  },
  /*
    ── SLOT 8 · TIMELINE INTELLIGENCE -> HUMANITARIAN INTELLIGENCE ──────────
    §3: the timeline capability is not deleted. It remains part of the
    specialist experiences that carry it — the Assessment Timeline in the map's
    Part IV monetization surfaces and the Timeline sub-view in the analysis
    workspace — neither of which is touched here.

    R2 §5 — THE PRODUCT OWNER HAS MADE THAT DECISION, AND THE CARD OPENS.

    R1 withheld the destination on the reasoning that linking a `noindex` route
    from Home would open it, and that opening it was the Product Owner's call
    rather than a card-copy one. It was, and it has been made. `/humanitarian`
    and `/humanitarian/compact` exist, render, and stay `noindex`.

    Provider activation remains separate and is untouched: the Humanitarian
    producer contracts are not modified by this round, and opening the surface
    starts no ingestion.
  */
  {
    id: 'humanitarian',
    dictionaryKey: 'humanitarian',
    code: 'HU',
    // M65.1 — realigned to the approved reference (purple, not fuchsia).
    accent: 'purple',
    icon: 'History',
    state: 'preview',
    destination: '/humanitarian',
  },
  /*
    ── SLOT 9 · FORECAST & WATCHLIST -> ENERGY INTELLIGENCE ─────────────────
    §11: no separate alert system is created by this removal, and none is
    created anywhere in this round. Watch/Follow remains the shared Part IV
    object — `WatchCta`, `WatchComposer`, `Watchboard`, `FollowControl` — and
    not one of those files is touched. Forecast, if it returns, follows its own
    governed semantics and is not the Watch mechanism wearing another name.

    COMING SOON. This is the one module with no surface of any kind: no route,
    no preview, and Claude Design still owns the Energy dashboard. §12 is
    explicit that the card takes its final title and its slot now and stays
    honestly unavailable — and that this convergence is not blocked on Design.
  */
  {
    id: 'energy',
    dictionaryKey: 'energy',
    code: 'EN',
    // M65.1 — realigned to the approved reference (amber, not lime).
    accent: 'amber',
    icon: 'Radar',
    state: 'comingSoon',
  },
];

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE SOLE INTERACTIVITY GATE — WIDENED BY R2, AND NOT LOOSENED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * It read `state === 'active' && Boolean(destination)`. R2 §11 rules the
 * semantics this encoded were wrong, not the mechanism:
 *
 *   ACTIVE      an actual working product surface
 *   PREVIEW     an approved Alpha surface users MAY INSPECT, even though final
 *               data/provider activation is incomplete
 *   COMING SOON no user surface exists yet
 *
 * and, in terms: *"PREVIEW MAY BE CLICKABLE. Do not equate PREVIEW with inert."*
 *
 * A PREVIEW card with a verified route was therefore being made inert by a
 * confusion between "the data is not connected" and "there is nothing to open".
 * Those are different claims, and the badge already tells the reader which one
 * applies.
 *
 * WHAT DID NOT CHANGE, AND IS THE HALF THAT PROTECTS THE READER:
 *
 *   - COMING SOON can never be navigable, whatever a `destination` field says;
 *   - a module with NO destination can never be navigable, whatever its badge
 *     says — which is what keeps Politics and Conflict inert here;
 *   - this remains the ONE check every renderer asks, so nothing can become
 *     clickable by a second route.
 *
 * So the gate now has two independent locks instead of one, and a card is
 * reachable only when the product both has a surface AND names it.
 */
export function isModuleNavigable(module: IntelligenceModuleConfig): boolean {
  if (module.state === 'comingSoon') return false;
  return Boolean(module.destination);
}
