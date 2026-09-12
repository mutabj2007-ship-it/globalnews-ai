/**
 * WATCH / CHANGE / MONITORING — THE DATA CONTRACT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE IS, AND THE ONE THING IT IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * These are the shapes a Watch surface needs in order to ask "what changed?"
 * and get an answer it can trust. They are declared here, beside `follows.ts`,
 * for the same reason that file gives: a later frontend surface must consume
 * the declarations the backend produces, with no second copy to drift.
 *
 * WHAT IS ABSENT IS THE POINT, AGAIN AND MORE SO THAN IN `follows.ts`:
 *
 *   no userId, no ownerId, no session      Watch identity here is a SUBJECT,
 *                                          not a subscription. Who watches what
 *                                          is an ownership question and
 *                                          ownership is a separate lane.
 *
 *   no tier, no plan, no entitlement       Nothing here gates on payment. A
 *                                          field that would only exist to
 *                                          enforce a plan is not in this file.
 *
 *   no schedule, no cron, no delivery      Nothing here runs itself or emails
 *                                          anybody. `WatchRunMetadata` DESCRIBES
 *                                          a run that something else performed.
 *
 *   no persistence                         There is no row id, no revision, no
 *                                          `updatedAt`. Every derivation in this
 *                                          contract is a pure function of inputs
 *                                          the CALLER supplies.
 *
 * That last one is the load-bearing constraint and it shapes everything below.
 * With no store, "what is new since last time" cannot be answered from server
 * memory, so the contract makes the caller carry its own place in the stream —
 * see `WatchCursor`. That is not a workaround for the missing table. It is the
 * honest shape of the question while no table exists, and it keeps working
 * unchanged once one does.
 */

import type { NewsCategory } from './news';

/* ─────────────────────────── SUBJECT IDENTITY ──────────────────────────── */

/**
 * THE FOUR INTELLIGENCE SURFACES A SUBJECT CAN BE CHOSEN ON.
 *
 * Part IV v1.2 R2 §17: "The language is geography-free. A Watch monitors a
 * SUBJECT; the map is one way of choosing subjects."
 *
 * The surface is carried on the SUBJECT and not on the board, because R2 is
 * explicit that there is ONE WATCHBOARD, NOT FOUR — "a user's watches across
 * all surfaces appear in one list, FILTERABLE BY SURFACE". A board that had to
 * ask each surface for its own watches could not be one list; a subject that
 * knows its own surface makes the single list filterable without asking anyone.
 */
export type WatchSurface = 'MAP' | 'ECONOMY' | 'MARKET' | 'CONFLICT' | 'SECURITY';

/**
 * SECURITY IS A ROUTING NAMESPACE, NOT A SECOND WATCH SYSTEM.
 *
 * Part IX §21 is explicit that "Security defines no alert infrastructure, no
 * notification channel and no delivery rule of its own". Adding the member lets
 * the ONE watchboard filter Security subjects the same way it filters the other
 * four; it grants Security no machinery of its own and none is built.
 *
 * The four existing members and their subject types are unchanged. This is an
 * addition to a union, which cannot alter the meaning of a value that was
 * already in it.
 */

/**
 * WHAT IS BEING WATCHED. Not who is watching it.
 *
 * R2 §17 fixes the categories per surface. This replaces the earlier
 * map-biased `GEOGRAPHY | QUERY | GEOGRAPHY_QUERY`, which could not tell an
 * ACTOR from an INDICATOR: everything non-geographic collapsed into one
 * "query" bucket, so a watchboard "grouped by subject, not by record" had
 * nothing to group by, and the three non-map surfaces had no way to say what
 * kind of thing they were monitoring.
 *
 * ACTOR DELIBERATELY APPEARS ON TWO SURFACES. R2 lists it under both Map and
 * Conflict, and it is one type used twice rather than two types that happen to
 * share a word — the same actor watched from either surface is the same kind of
 * thing. The surface decides which substrate carries the change state, not what
 * the subject IS.
 */
export type WatchSubjectType =
  // Map — R2 §17
  | 'PLACE'
  | 'SITUATION'
  | 'ROUTE'
  | 'ACTOR'
  // Economy
  | 'INDICATOR'
  | 'SECTOR'
  | 'POLICY'
  | 'TRADE_LANE'
  // Market
  | 'INSTRUMENT'
  | 'COMMODITY'
  | 'ISSUER'
  | 'EXPOSURE'
  // Conflict (ACTOR is shared with Map, above)
  | 'FRONT'
  | 'CORRIDOR'
  | 'INCIDENT_CLASS'
  /*
    Security — Part IX object model classes A, G and D.

    SITUATION IS REUSED, NOT REDECLARED. A Security Situation is a situation;
    the surface decides which substrate carries the change state, not what the
    subject IS. This is the same reuse ACTOR already relies on across Map and
    Conflict, and it is why no 'SECURITY_SITUATION' literal is introduced.

    CAMPAIGN and INFRASTRUCTURE_ASSET are new because no member covered them.
    Both name SHARED primitives that Security supplies a facet to — Part IX
    class G puts campaign identity on the shared campaign primitive Politics
    also needs (S-01), and class D rules ONE canonical shared Infrastructure
    Asset identity owned by the platform. Neither is Security-owned.

    COMPOSITE SCOPE IS DELIBERATELY ABSENT. Part IX class I makes it a saved
    composition in shared Watch that "bears no assessment of its own; inherits
    from members". A composition over subjects is not a subject.
  */
  | 'CAMPAIGN'
  | 'INFRASTRUCTURE_ASSET';

/**
 * Which subject types each surface may choose, exactly as R2 §17 tabulates
 * them. Served so a composer builds its type picker from the contract rather
 * than from a second copy of the table.
 */
export const WATCH_SUBJECT_TYPES_BY_SURFACE: Readonly<
  Record<WatchSurface, readonly WatchSubjectType[]>
> = {
  MAP: ['PLACE', 'SITUATION', 'ROUTE', 'ACTOR'],
  ECONOMY: ['INDICATOR', 'SECTOR', 'POLICY', 'TRADE_LANE'],
  MARKET: ['INSTRUMENT', 'COMMODITY', 'ISSUER', 'EXPOSURE'],
  CONFLICT: ['FRONT', 'ACTOR', 'CORRIDOR', 'INCIDENT_CLASS'],
  SECURITY: ['SITUATION', 'CAMPAIGN', 'INFRASTRUCTURE_ASSET'],
};

/*
 * ─── THE CANONICAL ALLOWED-VALUE COLLECTIONS ────────────────────────────────
 *
 * R1. THE HTTP LAYER MUST CONSUME CONTRACT AUTHORITY, NEVER RESTATE IT.
 *
 * `watch.controller.ts` previously carried two hand-written `@IsIn` arrays — one
 * naming four surfaces, one naming fifteen subject types — with a comment saying
 * they were "validated against the closed R2 section 17 list here". They were a
 * SECOND COPY of this table, and the moment this table gained a fifth surface the
 * two disagreed: the shared contract declared SECURITY watchable and the HTTP
 * layer refused it. Nothing failed loudly, because a validator that rejects a
 * value the contract permits looks exactly like a validator working.
 *
 * BOTH COLLECTIONS ARE DERIVED FROM `WATCH_SUBJECT_TYPES_BY_SURFACE` rather than
 * written out again. That is the whole point: a derived list cannot drift from
 * the table it is derived from, so adding a surface or a subject type updates the
 * API's allowlist in the same edit. There is one source of truth and these are
 * views of it.
 */
export const WATCH_SURFACES: readonly WatchSurface[] = Object.keys(
  WATCH_SUBJECT_TYPES_BY_SURFACE,
) as readonly WatchSurface[];

/**
 * Every subject type any surface may choose, de-duplicated.
 *
 * DE-DUPLICATION IS NOT COSMETIC. `ACTOR` belongs to both MAP and CONFLICT, and
 * `SITUATION` to both MAP and SECURITY — one type used twice, not two types that
 * share a word. A validator listing `ACTOR` twice would still work; a reader
 * counting the list would conclude the vocabulary is larger than it is.
 *
 * THIS IS A UNION, NOT A PERMISSION. Passing `@IsIn` means the type EXISTS. It
 * does not mean it belongs to the surface the caller named — `deriveWatchSubject`
 * checks that separately against the surface's own row and refuses with a reason.
 * The two checks answer different questions and neither replaces the other.
 */
export const WATCH_SUBJECT_TYPES: readonly WatchSubjectType[] = Array.from(
  new Set(Object.values(WATCH_SUBJECT_TYPES_BY_SURFACE).flat()),
);

export interface WatchSubject {
  /**
   * Deterministic and content-addressed: the same place and the same
   * normalized query always produce the same id, on any machine, with no
   * counter and no database sequence.
   *
   * WHY THAT MATTERS BEFORE PERSISTENCE EXISTS. Two callers who watch the same
   * thing must agree they are watching the same thing, and a stored row that
   * later carries this id must join to what a client already holds. An
   * auto-increment id would have to be issued by a table that does not exist.
   */
  readonly subjectId: string;
  readonly surface: WatchSurface;
  readonly subjectType: WatchSubjectType;
  /**
   * A `geographyId` from the geo ladder — `region:` `country:` `admin1:`
   * `admin2:` `city:`, or the world root.
   *
   * OPTIONAL ON EVERY SURFACE, INCLUDING MAP. R2 §6.3 makes MONITORED
   * GEOGRAPHY "derived from scope", not the scope itself, so a subject may be
   * anchored to a place, described in words, or both. An INDICATOR usually has
   * no geography; a PLACE always does.
   */
  readonly geographyId?: string;
  /**
   * The subject's textual descriptor, as the shared normalizer produced it.
   * Absent when the subject is fully identified by its geography.
   */
  readonly normalizedQuery?: string;
  /** What a surface shows. Never parsed, never an identifier. */
  readonly label: string;
}

/* ──────────────────────── GEOGRAPHIC SCOPE CHAIN ───────────────────────── */

/**
 * WORLD -> REGION -> COUNTRY -> PROVINCE -> DISTRICT -> SECTOR -> CITY.
 *
 * REGION IS SUPRANATIONAL — above the country, the sense the design
 * specification uses. PROVINCE and DISTRICT are subnational (admin1 and admin2).
 * This is the accepted precision vocabulary and this file does not restate it
 * differently.
 */
export type WatchScopeLevel =
  | 'WORLD'
  | 'REGION'
  | 'COUNTRY'
  | 'PROVINCE'
  | 'DISTRICT'
  /*
   * SECTOR is admin3, between DISTRICT and CITY, and it is here because the
   * alternative was worse. A GeoNodeKind-keyed table in the Watch scope chain
   * has to answer for 'admin3', and the only answer that avoided widening this
   * union was to map a sector to DISTRICT — the exact collapse the SECTOR
   * contract exists to remove, reintroduced in a second vocabulary.
   *
   * Adding the member does not activate anything. Watch remains gated; this
   * says what a sector-scoped watch WOULD be called if Watch were on, which is
   * the same thing every other member of this union says.
   */
  | 'SECTOR'
  | 'CITY';

export interface WatchScopeNode {
  readonly level: WatchScopeLevel;
  readonly geographyId: string;
  readonly name: string;
  /** ISO 3166-1 alpha-3, ISO 3166-2, or a GeoNames admin2 code, where one exists. */
  readonly code?: string;
}

/**
 * A target's place in the ladder, and — just as important — how far the ladder
 * actually goes for it.
 */
export interface WatchScopeChain {
  readonly target: WatchScopeNode;
  /** Ancestors then the target, coarsest first, always beginning at WORLD. */
  readonly chain: readonly WatchScopeNode[];
  /**
   * The finest level this target could be narrowed to WITH REAL DATA.
   *
   * NOT the finest level the vocabulary can express. Rwanda's chain reaches
   * DISTRICT because the gazetteer holds Rwandan admin2 units; Kenya's does not,
   * because it holds none. A surface that offers a district picker where this
   * says COUNTRY would be offering a control backed by nothing.
   */
  readonly deepestSupportedLevel: WatchScopeLevel;
  /**
   * Levels below the target that this product cannot currently express for it,
   * with the reason. Present so a surface can DISABLE a control rather than
   * render one that silently returns nothing.
   */
  readonly unsupportedBelow: readonly {
    readonly level: WatchScopeLevel;
    readonly reason: string;
  }[];
}

/* ─────────────────────── EVIDENCE COUNTS AND STATE ─────────────────────── */

/**
 * WHAT IS THERE RIGHT NOW. A census, not a judgement.
 *
 * `placeable` is the count H's map guard would accept — articles carrying a
 * supported geography claim. It is reported separately from `articles` because
 * the difference between the two is the single most useful diagnostic a Watch
 * surface has: 12 articles and 0 placeable is a geography problem, 0 articles is
 * a retrieval problem, and one number cannot say which.
 */
export interface WatchEvidenceCounts {
  readonly articles: number;
  readonly distinctPublishers: number;
  readonly placeable: number;
  readonly byCategory: Readonly<Partial<Record<NewsCategory, number>>>;
}

/**
 * ONE OBSERVATION OF ONE SUBJECT, AT ONE MOMENT.
 *
 * `storyKeys` is what makes change detection possible without a store: stable,
 * content-derived identities for the stories seen. Two snapshots plus their key
 * sets are enough to say what arrived, with no row anywhere.
 */
export interface WatchEvidenceSnapshot {
  readonly subjectId: string;
  /** ISO-8601. When this observation was made — never when anything was published. */
  readonly observedAt: string;
  readonly counts: WatchEvidenceCounts;
  readonly storyKeys: readonly string[];
  /**
   * The newest timestamp in the set, and WHAT KIND OF TIME IT IS.
   *
   * `basis` travels with it for the reason `NewsArticle.publishedAtBasis`
   * exists: an aggregator's observation time is an UPPER BOUND on publication,
   * not publication, and 'unproven' is a third answer rather than a missing one.
   */
  readonly highWaterMark: {
    readonly at: string | null;
    readonly basis: 'publisher' | 'observed' | 'unproven' | 'none';
  };
  /** Provider ids that contributed. Empty means nothing answered. */
  readonly providers: readonly string[];
}

/**
 * WHAT CHANGED — and the two states that exist so it never has to guess.
 *
 * `NO_BASELINE` is NOT `NO_CHANGE`. A first observation has nothing to compare
 * against, and reporting "no change" for it would be a claim about a
 * comparison that never happened. This is the single most important member of
 * this union.
 *
 * `UNDETERMINED` is the second. When evidence cannot be classified as new or
 * old — see `WatchDelta.undeterminedCount` — the state says so rather than
 * defaulting to either.
 */
export type WatchDerivationState =
  /** No previous observation was supplied. Nothing is claimed. */
  | 'NO_BASELINE'
  /** Compared, and the story set is unchanged. */
  | 'NO_CHANGE'
  /** Stories present now that were absent before. */
  | 'NEW_EVIDENCE'
  /** More independent publishers than before, with no new stories. */
  | 'CORROBORATION_INCREASED'
  /** Fewer stories than before — ageing out of the window, not retraction. */
  | 'EVIDENCE_RECEDED'
  /** Nothing answered. Distinct from 'nothing was found'. */
  | 'EVIDENCE_UNAVAILABLE'
  /** Compared, but the comparison could not be trusted. See `reasons`. */
  | 'UNDETERMINED';

/**
 * THE PRESENTATION VOCABULARY — Part IV v1.2 R2 §7, VERBATIM AND CLOSED.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A SECOND TYPE AND NOT A REPLACEMENT FOR THE FIRST
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * These seven and the seven above answer different questions.
 *
 *   `WatchDerivationState` answers WHAT CAN BE PROVEN — whether a comparison
 *   happened at all, whether anything answered, whether novelty could be
 *   established. Its members exist because those failures must not be
 *   indistinguishable from findings.
 *
 *   `WatchChangeState` answers WHAT THE USER IS SHOWN — ring form, decay,
 *   whether an alert fires. R2 calls it "closed to extension" precisely so the
 *   four surfaces share one vocabulary; that is what makes ONE WATCHBOARD
 *   possible.
 *
 * Collapsing them would have deleted the distinctions R2 §6.4.4 itself depends
 * on: "NO MATERIAL CHANGE is displayed as a RESULT, never as absence… This line
 * is what the user is paying for." A backend that cannot tell "we looked and
 * nothing changed" from "we could not look" cannot honour that sentence.
 *
 * DO NOT EXTEND THIS UNION. R2: "the seven states are fixed here and closed to
 * extension."
 */
export type WatchChangeState =
  | 'NEW'
  | 'NEW_EVIDENCE'
  | 'SIGNIFICANT_CHANGE'
  | 'DEVELOPING'
  | 'DISPUTED'
  | 'STABLE'
  | 'NO_MATERIAL_CHANGE';

/** The seven, in R2's own order, for a consumer that needs the closed set. */
export const WATCH_CHANGE_STATES: readonly WatchChangeState[] = [
  'NEW',
  'NEW_EVIDENCE',
  'SIGNIFICANT_CHANGE',
  'DEVELOPING',
  'DISPUTED',
  'STABLE',
  'NO_MATERIAL_CHANGE',
];

/**
 * THE SUBSET THIS BACKEND CAN HONESTLY PRODUCE TODAY.
 *
 * Served, and asserted by test, so a surface knows which of the seven will
 * never arrive rather than waiting for states that cannot be derived. The other
 * four each need a capability that does not exist:
 *
 *   NEW                 needs to know a mark is new to the PRODUCT, not to this
 *                       caller — run history, so persistence.
 *   SIGNIFICANT_CHANGE  R2 gives it a ring, an alert and a chip but NO MAGNITUDE
 *                       THRESHOLD anywhere in the document. Not derivable until
 *                       a rule exists.
 *   DEVELOPING          "held; alerts on resolve or escalation" — needs at least
 *                       two prior runs.
 *   DISPUTED            needs assessment-level detection that sources disagree
 *                       ABOUT WHAT CHANGED. That is Analysis-lane capability.
 *   STABLE              R2 shows it with a duration; a duration needs history.
 */
export const WATCH_CHANGE_STATES_DERIVABLE_TODAY: readonly WatchChangeState[] = [
  'NEW_EVIDENCE',
  'NO_MATERIAL_CHANGE',
];

/**
 * The result of mapping a derivation state to the presentation vocabulary.
 *
 * `state` is NULL when nothing may honestly be shown. That is not a gap to be
 * filled later with a default — it is the mapping refusing to assert a change
 * state it cannot support, the same rule R2 §7 applies to geometry: "Marks with
 * UNKNOWN precision receive no change ring — there is nowhere honest to put
 * it." `reason` always explains which it was.
 */
export interface WatchChangeStateMapping {
  readonly state: WatchChangeState | null;
  readonly derivedFrom: WatchDerivationState;
  readonly reason: string;
}

/**
 * The comparison of two snapshots.
 *
 * PURE. Given the same two snapshots it returns the same delta, on any machine,
 * at any time, with no store and no clock read.
 */
export interface WatchDelta {
  readonly subjectId: string;
  /** What could be PROVEN about the comparison. Always present. */
  readonly state: WatchDerivationState;
  /**
   * What may be SHOWN, or null when nothing honestly may be. Never inferred by
   * a consumer from `state` — the mapping is part of the contract so two
   * surfaces cannot read the same delta differently.
   */
  readonly changeState: WatchChangeStateMapping;
  /** Null exactly when `state` is 'NO_BASELINE'. */
  readonly previousObservedAt: string | null;
  readonly currentObservedAt: string;
  /** Story keys present now and absent from the baseline. */
  readonly newStoryKeys: readonly string[];
  readonly newCount: number;
  /** Keys present in the baseline and absent now. Ageing out, not retraction. */
  readonly recededCount: number;
  /**
   * Stories whose novelty could NOT be established.
   *
   * This is non-zero when a story carries no usable identity, or when a
   * timestamp-based comparison would have to trust a `publishedAt` whose basis
   * is unproven. Counted rather than silently assigned to 'new' or 'old'.
   */
  readonly undeterminedCount: number;
  readonly counts: {
    readonly previous: WatchEvidenceCounts | null;
    readonly current: WatchEvidenceCounts;
  };
  /** Human-readable, machine-stable statements of WHY this state was chosen. */
  readonly reasons: readonly string[];
}

/* ──────────────────────── NEW SINCE LAST VISIT ─────────────────────────── */

/**
 * THE CALLER'S PLACE IN THE STREAM.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A CURSOR AND NOT A `lastVisitedAt` COLUMN
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * With no persistence lane, the server cannot remember when this caller last
 * looked. The obvious fallback — compare `publishedAt` to a wall-clock instant —
 * is wrong for a reason that outlives the missing table: publication timestamps
 * are not reliable ordering keys. An aggregator's `observed` time is an upper
 * bound; an absent basis is unproven; two articles routinely share a timestamp.
 *
 * So the cursor carries THREE things, and the third is what makes it correct:
 * a high-water mark, its basis, and the story keys seen AT that mark. The
 * boundary set disambiguates ties instead of guessing at them, which is
 * ordinary keyset pagination applied to an untrustworthy sort key.
 *
 * It is bounded on purpose: `seenStoryKeys` holds only the keys at the boundary,
 * not the caller's entire history, so it stays a few hundred bytes rather than
 * growing forever.
 *
 * THIS SHAPE DOES NOT CHANGE WHEN PERSISTENCE ARRIVES. A stored cursor is the
 * same object with a row around it.
 */
export interface WatchCursor {
  readonly subjectId: string;
  /** When the caller last observed. Advisory; never the comparison key. */
  readonly observedAt: string;
  /** The newest article time the caller has already seen, and its basis. */
  readonly highWaterMark: {
    readonly at: string | null;
    readonly basis: 'publisher' | 'observed' | 'unproven' | 'none';
  };
  /** Story keys already seen AT the high-water mark. Ties, not history. */
  readonly seenStoryKeys: readonly string[];
}

/** Bound on `seenStoryKeys`, so a cursor cannot grow without limit. */
export const WATCH_CURSOR_MAX_BOUNDARY_KEYS = 200;

/* ────────────────────────── RUN / RESULT METADATA ──────────────────────── */

/**
 * `COMPLETED_EMPTY` IS NOT `FAILED`, and the distinction is the point.
 *
 * A provider that answered honestly with nothing is a working system reporting
 * an empty world. A provider that did not answer is a broken pipe. Collapsing
 * them is how "no news about X" becomes indistinguishable from "we could not
 * look", which is the failure this whole evidence model exists to prevent.
 */
export type WatchRunOutcome =
  | 'COMPLETED'
  | 'COMPLETED_EMPTY'
  | 'PARTIAL_PROVIDER_FAILURE'
  | 'FAILED';

/**
 * A RUN-RECORD FIELD R2 REQUIRES THAT THIS BACKEND CANNOT PRODUCE.
 *
 * The absence is expressed, with its reason, rather than the field being
 * omitted or filled with a placeholder. An omitted field looks like an
 * oversight; a zero, an empty string or a made-up percentage looks like data.
 * Neither is true, and a surface needs to be able to say "not available yet"
 * for the right reason.
 */
export interface WatchRunRecordGap {
  readonly field: 'lastMaterialChangeAt' | 'confidence' | 'cadence';
  readonly reason: string;
  readonly blockedBy: WatchUnavailableCapability;
}

export interface WatchRunMetadata {
  /** Identifies THIS run. Supplied by whatever performed it. */
  readonly runId: string;
  readonly subjectId: string;
  readonly startedAt: string;
  /** R2 §6.3 "last checked". The one run-record field that is fully available. */
  readonly completedAt: string;
  readonly durationMs: number;
  readonly outcome: WatchRunOutcome;
  /** Providers that were asked. */
  readonly providersAttempted: readonly string[];
  /** Providers that answered. A subset; the difference is the failure set. */
  readonly providersAnswered: readonly string[];
  readonly failures: readonly {
    readonly providerId: string;
    readonly kind: string;
    readonly message: string;
  }[];
  /**
   * R2 §6.4.3: "If a provider feeding a Watch is delayed, the run record says so
   * BEFORE THE USER ASKS — reusing the approved provider-status pattern."
   *
   * Carried verbatim from `EvidenceProviderStatus`; this contract does not
   * define a second provider vocabulary. Absent when no status was supplied,
   * which is not the same as "healthy".
   */
  readonly providerStatus?: string;
  /** Per-provider status, so one delayed feed among several can be named. */
  readonly providerDelays?: readonly {
    readonly providerId: string;
    readonly status: string;
  }[];

  /*
   * ────────────────────────────────────────────────────────────────────────
   * THE THREE R2 RUN-RECORD FIELDS THIS BACKEND CANNOT HONESTLY FILL.
   *
   * Typed `null` rather than optional, so a producer must consciously state
   * the absence and cannot leave it looking unset. Each is explained in
   * `gaps`, and a test asserts every null carries an entry there.
   * ────────────────────────────────────────────────────────────────────────
   */

  /** R2 §6.3. Needs run history. Always null today. */
  readonly lastMaterialChangeAt: string | null;
  /** R2 §6.3. No source for a confidence value is defined anywhere in R2. */
  readonly confidence: number | null;
  /** R2 §6.4.1: "Cadence is stated, never implied." Needs a scheduler. */
  readonly cadence: string | null;
  /** One entry for every field above that is null, with why. */
  readonly gaps: readonly WatchRunRecordGap[];
}

/* ─────────────────── PROVIDER AND FRESHNESS, AS WATCH SEES IT ──────────── */

/**
 * WATCH DOES NOT DEFINE ITS OWN PROVIDER OR FRESHNESS VOCABULARY.
 *
 * `EvidenceProviderStatus`, `FreshnessDescriptor` and `CoverageBand` already
 * exist and are already served. Restating them here would create a second
 * vocabulary that drifts from the first, which is the exact defect the evidence
 * amendment was written to avoid. This descriptor CARRIES those values; it does
 * not redefine them.
 */
export interface WatchStatusDescriptor {
  readonly subjectId: string;
  /** Verbatim from the evidence contract's `EvidenceProviderStatus`. */
  readonly providerStatus: string;
  /** Verbatim from the evidence contract's `CoverageBand`. */
  readonly coverageBand: string;
  /**
   * Verbatim from `FreshnessDescriptor`. `verb` is 'published' | 'seen' |
   * 'none', and 'none' means the timestamp's basis is unproven — neither
   * "Published" nor "Seen" may be shown.
   */
  readonly freshness: {
    readonly verb: string;
    readonly at: string | null;
  };
  /**
   * TRUE only when this subject can be monitored end to end today. When false,
   * `blockedBy` names what is missing, so a surface can explain rather than
   * present a control that quietly does nothing.
   */
  readonly monitorable: boolean;
  readonly blockedBy: readonly string[];
}

/* ──────────────────── WHAT THIS PRODUCT CANNOT YET DO ──────────────────── */

/**
 * Capabilities a Watch surface will need that DO NOT EXIST in the backend today.
 *
 * Served, not just documented, so a surface reads the list rather than
 * discovering the gaps one disabled button at a time — and so this contract
 * cannot quietly imply a capability it does not have.
 */
export type WatchUnavailableCapability =
  | 'SUBJECT_PERSISTENCE'
  /** No magnitude rule exists for SIGNIFICANT_CHANGE anywhere in R2. */
  | 'CHANGE_MAGNITUDE_THRESHOLD'
  /** DISPUTED needs assessment-level source-disagreement detection. */
  | 'DISPUTE_DETECTION'
  /** DEVELOPING, STABLE duration and NEW all need prior runs. */
  | 'CHANGE_HISTORY'
  | 'PER_USER_OWNERSHIP'
  | 'SCHEDULED_EXECUTION'
  | 'RUN_HISTORY'
  | 'NOTIFICATION_DELIVERY'
  | 'ENTITLEMENT_ENFORCEMENT'
  | 'TEAM_WORKSPACES';

export interface WatchCapabilityReport {
  /** Derivations that work today, as pure functions over caller-supplied input. */
  readonly available: readonly string[];
  readonly unavailable: readonly {
    readonly capability: WatchUnavailableCapability;
    readonly reason: string;
    /** The lane that owns it. Never this one. */
    readonly ownedBy: string;
  }[];
}
