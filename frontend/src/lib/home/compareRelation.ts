/**
 * HOME R1 · STAGE B — the Compare view's ONE relation row, from stored canonical story identity
 * (POST /news/stories/resolve → `identity`). Pure: no request, no model.
 *
 * Only what the server PROVES is stated: SAME_STORY (one canonical story) and
 * SEPARATED_BY_EDITOR (an audited split). Every other pair is "not established" — never
 * "different", never "related", never an agreement, a claim, a cause or a gap.
 */
export type StoryRelation = 'SAME_STORY' | 'SEPARATED_BY_EDITOR' | 'NOT_ESTABLISHED';

export interface CompareIdentity {
  readonly storyIds: Readonly<Record<string, string | null>>;
  readonly relations: ReadonlyArray<{ readonly first: string; readonly second: string; readonly relation: StoryRelation }>;
}

export interface RelationCopy {
  readonly relationUnavailable: string;
  readonly relationSame: string;
  readonly relationSeparated: string;
  readonly relationNotEstablished: string;
}

const KNOWN: ReadonlySet<string> = new Set(['SAME_STORY', 'SEPARATED_BY_EDITOR', 'NOT_ESTABLISHED']);

/** The sentences for the relation row, numbering stories by their column (1-based). */
export function relationSentences(
  columnRefs: readonly string[],
  identity: CompareIdentity | undefined,
  copy: RelationCopy,
): { readonly kind: 'unavailable' | 'none' | 'proven'; readonly lines: readonly string[] } {
  if (identity === undefined || !Array.isArray(identity.relations)) return { kind: 'unavailable', lines: [copy.relationUnavailable] };
  const column = (ref: string): number => columnRefs.indexOf(ref) + 1;
  const lines: string[] = [];
  for (const pair of identity.relations) {
    if (!KNOWN.has(pair.relation) || pair.relation === 'NOT_ESTABLISHED') continue;
    const a = column(pair.first);
    const b = column(pair.second);
    if (a === 0 || b === 0) continue;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const template = pair.relation === 'SAME_STORY' ? copy.relationSame : copy.relationSeparated;
    lines.push(template.replace('{a}', String(lo)).replace('{b}', String(hi)));
  }
  return lines.length === 0 ? { kind: 'none', lines: [copy.relationNotEstablished] } : { kind: 'proven', lines };
}
