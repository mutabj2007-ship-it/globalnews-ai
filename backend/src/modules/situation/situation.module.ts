import { Module } from '@nestjs/common';
import { SITUATION_IDENTITY_CONTRACT } from './situation-identity.contract';
import { SITUATION_IDENTITY_PORT } from './situation-identity.port';
import { SituationRepository } from './situation.repository';
import { SituationShadowRepository } from './situation-shadow.repository';
import { SituationService } from './situation.service';

/**
 * SITUATION MEMORY — S1-R2. THE MODULE.
 *
 * PrismaModule is @Global(), so PrismaService needs no import here — the same
 * arrangement HistoryModule and FollowsModule already use.
 *
 * THIS MODULE IS NOT YET IMPORTED BY AppModule, AND THAT IS DELIBERATE.
 * Registering it would make the code reachable before the package it depends on
 * exists in this worktree. The single line that activates it — adding
 * `SituationModule` to AppModule's imports — belongs to the tranche that
 * converges G's identity package and wires the call site.
 *
 * ── THE IDENTITY PORT IS NOW WIRED ──────────────────────────────────────────
 *
 * This block used to read: "THE IDENTITY PORT IS BOUND TO THE UNWIRED DEFAULT.
 * G's `situation-identity.contract.ts` is an accepted but UNCONVERGED package:
 * it is not in this worktree … When it is converged, exactly one thing changes
 * here — the `useValue` below becomes the real adapter."
 *
 * IT IS IN THIS WORKTREE NOW. `situation-identity.contract.ts` was converged
 * with the rest of the substrate and exports `SITUATION_IDENTITY_CONTRACT`,
 * typed `SituationIdentityPort`. The condition this file itself set is met, so
 * the binding moves — exactly the one thing the paragraph said would change.
 * Leaving it on a default whose every method throws, while the real adapter sat
 * beside it compiling, would have been the silent kind of wrong.
 *
 * Product-Owner instruction, verbatim: "Identity port must not silently remain
 * unwired if a current accepted runtime implementation exists."
 *
 * Every other file in this namespace reads the port through the token and needs
 * no edit, which is the entire reason it is a token rather than an import.
 *
 * THIS IS THE ONE LINE OF THE MODULE THAT DIFFERS FROM THE ACCEPTED AUTHORITY.
 * The other fourteen files are byte-identical to it.
 *
 * TIER 2 STAYS SHADOW-ONLY, AND WIRING DID NOT CHANGE THAT. Binding the
 * adapter makes tier 1 live; it does not promote tier 2, because `shadowOnly`
 * comes from the decision object the contract returns, not from this file.
 * Phase 2 begins when that contract stops saying shadowOnly — which its exit
 * criterion ties to a live-scored distribution, not to a flag here.
 */
@Module({
  providers: [
    {
      provide: SITUATION_IDENTITY_PORT,
      useValue: SITUATION_IDENTITY_CONTRACT,
    },
    SituationRepository,
    SituationShadowRepository,
    SituationService,
  ],
  exports: [SituationService],
})
export class SituationModule {}
