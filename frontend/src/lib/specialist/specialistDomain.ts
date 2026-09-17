/**
 * THE SPECIALIST INTELLIGENCE PLATFORM LAYER — SHARED, NEVER DOMAIN-OWNED.
 *
 *     baseline   C12  2C97F41429B00658D2B2CEBFBC782A61AA18DB455F6CC22BBF6874330B45C6F7
 *     authority  Part V Conflict Intelligence v1.0 R2
 *                  spec    b8425fa996fa5cfc6415df8b938ee4dd5ac118257e5c62d41bd161fce141c1d2
 *                  visual  711443b6e4832ad630ee736059863aa9ded144148a9bd0a49069776f57a93d8c
 *                Shared Specialist Intelligence Addendum v1.0
 *                  71646a05b4055ec547527b22cae68bd2ecc50d054370d0db91b3bd350fdd2ff5
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS DIRECTORY EXISTS, AND WHY IT IS NOT `lib/map/conflict/`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Part V §14 promoted three components to the shared architecture with Conflict
 * as their FIRST CONSUMER, and the Addendum registered Election and Delivery as
 * the second and third. Main's collision review states the build rule in one
 * sentence: the promoted components must be built in SHARED locations with
 * domain content injected — "not under a `conflict/` path to be extracted
 * later."
 *
 * That is not a filing preference. A component written inside a domain folder
 * acquires that domain's assumptions in its prop names, its defaults and its
 * copy, and the extraction never happens because by then three domains depend
 * on the assumptions. Addendum §21 forbids the end state directly: no
 * `CandidateCard`, no `ImihigoKpiStrip`, no `ResultDisputePanel`, and "any
 * domain copy of the three shared components".
 *
 * So nothing in `lib/specialist/` or `components/specialist/` may import from
 * `lib/map/conflict/`, and a guard asserts it. The dependency runs one way:
 * a domain configures the platform, never the reverse.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE EIGHT DECISIONS A DOMAIN MAKES — AND THE NINTH THAT IS A PLATFORM GAP
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Part V §14: object subtypes · domain map layers · queue ranking rule ·
 * indicator set · domain assessment sections · watch scope vocabulary ·
 * metered action list · domain honesty rules. "If a future domain needs a ninth
 * kind of decision, that is a platform gap and belongs in the shared layer."
 *
 * `SpecialistDomainConfig` below is those eight and nothing else.
 */

/**
 * A registered specialist domain.
 *
 * DOMAIN-SCOPED BY CONSTRUCTION. Main's collision review registered a naming
 * risk for exactly this: the platform already holds three distinct meanings of
 * CONTESTED / CONTESTED_MEMBERSHIP / DISPUTED, and a later domain reusing one
 * of those words for its own state would make a fourth. Every state vocabulary
 * in this layer is therefore addressed as `<domainId>:<token>` and no domain
 * may extend a shared enum because a display label happens to overlap.
 */
/**
 * ══ B1 · THE CANONICAL BETA SPECIALIST-DOMAIN VOCABULARY ═══════════════════
 *
 * Six members, ruled by the CTO at Gate B1:
 *
 *   Conflict Intelligence  -> CONFLICT
 *   Kenya Elections        -> ELECTION
 *   Imihigo                -> DELIVERY
 *   Economy Intelligence   -> ECONOMY
 *   Market Intelligence    -> MARKET
 *   Security Intelligence  -> SECURITY
 *
 * ── WHAT THIS ENUM IS NOT, AND WHY THAT MATTERS ──────────────────────────
 *
 * Gate B0 measured THREE separate accepted declarations of "what the domains
 * are", and no two agreed. Their intersection was `CONFLICT` alone:
 *
 *   WatchSurface          MAP · ECONOMY · MARKET · CONFLICT · SECURITY
 *   SpecialistDomainId    CONFLICT · ELECTION · DELIVERY        (before B1)
 *   /workspace roadmap    twelve capability cards
 *
 * THE RULING IS THAT THEY STAY SEPARATE. `WatchSurface` is NOT this enum, and
 * the `/workspace` roadmap is NOT this enum. They are not to be forced into one
 * type for symmetry.
 *
 * The reason is that they answer different questions. This enum answers "which
 * specialist domains exist as intelligence domains". `WatchSurface` answers
 * "which surfaces a watch subject can be scoped to" — which is why it contains
 * `MAP`, a surface and not a domain, and omits ELECTION and DELIVERY. The
 * roadmap answers "what a reader is told is coming". Merging them would force
 * `MAP` into the domain vocabulary or force a Watch surface to exist for every
 * domain, and Watch support remains a capability attached only where separately
 * approved.
 *
 * ── AND A DOMAIN ID IS NOT AN IMPLEMENTATION ─────────────────────────────
 *
 * B0 proved that ELECTION and DELIVERY exist in NEITHER lineage as code. A
 * member here is a reserved identity, not a claim that anything is built.
 */
export type SpecialistDomainId =
  | 'CONFLICT'
  | 'ELECTION'
  | 'DELIVERY'
  | 'ECONOMY'
  | 'MARKET'
  | 'SECURITY';

/**
 * The six, as data.
 *
 * ONE LIST, SO THE TYPE AND THE RUNTIME CANNOT DRIFT. `tokenDomain` below used
 * to re-state the members as a hard-coded triple, which is exactly how a
 * seventh domain gets added to the type and silently fails to parse at
 * runtime. Everything that needs to know the membership reads this.
 */
export const SPECIALIST_DOMAIN_IDS: readonly SpecialistDomainId[] = [
  'CONFLICT',
  'ELECTION',
  'DELIVERY',
  'ECONOMY',
  'MARKET',
  'SECURITY',
];

/** The question kinds a domain claims — Addendum §16. Kinds, never keywords. */
export interface DomainClaim {
  readonly claims: readonly string[];
  readonly doesNotClaim: readonly string[];
  /** Where a claimed question lands the reader. */
  readonly landsOn: string;
}

export interface SpecialistDomainConfig {
  readonly id: SpecialistDomainId;
  /** 1 · the object subtypes this domain interprets. */
  readonly objectSubtypes: readonly string[];
  /** 2 · the map layers this domain needs drawn, by registry id. */
  readonly mapLayers: readonly string[];
  /**
   * 3 · the queue ranking RULE, as a declared description only.
   *
   * C·2: no ranking logic lives inside the UI component, and the panel consumes
   * an upstream ordered result. This field states the rule the upstream service
   * is expected to apply so the contract is legible; it is not executable, and
   * nothing in this layer sorts by it.
   */
  readonly queueRankingRule: string;
  /** 4 · the indicator set — ids only; labels are i18n. */
  readonly indicatorIds: readonly string[];
  /** 5 · the assessment sections this domain adds to the shared card. */
  readonly assessmentSections: readonly string[];
  /** 6 · the watch scope vocabulary — what is watchable here. */
  readonly watchScopes: readonly string[];
  /** 7 · the metered action list. Every one costs; none is invoked implicitly. */
  readonly meteredActions: readonly string[];
  /** 8 · the domain's own honesty rules, stated so they can be cited. */
  readonly honestyRules: readonly string[];
  readonly claim: DomainClaim;
}

/**
 * A domain-scoped state token.
 *
 * `CONFLICT:ACTIVE` is not `DELIVERY:ACTIVE` and neither is a Watch change
 * state. The scoping is in the VALUE, not merely in a comment, so a token that
 * escapes into a shared surface is visibly foreign rather than plausibly native.
 */
export type DomainStateToken = `${SpecialistDomainId}:${string}`;

export function domainToken(domain: SpecialistDomainId, token: string): DomainStateToken {
  return `${domain}:${token}`;
}

export function tokenDomain(token: string): SpecialistDomainId | null {
  const separator = token.indexOf(':');

  /*
    A token with no separator has no domain, and `slice(0, -1)` would otherwise
    lop off the last character and compare the remainder — which is how a
    malformed token becomes a confident wrong answer rather than a null.
  */
  if (separator === -1) return null;

  const head = token.slice(0, separator);

  return (SPECIALIST_DOMAIN_IDS as readonly string[]).includes(head)
    ? (head as SpecialistDomainId)
    : null;
}

/**
 * The registry the shared router reads — Addendum §16.
 *
 * DATA, NOT LOGIC. "Domain-local intent heuristics instead of the shared claim
 * registry" is on the §21 do-not-build list, and capabilities — Evidence,
 * Assessment, Timeline, Sources, Watch, Analysis — are never claimed by a
 * domain; they are invoked by whichever domain owns the answer.
 *
 * Only CONFLICT is registered here. Election and Delivery are DESIGN HOLD: the
 * Addendum is design-final but its implementation is not authorized, and
 * Main's review carries four carry-forwards for them. Registering them now
 * would be routing to surfaces that do not exist.
 */
const REGISTERED: Readonly<Partial<Record<SpecialistDomainId, SpecialistDomainConfig>>> = {};

export function registerSpecialistDomain(config: SpecialistDomainConfig): void {
  (REGISTERED as Record<SpecialistDomainId, SpecialistDomainConfig>)[config.id] = config;
}

export function specialistDomain(id: SpecialistDomainId): SpecialistDomainConfig | null {
  return REGISTERED[id] ?? null;
}

export function registeredDomains(): readonly SpecialistDomainId[] {
  return Object.keys(REGISTERED) as SpecialistDomainId[];
}
