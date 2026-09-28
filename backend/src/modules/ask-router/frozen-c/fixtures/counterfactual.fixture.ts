/**
 * COUNTERFACTUAL FIXTURES — FOR PROBES ONLY, NEVER AUTHORITY
 *
 * Two probes need to establish that a rule is genuinely conditional rather than
 * hardcoded to today's gaps:
 *
 *   V-2 · once official evidence is bound, the verification contract admits
 *         CURRENTLY_VERIFIED (CTO ruling 3's first branch).
 *   S-2 · once a specialist domain has a callable seam, the planner DOES emit an
 *         evidence request for it (CTO ruling 4's converse).
 *
 * Without these, "CURRENTLY_VERIFIED is unreachable" and "no specialist plan is
 * emitted" would be indistinguishable from the planner simply never being able to do
 * those things — which is the vacuous-probe trap this package tries to avoid everywhere.
 *
 * NOTHING HERE DESCRIBES THE PRODUCT. These are hypotheticals used inside probes. They
 * are not a proposal, not a flag, and not a claim that either seam exists.
 */

import type { SpecialistRegistryPort, SpecialistResolution } from '../src/registry.js';

/** A hypothetical registry in which the attested domain also has a callable seam. */
export const boundSpecialistRegistryFixture: SpecialistRegistryPort = {
  resolve(analyticalDomain: string): SpecialistResolution {
    if (analyticalDomain === 'security') return { registered: true, bound: true };
    return { registered: false, bound: false };
  },
};
