/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE G — D25 interface copy, EN/PL, verbatim from
 * ASK-INTELLIGENCE-WORKSPACE-R2 `14_COPY_EN_PL.md` (the frozen design authority). Keys follow
 * that table. Strings the table marks "(gov)" already live in `askStrings.ts` and are read
 * from there, not duplicated. No answer text lives here: answers come from the server.
 */
export type AskR2Locale = 'en' | 'pl';

export interface AskR2Strings {
  readonly askTitle: string;
  readonly ask: string;
  readonly close: string;
  readonly returnMap: string;
  readonly youAsked: string;
  readonly scope: string;
  readonly noScope: string;
  readonly scopePending: string;
  readonly keptAsAsked: string;
  readonly answer: string;
  readonly sources: string;
  readonly openFull: string;
  readonly openFullMeta: string;
  readonly runDeep: string;
  readonly runDeepMeta: string;
  readonly newQ: string;
  readonly earlier: string;
  readonly deepEyebrow: string;
  readonly deepTitle: string;
  readonly deepBody: string;
  readonly estimate: string;
  readonly deepNote: string;
  readonly notNow: string;
  readonly runConfirm: string;
  readonly badges: Readonly<
    Record<'ref' | 'ver' | 'cur' | 'clar' | 'part' | 'insuf' | 'unavail', string>
  >;
  readonly referenceNoteTitle: string;
  readonly referenceNoteBody: string;
  readonly freshness: {
    readonly reference: string;
    /**
     * A reference answer that DID draw on retrieved sources — D25's mixed case (mapref,
     * "Background: reference · current role: checked …"), adapted by the integration: the
     * sources are real, so they are cited and the time they were checked is stated.
     */
    readonly referenceWithSources: string;
    readonly nothingRan: string;
    /** `{when}` · `{n}` placeholders; plural handled by `sourcesLabel`. */
    readonly checked: string;
    readonly retainedTo: string;
    readonly zero: string;
  };
  readonly clarificationFooter: string;
  readonly sourcesAfterChoice: string;
  readonly insufficientTitle: string;
  readonly unavailable: string;
  readonly noCitable: string;
  sourcesLabel(n: number): string;
}

const EN: AskR2Strings = {
  askTitle: 'Ask GlobalNewsAI',
  ask: 'Ask',
  close: 'Close',
  returnMap: 'Return to Map',
  youAsked: 'YOU ASKED',
  scope: 'SCOPE',
  noScope: 'General question · no scope applied',
  scopePending: 'Scope waits for your choice',
  keptAsAsked: 'Kept as asked',
  answer: 'ANSWER',
  sources: 'Sources',
  openFull: 'Open full analysis',
  openFullMeta: '0 AI · 0 provider · no compute',
  runDeep: 'Run deeper analysis',
  runDeepMeta: 'Asks before running · 24 Sand estimate',
  newQ: 'New question',
  earlier: 'EARLIER IN THIS CONVERSATION',
  deepEyebrow: 'EXPLICIT COMPUTE',
  deepTitle: 'Run deeper analysis?',
  deepBody:
    'Deeper analysis reads more sources across a wider window and prepares a structured report. It runs only if you confirm.',
  estimate: 'Estimate · 24 Sand',
  deepNote: 'Design fixture. Sand charging is not enabled in Alpha, so nothing is deducted.',
  notNow: 'Not now',
  runConfirm: 'Run · 24 Sand',
  badges: {
    ref: 'REFERENCE BACKGROUND',
    ver: 'CURRENTLY VERIFIED',
    cur: 'CURRENT INTELLIGENCE',
    clar: 'CLARIFICATION REQUIRED',
    part: 'PARTIAL EVIDENCE',
    insuf: 'INSUFFICIENT EVIDENCE',
    unavail: 'CAPABILITY UNAVAILABLE',
  },
  referenceNoteTitle: 'Model background · no citations',
  referenceNoteBody:
    'No external reference source is attached to this answer. Treat it as orientation, not as verified current fact.',
  freshness: {
    reference: 'Stable general knowledge · not checked against current sources',
    referenceWithSources: 'Background: reference · checked {when} · {sources}',
    nothingRan: 'One question before searching · nothing has run',
    checked: 'Checked {when} · {sources}',
    retainedTo: 'Retained reporting to {when} · {sources}',
    zero: 'Checked {when} · 0 matching reports',
  },
  clarificationFooter: 'No sources searched · no compute used',
  sourcesAfterChoice: 'Sources appear after you choose',
  insufficientTitle: 'Not enough matching reporting',
  unavailable: 'Ask is unavailable right now. Nothing was run.',
  noCitable: 'No citable sources',
  sourcesLabel: (n) => `${n} ${n === 1 ? 'source' : 'sources'}`,
};

/* Polish plural: 1 źródło · 2–4 źródła (except 12–14) · otherwise źródeł. */
function plSources(n: number): string {
  if (n === 1) return '1 źródło';
  const t = n % 10;
  const h = n % 100;
  return `${n} ${t >= 2 && t <= 4 && !(h >= 12 && h <= 14) ? 'źródła' : 'źródeł'}`;
}

const PL: AskR2Strings = {
  askTitle: 'Zapytaj GlobalNewsAI',
  ask: 'Zapytaj',
  close: 'Zamknij',
  returnMap: 'Wróć do mapy',
  youAsked: 'TWOJE PYTANIE',
  scope: 'ZAKRES',
  noScope: 'Pytanie ogólne · bez zakresu',
  scopePending: 'Zakres zależy od Twojego wyboru',
  keptAsAsked: 'Zachowano zgodnie z pytaniem',
  answer: 'ODPOWIEDŹ',
  sources: 'Źródła',
  openFull: 'Otwórz pełną analizę',
  openFullMeta: '0 AI · 0 dostawców · bez obliczeń',
  runDeep: 'Uruchom pogłębioną analizę',
  runDeepMeta: 'Pyta przed uruchomieniem · szac. 24 Sand',
  newQ: 'Nowe pytanie',
  earlier: 'WCZEŚNIEJ W TEJ ROZMOWIE',
  deepEyebrow: 'JAWNE OBLICZENIA',
  deepTitle: 'Uruchomić pogłębioną analizę?',
  deepBody:
    'Pogłębiona analiza czyta więcej źródeł w szerszym okresie i przygotowuje uporządkowany raport. Uruchamia się tylko po Twoim potwierdzeniu.',
  estimate: 'Szacunek · 24 Sand',
  deepNote:
    'Wartość projektowa. Naliczanie Sand jest wyłączone w wersji Alpha, nic nie zostanie pobrane.',
  notNow: 'Nie teraz',
  runConfirm: 'Uruchom · 24 Sand',
  badges: {
    ref: 'WIEDZA OGÓLNA',
    ver: 'ZWERYFIKOWANE AKTUALNIE',
    cur: 'BIEŻĄCE INFORMACJE',
    clar: 'WYMAGA DOPRECYZOWANIA',
    part: 'CZĘŚCIOWE DOWODY',
    insuf: 'ZBYT MAŁO DOWODÓW',
    unavail: 'FUNKCJA NIEDOSTĘPNA',
  },
  referenceNoteTitle: 'Wiedza modelu · bez przypisów',
  referenceNoteBody:
    'Do tej odpowiedzi nie dołączono zewnętrznego źródła referencyjnego. Traktuj ją jako orientację, a nie zweryfikowany bieżący fakt.',
  freshness: {
    reference: 'Stała wiedza ogólna · niesprawdzana w bieżących źródłach',
    referenceWithSources: 'Tło: wiedza ogólna · sprawdzono {when} · {sources}',
    nothingRan: 'Jedno pytanie przed wyszukiwaniem · nic nie uruchomiono',
    checked: 'Sprawdzono {when} · {sources}',
    retainedTo: 'Doniesienia do {when} · {sources}',
    zero: 'Sprawdzono {when} · 0 pasujących doniesień',
  },
  clarificationFooter: 'Nie przeszukano źródeł · nie użyto obliczeń',
  sourcesAfterChoice: 'Źródła pojawią się po Twoim wyborze',
  insufficientTitle: 'Za mało pasujących doniesień',
  unavailable: 'Zapytaj AI jest teraz niedostępne. Nic nie zostało uruchomione.',
  noCitable: 'Brak źródeł do przytoczenia',
  sourcesLabel: plSources,
};

export function askR2Strings(locale: AskR2Locale): AskR2Strings {
  return locale === 'pl' ? PL : EN;
}
