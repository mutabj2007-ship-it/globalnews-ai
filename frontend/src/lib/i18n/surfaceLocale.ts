import {
  DISPLAY_LOCALES,
  directionFor,
  documentLanguageOf,
  resolveContentLocale,
  type DisplayLocale,
  type DocumentLanguageAttributes,
  type LanguageCode,
  type TextDirection,
} from '@globalnews-ai/shared';
import { SURFACE_RENDERABLE } from '@/lib/i18n/surfaceRenderable.generated';
import { fallbackNoticeFor, type FallbackNoticeCopy } from '@/lib/i18n/fallbackNotice';
import { SOURCE_DISPLAY_LOCALE } from '@/lib/i18n/displayLocale';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * T2 · THE EFFECTIVE-LOCALE RULE — ONE DECISION PER SURFACE, SHARED BY THE PAGE AND <html>
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A surface renders in the reader's selected locale ONLY IF every catalogue namespace it uses is
 * complete for that locale (a key is complete when translated, QUALIFIED_UNCHANGED or
 * NOT_TRANSLATED_BY_DESIGN). Otherwise the WHOLE surface renders in
 * English — no mixed-language shell — and a DECLARED fallback notice is shown in the selected
 * language. `<html lang>` and `<html dir>` describe the EFFECTIVE locale (what is on the page),
 * never the requested one (the shared contract's `documentLanguageOf`).
 *
 * The root layout and the route page both call `resolveSurfaceLocale` with the same surface id
 * (the layout finds it from the request path via `surfaceForPathname`, surfaceRoutes.ts), so the document
 * attributes and the rendered catalogue cannot disagree.
 *
 * MEASURED, THEN GENERATED. Which locales a surface can render completely is MEASURED by the
 * qualification tooling (`src/qualification/i18n/surfaceCoverage.ts`, which reads every catalogue
 * the surface's component tree can reach) and written to `surfaceRenderable.generated.ts` by
 * `scripts/i18n/t2-reconcile-catalogues.cjs`. `surfaceLocale.spec.ts` asserts the generated table
 * EQUALS the live measurement, so a catalogue change that is not regenerated fails CI. Product code
 * therefore never imports the catalogues of surfaces it does not render (a Politics preview does not
 * load the Admin dictionary to decide its own <html lang>).
 *
 * EXPRESSIBILITY. Some surfaces still hand the locale to components typed `LanguageCode`, which
 * cannot express `de` or `pt` (LANG-UI-7-D1 keeps LanguageCode unwidened). Those surfaces are
 * `expressible: 'LANGUAGE_CODE'`: a locale the component tree cannot be given is treated exactly
 * like an incomplete catalogue — declared fallback — never a cast.
 */

export type SurfaceId =
  | 'home'
  | 'askStandalone'
  | 'askRecent'
  | 'saved'
  | 'accountSettings'
  | 'search'
  | 'map'
  | 'conflict'
  | 'energy'
  | 'market'
  | 'humanitarian'
  | 'economy'
  | 'politics'
  | 'election'
  | 'security'
  | 'delivery'
  | 'imihigo'
  | 'myIntelligence'
  | 'support'
  | 'history'
  | 'privacy'
  | 'terms'
  | 'cookies'
  | 'sourcePolicy'
  | 'thirdPartyNotices'
  | 'workspace'
  | 'admin'
  | 'failure'
  | 'default';

export type SurfaceExpressibility = 'DISPLAY_LOCALE' | 'LANGUAGE_CODE';

export interface SurfaceDefinition {
  readonly id: SurfaceId;
  readonly label: string;
  readonly expressible: SurfaceExpressibility;
  /** The route file renders through a protected file T2 may not edit (recorded in the dossier). */
  readonly protectedRoute?: 'HUMANITARIAN' | 'POLITICS' | 'H+R4';
}

export const SURFACES: Readonly<Record<SurfaceId, SurfaceDefinition>> = {
  home: {
    id: 'home',
    label: 'Home (platform mode `/`)',
    /*
      PROTECTED ROUTE (HUMANITARIAN): `app/page.tsx` may not be edited by T2 and still clamps the
      cookie to en/pl itself. For en/pl that is exactly this rule's result (every namespace below
      is complete in both), and for fr–ar the page renders English, which is also this rule's
      result — so <html lang>/dir and the notice agree with what the protected page renders. The
      patch that moves the page onto `surfaceLocale('home')` is specified in the T2 dossier.
    */
    expressible: 'LANGUAGE_CODE',
    protectedRoute: 'HUMANITARIAN',
  },
  askStandalone: {
    id: 'askStandalone',
    label: 'Ask (standalone `/` and `/ask`)',
    expressible: 'DISPLAY_LOCALE',
  },
  askRecent: {
    id: 'askRecent',
    label: 'Ask · Recent',
    expressible: 'DISPLAY_LOCALE',
  },
  saved: {
    id: 'saved',
    label: 'Saved / Saved briefing',
    /* Briefing copy is part of H's Ask shell (`askShellSource().briefingStrings`), so the shell's
       own coverage measures it; the standalone `briefing` namespace is not listed twice. */
    expressible: 'DISPLAY_LOCALE',
  },
  accountSettings: {
    id: 'accountSettings',
    label: 'Account · Settings',
    expressible: 'LANGUAGE_CODE',
    protectedRoute: 'H+R4',
  },
  search: {
    id: 'search',
    label: 'Search / analysis',
    expressible: 'LANGUAGE_CODE',
  },
  map: {
    id: 'map',
    label: 'Map',
    expressible: 'LANGUAGE_CODE',
  },
  conflict: {
    id: 'conflict',
    label: 'Conflict',
    expressible: 'LANGUAGE_CODE',
  },
  energy: {
    id: 'energy',
    label: 'Energy',
    expressible: 'LANGUAGE_CODE',
  },
  market: {
    id: 'market',
    label: 'Market (+ compact)',
    expressible: 'LANGUAGE_CODE',
  },
  humanitarian: {
    id: 'humanitarian',
    label: 'Humanitarian (+ compact)',
    expressible: 'LANGUAGE_CODE',
    protectedRoute: 'HUMANITARIAN',
  },
  economy: {
    id: 'economy',
    label: 'Economy preview (+ compact)',
    expressible: 'DISPLAY_LOCALE',
  },
  politics: {
    id: 'politics',
    label: 'Politics preview (+ compact)',
    expressible: 'DISPLAY_LOCALE',
  },
  election: {
    id: 'election',
    label: 'Election preview (+ compact)',
    expressible: 'DISPLAY_LOCALE',
  },
  security: {
    id: 'security',
    label: 'Security preview (+ compact)',
    expressible: 'DISPLAY_LOCALE',
  },
  delivery: {
    id: 'delivery',
    label: 'Delivery preview (+ compact)',
    expressible: 'DISPLAY_LOCALE',
  },
  imihigo: {
    id: 'imihigo',
    label: 'Imihigo',
    expressible: 'DISPLAY_LOCALE',
  },
  myIntelligence: {
    id: 'myIntelligence',
    label: 'My Intelligence',
    expressible: 'LANGUAGE_CODE',
  },
  support: {
    id: 'support',
    label: 'Support',
    expressible: 'LANGUAGE_CODE',
  },
  history: {
    id: 'history',
    label: 'History',
    expressible: 'LANGUAGE_CODE',
  },
  privacy: {
    id: 'privacy',
    label: 'Privacy',
    expressible: 'LANGUAGE_CODE',
  },
  terms: {
    id: 'terms',
    label: 'Terms',
    expressible: 'LANGUAGE_CODE',
  },
  cookies: {
    id: 'cookies',
    label: 'Cookies',
    expressible: 'LANGUAGE_CODE',
  },
  sourcePolicy: {
    id: 'sourcePolicy',
    label: 'Source policy',
    expressible: 'LANGUAGE_CODE',
  },
  thirdPartyNotices: {
    id: 'thirdPartyNotices',
    label: 'Third-party notices',
    expressible: 'LANGUAGE_CODE',
  },
  workspace: {
    id: 'workspace',
    label: 'Workspace',
    expressible: 'LANGUAGE_CODE',
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    expressible: 'LANGUAGE_CODE',
  },
  failure: {
    id: 'failure',
    label: 'Not-found / error surfaces',
    expressible: 'LANGUAGE_CODE',
  },
  default: {
    id: 'default',
    label: 'Any other route (platform chrome only)',
    expressible: 'LANGUAGE_CODE',
  },
};

/** The source-locale set a `LanguageCode`-typed component tree can be given. */
const LANGUAGE_CODE_EXPRESSIBLE: readonly DisplayLocale[] = ['en', 'pl', 'fr', 'es', 'ar'];

export function expressibleLocales(expressible: SurfaceExpressibility): readonly DisplayLocale[] {
  return expressible === 'DISPLAY_LOCALE' ? DISPLAY_LOCALES : LANGUAGE_CODE_EXPRESSIBLE;
}

/**
 * The locales this surface renders COMPLETELY, English first (English is always renderable and is
 * the declared fallback — `resolveContentLocale` falls back to the first entry). From the generated
 * table; see the header.
 */
export function renderableLocalesOf(surface: SurfaceId): readonly DisplayLocale[] {
  return SURFACE_RENDERABLE[surface];
}

export interface SurfaceLocale {
  readonly surface: SurfaceId;
  /** What the reader asked for. This is what stays persisted. */
  readonly requested: DisplayLocale;
  /** What the surface renders. The only value that may describe the document. */
  readonly effective: DisplayLocale;
  /** True when the surface renders English because the requested locale is incomplete here. */
  readonly fellBack: boolean;
  /** `<html lang>` / `<html dir>` for this surface: the effective locale's. */
  readonly document: DocumentLanguageAttributes;
  readonly dir: TextDirection;
  /**
   * The effective locale for a component tree typed `LanguageCode`. Equal to `effective` by
   * construction for `LANGUAGE_CODE` surfaces (their renderable set excludes de/pt).
   */
  readonly language: LanguageCode & DisplayLocale;
  /** The declared notice, in the REQUESTED language, when the surface fell back. */
  readonly notice: (FallbackNoticeCopy & { readonly lang: DisplayLocale; readonly dir: TextDirection }) | null;
}

function asLanguageCode(locale: DisplayLocale): LanguageCode & DisplayLocale {
  switch (locale) {
    case 'en':
    case 'pl':
    case 'fr':
    case 'es':
    case 'ar':
      return locale;
    default:
      /* Unreachable for LANGUAGE_CODE surfaces (renderable excludes de/pt). For DISPLAY_LOCALE
         surfaces `language` is not read; `effective` is. */
      return SOURCE_DISPLAY_LOCALE;
  }
}

/** THE RULE. Pure: the server helper supplies the requested locale from the cookie. */
export function resolveSurfaceLocale(surface: SurfaceId, requested: DisplayLocale): SurfaceLocale {
  const resolution = resolveContentLocale(requested, renderableLocalesOf(surface));
  const document = documentLanguageOf(resolution);
  return {
    surface,
    requested,
    effective: resolution.effectiveContentLocale,
    fellBack: resolution.fellBack,
    document,
    dir: document.dir,
    language: asLanguageCode(resolution.effectiveContentLocale),
    notice: resolution.fellBack
      ? { ...fallbackNoticeFor(requested), lang: requested, dir: directionFor(requested) }
      : null,
  };
}

/**
 * The effective locale narrowed to a catalogue's own locale type (e.g. `'en' | 'pl'`).
 *
 * Equal to `effective` by construction: a surface whose namespaces are authored only in
 * `allowed` cannot have any other effective locale (they would be incomplete). The `allowed[0]`
 * branch is therefore unreachable; it exists so the narrowing is checked rather than cast, and a
 * test asserts it is never taken for any surface × locale.
 */
export function effectiveWithin<L extends DisplayLocale>(
  locale: SurfaceLocale,
  allowed: readonly [L, ...L[]],
): L {
  return (allowed as readonly DisplayLocale[]).includes(locale.effective)
    ? (locale.effective as L)
    : allowed[0];
}

export function surfaceIds(): readonly SurfaceId[] {
  return Object.keys(SURFACES) as SurfaceId[];
}
