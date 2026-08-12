import type {
  AgreementPoint,
  AnalysisMode,
  DifferenceItem,
  NewsAnalysisResult,
  SourcedClaim,
  TimelineEvent,
  TrustReason,
  TrustState,
} from '@globalnews-ai/shared';

/**
 * Milestone #42 — Authoritative Trust State derivation.
 *
 * Purely deterministic. Operates ONLY on already-validated analysis
 * structures (keyFacts/agreements/differences/timeline/uncertainties,
 * and the already-validated relationalComposition from Milestone #41)
 * plus the already-authoritative `analysisMode` supplied to
 * validateAnalysisResult() (itself sourced from
 * `this.provider.isMock ? 'mock-ai' : 'live-ai'` in AnalysisService —
 * reused as-is, never re-derived or duplicated here). Never inspects
 * provider prose, never reads `analysis.confidence` — see TrustState's
 * own doc comment in shared/src/analysis.ts for the full authority
 * hierarchy this function is the backend half of.
 *
 * NON-RELATIONAL 'high' IS INTENTIONALLY UNAVAILABLE: ordinary
 * (non-relational) analyses have no structural mechanism proving that
 * multiple distinct articles corroborate the SAME specific conclusion
 * — unlike Milestone #41's relational path, where `evidenceSufficiency:
 * 'adequate'` is scoped precisely to articles supporting one requested
 * direction. Inventing a non-relational 'high' from raw article count
 * would overclaim what the data actually proves. A future milestone may
 * add it once a genuine per-conclusion corroboration mechanism exists
 * for ordinary analyses.
 */

function collectDistinctArticleIds(
  keyFacts: SourcedClaim[],
  agreements: AgreementPoint[],
  differences: DifferenceItem[],
  timeline: TimelineEvent[],
): Set<string> {
  const ids = new Set<string>();
  const addAll = (entries: Array<{ sourceArticleIds: string[] }>) => {
    for (const entry of entries) {
      for (const id of entry.sourceArticleIds) {
        ids.add(id);
      }
    }
  };

  addAll(keyFacts);
  addAll(agreements);
  addAll(differences.flatMap((item) => item.positions));
  addAll(timeline);

  return ids;
}

/**
 * Milestone #42 hard mock override — checked FIRST, unconditionally.
 * Whenever analysisMode is 'mock-ai', the article-count/relational
 * logic below never runs at all for the purpose of deriving level/
 * reasons: level is always 'insufficient' and reasons is always
 * exactly ['mock-execution'], regardless of how many mock articles,
 * claims, or a qualifying relationalComposition exist. The metrics
 * fields (distinctSourceArticleCount/differenceTopicCount/
 * uncertaintyCount) still reflect the validated mock structure
 * accurately (TrustState's public shape requires valid numbers), but
 * they never influence the overridden level.
 */
export function deriveTrustState(
  analysisMode: AnalysisMode,
  keyFacts: SourcedClaim[],
  agreements: AgreementPoint[],
  differences: DifferenceItem[],
  timeline: TimelineEvent[],
  uncertaintyCount: number,
  relationalComposition: NewsAnalysisResult['relationalComposition'],
): TrustState {
  const distinctSourceArticleCount = collectDistinctArticleIds(
    keyFacts,
    agreements,
    differences,
    timeline,
  ).size;
  const differenceTopicCount = differences.length;

  if (analysisMode === 'mock-ai') {
    return {
      level: 'insufficient',
      reasons: ['mock-execution'],
      distinctSourceArticleCount,
      differenceTopicCount,
      uncertaintyCount,
      ...(relationalComposition
        ? { relationalEvidenceSufficiency: relationalComposition.evidenceSufficiency }
        : {}),
    };
  }

  const informationalReasons: TrustReason[] = [];
  if (uncertaintyCount > 0) informationalReasons.push('uncertainties-reported');
  if (differenceTopicCount > 0) informationalReasons.push('differences-reported');

  if (relationalComposition) {
    const relationalContradictionPresent =
      relationalComposition.reverseClaims.length > 0 ||
      relationalComposition.mixedClaims.length > 0;

    const contradictionReasons: TrustReason[] = [];
    if (relationalComposition.reverseClaims.length > 0) {
      contradictionReasons.push('reverse-evidence-present');
    }
    if (relationalComposition.mixedClaims.length > 0) {
      contradictionReasons.push('mixed-evidence-present');
    }

    if (relationalComposition.directionalEligibility === 'unsupported') {
      return {
        level: 'insufficient',
        reasons: ['requested-direction-unsupported', ...contradictionReasons, ...informationalReasons],
        distinctSourceArticleCount,
        relationalContradictionPresent,
        differenceTopicCount,
        uncertaintyCount,
        relationalEvidenceSufficiency: relationalComposition.evidenceSufficiency,
      };
    }

    if (relationalComposition.evidenceSufficiency === 'adequate') {
      return {
        level: relationalContradictionPresent ? 'moderate' : 'high',
        reasons: [
          'relational-support-adequate',
          ...contradictionReasons,
          ...informationalReasons,
        ],
        distinctSourceArticleCount,
        relationalContradictionPresent,
        differenceTopicCount,
        uncertaintyCount,
        relationalEvidenceSufficiency: relationalComposition.evidenceSufficiency,
      };
    }

    // evidenceSufficiency === 'limited'
    return {
      level: 'limited',
      reasons: ['relational-support-limited', ...contradictionReasons, ...informationalReasons],
      distinctSourceArticleCount,
      relationalContradictionPresent,
      differenceTopicCount,
      uncertaintyCount,
      relationalEvidenceSufficiency: relationalComposition.evidenceSufficiency,
    };
  }

  // Non-relational live path. 'high' is intentionally unreachable here
  // — see this file's own top-level doc comment.
  if (distinctSourceArticleCount === 0) {
    return {
      level: 'insufficient',
      reasons: ['no-grounded-evidence', ...informationalReasons],
      distinctSourceArticleCount,
      differenceTopicCount,
      uncertaintyCount,
    };
  }

  if (distinctSourceArticleCount === 1) {
    return {
      level: 'limited',
      reasons: ['single-distinct-article', ...informationalReasons],
      distinctSourceArticleCount,
      differenceTopicCount,
      uncertaintyCount,
    };
  }

  return {
    level: 'moderate',
    reasons: ['multiple-distinct-articles', ...informationalReasons],
    distinctSourceArticleCount,
    differenceTopicCount,
    uncertaintyCount,
  };
}
