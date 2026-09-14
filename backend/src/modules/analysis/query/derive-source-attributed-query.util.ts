/**
 * NATURAL SOURCE-ATTRIBUTED QUESTION R1 — THE FRAME SET.
 *
 * THE MEASURED DEFECT. The live Alpha failure was one question:
 *
 *   "What does Statistics Poland report about the demand for labour in
 *    Quarter 2 2026?"        -> AI ANALYSIS NOT ATTEMPTED, 0 retrieved reports
 *
 * and its control:
 *
 *   "The demand for labour in Quarter 2 2026"
 *                            -> 1 retrieved report, Statistics Poland evidence,
 *                               OpenAI success, original publisher link PASS
 *
 * The control proves ingestion and Analysis admission already work. What fails
 * is interpretation: no frame in deriveGenericNewsQuery()'s closed list covers
 * "What does <publisher> report about <topic>?", so its documented safety
 * fallback returns the WHOLE SENTENCE. That sentence then becomes both the
 * provider query AND the phrase scoreGenericRelevance()'s multiword
 * whole-phrase rule demands verbatim in a title or summary. No headline is an
 * interrogative sentence, so the question could only ever answer zero.
 *
 * WHY THIS IS NOT JUST ANOTHER SUBJECT-EXTRACTION PATTERN. Every pattern in
 * SUBJECT_EXTRACTION_PATTERNS returns ONE string — the topic — and discards
 * everything else in the sentence. Applied here that would silently turn
 *
 *   "What does Statistics Poland report about X?"
 *
 * into an unrestricted search for X across every publisher in the pool, and
 * then present whatever came back as though it answered a question about what
 * Statistics Poland said. Answering a question about one publisher with
 * another publisher's reporting is not a smaller failure than answering
 * nothing — it is a different and worse one. So this module never reports a
 * topic without also reporting that a source was named, and the caller is
 * required to carry the source half forward.
 *
 * WHAT THIS MODULE DOES NOT DO. It does not resolve the source phrase to
 * anything. It reports the span the user wrote; deciding whether that span
 * names a publisher this product actually carries belongs to the curated
 * identity authority (see ../../news/identity/requested-source.util.ts), not
 * to a regular expression.
 *
 * WHAT A MATCHED FRAME IS, AND IS NOT — THE AUTHORITATIVE RULE (REV C).
 * A matched source-attributed frame IS, on its own, sufficient to establish
 * SOURCE INTENT: it stands down country, declared-region and relational
 * substitution, so a question naming a publisher can never be answered with
 * some other publisher's reporting or with the place its topic happens to
 * mention. Usability of the span and resolution against the curated registry
 * then decide only whether that constraint can be SATISFIED — never whether it
 * EXISTS. A resolved article anchor still outranks it.
 *
 * (R1 shipped the opposite claim here — "a frame matching is NEVER on its own
 * sufficient to change routing" — which was true of the R1 design and false
 * from Rev C onward. It is corrected rather than deleted so the reversal is
 * legible to the next reader.)
 *
 * Same discipline as every derivation beside it: a closed, ordered,
 * first-match-wins list; no stemming; no stopword removal; no AI; no general
 * "find a proper noun" scan.
 */

import { deriveGenericNewsQuery } from './derive-generic-news-query.util';

export interface SourceAttributedQuery {
  /**
   * The span the user named as the source, verbatim apart from trimming.
   * NOT a resolved publisher — see this file's header.
   */
  readonly sourcePhrase: string;
  /** The topical retrieval/relevance phrase, with the source half removed. */
  readonly topic: string;
}

/**
 * REV C REV A — A MATCHED FRAME AND A USABLE ONE ARE DIFFERENT FACTS.
 *
 * WHAT REV C GOT WRONG, AND WHERE THE MISTAKE ACTUALLY LIVED. Rev C made the
 * FRAME the constraint: a sentence that parses as a source-attributed question
 * stands down region, country and relational routing, and an unresolvable
 * publisher fails closed rather than being answered about its topic or its
 * place. That ruling is right. But `deriveSourceAttributedQuery()` was written
 * in R1, when the design was the opposite, and it collapsed TWO different
 * outcomes into one `undefined`:
 *
 *   1. no source-attributed syntax matched at all;
 *   2. the syntax DID match, and one half was not usable — a source span
 *      longer than MAX_SOURCE_WORDS, or an empty topic.
 *
 * Its own comment said so plainly — "returning undefined hands it back to the
 * routing it had before" — which was the R1 design, and I did not revisit that
 * branch when Rev C replaced it. So:
 *
 *   "What does The International Center for Investigative Reporting Network
 *    report about Poland?"
 *
 * matched the frame, had its seven-word source rejected, returned `undefined`,
 * and ordinary Poland routing became eligible again — the exact substitution
 * Rev C exists to prevent, reached through the admissibility bound instead of
 * through resolution.
 *
 * THE FIX IS TO REPORT BOTH FACTS, NOT TO LOOSEN EITHER RULE. The bound stays
 * exactly where it was and keeps doing its job: it decides whether a span is
 * USABLE as a publisher name. It simply no longer erases the fact that the
 * reader named a source.
 */
export interface SourceAttributedIntent {
  /**
   * The usable halves, present ONLY when the frame matched AND both halves
   * passed. Absent means the sentence named a source this module could not
   * use — which is a constraint the caller must honour, not an absence.
   */
  readonly query?: SourceAttributedQuery;
  /**
   * Why the halves were unusable, when they were. Diagnostic only: never
   * rendered, never sent to a provider, never shown to a reader.
   */
  readonly rejection?: 'source-too-long' | 'source-empty' | 'topic-empty';
  /**
   * The raw source span exactly as the sentence carried it, for logging. It is
   * NEVER used for retrieval or resolution — an unusable span stays unusable.
   */
  readonly rawSourcePhrase: string;
}

/**
 * The longest span USABLE as a publisher name. "Central Bank of Kenya" is four
 * words and "Wirtualna Polska — Wiadomości" is three; six is deliberately
 * generous for a masthead and far too short to swallow a clause.
 *
 * WHAT EXCEEDING IT DOES, PRECISELY. The source-attributed syntax still
 * MATCHED — that is a fact about the sentence and no bound here can change it.
 * What the bound decides is that the over-limit span may not be treated as a
 * publisher NAME. So `detectSourceAttributedIntent()` returns an intent
 * carrying `rejection: 'source-too-long'` and no usable `query`, the source
 * constraint remains in force, and routing fails closed unless a resolved
 * article anchor outranks it. The reader named a source; we simply cannot use
 * the span they wrote.
 *
 * (R1 shipped "a longer span is not a publisher name, so the frame does not
 * match at all" here. Under `detectSourceAttributedIntent()` that is false:
 * the frame does match, and it is only the NAME that is rejected. Corrected
 * rather than deleted, so the reversal is legible.)
 */
const MAX_SOURCE_WORDS = 6;

/**
 * Ordered, first-match-wins. Group 1 is the SOURCE, group 2 is the TOPIC.
 *
 * The source group is non-greedy so it stops at the first reporting verb
 * rather than swallowing the rest of the sentence, and the reporting verbs
 * are a closed list — "report", "say", "state" and "publish" in the tenses a
 * question actually uses. No verb outside this list activates the frame.
 */
const SOURCE_ATTRIBUTED_FRAMES: readonly RegExp[] = [
  // "What does/did <source> report/say/state/publish about/on/regarding <topic>"
  /^what\s+(?:does|did)\s+(.+?)\s+(?:report|say|state|publish)\s+(?:about|on|regarding)\s+(.+)$/i,
  // "What do <source> report/say/state/publish about <topic>" — plural mastheads
  /^what\s+do\s+(.+?)\s+(?:report|say|state|publish)\s+(?:about|on|regarding)\s+(.+)$/i,
  // "What has/have <source> reported/said/stated/published about <topic>"
  /^what\s+(?:has|have)\s+(.+?)\s+(?:reported|said|stated|published)\s+(?:about|on|regarding)\s+(.+)$/i,
];

/**
 * "According to <source>, <rest>" is the same intent with the halves in the
 * other order, so it is a separate frame rather than a member of the list
 * above: its topic half is a complete question, not an already-clean noun
 * phrase, and therefore needs the existing derivation applied to it.
 *
 * The source group deliberately cannot cross a comma — the comma IS the
 * boundary the phrasing provides, and using it means this frame needs no
 * guess about where a masthead ends.
 */
const ACCORDING_TO_FRAME = /^according\s+to\s+([^,]+),\s*(.+)$/i;

/**
 * The bounded interrogative leads stripped from the "According to <source>,
 * ..." remainder before the existing derivation sees it. Closed and tiny: it
 * exists so "what is the demand for labour" becomes "the demand for labour",
 * not so arbitrary sentences can be rewritten.
 */
const LEADING_QUESTION_LEAD =
  /^(?:what|which|how\s+much|how\s+many)\s+(?:is|are|was|were|does|do|did|has|have)\s+/i;

function stripTrailingPunctuation(value: string): string {
  return value
    .trim()
    .replace(/[?!.,;:]+$/g, '')
    .trim();
}

/** Strips exactly one leading "the " — the same idiom the sibling derivations use. */
function stripLeadingThe(value: string): string {
  return value.replace(/^(?:the)\s+/i, '').trim();
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

/**
 * Classifies a source span rather than merely accepting or rejecting it.
 *
 * `raw` is always the span as written, so the caller can report WHAT the
 * reader named even when nothing usable came of it. `accepted` is present only
 * when the span is usable as a publisher name.
 */
function classifySourcePhrase(candidate: string): {
  raw: string;
  accepted?: string;
  rejection?: 'source-too-long' | 'source-empty';
} {
  const trimmed = stripTrailingPunctuation(candidate).trim();

  if (trimmed.length === 0) return { raw: trimmed, rejection: 'source-empty' };
  if (wordCount(trimmed) > MAX_SOURCE_WORDS) return { raw: trimmed, rejection: 'source-too-long' };

  return { raw: trimmed, accepted: trimmed };
}

/**
 * Detects whether a sentence is a source-attributed question at all, and — if
 * it is — whether its halves are usable.
 *
 * `undefined` means NO source-attributed syntax matched. That is the
 * overwhelmingly common case and is not a failure: every query the product
 * already handles — bare topics, country questions, relational questions, the
 * whole M35/M46/G-ALPHA-1 family, and every Polish conversational frame —
 * reaches exactly the routing it reached before this module existed, because
 * none of them contain a closed reporting verb between a bounded name and a
 * topic preposition.
 *
 * A RETURNED VALUE WITH NO `query` IS NOT AN ABSENCE. It says: the reader named
 * a source, and this module cannot use it. The caller must treat that as the
 * constraint it is.
 */
export function detectSourceAttributedIntent(
  normalizedQuery: string,
): SourceAttributedIntent | undefined {
  const base = stripTrailingPunctuation(normalizedQuery);

  if (base.length === 0) return undefined;

  for (const frame of SOURCE_ATTRIBUTED_FRAMES) {
    const match = base.match(frame);

    if (!match) continue;

    const source = classifySourcePhrase(match[1] ?? '');
    const topic = stripLeadingThe(stripTrailingPunctuation(match[2] ?? ''));

    if (source.accepted && topic.length > 0) {
      return {
        query: { sourcePhrase: source.accepted, topic },
        rawSourcePhrase: source.raw,
      };
    }

    /*
     * The frame matched and one half was unusable. The sentence is NOT re-tried
     * against a later frame — first match wins, exactly as before — and it is
     * NOT downgraded to "no source intent". The reader named a source; that
     * fact survives even though nothing usable came of it.
     */
    return {
      rejection: source.rejection ?? 'topic-empty',
      rawSourcePhrase: source.raw,
    };
  }

  const according = base.match(ACCORDING_TO_FRAME);

  if (according) {
    const source = classifySourcePhrase(according[1] ?? '');
    const remainder = stripTrailingPunctuation(according[2] ?? '').replace(
      LEADING_QUESTION_LEAD,
      '',
    );

    /*
     * The remainder is a question, so the EXISTING derivation is applied to it
     * rather than a second, parallel pattern set being invented here.
     * deriveGenericNewsQuery() is total, never returns empty, and returns its
     * input unchanged when nothing matched — all three properties are relied
     * on directly.
     */
    const topic = stripLeadingThe(deriveGenericNewsQuery(remainder));

    if (source.accepted && topic.length > 0) {
      return {
        query: { sourcePhrase: source.accepted, topic },
        rawSourcePhrase: source.raw,
      };
    }

    return {
      rejection: source.rejection ?? 'topic-empty',
      rawSourcePhrase: source.raw,
    };
  }

  return undefined;
}

/**
 * The usable halves of a source-attributed question, or undefined.
 *
 * DELIBERATELY UNCHANGED IN CONTRACT. This is what every existing caller and
 * every existing proof already depends on: it answers "can this sentence be
 * split into a usable publisher and a usable topic?" and nothing more. It is
 * now a one-line read of `detectSourceAttributedIntent()` so there is exactly
 * one frame list, one bound and one place either can drift.
 *
 * A caller that needs to know whether the reader named a source AT ALL — which
 * is the question routing must ask — has to use
 * `detectSourceAttributedIntent()`. This function cannot answer it, and after
 * Rev C Rev A it no longer pretends to.
 */
export function deriveSourceAttributedQuery(
  normalizedQuery: string,
): SourceAttributedQuery | undefined {
  return detectSourceAttributedIntent(normalizedQuery)?.query;
}
