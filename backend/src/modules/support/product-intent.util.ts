import {
  PRODUCT_KNOWLEDGE,
  type ProductKnowledgeEntry,
  type ProductKnowledgeLocale,
} from './product-knowledge';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SUPPORT INTENT — WHAT IS THE READER ASKING ABOUT?
 * ════════════════════════════════════════════════════════════════════════════
 *
 * F-SUPPORT-PRODUCT-KNOWLEDGE-ROUTING-1, taxonomy §1.
 *
 *   P — PRODUCT   GlobalNews AI itself: what a surface is, where it is, how to
 *                 use it, why it is showing a state.   A provider may NEVER be called.
 *   W — WORLD     events, places, people, organisations — what the product
 *                 reports ON.                          The only family that may retrieve.
 *   X — NEITHER   not determinable, or about the conversation itself.  Never.
 *
 * ── P AND W ARE NOT TWO TOPICS ───────────────────────────────────────────
 *
 * They are two different OBJECTS OF REFERENCE. "What is Watch?" and "What is
 * happening in Sudan?" have the same grammatical shape and share no routing at
 * all. That is why this cannot be a keyword score: it is a question about what
 * the sentence is pointing at.
 *
 * ── WHY THE DEFAULT IS W, AND WHY THAT IS SAFE ───────────────────────────
 *
 * An unmatched question is W, which sounds like the permissive choice and is
 * not — because the rule this feeds is a CONJUNCT:
 *
 *     analysisEligible = category === NEWS_QUESTION && intent.family === W
 *
 * An AND can only ever WITHHOLD. Defaulting to W preserves exactly today's
 * behaviour for everything this table does not recognise; recognising a product
 * question is what removes a provider call. Nothing eligible before becomes
 * newly eligible, which is the property that makes this landable without
 * widening retrieval.
 */

export type IntentFamily = 'P' | 'W' | 'X';

export interface ProductIntent {
  readonly family: IntentFamily;
  /** The taxonomy class when the corpus recognised the question, else null. */
  readonly intentClass: string | null;
  /** The matched entry, so a caller can answer without matching twice. */
  readonly entry: ProductKnowledgeEntry | null;
  /** The trigger that fired, for evidence. Never shown to a reader. */
  readonly matchedTrigger: string | null;
  readonly reason: string;
}

/**
 * fold — lowercase, strip combining marks, collapse whitespace.
 *
 * DIACRITICS ARE STRIPPED ON PURPOSE. Polish readers type both `śledzić` and
 * `sledzic`, and a matcher that accepted only the diacritic spelling would fail
 * precisely the readers typing quickly. Folding both sides makes either spelling
 * match.
 */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * M-1 — WORD BOUNDARIES ONLY. A trigger may never fire inside a longer word.
 *
 * `news` is a word inside "is there any news about Poland" and is NOT a word
 * inside "GlobalNews AI". Substring containment cannot tell those apart; this
 * can, and the difference decides whether a world question is stolen by the
 * product table.
 *
 * `\w` is insufficient for Polish even after folding, so the boundary is
 * expressed as "not a letter or digit" over the folded text.
 */
function matchesWholeWord(trigger: string, foldedText: string): boolean {
  const needle = fold(trigger);

  if (needle.length === 0) return false;

  let from = 0;

  for (;;) {
    const at = foldedText.indexOf(needle, from);

    if (at === -1) return false;

    const before = at === 0 ? '' : foldedText[at - 1] ?? '';
    const after = foldedText[at + needle.length] ?? '';
    const isWordChar = (c: string): boolean => c !== '' && /[\p{L}\p{N}]/u.test(c);

    if (!isWordChar(before) && !isWordChar(after)) return true;

    from = at + 1;
  }
}

/**
 * The matcher. Two powers only: choose an entry, or choose none.
 *
 * M-5 — LONGEST MATCH WINS, then entry order. A determinism requirement, not a
 * quality heuristic: where two entries could match different tokens in one
 * sentence, the outcome must not depend on iteration order.
 */
export function matchProductKnowledge(
  text: string,
  locale: ProductKnowledgeLocale,
): { readonly entry: ProductKnowledgeEntry; readonly trigger: string } | null {
  const folded = fold(text);

  let best: { entry: ProductKnowledgeEntry; trigger: string } | null = null;

  for (const entry of PRODUCT_KNOWLEDGE) {
    for (const trigger of entry.triggers[locale]) {
      if (!matchesWholeWord(trigger, folded)) continue;

      const longer = best === null || fold(trigger).length > fold(best.trigger).length;

      if (longer) best = { entry, trigger };
    }
  }

  return best;
}

/**
 * Classify a Support turn.
 *
 * M-4 — A MISS IS A MISS. No trigger match means this is not a recognised
 * product question, and the answer is the family default — never a fallthrough
 * to a different table or a looser second pass.
 */
export function classifyProductIntent(
  text: string,
  locale: ProductKnowledgeLocale,
): ProductIntent {
  const matched = matchProductKnowledge(text, locale);

  if (matched !== null) {
    return {
      family: 'P',
      intentClass: matched.entry.intentClass,
      entry: matched.entry,
      matchedTrigger: matched.trigger,
      reason: `product knowledge ${matched.entry.id} matched "${matched.trigger}"`,
    };
  }

  return {
    family: 'W',
    intentClass: null,
    entry: null,
    matchedTrigger: null,
    reason: 'no product trigger matched; treated as a world question, as before',
  };
}
