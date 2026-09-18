import type { SupportDictionary } from './supportEn';

/**
 * S4 — Polish dictionary for the authenticated user Support surface.
 *
 * Typed as `SupportDictionary`, so a key added to the English file and
 * forgotten here is a COMPILE ERROR rather than an undefined label a Polish
 * user meets at runtime. `supportLocalization.spec.ts` additionally walks both
 * objects and asserts the Polish is real translation rather than English
 * copied across.
 *
 * The `GN-` reference prefix is not translated anywhere: it is an identifier a
 * person reads aloud and types back, and it must survive that trip unchanged
 * in both languages.
 */
export const supportPl: SupportDictionary = {
  meta: {
    title: 'Pomoc — GlobalNews AI',
    description: 'Załóż zgłoszenie i śledź odpowiedzi.',
  },

  heading: 'Pomoc',
  intro:
    'Zadaj pytanie, zgłoś problem lub prześlij opinię. Wszystkie odpowiedzi zobaczysz tutaj — nigdzie indziej ich nie wysyłamy.',

  signedOut: {
    title: 'Zaloguj się, aby założyć zgłoszenie',
    body: 'Zgłoszenia są powiązane z kontem, dzięki czemu odpowiedzi możesz przeczytać wyłącznie Ty. Sam GlobalNews AI działa bez konta.',
    signIn: 'Zaloguj się przez Google',
  },

  list: {
    heading: 'Twoje zgłoszenia',
    newRequest: 'Nowe zgłoszenie',
    emptyTitle: 'Nie masz jeszcze żadnego zgłoszenia',
    emptyBody: 'Gdy je założysz, pojawi się tutaj razem ze wszystkimi odpowiedziami.',
    errorTitle: 'Nie udało się wczytać Twoich zgłoszeń',
    errorBody:
      'Zapytanie się nie powiodło. Zamiast niepełnej listy nie pokazujemy nic — jeśli masz otwarte zgłoszenia, nadal tam są.',
    loading: 'Wczytywanie zgłoszeń…',
    retry: 'Spróbuj ponownie',
    messageCount: 'wiadomości',
    opened: 'Założone',
    lastActivity: 'Ostatnia aktywność',
  },

  form: {
    heading: 'Nowe zgłoszenie',
    categoryLabel: 'Czego dotyczy sprawa?',
    categoryPlaceholder: 'Wybierz jedną opcję',
    subjectLabel: 'Temat',
    subjectPlaceholder: 'Krótkie podsumowanie',
    messageLabel: 'Wiadomość',
    messagePlaceholder: 'Co się stało i czego oczekiwałeś?',
    submit: 'Wyślij zgłoszenie',
    submitting: 'Wysyłanie…',
    sendingNotice: 'Wysyłanie zgłoszenia. Pojawi się tutaj zaraz po zapisaniu.',
    cancel: 'Anuluj',
    charactersRemaining: 'pozostało znaków',
    tooShortSubject: 'Temat musi mieć co najmniej 3 znaki.',
    tooShortMessage: 'Opisz problem w co najmniej 10 znakach.',
    categoryRequired: 'Wybierz, czego dotyczy sprawa.',
  },

  thread: {
    back: 'Wszystkie zgłoszenia',
    reference: 'Numer',
    replyLabel: 'Odpowiedź',
    replyPlaceholder: 'Dopisz coś do tego zgłoszenia',
    send: 'Wyślij odpowiedź',
    sending: 'Wysyłanie…',
    tooShortReply: 'Napisz co najmniej 2 znaki.',
    errorTitle: 'Nie udało się wczytać tego zgłoszenia',
    errorBody: 'Zapytanie się nie powiodło. Zamiast fragmentu rozmowy nie pokazujemy nic.',
    loading: 'Wczytywanie…',
    /* SUPPORT CLOSURE (G4) — patrz komentarz przy tym kluczu w supportEn.ts. */
    resolvedNotice:
      'To zgłoszenie jest rozwiązane. Dotyczy to samego zgłoszenia — nie jest to potwierdzenie, że zgłoszony przez Ciebie problem został naprawiony, chyba że mówi o tym odpowiedź. Odpowiedź na nie otworzy je ponownie i ktoś zajmie się nim jeszcze raz.',
  },

  errors: {
    sendFailedTitle: 'Wiadomość nie została wysłana',
    sendFailedBody:
      'Nic nie zostało wysłane. Albo minęło zbyt mało czasu od poprzedniej wiadomości, albo masz już maksymalną liczbę otwartych zgłoszeń — zamknięcie jednego pozwoli założyć kolejne.',
    genericTitle: 'Coś poszło nie tak',
    genericBody: 'Nic nie zostało wysłane. Spróbuj ponownie za chwilę.',
  },

  categories: {
    NEWS_QUESTION: 'Pytanie o materiał',
    BUG_REPORT: 'Coś nie działa',
    CONTENT_REPORT: 'Zgłoś treść',
    FEEDBACK: 'Opinia lub sugestia',
    ABUSE_REPORT: 'Zgłoś nadużycie',
    ACCOUNT_PROBLEM: 'Problem z kontem',
    OTHER: 'Coś innego',
  },

  statuses: {
    OPEN: 'Otwarte',
    AWAITING_USER: 'Czeka na Ciebie',
    AWAITING_ADMIN: 'U naszego zespołu',
    RESOLVED: 'Rozwiązane',
  },


  conversation: {
    heading: 'Pomoc',
    /* C-1 */
    intro:
      'Zapytaj o GlobalNews AI: jak coś działa, gdzie to znaleźć albo o napotkany problem. Odpowiedzi w tej rozmowie pochodzą od agenta automatycznego i nie zawsze są dostępne.',

    disclosure: {
      heading: 'Zanim napiszesz',
      /* C-2 */
      beforeFirstSend:
        'Aby odpowiadać na pytania o wydarzenia, GlobalNews AI przesyła tę rozmowę — wszystko, co w niej piszesz, nie tylko ostatnią wiadomość — do zewnętrznego dostawcy modelu. Odpowiedzi o samym produkcie są napisane przez ludzi z GlobalNews AI i nie są nigdzie wysyłane. Nie wpisuj tutaj haseł, danych płatniczych ani dokumentów. Jeśli założysz zgłoszenie do wsparcia, informacje przesłane w tym zgłoszeniu może przeczytać zespół wsparcia GlobalNews AI.',
      /* C-3 */
      compact:
        'Pytania o wydarzenia wysyłają tę rozmowę do zewnętrznego dostawcy modelu. Odpowiedzi o produkcie — nie.',
    },

    composer: {
      label: 'Twoja wiadomość',
      placeholder: 'Zapytaj o GlobalNews AI',
      send: 'Wyślij',
      tooShort: 'Napisz co najmniej 2 znaki.',
    },

    /* C-16 */
    working: {
      label: 'Przygotowywanie odpowiedzi',
      ariaLabel: 'Agent automatyczny przygotowuje odpowiedź. Pojawi się ona w tej rozmowie.',
    },

    /* C-4 — genderless in Polish, deliberately. See the finding in `05` §3. */
    withheld: {
      body:
        'Nie mam tutaj odpowiedzi, za którą można ręczyć. To stwierdzenie o tym, co da się potwierdzić, a nie o tym, czy Twoje pytanie ma odpowiedź. Nie ma tu zgadywania — pewnie brzmiąca odpowiedź bez pokrycia byłaby gorsza niż jej brak.',
    },

    /* C-5 — genderless in Polish. */
    unavailable: {
      body:
        'Nie mogę odpowiedzieć w tej turze. To ograniczenie po mojej stronie, a nie kwestia Twojego pytania, i nie wiadomo, czy późniejsze pytanie pomoże. Twoja wiadomość jest zapisana w tej rozmowie, a osoba z zespołu wsparcia może się nią zająć.',
    },

    /* C-6 */
    authored: {
      limits:
        'Tę odpowiedź napisał zespół wsparcia GlobalNews AI i opisuje ona, jak produkt działa dzisiaj. Odpowiedz tutaj, jeśli to nie odpowiada na Twoje pytanie.',
    },

    /* Carried unchanged from the live release. */
    analysis: {
      preamble: 'Na podstawie doniesień zapisanych przez GlobalNews AI mogę potwierdzić, co następuje:',
      sourcesLabel: 'Źródła, na których to się opiera',
      limits:
        'Pochodzi to wyłącznie z wymienionych wyżej doniesień i może być niepełne lub nieaktualne. Nie jest to odpowiedź wsparcia technicznego i nie potwierdza żadnej naprawy. Odpowiedz tutaj, jeśli to nie odpowiada na Twoje pytanie, a zajmie się tym człowiek.',
    },

    /* C-7 */
    partial: {
      notice:
        'To obejmuje tylko część tego, o co pytasz. Reszta pozostaje bez odpowiedzi i nie została uzupełniona — zapytaj ponownie o tę część albo niech zajmie się tym człowiek.',
    },

    /* C-8 */
    account: {
      cannotSee:
        'Nie mam wglądu w Twoje konto, więc nie sprawdzę, co się z nim stało. Mogę wyjaśnić, jak coś działa i gdzie to znaleźć, a w samo konto zajrzy osoba z zespołu wsparcia.',
    },

    escalation: {
      /* C-9 — renderowane tylko tam, gdzie transport przekazania istnieje. */
      offer: 'Może się tym zająć człowiek — napisz o tym, a rozmowa zostanie przekazana dalej.',
      action: 'Poproś o człowieka',

      /* R2-1 — genderless, no number, no promise of time. */
      noHandoff:
        'Ta rozmowa nie jest nikomu przesyłana i nikt nie jest powiadamiany o tym, że tu piszesz. Aby skontaktować się z osobą z zespołu, załóż zgłoszenie na tej stronie — zgłoszenie trafia do zespołu wsparcia.',
      openRequest: 'Załóż zgłoszenie do wsparcia',
    },

    transition: {
      /* C-10 */
      queued:
        'Ta rozmowa jest teraz u zespołu wsparcia. Nic więcej nie zostanie tu odpowiedziane automatycznie.',
      /* C-11 */
      humanArrived:
        'Do rozmowy dołączyło wsparcie GlobalNews AI. Nie rozmawiasz już z agentem automatycznym.',
    },

    /* C-12 */
    sensitive: {
      volunteered:
        'Nie przesyłaj tutaj haseł, danych płatniczych ani dokumentów tożsamości — ta rozmowa nie jest dla nich bezpiecznym kanałem, a tego, co już zostało wysłane, nie da się cofnąć. W sprawach konta pomoże bezpośrednio osoba z zespołu wsparcia.',
    },

    context: {
      limitReached:
        'Ta rozmowa jest już na tyle długa, że jej najwcześniejsze części nie są uwzględniane przy przygotowywaniu odpowiedzi. Rozpoczęcie nowej rozmowy daje czysty początek.',
      tooLong:
        'Ta rozmowa osiągnęła limit długości, więc nic więcej nie zostanie tu odpowiedziane automatycznie. Rozpocznij nową rozmowę, aby pytać dalej.',
    },

    /* C-13 */
    newConversation: {
      hint: 'Rozpoczęcie nowej rozmowy sprawia, że ta nie jest wysyłana przy kolejnych pytaniach.',
      action: 'Rozpocznij nową rozmowę',
    },

    /* C-14 */
    locale: {
      outOfScope:
        'Odpowiedzi automatyczne są dostępne wyłącznie po angielsku i po polsku. Napisz tutaj w jednym z tych języków albo niech zajmie się tym osoba z zespołu wsparcia.',
    },

    close: {
      action: 'Zamknij tę rozmowę',
    },

    /* C-15 */
    closed: {
      reopen: 'Ta rozmowa jest zamknięta. Jeśli odpowiesz, zostanie ponownie otwarta u zespołu wsparcia.',
    },

    transcript: {
      label: 'Rozmowa z pomocą',
      liveRegionLabel: 'Najnowsza odpowiedź w tej rozmowie',
      systemTurnLabel: 'Stan tej rozmowy',
    },

    tickets: {
      heading: 'Twoje wcześniejsze zgłoszenia',
      body: 'Zgłoszenia założone przed powstaniem tej rozmowy nadal tu są, wraz ze wszystkimi odpowiedziami.',
      open: 'Otwórz wcześniejsze zgłoszenia',
      hide: 'Ukryj wcześniejsze zgłoszenia',
    },
  },
  authors: {
    USER: 'Ty',
    ADMIN: 'Wsparcie GlobalNews AI',
    SYSTEM_AI: 'Agent wsparcia GlobalNews AI · automatycznie',
  },
};
