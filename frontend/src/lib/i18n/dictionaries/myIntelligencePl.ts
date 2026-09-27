/**
 * MY INTELLIGENCE — POLISH COPY.
 *
 * The governed sentences (the New-since explainer, the sand boundary note and
 * the Watch-dormant line) are reproduced from the frozen R1.2 authority, which
 * supplies them in Polish as well as English. The remaining strings follow the
 * product's existing Polish register.
 *
 * "Intelligence" is rendered "Analiza", which is the word the shipped Polish
 * dictionary already uses for the Intelligence destination in
 * `mobileBottomNav`. The R1.2 Polish frames render that tab as "Wywiad".
 *
 * APPROVED LOCALIZATION DELTA FROM THE R1.2 FRAME — CTO ruling 3 of the R1.3
 * reconciliation: the implementation authority for this label is "Analiza",
 * not "Wywiad", and it is not to be changed back. The frames are the older
 * artefact here; one Polish word for one destination cannot mean two things in
 * the same product, and the shipped dictionary is what readers already see.
 */
export const myIntelligencePl = {
  eyebrow: 'MOJA ANALIZA',
  metaTitle: 'Moja analiza — GlobalNews AI',
  metaDescription: 'Twoje zapisane artykuły, obserwowane miejsca i to, co wykryliśmy od Twojej poprzedniej wizyty.',

  greetingNamed: 'Witaj ponownie, {name}',
  greetingAnonymous: 'Twoja analiza',
  accountSettings: 'Ustawienia konta',

  previousVisit: 'Poprzednia wizyta {date}',
  newlyIdentifiedCount: '{count} nowo wykrytych artykułów o obserwowanych miejscach',
  newlyIdentifiedCountOne: '1 nowo wykryty artykuł o obserwowanych miejscach',

  tabs: {
    ariaLabel: 'Sekcje Mojej analizy',
    overview: 'Przegląd',
    saved: 'Zapisane',
    following: 'Obserwuję',
    recent: 'Ostatnie',
  },
  select: 'Zaznacz',
  done: 'Gotowe',

  newSince: {
    title: 'Nowe od Twojej poprzedniej wizyty',
    /* FOLLOWING_AND_NEW_SINCE.md, Explainer PL — verbatim. */
    explainer:
      'Doniesienia o obserwowanych miejscach, które GlobalNewsAI wykrył od Twojej poprzedniej wizyty ({date}). Artykuł jest nowy, jeśli znaleźliśmy go po tej wizycie, nawet jeśli opublikowano go wcześniej. Sprawdzane przy otwarciu strony.',
    firstVisit:
      'Od następnej wizyty pojawią się tu doniesienia, które wykryjemy o obserwowanych miejscach. Przy pierwszej wizycie nic nie jest oznaczane jako nowe.',
    /* The empty state, verbatim from R1.2. */
    empty: 'Od poprzedniej wizyty nie wykryto nic nowego o obserwowanych miejscach.',
    unavailable: 'Nie udało się sprawdzić nowych doniesień. Zapisane artykuły są nadal dostępne.',
    identifiedAgo: 'wykryto {age}',
    publishedAgo: 'opublikowano {age}',
    countLabel: '{count} nowe',
  },

  saved: {
    title: 'Zapisane artykuły',
    viewAll: 'Pokaż wszystkie ({count})',
    empty: 'Zapisane artykuły pojawią się tutaj.',
    emptyAction: 'Przeglądaj najnowsze',
    savedAgo: 'zapisano {age}',
    filterAll: 'Wszystkie',
    filterNote: 'Filtrowanie odbywa się lokalnie. Nie uruchamia analizy AI.',
    sourceUnavailable:
      'Źródło niedostępne. Link wydawcy już się nie otwiera. Zachowujemy Twoje zapisane odniesienie.',
    noImage: 'Brak zdjęcia',
    save: 'Zapisz w Mojej analizie',
    unsave: 'Usuń z zapisanych',
    savedToast: 'Zapisano w Mojej analizie',
    unsavedToast: 'Usunięto z zapisanych',
    saveFailed: 'Nie udało się zapisać. Spróbuj ponownie.',
    toastView: 'Pokaż',
    toastUndo: 'Cofnij',
  },

  forYou: {
    title: 'Dla Ciebie',
    note: 'Polecane z obserwowanych miejsc. Nie tylko nowe artykuły.',
    reason: 'Ponieważ obserwujesz: {country}',
    empty: 'Na razie nic z obserwowanych krajów w bieżącym przeglądzie.',
  },

  following: {
    title: 'Obserwuję',
    manage: 'Zarządzaj na Mapie świata',
    newSince: '{count} nowych od poprzedniej wizyty',
    nothingNew: 'Nic nowego od poprzedniej wizyty',
    follow: 'Obserwuj',
    following: 'Obserwujesz',
    empty: 'Zacznij obserwować kraj na Mapie świata, aby zobaczyć go tutaj.',
    watchDormant:
      'Alerty Watch nie są dostępne w tej wersji Beta. Obserwowanie nie wysyła powiadomień.',
  },

  recent: {
    title: 'Ostatnie analizy',
    questionHistory: 'Historia pytań',
    note: 'Pojawią się tu wcześniej zadane pytania. Dawne odpowiedzi nie są aktualizowane; „Zapytaj ponownie” otwiera pytanie w Zapytaj AI i nic się nie uruchamia, dopóki nie naciśniesz Wyślij.',
    empty: 'Brak ostatnich analiz.',
    askAgain: 'Zapytaj ponownie',
    askedOn: 'Zapytano {date}',
  },

  selection: {
    countLabel: 'Zaznaczono: {count}',
    clear: 'Wyczyść',
    summary: 'Wybierz artykuły, a potem działanie. Każde działanie prosi o potwierdzenie, zanim się uruchomi.',
    pickAction: 'Wybierz działanie ({count})',
    selectAtLeast: 'Zaznacz co najmniej {count}',
    maxReached: 'Możesz zaznaczyć maksymalnie {count} artykułów.',
    aiTag: 'AI',
    modeLabel: 'Tryb zaznaczania',
    modeDone: 'Tryb zaznaczania · Gotowe',
    doneAria: 'Gotowe — zakończ tryb zaznaczania',
    storiesSelectedOne: 'Zaznaczone artykuły: {count}',
    storiesSelectedOther: 'Zaznaczone artykuły: {count}',
    statusOne: 'Zaznaczone artykuły: {count}. Tryb zaznaczania aktywny.',
    statusOther: 'Zaznaczone artykuły: {count}. Tryb zaznaczania aktywny.',
    statusNone: 'Tryb zaznaczania aktywny. Nie zaznaczono jeszcze artykułów.',
    guidance: 'Wybierz, co zrobić dalej',
    costNote: 'Działania AI zużywają moc obliczeniową. Zaznaczanie, filtrowanie i czyszczenie są bezpłatne.',
    aiActionAria: '{action} — działanie AI. Zużywa moc obliczeniową i prosi o potwierdzenie przed uruchomieniem.',
    moreActions: 'Pokaż więcej działań',
    introBody: 'Zaznaczone artykuły odblokowują działania analityczne. Porównaj je, podsumuj lub zapytaj o nie, kiedy zechcesz.',
    introCompute: 'AI uruchamia się dopiero wtedy, gdy potwierdzisz działanie AI.',
    introDismiss: 'Rozumiem',
    cannotSelect: 'Nie można zaznaczyć tego artykułu, ponieważ jego źródło jest niedostępne.',
    actions: {
      compare: 'Porównaj',
      summarize: 'Podsumuj',
      askAbout: 'Zapytaj o wybrane',
      explain: 'Wyjaśnij rozbieżności',
      whatChanged: 'Co się zmieniło',
      briefing: 'Utwórz briefing',
    },
  },

  compute: {
    titleCompare: 'Porównaj artykuły: {count}',
    titleSummarize: 'Podsumuj artykuły: {count}',
    titleAsk: 'Zapytaj o artykuły: {count}',
    titleExplain: 'Wyjaśnij rozbieżności w artykułach: {count}',
    titleWhatChanged: 'Co się zmieniło w artykułach: {count}',
    titleBriefing: 'Utwórz briefing z artykułów: {count}',
    storiesAttached: 'Dołączone artykuły: {count}',
    questionLabel: 'Twoje pytanie',
    questionPlaceholder: 'Czego chcesz się dowiedzieć o tych artykułach?',
    draftOnly: 'Tylko wersja robocza. Nic jeszcze nie zostało wysłane.',
    /* Verbatim from R1.2. */
    sandNote: 'Uruchamia analizę AI — Nic nie zostanie wysłane, dopóki nie potwierdzisz.',
    cancel: 'Anuluj',
    run: 'Uruchom porównanie',
    runGeneric: 'Uruchom analizę',
    send: 'Wyślij pytanie',
    languageNote: 'Zmiana języka nie uruchamia ponownie żadnej analizy.',
    running: 'Trwa analiza…',
    runningNote: 'Zaznaczone artykuły pozostają zaznaczone w trakcie analizy.',
    retry: 'Spróbuj ponownie',
    failedTitle: 'Analiza nie została ukończona. Zaznaczenie zostało zachowane.',
    missingRefOne: 'Pominięte artykuły bez zweryfikowanego identyfikatora: {count}.',
    missingRefOther: 'Pominięte artykuły bez zweryfikowanego identyfikatora: {count}.',
    tooFewVerified: 'Za mało zweryfikowanych artykułów dla tego działania (wymagane: {count}).',
    questionRequired: 'Wpisz pytanie, aby je wysłać.',
    resultLabel: 'Wynik',
    resultResolved: 'Odnalezione artykuły: {resolved} z {requested}',
    resultUnresolved: 'Nie znaleziono w zachowanych doniesieniach:',
    resultFullNote:
      'To pełny wynik dla zaznaczonych artykułów. Obszar analizy otwiera pojedyncze pytania, więc nie może ponownie otworzyć tego zaznaczenia bez uruchomienia innej analizy.',
    close: 'Zamknij',
  },

  states: {
    loading: 'Wczytywanie Twojej analizy…',
    degraded:
      'Części tej strony nie udało się wczytać. Zapisane artykuły i historia pytań są nienaruszone.',
    offline: 'Jesteś offline. Nic z tej strony nie jest przechowywane na tym urządzeniu.',
    error: 'Coś poszło nie tak podczas wczytywania tej strony.',
    retry: 'Ponów',
    signedOutTitle: 'Zaloguj się, aby otworzyć Moją analizę',
    signedOutBody:
      'Moja analiza przechowuje Twoje zapisane artykuły, obserwowane miejsca i to, co wykryliśmy od Twojej poprzedniej wizyty.',
    signedOutAction: 'Zaloguj się, aby kontynuować',
    signedOutReturn: 'Po zalogowaniu wrócisz do Mojej analizy.',
    emptyTitle: 'Na razie nic tu nie ma',
    emptyBody:
      'Zapisz artykuł, zacznij obserwować kraj albo zadaj pytanie — to, co zachowasz, pojawi się tutaj.',
  },

  fixtureBanner: 'DANE DEWELOPERSKIE · NIE NA ŻYWO',
  fixtureBannerDetail:
    'Zapisane artykuły, rekomendacje i granica poprzedniej wizyty na tej stronie to dane deweloperskie do przeglądu projektu. Nie są to dane produkcyjne i nic nie jest przechowywane.',
  sampleLabel: 'Przykład',

  homeLink: 'Otwórz Moją analizę',
  accountMenuItem: 'Moja analiza',
  accountMenuItemTag: 'Nowość',
};
