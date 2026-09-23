import type { DisplayLocale, LanguageCode } from '@globalnews-ai/shared';
import type { AnswerBlockId, ComputeStepId, SuggestionCategory } from '@/lib/ask/askFrame';

/** Shared frame catalogue recovered from v1.8; EN/PL completed for /ask. */
export type AskLocale = LanguageCode & DisplayLocale;

export interface AskStrings {
  /** The frame's own identity line. Distinct from `askAi.title`, which names the panel. */
  readonly frameLabel: string;
  readonly metaTitle: string;
  readonly metaDescription: string;

  readonly regions: Readonly<
    Record<
      | 'changeStrip'
      | 'mapCanvas'
      | 'contextSummary'
      | 'evidenceFooter'
      | 'suggestions'
      | 'composer'
      | 'answer'
      | 'sources'
      | 'watch'
      | 'alerts'
      | 'workspaceHandoff'
      | 'places'
      | 'computeLadder',
      string
    >
  >;

  /** Specification §7's seven blocks, in order. */
  readonly answerBlocks: Readonly<Record<AnswerBlockId, string>>;

  /** AI-COST-MAP enforcement rule 2 — the four named steps. */
  readonly computeSteps: Readonly<Record<ComputeStepId, string>>;

  /** Specification §6's five categories. The rows themselves are never authored here. */
  readonly suggestionCategories: Readonly<Record<SuggestionCategory, string>>;

  readonly states: Readonly<
    Record<
      | 'suggestionsUnavailable'
      | 'noAnalysisRun'
      | 'noGeographyResolved'
      | 'noEvidenceYet'
      | 'noAlerts'
      | 'costNotConfigured'
      | 'awaitingQuestion',
      string
    >
  >;

  readonly controls: Readonly<
    Record<
      | 'splitMode'
      | 'exploreMode'
      | 'questionMode'
      | 'answerMode'
      | 'fullMapMode'
      | 'visualState'
      | 'detent'
      | 'viewSources'
      | 'saveAnswer'
      | 'continueInWorkspace'
      | 'attachContext'
      | 'miniMap'
      | 'composerDock'
      | 'removeContext'
      | 'peek'
      | 'half'
      | 'full',
      string
    >
  >;

  readonly localeFallback: string;
}

const en: AskStrings = {
  frameLabel: 'Ask AI',
  metaTitle: 'Ask AI — GlobalNews AI',
  metaDescription:
    'The question-specific research surface: map-aware, source-backed, and explicit about what has not been assessed.',

  regions: {
    changeStrip: 'Change in view',
    mapCanvas: 'Map intelligence',
    contextSummary: 'Situation context',
    evidenceFooter: 'Evidence and freshness',
    suggestions: 'Questions worth asking',
    composer: 'Ask a question',
    answer: 'Answer',
    sources: 'Sources',
    watch: 'Watch',
    alerts: 'Recent alerts',
    workspaceHandoff: 'Continue in the workspace',
    places: 'Places in this answer',
    /*
      NAMED AS WORK, NOT AS PROGRESS. The cost map requires the four steps to be
      named rather than hidden behind a spinner; nothing has run here, so the
      heading says what asking WOULD do. "Analysing…" would be a claim.
    */
    computeLadder: 'What asking runs',
  },

  answerBlocks: {
    answer: 'Answer',
    'why-it-matters': 'Why it matters',
    confidence: 'Confidence and limitations',
    'key-evidence': 'Key evidence',
    'geographic-context': 'Geographic context',
    actions: 'Actions',
    'follow-ups': 'Follow-up questions',
  },

  computeSteps: {
    retrieval: 'Retrieving relevant sources',
    'change-record': 'Reading the change record',
    'geographic-check': 'Checking geographic context',
    composition: 'Preparing the structured response',
  },

  suggestionCategories: {
    situation: 'Situation',
    explanation: 'Explanation',
    comparative: 'Comparative',
    'watch-oriented': 'Watch',
    'deeper-analysis': 'Deeper analysis',
  },

  states: {
    /*
      THESE TWO SENTENCES ARE THE FRAME'S HONESTY, AND THEY SAY THE SAME THING
      TWICE ON PURPOSE.

      The first clause states what has not happened. The second forecloses the
      reading a reader would otherwise supply — that an empty list means there
      is nothing worth asking, or that a blank answer region means the question
      was answered with silence. Activation §8 of the Politics round named the
      same failure and the same remedy; it is not a house style, it is what an
      empty region does to a reader who is not told why it is empty.

      Neither sentence names a provider, an endpoint, a schema or a digest.
      Activation §14 puts that vocabulary outside the reader-facing surface.
    */
    suggestionsUnavailable:
      'Questions here are drawn from the change record. None are available yet — this is not a statement that there is nothing worth asking.',
    noAnalysisRun:
      'No research has been run. This is the shape a completed answer takes, not an answer.',
    noGeographyResolved: 'No geography is resolved for this view.',
    noEvidenceYet: 'No evidence is attached yet.',
    noAlerts: 'No alerts are being delivered yet.',
    costNotConfigured: 'Research runs only when you submit a question.',
    awaitingQuestion: 'Ask a question to begin.',
  },

  controls: {
    splitMode: 'Map and Ask proportion',
    exploreMode: 'Explore',
    questionMode: 'Question',
    answerMode: 'Answer',
    fullMapMode: 'Full map',
    visualState: 'Visual state',
    detent: 'Ask sheet height',
    viewSources: 'View sources',
    saveAnswer: 'Save answer',
    continueInWorkspace: 'Continue in workspace',
    attachContext: 'Attach map context',
    miniMap: 'Map',
    composerDock: 'Ask about the visible region',
    removeContext: 'Remove context',
    peek: 'Peek',
    half: 'Half',
    full: 'Full',
  },

  localeFallback:
    'The Ask AI frame’s own labels are not yet authored in this language. Those labels are shown in English; the rest of the surface follows your language.',
};

const pl: AskStrings = {
  frameLabel: 'Zapytaj AI',
  metaTitle: 'Zapytaj AI — GlobalNews AI',
  metaDescription: 'Pytania i odpowiedzi oparte na źródłach, z kontekstem geograficznym.',
  regions: {
    changeStrip: 'Zmiany w widoku',
    mapCanvas: 'Kontekst na mapie',
    contextSummary: 'Kontekst sytuacji',
    evidenceFooter: 'Dowody i aktualność',
    suggestions: 'Pytania warte zadania',
    composer: 'Zadaj pytanie',
    answer: 'Odpowiedź',
    sources: 'Źródła',
    watch: 'Obserwuj',
    alerts: 'Ostatnie alerty',
    workspaceHandoff: 'Kontynuuj w przestrzeni analizy',
    places: 'Miejsca w odpowiedzi',
    computeLadder: 'Etapy analizy',
  },
  answerBlocks: {
    answer: 'Odpowiedź',
    'why-it-matters': 'Dlaczego to ważne',
    confidence: 'Pewność i ograniczenia',
    'key-evidence': 'Kluczowe dowody',
    'geographic-context': 'Kontekst geograficzny',
    actions: 'Działania',
    'follow-ups': 'Kolejne pytania',
  },
  computeSteps: {
    retrieval: 'Wyszukiwanie odpowiednich źródeł',
    'change-record': 'Odczytywanie zapisanych zmian',
    'geographic-check': 'Sprawdzanie kontekstu geograficznego',
    composition: 'Przygotowywanie odpowiedzi',
  },
  suggestionCategories: {
    situation: 'Sytuacja',
    explanation: 'Wyjaśnienie',
    comparative: 'Porównanie',
    'watch-oriented': 'Obserwacja',
    'deeper-analysis': 'Pogłębiona analiza',
  },
  states: {
    suggestionsUnavailable:
      'Propozycje pytań pochodzą z zapisanych zmian. Nie są jeszcze dostępne — nie oznacza to, że nie ma o co pytać.',
    noAnalysisRun: 'Nie przeprowadzono jeszcze analizy.',
    noGeographyResolved: 'Nie ustalono geografii dla tego widoku.',
    noEvidenceYet: 'Nie dołączono jeszcze dowodów.',
    noAlerts: 'Alerty nie są jeszcze dostarczane.',
    costNotConfigured: 'Analiza rozpocznie się dopiero po wysłaniu pytania.',
    awaitingQuestion: 'Zadaj pytanie, aby rozpocząć.',
  },
  controls: {
    splitMode: 'Proporcje mapy i panelu pytań',
    exploreMode: 'Przeglądaj',
    questionMode: 'Pytanie',
    answerMode: 'Odpowiedź',
    fullMapMode: 'Pełna mapa',
    visualState: 'Widok',
    detent: 'Wysokość panelu pytań',
    viewSources: 'Zobacz źródła',
    saveAnswer: 'Zapisz odpowiedź',
    continueInWorkspace: 'Kontynuuj w przestrzeni analizy',
    attachContext: 'Dołącz kontekst mapy',
    miniMap: 'Mapa',
    composerDock: 'Zapytaj o widoczny obszar',
    removeContext: 'Usuń kontekst',
    peek: 'Zwiń',
    half: 'Połowa',
    full: 'Rozwiń',
  },
  localeFallback: en.localeFallback,
};
const ASK_CATALOGUE: Partial<Record<AskLocale, AskStrings>> = { en, pl };

export interface AskStringsResolution {
  readonly strings: AskStrings;
  readonly requested: AskLocale;
  readonly resolved: AskLocale;
  readonly fellBack: boolean;
}

export function resolveAskStrings(locale: AskLocale): AskStringsResolution {
  const found = ASK_CATALOGUE[locale];
  if (found) return { strings: found, requested: locale, resolved: locale, fellBack: false };
  return { strings: en, requested: locale, resolved: 'en', fellBack: true };
}
