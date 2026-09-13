/**
 * PART IV — THE WATCH MODEL, AND THE HONESTY IT ENFORCES.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT A WATCH IS, IN THE SPECIFICATION'S OWN TERMS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * FOLLOW is "keep this in my feed" — free, forever, a filter on what already
 * exists. WATCH is "continuously assess this and tell me when it materially
 * changes" — a standing assignment with scope, topics, sensitivity, cadence and
 * a visible run record.
 *
 * They are separated on four axes — verb, hue, fill treatment, and the presence
 * of a run record — and must never render as two variants of one control. This
 * module models only the second; `FollowControl` already owns the first and is
 * untouched.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONE THING THIS FILE EXISTS TO PREVENT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NO WATCH BACKEND EXISTS. There is no persistence, no scheduler, no alert
 * delivery, no entitlement service and no payment path. A composer that let a
 * user assemble a monitoring assignment and press a confident button would be
 * promising labour nobody can perform.
 *
 * So the capability is a TYPED, EXPLICIT VALUE rather than an assumption: every
 * surface reads `watchCapability()` and renders what is actually true. When the
 * backend lands, this one function changes and the surfaces stop being previews
 * without any of them learning a new vocabulary.
 *
 * Nothing here fabricates a subscription, an entitlement, a payment outcome, an
 * alert, a persisted history or an organisation. NO COMMERCIAL FIGURE APPEARS IN
 * THIS MODULE AT ALL — R2 requires entitlement values to be read from
 * configuration, so they live in `entitlement.ts` and are absent rather than
 * defaulted when none is configured.
 */

/* ════════════════════════════════════════════════════════════════════════════
   1 · SUBJECTS AND CHAINS
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * The subject kinds §6.2 names. Only `PLACE` is producible today — the map is
 * the only surface that can currently name a subject — and the rest are
 * declared so the composer's type does not have to change when they arrive.
 */
export type WatchSubjectKind =
  | 'PLACE'
  | 'SITUATION'
  | 'ISSUE'
  | 'ACTOR'
  | 'ROUTE'
  | 'ANALYSIS_RESULT';

export interface WatchSubject {
  /** G's opaque geography id where the subject is a place. Never parsed. */
  readonly id: string;
  readonly kind: WatchSubjectKind;
  readonly label: string;
  /**
   * THE SUBJECT'S OWN CEILING, AND WHY IT IS PER-LINK.
   *
   * §6.2: "Each link retains its own geographic ceiling from the approved
   * precision contract. A Watch never claims a precision its subjects do not
   * have; the Rwanda leg does not inherit Mombasa's city-level confidence."
   *
   * A chain-level ceiling would be exactly that inheritance, so there is not
   * one — the ceiling lives here, on the link, and the composer renders it per
   * row.
   *
   * ── THE LADDER IS NOT COUNTRY → DISTRICT → CITY, AND MUST NOT BE TYPED SO ──
   *
   * `string`, DELIBERATELY, and not the four-member `GeoPrecision` union this
   * field used to carry. G's navigator is being extended with Rwanda's
   * District → Sector and Kenya's County → Constituency → Ward, and a closed
   * union would reject "SECTOR" and "WARD" at the type level — the frontend
   * would have to be edited every time the world gained a rung, which is
   * exactly the coupling the canonical navigator exists to remove.
   *
   * So the level arrives from the navigator and is RENDERED AS SUPPLIED. This
   * module neither maps it, nor orders it, nor assumes what is beneath it.
   */
  readonly ceiling: string;
  /**
   * The reader-facing name of that level, in their language, as the navigator
   * supplies it — "Sector", "Ward", "Constituency".
   *
   * Optional because the ceiling code is a usable fallback and inventing a
   * label for an unknown rung would be worse than showing the code: a wrong
   * name for a level is a claim about how a country is administered.
   */
  readonly ceilingLabel?: string;
  /** Published by the navigator. Used by the licence gate; never parsed from the id. */
  readonly countryIso3?: string;
}

/**
 * The chain IS the user's causal hypothesis, monitored as one assignment:
 *
 *     Mombasa -> Kenya fuel infrastructure -> Rwanda supply implications
 *     (CITY)     (COUNTRY)                    (COUNTRY)
 *
 * Ordered, because the order is the argument.
 */
export type WatchChain = readonly WatchSubject[];

/* ════════════════════════════════════════════════════════════════════════════
   2 · SENSITIVITY
   ════════════════════════════════════════════════════════════════════════════ */

export type WatchSensitivity =
  | 'CRITICAL_ONLY'
  | 'MATERIAL_ONLY'
  | 'ALL_MEANINGFUL'
  | 'CUSTOM_THRESHOLD';

export const WATCH_SENSITIVITIES: readonly WatchSensitivity[] = [
  'CRITICAL_ONLY',
  'MATERIAL_ONLY',
  'ALL_MEANINGFUL',
  'CUSTOM_THRESHOLD',
];

/** §8.1 default. Stated here so no surface picks its own. */
export const DEFAULT_SENSITIVITY: WatchSensitivity = 'MATERIAL_ONLY';

/** CUSTOM_THRESHOLD is Institutional — ghosted with an INST mark for others. */
export const INSTITUTIONAL_SENSITIVITIES: readonly WatchSensitivity[] = ['CUSTOM_THRESHOLD'];

/* ════════════════════════════════════════════════════════════════════════════
   3 · TIERS — NAMED, BUT NEVER QUANTIFIED HERE
   ════════════════════════════════════════════════════════════════════════════ */

export type Tier = 'FREE' | 'PROFESSIONAL' | 'INSTITUTIONAL';

/*
  ── `PLACEHOLDER_TIER_LIMITS` LIVED HERE AND HAS BEEN DELETED ───────────────

  It carried FREE: 1 watch / 2 chain links / 7 days, PROFESSIONAL: 25 / 5 /
  full, INSTITUTIONAL: unlimited — labelled as illustrative placeholders.

  R2 closes that door: "Implementations must read entitlement values from
  configuration and NEVER HARD-CODE THEM", and its open-decisions list keeps
  every one of those figures unresolved, including the free-tier one-Watch
  question which is "proposed... NOT YET CTO-APPROVED".

  Labelling a number a placeholder is not the same as not hard-coding it. The
  values were still in the bundle and still on screen, and a caveat beneath a
  figure is how a placeholder quietly becomes a commitment. So the table is gone
  rather than annotated, and `lib/map/monetization/entitlement.ts` reads the
  values from configuration — returning `null`, honestly, when there is none.

  The TIER NAMES stay, because they are vocabulary rather than economics: a PRO
  mark on a ghosted control says which boundary was met without claiming what it
  costs or what it includes.
*/

/* ════════════════════════════════════════════════════════════════════════════
   4 · CAPABILITY — THE HONESTY GATE
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Why a Watch cannot be activated right now.
 *
 * `BACKEND_ABSENT` is the current truth and is deliberately not spelled as an
 * error: the composer works, the assignment is real, and the only missing piece
 * is the ACTIVATION AND ENTITLEMENT CONTRACT that would let an assignment be
 * kept and run. The name is historical; read it as "activation contract not
 * configured", not as a claim that GlobalNewsAI has no monitoring capability.
 */
export type WatchBlockReason = 'SIGNED_OUT' | 'BACKEND_ABSENT';

export interface WatchCapability {
  /** Composing is free and complete — §6.3 — and is true even signed out. */
  readonly canCompose: true;
  /** Activation requires an activation/entitlement contract that is not configured. */
  readonly canActivate: false;
  readonly blockedBy: WatchBlockReason;
  /**
   * The tier the account actually holds. `null` means UNKNOWN — no entitlement
   * configuration is present (`entitlementConfig()` returns null), and guessing
   * FREE would be inventing an entitlement.
   */
  readonly tier: Tier | null;
}

/**
 * THE SINGLE PLACE THE PRODUCT SAYS WHAT IT CAN DO.
 *
 * One function, read by every monetization surface. When a watch service and an
 * entitlement service exist, this returns different values and the surfaces
 * follow — no surface hard-codes "not yet", and none of them will need to learn
 * a new shape.
 *
 * `canActivate` is typed as the literal `false`. That is not pessimism: it means
 * a surface CANNOT compile a branch that activates a Watch today, so an
 * optimistic success state cannot be written by accident.
 */
export function watchCapability(signedIn: boolean): WatchCapability {
  return {
    canCompose: true,
    canActivate: false,
    blockedBy: signedIn ? 'BACKEND_ABSENT' : 'SIGNED_OUT',
    tier: null,
  };
}

/* ════════════════════════════════════════════════════════════════════════════
   5 · THE ASSIGNMENT SENTENCE
   ════════════════════════════════════════════════════════════════════════════ */

export interface AssignmentSentenceParts {
  readonly subjects: readonly string[];
  readonly cadence: string;
}

/**
 * §12.4: "The sentence IS the specification. Implementation must not paraphrase
 * it into feature language."
 *
 *   "GlobalNewsAI will assess Mombasa, Kenya fuel infrastructure and Rwanda
 *    supply implications every 15 minutes, and tell you when the assessment
 *    materially changes."
 *
 * It describes LABOUR. It contains no reference to articles, reading, access or
 * limits, and this function cannot introduce one: it receives the subject names
 * and a cadence and joins them into the approved frame, which the dictionaries
 * carry per language so the shape survives translation.
 *
 * The Oxford-free "A, B and C" join is the specification's own.
 */
export function assignmentSubjectList(subjects: readonly string[], and: string): string {
  if (subjects.length === 0) return '';
  if (subjects.length === 1) return subjects[0];

  return `${subjects.slice(0, -1).join(', ')} ${and} ${subjects[subjects.length - 1]}`;
}

/* ════════════════════════════════════════════════════════════════════════════
   6 · THE RUN RECORD
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * §6.4.2: "LAST CHECKED is visible wherever the mint ring is visible. A Watch
 * that cannot report when it last ran renders DEGRADED, not confident."
 *
 * Every field is nullable and `null` renders as an honest dash rather than a
 * zero or a guess — a Watch that has never run has not run zero times, it has
 * no record, and the two must not look the same.
 */
export interface WatchRunRecord {
  readonly lastCheckedIso: string | null;
  readonly lastMaterialChangeIso: string | null;
  readonly evidenceCount: number | null;
  readonly evidenceDelta: number | null;
  readonly cadenceLabel: string | null;
  /** §6.4.3 — a delayed provider is stated before the user asks. */
  readonly providerDelayed: boolean;
}

/** A Watch with no record at all — the only state this build can produce. */
export const NO_RUN_RECORD: WatchRunRecord = {
  lastCheckedIso: null,
  lastMaterialChangeIso: null,
  evidenceCount: null,
  evidenceDelta: null,
  cadenceLabel: null,
  providerDelayed: false,
};

/**
 * A run record is DEGRADED when it cannot say when it last ran. §6.4.2 requires
 * that to render differently from a confident one, so the test is here rather
 * than repeated as a truthy check on each surface.
 */
export function runRecordIsDegraded(record: WatchRunRecord): boolean {
  return record.lastCheckedIso === null;
}
