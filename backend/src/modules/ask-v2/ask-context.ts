import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MULTI_STORY_MIN_STORIES,
  resolveGovernedCountryCode,
  type AnalysisSelection,
  type GeographyContext,
  type MultiStoryAction,
  type StoryContext,
} from '@globalnews-ai/shared';
import { NewsService } from '../news/news.service';
import { articleRefMatchesUrl } from '../news/identity/article-ref.util';
import { hashIdentity } from './ask-compute.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE A — SERVER-RESOLVED ASK CONTEXT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The FINAL Design's `AskContextEnvelope` is NOT sent through the public DTO (Claude H,
 * report §5: DIFFERS). What travels instead is the minimal bag H justified: GOVERNED
 * IDENTIFIERS ONLY — an `entry` from a closed set, up to MAX_SELECTED_STORIES
 * `{articleRef, url}` pairs (the existing My Intelligence identity, verified here, never
 * trusted), an optional multi-story action from the existing closed set, and an optional
 * country code from the governed registry. No title, summary, body, comment, answer text,
 * evidence blob, story id, alert id, thread id, language or return path: the client never
 * describes evidence, and nothing it sends is authority.
 *
 * RESOLUTION IS A RESPONSE FIELD. Every reference resolves to `available`, `unavailable`
 * or `excluded` (with a reason code) and the operation returns that list, so an
 * unresolvable reference is SHOWN under Inspect, never silently dropped and never inferred.
 *
 * THE GATE. `ASK_CONTEXT_REFS_ENABLED` (deployment literal 'true', server-only, default
 * OFF). It is a contract release gate, not a spend switch: it moves no compute (spend stays
 * behind ASK_R2_ENABLED + ASK_PUBLIC_COMPUTE_ENABLED). OFF, a supplied bag is still
 * accepted by the DTO and every reference resolves to `excluded: CONTEXT_REFS_DISABLED`, so
 * the reader is told the context was not applied — the Send is not refused and the
 * question is answered exactly as it would be without context.
 *
 * WHAT IT FEEDS. Only the landed inputs `AnalysisService.analyzeNews` already accepts and
 * already validates: a story anchor (`StoryContext`, built here from the RETAINED article —
 * its title is the server's, never the client's), a selection (`AnalysisSelection`, which
 * the analysis path re-verifies against retained reporting), or a map geography
 * (`GeographyContext`, governed code). Never two scopes at once: a story anchor or a
 * selection outranks a geography, exactly as the legacy dock's precedence.
 */

export const ASK_CONTEXT_ENTRIES = ['home', 'story', 'compare', 'map', 'my-intelligence'] as const;
export type AskContextEntry = (typeof ASK_CONTEXT_ENTRIES)[number];

export type AskContextRefStatus = 'available' | 'unavailable' | 'excluded';

export type AskContextRefReason =
  | 'CONTEXT_REFS_DISABLED'
  | 'REF_URL_MISMATCH'
  | 'NOT_RETAINED'
  | 'LOOKUP_FAILED'
  | 'UNKNOWN_COUNTRY'
  | 'OUTRANKED_BY_STORY'
  | 'SELECTION_BELOW_MINIMUM';

/** The DTO-validated input, as the service receives it (the DTO lives in ask-v2.dto.ts). */
export interface AskContextInput {
  readonly entry: AskContextEntry;
  readonly stories?: readonly { readonly articleRef: string; readonly url: string }[];
  readonly action?: MultiStoryAction;
  readonly country?: string;
}

/** One reference and what the server made of it. `label` is server-sourced display text. */
export interface AskContextRefResolution {
  readonly kind: 'story' | 'country';
  /** articleRef for a story, the governed ISO3 for a country, the raw code when unknown. */
  readonly ref: string;
  readonly status: AskContextRefStatus;
  readonly reason?: AskContextRefReason;
  /** The retained article's own title / the registry's country name. Never client text. */
  readonly label?: string;
}

/**
 * What is persisted on the operation's plan (server-prepared, identifiers + statuses only)
 * and re-resolved at execute time. `scope` says which ONE landed input it becomes.
 */
export interface ResolvedAskContext {
  readonly version: 1;
  readonly entry: AskContextEntry;
  readonly scope: 'story' | 'selection' | 'geography' | 'none';
  readonly action: MultiStoryAction | null;
  /** Verified identities only (articleRef matched its URL), in the reader's order. */
  readonly stories: readonly { readonly articleRef: string; readonly url: string }[];
  readonly iso3: string | null;
  readonly refs: readonly AskContextRefResolution[];
}

/** The inputs the analysis path accepts, built at execute time from retained records. */
export interface AskContextExecutionInputs {
  readonly storyContext?: StoryContext;
  readonly selection?: AnalysisSelection;
  readonly geographyContext?: GeographyContext;
  /** Frozen C route context (ISO3 / refs), never prose. */
  readonly route: {
    readonly storyAnchorCountry?: string;
    readonly hasResolvedArticleAnchor?: boolean;
    readonly mapContextCountry?: string;
    readonly articleRefs?: readonly string[];
    readonly selectionAction?: MultiStoryAction;
  };
}

/** The deployment literal, exactly as the operational switches read theirs (KS-6). */
export function contextRefsEnabled(config: Pick<ConfigService, 'get'> | undefined): boolean {
  return config?.get<string>('ASK_CONTEXT_REFS_ENABLED') === 'true';
}

/**
 * The identity of a supplied bag for idempotency and fingerprinting. Order-preserving for
 * stories (the reader's order is meaningful for a selection), no labels, no statuses.
 */
export function contextIdentity(input: AskContextInput | ResolvedAskContext | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const stories = (input.stories ?? []).map((s) => s.articleRef);
  const country = 'iso3' in input ? input.iso3 : (input.country ?? null);
  return hashIdentity([
    'ask-context/1',
    input.entry,
    input.action ?? null,
    stories,
    country === null ? null : country.toUpperCase(),
  ]);
}

/** The ISO3 of a governed country, or undefined. */
function iso3Of(code: string | undefined | null): string | undefined {
  return code ? resolveGovernedCountryCode(code)?.iso3 : undefined;
}

@Injectable()
export class AskContextResolver {
  constructor(
    @Optional() private readonly news?: NewsService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  enabled(): boolean {
    return contextRefsEnabled(this.config);
  }

  /**
   * QUOTE TIME — verify every reference and decide the ONE scope it feeds. Database reads
   * only (retained Article rows); no provider, no model, no network.
   */
  async resolve(input: AskContextInput): Promise<ResolvedAskContext> {
    const supplied = input.stories ?? [];
    const country = input.country ?? null;
    if (!this.enabled()) {
      return {
        version: 1,
        entry: input.entry,
        scope: 'none',
        action: input.action ?? null,
        stories: [],
        iso3: null,
        refs: [
          ...supplied.map((s) => ({
            kind: 'story' as const,
            ref: s.articleRef,
            status: 'excluded' as const,
            reason: 'CONTEXT_REFS_DISABLED' as const,
          })),
          ...(country === null
            ? []
            : [
                {
                  kind: 'country' as const,
                  ref: country.toUpperCase(),
                  status: 'excluded' as const,
                  reason: 'CONTEXT_REFS_DISABLED' as const,
                },
              ]),
        ],
      };
    }

    const seen = new Set<string>();
    const unique = supplied.filter((s) => (seen.has(s.articleRef) ? false : (seen.add(s.articleRef), true)));
    const storyRefs: AskContextRefResolution[] = [];
    const verified: { articleRef: string; url: string }[] = [];
    for (const story of unique) {
      if (!articleRefMatchesUrl(story.articleRef, story.url)) {
        storyRefs.push({ kind: 'story', ref: story.articleRef, status: 'unavailable', reason: 'REF_URL_MISMATCH' });
        continue;
      }
      let title: string | undefined;
      try {
        title = (await this.news?.findRetainedArticleByUrl(story.url))?.title;
      } catch {
        storyRefs.push({ kind: 'story', ref: story.articleRef, status: 'unavailable', reason: 'LOOKUP_FAILED' });
        continue;
      }
      if (title === undefined) {
        storyRefs.push({ kind: 'story', ref: story.articleRef, status: 'unavailable', reason: 'NOT_RETAINED' });
        continue;
      }
      verified.push({ articleRef: story.articleRef, url: story.url });
      storyRefs.push({ kind: 'story', ref: story.articleRef, status: 'available', label: title });
    }

    /* A selection is a multi-story action: an explicit action, the Compare / My Intelligence
       entries, or more than one story. ONE story from any other entry is an anchor. */
    const isSelection =
      input.action !== undefined ||
      input.entry === 'compare' ||
      input.entry === 'my-intelligence' ||
      unique.length > 1;
    const action: MultiStoryAction | null =
      unique.length === 0 ? (input.action ?? null) : isSelection ? (input.action ?? 'ASK_SELECTED') : null;
    let scope: ResolvedAskContext['scope'] = 'none';
    if (action === null && verified.length === 1) scope = 'story';
    if (action !== null && unique.length > 0) {
      scope = 'selection';
      if (verified.length < MULTI_STORY_MIN_STORIES[action]) {
        /* Too few resolved: the analysis path answers with ZERO evidence and no AI; say why. */
        for (let i = 0; i < storyRefs.length; i += 1) {
          if (storyRefs[i].status === 'available') {
            storyRefs[i] = { ...storyRefs[i], status: 'unavailable', reason: 'SELECTION_BELOW_MINIMUM' };
          }
        }
      }
    }

    const countryRefs: AskContextRefResolution[] = [];
    let iso3: string | null = null;
    if (country !== null) {
      const meta = resolveGovernedCountryCode(country);
      if (meta === undefined) {
        countryRefs.push({ kind: 'country', ref: country.toUpperCase(), status: 'unavailable', reason: 'UNKNOWN_COUNTRY' });
      } else if (scope === 'story' || scope === 'selection') {
        /* Stated precedence: the story / selection is the more specific scope. Shown, not merged. */
        countryRefs.push({ kind: 'country', ref: meta.iso3, status: 'excluded', reason: 'OUTRANKED_BY_STORY', label: meta.name });
      } else {
        iso3 = meta.iso3;
        scope = 'geography';
        countryRefs.push({ kind: 'country', ref: meta.iso3, status: 'available', label: meta.name });
      }
    }

    return {
      version: 1,
      entry: input.entry,
      scope,
      action,
      stories: scope === 'story' || scope === 'selection' ? verified : [],
      iso3,
      refs: [...storyRefs, ...countryRefs],
    };
  }

  /**
   * EXECUTE TIME — turn a persisted resolution into the landed analysis inputs. The story
   * anchor's title is read again from the RETAINED article (never stored, never client
   * text); a selection is handed to the analysis path, which re-verifies every member.
   */
  async executionInputs(context: ResolvedAskContext | null | undefined): Promise<AskContextExecutionInputs> {
    if (!context || !this.enabled()) return { route: {} };
    if (context.scope === 'story' && context.stories.length === 1) {
      const story = context.stories[0];
      const article = await this.news?.findRetainedArticleByUrl(story.url).catch(() => null);
      if (!article) return { route: {} };
      const storyAnchorCountry = iso3Of(article.countryCode);
      return {
        storyContext: {
          title: article.title,
          articleId: article.id,
          url: article.url,
          sourceName: article.sourceName,
          ...(article.countryCode ? { countryCode: article.countryCode } : {}),
        },
        route: {
          hasResolvedArticleAnchor: true,
          ...(storyAnchorCountry === undefined ? {} : { storyAnchorCountry }),
        },
      };
    }
    if (context.scope === 'selection' && context.action !== null && context.stories.length > 0) {
      return {
        selection: { action: context.action, stories: context.stories.map((s) => ({ ...s })) },
        route: {
          articleRefs: context.stories.map((s) => s.articleRef),
          selectionAction: context.action,
        },
      };
    }
    if (context.scope === 'geography' && context.iso3 !== null) {
      const meta = resolveGovernedCountryCode(context.iso3);
      if (meta === undefined) return { route: {} };
      return {
        geographyContext: { countryCode: meta.iso3, displayName: meta.name },
        route: { mapContextCountry: meta.iso3 },
      };
    }
    return { route: {} };
  }
}

/** Narrow a persisted plan's `context` member. Never throws; anything malformed is null. */
export function readPlanContext(plan: unknown): ResolvedAskContext | null {
  const c = (plan as { context?: Partial<ResolvedAskContext> } | null)?.context;
  if (!c || c.version !== 1 || !Array.isArray(c.refs) || !Array.isArray(c.stories)) return null;
  if (!['story', 'selection', 'geography', 'none'].includes(String(c.scope))) return null;
  return c as ResolvedAskContext;
}
