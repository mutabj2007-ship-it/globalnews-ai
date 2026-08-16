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
    // Milestone #62 Phase 1.
    relevance: 'Dlaczego to ma znaczenie',
    context: 'Kontekst',
    // Milestone #62 Phase 2.
    affectedParties: 'Kogo to dotyczy',
    immediateImpacts: 'Bezpośrednie skutki',
    spilloverImplications: 'Szersze konsekwencje',
    // Milestone #62 Phase 3.
    significance: 'Znaczenie',
    significanceMinor: 'Niewielkie',
    significanceModerate: 'Umiarkowane',
    significanceMajor: 'Duże',
    significanceCritical: 'Krytyczne',
    // Milestone #62 Phase 4 (final).
    watchNext: 'Co obserwować dalej',
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
    // Query-limit correction — Hero.tsx's textarea character-limit
    // message, shown when the 1000-character maximum is reached.
    questionMaxLengthReached: 'Osiągnięto maksymalną długość pytania',
    tryPrefix: 'Na przykład:',
    exampleQuestions: [
      'Co się teraz dzieje na Bliskim Wschodzie?',
      'Wyjaśnij nowe przepisy UE dotyczące AI prostym językiem',
      'Podsumuj dzisiejsze ogłoszenie banku centralnego',
      'Co mówią naukowcy o najnowszym raporcie klimatycznym?',
      'Omów wyniki finansowe firm technologicznych z tego tygodnia',
      'Co zmieniło się w sondażach wyborczych w tym tygodniu?',
    ],
    credibilityLiveSources: 'Źródła na żywo',
    credibilityAiAnalysis: 'Analiza AI',
    credibilityEvidence: 'Kontekst oparty na dowodach',
    exploreMapCta: 'Zobacz mapę świata',
    feedPanelEyebrow: 'Analiza globalna',
    feedPanelHeading: 'Na żywo',
    feedPanelViewMap: 'Zobacz mapę świata',
    feedPanelUnavailableHeading: 'Status źródła',
    feedPanelUnavailableBody: 'Transmisja na żywo tymczasowo niedostępna.',
    feedPanelUnavailableFooter: 'Wyszukiwanie i analiza krajów pozostają dostępne.',
    feedPanelSearchStatus: 'Analiza wyszukiwania',
    feedPanelCountryStatus: 'Analiza krajów',
    feedPanelMapStatus: 'Analiza mapy',
    feedPanelAvailable: 'Dostępne',
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
    headline: 'Najważniejsza wiadomość teraz',
  },
  featuredStory: {
    unavailable: 'Nagłówki na żywo są tymczasowo niedostępne. Sprawdź, czy backend działa.',
    viewSources: 'Zobacz źródła',
    sourceForms: ['źródło', 'źródła', 'źródeł'] as [string, string, string],
    readFullStoryPrefix: 'Przeczytaj pełną historię:',
  },
  inFocusSidebar: {
    heading: 'W centrum uwagi',
    unavailable: 'Nagłówki na żywo są tymczasowo niedostępne.',
    readFullStoryPrefix: 'Przeczytaj pełną historię:',
  },
  globalDevelopments: {
    eyebrow: 'Globalne wydarzenia',
    headline: 'Co się teraz dzieje',
    unavailable: 'Nagłówki na żywo są tymczasowo niedostępne. Sprawdź, czy backend działa.',
    sourceForms: ['źródło', 'źródła', 'źródeł'] as [string, string, string],
    readFullStoryPrefix: 'Przeczytaj pełną historię:',
    viewSources: 'Zobacz źródła',
    unavailableLabel: 'Status systemu',
    statusFeedUnavailable: 'Transmisja na żywo niedostępna',
    statusCountryAvailable: 'Analiza krajów dostępna',
    statusSearchAvailable: 'Wyszukiwanie dostępne',
    statusMapAvailable: 'Mapa świata dostępna',
    statusWaitingProvider: 'Oczekiwanie na dostawcę',
    // M60 Phase 2 — carousel controls.
    previousLabel: 'Poprzednia historia',
    nextLabel: 'Następna historia',
  },
  situationMap: {
    eyebrow: 'Mapa sytuacyjna świata',
    heading: 'Zobacz, co się dzieje, geograficznie',
    description: 'Wybierz kraj, aby zobaczyć aktualne relacje.',
    openFullMap: 'Otwórz pełną mapę',
    storyForms: ['historia', 'historie', 'historii'] as [string, string, string],
    publisherForms: ['wydawca', 'wydawców', 'wydawców'] as [string, string, string],
    latestLabel: 'Najnowsze',
    primaryTopicLabel: 'Główny temat',
    noSelectionPrompt: 'Wybierz kraj na mapie, aby zobaczyć realne, aktualne relacje.',
    hoverPrompt: 'Najedź na region, aby sprawdzić zasięg relacji.',
    countryCoverageLabel: 'Zasięg relacji dla kraju',
    countryCoverageValue: 'Dostępny tam, gdzie istnieją dane dostawcy',
    mapModeLabel: 'Tryb mapy',
    mapModeValue: 'Interaktywny',
    loadingLabel: 'Wczytywanie relacji\u2026',
    noCoverageLabel: 'Nie znaleziono aktualnych relacji dla tego kraju.',
  },
  categoryCards: {
    label: 'Dzisiejsze wydarzenia',
    headline: 'Więcej z dzisiejszych wydarzeń',
    unavailable: 'Nagłówki na żywo są tymczasowo niedostępne. Sprawdź, czy backend działa.',
    sourceForms: ['źródło', 'źródła', 'źródeł'] as [string, string, string],
    readFullStoryPrefix: 'Przeczytaj pełną historię:',
  },
  latestNowRail: {
    label: 'Teraz na żywo',
    unavailable: 'Nagłówki na żywo są tymczasowo niedostępne.',
    previousLabel: 'Poprzednie aktualizacje',
    nextLabel: 'Następne aktualizacje',
    readFullStoryPrefix: 'Przeczytaj pełną historię:',
    regionLabel: 'Najnowsze wiadomości, przewijalne',
  },
  worldMapGateway: {
    label: 'Odkryj świat',
    headline: 'Zobacz, co się dzieje, geograficznie',
    description: 'Przeglądaj relacje na żywo według kraju na interaktywnej mapie świata.',
    cta: 'Otwórz mapę świata',
  },
  latestUpdatesFeed: {
    label: 'Najnowsze aktualizacje',
    headline: 'Na bieżąco',
    unavailable: 'Nagłówki na żywo są tymczasowo niedostępne. Sprawdź, czy backend działa.',
    sourceForms: ['źródło', 'źródła', 'źródeł'] as [string, string, string],
    readFullStoryPrefix: 'Przeczytaj pełną historię:',
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
  mobileBottomNav: {
    navigationAriaLabel: 'Nawigacja dolna',
    home: 'Strona główna',
    worldMap: 'Mapa świata',
    ask: 'Zapytaj AI',
    intelligence: 'Analiza',
  },
  navBar: {
    homeAriaLabel: 'Strona główna GlobalNews AI',
    primaryNavigationAriaLabel: 'Nawigacja główna',
    mobileNavigationAriaLabel: 'Nawigacja mobilna',
    searchAriaLabel: 'Szukaj',
    openMenuAriaLabel: 'Otwórz menu',
    closeMenuAriaLabel: 'Zamknij menu',
    signIn: 'Zaloguj się',
    // Milestone #57 — Optional Accounts.
    history: 'Historia',
    signOut: 'Wyloguj się',
    deleteAccount: 'Usuń konto',
    deleteAccountConfirm: 'Usunąć konto? Spowoduje to trwałe usunięcie zapisanej historii i nie można tego cofnąć.',
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
  map: {
    metaTitle: 'Mapa świata \u2014 GlobalNews AI',
    metaDescription: 'Odkrywaj bieżące doniesienia informacyjne według kraju na interaktywnej mapie świata.',
    exploreLabel: 'Odkryj',
    headline: 'Mapa wiadomości ze świata',
    intro:
      'Wybierz kraj, aby zobaczyć jego bieżące nagłówki, pozyskiwane na żywo tam, gdzie skonfigurowano dostawcę. Wyszukaj po nazwie lub kliknij bezpośrednio na mapie.',
    mapA11yNote:
      'Poniżej, na większych ekranach, wyświetlana jest interaktywna mapa świata. Nie musisz jej używać \u2014 pole wyszukiwania kraju powyżej pozwala znaleźć i wybrać dowolny obsługiwany kraj, wpisując jego nazwę, z pełną obsługą klawiatury.',
    noSelectionPrompt: 'Wyszukaj kraj powyżej lub wybierz go na mapie, aby zobaczyć jego bieżące relacje.',
    mobileFallback:
      'Interaktywna mapa jest dostępna na większych ekranach. Użyj pola wyszukiwania powyżej, aby wybrać tutaj kraj.',
    loading: 'Wczytywanie mapy świata\u2026',
    mapLoadErrorPrefix: 'Nie udało się wczytać interaktywnej mapy (',
    mapLoadErrorSuffix:
      '). Zamiast tego użyj wyszukiwania kraju poniżej \u2014 te same informacje o kraju są dostępne bez mapy.',
    searchLabel: 'Wyszukaj kraj po nazwie',
    searchPlaceholder: 'Wyszukaj kraj (np. Hiszpania)',
    categories: {
      all: 'Wszystkie',
      world: 'Świat',
      politics: 'Polityka',
      business: 'Biznes',
      technology: 'Technologia',
      science: 'Nauka',
      health: 'Zdrowie',
    } as Record<string, string>,
    coverageLegendTitle: 'Legenda zasięgu',
    legendNoStories: 'Brak wczytanych materiałów',
    legendFew: '1\u20133 materiały',
    legendSome: '4\u20137 materiałów',
    legendMany: '8\u201312 materiałów',
    legendLots: '13+ materiałów',
    tooltipLoaded: 'WCZYTANO',
    tooltipReady: 'GOTOWE',
    tooltipStories: 'Materiały',
    tooltipRefreshAction: 'Kliknij, aby odświeżyć i zobaczyć najnowsze materiały.',
    tooltipLoadAction: 'Kliknij, aby wczytać bieżące wiadomości dla tego kraju.',
    badge: {
      livePrefix: 'NA ŻYWO \u00b7 OBSŁUGIWANE PRZEZ ',
      delayedPrefix: 'OPÓŹNIONY KANAŁ \u00b7 OBSŁUGIWANY PRZEZ ',
      stored: 'ZAPISANE RELACJE',
      demo: 'TRYB DEMO \u00b7 WYŁĄCZNIE TREŚĆ PRZYKŁADOWA',
      unavailable: 'ŹRÓDŁO TYMCZASOWO NIEDOSTĘPNE',
    },
    fallback: {
      providerErrorTitle: 'Dostawca na żywo niedostępny',
      noLiveResultsTitle: 'Brak użytecznych wyników na żywo',
      genericTitle: 'Zapisane relacje',
      providerErrorDescription:
        'Nie udało się połączyć z dostawcą wiadomości na żywo. Zamiast tego pokazano wcześniej zapisane relacje.',
      noLiveResultsDescription:
        'Dostawca odpowiedział, ale nie były dostępne żadne użyteczne bieżące materiały dla tego kraju. Zamiast tego pokazano zapisane relacje.',
      genericDescription: 'Dla tego kraju pokazywane są wcześniej zapisane relacje.',
    },
    newestStoredArticle: 'Najnowszy zapisany artykuł:',
    categoryFilterAriaLabel: 'Filtruj materiały dla tego kraju według kategorii',
    panel: {
      coverageQuality: 'Jakość materiałów',
      coverageStrength: 'Poziom zasięgu',
      coverageQualityBasis: 'Na podstawie liczby artykułów, różnorodności wydawców i aktualności relacji.',
      publishers: 'Wydawcy',
      latest: 'Najnowszy',
      coverageSnapshot: 'Migawka zasięgu',
      stories: 'Materiały',
      mainTopic: 'Główny temat',
      categoryActivity: 'Aktywność wg kategorii',
      noCoveragePrefix: 'Nie znaleziono bieżących materiałów dla',
      noCoverageInCategory: 'w kategorii',
      noCoverageSuffix: '. Spróbuj innej kategorii lub zobacz pełny zasięg poniżej.',
      viewFullCoverage: 'Zobacz pełny zasięg kraju',
      showDetails: 'Pokaż szczegóły',
      hideDetails: 'Ukryj szczegóły',
    },
    storyForms: ['historia', 'historie', 'historii'] as [string, string, string],
    storiesCurrentlyLoadedSuffix: 'obecnie wczytanych',
    genericFetchError: 'Coś poszło nie tak podczas wczytywania materiałów dla tego kraju.',
    coverageQualityLevels: {
      none: {
        label: 'Brak materiałów',
        description: 'Dla tego wyboru nie są obecnie dostępne żadne artykuły.',
      },
      limited: {
        label: 'Ograniczone materiały',
        description: 'Dostępna jest tylko niewielka liczba doniesień lub wydawców.',
      },
      developing: {
        label: 'Rozwijające się materiały',
        description: 'Dostępnych jest kilka doniesień, ale zasięg może wciąż się rozwijać.',
      },
      strong: {
        label: 'Bogate materiały',
        description: 'Zasięg obejmuje kilka niedawnych artykułów od wielu wydawców.',
      },
    },
    storedReportingNoticeAriaLabel: 'Powiadomienie o zapisanych relacjach',
    coverageQualityAriaSuffix: 'jakość materiałów',
    readFullStoryPrefix: 'Przeczytaj pełną historię:',
    askAboutStory: 'Zapytaj GlobalNews AI o to',
    freshness: {
      fresh: 'ŚWIEŻE',
      recent: 'NIEDAWNE',
      aging: 'STARZEJĄCE SIĘ',
      limited: 'OGRANICZONE',
    } as Record<string, string>,
  },
  intelligenceModules: {
    eyebrow: 'Silnik analityczny',
    heading: 'Jak GlobalNews AI rozumie świat',
    description: 'Każdy moduł to realna funkcja silnika, uruchamiana, gdy zadajesz pytanie lub przeglądasz relacje.',
    stateLabels: {
      active: 'Aktywny',
      preview: 'Zapowiedź',
      comingSoon: 'Wkrótce',
    },
    openAction: 'Otwórz',
    hubLabel: 'Silnik analityczny GlobalNews AI',
    modules: {
      aiResearch: {
        title: 'Asystent badawczy AI',
        description: 'Zadaj pytanie i otrzymaj odpowiedź opartą na dowodach z rzeczywistych źródeł.',
      },
      worldIntelligence: {
        title: 'Analiza świata',
        description: 'Globalne wydarzenia uporządkowane według trafności, aktualności i różnorodności źródeł.',
      },
      countryIntelligence: {
        title: 'Analiza krajów',
        description: 'Przeglądaj zasięg, kategorie i aktualność relacji dla dowolnego kraju na mapie.',
      },
      evidence: {
        title: 'Dowody i porównanie źródeł',
        description: 'Zobacz, które źródła się zgadzają, gdzie się różnią i co pozostaje niepotwierdzone.',
      },
      economy: {
        title: 'Analiza gospodarcza',
        description: 'Wczesny etap: relacje gospodarcze i biznesowe, bez dedykowanych danych rynkowych.',
      },
      conflict: {
        title: 'Analiza konfliktów',
        description: 'Wczesny etap: relacje związane z konfliktami, bez dedykowanego monitorowania ryzyka.',
      },
      market: {
        title: 'Analiza rynkowa',
        description: 'Planowane: dedykowane dane rynkowe i cenowe nie są jeszcze podłączone.',
      },
      timeline: {
        title: 'Oś czasu wydarzeń',
        description: 'Planowane: uporządkowane osie czasu wydarzeń nie są jeszcze dostępne.',
      },
      forecast: {
        title: 'Prognozy i lista obserwowanych',
        description: 'Planowane: monitorowane ryzyka i wskaźniki nie są jeszcze dostępne.',
      },
    },
  },
};
