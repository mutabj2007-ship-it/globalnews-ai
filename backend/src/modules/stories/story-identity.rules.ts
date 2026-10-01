import { articleHost, type NewsArticle } from '@globalnews-ai/shared';
import { isSameStory } from '../news/identity/article-identity.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * STAGE B — CANONICAL STORY IDENTITY: THE PURE RULES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * FAIL CLOSED, BY REUSE. Two articles are placed in one canonical story automatically ONLY
 * when `isSameStory` — the one pairwise decision the Production Ask false-merge guard (6ba220f,
 * R1G) made authoritative — PROVES it: the same strong identity (provider record id, else
 * normalized URL), or the conservative corroborated EXACT headline (same host or same image,
 * inside the publication window). No fuzzy title threshold, no category, no geography, no time
 * proximity on its own. "Two stories that are really one" is acceptable; "two different
 * reports merged" is not. Anything stronger than this is an explicit, audited operator merge.
 *
 * MATERIAL EVIDENCE (briefVersion). A story's version increments only when evidence from a
 * NEW SOURCE HOST joins it (by a proven join or an operator merge). Another article from a
 * host already present adds a source without a version — so syndicated or re-published
 * copies never raise an alert.
 */

/** The member a candidate provably belongs with, or null (stay a singleton). */
export function provableJoin<T extends { article: NewsArticle }>(candidate: NewsArticle, members: readonly T[]): T | null {
  for (const member of members) {
    if (isSameStory(member.article, candidate) || isSameStory(candidate, member.article)) return member;
  }
  return null;
}

/** The governed host of an article URL ('' when it cannot be parsed — never guessed). */
export function sourceHostOf(url: string): string {
  return articleHost(url);
}

/** Does adding `incomingHosts` to a story whose members come from `presentHosts` add evidence? */
export function bringsNewEvidence(presentHosts: readonly string[], incomingHosts: readonly string[]): boolean {
  const present = new Set(presentHosts.filter((h) => h.length > 0));
  return incomingHosts.some((h) => h.length > 0 && !present.has(h));
}

/** Group a batch conservatively (backfill): each group is a set of PROVEN-same articles. */
export function conservativeGroups(articles: readonly NewsArticle[]): NewsArticle[][] {
  const groups: NewsArticle[][] = [];
  for (const article of articles) {
    const home = groups.find((group) => group.some((member) => isSameStory(member, article) || isSameStory(article, member)));
    if (home) home.push(article);
    else groups.push([article]);
  }
  return groups;
}

export const MAX_ALIAS_DEPTH = 16;
