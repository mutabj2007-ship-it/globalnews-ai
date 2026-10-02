/** TRUST R1 §12 — Cookies & similar technologies page copy (EN/PL). Facts only. */
export const COOKIES_PAGE = {
  en: {
    title: 'Cookies and similar technologies',
    intro:
      'This page lists every cookie and similar browser storage (local storage, session storage and the app’s offline cache) that GlobalNews AI and Ask GlobalNewsAI use, what each one stores and how long it lasts.',
    noTracking:
      'We use no analytics, advertising or tracking cookies and load no third-party trackers, so there is nothing optional to accept or reject. Images inside news stories load directly from their publishers.',
    necessaryHeading: 'Strictly necessary',
    necessaryBody:
      'Needed for sign-in, security, guest conversations and finishing what you started. They cannot be switched off without breaking those features, and none is set just because you opened a page.',
    preferencesHeading: 'Preferences',
    preferencesBody:
      'Your language and appearance. They are set when you choose them and you can remove them below at any time; the site then falls back to English and your device’s light or dark setting.',
    columns: {
      name: 'Name',
      type: 'Type',
      purpose: 'Purpose',
      data: 'What it stores',
      lifetime: 'How long',
      whenSet: 'When it is set',
    },
    kinds: {
      COOKIE: 'Cookie',
      LOCAL_STORAGE: 'Local storage',
      SESSION_STORAGE: 'Session storage',
      CACHE_STORAGE: 'Offline cache',
    },
    settingsHeading: 'Your preference settings',
    remove: 'Remove my preference settings',
    removed: 'Removed. The page will reload in English with your device’s appearance.',
    nothing: 'No preference settings are stored in this browser.',
    privacyLink: 'Read the Privacy Notice',
  },
  pl: {
    title: 'Pliki cookie i podobne technologie',
    intro:
      'Ta strona wymienia każdy plik cookie i każdą podobną pamięć przeglądarki (pamięć lokalna, pamięć sesji i pamięć podręczna aplikacji offline), których używają GlobalNews AI i Ask GlobalNewsAI, co przechowują i jak długo.',
    noTracking:
      'Nie używamy analitycznych, reklamowych ani śledzących plików cookie i nie wczytujemy zewnętrznych narzędzi śledzących, więc nie ma nic opcjonalnego do zaakceptowania ani odrzucenia. Zdjęcia w artykułach wczytywane są bezpośrednio od wydawców.',
    necessaryHeading: 'Niezbędne',
    necessaryBody:
      'Potrzebne do logowania, bezpieczeństwa, rozmów gości i dokończenia rozpoczętych działań. Nie można ich wyłączyć bez utraty tych funkcji i żaden nie jest ustawiany tylko dlatego, że otwarto stronę.',
    preferencesHeading: 'Preferencje',
    preferencesBody:
      'Twój język i wygląd. Są ustawiane, gdy je wybierasz, i możesz je w każdej chwili usunąć poniżej; strona wróci wtedy do języka angielskiego i ustawienia jasnego lub ciemnego motywu urządzenia.',
    columns: {
      name: 'Nazwa',
      type: 'Rodzaj',
      purpose: 'Cel',
      data: 'Co przechowuje',
      lifetime: 'Jak długo',
      whenSet: 'Kiedy jest ustawiany',
    },
    kinds: {
      COOKIE: 'Plik cookie',
      LOCAL_STORAGE: 'Pamięć lokalna',
      SESSION_STORAGE: 'Pamięć sesji',
      CACHE_STORAGE: 'Pamięć offline',
    },
    settingsHeading: 'Twoje ustawienia preferencji',
    remove: 'Usuń moje ustawienia preferencji',
    removed: 'Usunięto. Strona wczyta się ponownie po angielsku z wyglądem urządzenia.',
    nothing: 'W tej przeglądarce nie zapisano ustawień preferencji.',
    privacyLink: 'Przeczytaj Informację o prywatności',
  },
} as const;

export type CookiesPageLocale = keyof typeof COOKIES_PAGE;
