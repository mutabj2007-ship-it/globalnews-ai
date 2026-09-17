import type { Dictionary } from './index';
import { adminPl } from './adminPl';
import { supportPl } from './supportPl';

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

  /** RC-1 - see the note on `support` in en.ts. */
  support: supportPl,

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
  analysisErrorRateLimited:
    'Wysłano kilka zapytań analitycznych w krótkim czasie. W zależności od tego, który limit został osiągnięty, oczekiwanie potrwa około minuty lub do około 15 minut. Zalogowanie się podnosi ten dłuższy limit.',
  analysisErrorServer: 'GlobalNews AI nie może teraz ukończyć tej analizy. Spróbuj wkrótce ponownie.',
  noEvidenceMessage: 'Nie znaleziono powiązanych artykułów dla tego pytania.',
  aiUnavailableMessage: 'Analiza AI jest tymczasowo niedostępna, ale powiązane artykuły są pokazane poniżej.',
  originalSourcesHeading: 'Oryginalne źródła',
  evidenceLanguageLabel: 'Język źródła',
  askAi: {
    launcher: 'Zapytaj AI',
    title: 'Zapytaj GlobalNews AI',
    panelLabel: 'Zapytaj GlobalNews AI',
    close: 'Zamknij',
    inputLabel: 'Zadaj pytanie o wydarzenia na \u015bwiecie',
    inputPlaceholder: 'Co chcesz zrozumie\u0107?',
    submit: 'Zapytaj',
    idle: 'Zadaj pytanie, a odpowied\u017a zostanie zbudowana z pozyskanych materia\u0142\u00f3w, wraz ze wskazaniem \u017ar\u00f3de\u0142.',
    contextPending: 'Zapytaj o ten widok \u2014 wkr\u00f3tce',
    contextPendingHint: 'Pytanie o bie\u017c\u0105c\u0105 stron\u0119 nie jest jeszcze dost\u0119pne. Pytania s\u0105 tu odpowiadane wy\u0142\u0105cznie na podstawie pozyskanych materia\u0142\u00f3w.',
    contextChipAnchored: 'Pytanie o t\u0119 histori\u0119',
    contextChipGeneric: 'Pytanie o wydarzenia na \u015bwiecie',
    resultSourcesHeading: '\u0179r\u00f3d\u0142a',
    resultSourcesNone: 'Dla tego pytania nie pozyskano \u017cadnych \u017ar\u00f3de\u0142.',
    resultSourcesTruncated: 'Pokazano {shown} z {total}. Otw\u00f3rz pe\u0142n\u0105 analiz\u0119, aby zobaczy\u0107 reszt\u0119.',
    resultBriefAbsent: 'Ta analiza nie zawiera\u0142a streszczenia. To brak, a nie ocena \u2014 niczego nie zmierzono ani nie wstrzymano.',
    resultNoAnswer: 'Dla tego pytania nie powsta\u0142a odpowied\u017a. Stan powy\u017cej wyja\u015bnia dlaczego.',
    openFullAnalysis: 'Otw\u00f3rz pe\u0142n\u0105 analiz\u0119',
    telemetryReports: 'pozyskanych doniesie\u0144',
    telemetryClusters: 'grup doniesie\u0144',
  },
  loadingStages: [
    'Przeszukiwanie zaufanych źródeł\u2026',
    'Grupowanie powiązanych doniesień\u2026',
    'Porównywanie relacji\u2026',
    'Przygotowywanie analizy ze źródłami\u2026',
  ],
  analysisResultView: {
    /* C907 \u2014 patrz en.ts. */
    briefWithheldHeading: 'Streszczenie wykonawcze niedost\u0119pne',
    briefWithheldBody:
      'Streszczenie dla tego zestawu dowod\u00f3w nie spe\u0142ni\u0142o wymogu strukturalnego i zosta\u0142o wstrzymane, a nie pokazane. Wszystko poni\u017cej zweryfikowano niezale\u017cnie i pozostaje bez zmian.',
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
    aiInterpretedUnverified: 'LOKALIZACJA WG AI \u00b7 NIEZWERYFIKOWANA',
    countries: 'Kraje',
    locations: 'Miejsca',
    people: 'Osoby',
    organizations: 'Organizacje',
    topics: 'Tematy',
  },

  /* H2B — see en.ts. Application chrome only; analysis content is never translated here. */
  analysisWorkspace: {
    workspaceLabel: 'Przestrze\u0144 robocza analizy',
    indexLabel: 'Indeks analizy',
    navigatorLabel: 'Wymiary analizy',
    uncountable: '\u2014',
    showingPrefix: 'Wy\u015bwietlanie:',
    itemForms: ['pozycja', 'pozycje', 'pozycji'] as [string, string, string],
    noItemsInDimension: 'Brak pozycji w tym wymiarze dla tej analizy',
    /* J-2 — dwie r\u00f3\u017cne przyczyny pustego wymiaru. Zobacz en.ts. */
    noGroundedItemsInDimension: 'Brak ugruntowanych pozycji potwierdzonych przez bie\u017c\u0105ce materia\u0142y',
    nothingReportedInDimension: 'Bie\u017c\u0105ce materia\u0142y nic nie podaj\u0105 dla tego wymiaru',
    regionNotInThisBuild: 'Widok szczeg\u00f3\u0142owy tego wymiaru nie jest dost\u0119pny w tej wersji',
    fullAnalysisBelow:
      'Pe\u0142na analiza \u2014 wszystkie twierdzenia, cytowania i \u017ar\u00f3d\u0142a \u2014 znajduje si\u0119 poni\u017cej.',
    captions: {
      brief: 'Synteza AI dla tego pytania oraz sze\u015b\u0107 odpowiedzi orientacyjnych poni\u017cej.',
      dimension: 'Jeden wymiar analizy naraz. Wyb\u00f3r innego zast\u0119puje ten widok.',
    },
    dimensions: {
      brief: 'Streszczenie',
      significance: 'Znaczenie',
      whyThisMatters: 'Dlaczego to wa\u017cne',
      whoIsAffected: 'Kogo dotyczy',
      immediateEffects: 'Bezpo\u015brednie skutki',
      keyFacts: 'Kluczowe fakty',
      insufficientEvidence: 'Niewystarczaj\u0105ce dowody',
    },
    /* H2C — klaster telemetrii E-04/E-05/E-06. */
    telemetry: {
      evidenceLabel: 'Dowody',
      evidenceAriaPrefix: 'Siła dowodów',
      segmentsOf: 'z',
      evidenceLevels: {
        strong: 'Mocne',
        moderate: 'Umiarkowane',
        limited: 'Ograniczone',
        insufficient: 'Niewystarczające',
        unrated: 'Nieocenione',
      },
      trustDetails: 'Szczegóły dowodów',
      retrievalLabel: 'Pozyskiwanie',
      articleForms: ['artykuł', 'artykuły', 'artykułów'] as [
        string,
        string,
        string,
      ],
      clusterForms: [
        'klaster doniesień',
        'klastry doniesień',
        'klastrów doniesień',
      ] as [string, string, string],
      articlesShort: 'ART',
      clustersShort: 'KLA',
      across: 'w',
      noArticlesRetrieved: 'Nie pozyskano żadnych artykułów',
      retrievalDetails: 'Szczegóły pozyskiwania',
      sourcesLabel: 'Źródła',
      noSources: 'Brak źródeł',
      openSourcesPanel: 'Otwórz panel źródeł',
      evidenceUsedLabel: 'Wykorzystane dowody',
      evidenceUsedAria: 'Wykorzystane dowody: {n} odrębnych artykułów jest cytowanych w ugruntowanej analizie',
      noEvidenceUsed: 'Nieustalone',
    },
    /* H2C — E-09 i E-10. */
    brief: {
      aiInterpretation: 'Interpretacja AI',
      briefLabel: 'Streszczenie wykonawcze wygenerowane przez AI',
      /* C907 \u2014 patrz en.ts. */
      briefWithheldHeading: 'Streszczenie wykonawcze niedost\u0119pne',
      briefWithheldBody:
        'Streszczenie dla tego zestawu dowod\u00f3w nie spe\u0142ni\u0142o wymogu strukturalnego i zosta\u0142o wstrzymane, a nie pokazane. Nie ma to wp\u0142ywu na siatk\u0119 odpowiedzi ani na cytowane twierdzenia poni\u017cej.',
      expand: 'Pokaż pełne streszczenie',
      collapse: 'Pokaż mniej',
      generatedPrefix: 'Wygenerowano',
      notResolved: 'Nierozstrzygnięte przez tę analizę',
      opensPrefix: 'Otwiera',
      answerGridLabel: 'Odpowiedzi wykonawcze',
      cells: {
        whatHappened: 'Co się stało',
        where: 'Gdzie',
        whyItMatters: 'Dlaczego to ważne',
        whoIsAffected: 'Kogo dotyczy',
        evidence: 'Dowody',
        uncertain: 'Niepewne',
      },
      precision: {
        city: 'POZYSKANO DLA',
        country: 'POZYSKANO DLA',
        unresolved: 'LOKALIZACJA W DOWODACH \u00b7 NIEUSTALONA',
      },
      significanceLevels: {
        minor: 'Niewielka',
        moderate: 'Umiarkowana',
        major: 'Duża',
        critical: 'Krytyczna',
      },
      significanceLabel: 'Znaczenie',
      partyForms: ['podmiot', 'podmioty', 'podmiotów'] as [string, string, string],
      itemForms: ['pozycja', 'pozycje', 'pozycji'] as [string, string, string],
    },
    /* H2C — E-16 i E-17. */
    claim: {
      findingPrefix: 'ustalenie',
      findingOf: 'z',
      citedByPrefix: 'Cytowane przez',
      sourceForms: ['źródło', 'źródła', 'źródeł'] as [
        string,
        string,
        string,
      ],
      uncited: 'Bez cytowania',
      evidenceBasisLabel: 'Podstawa dowodowa z cytowanego źródła',
      showEvidenceBasis: 'Podstawa dowodowa',
      hideEvidenceBasis: 'Ukryj podstawę dowodową',
      sourcePrefix: 'Źródło',
      openInSourcesPanel: 'Otwórz w panelu źródeł.',
      unresolvedCitation: 'Nierozstrzygnięte cytowanie',
      partyTypes: {
        person: 'Osoba',
        organization: 'Organizacja',
        country: 'Kraj',
        region: 'Region',
        group: 'Grupa',
        other: 'Inne',
      },
    },
    /* H2C — E-22. */
    sources: {
      title: 'Źródła oryginalne',
      drawerLabel: 'Źródła oryginalne',
      close: 'Zamknij panel źródeł',
      supportsPrefix: 'Wspiera',
      notCited: 'Niecytowane w tej analizie',
      empty: 'Nie pozyskano źródeł dla tej analizy',
      noImage: 'Brak obrazu dla tego źródła',
      opensInNewTab: 'otwiera się w nowej karcie',
      retrievedPrefix: 'Pozyskano',
    },
    /* H2D — E-13. */
    geography: {
      moduleLabel: 'Wywiad geograficzny',
      precision: {
        city: 'POZYSKANO DLA',
        country: 'POZYSKANO DLA',
        unresolved: 'LOKALIZACJA W DOWODACH \u00b7 NIEUSTALONA',
      },
      noResolution: 'Brak rozstrzygnięcia geograficznego w dowodach',
      noSubnationalPrecision: 'Brak precyzji poniżej poziomu kraju w dowodach',
      resolvedFrom: 'Rozstrzygnięto na podstawie',
      mapModule: 'Moduł mapy · mapa świata GNAI',
      openWorldMap: 'Otwórz mapę świata',
    },
    /* H2D — E-24. */
    context: {
      heading: 'Kontekst',
      ariaLabel: 'Kontekst, interpretacja AI',
      show: 'Kontekst',
      hide: 'Ukryj kontekst',
    },
    /* H2D — E-25. */
    watchNext: {
      heading: 'Na co uważać',
      qualifier: 'Prognoza AI · to nie jest prognoza pewna',
      showAll: 'Pokaż wszystkie',
      showLess: 'Pokaż mniej',
      hingeTypes: {
        pending_response: 'Oczekiwana odpowiedź',
        scheduled_event: 'Zaplanowane wydarzenie',
        announced_action: 'Zapowiedziane działanie',
        deadline: 'Termin',
        forthcoming_report: 'Nadchodzący raport',
      },
    },
    /* H2D — E-26. */
    subViews: {
      viewsSuffix: 'widoki',
      viewOf: 'widok',
      reportedFacts: 'Fakty raportowane',
      agreements: 'Gdzie źródła są zgodne',
      differences: 'Gdzie źródła się różnią',
      reportedEffects: 'Raportowane skutki',
      spillover: 'Efekty uboczne',
      timeline: 'Oś czasu',
      affectedEntities: 'Podmioty dotknięte',
      relationships: 'Relacje',
      divergence: {
        aiProjected: 'Prognoza AI',
        sourcesDiverge: 'Źródła się różnią',
      },
      topic: 'Temat',
    },
    /* H2D — E-28. */
    timeline: {
      heading: 'Raportowana chronologia',
    },
    /* H2D — E-29. */
    relationships: {
      heading: 'Dowody relacyjne',
      eligibility: {
        supported: 'Żądany kierunek potwierdzony',
        unsupported: 'Żądany kierunek niepotwierdzony',
      },
      sufficiency: {
        adequate: 'Dowody wystarczające',
        limited: 'Dowody ograniczone',
        insufficient: 'Dowody niewystarczające',
      },
      buckets: {
        supporting: 'Wspiera żądany kierunek',
        reverse: 'Dowody w kierunku odwrotnym',
        associationOnly: 'Tylko powiązanie',
        mixed: 'Oceny są rozbieżne',
        unclearOrNonSubstantive: 'Niejasne lub nieistotne',
      },
      unresolvedReferences: 'Niektórych przywołanych twierdzeń nie udało się rozstrzygnąć',
    },
    /* H2D — pełny zapis analizy. */
    classicRecord: {
      show: 'Pełny zapis analizy',
      hide: 'Ukryj pełny zapis analizy',
      note: 'Wszystkie pola tej analizy, w tym te, których obszar roboczy jeszcze nie prezentuje.',
    },
  },
  /* M66.14B — see en.ts. Application chrome only; provider text is untranslated. */
  heroContext: {
    heading: 'KONTEKST WYWIADOWCZY',
    countryEvidence: 'DANE NA POZIOMIE KRAJU',
    articleEvidence: 'DANE NA POZIOMIE ARTYKUŁU',
    locationUnresolved: 'Nie ustalono lokalizacji',
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
    /** C907 — dwa dodatkowe stany pustego strumienia; patrz en.ts. */
    feedPanelEmptyHeading: 'Pusty strumie\u0144',
    feedPanelEmptyBody:
      'Pobieranie zako\u0144czone powodzeniem. W tym strumieniu nie ma obecnie \u017cadnych bie\u017c\u0105cych historii.',
    feedPanelDemoHeading: 'Tryb demo',
    feedPanelDemoBody:
      'U\u017cywane s\u0105 tre\u015bci przyk\u0142adowe. Nie jest tu raportowany \u017caden strumie\u0144 na \u017cywo.',
    feedPanelUnavailableHeading: 'Status źródła',
    feedPanelUnavailableBody: 'Transmisja na żywo tymczasowo niedostępna.',
    feedPanelUnavailableFooter: 'Wyszukiwanie i analiza krajów pozostają dostępne.',
    feedPanelSearchStatus: 'Analiza wyszukiwania',
    feedPanelCountryStatus: 'Analiza krajów',
    feedPanelMapStatus: 'Analiza mapy',
    feedPanelAvailable: 'Dostępne',
    /*
      STEP 5A - patrz en.ts. Rzeczownik uzgadnia sie z LICZBA CALKOWITA, wiec
      pluralWithForms otrzymuje total, nie liczbe dopasowan: '2 z 12 biezacych
      historii'. Nazwa kraju po dwukropku pozostaje w mianowniku, dzieki czemu
      nie wymaga odmiany.
    */
    feedPanelFocusLive: 'Na \u017cywo',
    feedPanelFocusOf: 'z',
    feedPanelFocusStoryForms: ['bie\u017c\u0105ca historia', 'bie\u017c\u0105ce historie', 'bie\u017c\u0105cych historii'] as [
      string,
      string,
      string,
    ],
    feedPanelFocusNone: '\u017badna z bie\u017c\u0105cych historii nie dotyczy kraju:',
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
    // R4 GDELT - prefixes an OBSERVED timestamp, so an aggregator's
    // index time is never presented as the outlet's publication time.
    seenPrefix: 'Zauważono',
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
  /* R2 — patrz en.ts. Nowa sekcja najwy\u017cszego poziomu; klucze musz\u0105 odpowiada\u0107 en.ts. */
  todayWorkspace: {
    geography: {
      /* DESIGN-C2 LOCK 8 — restored: the retrieval-context and browsing
         classes the accepted authority requires on this surface. */
      retrievalContext: 'W TYM POBRANIU: {n} KRAJ\u00d3W',
      viewing: 'PRZEGL\u0104DASZ: {country}',
      regionLabel: 'GEOGRAFIA',
      countryLevel: 'POZIOM KRAJU',
      schematicIndex: 'INDEKS SCHEMATYCZNY \u00b7 NIE WSP\u00d3\u0141RZ\u0118DNE',
      countryOutlines: 'ZARYSY KRAJ\u00d3W \u00b7 NIE DOK\u0141ADNIEJ NI\u017b KRAJ',
      countryPrecision: 'KRAJ',
      openWorldMap: 'OTW\u00d3RZ MAP\u0118 \u015aWIATA',
      worldMapCompact: 'MAPA \u015aWIATA',
      noneResolved: 'Nie ustalono kraju w tym pobraniu',
      unresolvedLabel: 'Nie ustalono kraju',
      unresolvedNote: 'Brak oznacza, \u017ce nie wiemy \u2014 nigdy, \u017ce historia jest znik\u0105d.',
    },
    header: {
      regionLabel: 'DZISIAJ',
      question: 'Co GlobalNews AI zaobserwował dziś po raz pierwszy?',
      retrievedLabel: 'POBRANE',
      countriesLabel: 'KRAJE',
      unresolvedLabel: 'BEZ KRAJU',
      watchingLabel: 'OBSERWUJESZ',
      newLabel: 'NOWE',
      biasNote: 'Te liczby opisują to pobranie, a nie wszystko, co się wydarzyło.',
      collapse: 'Zwiń nagłówek Dzisiaj',
      expand: 'Rozwiń nagłówek Dzisiaj',
    },
    analyse: {
      regionLabel: 'ANALIZA',
      chipUnresolved: 'BEZ KRAJU',
      firstSeen: 'PIERWSZY RAZ',
      expandRow: 'Rozwiń ten rekord',
      collapseRow: 'Zwiń ten rekord',
      analyse: 'ANALIZUJ',
      analyseStory: 'Przeanalizuj tę historię',
      resolvedToCountry: 'Kraj ustalony na podstawie treści artykułu',
      whereUnresolved: 'Nie ustalono kraju',
      unresolvedNotPlaced: 'Brak oznacza, \u017ce nie wiemy \u2014 nigdy, \u017ce historia jest znik\u0105d.',
      empty:
        'To pobranie nie zawiera żadnego artykułu, który GlobalNews AI zobaczył dziś po raz pierwszy. To stwierdzenie o naszym pobraniu, a nie o świecie.',
      filteredEmpty: 'Dla tego kraju nic dziś nie pobrano.',
      clearFilter: 'Wyczyść filtr kraju',
    },
    watch: {
      regionLabel: 'OBSERWACJA',
      loading: 'Wczytywanie \u015bledzonych kraj\u00f3w\u2026',
      markAllSeen: 'OZNACZ WSZYSTKO JAKO WIDZIANE',
      newTag: 'NOWE',
      zeroRetrieved: 'Dla tego kraju nic dziś nie pobrano.',
      missedSince: 'zaobserwowano od Twojej ostatniej wizyty',
      nothingSince: 'Nic nie zaobserwowano od Twojej ostatniej wizyty',
      followedHeading: 'Dzisiejsza analiza z krajów, które śledzisz',
      signIn: 'Zaloguj się',
      anonymousCompact: 'Zaloguj się, aby śledzić kraje i widzieć, co Cię ominęło.',
      anonymous:
        'Śledzenie kraju wymaga konta. Zaloguj się, a Obserwacja pokaże, co GlobalNews AI zaobserwuje tam po raz pierwszy.',
      empty:
        'Zacznij śledzić kraj, a Obserwacja pokaże, co GlobalNews AI zaobserwuje tam po raz pierwszy.',
    },
    dock: {
      label: 'POBRANE ARTYKUŁY',
      expand: 'Pokaż pobrane artykuły',
      collapse: 'Ukryj pobrane artykuły',
      openOriginal: 'OTWÓRZ ORYGINAŁ',
      retrievalNote:
        'Jeden pobrany artykuł. Liczba pobrań to nie potwierdzenie przez inne źródła.',
      noneSelected: 'Otwórz rekord, aby zobaczyć artykuł, z którego go pobrano.',
    },
    cta: {
      open: 'OTWÓRZ PRZESTRZEŃ ANALIZY',
      description: 'Zadaj pytanie i uruchom pełną analizę.',
    },
    tabs: {
      label: 'Sekcje Dzisiaj',
      analyse: 'ANALIZA',
      geography: 'GEOGRAFIA',
      watch: 'OBSERWACJA',
    },
  },
  presentationRibbon: {
    labels: {
      what: 'CO SIĘ STAŁO',
      where: 'GDZIE',
      why: 'DLACZEGO TO WAŻNE',
      who: 'KOGO DOTYCZY',
      evidence: 'DOWODY',
    },
    viewSources: 'POKAŻ ŹRÓDŁA',
    showSources: 'POKAŻ ORYGINALNE ŹRÓDŁA',
    deepAnalysis: 'PEŁNA ANALIZA',
    unavailable: '\u2014 niedostępne w tej analizie',
    evidenceSupport: 'Poparcie dowodowe',
    ofThree: 'z 3',
  },
  today: {
    eyebrow: 'Dzisiaj',
    heading: 'Dzisiejsza analiza',
    summaryAcross: 'w',
    summaryUnresolvedSuffix: 'bez ustalonego kraju',
    recordForms: ['artyku\u0142 zaobserwowany dzi\u015b po raz pierwszy', 'artyku\u0142y zaobserwowane dzi\u015b po raz pierwszy', 'artyku\u0142\u00f3w zaobserwowanych dzi\u015b po raz pierwszy'] as [string, string, string],
    countryForms: ['kraju', 'krajach', 'krajach'] as [string, string, string],
    counterRecordsLabel: 'Artyku\u0142y, kt\u00f3re GlobalNews AI zobaczy\u0142 dzi\u015b po raz pierwszy, w tym pobraniu',
    counterCountriesLabel: 'Kraje reprezentowane w tym pobraniu',
    biasNote:
      'Te liczby odzwierciedlaj\u0105 to, co pobra\u0142 GlobalNews AI, a nie wszystko, co si\u0119 wydarzy\u0142o.',
    contractMetricLabel: 'Miara',
    contractMetricValue: 'artyku\u0142y zaobserwowane po raz pierwszy',
    contractUnitLabel: 'Jednostka',
    contractUnitValue: 'liczba bezwzgl\u0119dna',
    contractGeographyLabel: 'Geografia',
    contractGeographyValue: 'kraj',
    contractPeriodLabel: 'Okres',
    contractBasisLabel: 'Podstawa',
    contractBasisValue: 'artyku\u0142y pobrane w tej odpowiedzi',
    contractUpdatedLabel: 'Aktualizacja',
    contractCoverageLabel: 'Pokrycie',
    contractCoverageValue: 'nie zmierzono',
    countryCountForms: ['kraj', 'kraje', 'kraj\u00f3w'] as [string, string, string],
    unresolvedShort: 'nieustalone',
    geoSummaryLink: 'Przejd\u017a do zestawienia kraj\u00f3w',
    geoSectionLabel: 'Zestawienie kraj\u00f3w',
    geoValuesToggleAria: 'Poka\u017c warto\u015bci stoj\u0105ce za t\u0105 list\u0105',
    geoHeading: 'Kraje w tym pobraniu',
    geoQuestion: 'Z jakich kraj\u00f3w pochodz\u0105 artyku\u0142y zobaczone dzi\u015b po raz pierwszy?',
    filterAll: 'Wszystkie kraje',
    unresolvedLabel: 'Nie ustalono kraju',
    unresolvedNote: 'Brak oznacza, \u017ce nie wiemy \u2014 nigdy, \u017ce historia jest znik\u0105d.',
    openWorldMap: 'Otw\u00f3rz map\u0119 \u015bwiata',
    showValues: 'Poka\u017c warto\u015bci',
    hideValues: 'Ukryj warto\u015bci',
    tableCaption: 'Artyku\u0142y zaobserwowane dzi\u015b po raz pierwszy, wed\u0142ug kraju',
    tableCountryHeading: 'Kraj',
    tableCountHeading: 'Artyku\u0142y',
    firstSeenLabel: 'Pierwsza obserwacja',
    publishedLabel: 'Opublikowano',
    publishedProviderNote: 'wed\u0142ug dostawcy',
    analyse: 'Analizuj',
    analyseAriaPrefix: 'Przeanalizuj t\u0119 histori\u0119:',
    readStoryPrefix: 'Przeczytaj pe\u0142n\u0105 histori\u0119:',
    watchHeading: 'Obserwacja',
    watchQuestion: 'Co GlobalNews AI zaobserwowa\u0142 dzi\u015b po raz pierwszy w krajach, kt\u00f3re \u015bledzisz?',
    watchReading: 'Wczytywanie \u015bledzonych kraj\u00f3w\u2026',
    watchAnonymous:
      '\u015aledzenie kraju wymaga konta. Zaloguj si\u0119, a Obserwacja poka\u017ce, co GlobalNews AI zaobserwuje tam po raz pierwszy.',
    watchSignIn: 'Zaloguj si\u0119',
    watchNoFollows:
      'Zacznij \u015bledzi\u0107 kraj, a Obserwacja poka\u017ce, co GlobalNews AI zaobserwuje tam po raz pierwszy. Przycisk \u015bledzenia znajduje si\u0119 obok ka\u017cdego kraju na li\u015bcie poni\u017cej.',
    watchFollowedForms: ['\u015bledzony kraj', '\u015bledzone kraje', '\u015bledzonych kraj\u00f3w'] as [string, string, string],
    watchCapacityOf: 'z maksymalnie',
    watchZeroRecords: 'Dla tego kraju nic dzi\u015b nie pobrano.',
    watchAtLimit:
      '\u015aledzisz ju\u017c tyle kraj\u00f3w, ile mo\u017ce \u015bledzi\u0107 jedno konto. Przesta\u0144 \u015bledzi\u0107 jeden, aby doda\u0107 kolejny.',
    watchUnresolvedNote:
      'dzisiejszych zapis\u00f3w nie uda\u0142o si\u0119 przypisa\u0107 do \u017cadnego kraju, wi\u0119c nie mog\u0105 si\u0119 tu pojawi\u0107.',
    watchNothingRetrieved:
      'To pobranie nie dotar\u0142o dzi\u015b do \u017cadnego z Twoich kraj\u00f3w. To stwierdzenie o naszym pobraniu, a nie o tych krajach.',
    watchFollow: '\u015aled\u017a',
    watchFollowing: '\u015aledzone',
    watchUnfollow: 'Przesta\u0144 \u015bledzi\u0107',
    watchPending: 'Zapisywanie\u2026',
    watchFailed: 'Nie zapisano',
    watchFollowAria: 'Zacznij \u015bledzi\u0107',
    watchUnfollowAria: 'Przesta\u0144 \u015bledzi\u0107',
    emptyHeading: 'Dzi\u015b nic nie zaobserwowano po raz pierwszy',
    emptyBody:
      'To pobranie nie zawiera artyku\u0142u, kt\u00f3ry GlobalNews AI zobaczy\u0142 dzi\u015b po raz pierwszy. To stwierdzenie o naszym pobraniu, a nie o \u015bwiecie.',
    degradedHeading: 'Brak zapisu pierwszej obserwacji',
    degradedBody:
      'GlobalNews AI nie zapisa\u0142 pierwszej obserwacji dla artyku\u0142\u00f3w w tym pobraniu, wi\u0119c nie mo\u017cna dla nich ustali\u0107 dzisiejszej daty. Same artyku\u0142y pozostaj\u0105 dost\u0119pne powy\u017cej.',
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
      Help: 'Pomoc',
    } as Record<string, string>,
    /* SUPPORT CLOSURE — patrz komentarz przy tym kluczu w en.ts. */
    navigationAriaLabel: 'Linki w stopce',
    linkLabels: {
      '/support': 'Pomoc i wsparcie',
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
    /* R4 HEADER ACCOUNT PRIVACY — patrz komentarz przy tych kluczach w en.ts. */
    account: 'Konto',
    accountMenuAriaLabel: 'Menu konta',
    signedInAs: 'Zalogowano jako',
    // Milestone #57 — Optional Accounts.
    history: 'Historia',
    /* SUPPORT CLOSURE — patrz komentarz przy tych kluczach w en.ts. */
    help: 'Pomoc i wsparcie',
    support: 'Pomoc',
    settings: 'Ustawienia',
    signOut: 'Wyloguj się',
    deleteAccount: 'Usuń konto',
    deleteAccountConfirm:
      'Usunąć konto? Spowoduje to trwałe usunięcie konta i powiązanych z nim danych \u2014 zapisanej historii, obserwowanych krajów, zgłoszeń do pomocy wraz z wiadomościami oraz aktywnych sesji. Tej operacji nie można cofnąć.',
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
      analyseCountry: 'Przeanalizuj ten kraj',
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
    shell: {
      regionLabel: 'Mapa \u015bwiata',
      canvasLabel: 'Interaktywna mapa \u015bwiata',
      controlsLabel: 'Sterowanie kamerą mapy',
      /* D1 §3d — the lower-left cluster. Three distinct controls, three keys:
         a shared label would be the merge the specification forbids. */
      lowerLeftControlsLabel: 'Sterowanie mapą',
      globeLocator: 'Globalna pozycja kamery',
      goGlobal: 'Wróć do widoku globalnego',
      layersTitle: 'Warstwy',
      threeD: 'Widok 3D',
      threeDUnavailable: 'Dla tego wdrożenia nie skonfigurowano źródła terenu',
      layerStatusLive: 'Dostępna',
      layerStatusGated: 'Jeszcze niedostępna',
      layerStatusNotImplemented: 'Niezbudowana',
      layerStatusUnmeasured: 'Niezweryfikowana',
      interactionHint:
        'Przeci\u0105gnij lub u\u017cyj strza\u0142ek, aby przesun\u0105\u0107 map\u0119. Przewi\u0144, u\u017cyj gestu szczypania albo naci\u015bnij plus lub minus, aby przybli\u017cy\u0107. Naci\u015bnij 0, aby wr\u00f3ci\u0107 do widoku \u015bwiata, lub Backspace, aby wr\u00f3ci\u0107 do poprzedniego widoku.',
      resetWorld: 'Widok \u015bwiata',
      previousView: 'Poprzedni widok',
      zoomIn: 'Przybli\u017c',
      zoomOut: 'Oddal',
      precisionCountry: 'Poziom kraju',
      precisionUnresolved: 'Nie ustalono lokalizacji',
    },
    spatial: {
      /*
        NIE T\u0141UMACZONE. To jest nota licencyjna CC BY 4.0, a nie tekst
        interfejsu \u2014 przet\u0142umaczona nota nie jest not\u0105, o kt\u00f3r\u0105 prosi licencja.
      */
      attribution:
        'Contains data from the GeoNames geographical database, licensed CC BY 4.0. Subdivision data from iso3166-2-db (MIT). Base geography: Natural Earth, public domain.',
      railLabel: 'Panel wywiadowczy',
      resetEvidence: 'Poka\u017c wszystkie dowody',
      topBar: {
        brand: 'GlobalNews AI',
        brandSub: 'Inteligencja przestrzenna',
        brandHome: 'powr\u00f3t do GlobalNews AI',
        languageGroup: 'Język',
        periodGroup: 'Zakres czasu',
        periods: { NOW: 'Teraz', '24H': '24h', '7D': '7d', '30D': '30d' },
      },
      modes: {
        group: 'Tryb mapy',
        modes: {
          WORLD: '\u015awiat',
          EVIDENCE: 'Dowody',
          SITUATIONS: 'Sytuacje',
          WATCH: 'Obserwowane',
          CHANGE: 'Zmiany',
          SOURCES: '\u0179r\u00f3d\u0142a',
        },
        unavailable: 'Niedost\u0119pne',
        /* CHECKPOINT E — five distinct reasons. See en.ts for why. */
        unavailableReasons: {
          NOT_BUILT: 'Jeszcze nie zbudowane',
          NOT_CONNECTED: 'Zbudowane, ale jeszcze niepod\u0142\u0105czone do mapy',
          NO_DATA_FOR_GEOGRAPHY: 'Brak danych dla tej geografii',
          TIER_RESTRICTED: 'Nieobj\u0119te Twoim dost\u0119pem',
          TEMPORARILY_UNAVAILABLE: 'Tymczasowo niedost\u0119pne',
        },
        beta: 'Beta',
      },
      layers: {
        group: 'Warstwy mapy',
        reference: 'Odniesienie',
        evidence: 'Dowody',
        unavailable: 'Brak danych',
        unavailableReasons: {
          NOT_BUILT: 'Jeszcze nie zbudowane',
          NOT_CONNECTED: 'Zbudowane, ale jeszcze niepod\u0142\u0105czone do mapy',
          NO_DATA_FOR_GEOGRAPHY: 'Brak danych dla tej geografii',
          TIER_RESTRICTED: 'Nieobj\u0119te Twoim dost\u0119pem',
          TEMPORARILY_UNAVAILABLE: 'Tymczasowo niedost\u0119pne',
        },
        notInMode: 'Nie pokazywane w tym trybie',
        outOfRange: 'Nie przy tym przybli\u017ceniu',
        layers: {
          base: 'L\u0105d i ocean',
          admin0: 'Granice pa\u0144stw',
          hydrography: 'Jeziora i morza',
          rivers: 'Rzeki',
          places: 'Miasta',
          labels: 'Etykiety',
          graticule: 'Siatka wsp\u00f3\u0142rz\u0119dnych',
          countryEvidence: 'Dowody krajowe',
          evidencePoints: 'Punkty dowodowe',
          watch: 'Obserwowane miejsca',
          sourceDensity: 'G\u0119sto\u015b\u0107 \u017ar\u00f3de\u0142',
          situations: 'Sytuacje',
          admin1: 'Wojew\u00f3dztwa',
          admin2: 'Powiaty',
        },
      },
      continents: {
        africa: 'Afryka', europe: 'Europa', asia: 'Azja',
        northAmerica: 'Ameryka P\u00f3\u0142nocna', southAmerica: 'Ameryka Po\u0142udniowa', oceania: 'Oceania',
      },
      waters: {
        atlantic: 'Ocean Atlantycki', pacific: 'Ocean Spokojny', indian: 'Ocean Indyjski',
        arctic: 'Ocean Arktyczny', southernOcean: 'Ocean Po\u0142udniowy',
        mediterranean: 'Morze \u015ar\u00f3dziemne', baltic: 'Morze Ba\u0142tyckie', redSea: 'Morze Czerwone',
        blackSea: 'Morze Czarne', caribbean: 'Morze Karaibskie', northSea: 'Morze P\u00f3\u0142nocne',
        gulfOfGuinea: 'Zatoka Gwinejska', arabianSea: 'Morze Arabskie',
        bayOfBengal: 'Zatoka Bengalska', southChinaSea: 'Morze Po\u0142udniowochi\u0144skie',
      },
      territories: { greenland: 'Grenlandia' },
      readout: {
        /* Skr\u00f3ty odczytu diagnostycznego pozostaj\u0105 techniczne i nieprzet\u0142umaczone. */
        zoom: 'Z',
        centre: 'CTR',
        mode: 'TRYB',
        modes: {
          WORLD: '\u015aWIAT', EVIDENCE: 'DOWODY', SITUATIONS: 'SYTUACJE',
          WATCH: 'OBSERW.', CHANGE: 'ZMIANY', SOURCES: '\u0179R\u00d3D\u0141A',
        },
        periods: { NOW: 'TERAZ', '24H': '24H', '7D': '7D', '30D': '30D' },
      },
      legend: {
        heading: 'Gramatyka dowod\u00f3w',
        collapse: 'Zwi\u0144 legend\u0119',
        expand: 'Rozwi\u0144 legend\u0119',
        entries: {
          verified: 'Dowody potwierdzone',
          attention: 'Uwaga i zmiany',
          interpreted: 'Interpretowane lub sporne',
          none: 'Brak zachowanych dowod\u00f3w',
          reference: 'Geografia odniesienia',
        },
      },
      search: {
        label: 'Szukaj miejsca',
        placeholder: 'Szukaj miejsc, miast i region\u00f3w',
        resultsLabel: 'Wyniki wyszukiwania',
        noResults: '\u017badne miejsce nie pasuje do tej nazwy',
        coverageNote: 'Regiony, kraje, wojew\u00f3dztwa, powiaty i miasta',
        searching: 'Przeszukiwanie s\u0142ownika geograficznego\u2026',
        reference: 'Odniesienie',
        reports: 'doniesie\u0144',
        inCountry: 'w',
        kinds: {
          COUNTRY: 'Kraj',
          REGION: 'Region',
          CITY: 'Miasto',
          WATER: 'Akwen',
          SITUATION: 'Sytuacja',
        },
      },
      breadcrumbs: {
        group: 'Skala i szybkie przej\u015bcia',
        scaleLabel: 'Aktualna skala mapy',
        jumpsLabel: 'Przejd\u017a do regionu',
        rungs: {
          WORLD: '\u015awiat',
          CONTINENT: 'Kontynent',
          SUBREGION: 'Subregion',
          COUNTRY: 'Kraj',
          CITY: 'Miasto',
        },
        targets: {
          world: '\u015awiat',
          africa: 'Afryka',
          eastAfrica: 'Afryka Wschodnia',
          europe: 'Europa',
          rwanda: 'Rwanda',
          kenya: 'Kenia',
          poland: 'Polska',
          kigali: 'Kigali',
        },
      },
      banner: {
        levels: {
          EXACT: 'Dok\u0142adna lokalizacja',
          CITY: 'Poziom miasta',
          SECTOR: 'Poziom sektora',
          DISTRICT: 'Poziom powiatu',
          PROVINCE: 'Poziom wojew\u00f3dztwa',
          COUNTRY: 'Poziom kraju',
          REGION: 'Poziom ponadnarodowy',
          UNKNOWN: 'Brak ustalonej lokalizacji',
          NONE: 'Nie pokazano dowod\u00f3w',
        },
        interpreted: 'lokalizacja zinterpretowana, niepotwierdzona',
        contested: '\u017ar\u00f3d\u0142a podaj\u0105 sprzeczne miejsca',
        referencePrefix: 'Pu\u0142ap geografii odniesienia:',
        governingRule: 'Przybli\u017cenie pokazuje wi\u0119cej \u015bwiata. Nigdy nie pokazuje wi\u0119cej dowod\u00f3w.',
        coarserThanEvidence: 'rysowane zgrubniej ni\u017c zapis',
      },
      callout: {
        close: 'Zamknij ten dymek',
        actionUnavailable: 'Jeszcze niepod\u0142\u0105czone na tej powierzchni',
        focus: 'Skup',
        analysis: 'Analiza',
        sources: '\u017ar\u00f3d\u0142a',
      },
      card: {
        heading: 'Wybrany obszar',
        scope: 'Dowody',
        watching: 'Obserwowane',
        stateHeading: 'Stan dowod\u00f3w',
        ceilingNote: 'To poziom, kt\u00f3ry potwierdzaj\u0105 dowody. Wszystko dok\u0142adniejsze na mapie to geografia odniesienia.',
        reports: 'Doniesienia',
        sources: '\u0179r\u00f3d\u0142a',
        newSince: 'Nowe od ostatniej wizyty',
        precisionLabel: 'Precyzja',
        provenanceLabel: 'Pochodzenie lokalizacji',
        provenanceValues: {
          STATED: 'Podana przez \u017ar\u00f3d\u0142o',
          INTERPRETED: 'Zinterpretowana \u2014 niepotwierdzona',
          CONTESTED: 'Sporna mi\u0119dzy \u017ar\u00f3d\u0142ami',
        },
        levels: {
          EXACT: 'Dok\u0142adna lokalizacja',
          CITY: 'Miasto',
          SECTOR: 'Sektor',
          DISTRICT: 'Powiat',
          PROVINCE: 'Wojew\u00f3dztwo',
          COUNTRY: 'Kraj',
          REGION: 'Region ponadnarodowy',
          UNKNOWN: 'Nieustalona',
          NONE: 'Brak',
        },
        verifiedReports: 'Doniesienia potwierdzone',
        unverifiedQualifier: 'cz\u0119\u015b\u0107 niepotwierdzona',
        noEvidenceTitle: 'Brak zachowanych dowod\u00f3w dla tego obszaru',
        noEvidenceBody: 'W wybranym okresie nie zachowano tu niczego:',
        widenPeriod: 'Poszerz okres',
        periods: {
          NOW: 'ostatnia godzina',
          '24H': 'ostatnie 24 godziny',
          '7D': 'ostatnie 7 dni',
          '30D': 'ostatnie 30 dni',
        },
        drawnCoarser:
          'Ten zapis wskazuje lokalizacj\u0119 dok\u0142adniejsz\u0105 ni\u017c mapa potrafi obecnie narysowa\u0107 \u2014 geografia wojew\u00f3dztw i powiat\u00f3w nie jest jeszcze wczytana.',
        actions: {
          focus: 'Wykadruj dowody',
          follow: 'Obserwuj',
          unfollow: 'Przesta\u0144 obserwowa\u0107',
          openAnalysis: 'Otw\u00f3rz analiz\u0119',
          openSources: 'Otw\u00f3rz \u017ar\u00f3d\u0142a',
        },
        /* ── DESIGN REVISION 1.2 · THE RESTORED SELECTED-COUNTRY BLOCKS ─── */
        identityHeading: 'To\u017csamo\u015b\u0107',
        provider: {
          live: 'Kana\u0142 na \u017cywo',
          delayed: 'Kana\u0142 op\u00f3\u017aniony',
          none: 'Brak skonfigurowanego dostawcy',
          stored: 'zapisane doniesienia',
        },
        coverage: {
          heading: 'Zasi\u0119g',
          bands: {
            STRONG: 'Silny zasi\u0119g',
            MODERATE: 'Umiarkowany zasi\u0119g',
            THIN: 'S\u0142aby zasi\u0119g',
            NONE: 'Brak zasi\u0119gu',
          },
          flags: { AGING: 'Starzeje si\u0119', STALE: 'Nieaktualne' },
          publishers: 'wydawc\u00f3w',
          newest: 'najnowsze',
          seenPrefix: 'zauwa\u017cone',
          publishedPrefix: 'opublikowane',
        },
        categoriesHeading: 'Kategorie',
        allCategories: 'Wszystkie kategorie',
        categories: {
          world: '\u015awiat',
          politics: 'Polityka',
          business: 'Biznes',
          technology: 'Technologia',
          science: 'Nauka',
          health: 'Zdrowie',
          sports: 'Sport',
          entertainment: 'Kultura',
        },
        situationsHeading: 'Sytuacje',
        situationsUnavailable:
          'Model sytuacji nie zosta\u0142 jeszcze zbudowany, wi\u0119c to nie znaczy \u201ebrak sytuacji\u201d \u2014 to funkcja, kt\u00f3ra nie potrafi jeszcze odpowiedzie\u0107 na to pytanie.',
        retainedHeading: 'Zachowane doniesienia',
        retainedFilteredEmpty: 'Brak zachowanych doniesie\u0144 w wybranych kategoriach.',
        openSource: 'Otw\u00f3rz \u017ar\u00f3d\u0142o w nowej karcie',
        askAbout: 'Zapytaj GlobalNews AI o to',
        /* CHECKPOINT D — the visible name of the AI action. See en.ts. */
        askAiShort: 'Zapytaj AI',
        topicsHeading: 'Tematy',
        clearSelection: 'Wyczy\u015b\u0107 wyb\u00f3r',
        follow: {
          follow: 'Obserwuj ten kraj',
          watching: 'Obserwujesz',
          stopWatching: 'Przesta\u0144 obserwowa\u0107',
          pending: 'Zapisywanie\u2026',
          failed: 'Nie zapisano obserwacji \u2014 nic si\u0119 nie zmieni\u0142o',
          signIn: 'Zaloguj si\u0119, aby obserwowa\u0107',
        },
      },
      mobile: {
        shellLabel: 'Mapa \u015bwiata i informacje o miejscu',
        mapLabel: 'Mapa \u015bwiata. Przeci\u0105gnij, aby przesun\u0105\u0107, zbli\u017c palce, aby powi\u0119kszy\u0107, dotknij kraju, aby go wybra\u0107.',
        mapHint: 'Przeci\u0105gnij, aby przesun\u0105\u0107 map\u0119. Zbli\u017c palce, aby powi\u0119kszy\u0107. Dotknij kraju, aby go wybra\u0107.',
        sheetLabel: 'Informacje o miejscu',
        handleLabel: 'Zmie\u0144 rozmiar panelu informacji',
        stops: { PEEK: 'Podgl\u0105d', HALF: 'Po\u0142owa', FULL: 'Pe\u0142ny' },
        noSelection: 'Wyszukaj miejsce powy\u017cej lub dotknij kraju na mapie, aby zobaczy\u0107, co jest tam zachowane.',
        clearSelection: 'Wyczy\u015b\u0107 wyb\u00f3r',
        searchAlternative: 'Kraj mo\u017cesz te\u017c znale\u017a\u0107, wpisuj\u0105c jego nazw\u0119 w polu wyszukiwania powy\u017cej; mapa nie jest jedyn\u0105 drog\u0105.',
        a11yNote: 'Interaktywna mapa \u015bwiata wype\u0142nia ten ekran. Przeci\u0105gnij, aby przesun\u0105\u0107, zbli\u017c palce, aby powi\u0119kszy\u0107, dotknij kraju, aby go wybra\u0107. Nie musisz jej u\u017cywa\u0107 \u2014 pole wyszukiwania znajdzie i wybierze ka\u017cdy obs\u0142ugiwany kraj po nazwie, z pe\u0142n\u0105 obs\u0142ug\u0105 klawiatury.',
      },
      monetization: {
        watch: {
          glyph: 'Obserwuj ten temat',
          watch: 'Obserwuj',
          description:
            'Stale oceniaj ten temat i informuj, gdy ocena istotnie si\u0119 zmieni.',
        },
        composer: {
          title: 'Kreator obserwacji',
          scope: 'Zakres',
          ceiling: 'W\u0142asny pu\u0142ap precyzji tego ogniwa',
          topics: 'Monitorowane tematy',
          topicOptions: {
            supply: 'Dostawy',
            pricing: 'Ceny',
            logistics: 'Logistyka',
            policy: 'Polityka',
            security: 'Bezpiecze\u0144stwo',
            infrastructure: 'Infrastruktura',
          },
          sensitivity: 'Czu\u0142o\u015b\u0107 powiadomie\u0144',
          sensitivities: {
            CRITICAL_ONLY: 'Tylko krytyczne',
            MATERIAL_ONLY: 'Tylko istotne zmiany',
            ALL_MEANINGFUL: 'Wszystkie znacz\u0105ce zmiany',
            CUSTOM_THRESHOLD: 'W\u0142asny pr\u00f3g',
          },
          sensitivityHint: {
            CRITICAL_ONLY: 'Tylko przej\u015bcia o krytycznej wadze.',
            MATERIAL_ONLY: 'Tylko istotna zmiana. Ustawienie domy\u015blne.',
            ALL_MEANINGFUL: 'Tak\u017ce nowe dowody, sytuacje rozwojowe i spory.',
            CUSTOM_THRESHOLD: 'Ustaw w\u0142asne progi.',
          },
          runRecord: 'Zapis dzia\u0142ania',
          lastChecked: 'Ostatnie sprawdzenie',
          lastChange: 'Ostatnia istotna zmiana',
          cadence: 'Cz\u0119stotliwo\u015b\u0107',
          evidence: 'Dowody',
          neverRun: '\u2014',
          degradedNote:
            'Ta obserwacja nigdy nie zosta\u0142a uruchomiona, wi\u0119c nie ma jeszcze zapisu. Obserwacja, kt\u00f3ra nie potrafi poda\u0107 czasu ostatniego sprawdzenia, jest pokazywana jako niekompletna, a nie jako pewna.',
          instMark: 'INST',
          capabilityNote: 'Limity planu nie s\u0105 skonfigurowane, wi\u0119c \u017cadne nie s\u0105 pokazywane',
          notPersisted:
            'Nic z tego, co tu z\u0142o\u017cysz, nie jest jeszcze zapisywane. Monitorowanie nie dzia\u0142a, wi\u0119c jest to podgl\u0105d zlecenia, a nie zlecenie zapisane.',
          chainLimitNote: 'D\u0142u\u017csze \u0142a\u0144cuchy wymagaj\u0105 wy\u017cszego planu',
          review: 'Przejrzyj to zlecenie',
          removeLink: 'Usu\u0144',
        },
        activation: {
          title: 'Rozpocznij monitorowanie',
          assignmentSentence:
            'GlobalNews AI b\u0119dzie ocenia\u0107: {subjects} \u2014 {cadence} \u2014 i poinformuje Ci\u0119, gdy ocena istotnie si\u0119 zmieni.',
          and: 'oraz',
          cadenceValue: 'co 15 minut',
          sensitivityLine: 'Powiadomienia dla',
          unavailableTitle: 'Monitorowanie nie mo\u017ce si\u0119 jeszcze rozpocz\u0105\u0107',
          unavailableBody:
            'Nie skonfigurowano umowy aktywacji ani uprawnie\u0144 dla monitorowania, wi\u0119c nic tutaj nie mo\u017ce zosta\u0107 aktywowane ani rozliczone. Zlecenie powy\u017cej jest prawdziwe \u2014 to w\u0142a\u015bnie by\u0142oby monitorowane.',
          signedOutTitle: 'Zaloguj si\u0119, aby zachowa\u0107 zlecenie',
          signedOutBody:
            'Tworzenie jest bezp\u0142atne i nie wymaga konta. Zachowanie zlecenia tak, a aktywacja i tak nie jest jeszcze skonfigurowana.',
          signIn: 'Zaloguj si\u0119',
          followInstead: 'Zamiast tego obserwuj w kanale \u2014 bezp\u0142atnie',
          dismiss: 'Wr\u00f3\u0107 do sytuacji',
          capabilityNote: 'Nie skonfigurowano planu ani ceny, wi\u0119c \u017caden nie jest pokazywany',
        },
        changeStrip: {
          label: 'Zmiany w widoku',
          states: {
            NEW: 'Nowe',
            NEW_EVIDENCE: 'Nowe dowody',
            SIGNIFICANT_CHANGE: 'Istotne',
            DEVELOPING: 'Rozwojowe',
            DISPUTED: 'Sporne',
            STABLE: 'Stabilne',
            NO_MATERIAL_CHANGE: 'Bez istotnej zmiany',
          },
          ringsSuppressed: 'Pier\u015bcienie ukryte w tej skali',
          noChange: 'Nic nowego',
        },
        watchboard: {
          title: 'Moje obserwacje',
          tabMine: 'Moje',
          onMap: 'Na mapie',
          states: {
            NEW: 'Nowe',
            NEW_EVIDENCE: 'Nowe dowody',
            SIGNIFICANT_CHANGE: 'Istotne',
            DEVELOPING: 'Rozwojowe',
            DISPUTED: 'Sporne',
            STABLE: 'Stabilne',
            NO_MATERIAL_CHANGE: 'Bez istotnej zmiany',
          },
          emptyTitle: 'Nic nie jest jeszcze monitorowane',
          emptyBody:
            'Monitorowanie nie zosta\u0142o uruchomione. Gdy obserwacja zadzia\u0142a, ka\u017cde sprawdzenie pojawi si\u0119 tutaj \u2014 tak\u017ce te, kt\u00f3re nic nie znalaz\u0142y, poniewa\u017c dowodz\u0105 wykonanej pracy.',
          signedOutBody:
            'Tworzenie obserwacji jest bezp\u0142atne i nie wymaga konta. Zachowanie jej tak, a aktywacja i tak nie jest jeszcze skonfigurowana.',
          checked: 'Sprawdzono',
          ceiling: 'Pu\u0142ap',
        },
        timeline: {
          title: 'Jak to si\u0119 zmienia\u0142o',
          openLabel: 'Otw\u00f3rz',
          countLabel: 'wpis\u00f3w',
          transitions: {
            FIRST_DETECTED: 'Pierwsze wykrycie',
            EVIDENCE_ADDED: 'Dodano dowody',
            PRECISION_IMPROVED: 'Poprawiono precyzj\u0119',
            ASSESSMENT_CHANGED: 'Zmieniono ocen\u0119',
            DISPUTED: 'Zakwestionowano',
            CONFIRMED: 'Potwierdzono',
            STABILISED: 'Ustabilizowano',
          },
          withheldTitle: 'Wcze\u015bniejsza historia',
          withheldBody:
            'Wcze\u015bniejsze przej\u015bcia s\u0105 wymienione z dat\u0105 i tytu\u0142em. Ich tre\u015b\u0107 nale\u017cy do planu profesjonalnego.',
          proMark: 'PRO',
          emptyTitle: 'Brak zapisanych przej\u015b\u0107',
          emptyBody:
            'Historia oceny tego tematu nie zosta\u0142a jeszcze zapisana. Gdy b\u0119dzie, ka\u017cda zmiana precyzji, pochodzenia i oceny pojawi si\u0119 tutaj w kolejno\u015bci.',
        },
        deck: {
          open: 'Analiza pog\u0142\u0119biona',
          title: 'Analiza pog\u0142\u0119biona',
          close: 'Zamknij',
          actions: {
            'explain-change': 'Wyja\u015bnij t\u0119 zmian\u0119',
            'summarise-30d': 'Podsumuj ostatnie 30 dni',
            'compare-regions': 'Por\u00f3wnaj dwa regiony',
            'explain-watch': 'Wyja\u015bnij skutki dla mojej obserwacji',
            'what-next': 'Co powinienem obserwowa\u0107 dalej?',
            'business-impact': 'Oce\u0144 skutki biznesowe',
            'humanitarian-impact': 'Oce\u0144 skutki humanitarne',
            'cross-border': 'Analiza skutk\u00f3w transgranicznych',
          },
          costUnit: 'akcja',
          tierMark: { PROFESSIONAL: 'PRO', INSTITUTIONAL: 'INST' },
          requiresWatch: 'Wymaga obserwacji tego tematu',
          meterUnset: 'Miesi\u0119czny limit nieustalony',
          previewNote:
            'Te akcje s\u0105 pokazane, aby\u015b widzia\u0142, co potrafi produkt. \u017badnej nie mo\u017cna uruchomi\u0107, dop\u00f3ki analiza pog\u0142\u0119biona nie zostanie w\u0142\u0105czona dla tego konta.',
        },
        costPrompt: {
          title: 'Zanim to uruchomisz',
          costLine: 'Koszt to',
          costUnitOne: 'akcja',
          costUnitMany: 'akcje',
          allowanceUnset: 'Nie skonfigurowano miesi\u0119cznego limitu, wi\u0119c \u017caden nie jest pokazywany.',
          allowanceMeter: 'Wykorzystano {used} z {total} w tym miesi\u0105cu \u00b7 reset {resets}',
          unavailable:
            'Analiza pog\u0142\u0119biona nie jest w\u0142\u0105czona dla tego konta, wi\u0119c nie mo\u017cna jej uruchomi\u0107. Nic nie zosta\u0142o wykorzystane.',
          run: 'Uruchom',
          cancel: 'Anuluj \u2014 nic nie wykorzystano',
        },
        workspace: {
          back: 'Wstecz',
          backToMap: 'Powr\u00f3t do mapy',
          subjectLine: 'Temat',
          noResultTitle: 'Brak wyniku',
          noResultBody:
            'Analiza pog\u0142\u0119biona nie jest w\u0142\u0105czona dla tego konta, wi\u0119c nie ma tu nic do przeczytania. Gdy zostanie w\u0142\u0105czona, wynik zostanie zapisany przy tym temacie i sam b\u0119dzie m\u00f3g\u0142 by\u0107 obserwowany.',
        },
        drawerClose: 'Zamknij panel',
      },
      region: {
        heading: 'Region',
        types: {
          INSTITUTIONAL: 'Instytucjonalny \u00b7 opublikowany organ okre\u015bla cz\u0142onk\u00f3w',
          STATISTICAL: 'Statystyczny \u00b7 opublikowany standard okre\u015bla cz\u0142onk\u00f3w',
          OPERATIONAL: 'W powszechnym u\u017cyciu \u00b7 cz\u0142onkostwo jest sporne',
          UNDEFINED: 'Dla tego regionu nie zakodowano definicji',
        },
        definitionHeading: 'Definicja',
        membersHeading: 'Cz\u0142onkowie',
        membersUnknown: 'Nieopublikowane',
        noDefinitionSelected: 'Nie przyj\u0119to \u017cadnej definicji',
        evidenceScopeHeading: 'Dowody',
        evidenceScopeBody:
          'Zakres regionalny, bez twierdze\u0144 o regionie. Dowody s\u0105 przechowywane dla poszczeg\u00f3lnych kraj\u00f3w z ich w\u0142asn\u0105 precyzj\u0105, a ten produkt ich nie sumuje \u2014 wsp\u00f3lna liczba regionalna mia\u0142aby precyzj\u0119, kt\u00f3rej nikt nie potrafi\u0142by okre\u015bli\u0107.',
        cameraHeld:
          'Kamera nie zosta\u0142a przesuni\u0119ta, poniewa\u017c dla tego regionu nie opublikowano uzgodnionego zasi\u0119gu. Wyb\u00f3r pozostaje rzeczywisty.',
        noBoundary:
          'Nie rysujemy granicy regionu. Unia kraj\u00f3w cz\u0142onkowskich nie jest granic\u0105, a \u017cadna nie zosta\u0142a tu opublikowana.',
        unresolvedHeading: 'Nie uda\u0142o si\u0119 rozpozna\u0107 tego regionu',
        unresolvedBody:
          'Us\u0142uga geograficzna nie zwr\u00f3ci\u0142a tego identyfikatora, wi\u0119c nie mo\u017cna nic o nim stwierdzi\u0107. Identyfikator pokazano dok\u0142adnie w takiej formie, w jakiej dotar\u0142.',
        clear: 'Wyczy\u015b\u0107 region',
        watchUnavailable:
          'Zakres obserwacji dla regionu nie jest jeszcze zdefiniowany, wi\u0119c nie mo\u017cna tu utworzy\u0107 obserwacji.',
      },
      conflict: {
        situationLabel: 'Sytuacja konfliktowa',
        assessmentHeading: 'Bie\u017c\u0105ca ocena',
        confidence: 'Pewno\u015b\u0107',
        geography: 'Geografia',
        participantsHeading: 'Uczestnicy',
        consequenceHeading: 'Skutki dla ludzi',
        evidenceHeading: 'Dowody',
        severities: {
          CRITICAL: 'Krytyczna',
          HIGH: 'Wysoka',
          MODERATE: 'Umiarkowana',
          LOW: 'Niska',
        },
        states: {
          ACTIVE: 'Aktywny',
          CONTAINED: 'Opanowany',
          NEGOTIATED: 'Negocjowany',
          DORMANT: 'U\u015bpiony',
        },
        watchScopeHeading: 'Zakres obserwacji',
        watchScopeHold: {
          NO_BACKEND:
            'Nie mo\u017cna st\u0105d jeszcze okre\u015bli\u0107 zakresu monitorowania, poniewa\u017c nie skonfigurowano umowy aktywacji.',
          PREDICATE_NOT_IN_BASELINE:
            'To, czy ten podmiot mo\u017ce by\u0107 monitorowany, zale\u017cy od regu\u0142y zakresu, kt\u00f3rej platforma jeszcze nie posiada, wi\u0119c nie oferujemy niczego zamiast oferowa\u0107 co\u015b niedzia\u0142aj\u0105cego.',
          CONTESTED_DEFINITION_UNRESOLVED:
            'Ten region nie ma uzgodnionego cz\u0142onkostwa i nie wybrano \u017cadnej definicji, wi\u0119c nie istnieje zbi\u00f3r miejsc, kt\u00f3ry obserwacja mog\u0142aby obj\u0105\u0107.',
          REGION_SCOPE_UNSETTLED:
            'Zakres obserwacji dla regionu nie jest jeszcze zdefiniowany, wi\u0119c nie mo\u017cna tu utworzy\u0107 obserwacji.',
          AVAILABLE: 'Ten podmiot mo\u017ce by\u0107 monitorowany.',
        },
        noService:
          'Dla tego podmiotu nie ma dost\u0119pnej oceny konfliktu. Platforma go nie oceni\u0142a \u2014 to stwierdzenie o naszym zasi\u0119gu, nie o \u015bwiecie.',
        queueHeading: 'Wymaga uwagi',
        queueHolding: 'Sprawdzone, bez zmian',
        queueUnavailable: 'Nic obecnie nie wymaga uwagi.',
        queueUnordered:
          'Uszeregowan\u0105 kolejk\u0119 uwagi tworzy wsp\u00f3lna us\u0142uga oceny, kt\u00f3ra nie dostarcza jeszcze kolejno\u015bci. Wypisanie ich w kolejno\u015bci nap\u0142ywu wygl\u0105da\u0142oby jak ranking, a nim nie jest.',
        entity: {
          evidence: 'rekord\u00f3w',
          provenance: 'Pochodzenie',
          noImage: 'Brak obrazu w rekordzie',
          unlicensedImage: 'Obraz bez licencji na wy\u015bwietlanie',
        },
        roles: {
          actor: 'Podmiot',
          participant: 'Uczestnik',
        },
        indicators: {
          heading: 'Obserwowane wska\u017aniki eskalacji',
          risingOf: '{rising} z {total} ro\u015bnie',
          showAll: 'Poka\u017c wszystkie wska\u017aniki',
          noneObserved: 'Dla tego podmiotu nie zaobserwowano \u017cadnych wska\u017anik\u00f3w.',
          staleSuffix: 'bez aktualizacji',
          directions: { RISING: 'Ro\u015bnie', FALLING: 'Maleje', FLAT: 'Bez zmian', UNKNOWN: 'Nieznany' },
          indicators: {
            INCIDENT_FREQUENCY: 'Cz\u0119stotliwo\u015b\u0107 incydent\u00f3w',
            GEOGRAPHIC_SPREAD: 'Zasi\u0119g geograficzny',
            ACTOR_ACTIVITY: 'Aktywno\u015b\u0107 podmiot\u00f3w',
            INFRASTRUCTURE_ATTACKS: 'Ataki na infrastruktur\u0119',
            DISPLACEMENT_REPORTS: 'Zg\u0142oszenia przesiedle\u0144',
            CEASEFIRE_VIOLATIONS: 'Naruszenia zawieszenia broni',
            EVIDENCE_VOLUME: 'Ilo\u015b\u0107 dowod\u00f3w',
          },
          notes: {
            DISPLACEMENT_REPORTS: 'Liczba zg\u0142osze\u0144, nie szacunek liczby ludno\u015bci.',
            CEASEFIRE_VIOLATIONS: 'Pokazywane tylko tam, gdzie istnieje stan zawieszenia broni.',
            EVIDENCE_VOLUME: 'Mo\u017ce wskazywa\u0107 na zmian\u0119 dost\u0119pu, a nie na eskalacj\u0119.',
          },
        },
        readings: {
          heading: 'Dwa wiarygodne odczyty \u2014 bez u\u015bredniania',
          notResolved: 'Nierozstrzygni\u0119te',
          agreedHeading: 'Co nie jest sporne',
          basis: 'Podstawa',
          countingRule: 'Liczy',
          unresolvedNote:
            'GlobalNews AI tego nie rozstrzygn\u0105\u0142. Odczyty licz\u0105 r\u00f3\u017cne populacje. Nie przedstawiamy jednej liczby ani nie wyliczamy \u015bredniej.',
          sourceClasses: {
            OFFICIAL: 'Oficjalne',
            INDEPENDENT: 'Niezale\u017cne',
            SELF_REPORTED: 'Deklarowane w\u0142asne',
            EVIDENCE_BACKED: 'Poparte dowodami',
          },
          sources: '\u017ar\u00f3de\u0142',
          incomplete: 'Jeden z tych odczyt\u00f3w nie podaje swojej podstawy ani regu\u0142y liczenia, wi\u0119c nie da si\u0119 ich por\u00f3wna\u0107 na r\u00f3wnych zasadach.',
        },
      },
      context: {
        heading: 'Co jest na mapie',
        inMode: 'Pokazywane',
        totalsReports: 'Doniesienia',
        totalsGeographies: 'Miejsca',
        totalsSituations: 'Sytuacje',
        totalsUnsupplied: 'brak danych',
        totalsVerified: 'Potwierdzone',
        unverifiedQualifier: 'cz\u0119\u015b\u0107 niepotwierdzona',
        worldView: 'Widok \u015bwiata',
        totalsSources: '\u0179r\u00f3d\u0142a',
        pillGeographies: 'obszar\u00f3w z dowodami',
        pillNewSince: 'nowych od ostatniej wizyty',
        pillUnresolved: 'nieustalona lokalizacja',
        noEvidenceRow: 'brak zachowanych dowod\u00f3w',
        noEvidenceRowMeta: 'Brak \u00b7 tylko geografia odniesienia',
        sources: '\u017ar\u00f3d',
        newCount: 'nowe',
        jumpHeading: 'Przejd\u017a do regionu walidacyjnego',
        jumpTargets: {
          world: '\u015awiat',
          africa: 'Afryka',
          eastAfrica: 'Afryka Wschodnia',
          europe: 'Europa',
          rwanda: 'Rwanda',
          kenya: 'Kenia',
          poland: 'Polska',
        },
        rankedHeading: 'Gdzie s\u0105 dowody',
        watching: 'Obserwowane',
        noEvidenceHeading: 'Sprawdzone, nic nie zachowano',
        noEvidenceNote:
          'Te miejsca zosta\u0142y odpytane w tym okresie i nie zwr\u00f3ci\u0142y zachowanych doniesie\u0144. To stwierdzenie o tym, co zebrano, a nie o tym, co si\u0119 wydarzy\u0142o.',
        emptyHeading: 'Nie ma czego pokaza\u0107 w tym widoku',
        emptyBody:
          '\u017baden dow\u00f3d nie kwalifikuje si\u0119 do wybranego trybu i okresu. Poszerz okres lub zmie\u0144 tryb, aby zobaczy\u0107, co jeszcze zachowano.',
        reports: 'doniesie\u0144',
        modes: {
          WORLD: '\u015awiat',
          EVIDENCE: 'Dowody',
          SITUATIONS: 'Sytuacje',
          WATCH: 'Obserwowane',
          CHANGE: 'Zmiany',
          SOURCES: '\u0179r\u00f3d\u0142a',
        },
        periods: {
          NOW: 'ostatnia godzina',
          '24H': 'ostatnie 24 godziny',
          '7D': 'ostatnie 7 dni',
          '30D': 'ostatnie 30 dni',
        },
        levels: {
          EXACT: 'Dok\u0142adna',
          CITY: 'Miasto',
          SECTOR: 'Sektor',
          DISTRICT: 'Powiat',
          PROVINCE: 'Wojew\u00f3dztwo',
          COUNTRY: 'Kraj',
          REGION: 'Region',
          UNKNOWN: 'Nieustalona',
          NONE: 'Brak',
        },
      },
    },
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
  analysisFrame: {
    skipToAnalysis: 'Przejd\u017a do analizy',
    /*
      C907 — patrz en.ts.

      C907 ASK+ANALYSIS CONVERGENCE 1 — usunięto zdanie o „jedynej dozwolonej
      korekcie”. Synchroniczna korekta została usunięta wraz z zaakceptowaną
      poprawką opóźnień, więc żadna korekta nie jest podejmowana; zdanie
      opisywało próbę, która już nie następuje. Znaczenie pozostaje dokładnie
      takie samo jak w en.ts: wymóg strukturalny niespełniony, streszczenie
      wstrzymane, analiza poniżej pozostaje bez zmian i zweryfikowana
      niezależnie.
    */
    briefWithheldHeading: 'STRESZCZENIE WYKONAWCZE NIEDOST\u0118PNE',
    briefWithheldBody:
      'Streszczenie przygotowane dla tego zestawu dowod\u00f3w nie spe\u0142ni\u0142o wymogu strukturalnego. Zosta\u0142o wstrzymane, a nie pokazane. Nie ma to wp\u0142ywu na poni\u017csz\u0105 analiz\u0119: ka\u017cde twierdzenie, \u017ar\u00f3d\u0142o i wpis osi czasu zosta\u0142y zweryfikowane niezale\u017cnie.',
    sourceGeographyAbsent: 'BRAK ROZSTRZYGNI\u0118TEGO KRAJU',
    stateNoQuestion: 'NIE ZADANO JESZCZE PYTANIA',
    stateNoQuestionBody: 'Zadaj pytanie, aby otworzy\u0107 analiz\u0119 w tej ramce.',
    stateNoEvidence: '\u017bADNE DONIESIENIA NIE PASOWA\u0141Y DO TEGO PYTANIA',
    stateNoEvidenceBody: 'Dostawca zosta\u0142 odpytany i nic nie zwr\u00f3ci\u0142 dla tego pytania, wi\u0119c nie podj\u0119to pr\u00f3by analizy AI.',
    stateProviderUnavailable: 'NIE UDA\u0141O SI\u0118 POZYSKA\u0106 DONIESIE\u0143',
    stateProviderUnavailableBody: 'Nie uda\u0142o si\u0119 po\u0142\u0105czy\u0107 z \u017cadnym dostawc\u0105 wiadomo\u015bci ani odczyta\u0107 zapisanych doniesie\u0144, wi\u0119c nie by\u0142o czego analizowa\u0107.',
    stateAnalysisFailed: 'ANALIZA NIEDOST\u0118PNA \u00b7 DONIESIENIA ZACHOWANE',
    /* MAIN-C2 STAGE 2 \u2014 patrz komentarz w en.ts. Skopiowane bez zmian. */
    stateAiProviderUnavailable: 'DOSTAWCA AI NIEDOST\u0118PNY \u00b7 DONIESIENIA ZACHOWANE',
    stateAiProviderUnavailableBody:
      'Nie uda\u0142o si\u0119 po\u0142\u0105czy\u0107 z dostawc\u0105 AI dla tego pytania, wi\u0119c analiza nie powsta\u0142a. Doniesienia poni\u017cej zosta\u0142y pobrane poprawnie i pozostaj\u0105 bez zmian. Warto spr\u00f3bowa\u0107 ponownie p\u00f3\u017aniej.',
    stateAiResponseUnusableBody:
      'Dostawca AI odpowiedzia\u0142, ale odpowied\u017a nie przesz\u0142a walidacji i zosta\u0142a odrzucona zamiast pokazana. Doniesienia poni\u017cej zosta\u0142y pobrane poprawnie i pozostaj\u0105 bez zmian.',
    /* H-C2 MICRO-CLOSURE \u2014 stan doprecyzowania pytania. */
    stateClarificationRequired: 'TO PYTANIE WYMAGA DOPRECYZOWANIA \u00b7 NICZEGO NIE SZUKANO',
    stateClarificationRequiredBody:
      'Tego pytania nie da\u0142o si\u0119 zamieni\u0107 na wyszukiwanie bez rozstrzygni\u0119cia jego cz\u0119\u015bci za Ciebie, wi\u0119c nie uruchomiono \u017cadnego wyszukiwania. To nie jest ustalenie o tym, co istnieje \u2014 to pro\u015bba o jeden szczeg\u00f3\u0142 wi\u0119cej.',
    clarificationComparisonMembers:
      'Prosisz o por\u00f3wnanie, a pytanie nie nazywa, co ma zosta\u0107 por\u00f3wnane. Wybranie podmiot\u00f3w tutaj oznacza\u0142oby wybranie za Ciebie Twoich dowod\u00f3w.',
    clarificationTooManyEntities:
      'To pytanie nazywa wi\u0119cej podmiot\u00f3w, ni\u017c obejmuje jedno pobranie. Odpowied\u017a dla cz\u0119\u015bci z nich sugerowa\u0142aby, \u017ce przyjrzeli\u015bmy si\u0119 wszystkim.',
    clarificationAskComparisonMembers: 'Kt\u00f3re podmioty maj\u0105 zosta\u0107 por\u00f3wnane?',
    clarificationAskTooManyEntities: 'Kt\u00f3re dwa lub trzy podmioty s\u0105 tu najwa\u017cniejsze?',
    clarificationAskGeneral: 'Do kt\u00f3rej cz\u0119\u015bci tego pytania zaw\u0119zi\u0107 wyszukiwanie?',
    clarificationRetryNote:
      'Ponowne uruchomienie tego samego pytania doprowadzi w to samo miejsce \u2014 to edycja posuwa spraw\u0119 naprz\u00f3d.',
    mapRegion: 'Mapa dowod\u00f3w',
    mapLegendQueryTarget: 'CEL ZAPYTANIA',
    mapLegendEvidence: 'GEOGRAFIA DOWOD\u00d3W',
    mapLegendActive: 'AKTYWNY DOW\u00d3D',
    mapLegendUnresolved: 'NIEROZSTRZYGNI\u0118TE',
    mapCountryLevel: 'POZIOM KRAJU',
    mapUnresolvedEvidence: 'Z zachowanych doniesie\u0144 nie wynika \u017caden kraj',
    mapUnresolvedArticles: 'DONIESIENIA NIEROZSTRZYGNI\u0118TE',
    mapTargetNotSupported: 'Pytanie wskaza\u0142o to miejsce. Zachowane doniesienia go nie potwierdzaj\u0105.',
    mapNothingToDraw: 'BRAK GEOGRAFII DO POKAZANIA',
    mapReportsSuffix: 'DONIESIENIA',
    mapBasisRetrievalFilter: 'POOL FILTROWANY KRAJEM',
    mapAriaEvidenceCountry: 'Geografia dowod\u00f3w',
    mapAriaTargetCountry: 'Cel zapytania, nie dow\u00f3d',
    relationalHeading: 'DOWODY RELACYJNE',
    relationalShow: 'POKA\u017b DOWODY RELACYJNE',
    relationalHide: 'UKRYJ DOWODY RELACYJNE',
    relationalDirection: {
      'requested-direction': 'POTWIERDZA WSKAZANY KIERUNEK',
      bidirectional: 'POTWIERDZA OBA KIERUNKI',
      'reverse-direction': 'ODWROTNY \u00b7 DOW\u00d3D NA KIERUNEK PRZECIWNY',
      'association-only': 'TYLKO WSP\u00d3\u0141WYST\u0118POWANIE \u00b7 NIE PRZYCZYNOWO\u015a\u0106',
      unclear: 'NIEJASNE \u00b7 ZALE\u017bNO\u015a\u0106 NIEUSTALONA',
      'non-substantive': 'NIEISTOTNE MERYTORYCZNIE',
    },
    relationalExcerptVerified: 'Cytat zweryfikowany jako tekst z tego \u017ar\u00f3d\u0142a.',
    relationalDirectionUnverified: 'Kierunek to klasyfikacja modelu i nie zosta\u0142 niezale\u017cnie zweryfikowany.',
    relationalUncitedNote: 'Zachowane, cho\u0107 \u017caden wniosek go nie cytuje.',
    relationalUnmatchedHeading: 'DOWODY RELACYJNE BEZ POZYSKANEGO \u0179R\u00d3D\u0141A',
    relationalUnmatchedNote: 'Te oceny wskazuj\u0105 artyku\u0142, kt\u00f3rego nie ma w\u015br\u00f3d pozyskanych \u017ar\u00f3de\u0142. S\u0105 pokazane, a nie odrzucone; nie utworzono dla nich \u017cadnego \u017ar\u00f3d\u0142a.',
    relationalUnmatchedArticleId: 'ID ARTYKU\u0141U',
    skipToLocationContext: 'Przejd\u017a do kontekstu geograficznego',
    briefRegion: 'Teza analizy',
    briefLabel: 'STRESZCZENIE \u00b7 INTERPRETACJA AI',
    expandBrief: 'PE\u0141NE STRESZCZENIE',
    collapseBrief: 'Zwi\u0144 pe\u0142ne streszczenie',
    orientationOnly: 'TYLKO ORIENTACYJNIE',
    relationalAnswer: 'ODPOWIED\u0179 RELACYJNA',
    generated: 'WYGENEROWANO',
    retrievedReports: 'POBRANE DONIESIENIA',
    reportingClusters: 'GRUPY DONIESIE\u0143',
    openQuestions: 'OTWARTE PYTANIA',
    indexRegion: 'Indeks analizy',
    centreRegion: 'Analiza',
    locationRegion: 'Kontekst geograficzny',
    sourcesRegion: '\u0179r\u00f3d\u0142a',
    dockHeader: 'DOK \u0179R\u00d3DE\u0141',
    dockExpand: 'Rozwi\u0144 dok \u017ar\u00f3de\u0142',
    dockCollapse: 'Zwi\u0144 dok \u017ar\u00f3de\u0142',
    dockViewAll: 'ZOBACZ WSZYSTKIE',
    dockCollapseShort: 'ZWI\u0143',
    noReportsRetrieved: 'NIE POBRANO \u017bADNYCH DONIESIE\u0143',
    sourcesReporting: '\u0179R\u00d3D\u0141A I DONIESIENIA',
    sourcesShowAll: 'POKA\u017b WSZYSTKIE \u0179R\u00d3D\u0141A',
    openSource: 'OTW\u00d3RZ \u0179R\u00d3D\u0141O',
    opensNewTab: 'otwiera si\u0119 w nowej karcie',
    sourceSupportCited: 'CYTOWANE \u00b7 {n}',
    sourceSupportNotCited: 'NIECYTOWANE W TEJ ANALIZIE',
    sourcesPrev: 'Poprzednie \u017ar\u00f3d\u0142a',
    sourcesNext: 'Nast\u0119pne \u017ar\u00f3d\u0142a',
    sourcesPosition: '{a}\u2013{b} Z {n}',
    geoExpand: 'POWI\u0118KSZ MAP\u0118',
    geoClose: 'ZAMKNIJ MAP\u0118',
    geoZoomIn: 'Przybli\u017c',
    geoZoomOut: 'Oddal',
    geoZoomReset: 'Zresetuj widok',
    geoExpandedRegion: 'Powi\u0119kszona geografia dowod\u00f3w',
    geoNoSubnational: 'POZIOM KRAJU JEST SUFITEM · BRAK DANYCH PONI\u017bEJ POZIOMU KRAJU',
    geoSchematic: 'SCHEMAT \u00b7 NIE W SKALI',
    analysisUnavailableRetrievalSucceeded: 'ANALIZA NIEDOST\u0118PNA \u00b7 POZYSKIWANIE POWIOD\u0141O SI\u0118',
    analysisUnavailableExplanation:
      'Nie uda\u0142o si\u0119 przygotowa\u0107 analizy. Pobrane doniesienia poni\u017cej pozostaj\u0105 nienaruszone i w pe\u0142ni dost\u0119pne do wgl\u0105du.',
    retry: 'PON\u00d3W',
    /* H-ALPHA-1 — patrz komentarz w en.ts. */
    editQuestion: 'EDYTUJ PYTANIE',
    backLabel: 'WSTECZ',
    showRemaining: 'POKA\u017b POZOSTA\u0141E',
    uncited: 'BEZ CYTOWANIA',
    noItemsInDimension: 'BRAK POZYCJI W TYM WYMIARZE DLA TEJ ANALIZY',
    locationContextChip: 'KONTEKST LOKALIZACJI',
    representativeImagery: 'Pogl\u0105dowa ilustracja lokalizacji \u2014 nie jest to zdj\u0119cie z tej historii.',
    noVerifiedLocationImage: 'BRAK ZWERYFIKOWANEJ ILUSTRACJI LOKALIZACJI',
    locationImageAlt: 'Pogl\u0105dowa ilustracja lokalizacji: {place}. Nie jest to zdj\u0119cie z tej historii.',
    notACoordinate: 'TO NIE S\u0104 WSP\u00d3\u0141RZ\u0118DNE',
    mapAltCity: 'Mapa pokazuj\u0105ca {place} na poziomie miasta. Znacznik wskazuje rozstrzygni\u0119te miasto, a nie wsp\u00f3\u0142rz\u0119dne.',
    mapAltCountry: 'Mapa pokazuj\u0105ca {place} na poziomie kraju. Znacznik wskazuje rozstrzygni\u0119ty kraj, a nie wsp\u00f3\u0142rz\u0119dne.',
    mapAltUnresolved: 'Mapa bez znacznika. Dowody nie rozstrzygn\u0119\u0142y lokalizacji.',
    completeRecord: 'PE\u0141NY ZAPIS ANALIZY',
    completeRecordSub: '\u015aCIE\u017bKA AUDYTU \u00b7 NIE \u015aCIE\u017bKA CZYTANIA',
    completeRecordAction: 'ZOBACZ PE\u0141NY ZAPIS ANALIZY',
    completeRecordCount: '{n} POZYCJI',
    completeRecordExists: 'Pe\u0142ny zapis analizy jest dost\u0119pny dla tego pytania \u00b7 {n} pozycji',
    evidenceLibrary: 'BIBLIOTEKA DOWOD\u00d3W',
    openEvidenceLibrary: 'Otw\u00f3rz bibliotek\u0119 dowod\u00f3w',
    citationMarker: '\u0179r\u00f3d\u0142o {n}, {outlet}. Poka\u017c w doku \u017ar\u00f3de\u0142.',
    backToWorkspace: 'PRZESTRZE\u0143 ANALIZY',
    sourcesDestinationTitle: '\u0179R\u00d3D\u0141A',
    noQuestionTitle: 'NIE PODANO PYTANIA',
    noQuestionBody:
      'Ramka analityczna prezentuje analiz\u0119, o kt\u00f3r\u0105 ju\u017c poproszono. Nie rozpoczyna jej st\u0105d.',
    askAQuestion: 'ZADAJ PYTANIE',
    requestFailedTitle: '\u017b\u0104DANIE ANALIZY NIE POWIOD\u0141O SI\u0118',
    requestFailedNote: 'Nie pobrano \u017cadnych doniesie\u0144 dla tego pytania, wi\u0119c nie ma czego przegl\u0105da\u0107 poni\u017cej.',
    queryTarget: 'CEL ZAPYTANIA',
    evidenceGeography: 'GEOGRAFIA DOWOD\u00d3W',
    targetNotEstablished: 'Wskazane w pytaniu. Niepotwierdzone przez dowody.',
  },
  accountSettings: {
    heading: 'Ustawienia konta',
    intro: 'Zarz\u0105dzaj kontem, na kt\u00f3re jeste\u015b zalogowany.',
    signInPrompt: 'Zaloguj si\u0119, aby zarz\u0105dza\u0107 swoim kontem.',
    dangerZoneHeading: 'Strefa nieodwracalnych dzia\u0142a\u0144',
    dangerZoneNote: 'Te dzia\u0142ania s\u0105 trwa\u0142e. Niczego poni\u017cej nie da si\u0119 cofn\u0105\u0107.',
    confirmationLabel: 'Wpisz adres e-mail swojego konta, aby potwierdzi\u0107',
    confirmationHint:
      'Usuni\u0119cie pozostaje nieaktywne, dop\u00f3ki wpisany tekst nie b\u0119dzie dok\u0142adnie taki sam jak adres powy\u017cej.',
    confirmationMismatch: 'To nie jest adres konta, na kt\u00f3re jeste\u015b zalogowany.',
    deletePermanently: 'Trwale usu\u0144 konto',
    deletingLabel: 'Usuwanie\u2026',
    deletedHeading: 'Konto usuni\u0119te',
    deletedNote: 'Twoje konto i jego dane zosta\u0142y usuni\u0119te. Jeste\u015b teraz wylogowany.',
    deleteFailed: 'Nie uda\u0142o si\u0119 usun\u0105\u0107 konta. Nic nie zosta\u0142o usuni\u0119te. Spr\u00f3buj ponownie.',
  },
  /**
   * B5-A · OAUTH V1 — polskie odpowiedniki. Truth conditions are E1's; the
   * wording awaits locale ratification (recorded as OAUTH-V1-PL-COPY-RATIFY-1).
   */
  authError: {
    cancelled: 'Logowanie zosta\u0142o anulowane. Mo\u017cesz zalogowa\u0107 si\u0119 w dowolnej chwili.',
    failed: 'Logowanie nie zosta\u0142o uko\u0144czone. Spr\u00f3buj ponownie.',
    dismissLabel: 'Zamknij',
  },
};
