import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalysisModule } from '../analysis/analysis.module';
import { AuthModule } from '../auth/auth.module';
import { ComputeModule } from '../compute/compute.module';
import { AskController } from './ask.controller';
import { AskService } from './ask.service';
import { AskThreadService } from './thread/ask-thread.service';
import { AskOwnerService } from './owner/ask-owner.service';
import { EvidenceRevisionService } from './evidence/evidence-revision.service';

/**
 * BETA-SIMPLE-ASK-SAND-1 §3 — Ask AI Conversational V2.
 *
 * Composes existing capabilities rather than replacing them:
 *
 *   AnalysisModule — for AnalysisService.analyzeNews(), the existing,
 *     proven retrieval/synthesis path. §25 forbids redesigning
 *     retrieval and §26 protects every surface that reads
 *     AnalysisApiResponse, so Ask consumes that contract untouched.
 *   AuthModule     — for SessionService, so a signed-in caller's
 *     threads are keyed by userId. Ask itself stays unauthenticated.
 *   ComputeModule  — for classification, quoting, stored-result reuse,
 *     the operation lifecycle, the ledger and telemetry.
 *
 * ADDITIVE ONLY: no existing module's providers, exports or routes are
 * modified. AnalysisModule already exports AnalysisService and
 * AuthModule already exports SessionService (both verified against
 * their module definitions at baseline main@41428ea) — neither needed
 * a change to support this.
 *
 * `imports: [ConfigModule]` is the bare form, following the
 * SignalsModule (M64.3) correction: AppModule calls .forRoot() once
 * at the root, and a feature module declares its own ConfigService
 * dependency explicitly so it remains independently compilable in a
 * standalone Nest testing module.
 */
@Module({
  imports: [ConfigModule, AnalysisModule, AuthModule, ComputeModule],
  controllers: [AskController],
  providers: [AskService, AskThreadService, AskOwnerService, EvidenceRevisionService],
  exports: [AskService],
})
export class AskModule {}
