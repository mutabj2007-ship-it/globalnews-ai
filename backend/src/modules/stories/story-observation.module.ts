import { Global, Injectable, Logger, Module } from '@nestjs/common';
import type { NewsArticle } from '@globalnews-ai/shared';
import { RETAINED_ARTICLE_OBSERVER, type RetainedArticleObserver } from '../news/persistence/retained-article-observer.port';
import { StoryIdentityService } from './story-identity.service';

/**
 * STAGE B — the retained-article observer bound to the news persistence port.
 *
 * Normal Article persistence → (after commit) → `observeRetained` → StoryIdentityService
 * `observeRetainedForAlerts`: DATABASE ONLY, bounded, idempotent, join-on-proof only into
 * stories with an ACTIVE in-app alert, never creating a story. No provider, model, network,
 * scheduler, Watch or Follow. It never throws: failures are logged here (and the persistence
 * service catches again), so observation cannot fail news retrieval.
 *
 * GLOBAL and dependency-free beyond the global PrismaService, so NewsModule receives the port
 * without importing the stories module (no module cycle, news stays session-blind).
 */
@Injectable()
export class StoryAlertObserver implements RetainedArticleObserver {
  private readonly logger = new Logger(StoryAlertObserver.name);

  constructor(private readonly identity: StoryIdentityService) {}

  async observeRetained(articles: readonly NewsArticle[]): Promise<void> {
    try {
      await this.identity.observeRetainedForAlerts(articles);
    } catch (error) {
      this.logger.warn(`Retained-article observation skipped: ${error instanceof Error ? error.message : 'error'}`);
    }
  }
}

@Global()
@Module({
  providers: [StoryIdentityService, StoryAlertObserver, { provide: RETAINED_ARTICLE_OBSERVER, useExisting: StoryAlertObserver }],
  exports: [RETAINED_ARTICLE_OBSERVER],
})
export class StoryObservationModule {}
