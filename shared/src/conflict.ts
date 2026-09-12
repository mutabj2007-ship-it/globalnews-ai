/**
 * CONFLICT — THE SHAREABLE DOMAIN SURFACE.
 *
 *     authority  Part V Conflict Intelligence v1.0 R2
 *                Shared Specialist Addendum v1.0
 *                MAIN-CONFLICT-RUNTIME-CONTRACT R3 + Addendum A1
 *     moved by   MAIN-CONFLICT-D4, from frontend/src/lib/map/conflict/conflictDomain.ts
 *
 * ── WHY THESE SYMBOLS AND NOT THE OTHERS ──────────────────────────────────
 *
 * The test applied to every symbol was: would the BACKEND need it to PRODUCE a
 * correct assessment, or only to RENDER one? Producers moved; renderers stayed.
 *
 * So `SEVERITY_TREATMENT` is NOT here — it is a map from severity to CSS
 * classes, and the backend must never learn what a severity looks like.
 * Neither are `severityMayUseRed`, `copyIsPermitted` or `CONFLICT_DOMAIN`.
 * They remain in the frontend, which is where a rendering decision belongs.
 */

/**
 * Part V §02: active / contained / negotiated / dormant.
 *
 * DOMAIN-SCOPED. The platform already carries three distinct meanings of
 * CONTESTED / CONTESTED_MEMBERSHIP / DISPUTED; a bare `ACTIVE` would be a
 * fourth collision waiting for the first domain whose label overlaps.
 */
export const CONFLICT_STATES = ['ACTIVE', 'CONTAINED', 'NEGOTIATED', 'DORMANT'] as const;
export type ConflictState = (typeof CONFLICT_STATES)[number];

/**
 * THE WIRE TOKEN, AT ITS EXACT SHAPE.
 *
 * The frontend's `DomainStateToken` is `${SpecialistDomainId}:${string}` — a
 * template-literal type, not a brand. This is a NARROWING of it, and it is
 * deliberately not weakened to `string`: the wire value is exactly one of four
 * strings, and a type that says so rejects `CONFLICT:ACITVE` at compile time
 * rather than at a reviewer's eye.
 *
 * Measured before narrowing: `ConflictExtension` and `conflictState` had ZERO
 * references outside the originating module, so nothing existed that could be
 * broken by making the type precise.
 */
export type ConflictStateToken = `CONFLICT:${ConflictState}`;

/**
 * Part V §02's conflict extension surface, complete.
 *
 * Every field is optional because THE BACKEND DOES NOT SUPPLY ANY OF THEM YET.
 * Modelling them as required and filling them with defaults is how mock data
 * becomes production data by accident; modelling them as absent makes the
 * absent state the one the surfaces are written against.
 */
export interface ConflictExtension {
  readonly conflictState?: ConflictStateToken;
  readonly participants?: readonly string[];
  readonly incidents?: readonly string[];
  /** Area of concentrated activity. PRECISION-BOUNDED — never a border. */
  readonly frontGeometry?: { readonly precision: string; readonly interpreted: boolean };
  readonly escalationIndicators?: readonly string[];
  /** Per-claim figures with source and range. NEVER averaged — §24. */
  readonly humanConsequence?: readonly string[];
  readonly infrastructureExposure?: readonly string[];
  readonly cessationState?: string;
  readonly spilloverLinks?: readonly string[];
}

/**
 * SEVERITY — C·1, ratified product-wide. The VALUE is shared; its typographic
 * treatment is not, and stays in the frontend.
 */
export const CONFLICT_SEVERITIES = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as const;
export type ConflictSeverity = (typeof CONFLICT_SEVERITIES)[number];

/**
 * §06 — THE COMPLETE PERMITTED SET OF SEVEN OBSERVED INDICATORS.
 *
 * "Each derived from counted evidence · zero user AI." Each states its own
 * direction and window, and they are NEVER summed.
 *
 * The set is CLOSED. An eighth indicator is a specification change, not a
 * configuration change.
 */
export const CONFLICT_INDICATORS = [
  'INCIDENT_FREQUENCY',
  'GEOGRAPHIC_SPREAD',
  'ACTOR_ACTIVITY',
  'INFRASTRUCTURE_ATTACKS',
  'DISPLACEMENT_REPORTS',
  'CEASEFIRE_VIOLATIONS',
  'EVIDENCE_VOLUME',
] as const;
export type ConflictIndicatorId = (typeof CONFLICT_INDICATORS)[number];

/**
 * PF-4's INDICATOR CEILING — DERIVED, NEVER DECLARED.
 *
 * MCR-5 ratifies the cap at 7 for Conflict against a platform default of 5, and
 * Conflict Runtime Addendum A1 rules that a ratified maximum is a HARD CEILING
 * which configuration may tighten and never raise — "7 cannot become 40".
 *
 * Deriving it from the union's own length makes that structurally true instead
 * of merely policed: there is no second number to drift, and a fortieth
 * indicator would need an id `ConflictIndicatorId` does not admit. A separate
 * configurable maximum is exactly what this line exists to prevent.
 */
export const CONFLICT_MAX_INDICATORS = CONFLICT_INDICATORS.length;

/**
 * THREE of the seven carry a caveat that is part of the indicator, not a
 * footnote — MCR-13, ratified:
 *
 *   §06: displacement reports are "reporting volume, NOT population estimate";
 *   ceasefire violations exist "only where a cessation state exists"; evidence
 *   volume "may indicate access change, not escalation".
 *
 * Rendering any of these as a plain rising arrow without its qualifier would
 * state something the evidence does not support.
 */
export const INDICATOR_REQUIRES_CESSATION: ConflictIndicatorId = 'CEASEFIRE_VIOLATIONS';

export function indicatorIsAvailable(
  id: ConflictIndicatorId,
  extension: ConflictExtension,
): boolean {
  if (id !== INDICATOR_REQUIRES_CESSATION) return true;

  return typeof extension.cessationState === 'string' && extension.cessationState.length > 0;
}

/**
 * §11 — the watch scope vocabulary. CONFIGURATION OF THE SHARED WATCH, and
 * "not a new mechanism". Each is a scope on one shared Watch record.
 */
export const CONFLICT_WATCH_SCOPES = [
  'SITUATION',
  'GEOGRAPHY',
  'FRONT',
  'PARTICIPANT',
  'SPILLOVER',
  'CONSEQUENCE',
  'CORRIDOR',
  'CESSATION',
] as const;
export type ConflictWatchScope = (typeof CONFLICT_WATCH_SCOPES)[number];
