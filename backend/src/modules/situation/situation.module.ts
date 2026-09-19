import { Module } from '@nestjs/common';
import { SITUATION_IDENTITY_PORT, UNWIRED_SITUATION_IDENTITY_PORT } from './situation-identity.port';
import { SituationRepository } from './situation.repository';
import { SituationShadowRepository } from './situation-shadow.repository';
import { SituationService } from './situation.service';

/**
 * SITUATION MEMORY — S1-R2. THE MODULE.
 *
 * PrismaModule is @Global(), so PrismaService needs no import here — the same
 * arrangement HistoryModule and FollowsModule already use.
 *
 * ── THE IDENTITY PORT IS UNWIRED, AND THAT IS A RULING ────────────────────
 *
 *     Product Owner / CTO, MAIN-SITUATION-IDENTITY-PORT-CLOSEOUT-R1:
 *     "SITUATION IDENTITY PORT REMAINS UNWIRED. The Conflict presentation bind
 *      does not authorize identity-port activation."
 *
 * `UNWIRED_SITUATION_IDENTITY_PORT` throws `SituationIdentityPortNotWiredError`
 * from `derivePartitionKey` and `decideAttachment`. Nothing derives a key and
 * nothing is written. That is the intended state, not a gap.
 *
 * ── THE INSTRUCTION THAT PREVIOUSLY BOUND THE ADAPTER — SUPERSEDED ────────
 *
 * This block used to bind `SITUATION_IDENTITY_CONTRACT` and to say "THE
 * IDENTITY PORT IS NOW WIRED", on the strength of an earlier Product-Owner
 * instruction quoted here verbatim:
 *
 *     "Identity port must not silently remain unwired if a current accepted
 *      runtime implementation exists."
 *
 * THAT SENTENCE IS KEPT, AND IT IS SUPERSEDED. It is not deleted, because a
 * reader who met it again in a register and found no trace of it here would
 * re-derive the same binding from the same words. It is recorded so the next
 * reader knows it was considered and ruled on, and the ruling above governs.
 *
 * ── PRESENCE IS NOT AUTHORIZATION ─────────────────────────────────────────
 *
 * `situation-identity.contract.ts` IS in this worktree and it works —
 * `SITUATION_IDENTITY_CONTRACT.derivePartitionKey({ countryCode: 'RW' })`
 * returns `sit:v1:RWA` today. The contract is accepted, is not deleted, and is
 * not replaced. What it is not is BOUND: converging a contract and activating
 * an identity policy are two decisions, and only the first has been made.
 *
 * Three other accepted files already said so and were right —
 * `app.module.ts`, `situation-identity.contract.ts` ("NOT BOUND IN
 * `SituationModule` BY THIS TRANCHE") and `situation-identity.port.ts`. This
 * file was the only one that disagreed, and the bytes had followed this file.
 *
 * ── AND IT IS PINNED, NOT REMEMBERED ──────────────────────────────────────
 *
 * `situationIdentityPortUnwired.spec.ts` asserts the resolved value through a
 * real injector, so re-binding the adapter fails a test instead of passing
 * silently. It also asserts the contract is still PRESENT, so the guard cannot
 * be satisfied by deleting the thing it is guarding.
 *
 * Every other file in this namespace reads the port through the token and needs
 * no edit, which is the entire reason it is a token rather than an import.
 *
 * TIER 2 IS UNAFFECTED AND STAYS SHADOW-ONLY. `shadowOnly` comes from the
 * decision object the contract returns, not from this file, and with the port
 * unwired no decision is produced at all.
 */
@Module({
  providers: [
    {
      provide: SITUATION_IDENTITY_PORT,
      useValue: UNWIRED_SITUATION_IDENTITY_PORT,
    },
    SituationRepository,
    SituationShadowRepository,
    SituationService,
  ],
  exports: [SituationService],
})
export class SituationModule {}
