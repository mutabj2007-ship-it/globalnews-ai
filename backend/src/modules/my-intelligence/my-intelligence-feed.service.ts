import { Injectable } from '@nestjs/common';
import {
  isNewSince,
  type MyIntelligenceCountryFeed,
  type MyIntelligenceFeedResponse,
  type MyIntelligenceStory,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../database/prisma.service';
import { ArticlePersistenceService } from '../news/persistence/article-persistence.service';
import { computeArticleRef } from '../news/identity/article-ref.util';

/** Retained reporting per followed country, newest first. */
export const FEED_STORIES_PER_COUNTRY = 10;
/** The feed's reporting window: three days of retained evidence. */
export const FEED_WINDOW_MINUTES = 3 * 24 * 60;
/** The combined, deduplicated feed is bounded too. */
export const FEED_MAX_STORIES = 60;

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE R1 — FOLLOWING / FOR YOU / NEW SINCE, FROM RETAINED DATA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * RETAINED ONLY. This service can reach the database and nothing else: it is
 * given ArticlePersistenceService (PrismaService only) and no news provider,
 * so opening My Intelligence cannot fire GNews/GDELT for any user, and it
 * cannot start an analysis.
 *
 * FOLLOWS are the existing CountryFollow rows — no second preference store.
 *
 * NEW SINCE is one rule, applied once, here: isNewSince(firstSeenAt,
 * User.visitBoundaryAt). publishedAt never decides it; a story without a
 * firstSeenAt is never new and never counted; a reader with no known previous
 * visit sees nothing marked new.
 */
@Injectable()
export class MyIntelligenceFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly articles: ArticlePersistenceService,
  ) {}

  async feed(userId: string): Promise<MyIntelligenceFeedResponse> {
    const [user, follows] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { visitBoundaryAt: true } }),
      this.prisma.countryFollow.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { countryCode: true },
      }),
    ]);
    const previousSeenAt: string | null = user?.visitBoundaryAt ? user.visitBoundaryAt.toISOString() : null;

    const perCountry = await Promise.all(
      follows.map(async ({ countryCode }: { countryCode: string }) => ({
        countryCode,
        articles: await this.articles.findRecentByCountry({
          countryCode,
          limit: FEED_STORIES_PER_COUNTRY,
          maxAgeMinutes: FEED_WINDOW_MINUTES,
          relevantOnly: true,
        }),
      })),
    );

    const byRef = new Map<string, MyIntelligenceStory & { countryCodes: string[] }>();
    const followedCountries: MyIntelligenceCountryFeed[] = [];

    for (const { countryCode, articles } of perCountry) {
      let newSinceCount = 0;
      for (const article of articles) {
        const articleRef = computeArticleRef(article.url);
        const newSince = isNewSince(article.firstSeenAt, previousSeenAt);
        if (newSince) newSinceCount += 1;

        const existing = byRef.get(articleRef);
        if (existing) {
          if (!existing.countryCodes.includes(countryCode)) existing.countryCodes.push(countryCode);
          continue;
        }
        byRef.set(articleRef, {
          articleRef,
          id: article.id,
          url: article.url,
          title: article.title,
          sourceName: article.sourceName,
          publishedAt: article.publishedAt,
          ...(article.publishedAtBasis ? { publishedAtBasis: article.publishedAtBasis } : {}),
          ...(article.imageUrl ? { imageUrl: article.imageUrl } : {}),
          countryCodes: [countryCode],
          ...(article.firstSeenAt ? { firstSeenAt: article.firstSeenAt } : {}),
          newSince,
        });
      }
      followedCountries.push({ countryCode, storyCount: articles.length, newSinceCount });
    }

    const stories = [...byRef.values()]
      .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
      .slice(0, FEED_MAX_STORIES);

    return {
      previousSeenAt,
      followedCountries,
      stories,
      /* Counted over distinct stories, so a story in two followed countries counts once. */
      newSinceCount: stories.filter((story) => story.newSince).length,
      source: 'retained',
    };
  }
}
