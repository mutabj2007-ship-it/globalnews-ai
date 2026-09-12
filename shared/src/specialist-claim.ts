/**
 * SPECIALIST CLAIM BOUNDARY — THE CONTRACT.
 *
 * The executable form of Shared Specialist Addendum v1.0 R1 §16 "Domain claim and
 * routing table". The Addendum is Design authority
 * (sha256 50b4b882576e76722eb57044de80289a5559b64dc0b6832ba838605902b90acd); this file is the
 * only place its four columns become types.
 *
 * WHY THIS LIVES IN `shared/` AND NOT IN A MODULE.
 * §16 describes the table as data a shared router reads — not logic inside Support and not logic
 * inside any specialist surface. Everything here is pure: no Nest, no DI, no I/O, no clock, no
 * model call. That is what makes routing rule 7 ("routing is deterministic and costs no user AI")
 * enforceable by construction rather than by discipline. The frontend needs the same `landsOn`
 * vocabulary to open the right rail, so a backend-only home would force a second definition of the
 * same table — the duplication §14 forbids.
 *
 * WHAT IS DELIBERATELY ABSENT.
 * There is no mapping from a user's words to a `QuestionKind`. §16: "a domain claims question
 * kinds, not keywords." Intent classification is a separate contract and it is not Support's;
 * putting it here would make the platform a classifier and would let Support classify domain
 * membership, which routing rule 5 forbids.
 *
 * GEOGRAPHY AND TIME ARE OPAQUE ON PURPOSE.
 * Routing rule 1 says geography and the time window are resolved FIRST, through the canonical
 * navigator, and then handed on. They are therefore carried through this boundary as unconstrained
 * type parameters: the resolver cannot inspect them, cannot re-resolve them, and cannot depend on
 * their shape. The precondition is the caller's; the pass-through is proven by the types.
 */

/**
 * A registered specialist domain id — an OPEN branded string, not a closed union.
 *
 * §16 reserves slots for domains that do not exist yet (ECONOMY, MARKET, ENERGY, SECURITY,
 * HUMANITARIAN). A closed union would make registering a reserved domain an edit to the platform,
 * which is the opposite of what §16 intends. The brand still prevents an arbitrary string being
 * passed where a domain id is required.
 *
 * THE NAME IS DELIBERATELY NOT `SpecialistDomainId`. H's accepted frontend package defines a
 * `SpecialistDomainId` of its own — a CLOSED presentation-layer union
 * ('CONFLICT' | 'ELECTION' | 'DELIVERY') in frontend/src/lib/specialist/specialistDomain.ts, inside
 * authoritative C15. Those are different concepts at different layers: what the platform will
 * accept as a registration, versus what the frontend currently knows how to render. By CTO ruling
 * the platform identifier carries the distinct name and H's file is left untouched.
 */
export type RegisteredSpecialistDomainId = string & {
  readonly __brand: 'RegisteredSpecialistDomainId';
};

/**
 * A canonical question kind — a SYMBOLIC id, never user text.
 *
 * THE CANONICAL VOCABULARY IS PLATFORM-OWNED (CTO ruling). The type and its only constructor live
 * here, in the platform's shared contract. A domain does not define what a kind IS; it registers
 * OWNERSHIP of kinds through the platform registry, which is the single place a kind acquires an
 * owner. Support owns nothing here and consumes outcomes.
 *
 * The format rule below is not cosmetic: it makes "claims question kinds, not keywords"
 * structural. A sentence, a search phrase or a lowercase fragment cannot become a kind.
 *
 * NO CANONICAL KIND IS DECLARED IN THIS PACKAGE. Inventing a vocabulary would be fabricating
 * design; the register is empty until a domain registers one, and `canonicalKinds()` says so.
 */
export type QuestionKind = string & { readonly __brand: 'QuestionKind' };

/** Uppercase symbolic identifier: `A-Z`, digits and `_`, starting with a letter. */
export const SPECIALIST_SYMBOL_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/** 64 lowercase hex characters. */
export const SPECIALIST_SHA256_PATTERN = /^[0-9a-f]{64}$/;

function assertSymbol(kindOfThing: string, value: string): void {
  if (!SPECIALIST_SYMBOL_PATTERN.test(value)) {
    throw new Error(
      `SPECIALIST CLAIM: ${kindOfThing} "${value}" is not a symbolic id. ` +
        `A ${kindOfThing} must match ${String(SPECIALIST_SYMBOL_PATTERN)} — kinds are claimed, not keywords.`,
    );
  }
}

export function registeredSpecialistDomainId(value: string): RegisteredSpecialistDomainId {
  assertSymbol('domain id', value);
  return value as RegisteredSpecialistDomainId;
}

export function questionKind(value: string): QuestionKind {
  assertSymbol('question kind', value);
  return value as QuestionKind;
}

/** §16 column: LANDS THE USER ON. */
export interface SpecialistLanding {
  /** The rail the winning domain opens. */
  readonly railId: string;
  /** The object type the rail opens on. */
  readonly objectType: string;
}

/**
 * One row of §16, owned by the domain it describes — never by the platform and never by Support.
 */
export interface SpecialistClaimDefinition {
  /** §16 column: DOMAIN. */
  readonly domainId: RegisteredSpecialistDomainId;
  /** The design document this registration is made against, e.g. 'Part V Conflict Intelligence v1.0 R2'. */
  readonly authorityRef: string;
  /**
   * The sha256 of that document. Not a §16 column — added because this program has repeatedly been
   * saved by a package citing its authority by hash rather than by filename. A registration whose
   * authority is not recognised is refused, which is how a stale domain definition is caught.
   */
  readonly authoritySha256: string;
  /** §16 column: CLAIMS QUESTIONS OF THE KIND. */
  readonly claimedKinds: readonly QuestionKind[];
  /**
   * §16 column: DOES NOT CLAIM. Enforced, not decorative — a domain can never be selected for a
   * kind it disclaims, even if a later edit also adds that kind to `claimedKinds`.
   */
  readonly refusedKinds: readonly QuestionKind[];
  /** §16 column: LANDS THE USER ON. */
  readonly landsOn: SpecialistLanding;
  /** Routing rule 3 tiebreak input: the object types this domain owns. */
  readonly ownsObjectTypes: readonly string[];
}

/**
 * What the caller asks the boundary.
 *
 * `G` and `T` are the caller's already-resolved geography and time-window types. The boundary
 * never inspects them; it only carries them into the handoff.
 */
export interface SpecialistClaimRequest<G = unknown, T = unknown> {
  /** May be empty. The boundary does not derive kinds from text. */
  readonly candidateKinds: readonly QuestionKind[];
  /** Routing rule 3: the object the question is about, if the caller resolved one. */
  readonly objectType?: string;
  /** Routing rule 1: resolved BEFORE this call. Opaque here. */
  readonly geography?: G;
  /** Routing rule 1: resolved BEFORE this call. Opaque here. */
  readonly timeWindow?: T;
  /**
   * Domains whose target cannot be opened right now, mapped to the stated reason.
   * Registered-but-unavailable is a different fact from unregistered, and the two must never
   * collapse into each other.
   */
  readonly unavailability?: Readonly<Record<string, string>>;
}

/** §16: "The router passes the resolved object, geography, scope and time window." */
export interface SpecialistHandoff<G = unknown, T = unknown> {
  readonly objectType?: string;
  readonly geography?: G;
  readonly timeWindow?: T;
}

/**
 * Five outcomes, never a boolean. Each of the platform's behavioural questions maps to exactly one
 * of them, and none of them is a guess.
 */
export type SpecialistClaimOutcome<G = unknown, T = unknown> =
  | {
      readonly status: 'CLAIMED';
      readonly domainId: RegisteredSpecialistDomainId;
      /** The kinds this domain actually won on — always a non-empty subset of the request. */
      readonly matchedKinds: readonly QuestionKind[];
      readonly landsOn: SpecialistLanding;
      readonly handoff: SpecialistHandoff<G, T>;
    }
  | {
      readonly status: 'CLAIMED_UNAVAILABLE';
      readonly domainId: RegisteredSpecialistDomainId;
      readonly reason: string;
    }
  | {
      readonly status: 'EQUAL_CLAIM';
      readonly domainIds: readonly RegisteredSpecialistDomainId[];
    }
  | { readonly status: 'UNCLAIMED' }
  | { readonly status: 'NO_DOMAINS_REGISTERED' };

/**
 * THE RESOLVER. Pure: same inputs, same output, no clock, no I/O, no model call.
 *
 * Order is §16's order, with no step skipped:
 *
 *   0  no definitions at all                  → NO_DOMAINS_REGISTERED   (never UNCLAIMED)
 *   1  effective kinds = claimed ∩ requested \ refused, per domain
 *   2  no domain has any effective kind        → UNCLAIMED
 *   3  exactly one domain                      → CLAIMED (or CLAIMED_UNAVAILABLE)
 *   4  more than one → rule 3 tiebreak on the object type
 *   5  still tied                              → EQUAL_CLAIM, naming every tied domain
 *
 * Rule 2 ("exactly one domain may claim a kind") is enforced at REGISTRATION, so more than one
 * candidate can only mean the request carried kinds belonging to different domains. Breaking a
 * genuine tie here would be the guess routing rule 6 forbids.
 */
export function resolveSpecialistClaim<G = unknown, T = unknown>(
  definitions: readonly SpecialistClaimDefinition[],
  request: SpecialistClaimRequest<G, T>,
): SpecialistClaimOutcome<G, T> {
  if (definitions.length === 0) {
    return { status: 'NO_DOMAINS_REGISTERED' };
  }

  const requested = new Set<string>(request.candidateKinds);

  const candidates = definitions
    .map((definition) => {
      const refused = new Set<string>(definition.refusedKinds);
      const matchedKinds = definition.claimedKinds.filter(
        (kind) => requested.has(kind) && !refused.has(kind),
      );
      return { definition, matchedKinds };
    })
    .filter((candidate) => candidate.matchedKinds.length > 0);

  if (candidates.length === 0) {
    return { status: 'UNCLAIMED' };
  }

  let contenders = candidates;

  if (contenders.length > 1 && request.objectType !== undefined) {
    // Routing rule 3: the domain that owns the object the question is about wins — "not the domain
    // that owns the mood of the question." If nobody owns it, the tie stands; narrowing to zero
    // would silently convert a tie into UNCLAIMED.
    const owners = contenders.filter((candidate) =>
      candidate.definition.ownsObjectTypes.includes(request.objectType as string),
    );
    if (owners.length > 0) {
      contenders = owners;
    }
  }

  if (contenders.length > 1) {
    return {
      status: 'EQUAL_CLAIM',
      domainIds: contenders
        .map((candidate) => candidate.definition.domainId)
        .slice()
        .sort() as readonly RegisteredSpecialistDomainId[],
    };
  }

  const winner = contenders[0];
  const reason = request.unavailability?.[winner.definition.domainId];
  if (reason !== undefined) {
    return {
      status: 'CLAIMED_UNAVAILABLE',
      domainId: winner.definition.domainId,
      reason,
    };
  }

  return {
    status: 'CLAIMED',
    domainId: winner.definition.domainId,
    matchedKinds: winner.matchedKinds,
    landsOn: winner.definition.landsOn,
    handoff: {
      objectType: request.objectType,
      geography: request.geography,
      timeWindow: request.timeWindow,
    },
  };
}
