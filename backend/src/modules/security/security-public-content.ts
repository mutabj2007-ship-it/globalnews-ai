import {
  SECURITY_ABSENCE_REACHABLE_AT_ALPHA,
  SECURITY_PUBLIC_CONTENT_BLOCKER,
  SECURITY_COVERAGE_AXES,
  type SecurityReadResponse,
} from '@globalnews-ai/shared';

/** Part IX: publisher prose is not a reviewed person-claim instrument. No heuristic
 * can prove it contains no identifiable person. Withhold the entire public projection,
 * including source URLs/names, until a governed publication gate is approved. */
export function admitSecurityPublicContent(_candidate: unknown): {
  permitted: false;
  reason: string;
} {
  void _candidate; // No unreviewed field, including URLs, crosses this boundary.
  return { permitted: false, reason: SECURITY_PUBLIC_CONTENT_BLOCKER };
}

export function publicSecurityRead(countryCode: string): SecurityReadResponse {
  // Both independent approvals are necessary; neither is a deploy-time environment toggle.
  const alphaReachable = SECURITY_ABSENCE_REACHABLE_AT_ALPHA.COVERAGE_GAP;
  const content = admitSecurityPublicContent(undefined);
  if (alphaReachable && content.permitted)
    throw new Error('A governed public projection must be implemented before activation');
  const now = new Date().toISOString();
  return {
    geographyId: countryCode,
    geographyName: countryCode,
    observations: [],
    coverage: SECURITY_COVERAGE_AXES.map((axis) => ({
      axis,
      coverageState: 'UNESTABLISHED',
      finding: null,
      absenceReason: 'Public Security assessment is not activated.',
    })),
    limitations: [],
    absence: 'NOT_ASSESSED',
    changeState: null,
    changeStateReason: 'Public Security assessment is not activated.',
    producedBy: 'BETA-SECURITY-EVIDENCE-R2-PUBLIC-GATE',
    assessedAt: now,
    generatedAt: now,
  };
}
