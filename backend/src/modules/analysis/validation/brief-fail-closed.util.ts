import type { ExecutiveBriefState, NewsAnalysisResult } from '@globalnews-ai/shared';

import type { BriefComplianceVerdict } from './brief-compliance.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * EXECUTIVE BRIEF FAIL-CLOSED — C907 CORRECTION 3
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE RULING THAT CREATED THIS FILE, and what it rejected.
 *
 * C906 implemented the C905 structural requirement and then, when the one
 * permitted repair ALSO came back non-compliant, kept the original blended
 * paragraph. Its own comment said so plainly: *"Keeping whichever is compliant
 * — and the original when neither is — means this check can only ever improve
 * the response or leave it alone."*
 *
 * The CTO review rejected exactly that:
 *
 *     "if repair also fails: DO NOT present the known non-compliant blended
 *      summary as accepted output. Return a truthful structured-analysis
 *      degradation state / brief-unavailable state while retaining the rest of
 *      the valid analysis record. Do not invent another AI call. The invariant
 *      is: KNOWN NON-COMPLIANT EXECUTIVE BRIEF != ACCEPTED EXECUTIVE BRIEF."
 *
 * WHY "LEAVE IT ALONE" WAS THE WRONG DEFAULT. The C906 reasoning treated the
 * blended paragraph as a neutral baseline — no better, no worse than before
 * the check existed. It is not neutral, because the check RAN. Before C906 the
 * product did not know the brief was inadequate; after C906 it knows, it says
 * so in its own log, and it publishes it anyway. Presenting an answer you have
 * measured and failed is a different act from presenting one you never
 * measured, and it is the one a reader has no way to detect.
 *
 * ── WITHHOLDING, NOT FLAGGING ───────────────────────────────────────────────
 *
 * `withholdExecutiveBrief` empties `summary`. It does not merely attach a
 * warning beside it. A flag depends on every present and future surface
 * reading the flag before rendering the prose; five surfaces in this
 * repository read `analysis.summary`, and a sixth added next year would
 * inherit the defect silently. An empty string cannot be rendered as a brief
 * by anything, which is what makes this fail CLOSED rather than fail-loudly.
 *
 * ── WHAT IS RETAINED, AND WHY THAT IS NOT A COMPROMISE ──────────────────────
 *
 * Everything except the summary. keyFacts, agreements, differences, timeline,
 * context, relevance, immediateImpacts, spilloverImplications, watchNext,
 * entities, sources, uncertainties and trustState are each validated
 * independently by `validateAnalysisResult` and each cite their own evidence.
 * Not one of them is derived from the summary, and the defect found was the
 * summary's PARAGRAPH SHAPE — a property no other field has. Discarding a
 * fully-grounded evidence record because one prose field was badly organised
 * would destroy real work to punish a formatting failure.
 *
 * ── NO SECOND JUDGMENT, NO THIRD CALL ───────────────────────────────────────
 *
 * These functions take a verdict that has already been computed and an
 * analysis that has already been validated. They call nothing, fetch nothing
 * and ask no provider anything. They are pure record-keeping over a decision
 * made elsewhere.
 */

/**
 * The accepted case: the brief stands, and the record says so explicitly.
 *
 * Stamping the accepted path too — rather than leaving `briefState` undefined
 * whenever nothing went wrong — is what makes the field a POSITIVE assertion
 * instead of an alarm. A consumer can ask "was this brief checked and
 * accepted?" and get a real answer; with an alarm-only field, absence would
 * mean both "accepted" and "produced by a version that never checked".
 */
export function acceptExecutiveBrief(
  analysis: NewsAnalysisResult,
  verdict: BriefComplianceVerdict,
  repairRequested: boolean,
): NewsAnalysisResult {
  const briefState: ExecutiveBriefState = {
    availability: 'accepted',
    clusters: verdict.breadth.clusters,
    categories: verdict.breadth.categories,
    repairRequested,
  };

  return { ...analysis, briefState };
}

/**
 * The withheld case: the brief is known non-compliant and is not transmitted.
 *
 * `summary: ''` is the whole enforcement. The rest of this function is the
 * truthful account of why, carried in a field a surface can branch on so the
 * reader is told the brief is unavailable instead of being shown a silent gap
 * — the ruling asks for a "truthful structured-analysis degradation state",
 * and a blank space is not a state, it is an absence.
 *
 * `repairRequested` RECORDS WHAT ACTUALLY HAPPENED. It is a parameter rather
 * than a literal precisely so this record can never assert something the run
 * did not do.
 *
 * CORRECTED FOR THE CURRENT PATH. This comment used to say the flag was
 * "always true on this path in practice, because the only way to reach it is
 * through a failed repair". That is no longer so. The synchronous repair was
 * removed under the accepted Alpha latency correction: the current synchronous
 * path DOES NOT REQUEST A REPAIR, so it reaches this function with `false`,
 * and a withheld brief now means "the one generation did not meet the
 * structural requirement" — not "two attempts failed".
 *
 * `true` REMAINS A LEGITIMATE VALUE, which is why the parameter stays. A future
 * GOVERNED ASYNCHRONOUS repair may run outside the synchronous response path
 * and report that it was attempted; this function will then record that truly,
 * exactly as it records `false` truly today.
 *
 * THE UTILITY'S BEHAVIOUR IS UNCHANGED by this correction — only the account of
 * which values callers currently supply.
 */
export function withholdExecutiveBrief(
  analysis: NewsAnalysisResult,
  verdict: BriefComplianceVerdict,
  repairRequested: boolean,
): NewsAnalysisResult {
  const briefState: ExecutiveBriefState = {
    availability: 'withheld-non-compliant',
    clusters: verdict.breadth.clusters,
    categories: verdict.breadth.categories,
    repairRequested,
    reason:
      verdict.reason ??
      'The executive brief did not meet the structural requirement for this evidence set.',
  };

  return { ...analysis, summary: '', briefState };
}

/**
 * Is this record's brief safe to present?
 *
 * One predicate, exported so backend and frontend cannot word the rule
 * differently. Absent `briefState` reads as accepted, which is the required
 * backward-compatible answer: every fixture and every pre-C907 payload
 * predates the field, and treating those as withheld would blank briefs that
 * were never assessed.
 */
export function isExecutiveBriefPresentable(analysis: NewsAnalysisResult): boolean {
  return analysis.briefState?.availability !== 'withheld-non-compliant';
}
