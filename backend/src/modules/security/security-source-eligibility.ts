import type { NewsArticle } from '@globalnews-ai/shared';
/** Internal retained-report review is not public-evidence authorization. No source allowlist
 * or publication grants are installed by this lane. The persisted decision is reproducible. */
export function decideSecuritySourceEligibility(article: NewsArticle) {
  const reasons: string[] = [];
  if (!article.sourceName?.trim()) reasons.push('SEC-EVID-1: claimant missing');
  if (!article.sourceId?.trim() || !article.url?.trim()) reasons.push('Source identity missing');
  if (!article.firstSeenAt || !Number.isFinite(Date.parse(article.firstSeenAt)))
    reasons.push('SEC-FACTORY-1: retention timestamp missing');
  return {
    policyVersion: 'SECURITY-RETAINED-REVIEW-1',
    sourceId: article.sourceId,
    sourceUrl: article.url,
    evidenceFingerprintBasis: 'SOURCE_ID_AND_URL',
    internalReviewPermitted: reasons.length === 0,
    publicEvidencePermitted: false as const,
    publicDecision: 'NOT_AUTHORISED' as const,
    publicReason:
      'No approved source/instrument publication grant; retention confers no public eligibility.',
    sourceRights: 'UNVERIFIED' as const,
    synthesisStatus: 'UNVERIFIED' as const,
    reasons,
  };
}
export type SecuritySourceEligibility = ReturnType<typeof decideSecuritySourceEligibility>;
