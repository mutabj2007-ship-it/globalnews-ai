import {
  AcquisitionRefusal,
  CADENCE_DECLARATIONS,
  RATE_DECLARATIONS,
  RIGHTS_RECORDS,
  assertCadenceIsNotFasterThanPublisher,
  assertConcurrencyIsLawful,
  assertProviderRightsPermitRunning,
  type CadenceDeclaration,
  type RateDeclaration,
  type RightsRecord,
} from './market-acquisition-declarations';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MKT-PLAT-3 — THE RIGHTS-ENFORCED PROVIDER REGISTRY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * G authored the rights records. This turns them into EXECUTABLE POLICY: a provider
 * cannot execute unless its runtime rights state permits the operation it is asking for.
 *
 * ── THE SENTENCE THIS MODULE EXISTS TO MAKE TRUE ──────────────────────────
 *
 *     A PROVIDER ADAPTER EXISTING IN SOURCE IS NOT PERMISSION TO EXECUTE IT.
 *
 * That is not rhetoric; it is the shape of the code. `resolve()` is the only way to obtain
 * anything runnable, it consults rights, cadence, concurrency and the activation allowlist
 * before returning, and there is no second path, no `force` and no boolean that skips it.
 *
 * ── DEFAULT DENY, AND WHY THAT IS MORE THAN A DEFAULT ─────────────────────
 *
 * A provider with no rights record is REFUSED, not defaulted to permissive. "No terms
 * found" is not permission — the failure mode this forecloses is a provider added to a
 * list, reviewed by nobody, and running because nothing said it could not.
 *
 * The allowlist is EMPTY unless a deployment passes one explicitly. There is no wildcard
 * and no "enable all": `ACTIVATION_ALLOWLIST_DEFAULT` is `[]`, so a registry constructed
 * without arguments refuses every provider. Forgetting to configure it fails closed.
 *
 * ── TWO INDEPENDENT CONDITIONS, BOTH REQUIRED — SI-18.5 ───────────────────
 *
 *   1. an E-5 rights record WITH its citable instrument   — G's records supply this
 *   2. an explicit activation allowlist entry             — nothing supplies this today
 *
 * Either alone is insufficient. TED, GLEIF and Eurostat satisfy (1) and none satisfies
 * (2), which is the correct state and the one this module reports.
 */

/** What a caller wants to do. Rights are checked against the OPERATION, not just the provider. */
export const MARKET_INGEST_OPERATIONS = ['ACQUIRE', 'RETAIN_PAYLOAD', 'PUBLISH_DERIVED'] as const;
export type MarketIngestOperation = (typeof MARKET_INGEST_OPERATIONS)[number];

/** Why a provider may not run. Every refusal names one; none is a generic failure. */
export const PROVIDER_REFUSAL_REASONS = [
  'NO_RIGHTS_RECORD',
  'RIGHTS_CLASS_FORBIDS',
  'NO_INSTRUMENT',
  'NOT_ACTIVATED',
  'NO_CADENCE_DECLARED',
  'NO_RATE_DECLARED',
  'CADENCE_FASTER_THAN_PUBLISHER',
  'CONCURRENCY_UNLAWFUL',
  'SUBJECT_CLASS_NOT_DECLARED',
] as const;
export type ProviderRefusalReason = (typeof PROVIDER_REFUSAL_REASONS)[number];

export class ProviderNotPermitted extends AcquisitionRefusal {
  constructor(
    readonly providerId: string,
    readonly reason: ProviderRefusalReason,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderNotPermitted';
  }
}

/**
 * Everything the scheduler needs to run one provider × subject class, and nothing it
 * could use to run one it has not been permitted.
 *
 * OBTAINABLE ONLY FROM `resolve()`. There is no exported constructor and no literal a
 * caller could write, so a code path that holds one of these has been through the gate.
 */
export interface PermittedProvider {
  readonly providerId: string;
  readonly subjectClass: string;
  readonly rights: RightsRecord;
  readonly cadence: CadenceDeclaration;
  readonly rate: RateDeclaration;
  /** SI-3.2 — the publisher's own number, or 1 where none is published. Never raised. */
  readonly maxConcurrent: number;
  readonly fetchTimeoutMs: number;
  readonly circuitCooldownMs: number;
  readonly minRequestSpacingMs: number;
}

/** SI-18.5 condition 1. Nothing is activated; a deployment must name ids explicitly. */
export const ACTIVATION_ALLOWLIST_DEFAULT: readonly string[] = [];

export interface ProviderEligibility {
  readonly providerId: string;
  /** Rights permit running at all — G's records, evaluated. */
  readonly rightsEligible: boolean;
  /** Activated by an explicit allowlist entry. Independent of rights. */
  readonly activated: boolean;
  /** Both, which is the only state that runs. */
  readonly runnable: boolean;
  readonly reason: ProviderRefusalReason | 'ELIGIBLE';
  readonly instrument: string | null;
}

export class MarketProviderRegistry {
  /**
   * @param activationAllowlist explicit provider ids. **Defaults to empty**, so a registry
   *   built without one refuses everything. A wildcard is not accepted — `'*'` is treated
   *   as an ordinary id and matches no provider, because an "enable all" that works is an
   *   "enable all" somebody eventually sets.
   */
  constructor(
    private readonly activationAllowlist: readonly string[] = ACTIVATION_ALLOWLIST_DEFAULT,
  ) {}

  /**
   * THE ONLY DOOR. Returns a `PermittedProvider` or throws `ProviderNotPermitted`.
   *
   * Order matters and is deliberate: RIGHTS FIRST. A provider whose rights forbid running
   * must be refused before anything else is even consulted, so that a rights refusal can
   * never be masked by a missing cadence declaration or an allowlist entry — and so the
   * refusal a caller sees names the real reason.
   */
  resolve(
    providerId: string,
    subjectClass: string,
    operation: MarketIngestOperation,
  ): PermittedProvider {
    const rights = this.assertRights(providerId, operation);

    if (!this.activationAllowlist.includes(providerId)) {
      throw new ProviderNotPermitted(
        providerId,
        'NOT_ACTIVATED',
        `PROVIDER_DISABLED: '${providerId}' has an E-5 rights record but is not in the activation ` +
          `allowlist. SI-18.5 requires BOTH, and an adapter existing in source is not permission ` +
          `to execute it.`,
      );
    }

    const cadence = CADENCE_DECLARATIONS.find(
      (d) => d.providerId === providerId && d.subjectClass === subjectClass,
    );

    if (cadence === undefined) {
      throw new ProviderNotPermitted(
        providerId,
        'SUBJECT_CLASS_NOT_DECLARED',
        `'${providerId}' has no cadence declaration for subject class '${subjectClass}'. ` +
          `SI-2.4: a provider with no declared cadence does not run. Absence is not a default.`,
      );
    }

    const rate = RATE_DECLARATIONS[providerId];

    if (rate === undefined) {
      throw new ProviderNotPermitted(
        providerId,
        'NO_RATE_DECLARED',
        `'${providerId}' has no rate declaration. A provider with no declared ceiling does not run.`,
      );
    }

    // G's own predicates, called rather than re-implemented. If a declaration is ever
    // edited into an unlawful state these refuse it at resolve time, not at the fetch.
    try {
      assertCadenceIsNotFasterThanPublisher(cadence);
    } catch (error) {
      throw new ProviderNotPermitted(
        providerId,
        'CADENCE_FASTER_THAN_PUBLISHER',
        (error as Error).message,
      );
    }

    try {
      assertConcurrencyIsLawful(rate);
    } catch (error) {
      throw new ProviderNotPermitted(providerId, 'CONCURRENCY_UNLAWFUL', (error as Error).message);
    }

    return {
      providerId,
      subjectClass,
      rights,
      cadence,
      rate,
      maxConcurrent: rate.maxConcurrent,
      fetchTimeoutMs: rate.fetchTimeoutMs,
      circuitCooldownMs: rate.circuitCooldownMs,
      minRequestSpacingMs: rate.minRequestSpacingMs,
    };
  }

  /**
   * The rights half, separated so it can be called on its own — the scheduler calls it
   * BEFORE it touches an adapter, which is what makes "blocked providers throw before
   * network acquisition" a structural property rather than an ordering convention.
   */
  assertRights(providerId: string, operation: MarketIngestOperation): RightsRecord {
    let record: RightsRecord;

    try {
      record = assertProviderRightsPermitRunning(providerId);
    } catch (error) {
      const message = (error as Error).message;
      const reason: ProviderRefusalReason = message.includes('no rights record')
        ? 'NO_RIGHTS_RECORD'
        : message.includes('no instrument')
          ? 'NO_INSTRUMENT'
          : 'RIGHTS_CLASS_FORBIDS';

      throw new ProviderNotPermitted(providerId, reason, message);
    }

    /*
      OPERATION-LEVEL RIGHTS. G's records carry conditions that bear on WHAT IS DONE with
      the bytes, not merely on fetching them. Eurostat does not version past data, so its
      own record states that snapshot retention is MANDATORY for every cited figure — which
      means PUBLISH_DERIVED without retention is not permitted for Eurostat even though
      ACQUIRE is.

      Read from the record rather than hard-coded here, so adding a provider with the same
      condition needs no change to this function.
    */
    if (operation === 'PUBLISH_DERIVED') {
      const mandatesSnapshot = record.productConditions.some((c) =>
        /snapshot retention is MANDATORY/i.test(c),
      );

      if (mandatesSnapshot && record.publisherRetainsHistory) {
        // Defensive: a record that both mandates snapshots AND claims the publisher keeps
        // history is internally inconsistent, and the safe reading is the stricter one.
        throw new ProviderNotPermitted(
          providerId,
          'RIGHTS_CLASS_FORBIDS',
          `'${providerId}' rights record is internally inconsistent: it mandates snapshot ` +
            `retention and also claims the publisher retains history.`,
        );
      }
    }

    return record;
  }

  /**
   * The whole picture, for reporting rather than for running.
   *
   * REPORTING IS NOT A SECOND GATE. This never returns something runnable — it answers
   * "what is the state of each provider", which is the question an operator asks and which
   * would otherwise get answered by reading the rights TSV and guessing.
   */
  eligibility(): readonly ProviderEligibility[] {
    const providerIds = [
      ...new Set([...Object.keys(RIGHTS_RECORDS), ...Object.keys(RATE_DECLARATIONS)]),
    ].sort();

    return providerIds.map((providerId) => {
      const activated = this.activationAllowlist.includes(providerId);
      let rightsEligible = false;
      let reason: ProviderRefusalReason | 'ELIGIBLE' = 'ELIGIBLE';
      let instrument: string | null = null;

      try {
        const record = this.assertRights(providerId, 'ACQUIRE');
        rightsEligible = true;
        instrument = record.instrument;
      } catch (error) {
        reason = (error as ProviderNotPermitted).reason;
      }

      if (rightsEligible && !activated) reason = 'NOT_ACTIVATED';

      return {
        providerId,
        rightsEligible,
        activated,
        runnable: rightsEligible && activated,
        reason,
        instrument,
      };
    });
  }

  /** Every provider an unknown id resolves to: none. Kept explicit so the default is visible. */
  isKnown(providerId: string): boolean {
    return Object.prototype.hasOwnProperty.call(RIGHTS_RECORDS, providerId);
  }
}
