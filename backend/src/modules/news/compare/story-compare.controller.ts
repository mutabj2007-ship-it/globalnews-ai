import { Body, Controller, HttpCode, NotFoundException, Optional, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import {
  MAX_SELECTED_STORIES,
  type NewsArticle,
  type SelectedStoryRef,
} from '@globalnews-ai/shared';
import { SelectedStoryRefDto } from '../../analysis/dto/analyze-news.dto';
import { articleRefMatchesUrl } from '../identity/article-ref.util';
import { NewsService } from '../news.service';
import { PrismaService } from '../../../database/prisma.service';
import { readStoryRelations, type StoryIdentityRead } from '../../stories/story-relation.read';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE A — THE ZERO-AI COMPARE READ MODEL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Claude H §11: "resolving an articleRef to a held article without running analysis
 * (there is no such read route today — only POST /analysis/news)". This is that route and
 * nothing more: each `{articleRef, url}` pair (the existing selection identity, at most
 * MAX_SELECTED_STORIES) is verified — the URL must hash to the articleRef — and read from
 * RETAINED reporting. No provider search, no publisher fetch, no model, no write, no
 * session. An unresolved pair is returned as `unavailable` with its reason, so the Compare
 * view says "Not available" instead of silently dropping a column.
 *
 * Returned fields are the retained Article row's own public metadata — the same fields the
 * Home card already shows. No body, no summary rewriting.
 *
 * STAGE B — IDENTITY ENRICHMENT. The one relation Compare may state is read from stored
 * canonical story identity (stories/story-relation.read.ts): SAME_STORY, SEPARATED_BY_EDITOR or
 * NOT_ESTABLISHED, per pair of AVAILABLE articles. Read-only — comparing never creates a story.
 * If the identity read fails (e.g. tables absent before the migration), `identity` is omitted
 * and the view shows no relation row: absence, never a guess. No agreement, disagreement,
 * claim, causality or gap is produced here.
 *
 * GATE: `COMPARE_READ_ENABLED` (deployment literal 'true', server-only). Off — the
 * default — the route is a 404, so it does not exist until it is released. Checked in the
 * handler, not by a guard: the public news module stays structurally session-blind (no
 * guards, no identity — news-session-blindness.spec.ts).
 */

export class ResolveStoriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SELECTED_STORIES)
  @ValidateNested({ each: true })
  @Type(() => SelectedStoryRefDto)
  stories!: SelectedStoryRefDto[];
}

export interface ResolvedStoryView {
  readonly articleRef: string;
  readonly status: 'available' | 'unavailable';
  readonly reason?: 'REF_URL_MISMATCH' | 'NOT_RETAINED' | 'LOOKUP_FAILED';
  readonly article?: {
    readonly title: string;
    readonly url: string;
    readonly imageUrl: string | null;
    readonly sourceName: string;
    readonly sourcesCount: number;
    readonly category: string;
    readonly publishedAt: string;
    readonly publishedAtBasis: string;
    readonly countryCode: string | null;
    readonly countryName: string | null;
  };
}

/** The release gate, as the exact deployment literal (the switches' KS-6 rule). */
export function compareReadEnabled(config: Pick<ConfigService, 'get'>): boolean {
  return config.get<string>('COMPARE_READ_ENABLED') === 'true';
}

/** Pure projection of a retained article onto the Compare view's public fields. */
export function compareViewOf(article: NewsArticle): NonNullable<ResolvedStoryView['article']> {
  return {
    title: article.title,
    url: article.url,
    imageUrl: article.imageUrl ?? null,
    sourceName: article.sourceName,
    sourcesCount: article.sourcesCount,
    category: article.category,
    publishedAt: article.publishedAt,
    publishedAtBasis: article.publishedAtBasis ?? 'publisher',
    countryCode: article.countryCode ?? null,
    countryName: article.countryName ?? null,
  };
}

/** Resolve a selection against retained reporting. Database reads only. */
export async function resolveStoriesForCompare(
  news: Pick<NewsService, 'findRetainedArticleByUrl'>,
  stories: readonly SelectedStoryRef[],
): Promise<ResolvedStoryView[]> {
  const seen = new Set<string>();
  const unique = stories.filter((s) => (seen.has(s.articleRef) ? false : (seen.add(s.articleRef), true)));
  return Promise.all(
    unique.map(async (story): Promise<ResolvedStoryView> => {
      if (!articleRefMatchesUrl(story.articleRef, story.url)) {
        return { articleRef: story.articleRef, status: 'unavailable', reason: 'REF_URL_MISMATCH' };
      }
      try {
        const article = await news.findRetainedArticleByUrl(story.url);
        return article === null
          ? { articleRef: story.articleRef, status: 'unavailable', reason: 'NOT_RETAINED' }
          : { articleRef: story.articleRef, status: 'available', article: compareViewOf(article) };
      } catch {
        return { articleRef: story.articleRef, status: 'unavailable', reason: 'LOOKUP_FAILED' };
      }
    }),
  );
}

/** Identity relations for the AVAILABLE (verified, retained) articles only; null on any failure. */
export async function readIdentityFor(
  prisma: PrismaService | undefined,
  stories: readonly ResolvedStoryView[],
): Promise<StoryIdentityRead | null> {
  const refs = stories.filter((s) => s.status === 'available').map((s) => s.articleRef);
  if (prisma === undefined || refs.length === 0) return null;
  try {
    return await readStoryRelations(prisma, refs);
  } catch {
    return null;
  }
}

@Controller('news/stories')
export class StoryCompareController {
  constructor(
    private readonly news: NewsService,
    private readonly config: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  /** POST /news/stories/resolve — 0 AI · 0 provider · 0 write. */
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('resolve')
  @HttpCode(200)
  async resolve(@Body() dto: ResolveStoriesDto): Promise<{ stories: ResolvedStoryView[]; identity?: StoryIdentityRead }> {
    if (!compareReadEnabled(this.config)) throw new NotFoundException();
    const stories = await resolveStoriesForCompare(this.news, dto.stories);
    const identity = await readIdentityFor(this.prisma, stories);
    return identity === null ? { stories } : { stories, identity };
  }
}
