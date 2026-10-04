import { Module } from '@nestjs/common';
import { ConflictObservationRepository } from '../conflict-observation/conflict-observation.repository';
import { MarketReadRepository } from '../market-ingest/market-read.repository';
import { PoliticsObservationRepository } from '../politics/politics-observation.repository';
import { EconomyModule } from '../economy/economy.module';
import { AskSpecialistReadCoordinator } from './ask-specialist-read.coordinator';

/**
 * INTELLIGENCE BINDING R1 — the governed READ seams Ask may consult, and nothing else.
 *
 * It provides the two read-only repositories DIRECTLY rather than importing their feature
 * modules, so no controller, no Conflict producer and no Market scheduler/adapter enters this
 * graph — only the classes whose headers already promise "no provider, downloader or
 * scheduler is reachable here". Economy exports only its read service (no transport).
 * PrismaService is global. No secret, no network client, no public route.
 */
@Module({
  imports: [EconomyModule],
  /* POLITICS INTEL R1 — the Politics REPOSITORY is named directly (never PoliticsReadModule), so no public
     controller and no producer enters the Ask graph (Claude C seam §2). */
  providers: [
    ConflictObservationRepository,
    MarketReadRepository,
    PoliticsObservationRepository,
    AskSpecialistReadCoordinator,
  ],
  exports: [AskSpecialistReadCoordinator],
})
export class AskIntelligenceModule {}
