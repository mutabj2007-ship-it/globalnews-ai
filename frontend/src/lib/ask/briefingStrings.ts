import type { AskLocale } from '@/lib/ask/askStrings';

/**
 * R2 · D1 — EN/PL for the briefing controls and pages. Labels only: a briefing's own content
 * (title, summary, facts) is shown exactly as it was saved.
 */
export interface BriefingStrings {
  readonly save: string;
  readonly saving: string;
  readonly newBriefing: string;
  readonly addTo: string;
  readonly savedAs: (version: number) => string;
  readonly open: string;
  readonly failed: string;
  readonly sectionTitle: string;
  readonly sectionIntro: string;
  readonly empty: string;
  readonly latest: (version: number, asOf: string) => string;
  readonly updateAvailable: string;
  readonly noUpdate: string;
  readonly storyGone: string;
  readonly scopeQuestion: string;
  readonly scopeCountry: string;
  readonly scopeStory: string;
  readonly versions: string;
  readonly version: (n: number) => string;
  readonly asOf: string;
  readonly window: string;
  readonly superseded: (newer: number) => string;
  readonly readOnly: string;
  readonly summary: string;
  readonly keyFacts: string;
  readonly background: string;
  readonly backgroundNote: string;
  readonly coverageGaps: string;
  readonly noGaps: string;
  readonly sources: string;
  readonly delete: string;
  readonly deleteConfirm: string;
  readonly deleted: string;
  readonly back: string;
  readonly notFound: string;
  readonly unavailable: string;
  readonly signedOut: string;
  readonly noSourcedAnswer: string;
  /** Save is withheld: the briefing path cannot yet preserve this answer's specialist evidence (shared check). */
  readonly unavailableForEvidence: string;
}

const EN: BriefingStrings = {
  save: 'Save as briefing',
  saving: 'Saving…',
  newBriefing: 'New briefing',
  addTo: 'Add as the next version of',
  savedAs: (v) => `Saved as briefing · version ${v}`,
  open: 'Open briefing',
  failed: 'Not saved. Nothing was changed.',
  sectionTitle: 'Briefings',
  sectionIntro:
    'Your saved briefings. Each version is kept exactly as it was saved; opening one runs nothing.',
  empty: 'No briefings yet. Use “Save as briefing” on an answer.',
  latest: (v, asOf) => `Version ${v} · as of ${asOf}`,
  updateAvailable: 'New evidence has joined the followed story since the latest version.',
  noUpdate: 'No new evidence on the followed story since the latest version.',
  storyGone: 'The followed story is no longer available.',
  scopeQuestion: 'Question',
  scopeCountry: 'Place',
  scopeStory: 'Followed story',
  versions: 'Versions',
  version: (n) => `Version ${n}`,
  asOf: 'As of',
  window: 'Monitored since the previous version',
  superseded: (n) => `A newer version (${n}) exists. This version is kept as it was saved.`,
  readOnly: 'Saved copy · read-only · opening it runs no AI and searches nothing.',
  summary: 'Answer',
  keyFacts: 'Key facts',
  background: 'Background (not sourced)',
  backgroundNote: 'General background from the model — not evidence, no citations.',
  coverageGaps: 'What the evidence did not cover',
  noGaps: 'No gaps were recorded.',
  sources: 'Sources (links to the original reports)',
  delete: 'Delete briefing',
  deleteConfirm: 'Delete this briefing and all its versions? This cannot be undone.',
  deleted: 'Briefing deleted.',
  back: 'Back to Saved',
  notFound: 'This briefing was not found.',
  unavailable: 'Briefings are not available right now.',
  signedOut: 'Sign in to see your briefings.',
  noSourcedAnswer: 'This version has no sourced answer.',
  unavailableForEvidence: 'Briefing unavailable for this evidence-backed answer',
};

const PL: BriefingStrings = {
  save: 'Zapisz jako briefing',
  saving: 'Zapisywanie…',
  newBriefing: 'Nowy briefing',
  addTo: 'Dodaj jako kolejną wersję briefingu',
  savedAs: (v) => `Zapisano jako briefing · wersja ${v}`,
  open: 'Otwórz briefing',
  failed: 'Nie zapisano. Nic nie zostało zmienione.',
  sectionTitle: 'Briefingi',
  sectionIntro:
    'Twoje zapisane briefingi. Każda wersja jest przechowywana tak, jak została zapisana; otwarcie niczego nie uruchamia.',
  empty: 'Nie masz jeszcze briefingów. Użyj „Zapisz jako briefing” przy odpowiedzi.',
  latest: (v, asOf) => `Wersja ${v} · stan na ${asOf}`,
  updateAvailable: 'Od ostatniej wersji do obserwowanej historii dołączyły nowe dowody.',
  noUpdate: 'Od ostatniej wersji brak nowych dowodów w obserwowanej historii.',
  storyGone: 'Obserwowana historia nie jest już dostępna.',
  scopeQuestion: 'Pytanie',
  scopeCountry: 'Miejsce',
  scopeStory: 'Obserwowana historia',
  versions: 'Wersje',
  version: (n) => `Wersja ${n}`,
  asOf: 'Stan na',
  window: 'Obserwowano od poprzedniej wersji',
  superseded: (n) => `Istnieje nowsza wersja (${n}). Ta wersja pozostaje taka, jak ją zapisano.`,
  readOnly:
    'Zapisana kopia · tylko do odczytu · otwarcie nie uruchamia AI i niczego nie wyszukuje.',
  summary: 'Odpowiedź',
  keyFacts: 'Kluczowe fakty',
  background: 'Tło (bez źródeł)',
  backgroundNote: 'Ogólne tło od modelu — to nie są dowody, brak przypisów.',
  coverageGaps: 'Czego dowody nie objęły',
  noGaps: 'Nie zapisano luk.',
  sources: 'Źródła (linki do oryginalnych doniesień)',
  delete: 'Usuń briefing',
  deleteConfirm: 'Usunąć ten briefing i wszystkie jego wersje? Tej operacji nie można cofnąć.',
  deleted: 'Briefing usunięty.',
  back: 'Wróć do Zapisanych',
  notFound: 'Nie znaleziono tego briefingu.',
  unavailable: 'Briefingi są teraz niedostępne.',
  signedOut: 'Zaloguj się, aby zobaczyć swoje briefingi.',
  noSourcedAnswer: 'Ta wersja nie ma odpowiedzi opartej na źródłach.',
  unavailableForEvidence: 'Briefing niedostępny dla tej odpowiedzi opartej na dowodach',
};

export function briefingStrings(locale: AskLocale | string): BriefingStrings {
  return locale === 'pl' ? PL : EN;
}

/**
 * Briefings exist only when the server says so: the reader's own list answers 200 when
 * ASK_BRIEFINGS_ENABLED is on and 404 when it is off. One probe per page load, shared by every
 * control on the page; a failed probe means "not available" (fail closed, the control hides).
 */
let availability: Promise<boolean> | null = null;
export function briefingsAvailable(
  probe: () => Promise<{ readonly ok: boolean }>,
): Promise<boolean> {
  availability ??= probe()
    .then((r) => r.ok)
    .catch(() => false);
  return availability;
}
/** Test seam: forget the cached probe. */
export function resetBriefingsAvailability(): void {
  availability = null;
}
