import { Injectable, Logger } from '@nestjs/common';
import {
  COUNTRIES,
  HOME_REGION_ORDER,
  STORY_SEARCH_MAX_LENGTH,
  STORY_SEARCH_MIN_LENGTH,
  MY_INTELLIGENCE_INTERESTS,
  type HomeEditorialDomain,
  type HomeEditorialResponse,
  type HomeRegionId,
  type StorySearchResponse,
  type StorySearchScope,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../database/prisma.service';
import { computeArticleRef } from '../news/identity/article-ref.util';
import { readPublishedAtBasis } from '../news/persistence/published-at-basis.util';
import {
  HOME_VISIBILITY_POLICY,
  REGION_MEMBERS,
  assembleHomeEditorial,
  candidatesOf,
  cardOf,
  degradedHomeEditorial,
  groupSameDevelopment,
  titleTokens,
  type DiscussionActivity,
  type HomePreferences,
  type RetainedRow,
} from './home-editorial.assemble';

/** Interests that state a business or conflict preference (MY_INTELLIGENCE_INTERESTS vocabulary). */
const INTEREST_DOMAIN: Readonly<Partial<Record<(typeof MY_INTELLIGENCE_INTERESTS)[number], HomeEditorialDomain>>> = {
  economy_markets: 'business',
  energy_infrastructure: 'business',
  security_conflict: 'conflict',
};

const ALL_REGION_ISO3 = [...new Set(HOME_REGION_ORDER.flatMap((id) => [...REGION_MEMBERS[id]]))];
const CACHE_MS = 60_000;
const SEARCH_ROW_CAP = 300;
const SEARCH_RESULT_CAP = 30;

/**
 * PHONE-FIRST HOME CORRECTION R1 — reads the RETAINED store only (Article ⋈ ArticleCountry, the
 * canonical Story links and visible Discussion). It never calls a news provider, never runs AI and
 * never writes: browsing Home or searching stories cannot spend quota or create a conversation.
 */
@Injectable()
export class HomeEditorialService {
  private readonly logger = new Logger(HomeEditorialService.name);
  private cache: { at: number; rows: RetainedRow[]; storyIdByUrl: Map<string, string>; discussion: Map<string, DiscussionActivity> } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private toRow(a: {
    id: string;
    url: string;
    title: string;
    summary: string;
    imageUrl: string | null;
    sourceId: string;
    sourceName: string;
    category: string;
    publishedAt: Date;
    publishedAtBasis: string;
    fetchedAt: Date;
    countries: { countryCode: string; relevanceScore: number; isRelevant: boolean }[];
  }): RetainedRow {
    return {
      id: a.id,
      url: a.url,
      title: a.title,
      summary: a.summary,
      imageUrl: a.imageUrl,
      sourceId: a.sourceId,
      sourceName: a.sourceName,
      category: a.category,
      publishedAt: a.publishedAt,
      publishedAtBasis: readPublishedAtBasis(a.publishedAtBasis) ?? 'observed',
      fetchedAt: a.fetchedAt,
      countries: a.countries.filter((c) => c.isRelevant).map((c) => ({ iso3: c.countryCode, relevance: c.relevanceScore })),
    };
  }

  private async identityAndDiscussion(rows: readonly RetainedRow[], now: Date): Promise<{ storyIdByUrl: Map<string, string>; discussion: Map<string, DiscussionActivity> }> {
    const refToUrl = new Map(rows.map((r) => [computeArticleRef(r.url), r.url]));
    const links = refToUrl.size === 0 ? [] : await this.prisma.storyArticle.findMany({
      where: { articleRef: { in: [...refToUrl.keys()] } },
      select: { articleRef: true, story: { select: { id: true, mergedIntoId: true } } },
    });
    const storyIdByUrl = new Map<string, string>();
    for (const l of links) {
      const url = refToUrl.get(l.articleRef);
      if (url !== undefined) storyIdByUrl.set(url, l.story.mergedIntoId ?? l.story.id);
    }
    const discussion = new Map<string, DiscussionActivity>();
    const storyIds = [...new Set(storyIdByUrl.values())];
    if (storyIds.length > 0) {
      const since = new Date(now.getTime() - HOME_VISIBILITY_POLICY.discussionWindowDays * 24 * 3_600_000);
      const aliases = await this.prisma.story.findMany({ where: { mergedIntoId: { in: storyIds } }, select: { id: true, mergedIntoId: true } });
      const canonicalOf = new Map<string, string>(storyIds.map((id) => [id, id]));
      for (const a of aliases) if (a.mergedIntoId) canonicalOf.set(a.id, a.mergedIntoId);
      const comments = await this.prisma.storyComment.findMany({
        where: { storyId: { in: [...canonicalOf.keys()] }, state: 'VISIBLE', createdAt: { gte: since } },
        select: { storyId: true, userId: true, createdAt: true },
      });
      const acc = new Map<string, { comments: number; users: Set<string>; last: Date }>();
      for (const c of comments) {
        const id = canonicalOf.get(c.storyId) ?? c.storyId;
        const a = acc.get(id) ?? { comments: 0, users: new Set<string>(), last: c.createdAt };
        a.comments++;
        a.users.add(c.userId);
        if (c.createdAt > a.last) a.last = c.createdAt;
        acc.set(id, a);
      }
      for (const [id, a] of acc) discussion.set(id, { comments: a.comments, participants: a.users.size, lastActivityAt: a.last });
    }
    return { storyIdByUrl, discussion };
  }

  private async load(now: Date): Promise<NonNullable<HomeEditorialService['cache']>> {
    if (this.cache !== null && now.getTime() - this.cache.at < CACHE_MS) return this.cache;
    const since = new Date(now.getTime() - HOME_VISIBILITY_POLICY.earlierWindowDays * 24 * 3_600_000);
    const articles = await this.prisma.article.findMany({
      where: {
        publishedAt: { gte: since },
        countries: { some: { isRelevant: true, countryCode: { in: ALL_REGION_ISO3 } } },
      },
      select: {
        id: true, url: true, title: true, summary: true, imageUrl: true, sourceId: true, sourceName: true,
        category: true, publishedAt: true, publishedAtBasis: true, fetchedAt: true,
        countries: { select: { countryCode: true, relevanceScore: true, isRelevant: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 2000,
    });
    const rows = articles.map((a) => this.toRow(a));
    const { storyIdByUrl, discussion } = await this.identityAndDiscussion(rows, now);
    this.cache = { at: now.getTime(), rows, storyIdByUrl, discussion };
    return this.cache;
  }

  async preferencesFor(userId: string | null): Promise<HomePreferences | null> {
    if (userId === null) return null;
    const [follows, interests] = await Promise.all([
      this.prisma.countryFollow.findMany({ where: { userId }, select: { countryCode: true } }),
      this.prisma.userIntelligenceInterest.findMany({ where: { userId }, select: { interest: true } }),
    ]);
    const domains = new Set<HomeEditorialDomain>();
    for (const i of interests) {
      const d = INTEREST_DOMAIN[i.interest as keyof typeof INTEREST_DOMAIN];
      if (d !== undefined) domains.add(d);
    }
    return { countries: new Set(follows.map((f) => f.countryCode)), domains };
  }

  async editorial(userId: string | null, now: Date = new Date()): Promise<HomeEditorialResponse> {
    try {
      const [data, preferences] = await Promise.all([this.load(now), this.preferencesFor(userId)]);
      return assembleHomeEditorial({
        rows: data.rows,
        storyIdByUrl: data.storyIdByUrl,
        discussionByStory: data.discussion,
        preferences,
        now,
      });
    } catch (error) {
      this.logger.warn(`home editorial read failed: ${(error as Error).message}`);
      return degradedHomeEditorial(now);
    }
  }

  /**
   * Persisted story search (contract §7). Retained reports only, case-insensitive word match on
   * headline, publisher summary, publisher and primary country; a country NAME also matches the
   * article's relevant countries. Default scope = Home-eligible business/conflict stories in the
   * three priority regions; `ALL_RETAINED` is the explicitly labelled broader archive.
   */
  async search(input: {
    q: string;
    scope: StorySearchScope;
    region: HomeRegionId | null;
    domain: HomeEditorialDomain | null;
    days: number | null;
    now?: Date;
  }): Promise<StorySearchResponse> {
    const now = input.now ?? new Date();
    const q = input.q.trim().replace(/\s+/g, ' ').slice(0, STORY_SEARCH_MAX_LENGTH);
    const base: StorySearchResponse = { query: q, scope: input.scope, region: input.region, domain: input.domain, days: input.days, results: [], matched: 0, relaxed: false };
    /* Browsing a region ("See all") needs no words; otherwise at least two characters. */
    const browse = q.length === 0 && input.region !== null;
    if (!browse && q.length < STORY_SEARCH_MIN_LENGTH) return base;

    const words = [...titleTokens(q)].slice(0, 6);
    const terms = browse ? [] : words.length > 0 ? words : [q.toLowerCase()];
    const countryHits = COUNTRIES.filter((c) => {
      const name = c.name.toLowerCase();
      return name === q.toLowerCase() || terms.some((t) => t.length >= 4 && name === t);
    }).map((c) => c.iso3);

    const run = async (needles: string[]) => {
      const textMatch = (n: string) => ({
        OR: [
          { title: { contains: n, mode: 'insensitive' as const } },
          { summary: { contains: n, mode: 'insensitive' as const } },
          { sourceName: { contains: n, mode: 'insensitive' as const } },
          { countryName: { contains: n, mode: 'insensitive' as const } },
        ],
      });
      const regionIso = input.region === null ? null : [...REGION_MEMBERS[input.region]];
      return this.prisma.article.findMany({
        where: {
          AND: [
            countryHits.length > 0
              ? { OR: [{ AND: needles.map(textMatch) }, { countries: { some: { isRelevant: true, countryCode: { in: countryHits } } } }] }
              : { AND: needles.map(textMatch) },
            ...(input.days === null ? [] : [{ publishedAt: { gte: new Date(now.getTime() - input.days * 24 * 3_600_000) } }]),
            ...(regionIso === null ? [] : [{ countries: { some: { isRelevant: true, countryCode: { in: regionIso } } } }]),
          ],
        },
        select: {
          id: true, url: true, title: true, summary: true, imageUrl: true, sourceId: true, sourceName: true,
          category: true, publishedAt: true, publishedAtBasis: true, fetchedAt: true,
          countries: { select: { countryCode: true, relevanceScore: true, isRelevant: true } },
        },
        orderBy: { publishedAt: 'desc' },
        take: SEARCH_ROW_CAP,
      });
    };

    let relaxed = false;
    let found = await run(terms);
    if (found.length === 0 && terms.some((t) => t.length >= 6)) {
      /* Sensible tolerance without fuzzy indexes: retry on word stems (first 5 letters). */
      relaxed = true;
      found = await run(terms.map((t) => (t.length >= 6 ? t.slice(0, 5) : t)));
    }
    const rows = found.map((a) => this.toRow(a));
    const eligibleOnly = input.scope === 'HOME_ELIGIBLE';
    let candidates = candidatesOf(rows, now, eligibleOnly);
    if (!eligibleOnly) {
      /* Broader archive: every real retained report, still never sport/entertainment-gated away
         silently — the label says it is the whole archive. */
      const eligibleIds = new Set(candidates.map((c) => c.row.id));
      candidates = [
        ...candidates,
        ...rows
          .filter((r) => !eligibleIds.has(r.id) && !r.id.startsWith('mock-') && !(r.sourceId ?? '').startsWith('mock-'))
          .map((row) => ({
            row,
            domains: [] as HomeEditorialDomain[],
            primary: 'business' as HomeEditorialDomain,
            signals: [] as string[],
            strength: 0,
            tokens: titleTokens(row.title),
            regionRelevance: new Map(),
          })),
      ];
    }
    if (input.domain !== null) candidates = candidates.filter((c) => c.domains.includes(input.domain!));
    const groups = groupSameDevelopment(candidates);
    const { storyIdByUrl, discussion } = await this.identityAndDiscussion(groups.map((g) => g.lead.row), now);
    const phrase = q.toLowerCase();
    const results = groups
      .map((g) => {
        const { card } = cardOf(g, storyIdByUrl, discussion, now, HOME_VISIBILITY_POLICY);
        const exact = g.members.some((m) => m.row.title.toLowerCase().includes(phrase)) ? 1 : 0;
        return { card: eligibleOnly ? card : { ...card, signals: g.lead.signals }, exact, at: g.lead.row.publishedAt.getTime() };
      })
      .sort((a, b) => b.exact - a.exact || b.at - a.at)
      .slice(0, SEARCH_RESULT_CAP)
      .map((x) => x.card);
    return { ...base, results, matched: rows.length, relaxed };
  }
}
