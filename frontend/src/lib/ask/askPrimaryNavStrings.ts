import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * ASK R3 NAVIGATION / USABILITY R1 — the strings the restored R3 primary navigation adds.
 *
 * Authority: R3 HANDOFF.md §3 L74 (phone header ☰ · [Ask | My updates | Saved] · +) and §7
 * ("320: nav label 'Updates'"); CTO R3 conformity rulings of 2026-10-10.
 *
 * Reused rather than re-authored (so one control never has two wordings):
 *   "My updates"    followStrings(locale).myUpdates
 *   "Saved"         askShellStrings(locale).askContinuityStrings.savedTitle
 *   "New question"  askShellStrings(locale).askNavStrings.newQuestion
 *   "Last completed check: …"  followStrings(locale).lastSuccessful
 *
 * "Ask" is the product's own name (Ask GlobalNewsAI) and is not translated, like the wordmark.
 *
 * EN is exact. PL, DE, FR, ES, PT and AR below are DRAFTS by the Claude Code implementation
 * lane — DRAFT_PENDING_CLAUDE_L: Claude L to qualify or replace before they count as finished
 * translation.
 */
export interface AskPrimaryNavStrings {
  /** The primary navigation landmark's name. */
  readonly navLabel: string;
  /** The "Ask" section (product name; untranslated). */
  readonly ask: string;
  /** Short "My updates" where the full label does not fit (R3 §7: "Updates" at 320). */
  readonly myUpdatesShort: string;
  /** Welcome My updates row: the real number of followed questions. */
  readonly followedCount: (n: number) => string;
  /** Welcome My updates row: follows whose LAST check reported new / changed / corrected evidence. */
  readonly withChangesAtLastCheck: (n: number) => string;
  /** My updates / change detail back link when the page was opened from My updates. */
  readonly backToMyUpdates: string;
}

const en: AskPrimaryNavStrings = {
  navLabel: 'Main navigation',
  ask: 'Ask',
  myUpdatesShort: 'Updates',
  followedCount: (n) => `${n} followed`,
  withChangesAtLastCheck: (n) => `${n} with changes at last check`,
  backToMyUpdates: 'Back to My updates',
};

/* DRAFT_PENDING_CLAUDE_L */
const pl: AskPrimaryNavStrings = {
  navLabel: 'Nawigacja główna',
  ask: 'Ask',
  myUpdatesShort: 'Zmiany',
  followedCount: (n) => `Obserwowane: ${n}`,
  withChangesAtLastCheck: (n) => `Ze zmianami przy ostatnim sprawdzeniu: ${n}`,
  backToMyUpdates: 'Wróć do Moich aktualizacji',
};

/* DRAFT_PENDING_CLAUDE_L */
const de: AskPrimaryNavStrings = {
  navLabel: 'Hauptnavigation',
  ask: 'Ask',
  myUpdatesShort: 'Aktuelles',
  followedCount: (n) => `${n} gefolgt`,
  withChangesAtLastCheck: (n) => `${n} mit Änderungen bei der letzten Prüfung`,
  backToMyUpdates: 'Zurück zu Meine Updates',
};

/* DRAFT_PENDING_CLAUDE_L */
const fr: AskPrimaryNavStrings = {
  navLabel: 'Navigation principale',
  ask: 'Ask',
  myUpdatesShort: 'Suivis',
  followedCount: (n) => `${n} suivie${n === 1 ? '' : 's'}`,
  withChangesAtLastCheck: (n) => `${n} avec des changements à la dernière vérification`,
  backToMyUpdates: 'Retour à Mes mises à jour',
};

/* DRAFT_PENDING_CLAUDE_L */
const es: AskPrimaryNavStrings = {
  navLabel: 'Navegación principal',
  ask: 'Ask',
  myUpdatesShort: 'Novedades',
  followedCount: (n) => `${n} seguida${n === 1 ? '' : 's'}`,
  withChangesAtLastCheck: (n) => `${n} con cambios en la última comprobación`,
  backToMyUpdates: 'Volver a Mis actualizaciones',
};

/* DRAFT_PENDING_CLAUDE_L */
const pt: AskPrimaryNavStrings = {
  navLabel: 'Navegação principal',
  ask: 'Ask',
  myUpdatesShort: 'Novidades',
  followedCount: (n) => `${n} seguida${n === 1 ? '' : 's'}`,
  withChangesAtLastCheck: (n) => `${n} com alterações na última verificação`,
  backToMyUpdates: 'Voltar a As minhas atualizações',
};

/* DRAFT_PENDING_CLAUDE_L */
const ar: AskPrimaryNavStrings = {
  navLabel: 'التنقل الرئيسي',
  ask: 'Ask',
  myUpdatesShort: 'تحديثات',
  followedCount: (n) => `متابَعة: ${n}`,
  withChangesAtLastCheck: (n) => `بتغييرات عند آخر تحقق: ${n}`,
  backToMyUpdates: 'العودة إلى تحديثاتي',
};

export const ASK_PRIMARY_NAV_STRINGS: Readonly<Record<DisplayLocale, AskPrimaryNavStrings>> = Object.freeze({
  en,
  pl,
  de,
  fr,
  es,
  pt,
  ar,
} as Record<DisplayLocale, AskPrimaryNavStrings>);

/** The locales whose wording here is still a Claude Code draft awaiting Claude L. */
export const ASK_PRIMARY_NAV_DRAFT_LOCALES: readonly DisplayLocale[] = Object.freeze([
  'pl',
  'de',
  'fr',
  'es',
  'pt',
  'ar',
] as DisplayLocale[]);

export function askPrimaryNavStrings(locale: DisplayLocale | string): AskPrimaryNavStrings {
  return (ASK_PRIMARY_NAV_STRINGS as Record<string, AskPrimaryNavStrings | undefined>)[locale] ?? en;
}
