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
    save: 'Zapisz artykuł',
    unsave: 'Usuń zapisany artykuł',
    saveUnavailable: 'Tego artykułu nie można jeszcze zapisać: nie ma go w zachowanych doniesieniach.',
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
    button: 'Obserwujesz: {count}',
    listTitle: 'Obserwowane kraje',
    filterLabel: 'Filtruj kraje',
    noMatch: 'Żaden obserwowany kraj nie pasuje.',
    followAria: 'Obserwuj: {country}',
    unfollowAria: 'Przestań obserwować: {country}',
    updateFailed: 'Nie udało się zaktualizować: {country}. Spróbuj ponownie.',
    close: 'Zamknij',
  },

  recent: {
    title: 'Ostatnie analizy',
    questionHistory: 'Historia pytań',
    note: 'Pojawią się tu wcześniej zadane pytania. Dawne odpowiedzi nie są aktualizowane; „Zapytaj ponownie” otwiera pytanie w Zapytaj AI i nic się nie uruchamia, dopóki nie naciśniesz Wyślij.',
    empty: 'Brak ostatnich analiz.',
    askAgain: 'Zapytaj ponownie',
    askAgainAria: 'Zapytaj ponownie: {question}',
    viewAll: 'Pokaż wszystkie ({count})',
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
    selectStories: 'Zaznacz artykuły',
    selectAria: 'Zaznacz artykuły. Włącz tryb zaznaczania. Zaznaczanie jest bezpłatne.',
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
    hookSelect: 'Zaznacz ten artykuł do działań analitycznych: {title}',
    hookRemove: 'Usuń ten artykuł z zaznaczonych: {title}',
    hookTitle: 'Zaznacz do analizy',
    hookHint: 'Użyj piaskowych przycisków + przy artykułach, aby zaznaczyć to, co chcesz przeanalizować.',
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

  /* PREMIUM WORKSPACE R1 — COPY_EN_PL.md. "Intelligence" = "Analiza" (CTO localisation ruling). */
  workspace: {
    subcopy: 'Doniesienia, zmiany i analizy dopasowane do tego, co obserwujesz i badasz.',
    workspaceLabel: 'OBSZAR ROBOCZY',
    railLabel: 'Obszar roboczy Moja analiza',
    openRail: 'Otwórz nawigację obszaru roboczego',
    collapseRail: 'Zwiń nawigację obszaru roboczego',
    pin: 'Przypnij panel',
    unpin: 'Odepnij panel',
    openMenu: 'Otwórz menu',
    closeMenu: 'Zamknij menu',
    search: 'Szukaj',
    account: 'Konto',
    groups: {
      mine: 'MOJA ANALIZA',
      collections: 'KOLEKCJE',
      intelligence: 'ANALIZA',
      specialists: 'SPECJALIŚCI',
      deep: 'POGŁĘBIONA ANALIZA',
      account: 'KONTO I USTAWIENIA',
    },
    items: {
      today: 'Dziś dla mnie',
      forYou: 'Dla Ciebie',
      newSince: 'Nowe od ostatniej wizyty',
      saved: 'Zapisane',
      following: 'Obserwuję',
      history: 'Historia pytań',
      selected: 'Zaznaczone artykuły',
      selectedSub: 'Porównaj, streść, przygotuj briefing',
      analysisWorkspace: 'Obszar analizy',
      analysisWorkspaceSub: 'Otwórz pełną analizę z Zapytaj AI',
      briefings: 'Briefingi z zaznaczonych artykułów',
      briefingsSub: 'Zaznacz artykuły, potem Przygotuj briefing',
      deepIntelligence: 'Deep Intelligence',
      deepIntelligenceSub: 'Zaawansowana analiza o wyższym zużyciu mocy obliczeniowej',
      accountItem: 'Konto',
      preferences: 'Preferencje',
      language: 'Język',
      plan: 'Plan i wykorzystanie',
      planStatus: 'Dostęp Beta · brak aktywnego planu płatnego',
      settings: 'Ustawienia',
      signOut: 'Wyloguj się',
      betaAccess: 'Dostęp Beta',
    },
    domains: {
      map: 'Mapa świata',
      politics: 'Polityka',
      economy: 'Gospodarka',
      market: 'Rynek',
      energy: 'Energia',
      conflict: 'Konflikty i bezpieczeństwo',
      humanitarian: 'Pomoc humanitarna',
    },
    whatChanged: 'CO SIĘ ZMIENIŁO',
    newShort: 'Doniesienia o obserwowanych miejscach wykryte od {date}. Sprawdzane przy otwarciu strony.',
    viewAll: 'Pokaż wszystko',
    viewAllCount: 'Pokaż wszystko ({count})',
    back: 'Wróć do Dziś dla mnie',
    promiseEyebrow: 'BUDUJ ANALIZĘ',
    promiseTitle: 'Zamień doniesienia w analizę',
    promiseBody:
      'Zaznacz kilka artykułów, aby porównać doniesienia, wskazać zmiany, wyjaśnić rozbieżności lub przygotować briefing.',
    explore: 'Przeglądaj obszary analizy',
    exploreNote: 'Obszary analizy w GlobalNewsAI.',
    preview: 'Podgląd',
    goDeeper: 'Pogłęb analizę',
    deepEyebrow: 'POGŁĘBIONA ANALIZA',
    notInBeta: 'Poza wersją Beta',
    historyShort: 'Dawne odpowiedzi nie są aktualizowane. Nic się nie uruchamia, dopóki nie naciśniesz Wyślij.',
    selectedRemove: 'Usuń z zaznaczenia: {title}',
    specialists: {
      group: 'SPECJALIŚCI',
      moduleTitle: 'Analizy specjalistyczne',
      moduleNote: 'Skupione obszary jednego rodzaju analizy. Kontekstem jest kraj.',
      viewAll: 'Pokaż specjalistów',
      pageTitle: 'Specjaliści',
      pageNote:
        'Specjaliści to skupione obszary analityczne. Działają obok ogólnych obszarów analizy i otwierają się z krajem lub miejscem jako kontekstem. Otwarcie nie uruchamia analizy AI.',
      elections: 'Wybory',
      countryAware: 'Według kraju',
      country: 'Kraj',
      elFamily: 'SPECJALISTA WEDŁUG KRAJU',
      elBody:
        'Jeden obszar Wybory dla każdego kraju z zatwierdzonymi danymi wyborczymi. Wybrany kraj wyznacza kontekst.',
      openPreview: 'Otwórz podgląd Wyborów',
      previewNote: 'Trasa podglądu: /election-visual-preview · bez przypisanego kraju',
      noCountries: 'Zacznij obserwować kraj, aby użyć go tutaj jako kontekstu.',
      unsupportedTitle: 'Brak zatwierdzonych danych wyborczych: {country}',
      unsupportedBody:
        'Wybory otwierają się dla kraju tylko wtedy, gdy dostępne są zatwierdzone dane wyborcze. Niczego nie szacujemy ani nie uzupełniamy.',
      imihigo: 'Imihigo',
      imihigoSub: 'Rwanda · Analiza dystryktów',
      openImihigo: 'Otwórz Imihigo',
      dpFamily: 'REALIZACJA I WYNIKI',
      dpBody: 'Systemy realizacji usług publicznych i oceny wyników, każdy pod własną nazwą krajową.',
      dpFuture:
        'Inne krajowe systemy realizacji pojawią się tu pod własnymi nazwami, gdy będą zatwierdzone dane. Nie są nazywane Imihigo.',
    },
  },

  interests: {
    labels: {
      politics_governance: 'Polityka i rządzenie',
      security_conflict: 'Bezpieczeństwo i konflikty',
      economy_markets: 'Gospodarka i rynki',
      diplomacy: 'Dyplomacja',
      humanitarian_society: 'Sprawy humanitarne i społeczne',
      energy_infrastructure: 'Energia i infrastruktura',
      technology: 'Technologia',
      regional_affairs: 'Sprawy regionalne',
      health_science: 'Zdrowie i nauka',
      sports: 'Sport',
      entertainment: 'Rozrywka',
    },
    tune: 'Dopasuj zainteresowania',
    title: 'Twoje zainteresowania',
    note: 'Dla Ciebie pokazuje zachowane doniesienia z obserwowanych miejsc, które pasują do wybranych tu zainteresowań. Niczego nie wnioskujemy, a wybór nie uruchamia analizy AI.',
    apply: 'Zastosuj',
    showAll: 'Pokaż wszystko',
    saving: 'Zapisywanie…',
    failed: 'Nie udało się zapisać zainteresowań. Spróbuj ponownie.',
    close: 'Zamknij',
    matchCountOne: '1 artykuł pasuje do Twoich zainteresowań.',
    matchCountOther: 'Artykuły pasujące do Twoich zainteresowań: {count}.',
    noMatch: 'Żadne zachowane doniesienia z obserwowanych miejsc nie pasują teraz do Twoich zainteresowań.',
    invite: 'Dopasuj zainteresowania, aby skupić Dla Ciebie na tym, co ważne.',
    broader: 'Pokaż szersze doniesienia',
    focused: 'Pokaż tylko moje zainteresowania',
  },

};
