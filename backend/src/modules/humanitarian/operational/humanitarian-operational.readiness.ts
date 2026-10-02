/**
 * ════════════════════════════════════════════════════════════════════════════
 * SOURCE READINESS — WHAT AN OPERATOR MUST DO NEXT, DERIVED FROM E1's VERDICT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * HUMANITARIAN-F-OPS-R2.
 *
 * The R2 contract asks this surface to carry readiness for three named
 * situations: GDACS dev-only, ReliefWeb credential missing, Copernicus
 * protection missing. Those are three REASONS A SOURCE IS NOT READY, and the
 * authority on that reason is E1's verdict — never a second opinion formed here.
 *
 * ── WHY A MAP AND NOT THREE SPECIAL CASES ─────────────────────────────────
 *
 * Writing the three the contract names as three branches would leave the other
 * three verdicts falling through to a default, and a default is how an operator
 * comes to read "not ready" about a source that is actually cleared. So the
 * mapping is TOTAL over E1's vocabulary: `Record<SourceActivationVerdict, …>`
 * is a compile error the day E1 adds a seventh verdict, which is the only moment
 * anyone would otherwise discover that this surface had started guessing.
 *
 * It is also INJECTIVE — one readiness value per verdict, no two verdicts
 * collapsed together. A surface that mapped `CREDENTIAL_REQUIRED` and
 * `RIGHTS_CONFIRMATION_REQUIRED` both to "blocked" would tell an operator to go
 * looking for a variable to set when the actual blocker is a grant nobody has
 * been asked for. `assertReadinessMappingIsTotalAndInjective()` proves both
 * properties from E1's own list rather than from a copy of it.
 *
 * ── THE ONE PLACE THE CONTRACT AND E1 DISAGREE, STATED RATHER THAN SMOOTHED ─
 *
 * The R2 contract says "GDACS dev-only". E1's R1 ruling did say
 * `CLEARED_FOR_DEV_CAPTURE`; E1's R2 ruling, carried in the convergence this
 * lane is based on, moved GDACS to `RIGHTS_CONFIRMATION_REQUIRED` after the dev
 * capture was exercised and produced a rights fact pointing away from runtime.
 * Source authority is E1's, so this surface reports what E1 ruled, and
 * `DEV_CAPTURE_ONLY` stays in the vocabulary — reachable, tested, and currently
 * held by no source. The divergence is recorded in SOURCE-HEALTH.md rather than
 * resolved by picking the reading that matches the brief.
 */

import {
  SOURCE_ACTIVATION_VERDICTS,
  type SourceActivationVerdict,
} from '../source-activation.ruling';

export const SOURCE_READINESS_STATES = [
  /** E1's runtime verdict is held. Nothing here starts anything; see the mount. */
  'RUNTIME_CLEARED',
  /** A reviewed, hash-bound offline capture is permitted. NOT a runtime fetch. */
  'DEV_CAPTURE_ONLY',
  /** A pre-approved credential must exist before any call, capture included. */
  'CREDENTIAL_MISSING',
  /** No instrument grants the acts a reader-facing surface would perform. */
  'RIGHTS_CONFIRMATION_MISSING',
  /** No reviewed protection authority is installed, so no record could be keyed. */
  'PROTECTION_AUTHORITY_MISSING',
  /**
   * Ruled not cleared, without a more specific binding gate named.
   *
   * DELIBERATELY NOT SPELLED `NOT_CLEARED`. The payload already carries an
   * `activation` field whose values include `NOT_CLEARED`, and one token meaning
   * two different things on two different axes of the same row is the confusion
   * a reader resolves wrongly. The suffix says what distinguishes this case from
   * the four verdicts that DO name their gate.
   */
  'NOT_CLEARED_NO_GATE_NAMED',
] as const;
export type SourceReadiness = (typeof SOURCE_READINESS_STATES)[number];

/**
 * TOTAL over E1's verdict vocabulary. Deliberately NOT a function with a
 * `default:` branch — the exhaustiveness has to be the compiler's job, because
 * the failure mode is silence.
 */
export const READINESS_FOR_VERDICT: Readonly<Record<SourceActivationVerdict, SourceReadiness>> =
  Object.freeze({
    CLEARED_FOR_ALPHA_RUNTIME: 'RUNTIME_CLEARED',
    CLEARED_FOR_DEV_CAPTURE: 'DEV_CAPTURE_ONLY',
    CREDENTIAL_REQUIRED: 'CREDENTIAL_MISSING',
    RIGHTS_CONFIRMATION_REQUIRED: 'RIGHTS_CONFIRMATION_MISSING',
    PROTECTION_AUTHORITY_REQUIRED: 'PROTECTION_AUTHORITY_MISSING',
    NOT_CLEARED: 'NOT_CLEARED_NO_GATE_NAMED',
  });

/**
 * WHAT HAS TO HAPPEN, AND WHOSE AUTHORITY IT IS.
 *
 * An operator reading "not ready" needs to know whether this is theirs to fix.
 * Two of these six are explicitly NOT: a rights grant and an activation
 * clearance are E1's and the Product Owner's, and an operator who thinks
 * otherwise goes looking for a setting that must not exist.
 */
export const READINESS_REQUIREMENT: Readonly<Record<SourceReadiness, string>> = Object.freeze({
  RUNTIME_CLEARED:
    'E1 has cleared runtime acquisition. Starting it is a separate authorised change; no control on this surface can start it.',
  DEV_CAPTURE_ONLY:
    'A reviewed, hash-bound offline capture may be taken by a person. A scheduled process fetching the same bytes is a different act with a different verdict, and is not cleared.',
  CREDENTIAL_MISSING:
    'A pre-approved credential must be obtained from the publisher and held where a producer cannot read it. Until then no call may be made, including a development capture. NOT an operator setting: the credential must never be invented or hard-coded.',
  RIGHTS_CONFIRMATION_MISSING:
    'No instrument grants the acts a reader-facing surface would perform. A written grant, or a Product Owner decision on the stated question, is required. E1 and the Product Owner hold this; it is not an operator action.',
  PROTECTION_AUTHORITY_MISSING:
    'No reviewed governed authority store is provisioned, so no record could be keyed and every record would be withheld. Provisioning plus a passing boot validation is the gate, and E1 authors the protected-class declarations.',
  NOT_CLEARED_NO_GATE_NAMED:
    'E1 has not cleared this source and has named no narrower gate. Nothing proceeds on silence, and there is no operator action that advances it.',
});

export function deriveSourceReadiness(verdict: SourceActivationVerdict): SourceReadiness {
  return READINESS_FOR_VERDICT[verdict];
}

export function readinessRequirement(readiness: SourceReadiness): string {
  return READINESS_REQUIREMENT[readiness];
}

export class ReadinessMappingBroken extends Error {}

/**
 * Proves the two properties from E1's OWN list, not from a copy.
 *
 * Totality catches a verdict E1 added that nothing here maps. Injectivity
 * catches the opposite mistake — two verdicts folded onto one readiness value,
 * which reads as correct in isolation and loses the distinction an operator
 * needs. Both are the `RUNTIME_PERMITTING_VERDICT` lesson from E1's own file:
 * a second hand-written list drifts from the first the moment either changes.
 */
export function assertReadinessMappingIsTotalAndInjective(): void {
  const seen = new Map<SourceReadiness, SourceActivationVerdict>();
  for (const verdict of SOURCE_ACTIVATION_VERDICTS) {
    const readiness = (
      READINESS_FOR_VERDICT as Readonly<Record<string, SourceReadiness | undefined>>
    )[verdict];
    if (readiness === undefined) {
      throw new ReadinessMappingBroken(
        `READINESS_MAPPING_NOT_TOTAL: E1 verdict '${verdict}' has no readiness value. An unmapped ` +
          'verdict would reach an operator as a blank or a default, and a default here reads as a ' +
          'claim about a source nobody assessed.',
      );
    }
    if (SOURCE_READINESS_STATES.indexOf(readiness) === -1) {
      throw new ReadinessMappingBroken(
        `READINESS_VALUE_NOT_DECLARED: '${readiness}' is not in SOURCE_READINESS_STATES.`,
      );
    }
    const already = seen.get(readiness);
    if (already !== undefined) {
      throw new ReadinessMappingBroken(
        `READINESS_MAPPING_NOT_INJECTIVE: '${verdict}' and '${already}' both map to ` +
          `'${readiness}'. Collapsing two gates into one tells an operator to fix the wrong thing.`,
      );
    }
    seen.set(readiness, verdict);
    if (READINESS_REQUIREMENT[readiness] === undefined) {
      throw new ReadinessMappingBroken(
        `READINESS_REQUIREMENT_MISSING: '${readiness}' names no requirement. "Not ready" without ` +
          'the next action is the state an operator cannot act on.',
      );
    }
  }
}
