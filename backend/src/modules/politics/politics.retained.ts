import type { PoliticsCapture } from './politics.producer';

/**
 * Reviewed captured artifacts only. Empty after the R1 recovery inventory.
 * Archive EP literals and Kenya/Imihigo previews are NOT captured evidence.
 * Additions require source capture, rights review, accountable review and full revision chain.
 * This versioned ledger is immutable at runtime; there is no public write/import endpoint.
 */
export const POLITICS_RETAINED_CAPTURES: readonly PoliticsCapture[] = [];
