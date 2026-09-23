import {
  CONFLICT_INDICATORS,
  CONFLICT_WATCH_SCOPES,
  type ConflictSeverity,
  type ConflictState,
  type ConflictStateToken,
} from '@globalnews-ai/shared';
import { domainToken, type SpecialistDomainConfig } from '@/lib/specialist/specialistDomain';

/**
 * CONFLICT INTELLIGENCE — THE PRESENTATION LAYER, AND ONLY THE PRESENTATION LAYER.
 *
 *     authority  Part V Conflict Intelligence v1.0 R2
 *                  spec    b8425fa996fa5cfc6415df8b938ee4dd5ac118257e5c62d41bd161fce141c1d2
 *                  visual  711443b6e4832ad630ee736059863aa9ded144148a9bd0a49069776f57a93d8c
 *                Shared Specialist Addendum v1.0
 *                  71646a05b4055ec547527b22cae68bd2ecc50d054370d0db91b3bd350fdd2ff5
 *     baseline   C12  2C97F41429B00658D2B2CEBFBC782A61AA18DB455F6CC22BBF6874330B45C6F7
 *
 * ── WHAT MOVED, AND WHY THIS FILE STILL EXISTS ────────────────────────────
 *
 * MAIN-CONFLICT-D4 moved the SHAREABLE domain surface to `@globalnews-ai/shared`
 * (`shared/src/conflict.ts`): the extension shape, states, severities, the closed
 * seven-indicator union with its derived maximum, indicator availability and the
 * watch scopes. Those are things the BACKEND needs to PRODUCE a correct
 * assessment.
 *
 * What remains here is what only a RENDERER needs: the typographic treatment per
 * severity rung, the red-hue predicate, the forbidden-copy guard, the specialist
 * domain registration, and the token constructor — which depends on the
 * frontend's own `domainToken`.
 *
 * The shared symbols are RE-EXPORTED below so existing consumers keep one import
 * site. `shared/src/conflict.ts` is the single source of truth; this module is a
 * view onto it plus the presentation layer.
 *
 * ── WHAT CONFLICT MAY ADD TO AN OBJECT, AND WHAT IT MAY NOT ───────────────
 *
 * §01's hard rule: "Conflict Intelligence may ADD FIELDS to an object. It may
 * never create a PARALLEL RECORD of a situation the platform already holds."
 * So there is no conflict object store here, no conflict evidence model and no
 * conflict change vocabulary — §12's duplication audit reuses all seven change
 * states verbatim and Conflict "adds none".
 */

export {
  CONFLICT_INDICATORS,
  CONFLICT_MAX_INDICATORS,
  CONFLICT_SEVERITIES,
  CONFLICT_STATES,
  CONFLICT_WATCH_SCOPES,
  INDICATOR_REQUIRES_CESSATION,
  indicatorIsAvailable,
} from '@globalnews-ai/shared';
export type {
  ConflictExtension,
  ConflictIndicatorId,
  ConflictSeverity,
  ConflictState,
  ConflictStateToken,
  ConflictWatchScope,
} from '@globalnews-ai/shared';

/**
 * The token constructor stays here because `domainToken` is the frontend's
 * single construction point for every domain-scoped token, and Conflict does not
 * get a private one.
 *
 * The assertion is the narrowing D4 made possible: `domainToken('CONFLICT', s)`
 * provably returns `CONFLICT:${s}`, but its declared return type is the wider
 * `${SpecialistDomainId}:${string}`. Asserting here keeps the precise wire type
 * on the shared side without weakening it to `string` and without giving
 * Conflict its own token builder.
 */
export function conflictStateToken(state: ConflictState): ConflictStateToken {
  return domainToken('CONFLICT', state) as ConflictStateToken;
}

/** The ONLY rung that may carry red. Everything else is weight and placement. */
export function severityMayUseRed(severity: ConflictSeverity): boolean {
  return severity === 'CRITICAL';
}

/**
 * The typographic treatment per rung — §04's four descriptions, as classes.
 * No rung below CRITICAL names a colour.
 *
 * PRESENTATION ONLY, and deliberately not shared: the backend must never learn
 * what a severity looks like.
 */
export const SEVERITY_TREATMENT: Readonly<Record<ConflictSeverity, string>> = {
  CRITICAL: 'rounded-[2px] border border-sp-red/50 bg-sp-red/[0.12] px-[5px] py-[1px] text-sp-red',
  HIGH: 'rounded-[2px] border border-gn-line-structural px-[5px] py-[1px] text-sp-ink',
  MODERATE: 'text-sp-ink-2',
  LOW: 'text-sp-ink-3',
};

/**
 * §06's FORBIDDEN COPY, as a testable predicate.
 *
 * "will escalate", "likely to spread", "X% risk", "risk score", any single
 * composite number. Rung 4 — scenario and forecast — is "deferred until the
 * analytical architecture supports it honestly. NOT DESIGNED, NOT STUBBED, NOT
 * SIMULATED in this pass", and the CTO's authorization repeats it twice: no
 * predictive capability, and no stub for one.
 */
const FORBIDDEN_COPY =
  /\b(will escalate|likely to (escalate|spread)|risk score|probability of|forecast(ed)?|predicted)\b|\d+\s?% risk/i;

export function copyIsPermitted(text: string): boolean {
  return !FORBIDDEN_COPY.test(text);
}

export const CONFLICT_DOMAIN: SpecialistDomainConfig = {
  id: 'CONFLICT',
  objectSubtypes: [
    'situation',
    'incident',
    'front',
    'corridor',
    'exposure',
    'displacement',
    'cessation',
    'spillover',
  ],
  /* C·3: evidence and incidents stay resident on the 52px rail; the other six
     live behind the anchored layers popover. The rail is NOT widened. */
  mapLayers: [
    'conflict.incidents',
    'conflict.fronts',
    'conflict.displacement',
    'conflict.corridors',
    'conflict.infrastructure',
    'conflict.cessation',
    'conflict.spillover',
  ],
  queueRankingRule: 'severity, then change recency — applied upstream, never in the UI component',
  indicatorIds: [...CONFLICT_INDICATORS],
  assessmentSections: ['participants', 'indicators', 'consequence'],
  watchScopes: [...CONFLICT_WATCH_SCOPES],
  meteredActions: [
    'EXPLAIN_ESCALATION',
    'EXPLAIN_CHANGE',
    'COMPARE_CONFLICTS',
    'ASSESS_SPILLOVER',
    'ASSESS_HUMANITARIAN',
    'SUMMARISE_30_DAYS',
    'COMPARE_ACTOR_ACTIVITY',
    'ASSESS_INFRASTRUCTURE_EXPOSURE',
    'DEEP_ANALYSIS',
  ],
  honestyRules: [
    'No averaging of incompatible humanitarian estimates — §24.',
    'No forecast, no scenario, no composite risk score — §05 rung 4 is deferred.',
    'Displacement reporting is reporting volume, never a population estimate.',
    'Evidence volume may indicate access change, not escalation.',
    'Severity has no hue below CRITICAL — C·1.',
  ],
  claim: {
    claims: [
      'How serious is this hostility',
      'Who is fighting',
      'Is it escalating',
      'Where are people moving',
    ],
    doesNotClaim: ['Election results in a conflict-affected country', 'Aid-delivery performance'],
    landsOn: 'Conflict Assessment rail for the situation object',
  },
};

// Configuration is exported; no module-load activation or registration.
