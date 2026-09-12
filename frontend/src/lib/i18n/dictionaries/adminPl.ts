import type { AdminDictionary } from './adminEn';

/**
 * F1.b — Polish Admin Platform dictionary.
 *
 * Structurally identical to `adminEn` — the type below makes that a
 * compile error rather than a runtime surprise. Authored by Claude Code F
 * for CTO review, the same arrangement used for M66.5 D-5 and M66.7 D-4.
 *
 * IDENTIFIERS ARE INTENTIONALLY IDENTICAL IN BOTH LANGUAGES: screen
 * codes, probe statuses (HEALTHY, UNKNOWN, NOT IMPLEMENTED,
 * DISCONNECTED), pipeline modes and window labels (24h, 7d, 30d) are
 * protocol tokens, not prose. `adminLocalization.spec.ts` allows exactly
 * those keys to match and requires every other string to differ.
 */
export const adminPl: AdminDictionary = {
  meta: {
    title: 'Administracja — GlobalNews AI',
    description: 'Administracja GlobalNews AI.',
  },

  brand: {
    name: 'GlobalNews',
    accent: 'AI',
    subtitle: 'PANEL ADMINISTRACYJNY',
  },

  truthBanner: {
    title: 'Pochodzenie danych',
    body: 'Każde pole tego panelu ma oznaczenie pochodzenia danych. Nic tutaj nie jest poglądowe: powierzchnia bez danych źródłowych mówi o tym wprost, zamiast pokazywać przykładową liczbę.',
  },

  nav: {
    landmarkLabel: 'Sekcje administracyjne',
    openMenu: 'Otwórz nawigację administracyjną',
    closeMenu: 'Zamknij nawigację administracyjną',
    skipToContent: 'Przejdź do treści administracyjnej',
    emptyTitle: 'Brak dostępnych sekcji',
    emptyBody: 'Twoja rola nie daje dostępu do żadnej sekcji administracyjnej.',
    groups: {
      platform: 'PLATFORMA',
      content: 'TREŚCI',
      intelligence: 'ANALITYKA AI',
      audience: 'ODBIORCY',
      finance: 'FINANSE',
      support: 'WSPARCIE',
      operations: 'OPERACJE',
    },
    items: {
      overview: 'Przegląd',
      news: 'Zarządzanie wiadomościami',
      sources: 'Źródła globalne',
      ai: 'Inteligencja AI',
      aiProviders: 'Dostawcy AI',
      users: 'Użytkownicy i dostęp',
      subscriptions: 'Użytkownicy i subskrypcje',
      analytics: 'Analityka',
      geography: 'Geografia / zasięg',
      payments: 'Płatności i podatki',
      support: 'Opinie i wsparcie',
      systemHealth: 'Kondycja systemu i logi',
      audit: 'Dziennik audytu',
      settings: 'Ustawienia',
    },
  },

  topbar: {
    searchPlaceholder: 'Wyszukiwanie nie jest zaimplementowane',
    searchNotImplemented: 'Wyszukiwanie globalne nie ma zaplecza i nie jest zaimplementowane.',
    roleLabel: 'Rola',
    signedInAs: 'Zalogowano jako',
    capabilityCount: 'uprawnień',
  },

  access: {
    loadingTitle: 'Sprawdzanie uprawnień…',
    loadingBody: 'Nic nie zostanie wyświetlone, dopóki serwer nie potwierdzi tożsamości.',
    signInTitle: 'Wymagane logowanie',
    signInBody: 'Ten obszar wymaga zalogowanego konta administratora.',
    signInCta: 'Zaloguj się przez Google',
    forbiddenTitle: 'Niedostępne',
    forbiddenBody: 'Ten obszar nie jest dostępny dla tego konta.',
    unreachableTitle: 'Nie można odczytać uprawnień',
    unreachableBody:
      'Nie udało się odczytać uprawnień, więc żadna sekcja administracyjna nie jest pokazana. To nie znaczy, że brakuje Ci dostępu — samo sprawdzenie się nie powiodło.',
    retry: 'Spróbuj ponownie',
  },

  states: {
    noSource: 'Brak źródła',
    planned: 'Planowane',
    unknown: 'UNKNOWN',
    notImplemented: 'NOT IMPLEMENTED',
    unavailable: 'UNAVAILABLE',
    loading: 'Wczytywanie…',
    failed: 'Niepowodzenie',
    retry: 'Ponów',
    correlationId: 'Identyfikator korelacji',
    zeroNote: 'Zmierzone zero dla tego okna czasowego.',
    unavailableNote: 'Żadne zaplecze nie udostępnia tej wartości.',
    notImplementedNote: 'Planowane. Nie istnieje jeszcze żadna funkcja zaplecza dla tego elementu.',
    errorNote: 'Ten panel nie został wczytany. Pozostała część ekranu działa normalnie.',
    inertFilters:
      'Filtry są pokazane dla układu i pozostają nieaktywne, dopóki ten ekran nie ma danych.',
  },

  provenance: {
    legendTitle: 'Pochodzenie danych',
    a: 'Istniejące dane zaplecza',
    b: 'Dane istnieją, brakuje agregacji',
    c: 'Wymaga nowej funkcji zaplecza',
    d: 'Wyłącznie próbka projektowa — nigdy nie wdrażana',
    ariaPrefix: 'Pochodzenie danych',
  },

  screens: {
    overview: {
      title: 'Przegląd',
      purpose: 'Czy platforma działa normalnie i co dziś wymaga uwagi administratora.',
      kpis: {
        articlesIngested: 'POBRANE ARTYKUŁY · 24H',
        activeUsers: 'AKTYWNI UŻYTKOWNICY · 24H',
        countries: 'KRAJE Z AKTYWNOŚCIĄ',
        analysisRequests: 'ZAPYTANIA ANALITYCZNE · 24H',
        providerErrors: 'BŁĘDY DOSTAWCÓW · 24H',
      },
      reachTitle: 'Zasięg globalny',
      reachPurpose: 'Zapytania według kraju w wybranym oknie czasowym.',
      reachRequirement: 'Wymaga geografii na poziomie zapytań, której ta platforma nie zbiera.',
      pipelineTitle: 'Tryb potoku danych',
      pipelineNote:
        'Tryb dostawcy jest raportowany przez sam potok wiadomości. Widok per dostawca znajdziesz w sekcji Zarządzanie wiadomościami.',
      alertsTitle: 'Alerty',
      alertsRequirement: 'Wymaga magazynu alertów. Taki nie istnieje.',
      windowLabel: 'Okno czasowe',
      windows: { h24: '24h', d7: '7d', d30: '30d' },
    },

    analytics: {
      title: 'Użytkownicy, użycie i geografia',
      purpose: 'Jak produkt jest naprawdę używany, z dokładnością, której zaplecze potrafi bronić.',
      tabs: {
        analytics: 'Analityka',
        geography: 'Geografia',
        users: 'Użytkownicy i dostęp',
        subscriptions: 'Subskrypcje',
      },
      signedInOnlyNotice:
        'GlobalNews AI działa bez konta i żadna ścieżka nie wymaga logowania. Każda liczba użytkowników, sesji i historii obejmuje więc wyłącznie konta zalogowane i jest podzbiorem rzeczywistego użycia.',
      kpis: {
        activeUsers: 'AKTYWNI UŻYTKOWNICY · 24H',
        newUsers: 'NOWE KONTA · 7D',
        returning: 'ZAREJESTROWANE POWROTY · 7D',
        sessions: 'SESJE · 24H',
        analysisRuns: 'URUCHOMIENIA ANALIZY · 24H',
        clientErrors: 'BŁĘDY KLIENTA · 24H',
        totalAccounts: 'WSZYSTKIE KONTA',
        neverObserved: 'NIGDY NIE ZAOBSERWOWANO POWROTU',
      },
      activeUsersRequirement:
        'Niezaimplementowane. Nie rejestrujemy aktywności na poziomie żądań, a czytelników bez konta nie da się policzyć w ogóle.',
      sessionsRequirement:
        'Niezaimplementowane. Wiersze sesji są usuwane przy wylogowaniu i po wygaśnięciu, więc nie da się z nich wyprowadzić historycznej liczby sesji.',
      returningMeaning:
        'Konta, których zarejestrowany powrót mieści się w oknie czasowym. To NIE są aktywni użytkownicy: konto, które czytało cały dzień, nie trafiając na powierzchnię powrotu, nie jest liczone, a czytelnik bez konta nigdy być nie może.',
      analysisTitle: 'Uruchomienia analizy',
      analysisPurpose:
        'Jeden wiersz na każde żądanie analizy zakończone przez ten serwer — łącznie z odpowiedziami z pamięci podręcznej, odrzuceniami walidacji i błędami. To nie jest liczba pytań zadanych przez człowieka.',
      analysisOutcome: 'Wynik',
      analysisFailureReason: 'Powód niepowodzenia',
      analysisProvider: 'Dostawca i model',
      analysisCacheHits: 'Z pamięci podręcznej',
      analysisCacheMisses: 'Obliczone',
      analysisLatency: 'Opóźnienie',
      analysisTokens: 'Tokeny',
      analysisAverage: 'Średnia',
      analysisRange: 'Zakres',
      analysisSample: 'Wiersze z pomiarem',
      analysisNoSample:
        'Żaden wiersz w tym oknie nie zapisał wartości, więc nie ma czego uśredniać.',
      mockProviderNote:
        'Dostawca pozorowany to nie jest ruch produkcyjny. Wiersze mu przypisane to uruchomienia obsłużone bez wywołania prawdziwego modelu.',
      recordedEventsTitle: 'Zarejestrowane zdarzenia',
      recordedEventsPurpose: 'Zdarzenia produktowe zapisane przez serwer w tym oknie.',
      instrumentationGapTitle: 'To nie jest pełny obraz użycia funkcji',
      instrumentationGapBody:
        'Pojawić się może wyłącznie nazwa zdarzenia, która ma swojego producenta. Telemetria interakcji po stronie klienta nie jest oprzyrządowana, więc nazwy oznaczone jako bez producenta są nieobecne w danych, a nie nieużywane. Przedstawianie reszty jako użycia funkcji byłoby nieprawdą.',
      hasProducer: 'Ma producenta',
      noProducer: 'Brak producenta',
      retentionDisclosureTitle: 'Retencja telemetrii',
      retentionDeclared: 'Zadeklarowana retencja w dniach',
      retentionNotEnforced:
        'ZADEKLAROWANA, ALE NIEEGZEKWOWANA. W tym zapleczu nie działa żaden harmonogram ani zadanie czyszczące, więc liczby z długiego okna zawierają wiersze, których według reguły już by nie było.',
      retentionIsEnforced: 'Egzekwowana przez zaplanowane czyszczenie.',
      coverageCountryColumn: 'Kraj',
      coverageRelevantColumn: 'Artykuły istotne',
      coverageTotalColumn: 'Wszystkie zapisane wiersze',
      coverageDistinct: 'KRAJE Z ISTOTNYM POKRYCIEM',
      coverageTruncated:
        'Lista rankingowa jest ograniczona. Liczba powyżej obejmuje wszystkie kraje, a nie tylko pokazane wiersze.',
      followedTitle: 'Obserwowane kraje — zadeklarowane zainteresowanie, tylko konta zalogowane',
      followedPurpose:
        'Które kraje wybrały konta zalogowane. To nie jest ani to, czego dotyczy treść, ani to, gdzie ktokolwiek się znajduje — i nigdy nie służy do wnioskowania o żadnym z nich.',
      followedCountryColumn: 'Kraj',
      followedAccountsColumn: 'Obserwujące konta',
      followedEmptyTitle: 'Żaden kraj nie jest jeszcze obserwowany',
      followedEmptyBody: 'Żadne konto nie obserwuje kraju. To jest pomiar, a nie luka.',
      audienceGeographyTitle: 'Geografia odbiorców',
      audienceGeographyRequirement:
        'Niezaimplementowane i nieprzybliżane. Nie zbieramy adresów, nie uruchamiamy wzbogacania geograficznego, a dziennik dostępu nigdy nie zapisuje treści zapytania. Lokalizacja odbiorcy nie jest nigdy wnioskowana z pokrycia, z obserwowanych krajów, z zakresu wyszukiwania, z języka interfejsu ani z wyniku modelu.',
      usersPurpose:
        'Konta, w minimalnym zakresie potrzebnym do widoku dostępu. Widoczne wyłącznie dla SUPER_ADMIN.',
      usersIdColumn: 'Konto',
      usersCreatedColumn: 'Utworzono',
      usersLastSeenColumn: 'Ostatnio zaobserwowano',
      usersRoleColumn: 'Rola administracyjna',
      usersNoRole: 'Brak',
      usersNeverSeen: 'Nigdy nie zaobserwowano',
      usersEmptyTitle: 'Brak kont',
      usersEmptyBody: 'W tym wdrożeniu nie istnieje jeszcze żadne konto.',
      usersTotal: 'KONTA',
      usersRoleDistribution: 'Według roli administracyjnej',
      usersOmittedFields:
        'CELOWO NIEOBECNE: adres, jakakolwiek jego zamaskowana lub częściowa forma, domena, treść historii wyszukiwania, wartości tożsamości logowania, dane sesji — oraz nazwa wyświetlana. Żadne z nich nie jest odfiltrowywane po drodze; żadne nie jest w ogóle odczytywane z bazy.',
      usersNoWritePath:
        'Ten widok jest tylko do odczytu. Żadnej roli nie da się przyznać, zmienić ani odebrać z jakiejkolwiek powierzchni administracyjnej tej platformy.',
      usersPagePrevious: 'Poprzednia',
      usersPageNext: 'Następna',
      usersPageLabel: 'Strona',
      topCountries: 'Najczęstsze kraje',
      topLanguages: 'Najczęstsze języki',
      topFeatures: 'Najczęstsze funkcje',
      retentionTitle: 'Retencja',
      retentionPurpose: 'Aktywność według tygodnia od pierwszej sesji.',
      retentionRequirement:
        'Wymaga zadania kohortowego i rejestru aktywności. Żadne z nich nie istnieje.',
      geographyTitle: 'Geografia publikacji',
      geographyNote:
        'To pokazuje, czego dotyczy opublikowana treść — nie gdzie są użytkownicy. Geografia odbiorców wymagałaby zbierania danych na poziomie zapytań, czego ta platforma nie robi.',
      geographyRequirement: 'Wymaga punktu agregującego zapisaną relację artykuł–kraj.',
      usersTitle: 'Rekordy użytkowników',
      usersRequirement: 'Wymaga administracyjnego punktu listy użytkowników. Taki nie istnieje.',
      subscriptionsTitle: 'Subskrypcje',
      subscriptionsRequirement: 'W tej platformie nie istnieje żaden model subskrypcji.',
      errorsTitle: 'Błędy',
      errorsRequirement: 'Wymaga telemetrii błędów klienta. Nie jest zbierana.',
    },

    payments: {
      title: 'Płatności, podatki, Polska i KSeF',
      purpose:
        'Przychody, VAT, fakturowanie i wysyłka do KSeF wraz z dowodami dla księgowości i kontroli.',
      notImplementedTitle: 'Nie zaimplementowano',
      notImplementedBody:
        'Ta platforma nie ma żadnej funkcji płatności, podatków, klientów, faktur ani KSeF — brak operatora płatności, rejestru, ustalania podatku, numeracji faktur i klienta KSeF. Poniższa struktura to zatwierdzona architektura, pokazana po to, by uzgodnić kształt przed budową. Nie pokazujemy żadnej kwoty, klienta, numeru faktury, NIP-u ani referencji KSeF, ponieważ żadne nie istnieją.',
      tabs: {
        overview: 'Przegląd',
        vat: 'VAT (Polska)',
        customers: 'Klienci biznesowi',
        invoices: 'Faktury',
        ksef: 'KSeF',
        traceability: 'Ścieżka dowodowa',
      },
      ksefStatusTitle: 'Integracja KSeF',
      ksefStatusValue: 'DISCONNECTED',
      ksefStatusBody:
        'Integracja nie jest skonfigurowana. Każda powierzchnia KSeF pozostaje za flagą funkcji, dopóki nie powstanie realne zaplecze.',
      traceabilityTitle: 'Łańcuch ścieżki dowodowej',
      traceabilityBody:
        'Każdy węzeł musi być osiągalny z węzła powyżej. Żaden z ośmiu węzłów nie ma dziś rekordu źródłowego.',
      chain: {
        customer: 'Klient / firma',
        subscription: 'Subskrypcja / zakup',
        payment: 'Płatność',
        taxTreatment: 'Kwalifikacja podatkowa',
        invoice: 'Faktura',
        ksefSubmission: 'Wysyłka do KSeF',
        ksefResult: 'Status / wynik / referencja KSeF',
        auditHistory: 'Historia audytu',
      },
    },

    support: {
      title: 'Opinie i wsparcie',
      purpose:
        'Obsługa kolejki zgłoszeń z trwałym, audytowalnym zapisem tego, co powiedziano użytkownikowi i co zapisano wewnętrznie.',
      queueTitle: 'Kolejka',
      threadTitle: 'Rozmowa',
      replyComposer: 'Odpowiedź do użytkownika',
      noteComposer: 'Notatka wewnętrzna',
      visibilityUser: 'Widoczne dla użytkownika',
      visibilityInternal: 'Notatka wewnętrzna — niewidoczna dla użytkownika',
      visibilityNote:
        'Widoczność odpowiedzi jest zapisanym polem egzekwowanym po stronie serwera, nigdy konwencją wyświetlania. Notatka wewnętrzna jest odfiltrowywana z zapytania zgłaszającego już w bazie danych i nie jest wliczana do tego, co on widzi.',
      requestTypesTitle: 'Typy zgłoszeń',
      identityNote:
        'Zgłoszenie jest identyfikowane wyłącznie przez swój numer. Adres, imię ani identyfikator konta osoby, która je otworzyła, nie są dostępne na tym ekranie.',
      columns: {
        reference: 'Numer',
        subject: 'Temat',
        category: 'Rodzaj',
        status: 'Stan',
        replies: 'Widoczne',
        notes: 'Notatki',
        updated: 'Ostatnia aktywność',
      },
      queueEmptyTitle: 'Brak zgłoszeń',
      queueEmptyBody:
        'Nikt jeszcze nie otworzył zgłoszenia albo żadne nie odpowiada wybranemu stanowi.',
      queueErrorTitle: 'Nie udało się wczytać kolejki',
      queueErrorBody: 'Żądanie nie powiodło się. Nie pokazujemy nic zamiast niekompletnej kolejki.',
      selectPrompt: 'Wybierz zgłoszenie z kolejki, aby przeczytać rozmowę.',
      threadErrorBody: 'Nie udało się wczytać rozmowy. Żadna jej część nie jest pokazywana.',
      openTicket: 'Otwórz',
      authors: {
        USER: 'Zgłaszający',
        ADMIN: 'Administrator wsparcia',
        SYSTEM_AI: 'Agent wsparcia GlobalNews AI',
      },
      categories: {
        NEWS_QUESTION: 'Pytanie o wiadomość',
        BUG_REPORT: 'Zgłoszenie błędu',
        CONTENT_REPORT: 'Zgłoszenie treści',
        FEEDBACK: 'Opinia',
        ABUSE_REPORT: 'Zgłoszenie nadużycia',
        ACCOUNT_PROBLEM: 'Problem z kontem',
        OTHER: 'Inne',
      },
      statuses: {
        OPEN: 'Nowe',
        AWAITING_USER: 'Czeka na użytkownika',
        AWAITING_ADMIN: 'Czeka na administratora',
        RESOLVED: 'Rozwiązane',
      },
      filterAll: 'Wszystkie stany',
      filterLabel: 'Filtruj według stanu',
      messageLabel: 'Wiadomość',
      replyPlaceholder: 'Napisz odpowiedź, którą przeczyta zgłaszający.',
      notePlaceholder: 'Napisz notatkę, którą przeczytają wyłącznie administratorzy.',
      sendReply: 'Wyślij odpowiedź',
      saveNote: 'Zapisz notatkę wewnętrzną',
      sending: 'Wysyłanie…',
      submitFailed:
        'Nic nie zostało wysłane. Żądanie nie powiodło się i wiadomość nie została zapisana.',
      replyConsequence: 'Wysłanie odpowiedzi przenosi zgłoszenie do stanu „czeka na użytkownika”.',
      noteConsequence:
        'Zapisanie notatki nie zmienia niczego, co widzi zgłaszający, ani nie zmienia stanu zgłoszenia.',
      auditTitle: 'Historia zgłoszenia',
      auditRequirement:
        'W tej platformie nie istnieje żaden rejestr audytowy. Oś czasu złożona ze znaczników czasu wiadomości wyglądałaby jak zapis tego, kto co zmienił, a nim nie jest, więc nic tu nie pokazujemy.',
      slaTitle: 'Docelowe czasy odpowiedzi',
      slaRequirement:
        'W tej platformie nie istnieje model docelowych czasów odpowiedzi, zegar ani pomiar. Każda liczba pokazana w tym miejscu byłaby wymysłem, a nie odczytem.',
      statusTitle: 'Stan zgłoszenia',
      resolve: 'Oznacz jako rozwiązane',
      reopen: 'Otwórz ponownie',
      statusFailed: 'Stan nie został zmieniony.',
      /* SUPPORT CLOSURE (G4) — patrz komentarz przy tym samym kluczu w adminEn.ts. */
      resolveMeaning:
        'Rozwiązanie zamyka to zgłoszenie. Nie oznacza to, że zgłoszony problem został naprawiony — napisz o tym w odpowiedzi dopiero wtedy, gdy zostało to potwierdzone.',
    },

    operations: {
      title: 'Wiadomości, źródła i operacje AI',
      purpose:
        'Którzy dostawcy odpowiadają, w jakim trybie są dane i jak zachowuje się warstwa AI.',
      tabs: {
        news: 'Zarządzanie wiadomościami',
        sources: 'Źródła globalne',
        ai: 'Inteligencja AI',
        providers: 'Dostawcy AI',
      },
      providerHealthTitle: 'Kondycja dostawców',
      providerHealthNote:
        'Dane na żywo z sondy kondycji dostawców, którą ta platforma już uruchamia. Raportowany jest każdy zarejestrowany dostawca, także taki, który nie dostarcza artykułów.',
      /* A-1 — patrz komentarz przy tych samych kluczach w adminEn.ts. */
      providerHealthEmptyTitle: 'Nie zgłoszono żadnego dostawcy',
      providerHealthEmptyBody:
        'Żądanie powiodło się i nie zwróciło żadnego dostawcy. To jest odczyt, a nie brak funkcji.',
      columns: {
        provider: 'Dostawca',
        health: 'Kondycja',
        mode: 'Tryb',
        serving: 'Obsługuje odczyty',
        kind: 'Źródło',
        checkedAt: 'Ostatnie sprawdzenie',
        requests: 'Zapytania',
        failures: 'Błędy',
        latency: 'Opóźnienie',
        lastSuccess: 'Ostatni sukces',
        rateLimit: 'Limit zapytań',
      },
      serving: {
        yes: 'Obsługuje',
        no: 'Bezczynny',
      },
      providerKinds: {
        REAL: 'Źródło rzeczywiste',
        MOCK: 'Syntetyczne',
        UNKNOWN: 'Niezidentyfikowane',
      },
      servingNote:
        'Zarejestrowany to nie to samo co obsługujący. Odczyty obsługuje wyłącznie dostawca oznaczony jako obsługujący; syntetyczny dostawca w tym stanie oznacza, że to wdrożenie zwraca wiadomości generowane, a nie prawdziwe.',
      countersNote:
        'Liczniki per dostawca są zadeklarowane w kontrakcie kondycji, ale żaden dostawca ich nie wypełnia, więc pokazują UNKNOWN. Zero oznaczałoby tu pomiar, którego nigdy nie wykonano.',
      articlesTitle: 'Zasób artykułów',
      articlesRequirement:
        'Wymaga administracyjnego punktu artykułów. Zapisane artykuły istnieją; odczyt w kształcie administracyjnym nie.',
      aiOpsTitle: 'Operacje AI',
      aiOpsRequirement:
        'Pochodzenie analizy jest zwracane przy każdym zapytaniu i nigdy nie jest zapisywane, więc nic go nie zlicza.',
      aiProvidersTitle: 'Dostawcy AI',
      aiProvidersRequirement:
        'Wymaga sondy kondycji dostawcy AI. Taka nie istnieje — status widać wyłącznie po uruchomieniu prawdziwej analizy.',
      modulesTitle: 'Moduły analityczne',
      modulesRequirement:
        'Wymaga operacyjnego rejestru modułów. Taki nie istnieje. To nie jest publiczny Intelligence Engine ze strony głównej.',
      claimsRemovedNote:
        'Deklaracje dokładności, „zweryfikowane przez AI” i „sprawdzone fakty” zostały celowo pominięte. Nie mają kontraktu zaplecza, który definiowałby ich znaczenie.',
    },

    systemHealth: {
      title: 'Kondycja systemu',
      purpose: 'Rzeczywisty stan platformy, łącznie z „nie wiemy”.',
      overallTitle: 'Status ogólny',
      overallNote:
        'Decyduje najgorszy zbadany komponent. Platforma z niezbadanym komponentem nie jest platformą zdrową, więc dopóki jakikolwiek komponent pokazuje UNKNOWN, status ogólny nie może pokazać HEALTHY.',
      probedSummary: 'zbadanych komponentów',
      componentsTitle: 'Komponenty',
      incidentsTitle: 'Incydenty',
      incidentsRequirement: 'Wymaga magazynu incydentów. Taki nie istnieje.',
      components: {
        FRONTEND: 'Warstwa frontowa',
        BACKEND: 'API zaplecza',
        DATABASE: 'Baza danych',
        NEWS_PROVIDER: 'Dostawca wiadomości',
        AI_PROVIDER: 'Dostawca AI',
        AUTHENTICATION: 'Uwierzytelnianie',
        BACKGROUND_SERVICES: 'Usługi w tle',
        KSEF_INTEGRATION: 'Integracja KSeF',
      },
      statuses: {
        HEALTHY: 'HEALTHY',
        DEGRADED: 'DEGRADED',
        FAILING: 'FAILING',
        UNKNOWN: 'UNKNOWN',
        NOT_IMPLEMENTED: 'NOT IMPLEMENTED',
      },
      details: {
        'process-serving-requests': 'Proces odpowiedział na to zapytanie.',
        'database-reachable': 'Sprawdzenie połączenia powiodło się.',
        'database-unreachable': 'Sprawdzenie połączenia nie powiodło się.',
        'all-providers-ok': 'Każdy zarejestrowany dostawca zgłosił poprawną kondycję.',
        'some-providers-degraded': 'Co najmniej jeden dostawca zgłosił pogorszoną kondycję.',
        'some-providers-down': 'Co najmniej jeden dostawca zgłosił awarię.',
        'oauth-configured': 'Poświadczenia logowania są skonfigurowane.',
        'oauth-not-configured':
          'Logowanie nie może się rozpocząć: brakuje co najmniej jednego wymaganego poświadczenia. Którego dokładnie — celowo nie jest tu podawane.',
        'ai-provider-configured':
          'Skonfigurowany jest rzeczywisty dostawca analizy i to on odpowiedziałby na zapytanie.',
        'ai-provider-mock-active':
          'Nie skonfigurowano klucza analizy, więc odpowiadałaby analiza syntetyczna. Poprawne dla środowiska deweloperskiego, nigdy dla produkcji.',
        'ai-provider-not-configured':
          'Wymagana jest analiza produkcyjna, ale nie skonfigurowano klucza.',
        'no-probe-configured': 'Dla tego komponentu nie skonfigurowano żadnej sondy.',
        'not-implemented': 'Ten komponent jest planowany i nie ma implementacji.',
      },
      ingestionTitle: 'Żywotność pozyskiwania',
      ingestionNote:
        'Czy to wdrożenie faktycznie przechowuje i pobiera artykuły. Agregacja wyłącznie po zapisanych artykułach — nie są odczytywane żadne dane użytkowników, sesji, wyszukiwań ani lokalizacji.',
      ingestionCountLabel: 'Zapisane artykuły',
      ingestionLatestLabel: 'Ostatnio pobrany artykuł',
      lastProbeAt: 'Ostatnia sonda',
      neverProbed: 'Nigdy nie badano',
    },

    systemLogs: {
      title: 'Logi systemowe',
      purpose: 'Strumień logów diagnostycznych potrzebny do zbadania incydentu.',
      requirement:
        'Wymaga przeszukiwalnego magazynu logów. Logi trafiają na wyjście procesu wraz z identyfikatorem korelacji, co nie jest magazynem, który da się przeszukać ani filtrować.',
      correlationNote:
        'Sama korelacja zapytań jest prawdziwa: każde zapytanie niesie X-Request-Id, a ten identyfikator jest jedynym połączeniem między logami systemowymi a rekordami audytu.',
    },

    audit: {
      title: 'Dziennik audytu i bezpieczeństwo',
      purpose:
        'Każde działanie administracyjne i wrażliwe dla bezpieczeństwa możliwe do prześledzenia, przeszukania i wyeksportowania jako dowód.',
      noStoreTitle: 'Magazyn audytu jeszcze nie istnieje',
      noStoreBody:
        'To nie jest pusty wynik wyszukiwania. W tej platformie nie ma magazynu audytu tylko-do-dopisywania, więc nie ma rekordów do pokazania, filtrowania ani eksportu. Poniższe klasy zdarzeń to zatwierdzony kontrakt na moment, w którym taki magazyn powstanie.',
      actionClassesTitle: 'Audytowane klasy zdarzeń',
      recordShapeTitle: 'Rekord audytu',
      separationNote:
        'Logi systemowe i rekordy audytu to różne magazyny o różnej retencji i różnych gwarancjach. Nigdy nie są łączone; identyfikator korelacji jest jedynym połączeniem.',
      readOnlyNote:
        'Audyt jest tylko do odczytu dla każdej roli. Z założenia nie istnieje ścieżka aktualizacji ani usunięcia.',
    },

    settings: {
      title: 'Ustawienia platformy',
      purpose: 'Konfiguracja, retencja i polityka dostępu.',
      groups: {
        taxInvoicing: 'Podatki i fakturowanie',
        ksef: 'KSeF',
        providers: 'Dostawcy',
        access: 'Dostęp',
        retention: 'Dane i retencja',
        localisation: 'Lokalizacja',
      },
      requirement:
        'Wymaga magazynu ustawień działającego w czasie rzeczywistym. Konfiguracja jest odczytywana ze środowiska przy starcie i nie da się jej zmienić z tego panelu.',
      localisation: {
        adminLanguages: 'Języki panelu',
        adminLanguagesValue: 'English, Polski',
        dateFormat: 'Format daty',
        numberFormat: 'Format liczb',
        timezone: 'Strefa czasowa',
      },
      secretsNote:
        'Żaden klucz API, sekret OAuth ani ciąg połączenia nie jest tu pokazywany i żaden nie będzie edytowalny z poziomu przeglądarki.',
    },
  },
};
