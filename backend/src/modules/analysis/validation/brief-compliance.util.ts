import type { NewsArticle } from '@globalnews-ai/shared';

import { clusterDuplicateArticles } from '../duplicates/cluster-articles.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * EXECUTIVE BRIEF COMPLIANCE — PO RULING D, C906
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE ACCEPTANCE EVIDENCE. Alpha, question "Rwanda", 8 retrieved reports and 8
 * reporting clusters, and the brief came back as one blended paragraph:
 *
 *     "Rwanda has been involved in various significant developments, including
 *      environmental concerns related to eucalyptus plantations, economic
 *      partnerships with Russia and Pakistan, and initiatives aimed at
 *      improving road safety. Additionally, there are ongoing issues related to
 *      hate speech convictions and the spread of Ebola in the region."
 *
 * Five unrelated developments, one sentence each at best, no structure.
 *
 * ── WHY THIS IS CODE AND NOT MORE PROMPT ────────────────────────────────────
 *
 * The ruling is explicit, and correct: *"The C905 prompt already asks for
 * multiple paragraphs, therefore DO NOT report another wording-only prompt
 * change as a fix."*
 *
 * C905 added a detailed synthesis contract to the system prompt. The output
 * above is what came back anyway. An instruction the model may or may not
 * follow is not a guarantee, and the difference between asking and enforcing
 * is that enforcement can fail a response.
 *
 * So this module makes the requirement CHECKABLE: the evidence set decides
 * whether a brief is allowed to be one paragraph, and a non-compliant brief is
 * detected deterministically rather than hoped against.
 *
 * ── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────
 *
 * It never edits the brief. It never invents a fact, a paragraph or an
 * evidence id. It cannot, because it never writes prose — it returns a verdict,
 * and the one repair the service is permitted to request goes back to the
 * provider with the same evidence and the same rules. Everything it can say is
 * "this shape is wrong", never "here is a better shape".
 */

/** How many materially distinct developments the retrieved evidence carries. */
export interface DevelopmentBreadth {
  /** Distinct stories after duplicate clustering. */
  readonly clusters: number;
  /** Distinct editorial domains across the retrieved set. */
  readonly categories: number;
  /**
   * True when a single blended paragraph is NOT an acceptable answer.
   *
   * The ruling's minimum rule: *"When retrieval establishes multiple materially
   * distinct developments, a single blended summary paragraph is
   * NON-COMPLIANT."*
   *
   * TWO SIGNALS, AND BOTH ARE REQUIRED, because either alone is wrong:
   *
   *   CLUSTERS ALONE would demand structure from eight outlets covering one
   *   story — exactly the narrow question the ruling protects: *"narrow/single-
   *   story questions remain allowed to produce one paragraph."*
   *
   *   CATEGORIES ALONE would demand it from two articles that happen to be
   *   filed under different desks.
   *
   * Requiring both means the evidence has to be broad in two independent ways
   * before the product insists on structure. On the Alpha Rwanda set — 8
   * clusters across environment, economy, public health and road safety — both
   * clear comfortably.
   */
  readonly multiDevelopment: boolean;
}

/** Below this, one paragraph is always an acceptable answer. */
export const MIN_CLUSTERS_FOR_STRUCTURE = 2;
export const MIN_CATEGORIES_FOR_STRUCTURE = 2;

export function detectDevelopmentBreadth(articles: readonly NewsArticle[]): DevelopmentBreadth {
  /*
    The SAME clustering pass the service already uses to build the provider's
    input, so "how many stories are there" has one answer in this request and
    the brief is judged against the evidence the model actually saw.
  */
  const clusters = clusterDuplicateArticles([...articles]).length;
  const categories = new Set(articles.map((article) => article.category)).size;

  return {
    clusters,
    categories,
    multiDevelopment:
      clusters >= MIN_CLUSTERS_FOR_STRUCTURE && categories >= MIN_CATEGORIES_FOR_STRUCTURE,
  };
}

/**
 * Paragraphs, by exactly the rule the frontend renders by.
 *
 * `splitSynthesisParagraphs` in the frontend splits on a blank line and does
 * nothing else. If this counted differently — on single newlines, or on
 * sentences — a brief could pass here and still render as a wall, which is the
 * failure mode the ruling is about. One definition, both ends.
 */
export function countSynthesisParagraphs(summary: string): number {
  return summary
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

export interface BriefComplianceVerdict {
  readonly compliant: boolean;
  readonly paragraphs: number;
  readonly breadth: DevelopmentBreadth;
  /** Present only when non-compliant. Plain English, for logs and for the repair. */
  readonly reason?: string;
}

/**
 * THE ONE REQUIREMENT, AND DELIBERATELY ONLY ONE.
 *
 * A brief answering a multi-development evidence set must be more than one
 * paragraph. That is the whole check.
 *
 * NO PARAGRAPH QUOTA, because the ruling forbids one: *"Do not impose a fixed
 * number of paragraphs. Scale synthesis to the evidence."* Demanding one
 * paragraph per cluster would turn eight outlets into eight paragraphs and
 * replace a blended summary with a padded one — the same failure wearing
 * structure. The detected breadth is carried into the repair instruction so
 * the model knows how much ground there is to cover, and the model decides how
 * to divide it.
 *
 * NO LENGTH CHECK, NO KEYWORD CHECK. A validator that demanded the word
 * "because", or four hundred characters, would be gameable by padding and
 * would start rejecting good short answers. Shape is the only thing that can
 * be judged mechanically without judging the prose.
 */
export function assessBriefCompliance(
  summary: string,
  breadth: DevelopmentBreadth,
): BriefComplianceVerdict {
  const paragraphs = countSynthesisParagraphs(summary);

  if (!breadth.multiDevelopment) {
    return { compliant: true, paragraphs, breadth };
  }

  if (paragraphs >= 2) {
    return { compliant: true, paragraphs, breadth };
  }

  return {
    compliant: false,
    paragraphs,
    breadth,
    reason:
      `The retrieved evidence carries ${breadth.clusters} distinct reporting clusters across ` +
      `${breadth.categories} domains, and the summary is a single paragraph.`,
  };
}

/**
 * The ONE repair request the service is permitted to make.
 *
 * The ruling: *"permit AT MOST ONE targeted repair request to the provider; no
 * unlimited retry loop; no invented facts; same evidence IDs only."*
 *
 * ── WHY THE WORDING IS SHAPED LIKE THIS ─────────────────────────────────────
 *
 * It names the defect rather than restating the original instruction, because
 * the original instruction is already in the system prompt and repeating it is
 * what the ruling calls a wording-only change. It asks for a RE-ORGANISATION of
 * the same analysis, not a new one, and it says so twice — once as an
 * instruction and once as a prohibition — because the failure mode of a repair
 * prompt is a model that helpfully finds more to say.
 *
 * It also carries the breadth numbers, so the model is told what it missed
 * rather than merely that it failed.
 */
export function buildBriefRepairDirective(verdict: BriefComplianceVerdict): string {
  return `
BRIEF STRUCTURE REPAIR — THIS IS A RE-ORGANISATION, NOT A NEW ANALYSIS.

Your previous "summary" for this exact evidence set was a single paragraph
covering several unrelated developments at once. ${verdict.reason ?? ''}
A blended paragraph is not an acceptable answer for an evidence set this broad:
a reader cannot tell where one development ends and the next begins.

Produce the analysis again, changing ONE thing: organise "summary" into
readable paragraphs separated by a BLANK LINE, one per material development or
topic the evidence actually establishes. Within each paragraph make clear what
happened, which development it belongs to, why it matters WHERE THE EVIDENCE
ESTABLISHES THAT, and any material uncertainty.

Binding constraints on this repair:
- Use ONLY the same supplied articles and the SAME evidenceId values. Do not
  introduce a source, a fact, a figure or a development that was not in your
  previous answer's evidence.
- Do not invent a reason, a cause or a motive to make a paragraph feel
  complete. If the evidence does not establish why something happened, say so.
- Do not pad. Fewer, well-separated paragraphs are better than one per article;
  there is no target count, and two developments means two paragraphs.
- Every other field of the analysis should carry the same content as before.
`.trim();
}
