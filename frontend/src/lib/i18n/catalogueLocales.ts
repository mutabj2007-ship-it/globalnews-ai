import { DISPLAY_LOCALES, DISPLAY_LOCALE_META, type DisplayLocale } from '@globalnews-ai/shared';
import { QUALIFIED_DICTIONARY_OVERLAYS } from '@/lib/i18n/qualifiedDictionaryOverlays';

/**
 * T2 · LIGHTWEIGHT, CLIENT-SAFE VIEWS OF THE LANGUAGE REGISTRY, for copy that STATES which
 * languages something is available in. Such copy was hard-coded ("English, Polski") and would
 * have gone stale the moment a catalogue was qualified; it is now derived.
 *
 * `dictionaryNamespaceLocales` reads only the authored EN/PL dictionaries and the qualified
 * overlays (no catalogue measurement, so it is cheap enough for a client screen).
 * `catalogueLocales.spec.ts` asserts it agrees with the measured `completeLocalesOf` for the
 * namespaces that use it, so the cheap view cannot drift from the measured one.
 */
export function dictionaryNamespaceLocales(namespace: string): readonly DisplayLocale[] {
  return DISPLAY_LOCALES.filter(
    (locale) =>
      locale === 'en' ||
      locale === 'pl' ||
      (QUALIFIED_DICTIONARY_OVERLAYS as Partial<Record<string, Record<string, unknown>>>)[locale]?.[
        namespace
      ] !== undefined,
  );
}

/** The locales' own names, joined. Endonyms are never translated (DISPLAY_LOCALE_META). */
export function endonymList(locales: readonly DisplayLocale[]): string {
  return locales.map((locale) => DISPLAY_LOCALE_META[locale].endonym).join(', ');
}

/**
 * The languages Support's AUTOMATIC answers are qualified in. Mirrors the backend Support DTO
 * (`backend/src/modules/support/dto/support.dto.ts` `@IsIn(['en', 'pl'])`) — asserted by
 * catalogueLocales.spec.ts, which also asserts the `support.conversation.locale.outOfScope` copy
 * names exactly these languages, so widening one without the other fails.
 */
export const SUPPORT_AUTOMATIC_ANSWER_LOCALES: readonly DisplayLocale[] = ['en', 'pl'];
