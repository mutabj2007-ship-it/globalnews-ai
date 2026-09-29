import type { AskLocale } from '@/lib/ask/askStrings';

/**
 * PUBLIC BETA ASK CONTINUITY R1 — EN/PL for Recent and Saved.
 *
 * A feature-local catalogue, the same shape the other feature surfaces use
 * (`economy/strings.ts`, `politics/politicsStrings.ts`). Nothing here is generated
 * and nothing here describes an answer: these words label the surface, never the
 * reader's content, which is displayed verbatim as they wrote it.
 */
export interface AskContinuityStrings {
  readonly recentTitle: string;
  readonly recentIntro: string;
  readonly savedTitle: string;
  readonly savedIntro: string;
  readonly groups: Readonly<Record<'today' | 'yesterday' | 'earlier', string>>;
  readonly tabs: Readonly<Record<'questions', string>>;
  readonly turnCount: string;
  readonly turnCountOne: string;
  readonly lastActive: string;
  readonly reopen: string;
  readonly reopenNote: string;
  /** STANDALONE PUBLIC BETA CONVERGENCE R1 — a row with no stored operation: nothing to open. */
  readonly noStoredResult: string;
  readonly continueNote: string;
  readonly filterLabel: string;
  readonly filterPlaceholder: string;
  readonly noQuestionStored: string;
  /** ALPHA VISUAL ACCEPTANCE REPAIR R1 (D) — a multi-turn row's origin, beneath the question Open shows. */
  readonly startedWith: string;
  readonly save: string;
  readonly unsave: string;
  readonly saved: string;
  readonly states: Readonly<Record<'signedOut' | 'unavailable' | 'network' | 'refused', string>>;
  readonly empty: Readonly<Record<'recent' | 'questions' | 'filtered', string>>;
}

const EN: AskContinuityStrings = {
  recentTitle: 'Recent',
  recentIntro:
    'Your Ask conversations. Opening one shows what was already produced — nothing runs.',
  savedTitle: 'Saved',
  savedIntro:
    'Questions you saved. Opening one shows what was already produced \u2014 nothing runs.',
  groups: { today: 'Today', yesterday: 'Yesterday', earlier: 'Earlier' },
  tabs: { questions: 'Saved questions' },
  turnCount: '{n} questions',
  turnCountOne: '1 question',
  lastActive: 'Last active',
  reopen: 'Open',
  reopenNote: 'Already produced. Nothing runs.',
  noStoredResult: 'No stored result to open.',
  continueNote: 'To continue, send a new question.',
  filterLabel: 'Filter',
  filterPlaceholder: 'Filter by question',
  noQuestionStored: 'No question is stored for this conversation.',
  startedWith: 'Started with:',
  save: 'Save',
  unsave: 'Remove',
  saved: 'Saved',
  states: {
    signedOut: 'Sign in to see your Ask conversations.',
    unavailable: 'Ask conversations are not available in this Beta.',
    network: 'Your conversations could not be reached. Nothing was lost.',
    refused: 'Your conversations could not be read just now.',
  },
  empty: {
    recent: 'You have no Ask conversations yet.',
    questions: 'You have not saved a question yet.',
    filtered: 'Nothing matches that filter.',
  },
};

const PL: AskContinuityStrings = {
  recentTitle: 'Ostatnie',
  recentIntro:
    'Twoje rozmowy w Ask. Otwarcie pokazuje to, co już powstało — nic nie zostanie uruchomione.',
  savedTitle: 'Zapisane',
  savedIntro:
    'Zapisane pytania. Otwarcie pokazuje to, co ju\u017c powsta\u0142o \u2014 nic nie zostanie uruchomione.',
  groups: { today: 'Dzisiaj', yesterday: 'Wczoraj', earlier: 'Wcześniej' },
  tabs: { questions: 'Zapisane pytania' },
  turnCount: 'Pytania: {n}',
  turnCountOne: '1 pytanie',
  lastActive: 'Ostatnia aktywność',
  reopen: 'Otwórz',
  reopenNote: 'Już powstało. Nic nie zostanie uruchomione.',
  noStoredResult: 'Brak zapisanego wyniku do otwarcia.',
  continueNote: 'Aby kontynuować, wyślij nowe pytanie.',
  filterLabel: 'Filtruj',
  filterPlaceholder: 'Filtruj według pytania',
  noQuestionStored: 'Dla tej rozmowy nie zapisano pytania.',
  startedWith: 'Rozpoczęto od:',
  save: 'Zapisz',
  unsave: 'Usuń',
  saved: 'Zapisano',
  states: {
    signedOut: 'Zaloguj się, aby zobaczyć swoje rozmowy w Ask.',
    unavailable: 'Rozmowy w Ask nie są dostępne w tej becie.',
    network: 'Nie udało się połączyć z Twoimi rozmowami. Nic nie zostało utracone.',
    refused: 'Nie udało się teraz odczytać Twoich rozmów.',
  },
  empty: {
    recent: 'Nie masz jeszcze żadnych rozmów w Ask.',
    questions: 'Nie zapisałeś jeszcze żadnego pytania.',
    filtered: 'Nic nie odpowiada temu filtrowi.',
  },
};

export function askContinuityStrings(locale: AskLocale): AskContinuityStrings {
  return locale === 'pl' ? PL : EN;
}
