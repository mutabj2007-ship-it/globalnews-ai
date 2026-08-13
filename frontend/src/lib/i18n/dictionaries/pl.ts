import type { Dictionary } from './index';

/**
 * Milestone #47 — Polish dictionary, the first production non-English
 * vertical slice. Covers the M47 minimum set: language selector,
 * no-question/loading-adjacent states, no-evidence message, and the
 * source-language disclosure label. Does NOT translate provider source
 * names, URLs, or article titles — those remain in their original
 * form/language, per the M47 authorization's explicit instruction.
 */
export const pl: Dictionary = {
  languageSelectorLabel: 'Język',
  yourQuestion: 'Twoje pytanie',
  noQuestionProvided: 'Nie podano pytania',
  noQuestionMessage: 'Nie podano pytania. Spróbuj wyszukać ze strony głównej.',
  genericFetchError: 'Coś poszło nie tak podczas analizy tego pytania. Spróbuj ponownie.',
  noEvidenceMessage: 'Nie znaleziono powiązanych artykułów dla tego pytania.',
  aiUnavailableMessage: 'Analiza AI jest tymczasowo niedostępna, ale powiązane artykuły są pokazane poniżej.',
  originalSourcesHeading: 'Oryginalne źródła',
  evidenceLanguageLabel: 'Język źródła',
  loadingStages: [
    'Przeszukiwanie zaufanych źródeł\u2026',
    'Grupowanie powiązanych doniesień\u2026',
    'Porównywanie relacji\u2026',
    'Przygotowywanie analizy ze źródłami\u2026',
  ],
  analysisResultView: {
    generatedPrefix: 'Wygenerowano',
    relationshipEvidence: 'Dowody dotyczące zależności',
    supporting: 'Potwierdzające',
    reverse: 'Odwrotne',
    associationOnly: 'Tylko powiązanie',
    mixed: 'Niejednoznaczne',
    aiSelfAssessment: 'Samoocena AI (nie jest to ocena zaufania do dowodów)',
    aiSelfAssessmentPrefix: 'Samoocena AI',
    aiSelfAssessmentDisclaimer:
      'To jest własna ocena pewności modelu AI i nie stanowi autorytatywnej oceny zaufania do dowodów przedstawionej powyżej.',
    keyFacts: 'Kluczowe fakty',
    whereSourcesAgree: 'W czym źródła się zgadzają',
    whereReportingDiffers: 'W czym doniesienia się różnią',
    whatRemainsUnknown: 'Co pozostaje nieznane',
    insufficientEvidence: 'Niewystarczające dowody',
    timeline: 'Oś czasu',
    entitiesAndTopics: 'Podmioty i tematy',
    aiInterpretedUnverified: '(zinterpretowane przez AI, niezweryfikowane)',
    countries: 'Kraje',
    locations: 'Miejsca',
    people: 'Osoby',
    organizations: 'Organizacje',
    topics: 'Tematy',
  },
  hero: {
    badge: 'Analiza wiadomości oparta na AI',
    headline: 'Zrozum dzisiejszy świat w kilka sekund.',
    subhead:
      'Zadaj pytanie o dowolne wydarzenie, a GlobalNews AI przeanalizuje relacje z różnych źródeł i punktów widzenia, dając Ci jasne podsumowanie oparte na źródłach, któremu możesz zaufać.',
    inputPlaceholder: 'Zapytaj o cokolwiek...',
    inputAriaLabel: 'Zadaj pytanie GlobalNews AI',
    formAriaLabel: 'Zapytaj GlobalNews AI',
    submitAriaLabel: 'Wyślij pytanie',
    tryPrefix: 'Na przykład:',
    exampleQuestions: [
      'Co się teraz dzieje na Bliskim Wschodzie?',
      'Wyjaśnij nowe przepisy UE dotyczące AI prostym językiem',
      'Podsumuj dzisiejsze ogłoszenie banku centralnego',
      'Co mówią naukowcy o najnowszym raporcie klimatycznym?',
      'Omów wyniki finansowe firm technologicznych z tego tygodnia',
      'Co zmieniło się w sondażach wyborczych w tym tygodniu?',
    ],
  },
  analysisModeBadge: {
    liveAiAnalysis: 'ANALIZA AI NA ŻYWO \u00b7 Obsługiwane przez OpenAI',
    demoAiAnalysis: 'ANALIZA DEMONSTRACYJNA AI',
    analysisRejected: 'ANALIZA AI ODRZUCONA \u00b7 Nie przeszła walidacji',
    notAttempted: 'ANALIZA AI NIE PODJĘTA',
    unavailable: 'AI NIEDOSTĘPNE',
    failed: 'ANALIZA AI NIEUDANA',
    cached: 'Z pamięci podręcznej',
  },
  evidenceSufficiencyNote: {
    citedByPrefix: 'Cytowane przez',
    sourceSingular: 'źródło',
    sourcePlural: 'źródła',
    evidenceBasisLabel: 'Podstawa dowodowa z cytowanego źródła:',
  },
  retrievalContextStatus: {
    liveReporting: 'Relacje na żywo',
    liveDataUnavailable: 'Dane na żywo niedostępne',
    storedReporting: 'Relacje z pamięci',
    demoReporting: 'Relacje demonstracyjne',
    liveUnavailableStoredUsed:
      'Relacje na żywo były niedostępne, więc ta analiza wykorzystuje relacje z pamięci.',
    liveNoResultsStoredUsed:
      'Dostawca na żywo nie zwrócił użytecznych wyników, więc wykorzystano relacje z pamięci.',
    liveUnreachableNoStored:
      'Nie udało się połączyć z dostawcą wiadomości na żywo, a dla tego pytania nie były dostępne żadne relacje z pamięci.',
    liveNothingNoStored:
      'Wyszukiwanie na żywo nie znalazło niczego użytecznego, a dla tego pytania nie były dostępne żadne relacje z pamięci.',
    newestStoredArticle: 'Najnowszy zapisany artykuł:',
    interpretedAs: 'Zinterpretowano',
    interpretedAsMiddle: 'jako',
  },
  sourceEntitiesPanel: {
    organizationsIdentified: 'Organizacje zidentyfikowane w materiale źródłowym',
    alsoReferredToAsPrefix: 'Określane również jako',
    alsoReferredToAsSuffix: 'w materiale źródłowym',
    also: 'również',
  },
  formatRelativeTime: {
    justNow: 'przed chwilą',
    minAgo: 'min temu',
    hrAgo: 'godz. temu',
    daySingular: 'dzień',
    dayPlural: 'dni',
    ago: 'temu',
  },
  newsroomSnapshot: {
    label: 'Migawka z redakcji',
    headline: 'Historia, którą dziś czyta każdy',
  },
  featuredStory: {
    unavailable: 'Nagłówki na żywo są tymczasowo niedostępne. Sprawdź, czy backend działa.',
    viewSources: 'Zobacz źródła',
    sourceForms: ['źródło', 'źródła', 'źródeł'] as [string, string, string],
  },
  trendingSidebar: {
    heading: 'Na czasie',
    unavailable: 'Nagłówki na żywo są tymczasowo niedostępne.',
  },
  categoryCards: {
    label: 'Dzisiejsze wydarzenia',
    headline: 'Sześć sposobów, by zobaczyć, co się dzieje',
    unavailable: 'Nagłówki na żywo są tymczasowo niedostępne. Sprawdź, czy backend działa.',
    sourceForms: ['źródło', 'źródła', 'źródeł'] as [string, string, string],
  },
  latestUpdatesFeed: {
    label: 'Najnowsze aktualizacje',
    headline: 'Na bieżąco',
    unavailable: 'Nagłówki na żywo są tymczasowo niedostępne. Sprawdź, czy backend działa.',
    sourceForms: ['źródło', 'źródła', 'źródeł'] as [string, string, string],
  },
  howItWorks: {
    label: 'Jak to działa',
    headline: 'Od pytania do jasnej odpowiedzi, w trzech krokach',
    steps: [
      {
        title: 'Zapytaj o cokolwiek',
        description:
          'Zadaj pytanie tak, jak zapytałbyś dobrze poinformowanego znajomego \u2014 bez słów kluczowych czy specjalnej składni.',
      },
      {
        title: 'AI analizuje relacje',
        description:
          'GlobalNews AI przegląda doniesienia z wielu redakcji i punktów widzenia, a następnie zestawia to, w czym się zgadzają i różnią.',
      },
      {
        title: 'Otrzymujesz jasną odpowiedź',
        description:
          'Zwięzłe podsumowanie oparte na źródłach \u2014 wraz z linkami do oryginalnych artykułów, byś zawsze mógł dowiedzieć się więcej.',
      },
    ],
  },
  trustSection: {
    label: 'Oparte na zaufaniu',
    headline: 'Dlaczego warto zaufać GlobalNews AI?',
    items: [
      {
        title: 'Pełna przejrzystość',
        description:
          'Każde podsumowanie odsyła do oryginalnych źródeł, dzięki czemu możesz zweryfikować wszystko, co mówi GlobalNews AI.',
      },
      {
        title: 'Wiele punktów widzenia',
        description:
          'Pokazujemy, jak różne redakcje i regiony relacjonują to samo wydarzenie \u2014 nie tylko jedną narrację.',
      },
      {
        title: 'Podsumowania AI, wyraźnie oznaczone',
        description:
          'Kontekst generowany przez AI jest zawsze wyraźnie oznaczony i oddzielony od bezpośrednich relacji.',
      },
      {
        title: 'Aktualizacje na żywo',
        description: 'Historie rozwijają się wraz z napływem nowych doniesień, a Twoje podsumowanie aktualizuje się razem z nimi.',
      },
      {
        title: 'Kontekst edukacyjny',
        description: 'Nieznany temat? GlobalNews AI uzupełnia potrzebne tło, a nie tylko nagłówek.',
      },
    ],
  },
  footer: {
    tagline:
      'Jasne, oparte na źródłach zrozumienie wiadomości z wielu perspektyw \u2014 napędzane przez AI, oparte na rzetelnym dziennikarstwie.',
    groupTitles: {
      Company: 'Firma',
      Legal: 'Informacje prawne',
      Developers: 'Deweloperzy',
    } as Record<string, string>,
    linkLabels: {
      '/about': 'O nas',
      '/careers': 'Kariera',
      '/contact': 'Kontakt',
      '/privacy': 'Polityka prywatności',
      '/terms': 'Regulamin',
      '/api': 'API',
    } as Record<string, string>,
    comingSoon: 'Wkrótce',
    copyrightSuffix: 'GlobalNews AI. Wszelkie prawa zastrzeżone.',
    closingTagline: 'Tworzone dla jasności, nie dla kliknięć.',
  },
  navBar: {
    homeAriaLabel: 'Strona główna GlobalNews AI',
    primaryNavigationAriaLabel: 'Nawigacja główna',
    mobileNavigationAriaLabel: 'Nawigacja mobilna',
    searchAriaLabel: 'Szukaj',
    openMenuAriaLabel: 'Otwórz menu',
    closeMenuAriaLabel: 'Zamknij menu',
    signIn: 'Zaloguj się',
    linkLabels: {
      '/': 'Strona główna',
      '/map': 'Mapa świata',
      '/world': 'Świat',
      '/politics': 'Polityka',
      '/business': 'Biznes',
      '/technology': 'Technologia',
      '/science': 'Nauka',
      '/health': 'Zdrowie',
      '/about': 'O nas',
    } as Record<string, string>,
  },
  liveStatusStrip: {
    reconnecting: 'PONOWNE ŁĄCZENIE',
    live: 'NA ŻYWO \u00b7 Obsługiwane przez GNews',
    cached: 'Z PAMIĘCI \u00b7 Wcześniej pobrane relacje',
    mock: 'TRYB DEMO \u00b7 Wyłącznie treść przykładowa',
    unknown: 'STATUS DANYCH NIEZNANY',
    monitoring: 'Monitorowanie zaufanych źródeł na całym świecie',
    lastUpdatedPrefix: 'Ostatnia aktualizacja:',
  },
};
