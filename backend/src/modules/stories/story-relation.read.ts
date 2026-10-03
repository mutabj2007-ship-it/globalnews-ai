import type { PrismaService } from '../../database/prisma.service';
import { StoryIdentityService } from './story-identity.service';

/**
 * STAGE B — the ONLY factual relation Compare may state between two selected articles,
 * read from stored canonical identity. Read-only (the identity service's lookups never write;
 * no story is created by comparing).
 *
 *   SAME_STORY           both articles are members of one canonical story (proven join or an
 *                        audited operator merge).
 *   SEPARATED_BY_EDITOR  an audited SPLIT separated their stories.
 *   NOT_ESTABLISHED      everything else — including "never placed in a story". This is NOT a
 *                        claim that they differ; it is the absence of a proven relation.
 *
 * No agreement, disagreement, claim, causality or gap is derived here or anywhere in Compare.
 */
export type StoryRelation = 'SAME_STORY' | 'SEPARATED_BY_EDITOR' | 'NOT_ESTABLISHED';

export interface StoryIdentityRead {
  readonly storyIds: Record<string, string | null>;
  readonly relations: ReadonlyArray<{ readonly first: string; readonly second: string; readonly relation: StoryRelation }>;
}

export async function readStoryRelations(prisma: PrismaService, articleRefs: readonly string[]): Promise<StoryIdentityRead> {
  const identity = new StoryIdentityService(prisma);
  const refs = Array.from(new Set(articleRefs));
  const canonical = await identity.canonicalIdsByArticleRef(refs);
  const storyIds: Record<string, string | null> = {};
  for (const ref of refs) storyIds[ref] = canonical.get(ref) ?? null;

  const relations: Array<{ first: string; second: string; relation: StoryRelation }> = [];
  for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      const a = storyIds[refs[i]];
      const b = storyIds[refs[j]];
      let relation: StoryRelation = 'NOT_ESTABLISHED';
      if (a !== null && b !== null) {
        if (a === b) relation = 'SAME_STORY';
        else if (await identity.separatedByEditor(a, b)) relation = 'SEPARATED_BY_EDITOR';
      }
      relations.push({ first: refs[i], second: refs[j], relation });
    }
  }
  return { storyIds, relations };
}

/**
 * R2 · BRIEFING SUBJECT — the canonical story's material-evidence version, read from stored
 * identity only (merge-aware). The second and last identity fact the Ask side may read: no
 * content, no members, no reader rows. Null when the story does not exist.
 */
export interface StoryMaterialVersion {
  readonly storyId: string;
  readonly briefVersion: number;
  readonly briefUpdatedAt: Date | null;
}

export async function readStoryMaterialVersion(
  prisma: PrismaService,
  storyId: string,
  db?: Parameters<StoryIdentityService['describe']>[1],
): Promise<StoryMaterialVersion | null> {
  const story = await new StoryIdentityService(prisma).describe(storyId, db ?? prisma);
  return story === null
    ? null
    : { storyId: story.storyId, briefVersion: story.briefVersion, briefUpdatedAt: story.briefUpdatedAt };
}
