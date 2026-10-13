import type { DisplayLocale } from '@globalnews-ai/shared';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';

/**
 * CTO R23 — the story picker's way back into Ask (PO phone defect: no visible way forward from the
 * picker's search field).
 *
 *   askLabel       REUSED, not new: the Ask composer's own region name ("Ask a question"), already
 *                  authored for EN/PL and delivered by Claude L for FR/DE/ES/PT/AR
 *                  (`askShellStrings(locale).askStrings.regions.composer`). No translation is invented.
 *   keptDraft /    NEW, English only. They are shown only when the reader ALREADY has an unsent
 *   useSearchText  question in the composer. Until Claude Design / Claude L deliver them, every
 *                  locale shows the English (the same declared-fallback convention as
 *                  `askShellDeclaredFallbacks`); `r23PickerStringsFellBack` reports which locales do.
 */
export interface R23PickerStrings {
  readonly askLabel: string;
  readonly keptDraft: string;
  readonly useSearchText: string;
}

const EN_NEW = {
  keptDraft: 'Your unsent question stays in the Ask box.',
  useSearchText: 'Use the search words instead',
} as const;

export function r23PickerStrings(locale: DisplayLocale): R23PickerStrings {
  return {
    askLabel: askShellStrings(locale).askStrings.regions.composer,
    keptDraft: EN_NEW.keptDraft,
    useSearchText: EN_NEW.useSearchText,
  };
}

/** True when the two NEW strings render in English for this locale (every locale except EN today). */
export function r23PickerStringsFellBack(locale: DisplayLocale): boolean {
  return locale !== 'en';
}
