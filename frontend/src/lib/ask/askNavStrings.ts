/**
 * STANDALONE ASK NAVIGATION — interface copy, EN and PL.
 *
 * WHY THIS FILE EXISTS RATHER THAN A KEY IN askR2Strings.ts. That file is the
 * frozen D25 copy table, transcribed verbatim from `14_COPY_EN_PL.md`, and its
 * own header says keys follow that table. The standalone shell's navigation copy
 * is not in that table — standalone Ask did not exist when D25 was drawn — so
 * adding keys there would quietly break the "verbatim from the authority"
 * property another spec relies on. The shell's copy lives here instead, and the
 * one string it shares with D25 (the product name) is READ FROM askR2Strings
 * rather than copied, so the wordmark can never drift from the frozen title.
 *
 * NOTHING HERE IS NEWLY TRANSLATED WHERE THE PRODUCT ALREADY HAD THE WORDS.
 * Every Polish string below is the wording already shipping elsewhere in
 * GlobalNews AI, reused deliberately so the standalone shell does not introduce
 * a second Polish vocabulary for the same controls:
 *
 *   Nowe pytanie      askR2Strings.pl.newQ (the frozen D25 table)
 *   Ostatnie          myIntelligencePl.recent
 *   Zapisane          myIntelligencePl.saved
 *   Ustawienia        pl.navBar.settings
 *   Zaloguj się       pl.navBar.signIn
 *   Wyloguj się       pl.navBar.signOut
 *   Język             pl.navBar.languageSelectorLabel
 *   Wybierz język     pl.navBar.languageSelectorAction
 *   Otwórz/Zamknij menu   pl.navBar.openMenuAriaLabel / closeMenuAriaLabel
 *   Konto · Menu konta     pl.navBar.account / pl.navBar.accountMenuAriaLabel
 *
 * The single exception is `help`. The product carries `Pomoc` (Help) and
 * `Opinie i wsparcie` (Feedback & support) but no existing string for the
 * correction's exact label "Help & feedback", so `Pomoc i opinie` is formed from
 * those two established terms rather than from a new choice of words.
 */
import { askR2Strings, type AskR2Locale } from './askR2Strings';

export interface AskNavStrings {
  /** Item labels — keyed to AskMenuEntry.labelKey. */
  readonly newQuestion: string;
  readonly recent: string;
  readonly saved: string;
  readonly help: string;
  readonly settings: string;
  readonly language: string;
  readonly signIn: string;
  readonly signOut: string;
  /** Shell chrome. */
  readonly navAriaLabel: string;
  readonly openMenuAriaLabel: string;
  readonly closeMenuAriaLabel: string;
  readonly account: string;
  readonly accountMenuAriaLabel: string;
  readonly languageSelectorAction: string;
}

const en: AskNavStrings = {
  newQuestion: 'New question',
  recent: 'Recent',
  saved: 'Saved',
  help: 'Help & feedback',
  settings: 'Settings',
  language: 'Language',
  signIn: 'Sign in',
  signOut: 'Sign out',
  navAriaLabel: 'Ask navigation',
  openMenuAriaLabel: 'Open menu',
  closeMenuAriaLabel: 'Close menu',
  account: 'Account',
  accountMenuAriaLabel: 'Account menu',
  languageSelectorAction: 'Select language',
};

const pl: AskNavStrings = {
  newQuestion: 'Nowe pytanie',
  recent: 'Ostatnie',
  saved: 'Zapisane',
  help: 'Pomoc i opinie',
  settings: 'Ustawienia',
  language: 'Język',
  signIn: 'Zaloguj się',
  signOut: 'Wyloguj się',
  navAriaLabel: 'Nawigacja Zapytaj',
  openMenuAriaLabel: 'Otwórz menu',
  closeMenuAriaLabel: 'Zamknij menu',
  account: 'Konto',
  accountMenuAriaLabel: 'Menu konta',
  languageSelectorAction: 'Wybierz język',
};

export type AskNavLocale = AskR2Locale;

export const ASK_NAV_STRINGS: Readonly<Record<AskNavLocale, AskNavStrings>> = { en, pl };

export function askNavStringsFor(locale: AskNavLocale): AskNavStrings {
  return ASK_NAV_STRINGS[locale];
}

/**
 * The wordmark. Read from the frozen D25 table, never duplicated: "Ask
 * GlobalNewsAI" / "Zapytaj GlobalNewsAI" is the product's own title and the
 * phone header already prints exactly this string.
 */
export function askProductName(locale: AskNavLocale): string {
  return askR2Strings(locale).askTitle;
}
