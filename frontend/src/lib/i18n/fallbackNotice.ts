import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * T2 · THE DECLARED-FALLBACK NOTICE — SHOWN IN THE READER'S SELECTED LANGUAGE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * When a surface cannot render the selected locale completely, it renders consistently in
 * English (no mixed-language shell) and says so — in the language the reader selected, because
 * a notice in English would be unreadable to the reader it is addressed to.
 *
 * PROVENANCE, PER LOCALE (also recorded in docs/convergence/stage2/T2-GLOBAL-LANGUAGE-FOUNDATION.md):
 *
 *   fr de es pt ar  `languageFallback.chromeNotice` / `chromeNoticeShort` from the localisation
 *                   lane's approved catalogue L-LANG-CATALOG-1 (recovered verbatim from C55
 *                   `3db5a09` into lib/i18n/recovered/c55-*.ts). Purpose-built for exactly this
 *                   disclosure. Transcribed verbatim; `fallbackNotice.spec.ts` asserts byte
 *                   equality with the recovered source so the two cannot drift.
 *                   Status: RECOVERED_L_APPROVED — pending Claude L re-confirmation (the C55
 *                   `languageFallback` namespace has no counterpart in today's English catalogue).
 *   en pl           Authored by T2 as the minimal notice the rule requires (no qualified EN/PL
 *                   source exists). Status: T2_AUTHORED_PENDING_L_QUALIFICATION. English is never
 *                   shown a fallback notice (English is always renderable); Polish is shown on the
 *                   surfaces whose catalogues are English-only (e.g. Humanitarian, Market, History).
 *
 * The H/L Ask catalogues were searched first: `askShell…localeFallback` describes a PARTIAL
 * state ("these labels display in English; the rest of the surface follows your language"),
 * which is the opposite of the whole-surface fallback this notice declares, so it is not reused.
 */
export interface FallbackNoticeCopy {
  /** One line, rendered visibly. */
  readonly notice: string;
  /** A compact form for narrow chrome. */
  readonly short: string;
}

export type FallbackNoticeProvenance = 'RECOVERED_L_APPROVED' | 'T2_AUTHORED_PENDING_L_QUALIFICATION';

export const FALLBACK_NOTICE: Readonly<Record<DisplayLocale, FallbackNoticeCopy>> = {
  en: {
    notice: 'Shown in English. Your language choice has not changed.',
    short: 'Shown in English',
  },
  pl: {
    notice: 'Wyświetlono po angielsku. Twój wybór języka nie został zmieniony.',
    short: 'Wyświetlono po angielsku',
  },
  fr: {
    notice: "Affiché en anglais. Votre choix de langue n'a pas changé.",
    short: 'Affiché en anglais',
  },
  de: {
    notice: 'Auf Englisch angezeigt. Ihre Sprachwahl wurde nicht geändert.',
    short: 'Auf Englisch angezeigt',
  },
  es: {
    notice: 'Mostrado en inglés. Su elección de idioma no ha cambiado.',
    short: 'Mostrado en inglés',
  },
  pt: {
    notice: 'Exibido em inglês. Sua escolha de idioma não mudou.',
    short: 'Exibido em inglês',
  },
  ar: {
    notice: 'معروض بالإنجليزية. ولم يتغيّر اختيارك للغة.',
    short: 'معروض بالإنجليزية',
  },
};

export const FALLBACK_NOTICE_PROVENANCE: Readonly<Record<DisplayLocale, FallbackNoticeProvenance>> = {
  en: 'T2_AUTHORED_PENDING_L_QUALIFICATION',
  pl: 'T2_AUTHORED_PENDING_L_QUALIFICATION',
  fr: 'RECOVERED_L_APPROVED',
  de: 'RECOVERED_L_APPROVED',
  es: 'RECOVERED_L_APPROVED',
  pt: 'RECOVERED_L_APPROVED',
  ar: 'RECOVERED_L_APPROVED',
};

export function fallbackNoticeFor(requested: DisplayLocale): FallbackNoticeCopy {
  return FALLBACK_NOTICE[requested];
}
