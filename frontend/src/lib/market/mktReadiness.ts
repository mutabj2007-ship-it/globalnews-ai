/**
 * PART VII · MARKET — READINESS DERIVED FROM THE CONTRACT, NOT ASSERTED BY THIS FILE.
 *
 * THE DESIGN DECISION THAT MATTERS MOST HERE. A Market page could be made honest by my
 * writing "no price data" into it. That honesty would last exactly until someone edited
 * the sentence. Instead every readiness statement below is COMPUTED from the MR-0
 * contract's own exported constants, so the page cannot drift from the platform: if a
 * producer ever appears and `MARKET_RUNTIME_ENABLED_SUBJECTS` stops being empty, this
 * surface stops claiming nothing is enabled — without anyone editing a string.
 *
 * NOTHING IS INVENTED. There is no `entityRef`, no GLEIF identity, no observation shape,
 * no provider contract and no new Market vocabulary in this file. It imports the contract
 * and reads it.
 */
import {
  ECONOMY_FIGURE_GAP_REASONS,
  EQUITY_OR_INDEX_SOURCE_QUALIFIED,
  GLEIF_DIRECT_PARENT_WITH_LEI_SHARE,
  GLEIF_SUPPLIES_SECTOR_CODE,
  MARKET_CHANGE_STATES_PRODUCIBLE_TODAY,
  MARKET_CHANGE_STATE_PRODUCER_GAPS,
  MARKET_CORRIDOR_CAPABILITY,
  MARKET_DECLARES_NO_SCORER,
  MARKET_RUNTIME_ENABLED_SUBJECTS,
  MARKET_SUBJECT_DISPOSITIONS,
  PRODUCIBLE_ROUTE_GEOMETRY,
  PROCUREMENT_REFERENCE_KINDS,
  PROCUREMENT_REFERENCE_KINDS_PRODUCIBLE_TODAY,
  PROCUREMENT_TO_COMPANY_JOIN,
  WATCH_CHANGE_STATES,
  type MarketFigureGapReason,
  type MarketSubjectName,
} from '@globalnews-ai/shared';

/** Why a Market surface cannot show a value. Never a value. */
export type MktAbsence =
  | 'NO_QUALIFIED_SOURCE'
  | 'NO_ACTIVE_PROVIDER'
  | 'NOT_RUNTIME_ENABLED'
  | 'NO_DETERMINISTIC_JOIN'
  | 'NO_ROUTE_GEOMETRY'
  | 'AWAITING_SHARED_CONTRACT'
  | 'STATE_NOT_DERIVABLE'
  | 'NO_VINTAGE_PUBLISHED';

export interface SubjectReadiness {
  readonly subject: MarketSubjectName;
  readonly disposition: string;
  /** From the contract's own list. Empty today, and read rather than hardcoded. */
  readonly runtimeEnabled: boolean;
  readonly absence: MktAbsence;
}

/**
 * Every subject Part VII names, with its contract disposition and whether the platform
 * can actually serve it. `runtimeEnabled` is a lookup into the contract's own array.
 */
export const SUBJECT_READINESS: readonly SubjectReadiness[] =
  (Object.keys(MARKET_SUBJECT_DISPOSITIONS) as MarketSubjectName[]).map((subject) => {
    const runtimeEnabled = MARKET_RUNTIME_ENABLED_SUBJECTS.includes(subject);
    const absence: MktAbsence =
      subject === 'INSTRUMENT' && !EQUITY_OR_INDEX_SOURCE_QUALIFIED ? 'NO_QUALIFIED_SOURCE'
        : subject === 'CORRIDOR' && !PRODUCIBLE_ROUTE_GEOMETRY ? 'NO_ROUTE_GEOMETRY'
          : subject === 'COMMERCIAL_ENTITY' && PROCUREMENT_TO_COMPANY_JOIN === 'NO_DETERMINISTIC_JOIN' ? 'NO_DETERMINISTIC_JOIN'
            : subject === 'PROCUREMENT_OPPORTUNITY' ? 'AWAITING_SHARED_CONTRACT'
              : 'NOT_RUNTIME_ENABLED';
    return { subject, disposition: MARKET_SUBJECT_DISPOSITIONS[subject], runtimeEnabled, absence };
  });

/** The change-state ceiling, computed as a difference rather than restated. */
export const CHANGE_STATES_NOT_DERIVABLE: readonly string[] =
  WATCH_CHANGE_STATES.filter((s) => !MARKET_CHANGE_STATES_PRODUCIBLE_TODAY.includes(s));

export const CHANGE_STATE_GAPS = MARKET_CHANGE_STATE_PRODUCER_GAPS;

/**
 * The measured facts a reader is entitled to see on a surface that shows no figures.
 * Each is a CONSTANT FROM THE CONTRACT rendered as a fact, not a claim this file makes.
 */
export interface DataReadinessFact {
  readonly id: string;
  readonly ready: boolean;
  readonly measured: string;
}

export const DATA_READINESS: readonly DataReadinessFact[] = [
  { id: 'equityOrIndex', ready: EQUITY_OR_INDEX_SOURCE_QUALIFIED,
    measured: `EQUITY_OR_INDEX_SOURCE_QUALIFIED = ${String(EQUITY_OR_INDEX_SOURCE_QUALIFIED)}` },
  { id: 'runtimeSubjects', ready: MARKET_RUNTIME_ENABLED_SUBJECTS.length > 0,
    measured: `MARKET_RUNTIME_ENABLED_SUBJECTS = [${MARKET_RUNTIME_ENABLED_SUBJECTS.join(', ')}] (${MARKET_RUNTIME_ENABLED_SUBJECTS.length})` },
  { id: 'routeGeometry', ready: PRODUCIBLE_ROUTE_GEOMETRY,
    measured: `PRODUCIBLE_ROUTE_GEOMETRY = ${String(PRODUCIBLE_ROUTE_GEOMETRY)} · capability ${MARKET_CORRIDOR_CAPABILITY}` },
  { id: 'procurementCompanyJoin', ready: PROCUREMENT_TO_COMPANY_JOIN !== 'NO_DETERMINISTIC_JOIN',
    measured: `PROCUREMENT_TO_COMPANY_JOIN = ${PROCUREMENT_TO_COMPANY_JOIN}` },
  { id: 'gleifSector', ready: GLEIF_SUPPLIES_SECTOR_CODE,
    measured: `GLEIF_SUPPLIES_SECTOR_CODE = ${String(GLEIF_SUPPLIES_SECTOR_CODE)}` },
  { id: 'gleifParent', ready: false,
    measured: `GLEIF_DIRECT_PARENT_WITH_LEI_SHARE = ${GLEIF_DIRECT_PARENT_WITH_LEI_SHARE}` },
  { id: 'procurementRefKinds', ready: PROCUREMENT_REFERENCE_KINDS_PRODUCIBLE_TODAY.length === PROCUREMENT_REFERENCE_KINDS.length,
    measured: `${PROCUREMENT_REFERENCE_KINDS_PRODUCIBLE_TODAY.length} of ${PROCUREMENT_REFERENCE_KINDS.length} reference kinds have a producer` },
  { id: 'changeStates', ready: CHANGE_STATES_NOT_DERIVABLE.length === 0,
    measured: `${MARKET_CHANGE_STATES_PRODUCIBLE_TODAY.length} of ${WATCH_CHANGE_STATES.length} change states are derivable` },
];

/* ------------------------------------------------------------------ *
 * OBSERVATION TRUTH — WHAT THIS FLAG IS ALLOWED TO BE DERIVED FROM
 * ------------------------------------------------------------------ */

/**
 * THE DEFECT, AND WHY THE OBVIOUS FIX IS ALSO WRONG.
 *
 * This was:
 *
 *     export const MARKET_HAS_ANY_OBSERVATION = DATA_READINESS.some((f) => f.ready);
 *
 * with a comment above it reading "true only when EVERY readiness fact is ready". The
 * comment and the code disagreed, and the code renders the banner OBSERVATIONS CONNECTED.
 * It is correct today only by accident: all eight constants happen to be false. One flip
 * of the cheapest of them — `GLEIF_SUPPLIES_SECTOR_CODE`, a sector-code lookup — and a
 * Market surface announces that it has observations, having received none.
 *
 * CHANGING `.some` TO `.every` DOES NOT FIX IT. It would make the flag false today and
 * still leave it wrong, because NONE OF THE EIGHT INPUTS IS AN OBSERVATION. They are
 * readiness facts: whether a source qualifies, whether a subject is runtime-enabled,
 * whether a join is deterministic. A platform that is ready to observe has not observed
 * anything. Readiness is a fact about capability; an observation is a fact about the
 * world, and no amount of the first adds up to one of the second.
 *
 * So the derivation cone is changed rather than the operator. The flag now reads ONLY
 * from an observation channel, and `DATA_READINESS` is not in its cone at all — a guard
 * asserts that by flipping every readiness fact and re-deriving.
 *
 * WHY THE CHANNEL IS EMPTY AND SAYS SO. There is no activated Market observation producer
 * in this deployment, and there is no shared observation contract to type one against:
 * `shared/src/observation` does not exist in canonical — the structured-observation spine
 * is a proposal on HOLD, not an accepted contract. Nothing is invented here to stand in
 * for it. The producer is `null`, the reason is named, and OBSERVATIONS CONNECTED is
 * unreachable — not merely unreached.
 */

/**
 * The minimum an observation record must carry to be one: a subject it is about, an
 * identity, and the vintage it was published at. Declared locally and deliberately NOT
 * exported as a shared type — this lane does not get to define the platform's observation
 * shape, and when the shared spine is accepted this is replaced by it, not merged with it.
 */
interface MktObservationRecord {
  readonly subject: MarketSubjectName;
  readonly observationId: string;
  /*
    F T-M4 — every record in the held set carries a VALUE, a UNIT, a PERIOD and a PUBLISHED
    VINTAGE. These are required, not optional: a record missing any of them is not something
    this surface could display, so admitting it would make the flag mean something weaker
    than the badge claims. `NO_VINTAGE_PUBLISHED` exists in this domain precisely because
    "a fetch time is not a vintage", and a `vintage?:` here would have re-opened that.
  */
  readonly value: string;
  readonly unit: string;
  readonly period: string;
  readonly publishedVintage: string;
  /* F T-M5 — a fixture never enters the held set, and the boundary can see which it is. */
  readonly origin: 'PROVIDER';
  /* The licence must permit DISPLAY, not merely retrieval. */
  readonly displayPermitted: true;
}

/** What supplies observation records. Measured: none is activated in this deployment. */
interface MktObservationProducer {
  readonly name: string;
  readonly records: () => readonly MktObservationRecord[];
}

/**
 * No provider activation happens in this lane, and none has happened anywhere: this is
 * the measured state of the deployment, not a placeholder awaiting a value.
 *
 * It is a function rather than a `const null` for one reason worth stating: as a const,
 * TypeScript narrows the type to `null` and the activated branch below becomes `never`,
 * which is a compile error. That error is a fair summary of the truth — the connected
 * banner is unreachable — but it would have been silenced by deleting the branch, and a
 * derivation with no activated arm is not a derivation. The seam stays; the measurement
 * returns null.
 */
function activatedObservationProducer(): MktObservationProducer | null {
  return null;
}

const MARKET_OBSERVATION_PRODUCER: MktObservationProducer | null = activatedObservationProducer();

/** Why the channel is empty. Named, so the emptiness is a stated result and not a blank. */
export const MARKET_OBSERVATION_ABSENCE: MktAbsence = 'NO_ACTIVE_PROVIDER';

/** The observation channel. Records, or nothing — never a readiness flag. */
export const MARKET_OBSERVATION_RECORDS: readonly MktObservationRecord[] =
  MARKET_OBSERVATION_PRODUCER === null ? [] : MARKET_OBSERVATION_PRODUCER.records();

/**
 * The derivation, as a function over observation records, so a guard can exercise it with
 * inputs instead of only reading the constant it produced. Its parameter type is the
 * whole argument: a readiness fact is not an observation record and cannot be passed.
 */
export function hasAnyObservation(records: readonly MktObservationRecord[]): boolean {
  return records.length > 0;
}

/**
 * Derived from observation records and from nothing else. `DATA_READINESS` does not
 * appear in this expression, and a guard proves it cannot influence the result by
 * flipping the cheapest readiness constant and re-deriving.
 */
export const MARKET_HAS_ANY_OBSERVATION: boolean = hasAnyObservation(MARKET_OBSERVATION_RECORDS);

/** The measurement behind the flag, rendered beside it rather than trusted. */
export const MARKET_OBSERVATION_BASIS =
  `MARKET_OBSERVATION_RECORDS.length = ${MARKET_OBSERVATION_RECORDS.length} · ` +
  `producer = ${MARKET_OBSERVATION_PRODUCER === null ? 'none activated' : 'activated'}`;

/**
 * The contract forbids a scorer, and this re-exports that so a guard can assert the
 * surface honours it. C-15: "AI SIMILARITY ALONE IS NOT SUFFICIENT AUTHORITY TO MERGE
 * PROCUREMENT RECORDS" — there is no score, rank or similarity anywhere in this domain.
 */
export const MARKET_SURFACE_DECLARES_NO_SCORER = MARKET_DECLARES_NO_SCORER;

/* ------------------------------------------------------------------ *
 * WHY A FIGURE IS ABSENT — SELECTED FROM THE CONTRACT'S OWN VOCABULARY
 * ------------------------------------------------------------------ */

/**
 * MARKET DOES NOT DEFINE A GAP VOCABULARY. It aliases Economy's, in one line:
 *
 *   shared/src/market/index.ts:128
 *   export type MarketFigureGapReason = EconomyFigureGapReason;
 *
 * That single line is load-bearing for this surface, and it decides something this file
 * would otherwise have had to invent. Every approved Economy gap label already exists in
 * all seven locales, so a Market figure gap has APPROVED COPY TODAY — nothing needed
 * authoring here, and nothing should be authored here.
 *
 * WHICH REASON IS TRUE IS NOT A STYLING CHOICE. The four reasons are not four ways of
 * saying "nothing to show"; they are four different claims, and three of them are claims
 * about somebody else:
 *
 *   NOT_COLLECTED   the PUBLISHER does not collect it
 *   WITHHELD        the PUBLISHER collected it and did not release it
 *   DISCONTINUED    the SERIES was discontinued
 *   NO_PRODUCER     THIS DEPLOYMENT has no producer — "a fact about us, not about the publisher"
 *
 * This deployment has no wired Market producer. It therefore has no standing to say
 * anything about a publisher's collection or release behaviour, and rendering
 * NOT_COLLECTED here would assert something false about a named publisher in seven
 * languages. So the selection below is made by WHOSE FACT EACH REASON IS, and the one
 * reason that is a fact about us is the one that survives.
 */
type GapReasonSubject = 'PUBLISHER' | 'SERIES' | 'DEPLOYMENT';

/** Whose fact each reason states, read from the contract's own doc comments. */
const GAP_REASON_SUBJECT: Readonly<Record<MarketFigureGapReason, GapReasonSubject>> = {
  NOT_COLLECTED: 'PUBLISHER',
  WITHHELD: 'PUBLISHER',
  DISCONTINUED: 'SERIES',
  NO_PRODUCER: 'DEPLOYMENT',
};

/** The reasons this deployment is entitled to assert with no publisher relationship. */
const ASSERTABLE_WITHOUT_A_PUBLISHER: readonly MarketFigureGapReason[] =
  ECONOMY_FIGURE_GAP_REASONS.filter((r) => GAP_REASON_SUBJECT[r] === 'DEPLOYMENT');

/**
 * The gap reason this surface renders, or `null` when there are observations and a
 * blanket reason would itself be a guess. Selected, not written: if the contract ever
 * adds a second deployment-fact reason this becomes ambiguous and returns `null` rather
 * than quietly picking the first — an unresolved vocabulary is a reason to say nothing.
 */
export const MARKET_FIGURE_GAP_REASON: MarketFigureGapReason | null =
  MARKET_HAS_ANY_OBSERVATION || ASSERTABLE_WITHOUT_A_PUBLISHER.length !== 1
    ? null
    : ASSERTABLE_WITHOUT_A_PUBLISHER[0];

/** The measurement that justifies the selection, rendered beside it rather than trusted. */
export const MARKET_FIGURE_GAP_BASIS =
  `MARKET_HAS_ANY_OBSERVATION = ${String(MARKET_HAS_ANY_OBSERVATION)} · ` +
  `${ASSERTABLE_WITHOUT_A_PUBLISHER.length} of ${ECONOMY_FIGURE_GAP_REASONS.length} reasons ` +
  'are facts about this deployment';
