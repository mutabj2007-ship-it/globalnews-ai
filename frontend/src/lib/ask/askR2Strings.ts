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
    Record<'ref' | 'ver' | 'cur' | 'clar' | 'part' | 'insuf' | 'unavail' | 'rec', string>
  >;
  readonly referenceNoteTitle: string;
  readonly referenceNoteBody: string;
  readonly freshness: {
    readonly reference: string;
    /** LIVE ACCEPTANCE REPAIR R1 — a retained-record answer: not current, no AI. */
    readonly retainedRecord: string;
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
    /**
     * CURRENT STATUS CORROBORATION R1 — a PARTIAL current-status answer: `{when}` is the
     * freshest corroborating report's publication time. It says "as of", never "verified now".
     */
    readonly corroboratedAsOf: (reports: number) => string;
  };
  readonly clarificationFooter: string;
  readonly sourcesAfterChoice: string;
  readonly insufficientTitle: string;
  readonly unavailable: string;
  /** LIVE ACCEPTANCE REPAIR R1 — a compute-budget refusal is named as such, never "unavailable". */
  readonly budgetRefused: string;
  /** LIVE ACCEPTANCE REPAIR R1 — the lead line of a retained-record answer. */
  readonly retainedAnswer: string;
  /** GOVERNED ANSWER CONVERSATIONAL UX R1 — the label over suggested follow-up drafts. */
  readonly followUpHint: string;
  /**
   * GOVERNED RETAINED GAP REPAIR R1 — a retained-record card never renders blank: the line shown
   * when a record answer has no lead and no note, per basis.
   */
  readonly retainedFallback: {
    readonly GOVERNED_NO_RECORD: string;
    readonly GOVERNED_RECORD: string;
  };
  /**
   * GOVERNED RETAINED GAP REPAIR R1 — CAPABILITY_UNAVAILABLE / GOVERNED_RECORD_UNAVAILABLE copy,
   * chosen by the contribution's DISCLOSURE so an unreadable held artifact is never confused
   * with a missing capture, and neither with a true absence.
   */
  readonly governedGap: {
    readonly notDisplayable: Readonly<Record<string, string>>;
    readonly noCapture: Readonly<Record<string, string>>;
    readonly unreadable: string;
  };
  readonly noCitable: string;
  /**
   * GATE H — INTEGRATION-AUTHORED, flagged for Product copy review. A typed refusal says
   * WHAT is missing, keyed by the server's answer basis; `unavailable` stays the copy for
   * "Ask itself is not available".
   */
  readonly unavailableBecause: Readonly<Record<string, string>>;
  /** GATE H — the freshness line of a typed refusal: nothing was presented as fact. */
  readonly noAnswer: string;
  /** GATE H — a clarification the executor asked (e.g. an ambiguous country), with choices. */
  readonly whichOne: string;
  readonly clarificationFooterNoAi: string;
  readonly askedBeforeAnswering: string;
  /** GATE H (MD-005) — an opened stored result past its validity. */
  readonly expiredNote: string;
  /** ALPHA ENABLEMENT R1 (MC-070) — a continuation (“And Kenya?”) with nothing to continue; the place stays a chip. */
  readonly noPriorSubject: string;
  /**
   * ALPHA VISUAL ACCEPTANCE REPAIR R1 — a clarification is NEVER shown without a question.
   * `broadening` names the parts of the question Ask cannot apply as a search limit yet
   * (the plan's not-applied chips); `codes` asks the question each plan clarification code
   * stands for; `fallback` is the question when nothing more specific is known.
   */
  readonly clarify: {
    readonly broadening: (notApplied: readonly string[], withSuggestion: boolean) => string;
    readonly suggestion: string;
    readonly useSuggestion: string;
    readonly chooseHint: string;
    readonly codes: Readonly<Record<string, string>>;
    readonly fallback: string;
  };
  /**
   * SIGNED-OUT FALLBACK REMOVAL R1 — Ask V2 answered 401: the reader must sign in. The
   * question was not sent and nothing ran; it waits in the composer.
   */
  readonly signInRequired: {
    readonly title: string;
    readonly body: string;
    readonly action: string;
  };
  /**
   * ALPHA ENABLEMENT R1 (MC-055) — the reader's own library, by the scope the server read:
   * `signIn` without identity, `notAvailable` when its executor is not wired. NEUTRAL when
   * the payload names no scope.
   */
  readonly personal: Readonly<
    Record<'SAVED_STORIES' | 'INTERESTS' | 'NEUTRAL', { signIn: string; notAvailable: string }>
  >;
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
    rec: 'RETAINED RECORD',
  },
  referenceNoteTitle: 'Model background · no citations',
  referenceNoteBody:
    'No external reference source is attached to this answer. Treat it as orientation, not as verified current fact.',
  freshness: {
    reference: 'Stable general knowledge · not checked against current sources',
    retainedRecord: 'Retained record · not current · no AI used',
    referenceWithSources: 'Background: reference · checked {when} · {sources}',
    nothingRan: 'One question before searching · nothing has run',
    checked: 'Checked {when} · {sources}',
    retainedTo: 'Retained reporting to {when} · {sources}',
    zero: 'Checked {when} · 0 matching reports',
    corroboratedAsOf: (n) => `As of {when} · ${n} independent reports agree`,
  },
  clarificationFooter: 'No sources searched · no compute used',
  sourcesAfterChoice: 'Sources appear after you choose',
  insufficientTitle: 'Not enough matching reporting',
  unavailable: 'Ask is unavailable right now. Nothing was run.',
  budgetRefused:
    'You have reached today’s Ask limit, so nothing was run and nothing was charged. Questions answered from retained records still work.',
  retainedAnswer: 'Answered from a retained governed record — no AI was used.',
  followUpHint: 'You could ask next',
  retainedFallback: {
    GOVERNED_NO_RECORD: 'No individual retained record exists for this question’s scope.',
    GOVERNED_RECORD: 'The retained record is shown below with its source.',
  },
  governedGap: {
    notDisplayable: {
      ECONOMY_CPI:
        'A retained NISR CPI release is held, but it cannot currently be read under its governed extraction rules, so no value is shown. Nothing was run in its place.',
      IMIHIGO:
        'The retained NISR Imihigo evaluation is held, but it cannot currently be read under its governed admission rules, so no result is shown. Nothing was run in its place.',
      default:
        'A retained governed record is held, but it cannot currently be read under its governed rules, so no value is shown. Nothing was run in its place.',
    },
    noCapture: {
      ECONOMY_CPI:
        'No retained NISR CPI release is held, so no value is shown. Nothing was run in its place.',
      MARKET_PROCUREMENT:
        'No retained TED procurement snapshot is held, so no notices are shown. Nothing was run in its place.',
      default:
        'No retained governed record is held for this question, so nothing is shown. Nothing was run in its place.',
    },
    unreadable:
      'The retained record for this question could not be read just now. Nothing is claimed either way, and nothing was run in its place.',
  },
  noCitable: 'No citable sources',
  unavailableBecause: {
    REFERENCE_UNAVAILABLE:
      'Reference knowledge is not connected for this question, so it is not answered as fact. No news reporting was used in its place.',
    EXECUTOR_NOT_WIRED:
      'This question needs a source Ask cannot read yet — such as your saved stories, an official release or a specialist assessment. Nothing was answered from news in its place.',
    PLAN_IDENTITY_REQUIRED: 'Sign in to use your saved information.',
    PLAN_CAPABILITY_UNAVAILABLE:
      'This kind of question needs a capability Ask does not have — such as calculations, files, code, official releases or specialist assessments. Nothing was run.',
    OFFICIAL_SOURCE_UNAVAILABLE:
      'You asked for the official figure. Ask has no approved reader for this official source, so it cannot give the official value, and news reporting is not presented as official. Nothing was run.',
    GOVERNED_RECORD_UNAVAILABLE:
      'The retained record for this question cannot be shown right now. Nothing was run in its place.',
  },
  noAnswer: 'No answer given · nothing presented as fact',
  whichOne: 'Which one do you mean?',
  clarificationFooterNoAi: 'No AI used · nothing was answered',
  askedBeforeAnswering: 'One question before answering · no AI used',
  expiredNote: 'This saved answer has expired · shown as it was, not re-checked',
  noPriorSubject:
    "There's no earlier question to continue. What would you like to know about this place?",
  clarify: {
    broadening: (notApplied, withSuggestion) =>
      `Ask can't limit a reporting search to ${quoteList(notApplied, 'and')} yet, so nothing was searched. It can search the most recent reporting without that limit — ${
        withSuggestion
          ? 'use the suggested question below, or rephrase.'
          : 'rephrase without it and ask again.'
      }`,
    suggestion: 'Suggested question',
    useSuggestion: 'Use this question',
    chooseHint: 'Choosing one adds it to your question below — nothing runs until you press Ask.',
    codes: {
      LANGUAGE_UNCLASSIFIED:
        'Which language is your question in? Please ask it in English or Polish.',
      LANGUAGE_UNSUPPORTED:
        'Ask answers in English and Polish. Could you ask your question in one of them?',
      SOURCE_FRAME_UNPARSED:
        'Which source should the answer come from? Name the outlet or institution — for example “What does Reuters report about …?”',
      SELECTION_EXCEEDS_MAX: 'Too many stories are selected. Select fewer stories and ask again.',
      SELECTION_BELOW_MINIMUM:
        'Not enough stories are selected. Select more stories and ask again.',
    },
    fallback:
      'What exactly should this cover? Add one specific place, topic or period and ask again.',
  },
  signInRequired: {
    title: 'SIGN-IN REQUIRED',
    body: 'Sign in to ask GlobalNewsAI. Your question is kept below and was not sent — nothing was run.',
    action: 'Sign in to ask',
  },
  personal: {
    SAVED_STORIES: {
      signIn: 'Sign in to compare your saved stories.',
      notAvailable: "Comparing your saved stories isn't available yet.",
    },
    INTERESTS: {
      signIn: 'Sign in to use your interests.',
      notAvailable: "Using your interests isn't available yet.",
    },
    NEUTRAL: {
      signIn: 'Sign in to use your saved information.',
      notAvailable: "Your saved information isn't available here yet.",
    },
  },
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
    rec: 'ZACHOWANY ZAPIS',
  },
  referenceNoteTitle: 'Wiedza modelu · bez przypisów',
  referenceNoteBody:
    'Do tej odpowiedzi nie dołączono zewnętrznego źródła referencyjnego. Traktuj ją jako orientację, a nie zweryfikowany bieżący fakt.',
  freshness: {
    reference: 'Stała wiedza ogólna · niesprawdzana w bieżących źródłach',
    retainedRecord: 'Zachowany zapis · nieaktualny · bez użycia AI',
    referenceWithSources: 'Tło: wiedza ogólna · sprawdzono {when} · {sources}',
    nothingRan: 'Jedno pytanie przed wyszukiwaniem · nic nie uruchomiono',
    checked: 'Sprawdzono {when} · {sources}',
    retainedTo: 'Doniesienia do {when} · {sources}',
    zero: 'Sprawdzono {when} · 0 pasujących doniesień',
    corroboratedAsOf: (n) =>
      n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
        ? `Stan na {when} · ${n} niezależne doniesienia są zgodne`
        : `Stan na {when} · ${n} niezależnych doniesień jest zgodnych`,
  },
  clarificationFooter: 'Nie przeszukano źródeł · nie użyto obliczeń',
  sourcesAfterChoice: 'Źródła pojawią się po Twoim wyborze',
  insufficientTitle: 'Za mało pasujących doniesień',
  unavailable: 'Zapytaj AI jest teraz niedostępne. Nic nie zostało uruchomione.',
  budgetRefused:
    'Wykorzystano dzisiejszy limit Zapytaj AI, więc nic nie uruchomiono ani nie naliczono. Pytania, na które odpowiadają zachowane zapisy, nadal działają.',
  retainedAnswer: 'Odpowiedź z zachowanego, zweryfikowanego zapisu — bez użycia AI.',
  followUpHint: 'Możesz zapytać dalej',
  retainedFallback: {
    GOVERNED_NO_RECORD: 'Dla zakresu tego pytania nie istnieje osobny zachowany zapis.',
    GOVERNED_RECORD: 'Zachowany zapis wraz ze źródłem pokazano poniżej.',
  },
  governedGap: {
    notDisplayable: {
      ECONOMY_CPI:
        'Przechowywana jest zachowana publikacja CPI NISR, ale obecnie nie można jej odczytać zgodnie z zasadami zweryfikowanej ekstrakcji, więc nie pokazano wartości. Nic nie uruchomiono w zamian.',
      IMIHIGO:
        'Przechowywana jest zachowana ocena Imihigo NISR, ale obecnie nie można jej odczytać zgodnie z zasadami dopuszczenia, więc nie pokazano wyniku. Nic nie uruchomiono w zamian.',
      default:
        'Przechowywany jest zachowany zweryfikowany zapis, ale obecnie nie można go odczytać zgodnie z jego zasadami, więc nie pokazano wartości. Nic nie uruchomiono w zamian.',
    },
    noCapture: {
      ECONOMY_CPI:
        'Nie przechowujemy zachowanej publikacji CPI NISR, więc nie pokazano wartości. Nic nie uruchomiono w zamian.',
      MARKET_PROCUREMENT:
        'Nie przechowujemy zachowanej migawki zamówień TED, więc nie pokazano ogłoszeń. Nic nie uruchomiono w zamian.',
      default:
        'Dla tego pytania nie przechowujemy zachowanego zweryfikowanego zapisu, więc nic nie pokazano. Nic nie uruchomiono w zamian.',
    },
    unreadable:
      'Nie udało się teraz odczytać zachowanego zapisu dla tego pytania. Niczego nie stwierdzono i nic nie uruchomiono w zamian.',
  },
  noCitable: 'Brak źródeł do przytoczenia',
  unavailableBecause: {
    REFERENCE_UNAVAILABLE:
      'Wiedza referencyjna nie jest podłączona dla tego pytania, więc nie odpowiadamy na nie jako na fakt. Nie użyto zamiast niej doniesień prasowych.',
    EXECUTOR_NOT_WIRED:
      'To pytanie wymaga źródła, którego Zapytaj AI jeszcze nie czyta — np. Twoich zapisanych materiałów, oficjalnej publikacji lub oceny specjalisty. Nie odpowiedziano zamiast tego na podstawie wiadomości.',
    PLAN_IDENTITY_REQUIRED: 'Zaloguj się, aby korzystać z zapisanych informacji.',
    PLAN_CAPABILITY_UNAVAILABLE:
      'Ten rodzaj pytania wymaga funkcji, której Zapytaj AI nie ma — np. obliczeń, plików, kodu, oficjalnych publikacji lub ocen specjalistów. Nic nie uruchomiono.',
    OFFICIAL_SOURCE_UNAVAILABLE:
      'Pytasz o oficjalną wartość. Zapytaj AI nie ma zatwierdzonego czytnika tego oficjalnego źródła, więc nie poda oficjalnej wartości, a doniesienia medialne nie są przedstawiane jako oficjalne. Nic nie uruchomiono.',
    GOVERNED_RECORD_UNAVAILABLE:
      'Zachowanego zapisu dla tego pytania nie można teraz pokazać. Nic nie uruchomiono w zamian.',
  },
  noAnswer: 'Brak odpowiedzi · nic nie przedstawiono jako faktu',
  whichOne: 'Które z nich masz na myśli?',
  clarificationFooterNoAi: 'Nie użyto AI · nie udzielono odpowiedzi',
  askedBeforeAnswering: 'Jedno pytanie przed odpowiedzią · nie użyto AI',
  expiredNote: 'Ta zapisana odpowiedź wygasła · pokazana bez ponownego sprawdzenia',
  noPriorSubject:
    'Nie ma wcześniejszego pytania do kontynuowania. Co chcesz wiedzieć o tym miejscu?',
  clarify: {
    broadening: (notApplied, withSuggestion) =>
      `Zapytaj GlobalNewsAI nie potrafi jeszcze zawęzić wyszukiwania doniesień do ${quoteList(notApplied, 'i', '„')}, więc niczego nie wyszukano. Może przeszukać najnowsze doniesienia bez tego ograniczenia — ${
        withSuggestion
          ? 'użyj proponowanego pytania poniżej albo przeformułuj pytanie.'
          : 'przeformułuj pytanie bez niego i zapytaj ponownie.'
      }`,
    suggestion: 'Proponowane pytanie',
    useSuggestion: 'Użyj tego pytania',
    chooseHint:
      'Wybór doda go do Twojego pytania poniżej — nic nie zostanie uruchomione, dopóki nie naciśniesz Zapytaj.',
    codes: {
      LANGUAGE_UNCLASSIFIED:
        'W jakim języku jest Twoje pytanie? Zadaj je po polsku lub po angielsku.',
      LANGUAGE_UNSUPPORTED:
        'Zapytaj odpowiada po polsku i po angielsku. Czy możesz zadać pytanie w jednym z tych języków?',
      SOURCE_FRAME_UNPARSED:
        'Z jakiego źródła ma pochodzić odpowiedź? Podaj nazwę redakcji lub instytucji — np. „Co Reuters podaje o …?”',
      SELECTION_EXCEEDS_MAX:
        'Zaznaczono zbyt wiele artykułów. Zaznacz mniej artykułów i zapytaj ponownie.',
      SELECTION_BELOW_MINIMUM:
        'Zaznaczono za mało artykułów. Zaznacz więcej artykułów i zapytaj ponownie.',
    },
    fallback:
      'Czego dokładnie ma to dotyczyć? Dodaj jedno konkretne miejsce, temat lub okres i zapytaj ponownie.',
  },
  signInRequired: {
    title: 'WYMAGANE LOGOWANIE',
    body: 'Zaloguj się, aby zapytać GlobalNewsAI. Twoje pytanie czeka poniżej i nie zostało wysłane — nic nie uruchomiono.',
    action: 'Zaloguj się, aby zapytać',
  },
  personal: {
    SAVED_STORIES: {
      signIn: 'Zaloguj się, aby porównać zapisane artykuły.',
      notAvailable: 'Porównywanie zapisanych artykułów nie jest jeszcze dostępne.',
    },
    INTERESTS: {
      signIn: 'Zaloguj się, aby korzystać ze swoich zainteresowań.',
      notAvailable: 'Korzystanie z zainteresowań nie jest jeszcze dostępne.',
    },
    NEUTRAL: {
      signIn: 'Zaloguj się, aby korzystać z zapisanych informacji.',
      notAvailable: 'Twoje zapisane informacje nie są jeszcze tutaj dostępne.',
    },
  },
  sourcesLabel: plSources,
};

/** “a”, “a” and “b”, “a”, “b” and “c” — the reader's own words, quoted (PL opens with „). */
function quoteList(items: readonly string[], and: string, open = '“'): string {
  const quoted = items.map((item) => `${open}${item}”`);
  if (quoted.length <= 1) return quoted[0] ?? '';
  return `${quoted.slice(0, -1).join(', ')} ${and} ${quoted[quoted.length - 1]}`;
}

export function askR2Strings(locale: AskR2Locale): AskR2Strings {
  return locale === 'pl' ? PL : EN;
}
