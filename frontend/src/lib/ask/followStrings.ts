import type { AskV2FollowedOutcome } from '@/lib/api/askV2Api';
import { AR, DE, ES, FR, PT } from './followStrings.drafts';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * REASON TO RETURN R1 — COPY FOR FOLLOWED QUESTIONS, MY UPDATES, CONVERSATION DELETE AND NAME
 * ════════════════════════════════════════════════════════════════════════════
 *
 * EN and PL are authored. fr / de / es / pt / ar are Claude Code DRAFTS, written so no reader is
 * shown English chrome (G12), and NOT yet qualified by Claude L: `followStringsQualified(locale)`
 * reports false for them until Claude L's qualified wording replaces these objects. The packet
 * for Claude L is Claude_Output/ASK-REASON-TO-RETURN-R1/CLAUDE-L-PACKET.md.
 *
 * Wording rules (contract §8): no manufactured urgency, no counts that are not source-supported,
 * an incomplete check never reads as "nothing changed", a missing report never reads as safety.
 */
export interface FollowStrings {
  readonly follow: string;
  readonly following: string;
  readonly followFailed: string;
  readonly followNote: string;
  readonly myUpdates: string;
  readonly myUpdatesIntro: string;
  readonly empty: string;
  readonly signedOut: string;
  readonly unavailable: string;
  readonly network: string;
  readonly baseline: (asOf: string, age: string) => string;
  readonly noBaseline: string;
  readonly lastChecked: (when: string) => string;
  readonly lastSuccessful: (when: string) => string;
  readonly neverChecked: string;
  readonly checkForChanges: string;
  readonly checkCost: string;
  readonly checkTooSoon: (minutes: number) => string;
  readonly paused: string;
  readonly pause: string;
  readonly resume: string;
  readonly edit: string;
  readonly save: string;
  readonly cancel: string;
  readonly titleLabel: string;
  readonly questionLabel: string;
  readonly editNote: string;
  readonly remove: string;
  readonly removeConfirm: string;
  readonly removed: string;
  readonly history: string;
  readonly outcome: Readonly<Record<AskV2FollowedOutcome, string>>;
  readonly outcomeDetail: Readonly<Record<AskV2FollowedOutcome, string>>;
  readonly structuredNew: string;
  readonly structuredLate: string;
  readonly structuredLateNote: string;
  readonly structuredContentChanged: string;
  readonly structuredContentChangedNote: string;
  readonly structuredUnassessed: (classes: string) => string;
  readonly structuredNotSeen: (n: number) => string;
  readonly structuredCarried: (n: number) => string;
  readonly partial: (sources: string) => string;
  readonly newEvidence: string;
  readonly supportedChanges: string;
  readonly possibleCorrections: string;
  readonly correctionNote: string;
  readonly earlierFound: string;
  readonly earlierFoundNote: string;
  readonly notSeen: (n: number) => string;
  readonly carriedOver: (n: number) => string;
  readonly expiredNotNote: string;
  readonly checkBanner: (title: string, asOf: string) => string;
  readonly checkBannerHint: string;
  readonly checkRecording: string;
  readonly checkRecorded: string;
  readonly checkNotRecorded: string;
  readonly checkPausedBanner: string;
  readonly openMyUpdates: string;
  readonly ageDays: (n: number) => string;
  readonly ageHours: (n: number) => string;
  readonly ageJustNow: string;
  /* conversations */
  readonly deleteConversation: string;
  readonly deleteConversationConfirm: (title: string) => string;
  readonly deleteConversationNote: string;
  readonly deleteConversationBusy: string;
  readonly deleteConversationFailed: string;
  readonly conversationDeleted: string;
  readonly searchingAll: string;
  /* name */
  readonly nameLabel: string;
  readonly nameHint: string;
  readonly nameSave: string;
  readonly nameSaved: string;
  readonly nameCleared: string;
  readonly nameInvalid: string;
  readonly nameTooLong: string;
  readonly nameFailed: string;
  readonly greeting: (name: string) => string;
}

const EN: FollowStrings = {
  follow: 'Follow this question',
  following: 'Following',
  followFailed: 'Not followed. Nothing was changed.',
  followNote: 'Saved to My updates with this answer as the starting point. Nothing runs until you check.',
  myUpdates: 'My updates',
  myUpdatesIntro:
    'Questions you follow. Each check is one you start yourself; Ask compares it with your last saved answer and shows only what the sources support.',
  empty: 'You are not following any questions yet. Use “Follow this question” on an answer.',
  signedOut: 'Sign in to see the questions you follow.',
  unavailable: 'Followed questions are not available right now.',
  network: 'Could not reach Ask. Your followed questions are unchanged.',
  baseline: (asOf, age) => `Last saved answer: ${asOf} (${age})`,
  noBaseline: 'No saved answer yet',
  lastChecked: (when) => `Last check: ${when}`,
  lastSuccessful: (when) => `Last completed check: ${when}`,
  neverChecked: 'Not checked since you followed it',
  checkForChanges: 'Check for changes',
  checkCost: 'A check runs one new search and answer, and counts toward your daily use.',
  checkTooSoon: (m) => `Checked a moment ago. You can check again in about ${m} min.`,
  paused: 'Paused',
  pause: 'Pause',
  resume: 'Resume',
  edit: 'Edit',
  save: 'Save',
  cancel: 'Cancel',
  titleLabel: 'Name',
  questionLabel: 'Question',
  editNote: 'Changing the question starts a new comparison: the next check becomes the new starting point.',
  remove: 'Stop following',
  removeConfirm: 'Stop following this question? Its saved answers and check history will be deleted.',
  removed: 'No longer following.',
  history: 'Saved answers',
  outcome: {
    INCOMPLETE_CHECK: 'Check incomplete',
    INSUFFICIENT_BASELINE: 'New starting point saved',
    CORRECTION: 'Correction reported by a publisher',
    MATERIAL_CHANGE: 'Change reported',
    NEW_EVIDENCE: 'New reporting',
    UNCHANGED: 'No new reporting',
    NO_RELEVANT_UPDATE: 'No relevant update found',
  },
  outcomeDetail: {
    INCOMPLETE_CHECK:
      'The search could not be completed, so this is not a “nothing changed”. Your last saved answer is kept as it was.',
    INSUFFICIENT_BASELINE:
      'There was no sourced answer to compare with (or the question was edited), so this check is the new starting point.',
    CORRECTION:
      'A newly published report says it corrects or clarifies earlier reporting. Open it to see what it changes.',
    MATERIAL_CHANGE: 'New reporting published since your last saved answer supports the points below.',
    NEW_EVIDENCE: 'New reporting was published since your last saved answer. It is listed below.',
    UNCHANGED:
      'The sources found are the ones your last saved answer already used. New wording alone is not treated as a change.',
    NO_RELEVANT_UPDATE:
      'The search completed but found no relevant new reporting. That does not mean nothing is happening.',
  },
  structuredNew: 'New governed records',
  structuredLate: 'Governed records added now about earlier dates',
  structuredLateNote: 'Admitted after your last saved answer but dated before it. Not counted as a new event.',
  structuredContentChanged: 'Records whose content changed',
  structuredContentChangedNote: 'The source has not stated whether this is a correction, a revision or a data update. Ask does not treat it as a correction.',
  structuredUnassessed: (classes) => `Structured evidence not assessed in this check: ${classes}.`,
  structuredNotSeen: (n) => `${n} earlier governed record${n === 1 ? ' was' : 's were'} not returned this time. That is not a retraction.`,
  structuredCarried: (n) => `${n} governed record${n === 1 ? '' : 's'} unchanged since your last saved answer.`,
  partial: (sources) => `Some sources could not be checked: ${sources}.`,
  newEvidence: 'New reporting',
  supportedChanges: 'What the new reporting supports',
  possibleCorrections: 'Reported corrections',
  correctionNote: 'Flagged from the headline; Ask does not decide what a correction overturns.',
  earlierFound: 'Earlier reporting found now',
  earlierFoundNote: 'Published before your last saved answer. Shown for completeness, not counted as a change.',
  notSeen: (n) => `${n} earlier source${n === 1 ? ' was' : 's were'} not returned by this search. That is not a retraction.`,
  carriedOver: (n) => `${n} source${n === 1 ? '' : 's'} carried over from your last saved answer.`,
  expiredNotNote: 'Expiry of official notices is not assessed.',
  checkBanner: (title, asOf) => `Checking “${title}” for changes since ${asOf}.`,
  checkBannerHint: 'The question is ready below. Nothing runs until you send it.',
  checkRecording: 'Comparing with your last saved answer…',
  checkRecorded: 'Check saved to My updates.',
  checkNotRecorded: 'This answer was not saved as a check. Your followed question is unchanged.',
  checkPausedBanner: 'This followed question is paused. Resume it in My updates to check it.',
  openMyUpdates: 'Open My updates',
  ageDays: (n) => `${n} day${n === 1 ? '' : 's'} ago`,
  ageHours: (n) => `${n} hour${n === 1 ? '' : 's'} ago`,
  ageJustNow: 'just now',
  deleteConversation: 'Delete',
  deleteConversationConfirm: (title) => `Delete “${title}”? This removes the conversation and its answers.`,
  deleteConversationNote: 'Questions you follow are kept; remove them in My updates.',
  deleteConversationBusy: 'Deleting…',
  deleteConversationFailed: 'Not deleted. Try again.',
  conversationDeleted: 'Conversation deleted.',
  searchingAll: 'Searching all your conversations…',
  nameLabel: 'Name Ask uses for you',
  nameHint: 'Optional. Ask never takes a name from your email. Leave empty for no name.',
  nameSave: 'Save name',
  nameSaved: 'Name saved.',
  nameCleared: 'Name removed.',
  nameInvalid: 'Use letters, spaces, apostrophes, hyphens or full stops — not an email address or a link.',
  nameTooLong: 'Use 40 characters or fewer.',
  nameFailed: 'Not saved. Your name is unchanged.',
  greeting: (name) => `Welcome back, ${name}`,
};

const PL: FollowStrings = {
  follow: 'Obserwuj to pytanie',
  following: 'Obserwujesz',
  followFailed: 'Nie dodano do obserwowanych. Nic nie zostało zmienione.',
  followNote:
    'Zapisano w Moich aktualizacjach z tą odpowiedzią jako punktem wyjścia. Nic się nie uruchamia, dopóki nie sprawdzisz.',
  myUpdates: 'Moje aktualizacje',
  myUpdatesIntro:
    'Pytania, które obserwujesz. Każde sprawdzenie uruchamiasz sam; Ask porównuje je z ostatnią zapisaną odpowiedzią i pokazuje tylko to, co potwierdzają źródła.',
  empty: 'Nie obserwujesz jeszcze żadnych pytań. Użyj „Obserwuj to pytanie” przy odpowiedzi.',
  signedOut: 'Zaloguj się, aby zobaczyć obserwowane pytania.',
  unavailable: 'Obserwowane pytania są teraz niedostępne.',
  network: 'Nie udało się połączyć z Ask. Obserwowane pytania pozostały bez zmian.',
  baseline: (asOf, age) => `Ostatnia zapisana odpowiedź: ${asOf} (${age})`,
  noBaseline: 'Brak zapisanej odpowiedzi',
  lastChecked: (when) => `Ostatnie sprawdzenie: ${when}`,
  lastSuccessful: (when) => `Ostatnie ukończone sprawdzenie: ${when}`,
  neverChecked: 'Nie sprawdzano od dodania do obserwowanych',
  checkForChanges: 'Sprawdź zmiany',
  checkCost: 'Sprawdzenie uruchamia jedno nowe wyszukiwanie i odpowiedź oraz wlicza się do dziennego limitu.',
  checkTooSoon: (m) => `Sprawdzono przed chwilą. Ponownie możesz sprawdzić za około ${m} min.`,
  paused: 'Wstrzymane',
  pause: 'Wstrzymaj',
  resume: 'Wznów',
  edit: 'Edytuj',
  save: 'Zapisz',
  cancel: 'Anuluj',
  titleLabel: 'Nazwa',
  questionLabel: 'Pytanie',
  editNote: 'Zmiana pytania rozpoczyna nowe porównanie: następne sprawdzenie stanie się nowym punktem wyjścia.',
  remove: 'Przestań obserwować',
  removeConfirm: 'Przestać obserwować to pytanie? Zapisane odpowiedzi i historia sprawdzeń zostaną usunięte.',
  removed: 'Już nie obserwujesz.',
  history: 'Zapisane odpowiedzi',
  outcome: {
    INCOMPLETE_CHECK: 'Sprawdzenie niepełne',
    INSUFFICIENT_BASELINE: 'Zapisano nowy punkt wyjścia',
    CORRECTION: 'Wydawca zgłosił korektę',
    MATERIAL_CHANGE: 'Zgłoszono zmianę',
    NEW_EVIDENCE: 'Nowe doniesienia',
    UNCHANGED: 'Brak nowych doniesień',
    NO_RELEVANT_UPDATE: 'Nie znaleziono istotnej aktualizacji',
  },
  outcomeDetail: {
    INCOMPLETE_CHECK:
      'Wyszukiwania nie udało się ukończyć, więc nie oznacza to „bez zmian”. Ostatnia zapisana odpowiedź pozostaje bez zmian.',
    INSUFFICIENT_BASELINE:
      'Nie było odpowiedzi opartej na źródłach do porównania (albo pytanie zmieniono), więc to sprawdzenie jest nowym punktem wyjścia.',
    CORRECTION:
      'Nowo opublikowany materiał informuje, że koryguje lub wyjaśnia wcześniejsze doniesienia. Otwórz go, aby zobaczyć, co zmienia.',
    MATERIAL_CHANGE: 'Nowe doniesienia opublikowane od ostatniej zapisanej odpowiedzi potwierdzają poniższe punkty.',
    NEW_EVIDENCE: 'Od ostatniej zapisanej odpowiedzi opublikowano nowe doniesienia. Są wymienione poniżej.',
    UNCHANGED:
      'Znalezione źródła to te same, z których korzystała ostatnia zapisana odpowiedź. Samo nowe sformułowanie nie jest traktowane jako zmiana.',
    NO_RELEVANT_UPDATE:
      'Wyszukiwanie zakończyło się, ale nie znalazło istotnych nowych doniesień. Nie znaczy to, że nic się nie dzieje.',
  },
  structuredNew: 'Nowe rekordy zarządzane',
  structuredLate: 'Rekordy dodane teraz o wcześniejszych datach',
  structuredLateNote: 'Przyjęte po ostatniej zapisanej odpowiedzi, ale datowane wcześniej. Nie liczone jako nowe zdarzenie.',
  structuredContentChanged: 'Rekordy, których treść się zmieniła',
  structuredContentChangedNote: 'Źródło nie podało, czy to korekta, zmiana czy aktualizacja danych. Ask nie traktuje tego jako korekty.',
  structuredUnassessed: (classes) => `Dane strukturalne nieocenione w tym sprawdzeniu: ${classes}.`,
  structuredNotSeen: (n) => `Wcześniejsze rekordy niezwrócone tym razem: ${n}. To nie jest odwołanie.`,
  structuredCarried: (n) => `Rekordy bez zmian od ostatniej zapisanej odpowiedzi: ${n}.`,
  partial: (sources) => `Nie udało się sprawdzić niektórych źródeł: ${sources}.`,
  newEvidence: 'Nowe doniesienia',
  supportedChanges: 'Co potwierdzają nowe doniesienia',
  possibleCorrections: 'Zgłoszone korekty',
  correctionNote: 'Oznaczone na podstawie nagłówka; Ask nie rozstrzyga, co korekta zmienia.',
  earlierFound: 'Wcześniejsze doniesienia znalezione teraz',
  earlierFoundNote: 'Opublikowane przed ostatnią zapisaną odpowiedzią. Pokazane dla pełności, nie liczone jako zmiana.',
  notSeen: (n) =>
    `${n} ${n === 1 ? 'wcześniejsze źródło nie zostało zwrócone' : 'wcześniejszych źródeł nie zostało zwróconych'} przez to wyszukiwanie. To nie jest odwołanie.`,
  carriedOver: (n) => `Źródła przeniesione z ostatniej zapisanej odpowiedzi: ${n}.`,
  expiredNotNote: 'Wygaśnięcie oficjalnych komunikatów nie jest oceniane.',
  checkBanner: (title, asOf) => `Sprawdzanie zmian w „${title}” od ${asOf}.`,
  checkBannerHint: 'Pytanie jest gotowe poniżej. Nic się nie uruchomi, dopóki go nie wyślesz.',
  checkRecording: 'Porównywanie z ostatnią zapisaną odpowiedzią…',
  checkRecorded: 'Sprawdzenie zapisano w Moich aktualizacjach.',
  checkNotRecorded: 'Ta odpowiedź nie została zapisana jako sprawdzenie. Obserwowane pytanie bez zmian.',
  checkPausedBanner: 'To obserwowane pytanie jest wstrzymane. Wznów je w Moich aktualizacjach, aby je sprawdzić.',
  openMyUpdates: 'Otwórz Moje aktualizacje',
  ageDays: (n) => `${n} ${n === 1 ? 'dzień' : 'dni'} temu`,
  ageHours: (n) => `${n} godz. temu`,
  ageJustNow: 'przed chwilą',
  deleteConversation: 'Usuń',
  deleteConversationConfirm: (title) => `Usunąć „${title}”? Rozmowa i jej odpowiedzi zostaną usunięte.`,
  deleteConversationNote: 'Obserwowane pytania pozostają; usuń je w Moich aktualizacjach.',
  deleteConversationBusy: 'Usuwanie…',
  deleteConversationFailed: 'Nie usunięto. Spróbuj ponownie.',
  conversationDeleted: 'Rozmowa usunięta.',
  searchingAll: 'Wyszukiwanie we wszystkich rozmowach…',
  nameLabel: 'Imię, którego Ask używa',
  nameHint: 'Opcjonalne. Ask nigdy nie bierze imienia z adresu e-mail. Zostaw puste, aby nie używać imienia.',
  nameSave: 'Zapisz imię',
  nameSaved: 'Imię zapisane.',
  nameCleared: 'Imię usunięte.',
  nameInvalid: 'Użyj liter, spacji, apostrofów, łączników lub kropek — nie adresu e-mail ani linku.',
  nameTooLong: 'Użyj maksymalnie 40 znaków.',
  nameFailed: 'Nie zapisano. Imię bez zmian.',
  greeting: (name) => `Witaj ponownie, ${name}`,
};

const BY_LOCALE: Readonly<Record<string, FollowStrings>> = { en: EN, pl: PL, fr: FR, de: DE, es: ES, pt: PT, ar: AR };

export function followStrings(locale: string): FollowStrings {
  return BY_LOCALE[locale] ?? EN;
}

/** False for the five locales whose copy Claude L has not yet qualified (they show English). */
export function followStringsQualified(locale: string): boolean {
  return locale === 'en' || locale === 'pl';
}
