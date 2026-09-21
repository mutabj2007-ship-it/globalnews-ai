import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BetaFeatureFlagsService } from './flags/beta-feature-flags.service';
import { SandPricingService } from './pricing/sand-pricing.service';
import { EntitlementService } from './entitlement/entitlement.service';
import { StoredResultService } from './stored-result/stored-result.service';
import { SandLedgerService } from './ledger/sand-ledger.service';
import { ComputeOperationService } from './operation/compute-operation.service';
import { ComputeQuoteService } from './quote/compute-quote.service';

/**
 * BETA-SIMPLE-ASK-SAND-1 §5/§6/§8/§9/§11/§12/§13/§14 — the compute,
 * metering and Sand foundation.
 *
 * NO CONTROLLER. This module registers no route and is not reachable
 * from the network. It exports services that AskModule (and, later,
 * the Beta category surfaces) consume. That is deliberate: a public
 * /compute/quote endpoint would let a caller enumerate pricing and
 * mint operation rows without ever intending to run anything, and §9's
 * flow never requires the client to call a quote endpoint directly —
 * the quote comes back attached to the Ask turn that triggered it.
 *
 * `imports: [ConfigModule]` is the bare form, NOT .forRoot(). This
 * follows the repository's own established correction on
 * SignalsModule (M64.3): AppModule calls .forRoot({ isGlobal: true })
 * exactly once at the root, and a feature module that needs
 * ConfigService declares that dependency explicitly so it stays
 * independently compilable in a standalone Nest testing module,
 * rather than relying on a sibling module's isGlobal setting
 * happening to be correct.
 *
 * PrismaService is available without an import here because
 * PrismaModule is declared @Global() (see
 * backend/src/database/prisma.module.ts) — the same way HistoryModule
 * and AuthModule already obtain it.
 *
 * NOTHING HERE PERFORMS I/O AT CONSTRUCTION. BetaFeatureFlagsService
 * reads environment strings synchronously via ConfigService; every
 * other service only stores injected references. Constructing this
 * module — or the whole application — makes zero database queries and
 * zero provider calls, under any flag configuration.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    BetaFeatureFlagsService,
    SandPricingService,
    EntitlementService,
    StoredResultService,
    SandLedgerService,
    ComputeOperationService,
    ComputeQuoteService,
  ],
  exports: [
    BetaFeatureFlagsService,
    SandPricingService,
    EntitlementService,
    StoredResultService,
    SandLedgerService,
    ComputeOperationService,
    ComputeQuoteService,
  ],
})
export class ComputeModule {}
