/**
 * T2 · ECONOMY'S INLINE ENGLISH — AN INVENTORY, NOT A CATALOGUE.
 *
 * `economyStrings` is complete in all seven locales, but the Economy preview ALSO renders English
 * literals written directly in `components/economy/EconomyScreen.tsx` and
 * `app/economy-visual-preview/page.tsx`. Those literals reach every reader in every locale, so a
 * French or Polish Economy page is a mixed-language shell today.
 *
 * The effective-locale rule can only see what a catalogue declares, so the literals are listed
 * here as an English-only namespace (`economyInline` in catalogueCoverage.ts). Nothing renders
 * from this file. The consequence is the honest one: Economy renders English with the declared
 * notice for every non-English selection until these strings move into `economyStrings` with
 * Claude L's wording (the spec is in the T2 dossier). `economyInlineInventory.spec.ts` asserts
 * each text still occurs verbatim in its source file, so the inventory cannot go stale silently.
 */
export const ECONOMY_INLINE_ENGLISH = {
  'EconomyScreen.triadExplanation.present':
    'Actual is the retained official observation. Expected and previous values are not retained, so no surprise or comparative assessment is shown.',
  'EconomyScreen.triadExplanation.absent': 'No observation triad is available for this subject.',
  'EconomyScreen.footNotes.anchored': 'Anchored beside triad',
  'EconomyScreen.footNotes.noStacking': 'No stacking · no metered action',
  'EconomyScreen.timelineUnavailable': 'No timeline is retained yet.',
  'EconomyScreen.chainUnavailable': 'No relationship chain is retained yet.',
  'EconomyScreen.triadUnavailable': 'No observation triad is available.',
  'EconomyScreen.revisionUnavailable': 'No revision history is retained yet.',
  'EconomyScreen.competingUnavailable': 'No competing reading set is retained yet.',
  'EconomyScreen.policyUnavailable': 'No policy event is retained for this observation.',
  'EconomyScreen.analysisNotConnected': 'Analysis workspace handoff is not connected on this preview.',
  'economy-visual-preview.revisionEffect': 'Current retained vintage · no earlier revision is retained.',
} as const;

/** Where each inventoried literal lives (for the inventory guard). */
export const ECONOMY_INLINE_SOURCES: Readonly<Record<keyof typeof ECONOMY_INLINE_ENGLISH, string>> = {
  'EconomyScreen.triadExplanation.present': 'components/economy/EconomyScreen.tsx',
  'EconomyScreen.triadExplanation.absent': 'components/economy/EconomyScreen.tsx',
  'EconomyScreen.footNotes.anchored': 'components/economy/EconomyScreen.tsx',
  'EconomyScreen.footNotes.noStacking': 'components/economy/EconomyScreen.tsx',
  'EconomyScreen.timelineUnavailable': 'components/economy/EconomyScreen.tsx',
  'EconomyScreen.chainUnavailable': 'components/economy/EconomyScreen.tsx',
  'EconomyScreen.triadUnavailable': 'components/economy/EconomyScreen.tsx',
  'EconomyScreen.revisionUnavailable': 'components/economy/EconomyScreen.tsx',
  'EconomyScreen.competingUnavailable': 'components/economy/EconomyScreen.tsx',
  'EconomyScreen.policyUnavailable': 'components/economy/EconomyScreen.tsx',
  'EconomyScreen.analysisNotConnected': 'components/economy/EconomyScreen.tsx',
  'economy-visual-preview.revisionEffect': 'app/economy-visual-preview/page.tsx',
};
