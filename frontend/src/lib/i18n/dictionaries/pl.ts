import type { Dictionary } from './index';
import { adminPl } from './adminPl';

/**
 * Milestone #47 — Polish dictionary, the first production non-English
 * vertical slice. Covers the M47 minimum set: language selector,
 * no-question/loading-adjacent states, no-evidence message, and the
 * source-language disclosure label. Does NOT translate provider source
 * names, URLs, or article titles — those remain in their original
 * form/language, per the M47 authorization's explicit instruction.
 */
export const pl: Dictionary = {
  /**
   * F1.b — the Admin Platform namespace. Spread here so it resolves
   * through the SAME getDictionary(language) call as every other
   * section; the strings live in their own file only because this one
   * is already large. No second i18n mechanism is introduced.
   */
  admin: adminPl,

  languageSelectorLabel: 'Język',
  yourQuestion: 'Twoje pytanie',
  noQuestionProvided: 'Nie podano pytania',
  noQuestionMessage: 'Nie podano pytania. Spróbuj wyszukać ze strony głównej.',
  genericFetchError: 'Coś poszło nie tak podczas analizy tego pytania. Spróbuj ponownie.',
  // M65 — /search bez pytania to pełnoprawna przestrzeń badawcza, a nie
  // ślepy zaułek z komunikatem błędu. Poniżej jej własne teksty.
  searchMetaTitle: 'Przestrzeń badawcza — GlobalNews AI',
  searchMetaDescription: 'Zadaj pytanie i otrzymaj analizę wiadomości opartą na rzeczywistych źródłach.',
  /**
   * M66.13 — ta sama rola co w en.ts.
   */
  homeMetaTitle: 'GlobalNews AI \u2014 Zrozum dzisiejszy \u015bwiat w kilka sekund.',
  homeMetaDescription:
    'GlobalNews AI zamienia codzienne wiadomo\u015bci w jasne, oparte na \u017ar\u00f3d\u0142ach i wielu perspektywach odpowiedzi, kt\u00f3re naprawd\u0119 rozumiesz.',
  searchWorkspaceHeading: 'Zapytaj GlobalNews AI',
  searchWorkspaceIntro: 'Zadaj pytanie o wydarzenia na świecie i otrzymaj odpowiedź opartą na dowodach z rzeczywistych źródeł.',
  searchWorkspacePlaceholder: 'Co chcesz zrozumieć?',
  searchWorkspaceSubmitLabel: 'Analizuj',
  searchWorkspaceAriaLabel: 'Zadaj pytanie badawcze',
  // M65 — zlokalizowane komunikaty o błędach analizy. Rzeczywisty status
  // HTTP pozostaje na obiekcie błędu; użytkownik nigdy nie widzi liczby.
  analysisErrorTimeout: 'Analiza trwa dłużej niż zwykle. Spróbuj ponownie.',
  analysisErrorNetwork: 'Nie udało się połączyć z GlobalNews AI. Sprawdź połączenie i spróbuj ponownie.',
  analysisErrorInvalidQuery: 'To pytanie jest zbyt krótkie do analizy. Dodaj trochę więcej szczegółów.',
  analysisErrorRateLimited: 'Wysłano kilka zapytań w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.',
  analysisErrorServer: 'GlobalNews AI nie może teraz ukończyć tej analizy. Spróbuj wkrótce ponownie.',
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
  /* M66.14B — see en.ts. Application chrome only; provider text is untranslated. */
  heroContext: {
    heading: 'KONTEKST WYWIADOWCZY',
    countryEvidence: 'DANE NA POZIOMIE KRAJU',
    dismissLabel: 'Zamknij kontekst wywiadowczy',
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
    credibilityMultiPerspective: 'Wiele perspektyw',
    dataStatusLabel: 'Status danych',
    lastUpdatedLabel: 'Ostatnia aktualizacja',
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
    /**
     * M66.8d (CTO decision D-1, option A) — the localized step prefix.
     * GN-CD-HIW-005 renders `STEP 01` where the current build shows a bare
     * `01`. The prefix is new user-facing copy, so it is a dictionary key
     * rather than a literal in the component: hardcoding an English `STEP`
     * would put an untranslated string on the Polish page. Composed with the
     * EXISTING processSteps numerals ('01', '02', '03'), which are
     * language-independent and unchanged.
     */
    stepPrefix: 'KROK',
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
      '/source-policy': 'Polityka źródeł',
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
    languageSelectorLabel: 'Język',
    /**
     * M66.11 — the action half of the language control's accessible name,
     * and the listbox's own label. GN-CD-M66.11 §7 requires the trigger to be
     * named "Language: {current}. Select language" FROM LOCALIZED STRINGS,
     * never a concatenated English template.
     *
     * ONE key, not two. It serves both the trigger's action phrase and the
     * listbox aria-label, which are the same words for the same purpose — the
     * same reuse decision M48 made when DataModeLabel adopted
     * liveStatusStrip's four existing state labels rather than duplicating
     * them. No interpolation mechanism is introduced: NavBar composes
     * `${languageSelectorLabel}: ${endonym}. ${languageSelectorAction}` from
     * these two localized strings and LANGUAGE_NATIVE_LABELS.
     */
    languageSelectorAction: 'Wybierz język',
    /** M66.13 — ta sama rola co w en.ts. */
    sectionsHeading: 'SEKCJE',
    editorialUnavailableLabel: 'jeszcze niedostępne',
    // M65 — zatwierdzona dziewięciopozycyjna sekwencja nagłówka. Klucze
    // odpowiadają labelKey z navModel.ts, dzięki czemu każda widoczna
    // etykieta jest tłumaczona.
    navItemLabels: {
      home: 'Strona główna',
      worldMap: 'Mapa świata',
      world: 'Świat',
      politics: 'Polityka',
      business: 'Biznes',
      technology: 'Technologia',
      science: 'Nauka',
      health: 'Zdrowie',
      about: 'O nas',
    } as Record<string, string>,
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
    /** M66.13 — czwarty stan NewsDataMode, wcześniej łączony z `unknown`. */
    unavailable: 'BRAK DOSTĘPNYCH RELACJI',
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
      // M66.13C — see en.ts. Polish singular 'Sport' is the ordinary section
      // name, matching the existing single-word register of this group.
      sports: 'Sport',
      entertainment: 'Rozrywka',
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
    // M65.1 — patrz en.ts
    canvasSubtitle: 'Połączone funkcje pogłębiające zrozumienie świata',
    moduleForms: ['moduł', 'moduły', 'modułów'] as [string, string, string],
    activeForms: ['aktywny', 'aktywne', 'aktywnych'] as [string, string, string],
    modules: {
      /*
        M66.5 — GN-CD-154, patrz en.ts. Claude Design supplies English short
        names only; these nine were authored for this milestone and approved
        by the CTO under decision D-5 A, then measured against the same
        released 108x56 card. Six deliberately equal their own `title`:
        Polish has no clipping equivalent of English "...Intelligence ->
        ...Intel", and those six already fit. Only the three that genuinely
        needed shortening were shortened. `Prognozy i alerty` was rejected
        because "alerts" would imply a notification capability this product
        does not have.
      */
      aiResearch: {
        title: 'Asystent badawczy AI',
        shortTitle: 'Badania AI',
        description: 'Zadaj pytanie i otrzymaj odpowiedź opartą na dowodach z rzeczywistych źródeł.',
      },
      worldIntelligence: {
        title: 'Analiza świata',
        shortTitle: 'Analiza świata',
        description: 'Globalne wydarzenia uporządkowane według trafności, aktualności i różnorodności źródeł.',
      },
      countryIntelligence: {
        title: 'Analiza krajów',
        shortTitle: 'Analiza krajów',
        description: 'Przeglądaj zasięg, kategorie i aktualność relacji dla dowolnego kraju na mapie.',
      },
      evidence: {
        title: 'Dowody i porównanie źródeł',
        shortTitle: 'Dowody i źródła',
        // M65.1 — decyzja CTO nr 2: bez deklaracji wykrywania
        // stronniczości; opis oddaje rzeczywistą funkcję produktu.
        description: 'Porównuj źródła. Znajduj zgodności i rozbieżności.',
      },
      economy: {
        title: 'Analiza gospodarcza',
        shortTitle: 'Analiza gospodarcza',
        description: 'Wczesny etap: relacje gospodarcze i biznesowe, bez dedykowanych danych rynkowych.',
      },
      conflict: {
        title: 'Analiza konfliktów',
        shortTitle: 'Analiza konfliktów',
        description: 'Wczesny etap: relacje związane z konfliktami, bez dedykowanego monitorowania ryzyka.',
      },
      market: {
        title: 'Analiza rynkowa',
        shortTitle: 'Analiza rynkowa',
        description: 'Planowane: dedykowane dane rynkowe i cenowe nie są jeszcze podłączone.',
      },
      timeline: {
        title: 'Oś czasu wydarzeń',
        shortTitle: 'Oś czasu wydarzeń',
        description: 'Planowane: uporządkowane osie czasu wydarzeń nie są jeszcze dostępne.',
      },
      forecast: {
        title: 'Prognozy i lista obserwowanych',
        shortTitle: 'Prognozy i obserwacje',
        description: 'Planowane: monitorowane ryzyka i wskaźniki nie są jeszcze dostępne.',
      },
    },
  },
  privacyPage: {
    title: 'Polityka prywatności',
    lastUpdatedLabel: 'Ostatnia aktualizacja',
    lastUpdatedDate: '17 sierpnia 2026',
    intro:
      'Ta strona wyjaśnia, w prosty sposób, jakie informacje zbiera GlobalNews AI i jak są one wykorzystywane. Opisuje produkt dokładnie w takiej formie, w jakiej działa on obecnie.',
    sections: [
      {
        heading: 'Konto i logowanie',
        body: 'Możesz korzystać z GlobalNews AI, wyszukiwać i czytać analizy bez logowania. Jeśli zdecydujesz się zalogować przy użyciu konta Google, otrzymujemy od Google podstawowe informacje identyfikacyjne (takie jak imię i nazwisko, adres e-mail oraz zdjęcie profilowe), aby utworzyć i utrzymać Twoje konto oraz zachować Twoje zalogowanie między sesjami.',
      },
      {
        heading: 'Aktywność wyszukiwania i historia',
        body: 'Gdy jesteś zalogowany, zadawane przez Ciebie pytania mogą być zapisywane na Twoim koncie, abyś mógł do nich wrócić później. W dowolnym momencie możesz przeglądać i usuwać poszczególne wpisy lub wyczyścić całą historię wyszukiwania na swoim koncie. Usunięcie konta powoduje również usunięcie zapisanej historii wyszukiwania.',
      },
      {
        heading: 'Preferencje językowe',
        body: 'Wybrany przez Ciebie język wyświetlania jest zapisywany w Twojej przeglądarce (za pomocą pamięci lokalnej oraz niewielkiego pliku cookie), aby strona zapamiętała Twoją preferencję przy kolejnej wizycie. Jest to wyłącznie techniczne ustawienie preferencji \u2014 nie jest ono powiązane z profilowaniem ani działaniami reklamowymi.',
      },
      {
        heading: 'Jak przetwarzane jest Twoje pytanie',
        body: 'Aby odpowiedzieć na pytanie, GlobalNews AI pobiera odpowiednie doniesienia prasowe od zewnętrznych dostawców wiadomości i wykorzystuje model językowy AI do analizy i podsumowania tych doniesień. Treść Twojego pytania oraz pobrane artykuły są przesyłane do tych zewnętrznych usług w ramach generowania odpowiedzi.',
      },
      {
        heading: 'Czego nie zbieramy',
        body: 'GlobalNews AI nie żąda ani nie zbiera Twojej dokładnej lokalizacji fizycznej. Obecnie nie prowadzimy systemów analitycznych, reklamowych ani śledzenia administracyjnego wykraczających poza zakres opisany na tej stronie.',
      },
      {
        heading: 'Bezpieczeństwo',
        body: 'Stosujemy standardowe zabezpieczenia techniczne odpowiednie dla usługi tego rodzaju, aby pomóc chronić Twoje informacje. Żadna usługa online nie może zagwarantować pełnego bezpieczeństwa, dlatego zachęcamy do używania silnego, unikalnego hasła do konta powiązanego z tą usługą.',
      },
      {
        heading: 'Zmiany w niniejszej polityce',
        body: 'W miarę rozwoju GlobalNews AI ta strona będzie aktualizowana, aby odzwierciedlać rzeczywisty sposób działania produktu. Zachęcamy do regularnego odwiedzania tej strony.',
      },
    ],
  },
  termsPage: {
    title: 'Regulamin',
    lastUpdatedLabel: 'Ostatnia aktualizacja',
    lastUpdatedDate: '17 sierpnia 2026',
    intro:
      'Niniejszy regulamin opisuje, w jaki sposób GlobalNews AI powinien być używany. Prosimy o zapoznanie się z nim przed skorzystaniem z usługi.',
    sections: [
      {
        heading: 'Czym jest GlobalNews AI',
        body: 'GlobalNews AI to narzędzie informacyjne, które pomaga zrozumieć bieżące wydarzenia poprzez pobieranie doniesień prasowych i generowanie ich analizy wspomaganej przez AI. Ma na celu szybkie zorientowanie się w danym temacie \u2014 nie zastępuje samodzielnej lektury źródłowych doniesień i nie stanowi porady prawnej, finansowej ani medycznej.',
      },
      {
        heading: 'Analiza generowana przez AI może zawierać błędy',
        body: 'Analizy na tej stronie są generowane przez model językowy AI na podstawie pobranych dowodów. Treści generowane przez AI mogą być niepełne, nieaktualne lub po prostu błędne. Zawsze sprawdzaj cytowane źródła i dowody przedstawione obok analizy, zanim się na niej oprzesz, i kieruj się własnym osądem.',
      },
      {
        heading: 'Zakres i dostępność nie są gwarantowane',
        body: 'Działanie GlobalNews AI zależy od zewnętrznych dostawców wiadomości i usług AI. Zakres informacji na dany temat może być częściowy, opóźniony lub czasowo niedostępny, a sama usługa może być okresowo niedostępna. Nie gwarantujemy pełnego ani ciągłego zakresu informacji dla żadnego tematu, regionu ani wydarzenia.',
      },
      {
        heading: 'Twoje konto i obowiązki',
        body: 'Jeśli utworzysz konto, jesteś odpowiedzialny za zachowanie poufności danych logowania oraz za aktywność odbywającą się za pośrednictwem Twojego konta. W dowolnym momencie możesz usunąć swoje konto wraz z powiązanymi danymi.',
      },
      {
        heading: 'Dozwolone korzystanie',
        body: 'Prosimy o korzystanie z GlobalNews AI zgodnie z jego przeznaczeniem. Nie należy podejmować prób zakłócania, przeciążania ani obchodzenia działania usługi, ani wykorzystywać jej w sposób naruszający obowiązujące prawo lub prawa osób trzecich.',
      },
      {
        heading: 'Atrybucja źródeł',
        body: 'Analizy przedstawiane na tej stronie opierają się na doniesieniach pochodzących od zewnętrznych źródeł prasowych, które są cytowane obok analizy. Źródła te zachowują własne prawa do swoich oryginalnych doniesień; rolą GlobalNews AI jest pomóc Ci odnaleźć i zrozumieć te doniesienia, a nie je zastąpić.',
      },
      {
        heading: 'Zmiany usługi i niniejszego regulaminu',
        body: 'GlobalNews AI jest w fazie aktywnego rozwoju, w związku z czym zarówno usługa, jak i niniejszy regulamin mogą ulegać zmianom. Będziemy aktualizować tę stronę, aby odzwierciedlić istotne zmiany.',
      },
      {
        heading: 'Ogólne zastrzeżenie',
        body: 'Usługa jest świadczona w stanie \u201cjaki jest\u201d, bez jakichkolwiek gwarancji, w zakresie dozwolonym przez obowiązujące prawo.',
      },
    ],
  },
  /**
   * M66.10B — Source Policy, Polish. A faithful translation of the
   * CTO-approved English factual policy: same section order, same
   * section count, same claims. No claim is strengthened in
   * translation, and no claim absent from the English text is
   * introduced here.
   *
   * Product and provider names (GlobalNews AI, GNews) are proper
   * names and are never localized, consistent with the M47/M48
   * treatment of "GNews" elsewhere in this file.
   */
  sourcePolicyPage: {
    title: 'Polityka źródeł',
    lastUpdatedLabel: 'Ostatnia aktualizacja',
    lastUpdatedDate: '20 sierpnia 2026',
    intro:
      'Ta strona wyjaśnia, skąd pochodzą informacje prezentowane w GlobalNews AI, w jaki sposób są przedstawiane oraz co mówią, a czego nie mówią. Opisuje produkt dokładnie w takiej formie, w jakiej działa on obecnie, a nie w takiej, w jakiej ma działać w przyszłości.',
    sections: [
      {
        heading: 'Skąd pochodzą informacje',
        body: 'GlobalNews AI pobiera opublikowane materiały dziennikarskie za pośrednictwem zewnętrznego dostawcy wiadomości i wykorzystuje je w swoich funkcjach informacyjnych i analitycznych. Dostawca zwraca artykuły pochodzące od wielu różnych wydawców. Produkcyjne pobieranie wiadomości opiera się obecnie na jednym dostawcy, GNews \u2014 GlobalNews AI nie korzysta dziś z wielu dostawców wiadomości na żywo.',
      },
      {
        heading: 'Nazwy źródeł i odnośniki do artykułów',
        body: 'Każdy artykuł jest prezentowany wraz z nazwą źródła podaną przez dostawcę wiadomości i prowadzi do strony wskazanej przez tego dostawcę, przy użyciu adresu URL dołączonego do pobranego materiału. GlobalNews AI nie publikuje ponownie ani nie hostuje artykułów. Jeśli dostawca nie poda nazwy źródła, GlobalNews AI informuje, że źródło jest nieznane, zamiast je zgadywać.',
      },
      {
        heading: 'Porównywanie materiałów z różnych źródeł',
        body: 'Analizując pytanie, GlobalNews AI pracuje na zbiorze pobranych artykułów i wskazuje, w czym są one zgodne, a w czym się różnią. To porównanie opisuje treść pobranych materiałów. Nie jest oceną tego, które źródło ma rację.',
      },
      {
        heading: 'Analiza generowana przez AI',
        body: 'Podsumowania, porównania i kontekst w GlobalNews AI są generowane przez model językowy AI i są prezentowane oddzielnie od samych materiałów dziennikarskich. Każda analiza zawiera informację o pochodzeniu i statusie opisującą sposób jej powstania \u2014 w tym sytuacje, gdy usługa AI była niedostępna, gdy żądanie zakończyło się niepowodzeniem oraz gdy działa tryb demonstracyjny.',
      },
      {
        heading: 'Jak sprawdzane są elementy analizy',
        body: 'Twierdzenia oparte na dowodach oraz ustrukturyzowane elementy analizy są weryfikowane względem artykułów przekazanych do analizy. Elementy, których przywołanych dowodów nie da się powiązać z tymi artykułami, są usuwane przed zwróceniem wyniku \u2014 nawet jeśli pozostawia to pustą sekcję. Wyświetlane odnośniki źródeł są tworzone na podstawie rekordów pobranych artykułów, a nie przyjmowane bezpośrednio z odpowiedzi modelu. Analiza AI nadal może błędnie odczytać lub nadmiernie uprościć przywoływane materiały \u2014 właśnie dlatego są tu odnośniki.',
      },
      {
        heading: 'Różnorodność źródeł',
        body: 'Na potrzeby analizy GlobalNews AI zlicza strukturalne właściwości pobranych materiałów: ile artykułów zwrócono, ile wystąpiło odrębnych nazw źródeł, ile odrębnych domen internetowych oraz ile artykułów przypominało swoje powtórzenia. Są to wyłącznie liczby opisujące to, co pobrano. Nie dowodzą one niezależności redakcyjnej, pochodzenia syndykowanego lub agencyjnego ani powiązań między źródłami, a GlobalNews AI nie ocenia obecnie autorytetu źródeł.',
      },
      {
        heading: 'Informacje na żywo, z pamięci podręcznej, próbne i niedostępne',
        body: 'Potok wiadomości rozróżnia cztery stany danych. Na żywo oznacza, że dostawca wiadomości został odpytany i udzielił odpowiedzi. Z pamięci podręcznej oznacza, że dostawca nie mógł dostarczyć bieżących wyników, więc wykorzystywane są wcześniej pobrane materiały z naszej własnej bazy danych, ograniczone do skonfigurowanego 24-godzinnego okna zapasowego. Próbne oznacza treść demonstracyjną, która nie jest dopuszczona jako wiadomości produkcyjne. Niedostępne oznacza, że nie udało się pobrać żadnych materiałów ani nie było zapisanych, więc nic nie jest pokazywane. Interfejs stosuje wskaźniki statusu i pochodzenia, aby dane z pamięci podręcznej lub próbne nie były przedstawiane jako materiały na żywo, a odpowiedzi próbne i rzeczywiste nie były ze sobą mieszane.',
      },
      {
        heading: 'Ograniczenia dostawcy i zakres materiałów',
        body: 'Zakres materiałów dostępnych w GlobalNews AI zależy od tego, co zwróci jego dostawca wiadomości. Jeśli dostawca jest niedostępny, ograniczony limitem zapytań lub nie zwraca nic dla danego zapytania, GlobalNews AI sięga po materiały z pamięci podręcznej albo informuje, że nic nie jest dostępne; nie zastępuje ich treścią z innego źródła. Zakres jest zatem nierównomierny, a temat, region, język lub źródło nieobjęte przez dostawcę nie pojawi się w serwisie. Brak materiałów w GlobalNews AI nie jest dowodem na to, że nic się nie wydarzyło.',
      },
      {
        heading: 'Sprostowania i zmiany zakresu w czasie',
        body: 'GlobalNews AI pobiera materiały ponownie przy każdym zapytaniu, a zapisana kopia artykułu jest zastępowana, gdy pobrana zostanie nowsza wersja tego samego artykułu. Nie istnieje mechanizm śledzenia sprostowań ani wycofań publikowanych przez wydawców: GlobalNews AI nie śledzi ich, nie oznacza i nie powiadamia o nich. Jeśli źródło prostuje lub wycofuje materiał, wiążącym zapisem pozostaje jego własna strona, do której prowadzą odnośniki artykułów.',
      },
      {
        heading: 'Czego GlobalNews AI nie gwarantuje',
        body: 'GlobalNews AI nie gwarantuje, że zakres materiałów na jakikolwiek temat jest kompletny, że informacje są aktualne w momencie ich czytania ani że jakiekolwiek podsumowanie lub analiza są poprawne. Nie weryfikuje zgodności pobieranych materiałów ze stanem faktycznym i nie tworzy rankingu, ocen ani certyfikacji źródeł. Korzystaj z odnośników \u2014 prowadzą one do materiałów, które GlobalNews AI opisuje.',
      },
    ],
  },
};
