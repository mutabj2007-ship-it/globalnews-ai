/**
 * Ask v1.8 visual authority: Scope and layout format.zip -> handoff/.
 * SHA256 194977b4515954b2828129bf83db26bc0b3d5f2e6a39b407e0958e13de6c7450.
 * CTO 2026-09-23: /ask is the idle dashboard; /search remains Complete Analysis.
 * Split modes, HUD hierarchy, precision and sheet detents remain owned by map/d1.
 * Plan B: unsupported change, suggestion, alert and Watch fields stay absent.
 */
export const ASK_CANONICAL_ROUTE = '/ask';
export const ASK_ABSENT = '—';
export type AnswerBlockId =
  | 'answer'
  | 'why-it-matters'
  | 'confidence'
  | 'key-evidence'
  | 'geographic-context'
  | 'actions'
  | 'follow-ups';
export type ComputeStepId = 'retrieval' | 'change-record' | 'geographic-check' | 'composition';
export type SuggestionCategory =
  'situation' | 'explanation' | 'comparative' | 'watch-oriented' | 'deeper-analysis';
export const SUGGESTION_CATEGORIES: readonly SuggestionCategory[] = [
  'situation',
  'explanation',
  'comparative',
  'watch-oriented',
  'deeper-analysis',
];
