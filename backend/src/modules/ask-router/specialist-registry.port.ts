import type { SpecialistRegistryPort, SpecialistResolution } from './frozen-c/src/registry';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE E — THE PRODUCTION SPECIALIST REGISTRY PORT.
 *
 * Frozen C's `specialistRegistryFixture` stands in for "the registry's OWN answer"; this
 * port gives it the landed registry's answer instead. Frozen C owns no domain-to-
 * specialist table (a probe forbids it under `src/`), so the one mapping it needs lives
 * here, beside the adapter, with its authority named:
 *
 *   security → CONFLICT   MA §6: Conflict is the one authoritative specialist registration.
 *                         The same fact frozen C's fixture encodes as `security` registered.
 *
 * BOUND IS ALWAYS FALSE. Registered is not bound (CTO ruling 4): Conflict's live assessment
 * payload, DTO, service contract and HTTP route are all still missing (F's Support audit:
 * `ConflictAssessmentRail` 0 non-spec referrers). When a callable seam lands, `bound`
 * becomes a measured fact passed in here — never a default.
 */
export const ANALYTICAL_TO_SPECIALIST_DOMAIN: Readonly<Record<string, string>> = Object.freeze({
  security: 'CONFLICT',
});

export function landedSpecialistRegistryPort(
  registeredDomains: () => readonly string[],
  boundDomains: readonly string[] = [],
): SpecialistRegistryPort {
  return {
    resolve(analyticalDomain: string): SpecialistResolution {
      const specialist = ANALYTICAL_TO_SPECIALIST_DOMAIN[analyticalDomain];
      if (specialist === undefined) return { registered: false, bound: false };
      const registered = registeredDomains().includes(specialist);
      return { registered, bound: registered && boundDomains.includes(specialist) };
    },
  };
}
