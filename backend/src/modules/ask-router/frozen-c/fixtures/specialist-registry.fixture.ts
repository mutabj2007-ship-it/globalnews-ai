/**
 * SPECIALIST REGISTRY — FIXTURE, NOT AUTHORITY
 *
 * `specialist-claim.ts` states that the mapping from a reader's words to a
 * `QuestionKind` is DELIBERATELY ABSENT, and that "intent classification is a separate
 * contract". The router therefore owns no analytical-domain-to-specialist-domain table,
 * and this file exists so that the boundary is visible instead of implicit.
 *
 * It stands in for the registry's OWN answer. It is a fixture for the corpus and it is
 * not a proposal. A probe asserts that nothing under `src/` contains a specialist
 * domain literal, so the router cannot acquire this knowledge by accident.
 *
 * WHY 'security' RESOLVES TO registered-but-unbound:
 *   MA §6 lists Conflict as the one authoritative specialist registration while its
 *   live assessment payload, approved DTO, assessment service contract and
 *   HTTP/transport route are ALL still missing. F's Support audit measured
 *   `ConflictAssessmentRail` at 0 non-spec referrers. Registered is not bound.
 *
 * WHY ANY 'ILLUSTRATIVE:' DOMAIN RESOLVES TO unregistered:
 *   Main measures exactly one domain registering. Every other domain the corpus needs
 *   to name is marked ILLUSTRATIVE so it can never be mistaken for a landed symbol.
 */

import { isIllustrative } from '../src/ports.js';
import type { SpecialistRegistryPort, SpecialistResolution } from '../src/registry.js';

const ATTESTED_REGISTERED_UNBOUND: readonly string[] = ['security'];

export const specialistRegistryFixture: SpecialistRegistryPort = {
  resolve(analyticalDomain: string): SpecialistResolution {
    if (isIllustrative(analyticalDomain)) {
      return { registered: false, bound: false };
    }
    if (ATTESTED_REGISTERED_UNBOUND.includes(analyticalDomain)) {
      return { registered: true, bound: false };
    }
    return { registered: false, bound: false };
  },
};
