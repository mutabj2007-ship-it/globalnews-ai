import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE DECLARED UNQUALIFIED SET — WHAT IS STILL ENGLISH, IN WRITING
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R4 · PHASE B · CLAUDE H.
 *
 * The CTO's rule: *"Missing catalogue keys must fail tests rather than silently displaying
 * English."* This file is the half of that rule a test can hold on to.
 *
 * `askShellCoverage(locale).fallbacks` measures what ACTUALLY falls through to English.
 * This list declares what is ALLOWED to. `askShellCoverage.spec.ts` asserts the two sets are
 * EQUAL — not that one contains the other — so:
 *
 *   · a key added to the English catalogue and not translated  → FAILS, because it is
 *                                                                measured but not declared;
 *   · a key Claude L delivers but that is left declared here   → FAILS, because it is
 *                                                                declared but not measured;
 *   · the honest current state                                 → passes, and the exact size
 *                                                                of the gap is 144 lines a
 *                                                                reviewer can read.
 *
 * ── AFTER CLAUDE L'S DELIVERY: 468 → 144 ─────────────────────────────────
 *
 *   559  reader-visible Ask-shell keys on the base 5699eb7
 *   -24  `askSevenStrings` — already total over all seven, read directly, not overlaid
 *   ────
 *   535  overlay-managed keys  (`askShellKeyPaths().length`)
 *    -5  provider and product proper nouns, which no locale translates
 *   ────
 *   530  Claude L's scope
 *  -386  delivered and qualified by L, verified against her SHA-256 sums
 *   ────
 *   144  declared below, per locale — identical in all five
 *
 * ── WHY 144 REMAIN, WHICH IS NOT A SHORTFALL BY L ────────────────────────
 *
 * L worked from manifest **Revision 2** — 413 keys, the latest on disk when she began — and
 * delivered every one of them plus three the rebase had added that Revision 2 did not list.
 * Revisions 3 and 4 then raised the measured inventory to 530, after two corrections H found
 * while wiring: the enumerator was skipping function-valued members (33 templates), and
 * eighty more keys were never in a catalogue at all. The remainder is exactly those two
 * findings plus the `dict.navBar` and `dict.footer` members Revision 2 under-listed:
 *
 *    33  templates — function-valued members; they need plural forms per CLDR category,
 *        not a sentence, and no manifest before Revision 3 asked for one
 *    80  keys recovered from inside components (askGovernedCopy, askIntelligenceStrings,
 *        askRecentReportingStrings, askEvidenceTableStrings, askCopyStrings, askContextStrings)
 *    54  dict.navBar and dict.footer members Revision 2 did not carry
 *   ────
 *   167  with 23 of them counted twice above, being templates inside those namespaces
 *   ────
 *   144  distinct keys
 *
 * A Revision 5 DELTA manifest covering exactly these 144 has been issued to L. Nothing here
 * is a draft: a key L has not reached is ABSENT from the overlay and falls through to
 * English, which is a visible gap rather than an unreviewed sentence that looks finished.
 *
 * The five locales share one list because the gap is structural — it is the same set of keys
 * no manifest asked for — not because the five were treated as one.
 */

/** Identical in all five L-qualified locales today; the shape stays per-locale. */
const UNQUALIFIED_ALL_L_LOCALES: readonly string[] = Object.freeze([
  'askR2Strings.freshness.corroboratedAsOf()',
  'askR2Strings.r3.relationshipScope()',
  'askR2Strings.r3.choiceFor()',
  'askR2Strings.clarify.broadening()',
  'askR2Strings.guest.remaining()',
  'askR2Strings.sourcesLabel()',
  'briefingStrings.savedAs()',
  'briefingStrings.latest()',
  'briefingStrings.version()',
  'briefingStrings.superseded()',
  'askCopyStrings.copy',
  'askCopyStrings.copied',
  'askCopyStrings.failed',
  'askRecentReportingStrings.title()',
  'askRecentReportingStrings.topic.TRAVEL()',
  'askRecentReportingStrings.topic.ECONOMY()',
  'askRecentReportingStrings.topic.SECURITY()',
  'askRecentReportingStrings.topic.BUSINESS()',
  'askRecentReportingStrings.topic.SCIENCE()',
  'askRecentReportingStrings.note',
  'askRecentReportingStrings.none',
  'askRecentReportingStrings.unavailable',
  'askEvidenceTableStrings.caption',
  'askEvidenceTableStrings.point',
  'askEvidenceTableStrings.reported',
  'askEvidenceTableStrings.sources',
  'askEvidenceTableStrings.agreement',
  'askEvidenceTableStrings.citation()',
  'askEvidenceTableStrings.omitted()',
  'askContextStrings.compareDraftQuestion',
  'askContextStrings.comparingStories()',
  'askContextStrings.coverageChecked',
  'askGovernedCopy.imihigo()',
  'askGovernedCopy.imihigoProvenance()',
  'askGovernedCopy.imihigoFollowUp()',
  'askGovernedCopy.imihigoAbsent()',
  'askGovernedCopy.imihigoAbsentProvenance',
  'askGovernedCopy.imihigoAbsentFollowUp()',
  'askGovernedCopy.cpi()',
  'askGovernedCopy.cpiProvenance()',
  'askGovernedCopy.cpiFollowUp',
  'askGovernedCopy.cpiNotDisplayable',
  'askGovernedCopy.cpiNoCapture',
  'askGovernedCopy.cpiUnavailableProvenance',
  'askGovernedCopy.cpiUnavailableFollowUp',
  'askGovernedCopy.procurement()',
  'askGovernedCopy.procurementProvenance()',
  'askGovernedCopy.procurementFollowUp',
  'askGovernedCopy.recordNotDisplayable',
  'askGovernedCopy.recordNoCapture',
  'askGovernedCopy.recordUnreadable',
  'askGovernedCopy.recordUnavailableProvenance',
  'askGovernedCopy.official()',
  'askGovernedCopy.officialProvenance',
  'askGovernedCopy.officialFollowUp()',
  'askGovernedCopy.genericRecord',
  'askGovernedCopy.genericAbsent',
  'askGovernedCopy.genericProvenance',
  'askIntelligenceStrings.basedOn',
  'askIntelligenceStrings.currentReports',
  'askIntelligenceStrings.contributor.CONFLICT',
  'askIntelligenceStrings.contributor.MARKET_PROCUREMENT',
  'askIntelligenceStrings.contributor.ECONOMY_CPI',
  'askIntelligenceStrings.contributor.IMIHIGO',
  'askIntelligenceStrings.contributor.HUMANITARIAN',
  'askIntelligenceStrings.retainedNote.RETAINED_EVENT_RECORD',
  'askIntelligenceStrings.retainedNote.RETAINED_PUBLICATION',
  'askIntelligenceStrings.retainedNote.RETAINED_STATISTICAL_RELEASE',
  'askIntelligenceStrings.retainedNote.RETAINED_EVALUATION_CYCLE',
  'askIntelligenceStrings.placeContext',
  'askIntelligenceStrings.notAssessed.HUMANITARIAN',
  'askIntelligenceStrings.noMatch',
  'askIntelligenceStrings.aggregateNotAssigned',
  'askIntelligenceStrings.noRecentRecord',
  'askIntelligenceStrings.severityNotAssessed',
  'askIntelligenceStrings.snapshotNotSeries',
  'askIntelligenceStrings.source',
  'askIntelligenceStrings.subnationalScope',
  'askIntelligenceStrings.eventKind.ARMED_CLASH',
  'askIntelligenceStrings.eventKind.EXPLOSION_REMOTE_VIOLENCE',
  'askIntelligenceStrings.eventKind.VIOLENCE_AGAINST_CIVILIANS',
  'askIntelligenceStrings.eventKind.SIEGE_OR_ENCIRCLEMENT',
  'askIntelligenceStrings.eventKind.AERIAL_OR_NAVAL_ACTION',
  'askIntelligenceStrings.eventKind.CEASEFIRE_VIOLATION',
  'askIntelligenceStrings.eventKind.EVENT_TYPE_NOT_CLASSIFIED',
  'askIntelligenceStrings.parties',
  'askIntelligenceStrings.cited',
  'askIntelligenceStrings.lead.imihigo()',
  'askIntelligenceStrings.lead.cpi()',
  'askIntelligenceStrings.lead.procurement()',
  'dict.navBar.homeAriaLabel',
  'dict.navBar.primaryNavigationAriaLabel',
  'dict.navBar.mobileNavigationAriaLabel',
  'dict.navBar.searchAriaLabel',
  'dict.navBar.openMenuAriaLabel',
  'dict.navBar.closeMenuAriaLabel',
  'dict.navBar.signIn',
  'dict.navBar.account',
  'dict.navBar.accountMenuAriaLabel',
  'dict.navBar.signedInAs',
  'dict.navBar.help',
  'dict.navBar.history',
  'dict.navBar.support',
  'dict.navBar.signOut',
  'dict.navBar.deleteAccount',
  'dict.navBar.deleteAccountConfirm',
  'dict.navBar.languageSelectorLabel',
  'dict.navBar.languageSelectorAction',
  'dict.navBar.sectionsHeading',
  'dict.navBar.editorialUnavailableLabel',
  'dict.navBar.navItemLabels.home',
  'dict.navBar.navItemLabels.worldMap',
  'dict.navBar.navItemLabels.world',
  'dict.navBar.navItemLabels.politics',
  'dict.navBar.navItemLabels.business',
  'dict.navBar.navItemLabels.technology',
  'dict.navBar.navItemLabels.science',
  'dict.navBar.navItemLabels.health',
  'dict.navBar.navItemLabels.about',
  'dict.navBar.linkLabels./',
  'dict.navBar.linkLabels./map',
  'dict.navBar.linkLabels./world',
  'dict.navBar.linkLabels./politics',
  'dict.navBar.linkLabels./business',
  'dict.navBar.linkLabels./technology',
  'dict.navBar.linkLabels./science',
  'dict.navBar.linkLabels./health',
  'dict.navBar.linkLabels./about',
  'dict.footer.tagline',
  'dict.footer.groupTitles.Company',
  'dict.footer.groupTitles.Legal',
  'dict.footer.groupTitles.Developers',
  'dict.footer.groupTitles.Help',
  'dict.footer.navigationAriaLabel',
  'dict.footer.linkLabels./support',
  'dict.footer.linkLabels./about',
  'dict.footer.linkLabels./careers',
  'dict.footer.linkLabels./contact',
  'dict.footer.linkLabels./privacy',
  'dict.footer.linkLabels./terms',
  'dict.footer.linkLabels./source-policy',
  'dict.footer.comingSoon',
  'dict.footer.copyrightSuffix',
  'dict.footer.closingTagline'
]);

/**
 * The declared fallback set per locale. EN and PL are authored catalogues with no gap, and a
 * locale absent from this record is asserted to have none either.
 */
export const ASK_SHELL_DECLARED_FALLBACKS: Readonly<
  Partial<Record<DisplayLocale, readonly string[]>>
> = Object.freeze({
  fr: UNQUALIFIED_ALL_L_LOCALES,
  de: UNQUALIFIED_ALL_L_LOCALES,
  es: UNQUALIFIED_ALL_L_LOCALES,
  pt: UNQUALIFIED_ALL_L_LOCALES,
  ar: UNQUALIFIED_ALL_L_LOCALES,
});

export function declaredFallbacksFor(locale: DisplayLocale): readonly string[] {
  return ASK_SHELL_DECLARED_FALLBACKS[locale] ?? [];
}
