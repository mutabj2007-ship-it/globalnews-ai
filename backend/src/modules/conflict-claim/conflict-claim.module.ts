import { Module, OnModuleInit } from '@nestjs/common';
import { SpecialistClaimRegistry } from '../specialist/specialist-claim.registry';
import { SpecialistModule } from '../specialist/specialist.module';
import { CONFLICT_CLAIM_DEFINITION } from './conflict-claim.definition';

/**
 * CONFLICT CLAIM REGISTRATION — THE MODULE.
 *
 *     baseline  C16  225A1E3EA122AFF019D96517BB12EAFC520FCF7DC9C655DE67F00B3A775E98D8
 *     authority Shared Specialist Addendum v1.0 R1 §16
 *               50b4b882576e76722eb57044de80289a5559b64dc0b6832ba838605902b90acd
 *
 * ── NARROWLY NAMED, ON PURPOSE ────────────────────────────────────────────
 *
 * `ConflictClaimModule`, not `ConflictModule`. There is no Conflict domain module
 * in this product and this is not the beginning of one — the name says what the
 * module does, so that nothing later accretes into it on the strength of a general
 * name. A Conflict assessment service, when it exists, is a different module with a
 * different owner and its own authorization.
 *
 * ── PUSH, NEVER PULL ──────────────────────────────────────────────────────
 *
 * P2's registry imports no domain. This module imports P2 and registers itself,
 * which is the direction that keeps the platform free of domain dependencies:
 * adding a domain must never edit the platform. P2 needs NO EDIT for this to land —
 * all three Part V / R1 hashes are already in
 * `ACCEPTED_SPECIALIST_DESIGN_AUTHORITIES`.
 *
 * ── `OnModuleInit`, SO A REJECTION IS A STARTUP FAILURE ───────────────────
 *
 * Every guard in `register()` throws. Registering at initialisation means a bad
 * authority hash, a duplicate kind or a self-contradictory row stops the process
 * instead of degrading a request hours later. That is what P2's guards were written
 * for, and calling `register()` anywhere lazier would waste them.
 *
 * ── WHAT THIS MODULE DOES NOT DO ──────────────────────────────────────────
 *
 *   it never calls `resolve()`      registration is not routing
 *   it imports nothing from P3      P3 forms claim requests; this registers ownership
 *   it holds no controller, route, service, provider or state
 *   it registers no other domain    Election, Delivery and Humanitarian are theirs
 *
 * ── WHAT CHANGES ON THE DAY THIS LANDS ────────────────────────────────────
 *
 * `SpecialistModule` was deliberately kept out of `AppModule` until a first domain
 * registered; its header says the activating line "belongs to the tranche that
 * registers the first domain and wires the call site". This tranche is the first
 * half of that sentence and, by ruling, takes the AppModule line with it.
 *
 * So after this:
 *
 *     registeredDomains()  ['CONFLICT']   was []
 *     canonicalKinds()     the three      was []
 *
 * and PRODUCT BEHAVIOUR IS UNCHANGED, because nothing calls the registry: P3's
 * former is not built, no call site exists, and Support's existing path is
 * untouched. The register becoming non-empty is real and provable at startup; it is
 * not yet reachable by a user, and this module adds no way to make it so.
 */
@Module({ imports: [SpecialistModule] })
export class ConflictClaimModule implements OnModuleInit {
  constructor(private readonly registry: SpecialistClaimRegistry) {}

  onModuleInit(): void {
    this.registry.register(CONFLICT_CLAIM_DEFINITION);
  }
}
