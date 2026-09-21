import { Module } from '@nestjs/common';
import { BetaController } from './beta.controller';
import { BetaCategoryService } from './category/beta-category.service';

/**
 * BETA-SIMPLE-ASK-SAND-1 §15/§16/§17 — the simplified public Beta
 * entry layer.
 *
 * DEPENDS ON NOTHING BUT THE DATABASE. There is no import of
 * NewsModule, AnalysisModule, SignalsModule or ComputeModule here,
 * and that is the §16 guarantee expressed structurally: this module
 * has no reference to anything that could run a provider call or a
 * model call, so a category click cannot trigger expensive synthesis
 * even by accident in a future change. PrismaService arrives via the
 * @Global() PrismaModule.
 *
 * It does not import ComputeModule either. A category view is
 * CONTEXTUAL and free by construction, so there is nothing to quote,
 * meter or record — creating an operation row for a plain read would
 * add ledger noise with no accounting value. The classifier and
 * pricing service still cap and zero this kind independently, for the
 * case where a category view is ever reached THROUGH the compute path
 * (see classify-compute.util.ts and sand-pricing.service.ts).
 */
@Module({
  controllers: [BetaController],
  providers: [BetaCategoryService],
  exports: [BetaCategoryService],
})
export class BetaModule {}
