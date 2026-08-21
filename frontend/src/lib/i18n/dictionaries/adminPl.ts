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
        returning: 'POWRACAJĄCY · 7D',
        sessions: 'SESJE · 24H',
        aiQuestions: 'PYTANIA DO AI · 24H',
        clientErrors: 'BŁĘDY KLIENTA · 24H',
      },
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
      notImplementedBody:
        'W tej platformie nie istnieje żadna funkcja zgłoszeń, wiadomości ani powiadomień, a zaplecze nie ma w ogóle wysyłki wiadomości. Kolejka, wątek i oba pola odpowiedzi są pokazane jako zatwierdzona struktura. Nie pokazujemy żadnego zgłoszenia, użytkownika ani korespondencji, ponieważ żadne nie istnieją.',
      queueTitle: 'Kolejka',
      threadTitle: 'Rozmowa',
      replyComposer: 'Odpowiedź do użytkownika',
      noteComposer: 'Notatka wewnętrzna',
      visibilityUser: 'Widoczne dla użytkownika',
      visibilityInternal: 'Notatka wewnętrzna — niewidoczna dla użytkownika',
      visibilityNote:
        'Widoczność odpowiedzi będzie zapisanym polem egzekwowanym po stronie serwera, nigdy konwencją wyświetlania.',
      requestTypesTitle: 'Typy zgłoszeń',
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
      columns: {
        provider: 'Dostawca',
        health: 'Kondycja',
        mode: 'Tryb',
        checkedAt: 'Ostatnie sprawdzenie',
        message: 'Szczegóły',
        requests: 'Zapytania',
        failures: 'Błędy',
        latency: 'Opóźnienie',
        lastSuccess: 'Ostatni sukces',
        rateLimit: 'Limit zapytań',
      },
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
        'no-probe-configured': 'Dla tego komponentu nie skonfigurowano żadnej sondy.',
        'not-implemented': 'Ten komponent jest planowany i nie ma implementacji.',
      },
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
