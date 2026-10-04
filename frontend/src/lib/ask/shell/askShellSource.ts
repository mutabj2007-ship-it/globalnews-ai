import { askR2Strings, type AskR2Strings } from '@/lib/ask/askR2Strings';
import { resolveAskStrings, type AskStrings } from '@/lib/ask/askStrings';
import { askContinuityStrings, type AskContinuityStrings } from '@/lib/ask/askContinuityStrings';
import { briefingStrings, type BriefingStrings } from '@/lib/ask/briefingStrings';
import { ASK_NAV_STRINGS, type AskNavStrings } from '@/lib/ask/askNavStrings';
import { askRecordStrings } from '@/lib/ask/askModuleRef';
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionaries';
import {
  askContextStrings,
  askCopyStrings,
  askEvidenceTableStrings,
  askRecentReportingStrings,
  type AskContextStrings,
  type AskCopyStrings,
  type AskEvidenceTableStrings,
  type AskRecentReportingStrings,
} from '@/lib/ask/askSurfaceStrings';
import { askGovernedCopy, type AskGovernedCopy } from '@/lib/ask/askGovernedConversation';
import { askIntelligenceStrings, type AskIntelligenceStrings } from '@/lib/ask/askIntelligenceView';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R4 · PHASE B — ONE ENGLISH SOURCE OF TRUTH FOR THE WHOLE ASK SHELL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every catalogue a Standalone Ask reader can reach, assembled into ONE tree so that
 * "what strings does the Ask shell have" has exactly one answer. The Product Owner's
 * scope ruling (Option 2) is the boundary: the Ask surface and everything reachable from
 * it. Home, My Intelligence, maps and dashboards are deliberately NOT here.
 *
 * ── WHY THE DICTIONARY NAMESPACES ARE COPIED IN RATHER THAN WIDENED IN PLACE ──
 *
 * `navBar`, `footer`, `accountSettings`, `loadingStages`, `authError` and `askAi` come from
 * `lib/i18n/dictionaries`, which is PRODUCT-WIDE: Home renders from the same object.
 * Widening `getDictionary` to seven locales would localize Home as a side effect, and the
 * ruling is explicit — *"Do not turn this into whole-product localization yet."*
 *
 * So the six namespaces a Standalone Ask reader can actually reach are projected into this
 * Ask-scoped tree, localized here, and read back by the Ask surfaces through
 * `askShellDictionary()`. `getDictionary` is untouched, so no out-of-scope surface changes.
 * When whole-product localization is commissioned, the overlays move; the mechanism does not.
 *
 * ── THE SHAPE IS THE MANIFEST ─────────────────────────────────────────────
 *
 * The key paths of this tree ARE the key paths in Claude L's manifest, and a spec asserts
 * that the two sets are identical. A key added to a catalogue therefore appears in the
 * manifest's diff rather than appearing as English text in front of a French reader.
 */

/** The six dictionary namespaces a Standalone Ask reader can reach. Named, not inferred. */
export const ASK_SHELL_DICTIONARY_NAMESPACES = Object.freeze([
  'askAi',
  'navBar',
  'footer',
  'accountSettings',
  'loadingStages',
  'authError',
] as const);

export type AskShellDictionaryNamespace = (typeof ASK_SHELL_DICTIONARY_NAMESPACES)[number];

export type AskShellDictionary = Pick<Dictionary, AskShellDictionaryNamespace>;

export interface AskShellSource {
  readonly askR2Strings: AskR2Strings;
  readonly askStrings: AskStrings;
  readonly askContinuityStrings: AskContinuityStrings;
  readonly briefingStrings: BriefingStrings;
  readonly askNavStrings: AskNavStrings;
  readonly askRecordStrings: ReturnType<typeof askRecordStrings>;
  /** Recovered from inside components in Phase B; see `askSurfaceStrings.ts`. */
  readonly askCopyStrings: AskCopyStrings;
  readonly askRecentReportingStrings: AskRecentReportingStrings;
  readonly askEvidenceTableStrings: AskEvidenceTableStrings;
  readonly askContextStrings: AskContextStrings;
  /** Already exported, but resolved per locale inside their own modules until Phase B. */
  readonly askGovernedCopy: AskGovernedCopy;
  readonly askIntelligenceStrings: AskIntelligenceStrings;
  readonly dict: AskShellDictionary;
}

function dictionaryProjection(): AskShellDictionary {
  const en = getDictionary('en');
  return {
    askAi: en.askAi,
    navBar: en.navBar,
    footer: en.footer,
    accountSettings: en.accountSettings,
    loadingStages: en.loadingStages,
    authError: en.authError,
  };
}

/**
 * The English Ask shell. Read from the existing catalogues rather than re-transcribed,
 * because a second copy of 187 frozen D25 strings is a second thing to keep in step.
 */
export function askShellSource(): AskShellSource {
  return {
    askR2Strings: askR2Strings('en'),
    askStrings: resolveAskStrings('en').strings,
    askContinuityStrings: askContinuityStrings('en'),
    briefingStrings: briefingStrings('en'),
    askNavStrings: ASK_NAV_STRINGS.en,
    askRecordStrings: askRecordStrings('en'),
    askCopyStrings: askCopyStrings('en'),
    askRecentReportingStrings: askRecentReportingStrings('en'),
    askEvidenceTableStrings: askEvidenceTableStrings('en'),
    askContextStrings: askContextStrings('en'),
    askGovernedCopy: askGovernedCopy('en'),
    askIntelligenceStrings: askIntelligenceStrings('en'),
    dict: dictionaryProjection(),
  };
}

/**
 * The POLISH shell, which is not an overlay.
 *
 * Polish is a fully authored catalogue that predates this mechanism and is linguistically
 * qualified already. Re-expressing it as a 450-key overlay would gain nothing and would risk
 * changing shipped Polish copy, so Polish is read straight from its own catalogues and the
 * overlay path is not used for it. That is why `askShellQualification('pl')` is `SOURCE`.
 */
export function askShellPolish(): AskShellSource {
  return {
    askR2Strings: askR2Strings('pl'),
    askStrings: resolveAskStrings('pl').strings,
    askContinuityStrings: askContinuityStrings('pl'),
    briefingStrings: briefingStrings('pl'),
    askNavStrings: ASK_NAV_STRINGS.pl,
    askRecordStrings: askRecordStrings('pl'),
    askCopyStrings: askCopyStrings('pl'),
    askRecentReportingStrings: askRecentReportingStrings('pl'),
    askEvidenceTableStrings: askEvidenceTableStrings('pl'),
    askContextStrings: askContextStrings('pl'),
    askGovernedCopy: askGovernedCopy('pl'),
    askIntelligenceStrings: askIntelligenceStrings('pl'),
    dict: (() => {
      const pl = getDictionary('pl');
      return {
        askAi: pl.askAi,
        navBar: pl.navBar,
        footer: pl.footer,
        accountSettings: pl.accountSettings,
        loadingStages: pl.loadingStages,
        authError: pl.authError,
      };
    })(),
  };
}

/**
 * PROVIDER AND PRODUCT NAMES — not translated in any locale, enumerated rather than inferred.
 *
 * Revision 2 of the manifest treated any key whose English and Polish values matched as
 * needing no translation. That is not a safe inference from two locales, and it excluded two
 * keys that do need a translator: `askStrings.localeFallback` is English prose currently
 * shown to POLISH readers — a live defect — and `askR2Strings.r3.relations.TRANSPORT` is an
 * English word that happens to coincide with the Polish one. Both are back in scope, and
 * invariance is now this list and nothing else.
 */
export const ASK_SHELL_PROPER_NOUNS: readonly string[] = Object.freeze([
  'askR2Strings.verification.lanes.gnews',
  'askR2Strings.verification.lanes.gdelt-doc',
  'askR2Strings.verification.lanes.x',
  'askR2Strings.verification.lanes.youtube',
  'dict.footer.linkLabels./api',
]);
