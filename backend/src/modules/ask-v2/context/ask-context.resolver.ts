import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  ARTICLE_REF_PATTERN,
  GEOGRAPHY_COUNTRY_CODE_PATTERN,
  resolveGovernedCountryCode,
  type NewsArticle,
  type StoryContext,
} from '@globalnews-ai/shared';
import { NewsService } from '../../news/news.service';
import { computeArticleRef } from '../../news/identity/article-ref.util';
import { ASK_CONTEXT_KEYS, ASK_CONTEXT_URL_MAX } from './ask-turn-context.dto';
import { RESOLVED_STORY_BOUNDS, type ResolvedAskContext } from './resolved-ask-context';

/**
 * UNIFIED INTELLIGENCE BINDING R2B — the named, deterministic context refusals. Each is raised
 * BEFORE any guest preflight, operation, slot, meter reservation, planner, provider or model:
 * a context that cannot be resolved produces zero compute and never degrades to a generic Ask.
 */
export type AskContextRefusalCode =
  /** Not one of the two kinds, wrong key set (cross-kind or extra fields), or malformed. */
  | 'ASK_CONTEXT_INVALID'
  /** articleRef is not exactly sha256(normalizeArticleUrl(url)). */
  | 'ASK_CONTEXT_STORY_REF_MISMATCH'
  /** No RETAINED article under that reference (or the store could not be read). */
  | 'ASK_CONTEXT_STORY_NOT_FOUND'
  /** The retained article's own fields exceed the persisted-plan bounds. */
  | 'ASK_CONTEXT_STORY_OUT_OF_BOUNDS'
  /** Not an ISO alpha-2/alpha-3 code of a governed country. */
  | 'ASK_CONTEXT_GEOGRAPHY_UNKNOWN'
  /** The resolver is not bound (a construction without it); context fails closed. */
  | 'ASK_CONTEXT_UNAVAILABLE';

const STATUS: Readonly<Record<AskContextRefusalCode, HttpStatus>> = {
  ASK_CONTEXT_INVALID: HttpStatus.BAD_REQUEST,
  ASK_CONTEXT_STORY_REF_MISMATCH: HttpStatus.BAD_REQUEST,
  ASK_CONTEXT_STORY_NOT_FOUND: HttpStatus.UNPROCESSABLE_ENTITY,
  ASK_CONTEXT_STORY_OUT_OF_BOUNDS: HttpStatus.UNPROCESSABLE_ENTITY,
  ASK_CONTEXT_GEOGRAPHY_UNKNOWN: HttpStatus.UNPROCESSABLE_ENTITY,
  ASK_CONTEXT_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
};

export class AskContextRefused extends HttpException {
  constructor(readonly code: AskContextRefusalCode) {
    super({ statusCode: STATUS[code], code }, STATUS[code]);
    this.name = 'AskContextRefused';
  }
}

/** The ONE read this resolver may perform: retained reporting, by URL, database only. */
export type RetainedStoryReader = Pick<NewsService, 'findRetainedArticleByUrl'>;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * UNIFIED INTELLIGENCE BINDING R2B — the ONE bounded, read-only context resolver.
 *
 * STORY      verify articleRef === sha256(normalizeArticleUrl(url)), then ONE retained-article
 *            lookup by URL (NewsService.findRetainedArticleByUrl → ArticlePersistenceService
 *            .findRetainedByUrl: a Prisma read; no provider, no publisher fetch, no model). The
 *            StoryContext is built from the stored row only; the stored row must itself be the
 *            same story (its URL hashes to the same articleRef).
 * GEOGRAPHY  resolveGovernedCountryCode() over the shared registry; canonical ISO3; display
 *            name from the registry. No I/O at all.
 */
@Injectable()
export class AskContextResolver {
  constructor(@Inject(NewsService) private readonly stories: RetainedStoryReader) {}

  async resolve(raw: unknown): Promise<ResolvedAskContext> {
    if (!isObject(raw) || (raw.kind !== 'STORY' && raw.kind !== 'GEOGRAPHY')) {
      throw new AskContextRefused('ASK_CONTEXT_INVALID');
    }
    const allowed = ASK_CONTEXT_KEYS[raw.kind];
    const keys = Object.keys(raw).filter((k) => raw[k] !== undefined);
    if (!keys.every((k) => allowed.includes(k)) || !allowed.every((k) => keys.includes(k))) {
      throw new AskContextRefused('ASK_CONTEXT_INVALID');
    }
    return raw.kind === 'STORY'
      ? this.resolveStory(raw.articleRef, raw.url)
      : this.resolveGeography(raw.countryCode);
  }

  private async resolveStory(articleRef: unknown, url: unknown): Promise<ResolvedAskContext> {
    if (
      typeof articleRef !== 'string' ||
      !ARTICLE_REF_PATTERN.test(articleRef) ||
      typeof url !== 'string' ||
      url.length < 8 ||
      url.length > ASK_CONTEXT_URL_MAX ||
      !/^https?:\/\/\S+$/i.test(url)
    ) {
      throw new AskContextRefused('ASK_CONTEXT_INVALID');
    }
    if (computeArticleRef(url) !== articleRef) {
      throw new AskContextRefused('ASK_CONTEXT_STORY_REF_MISMATCH');
    }
    /* Lookup data only — the URL is matched against the local Article table, never fetched. */
    let article: NewsArticle | null;
    try {
      article = await this.stories.findRetainedArticleByUrl(url);
    } catch {
      article = null;
    }
    if (article === null || computeArticleRef(article.url) !== articleRef) {
      throw new AskContextRefused('ASK_CONTEXT_STORY_NOT_FOUND');
    }
    const title = (article.title ?? '').trim();
    const articleId = (article.id ?? '').trim();
    const sourceName = (article.sourceName ?? '').trim();
    if (
      title.length === 0 ||
      title.length > RESOLVED_STORY_BOUNDS.title ||
      articleId.length === 0 ||
      articleId.length > RESOLVED_STORY_BOUNDS.articleId ||
      article.url.length > RESOLVED_STORY_BOUNDS.url ||
      sourceName.length > RESOLVED_STORY_BOUNDS.sourceName
    ) {
      throw new AskContextRefused('ASK_CONTEXT_STORY_OUT_OF_BOUNDS');
    }
    /* The stored article's OWN country, only when it is a governed code. Never invented,
       never taken from the client, never guessed from a name. */
    const country = resolveGovernedCountryCode(article.countryCode);
    const storyContext: StoryContext = {
      title,
      articleId,
      url: article.url,
      ...(sourceName.length > 0 ? { sourceName } : {}),
      ...(country !== undefined ? { countryCode: country.iso3 } : {}),
    };
    return {
      kind: 'STORY',
      articleRef,
      articleId,
      ...(country !== undefined ? { countryIso3: country.iso3 } : {}),
      storyContext,
    };
  }

  private resolveGeography(countryCode: unknown): ResolvedAskContext {
    if (typeof countryCode !== 'string' || !GEOGRAPHY_COUNTRY_CODE_PATTERN.test(countryCode)) {
      throw new AskContextRefused('ASK_CONTEXT_GEOGRAPHY_UNKNOWN');
    }
    const country = resolveGovernedCountryCode(countryCode);
    if (country === undefined) throw new AskContextRefused('ASK_CONTEXT_GEOGRAPHY_UNKNOWN');
    return {
      kind: 'GEOGRAPHY',
      countryIso3: country.iso3,
      geographyContext: { countryCode: country.iso3, displayName: country.name },
    };
  }
}
