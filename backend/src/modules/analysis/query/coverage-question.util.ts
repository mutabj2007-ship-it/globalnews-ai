/**
 * Does the reader ask ABOUT COVERAGE ("why only 3 articles?", "which sources?")?
 *
 * Moved verbatim from `analysis.service.ts` (ASK R2 CONSOLIDATED INTEGRATION R1, Gate C)
 * so the frozen router's landed-readings adapter can consume the SAME predicate as
 * `AnalysisCoverageContext.questionAsksAboutCoverage` without loading the service.
 * Behaviour unchanged: the service imports it from here.
 */
const COVERAGE_QUESTION_PATTERNS = [
  /\bwhy\s+(?:do\s+we\s+have\s+)?(?:only|just|so\s+few|few|less|fewer)\b/i,
  /\b(?:only|just)\s+\d+\s+(?:articles?|reports?|stories?|news)\b/i,
  /\bis\s+(?:that|this)\s+(?:all|the\s+only)\b/i,
  /\bwhy\s+(?:are|is)\s+there\s+(?:so\s+)?(?:few|less|fewer)\b/i,
  /\bwhy\s+(?:is|are)\s+(?:the\s+)?(?:coverage|news|reporting)\s+(?:so\s+)?(?:limited|low|thin|small)\b/i,
  /\bwhich\s+(?:providers?|sources?)\b/i,
  /\bwhy\s+(?:did|does)\s+(?:globalnews|the\s+system|retrieval)\b/i,
];

export function asksAboutCoverage(query: string): boolean {
  return COVERAGE_QUESTION_PATTERNS.some((pattern) => pattern.test(query));
}
