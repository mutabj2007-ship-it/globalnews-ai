import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ArticlePersistenceService } from '../news/persistence/article-persistence.service';
import { MyIntelligenceController } from './my-intelligence.controller';
import { MyIntelligenceFeedService } from './my-intelligence-feed.service';
import { MyIntelligenceInterestsService } from './my-intelligence-interests.service';
import { SavedStoriesController } from './saved-stories.controller';
import { SavedStoriesService } from './saved-stories.service';

/**
 * MY INTELLIGENCE R1.
 *
 * DELIBERATELY DOES NOT IMPORT NewsModule OR AnalysisModule. The only data
 * access is ArticlePersistenceService, whose sole dependency is the global
 * PrismaService — so nothing in this module can reach GNews, GDELT, any RSS
 * provider or the analysis provider. That is the structural guarantee behind
 * "opening My Intelligence = 0 provider calls, 0 AI calls".
 */
@Module({
  imports: [AuthModule],
  controllers: [SavedStoriesController, MyIntelligenceController],
  providers: [ArticlePersistenceService, SavedStoriesService, MyIntelligenceFeedService, MyIntelligenceInterestsService],
})
export class MyIntelligenceModule {}
