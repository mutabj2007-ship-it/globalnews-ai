import type { TrustReason } from '@globalnews-ai/shared';

/**
 * Milestone #44 — frontend-only, language-neutral-contract-preserving
 * mapping from backend TrustReason codes to human-readable English
 * copy. Backend codes are never changed for wording purposes — this is
 * the sole translation layer, structured so a future localization pass
 * can swap this Record for a per-locale one without touching any
 * backend file or the TrustReason type itself.
 *
 * Exhaustive by construction: TypeScript's `Record<TrustReason, string>`
 * rejects this file at compile time if a backend TrustReason code is
 * ever added without a corresponding label here (test F).
 */
export const TRUST_REASON_LABELS: Record<TrustReason, string> = {
  'no-grounded-evidence': 'No grounded evidence was found for this question.',
  'single-distinct-article': 'Based on a single retrieved article.',
  'multiple-distinct-articles': 'Based on multiple retrieved articles.',
  'relational-support-adequate': 'Multiple distinct articles support this relationship.',
  'relational-support-limited': 'Only limited sourcing supports this relationship.',
  'requested-direction-unsupported': "The evidence doesn't establish the relationship as asked.",
  'reverse-evidence-present': 'Some reporting describes the reverse relationship.',
  'mixed-evidence-present': 'Reporting on this relationship is mixed or contested.',
  'uncertainties-reported': 'Some uncertainties remain in the reporting.',
  'differences-reported': 'Sources report this with differing emphasis or detail.',
  'mock-execution': 'This is demo analysis — real evidence was not assessed.',
};

export function trustReasonLabel(reason: TrustReason): string {
  return TRUST_REASON_LABELS[reason];
}

/**
 * Milestone #44 — PRESENTATION-ONLY priority order for choosing ONE
 * reason to headline in the primary trust view. This never changes
 * TrustLevel or which codes the backend considers applicable — it only
 * decides which single already-backend-supplied reason is shown first;
 * every reason remains available via the full expandable list. Exact
 * CTO-approved conservative ordering.
 */
const PRESENTATION_PRIORITY: TrustReason[] = [
  'mock-execution',
  'requested-direction-unsupported',
  'reverse-evidence-present',
  'mixed-evidence-present',
  'no-grounded-evidence',
  'relational-support-limited',
  'single-distinct-article',
  'relational-support-adequate',
  'multiple-distinct-articles',
  'uncertainties-reported',
  'differences-reported',
];

/**
 * Deterministically selects ONE reason from an array of backend-
 * supplied TrustReason codes for primary-view presentation. Pure
 * ordering — never invents a reason not already present in `reasons`,
 * never re-derives trust. Returns undefined only for an empty array
 * (defensive; a valid TrustState always has at least one reason).
 */
export function selectPrimaryReason(reasons: TrustReason[]): TrustReason | undefined {
  for (const candidate of PRESENTATION_PRIORITY) {
    if (reasons.includes(candidate)) return candidate;
  }
  return reasons[0];
}
