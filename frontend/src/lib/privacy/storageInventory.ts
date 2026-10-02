/**
 * ════════════════════════════════════════════════════════════════════════════
 * TRUST & CONVERSATIONAL EXPERIENCE R1 §12 + CTO ADDENDUM — COOKIES AND SIMILAR TECHNOLOGIES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The ONE inventory the Cookies page renders. Every row was read from the code (see
 * storageInventory.spec.ts, which fails if a cookie or storage key exists in the code but not
 * here, or here but not in the code). Categories are only the ones that actually exist:
 *
 *   STRICTLY_NECESSARY  sign-in, security, guest conversations and the requested Ask flow
 *   PREFERENCES         language and appearance, set when the reader chooses them
 *
 * There is NO analytics, advertising or tracking storage, so the page shows no such category and
 * no Accept/Reject banner: there is nothing optional to consent to. Preferences can be removed at
 * any time from the same page (PreferenceStorageControl).
 */
export type StorageCategory = 'STRICTLY_NECESSARY' | 'PREFERENCES';
export type StorageKind = 'COOKIE' | 'LOCAL_STORAGE' | 'SESSION_STORAGE' | 'CACHE_STORAGE';

type Text = { readonly en: string; readonly pl: string };

export interface StorageItem {
  /** Exact name. A secure cookie is sent as `__Host-<name>` on https. */
  readonly name: string;
  readonly kind: StorageKind;
  readonly category: StorageCategory;
  readonly purpose: Text;
  readonly data: Text;
  readonly lifetime: Text;
  /** When it is first written — so "before any choice" is answered per item. */
  readonly whenSet: Text;
}

export const STORAGE_INVENTORY: readonly StorageItem[] = [
  {
    name: 'gna_session',
    kind: 'COOKIE',
    category: 'STRICTLY_NECESSARY',
    purpose: { en: 'Keeps you signed in.', pl: 'Utrzymuje zalogowanie.' },
    data: {
      en: 'A random token (we store only its hash).',
      pl: 'Losowy token (przechowujemy tylko jego skrót).',
    },
    lifetime: { en: '30 days', pl: '30 dni' },
    whenSet: { en: 'After you sign in with Google.', pl: 'Po zalogowaniu przez Google.' },
  },
  {
    name: 'gna_csrf',
    kind: 'COOKIE',
    category: 'STRICTLY_NECESSARY',
    purpose: {
      en: 'Protects your requests against forgery by other sites.',
      pl: 'Chroni Twoje żądania przed podszywaniem się innych witryn.',
    },
    data: { en: 'A random security token.', pl: 'Losowy token bezpieczeństwa.' },
    lifetime: {
      en: 'Up to 30 days (signed in) or 7 days (guest)',
      pl: 'Do 30 dni (zalogowany) lub 7 dni (gość)',
    },
    whenSet: {
      en: 'When you sign in or send your first guest question.',
      pl: 'Po zalogowaniu lub wysłaniu pierwszego pytania jako gość.',
    },
  },
  {
    name: 'gna_oauth_flow',
    kind: 'COOKIE',
    category: 'STRICTLY_NECESSARY',
    purpose: {
      en: 'Completes a Google sign-in safely.',
      pl: 'Bezpiecznie kończy logowanie przez Google.',
    },
    data: {
      en: 'Signed sign-in state and the page to return to.',
      pl: 'Podpisany stan logowania i strona powrotu.',
    },
    lifetime: {
      en: '5 minutes, removed when sign-in finishes',
      pl: '5 minut, usuwany po zakończeniu logowania',
    },
    whenSet: { en: 'When you press Sign in.', pl: 'Po naciśnięciu Zaloguj.' },
  },
  {
    name: 'gna_guest',
    kind: 'COOKIE',
    category: 'STRICTLY_NECESSARY',
    purpose: {
      en: 'Links your guest questions into one conversation.',
      pl: 'Łączy pytania gościa w jedną rozmowę.',
    },
    data: {
      en: 'A random token (we store only its hash).',
      pl: 'Losowy token (przechowujemy tylko jego skrót).',
    },
    lifetime: { en: 'Up to 7 days', pl: 'Do 7 dni' },
    whenSet: {
      en: 'When you send your first guest question — never on page load.',
      pl: 'Po wysłaniu pierwszego pytania jako gość — nigdy przy wczytaniu strony.',
    },
  },
  {
    name: 'globalnews-ai-language',
    kind: 'COOKIE',
    category: 'PREFERENCES',
    purpose: { en: 'Shows pages in your language.', pl: 'Wyświetla strony w Twoim języku.' },
    data: { en: '“en” or “pl”.', pl: '„en” lub „pl”.' },
    lifetime: { en: '1 year', pl: '1 rok' },
    whenSet: {
      en: 'When you choose a language. On the Map and Conflict pages it can also be set from your browser’s language.',
      pl: 'Po wybraniu języka. Na stronach Mapa i Konflikty może też zostać ustawiony na podstawie języka przeglądarki.',
    },
  },
  {
    name: 'globalnews-ai:language',
    kind: 'LOCAL_STORAGE',
    category: 'PREFERENCES',
    purpose: {
      en: 'Remembers your language in this browser.',
      pl: 'Zapamiętuje język w tej przeglądarce.',
    },
    data: { en: '“en” or “pl”.', pl: '„en” lub „pl”.' },
    lifetime: { en: 'Until you remove it', pl: 'Do usunięcia' },
    whenSet: { en: 'Together with the language cookie.', pl: 'Razem z plikiem cookie języka.' },
  },
  {
    name: 'globalnews-ai-theme',
    kind: 'COOKIE',
    category: 'PREFERENCES',
    purpose: {
      en: 'Remembers your appearance (light, dark, system or scheduled).',
      pl: 'Zapamiętuje wygląd (jasny, ciemny, systemowy lub według harmonogramu).',
    },
    data: {
      en: 'Your choice and, for Scheduled, your day hours.',
      pl: 'Twój wybór, a dla harmonogramu — godziny dnia.',
    },
    lifetime: { en: '1 year', pl: '1 rok' },
    whenSet: { en: 'Only when you change the appearance.', pl: 'Tylko po zmianie wyglądu.' },
  },
  {
    name: 'globalnews-ai:ask-kept-question',
    kind: 'SESSION_STORAGE',
    category: 'STRICTLY_NECESSARY',
    purpose: {
      en: 'Keeps your unsent question while you sign in.',
      pl: 'Zachowuje niewysłane pytanie podczas logowania.',
    },
    data: { en: 'The text of the unsent question.', pl: 'Treść niewysłanego pytania.' },
    lifetime: { en: 'This tab only; removed once read', pl: 'Tylko ta karta; usuwane po odczycie' },
    whenSet: {
      en: 'When you sign in with a question still in the box.',
      pl: 'Gdy logujesz się z pytaniem w polu.',
    },
  },
  {
    name: 'gna.storyTask.v1',
    kind: 'SESSION_STORAGE',
    category: 'STRICTLY_NECESSARY',
    purpose: {
      en: 'Returns you to the story action you started before signing in.',
      pl: 'Przywraca działanie przy artykule rozpoczęte przed zalogowaniem.',
    },
    data: {
      en: 'The story reference, title and source, and any comment draft.',
      pl: 'Odnośnik, tytuł i źródło artykułu oraz ewentualny szkic komentarza.',
    },
    lifetime: { en: 'This tab only; removed once read', pl: 'Tylko ta karta; usuwane po odczycie' },
    whenSet: {
      en: 'When a story action needs sign-in.',
      pl: 'Gdy działanie przy artykule wymaga zalogowania.',
    },
  },
  {
    name: 'gn.map.signInReturn',
    kind: 'SESSION_STORAGE',
    category: 'STRICTLY_NECESSARY',
    purpose: {
      en: 'Returns you to the same map view after signing in.',
      pl: 'Przywraca ten sam widok mapy po zalogowaniu.',
    },
    data: { en: 'The map view settings.', pl: 'Ustawienia widoku mapy.' },
    lifetime: { en: 'This tab only; removed once read', pl: 'Tylko ta karta; usuwane po odczycie' },
    whenSet: { en: 'When you sign in from the map.', pl: 'Gdy logujesz się z mapy.' },
  },
  {
    name: 'gna:analysis-compute-consent',
    kind: 'SESSION_STORAGE',
    category: 'STRICTLY_NECESSARY',
    purpose: {
      en: 'Remembers, for one minute, that you confirmed running an analysis.',
      pl: 'Przez minutę pamięta, że potwierdzono uruchomienie analizy.',
    },
    data: { en: 'Which analysis and when.', pl: 'Która analiza i kiedy.' },
    lifetime: { en: '60 seconds', pl: '60 sekund' },
    whenSet: { en: 'When you confirm an analysis.', pl: 'Po potwierdzeniu analizy.' },
  },
  {
    name: 'gn-conflict-return-v1',
    kind: 'SESSION_STORAGE',
    category: 'STRICTLY_NECESSARY',
    purpose: {
      en: 'Restores your place on the Conflict page when you come back.',
      pl: 'Przywraca miejsce na stronie Konflikty po powrocie.',
    },
    data: { en: 'The selected conflict and view.', pl: 'Wybrany konflikt i widok.' },
    lifetime: { en: 'This tab only', pl: 'Tylko ta karta' },
    whenSet: {
      en: 'When you use the Conflict page.',
      pl: 'Podczas korzystania ze strony Konflikty.',
    },
  },
  {
    name: 'gna-pwa-v7-precache',
    kind: 'CACHE_STORAGE',
    category: 'STRICTLY_NECESSARY',
    purpose: { en: 'Offline page and app icons.', pl: 'Strona offline i ikony aplikacji.' },
    data: {
      en: 'Static app files only — no questions, answers or pages.',
      pl: 'Tylko statyczne pliki aplikacji — bez pytań, odpowiedzi i stron.',
    },
    lifetime: { en: 'Until the app version changes', pl: 'Do zmiany wersji aplikacji' },
    whenSet: {
      en: 'After the page loads (installable app support).',
      pl: 'Po wczytaniu strony (obsługa aplikacji).',
    },
  },
  {
    name: 'gna-pwa-v7-runtime',
    kind: 'CACHE_STORAGE',
    category: 'STRICTLY_NECESSARY',
    purpose: {
      en: 'Faster loading of the app’s own files.',
      pl: 'Szybsze wczytywanie plików aplikacji.',
    },
    data: {
      en: 'Static app files and images only — never API responses or pages.',
      pl: 'Tylko statyczne pliki i obrazy aplikacji — nigdy odpowiedzi API ani strony.',
    },
    lifetime: {
      en: 'Until the app version changes (max 100 files)',
      pl: 'Do zmiany wersji aplikacji (maks. 100 plików)',
    },
    whenSet: { en: 'As app files load.', pl: 'Podczas wczytywania plików aplikacji.' },
  },
];

/** The browser storage the reader can remove themselves (preferences only). */
export const PREFERENCE_COOKIES = STORAGE_INVENTORY.filter(
  (i) => i.category === 'PREFERENCES' && i.kind === 'COOKIE',
).map((i) => i.name);
export const PREFERENCE_LOCAL_KEYS = STORAGE_INVENTORY.filter(
  (i) => i.category === 'PREFERENCES' && i.kind === 'LOCAL_STORAGE',
).map((i) => i.name);
