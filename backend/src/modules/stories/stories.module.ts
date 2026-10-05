import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { StoryIdentityService } from './story-identity.service';
import { DiscussionService } from './discussion.service';
import { AlertsService } from './alerts.service';
import { DiscussionController } from './discussion.controller';
import { AlertsController } from './alerts.controller';
import { AdminStoriesController } from './admin-stories.controller';
import { AlertsInAppGate, DiscussionReadGate, DiscussionWriteGate } from './story-gate.guards';

/**
 * HOME R1 STAGE B — canonical story identity, Discussion and in-app Alerts.
 *
 * DELIBERATELY NARROW IMPORTS: auth (sessions, CSRF) and admin (the guard stack). No news
 * provider, no analysis, no Ask, no Watch, no scheduler, no notification transport. Exports
 * only the identity service (Compare's read-only same-story relation).
 */
@Module({
  imports: [AuthModule, AdminModule],
  controllers: [DiscussionController, AlertsController, AdminStoriesController],
  providers: [StoryIdentityService, DiscussionService, AlertsService, DiscussionReadGate, DiscussionWriteGate, AlertsInAppGate],
  exports: [StoryIdentityService],
})
export class StoriesModule {}
