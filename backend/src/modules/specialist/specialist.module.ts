import { Module } from '@nestjs/common';
import { SpecialistClaimRegistry } from './specialist-claim.registry';

/**
 * SPECIALIST CLAIM BOUNDARY — THE MODULE.
 *
 * A sibling of the domains, owned by the platform. It is not inside Support (Support would own the
 * boundary it consumes) and not inside any domain (the platform would depend on domains).
 *
 * THIS MODULE IS NOT YET IMPORTED BY AppModule, AND THAT IS DELIBERATE — the same arrangement
 * SituationModule already uses in this codebase. With no domain registered the registry has no
 * behaviour to offer, and importing it would put an unreachable provider on the live path. The
 * single line that activates it belongs to the tranche that registers the first domain and wires
 * the call site.
 *
 * ON THE DAY THIS LANDS, PRODUCT BEHAVIOUR IS UNCHANGED. No domain registers, no caller injects,
 * Support's existing eligibility path is untouched, and the registry resolves every request to
 * NO_DOMAINS_REGISTERED if anything ever asked it. That inertness is the point: the boundary can
 * be reviewed and promoted before any domain depends on it.
 *
 * WHAT MUST NOT BE ADDED HERE: a Conflict, Election or Delivery handler; any domain's claim
 * definition; an intent classifier. Those are domain-owned, and for Election and Delivery they do
 * not exist.
 */
@Module({
  providers: [SpecialistClaimRegistry],
  exports: [SpecialistClaimRegistry],
})
export class SpecialistModule {}
