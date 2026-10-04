import { DISPLAY_LOCALES, type DisplayLocale } from '@globalnews-ai/shared';
import { completeLocalesOf, dictionaryNamespaceIds } from '@/qualification/i18n/catalogueCoverage';
import { SOURCE_DISPLAY_LOCALE as SOURCE_DISPLAY_LOCALE_ID } from '@/lib/i18n/displayLocale';
import {
  SURFACES,
  expressibleLocales,
  surfaceIds,
  type SurfaceId,
} from '@/lib/i18n/surfaceLocale';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * T2 · QUALIFICATION TOOLING — WHICH CATALOGUE NAMESPACES EACH SURFACE USES, AND WHAT IT CAN RENDER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * NOT PRODUCT CODE. This module (and `catalogueCoverage.ts` beside it) reads EVERY catalogue in the
 * product — domain catalogues included — to MEASURE completeness. It lives under
 * `src/qualification/` precisely so no route, layout or component imports it (asserted by
 * `displayLocaleAuthority.spec.ts`): product code reads the GENERATED result,
 * `lib/i18n/surfaceRenderable.generated.ts`, which `scripts/i18n/t2-reconcile-catalogues.cjs`
 * writes from `measuredRenderableLocalesOf` and `surfaceLocale.spec.ts` asserts is equal to it.
 *
 * NAMESPACE LISTS ARE CONSERVATIVE SUPERSETS. A surface lists every namespace its component tree
 * can reach; listing one too many can only make a locale fall back (declared), never make an
 * incomplete one look complete.
 */

/** Every page outside Ask carries the platform chrome and the global Ask dock. */
const PLATFORM_CHROME: readonly string[] = [
  'dict:root',
  'dict:navBar',
  'dict:footer',
  'dict:mobileBottomNav',
  'dict:authError',
  'dict:askAi',
  'dict:presentationRibbon',
  'returnStrings',
  'askShell',
  /* T5 Part B — the Footer's /cookies label comes from the `consent` catalogue. */
  'consent',
];

/** The standalone Ask chrome (AskNavShell / AskContinuityHeader), owned by H. */
const ASK_CHROME: readonly string[] = ['askShell', 'askSeven'];

/** Dictionary namespaces that belong to one non-Home surface only. */
const NON_HOME_DICTIONARY: readonly string[] = [
  'dict:admin',
  'dict:support',
  'dict:privacyPage',
  'dict:termsPage',
  'dict:thirdPartyNoticesPage',
  'dict:sourcePolicyPage',
  'dict:accountSettings',
];

/** The analysis frame family (search, map story Q&A, workspace). */
const ANALYSIS: readonly string[] = [
  'dict:analysisResultView',
  'dict:analysisWorkspace',
  'dict:analysisModeBadge',
  'dict:evidenceSufficiencyNote',
  'dict:retrievalContextStatus',
  'dict:sourceEntitiesPanel',
  'dict:formatRelativeTime',
  'dict:eventAnchor',
  'dict:analysisFrame',
  'trustReasons',
];

const uniq = (...lists: ReadonlyArray<readonly string[]>): readonly string[] => [
  ...new Set(lists.flat()),
];

/** Home reaches nearly every public dictionary namespace; the conservative superset is all of them. */
function homeDictionary(): readonly string[] {
  return dictionaryNamespaceIds().filter((id) => !NON_HOME_DICTIONARY.includes(id));
}

export const SURFACE_NAMESPACES: Readonly<Record<SurfaceId, readonly string[]>> = {
  home: uniq(PLATFORM_CHROME, homeDictionary(), ['trustReasons']),
  askStandalone: ASK_CHROME,
  askRecent: ASK_CHROME,
  saved: ASK_CHROME,
  accountSettings: uniq(ASK_CHROME, PLATFORM_CHROME, ['dict:accountSettings']),
  search: uniq(PLATFORM_CHROME, ANALYSIS, ['dict:hero', 'dict:heroContext']),
  map: uniq(PLATFORM_CHROME, ANALYSIS, ['dict:map', 'dict:situationMap', 'dict:liveStatusStrip', 'conflict']),
  conflict: uniq(PLATFORM_CHROME, ['conflict', 'dict:map']),
  energy: ['energy', 'returnStrings'],
  market: uniq(PLATFORM_CHROME, ['market']),
  humanitarian: uniq(PLATFORM_CHROME, ['humanitarian']),
  economy: ['economy', 'economyRetained', 'economyInline', 'returnStrings'],
  politics: ['politics', 'returnStrings'],
  election: ['election', 'returnStrings'],
  security: ['security', 'returnStrings'],
  delivery: ['delivery', 'returnStrings'],
  imihigo: ['delivery', 'returnStrings'],
  myIntelligence: uniq(PLATFORM_CHROME, ANALYSIS, ASK_CHROME, [
      'dict:myIntelligence',
      'dict:homeR1',
      'dict:betaHome',
    ]),
  support: uniq(PLATFORM_CHROME, ASK_CHROME, ['dict:support']),
  history: uniq(PLATFORM_CHROME, ['history']),
  privacy: uniq(PLATFORM_CHROME, ['dict:privacyPage', 'cookiesPage', 'consent']),
  terms: uniq(PLATFORM_CHROME, ['dict:termsPage']),
  cookies: uniq(PLATFORM_CHROME, ['cookiesPage', 'consent']),
  sourcePolicy: uniq(PLATFORM_CHROME, ['dict:sourcePolicyPage']),
  thirdPartyNotices: uniq(PLATFORM_CHROME, ['dict:thirdPartyNoticesPage']),
  workspace: uniq(PLATFORM_CHROME, ANALYSIS, ['dict:todayWorkspace', 'dict:today']),
  admin: uniq(PLATFORM_CHROME, ['dict:admin']),
  failure: ['failureCopy', 'dict:navBar', 'dict:root'],
  default: PLATFORM_CHROME,
};

/**
 * The locales a surface renders COMPLETELY, English first (English is always renderable and is the
 * declared fallback): every namespace complete AND the locale expressible by its component tree.
 */
export function measuredRenderableLocalesOf(surface: SurfaceId): readonly DisplayLocale[] {
  const expressible = expressibleLocales(SURFACES[surface].expressible);
  const complete = DISPLAY_LOCALES.filter(
    (locale) =>
      locale !== SOURCE_DISPLAY_LOCALE_ID &&
      expressible.includes(locale) &&
      SURFACE_NAMESPACES[surface].every((ns) => completeLocalesOf(ns).includes(locale)),
  );
  return [SOURCE_DISPLAY_LOCALE_ID, ...complete];
}

/** The incomplete namespaces that force a fallback for `locale` (for the dossier and tests). */
export function blockingNamespaces(surface: SurfaceId, locale: DisplayLocale): readonly string[] {
  if (locale === SOURCE_DISPLAY_LOCALE_ID) return [];
  return SURFACE_NAMESPACES[surface].filter((ns) => !completeLocalesOf(ns).includes(locale));
}

/** The whole measured table, in the shape of `SURFACE_RENDERABLE`. */
export function measuredSurfaceRenderable(): Record<SurfaceId, readonly DisplayLocale[]> {
  return Object.fromEntries(surfaceIds().map((id) => [id, measuredRenderableLocalesOf(id)])) as Record<
    SurfaceId,
    readonly DisplayLocale[]
  >;
}
