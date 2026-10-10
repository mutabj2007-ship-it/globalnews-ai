/*
  P0 SOURCE-BACKED NEWS ANSWERS R1 — P3: CONTROLLED ENTITY IDENTITY (reviewed, closed list).

  "Eric Prince" is how the Product Owner wrote it; the person in the reporting is Erik Prince
  (Blackwater founder; Vectus Global; Frontier Services Group). Recommendation of record: Claude G +
  the East Africa lead (Claude_Output/ASK-NEWS-RELIABILITY-R1/ea/HANDOFF.md §4 P3):
    · one reviewed alias tied to ONE identity, with its context terms;
    · the query is sent with the CANONICAL spelling;
    · evidence is admitted under the alias only with the canonical spelling, or the variant plus a
      context term (isAttributableToControlledEntity);
    · no fuzzy matching — an entry is added only by review, never inferred.
  The rewrite applies to retrieval only and is disclosed on the answer
  (retrievalContext.entitySpelling), so the reader sees "searched as Erik Prince".
*/

export interface ControlledEntity {
  readonly id: string;
  readonly canonical: string;
  readonly variants: readonly string[];
  readonly contextTerms: readonly RegExp[];
}

export const CONTROLLED_ENTITIES: readonly ControlledEntity[] = [
  {
    id: 'erik-prince',
    canonical: 'Erik Prince',
    variants: ['Eric Prince'],
    contextTerms: [/\bblackwater\b/i, /\bvectus(?:\s+global)?\b/i, /\bfrontier\s+services\s+group\b/i, /\bacademi\b/i],
  },
];

export interface EntitySpelling {
  readonly asked: string;
  readonly searched: string;
  readonly entityId: string;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
const wordBounded = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(s)}(?![\\p{L}\\p{N}])`, 'giu');

/** Rewrites a reviewed variant to its canonical spelling; reports every rewrite made. */
export function withCanonicalEntityNames(question: string): { query: string; spellings: EntitySpelling[] } {
  let query = question;
  const spellings: EntitySpelling[] = [];
  for (const entity of CONTROLLED_ENTITIES) {
    for (const variant of entity.variants) {
      query = query.replace(wordBounded(variant), (asked) => {
        if (!spellings.some((s) => s.entityId === entity.id)) {
          spellings.push({ asked, searched: entity.canonical, entityId: entity.id });
        }
        return entity.canonical;
      });
    }
  }
  return { query, spellings };
}

/** The reviewed entity whose canonical name appears in the (already canonicalised) question. */
export function namedControlledEntity(question: string): ControlledEntity | undefined {
  return CONTROLLED_ENTITIES.find((entity) => wordBounded(entity.canonical).test(question));
}

/** Evidence rule: canonical spelling, or a variant together with one of the entity's context terms. */
export function isAttributableToControlledEntity(
  article: { readonly title?: string | null; readonly summary?: string | null },
  entityId: string,
): boolean {
  const entity = CONTROLLED_ENTITIES.find((e) => e.id === entityId);
  if (!entity) return false;
  const text = `${article.title ?? ''} ${article.summary ?? ''}`;
  if (wordBounded(entity.canonical).test(text)) return true;
  return entity.variants.some((v) => wordBounded(v).test(text)) && entity.contextTerms.some((t) => t.test(text));
}
