import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { AdminSupportController } from './admin-support.controller';
import { AdminSupportService } from './admin-support.service';
import { SupportAiService } from './support-ai.service';

/**
 * S2 — the user support module.
 *
 * S1 registered this module empty so that the wiring point would be
 * reviewed on its own rather than appearing later mixed in with
 * behaviour. This is that later: the module gains exactly one
 * controller and one service, and nothing else.
 *
 * AuthModule is imported for RequireAuthGuard and CsrfGuard, which it
 * already exports for UsersModule and HistoryModule — the same
 * dependency, not a second copy of session validation. PrismaModule is
 * @Global(), so PrismaService needs no import here, matching
 * HistoryModule exactly.
 *
 * S3 — the module gains the ADMIN side of the same support system: one
 * more controller and one more service, over the SAME two tables. There
 * is no second Support implementation anywhere in this codebase, and
 * this is the wiring point that keeps it that way.
 *
 * AdminModule is imported for AdminGuard and AdminPlatformEnabledGuard,
 * which it now exports. That is a deliberate reuse of F1.a's existing
 * authorization rather than a second copy of it: the admin support
 * routes are authorized by exactly the guard every other admin route is
 * authorized by, so a change to the admin security model reaches this
 * surface automatically instead of leaving it behind. The dependency is
 * one-directional — AdminModule knows nothing about support.
 *
 * SUPPORT-AI-1 — THIS MODULE NOW REACHES THE ANALYSIS PIPELINE, AND
 * THAT SENTENCE REPLACES ONE THAT SAID IT NEVER WOULD. The previous
 * comment here recorded, correctly for its time, that there was no
 * AnalysisModule import and no NEWS_QUESTION special case. Both are now
 * false, so the comment is rewritten rather than left standing as a
 * claim the code contradicts.
 *
 * WHAT IS TRUE INSTEAD, AND IS ASSERTED BY THE CONTRACT SPECS:
 *
 *   - AnalysisModule is IMPORTED, not reimplemented. It already exports
 *     AnalysisService and nothing inside modules/analysis is modified.
 *     There is no second analysis pipeline and no OpenAI client
 *     anywhere under modules/support.
 *   - SupportAiService is the ONLY file in this module that names
 *     AnalysisService. It is not exported: nothing outside support has
 *     any business invoking the support agent.
 *   - The ADMIN side still performs no AI work at all. An
 *     administrator's message is authored as ADMIN and nothing on that
 *     surface calls a provider.
 *
 * The dependency stays one-directional, exactly as it does with
 * AdminModule: the analysis module knows nothing about support.
 */
@Module({
  imports: [AuthModule, AdminModule, AnalysisModule],
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService, AdminSupportService, SupportAiService],
})
export class SupportModule {}
