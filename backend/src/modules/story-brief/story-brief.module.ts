import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { StoriesModule } from '../stories/stories.module';
import { AskV2Module } from '../ask-v2/ask-v2.module';
import { StoryBriefGate } from '../stories/story-gate.guards';
import { AskRequestContextInterceptor } from '../ask-v2/ask-request-context';
import { StoryBriefService } from './story-brief.service';
import { StoryBriefController } from './story-brief.controller';
import { AdminStoryBriefController } from './admin-story-brief.controller';
import { AdminModule } from '../admin/admin.module';
import { STORY_BRIEF_GENERATOR } from './story-brief.generator';
import { AskGovernedStoryBriefGenerator } from './ask-governed-story-brief.generator';

/**
 * EA-STORY-BRIEF-01 — the canonical Story Brief, COMPOSED above both lanes it needs:
 *   StoriesModule  canonical story identity (read-only use; Stage B stays narrow — it imports no Ask)
 *   AskV2Module    the ONE governed compute path (no second AI execution path)
 * Ask never imports this module and never reads Discussion; this module never reads Discussion.
 * Gate STORY_BRIEF_ENABLED (default OFF → 404).
 */
@Module({
  imports: [ConfigModule, AuthModule, AdminModule, StoriesModule, AskV2Module],
  controllers: [StoryBriefController, AdminStoryBriefController],
  providers: [
    StoryBriefGate,
    AskRequestContextInterceptor,
    StoryBriefService,
    AskGovernedStoryBriefGenerator,
    { provide: STORY_BRIEF_GENERATOR, useExisting: AskGovernedStoryBriefGenerator },
  ],
})
export class StoryBriefModule {}
