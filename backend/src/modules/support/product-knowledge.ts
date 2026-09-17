/**
 * ════════════════════════════════════════════════════════════════════════════
 * SUPPORT PRODUCT KNOWLEDGE — THE AUTHORED CORPUS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Transcribed from F-SUPPORT-KNOWLEDGE-CORPUS-R2 `03-KNOWLEDGE-SEED.json` with
 * the R2-1 addendum applied (one entry replaced: K-25). Generated mechanically
 * from those two artefacts so no word is retyped and no answer is authored here.
 *
 * ── EVERY ANSWER IN THIS FILE IS AUTHORED, AND THAT IS THE POINT ──────────
 *
 * No model call, no provider call, no retrieval, no export. Every word a reader
 * receives is in the repository and is reviewable in a diff — which is what
 * makes an authored answer trustworthy in a way a generated one cannot be.
 *
 * The matcher over this table has exactly two powers: choose an entry, or
 * choose none. It may not acquire a model, an embedding, a similarity score or
 * a generated answer.
 *
 * ── WHAT SHIPS, AND WHAT DOES NOT ────────────────────────────────────────
 *
 *   VERIFIED            34   shipped
 *   NOT YET AVAILABLE    3   shipped, and say so in their own words
 *   OWNER-GATED          7   NOT SHIPPED — see below
 *
 * B5-D applied F-SUPPORT-GROUNDING-DELTA-R2-2: seven entries that shipped with
 * an empty `grounding` received F's measured citations, and K-43 was DOWNGRADED
 * from VERIFIED to OWNER-GATED because its claim is CONTRADICTED by the tree —
 * it says the product does not use the word "beta" while a user-facing `Beta`
 * label ships in both locales (en.ts:1308, pl.ts:1064). An answer that
 * contradicts what the reader is looking at is worse than no answer, so the
 * sentence is withheld rather than reworded; no replacement copy was invented.
 *
 * AN OWNER-GATED ENTRY DOES NOT SHIP UNTIL ITS NAMED OWNER CONFIRMS IT. They are
 * excluded from this file entirely rather than included behind a flag, because a
 * flag is a thing someone can turn on without the confirmation the gate exists
 * to require. Their ids are recorded below so the outstanding work stays visible.
 *
 * NOT SHIPPED: K-04, K-07, K-10, K-11, K-12, K-22, K-43
 */

export type ProductKnowledgeMark = 'VERIFIED' | 'NOT YET AVAILABLE';

export type ProductKnowledgeLocale = 'en' | 'pl';

export interface ProductKnowledgeEntry {
  readonly id: string;
  readonly key: string;
  readonly intentClass: string;
  readonly mark: ProductKnowledgeMark;
  /** Where the answer's claim comes from. Never a guess. */
  readonly grounding: string;
  readonly triggers: Readonly<Record<ProductKnowledgeLocale, readonly string[]>>;
  readonly body: Readonly<Record<ProductKnowledgeLocale, string>>;
}

/** Ids withheld pending owner confirmation. Recorded, never rendered. */
export const OWNER_GATED_IDS: readonly string[] = ["K-04", "K-07", "K-10", "K-11", "K-12", "K-22", "K-43"];

export const PRODUCT_KNOWLEDGE: readonly ProductKnowledgeEntry[] = [
  {
    id: "K-44",
    key: "product.overview",
    intentClass: "PRODUCT_OVERVIEW",
    mark: "VERIFIED",
    grounding: "truth table §2, §6",
    triggers: {
      en: ["how does globalnews ai work", "how does it work", "what is globalnews ai", "what does globalnews ai do", "how does this work"],
      pl: ["jak dziala globalnews ai", "jak działa globalnews ai", "czym jest globalnews ai", "co robi globalnews ai", "jak to dziala", "jak to działa"],
    },
    body: {
      en: "GlobalNews AI retrieves reporting from news providers, groups what it retrieved so you can read it by country, and can analyse it when you ask a question. Everything it shows rests on reporting it actually retrieved: where nothing was retrieved it says so, rather than treating silence as evidence that nothing happened. It has no reporters of its own and asserts no events of its own.",
      pl: "GlobalNews AI pobiera doniesienia od dostawców wiadomości, grupuje je tak, aby można je było czytać według krajów, i może je przeanalizować, gdy zadasz pytanie. Wszystko, co pokazuje, opiera się na faktycznie pobranych doniesieniach: tam, gdzie nic nie pobrano, mówi o tym wprost, zamiast traktować brak danych jako dowód, że nic się nie wydarzyło. Nie ma własnych reporterów i nie stwierdza zdarzeń na własną rękę.",
    },
  },
  {
    id: "K-01",
    key: "signin.how",
    intentClass: "NAV_HOWTO",
    mark: "VERIFIED",
    grounding: "truth table §6",
    triggers: {
      en: ["sign in", "log in", "login", "signin"],
      pl: ["zaloguj", "logowanie", "zalogowac", "zalogować"],
    },
    body: {
      en: "Use **Sign In** in the top bar and continue with Google. That is the only way to sign in to GlobalNews AI — there is no password and no email sign-in. You are returned to the page you were on.",
      pl: "Użyj **Zaloguj się** na górnym pasku i kontynuuj przez Google. To jedyny sposób logowania do GlobalNews AI — nie ma hasła ani logowania e-mailem. Wrócisz na stronę, na której byłeś.",
    },
  },
  {
    id: "K-02",
    key: "signin.why",
    intentClass: "NAV_PREREQUISITE",
    mark: "VERIFIED",
    grounding: "§5, §6",
    triggers: {
      en: ["why account", "need an account", "what is an account for"],
      pl: ["dlaczego konto", "po co konto", "czy potrzebuje konta", "czy potrzebuję konta"],
    },
    body: {
      en: "An account is what lets you follow countries, so that Watch can show what GlobalNews AI first observed there, and it keeps a list of the questions you have asked. Reading the news, the World Map and Search need no account.",
      pl: "Konto pozwala śledzić kraje, aby Obserwacja mogła pokazać, co GlobalNews AI zaobserwował tam po raz pierwszy, i przechowuje listę zadanych przez Ciebie pytań. Czytanie wiadomości, Mapa świata i Szukaj nie wymagają konta.",
    },
  },
  {
    id: "K-03",
    key: "signout.how",
    intentClass: "NAV_HOWTO",
    mark: "VERIFIED",
    grounding: "§3, §6",
    triggers: {
      en: ["sign out", "log out", "logout", "signout"],
      pl: ["wyloguj", "wylogowanie", "wylogowac", "wylogować"],
    },
    body: {
      en: "Open the account control in the top bar and choose **Sign Out**. It is in the same menu on a phone.",
      pl: "Otwórz element konta na górnym pasku i wybierz **Wyloguj się**. Na telefonie znajduje się w tym samym menu.",
    },
  },
  {
    id: "K-05",
    key: "account.where",
    intentClass: "ACCOUNT_NAV",
    mark: "VERIFIED",
    grounding: "§2",
    triggers: {
      en: ["account settings", "my settings", "delete my account", "close my account"],
      pl: ["ustawienia konta", "usunac konto", "usunąć konto", "zamknac konto", "zamknąć konto"],
    },
    body: {
      en: "Your account settings are at **Account settings**, reached from the account control in the top bar. Deleting your account is available there, in its own section.",
      pl: "Ustawienia konta znajdziesz w **Ustawieniach konta**, dostępnych z elementu konta na górnym pasku. Usunięcie konta jest tam dostępne, w osobnej sekcji.",
    },
  },
  {
    id: "K-06",
    key: "account.cannot_see",
    intentClass: "ACCOUNT_RECORD",
    mark: "VERIFIED",
    grounding: "routing rule R-8",
    triggers: {
      en: ["my account status", "was my account", "is my account"],
      pl: ["moje konto", "stan konta"],
    },
    body: {
      en: "I cannot see your account, so I cannot check what has happened to it. I can tell you where a setting is and what it does; for the account itself, a person from Support can look.",
      pl: "Nie mam wglądu w Twoje konto, więc nie sprawdzę, co się z nim stało. Mogę powiedzieć, gdzie znajduje się dane ustawienie i co robi; w samo konto zajrzy osoba z zespołu wsparcia.",
    },
  },
  {
    id: "K-08",
    key: "home.watch_panel",
    intentClass: "NAV_LOCATE",
    mark: "VERIFIED",
    grounding: "§5",
    triggers: {
      en: ["where is watch", "find watch"],
      pl: ["gdzie jest obserwacja", "gdzie obserwacja"],
    },
    body: {
      en: "Watch sits on **Home**. If you follow no countries yet, it says so and points at the follow control beside every country in the list.",
      pl: "Obserwacja znajduje się na **Stronie głównej**. Jeśli nie śledzisz jeszcze żadnego kraju, napisze o tym i wskaże przycisk śledzenia przy każdym kraju na liście.",
    },
  },
  {
    id: "K-09",
    key: "map.open",
    intentClass: "NAV_HOWTO",
    mark: "VERIFIED",
    grounding: "§2, §3",
    triggers: {
      en: ["open the map", "where is the map", "find the map"],
      pl: ["otworzyc mape", "otworzyć mapę", "gdzie jest mapa", "gdzie mapa"],
    },
    body: {
      en: "Open **World Map** from the top bar. No account is needed.",
      pl: "Otwórz **Mapę świata** z górnego paska. Konto nie jest potrzebne.",
    },
  },
  {
    id: "K-13",
    key: "map.modes",
    intentClass: "PRODUCT_CAPABILITY",
    mark: "NOT YET AVAILABLE",
    grounding: "§8",
    triggers: {
      en: ["map modes", "other map views", "satellite", "3d map", "terrain"],
      pl: ["tryby mapy", "inne widoki mapy", "satelita", "mapa 3d", "terenowa"],
    },
    body: {
      en: "The World Map today is the country view. Other map modes are not yet available, and the Map's final visual treatment is still being decided.",
      pl: "Mapa świata to dzisiaj widok krajów. Inne tryby mapy są jeszcze niedostępne, a ostateczna oprawa wizualna Mapy jest jeszcze ustalana.",
    },
  },
  {
    id: "K-14",
    key: "nav.categories_unavailable",
    intentClass: "STATE_EXPLAIN",
    mark: "VERIFIED",
    grounding: "§3",
    triggers: {
      en: ["world section", "politics section", "business section", "technology section", "science section", "health section", "about page", "menu items do not open", "nav item does not work"],
      pl: ["sekcja swiat", "sekcja świat", "sekcja polityka", "sekcja biznes", "o nas", "menu nie dziala", "menu nie działa"],
    },
    body: {
      en: "**World, Politics, Business, Technology, Science, Health** and **About** appear in the navigation but are **not yet available** — they are labelled that way and do not open. Working destinations today are Home, the World Map, Search and Support.",
      pl: "**Świat, Polityka, Biznes, Technologia, Nauka, Zdrowie** i **O nas** są widoczne w nawigacji, ale są **jeszcze niedostępne** — są tak oznaczone i nie otwierają się. Działające miejsca to dzisiaj Strona główna, Mapa świata, Szukaj i Pomoc.",
    },
  },
  {
    id: "K-15",
    key: "search.what",
    intentClass: "PRODUCT_CONCEPT",
    mark: "VERIFIED",
    grounding: "§2, §6",
    triggers: {
      en: ["what is search", "how does search work", "what does search do"],
      pl: ["czym jest szukaj", "jak dziala szukaj", "jak działa szukaj", "co robi szukaj", "wyszukiwanie"],
    },
    body: {
      en: "**Search** is where you ask GlobalNews AI a question about world events. It answers from reporting the product has retrieved and lists the sources the answer rests on. It is one question at a time, not a feed.",
      pl: "**Szukaj** to miejsce, w którym zadajesz GlobalNews AI pytanie o wydarzenia na świecie. Odpowiada na podstawie pobranych doniesień i podaje źródła, na których opiera się odpowiedź. To jedno pytanie na raz, a nie strumień treści.",
    },
  },
  {
    id: "K-16",
    key: "search.autorun",
    intentClass: "STATE_EXPLAIN",
    mark: "VERIFIED",
    grounding: "§6",
    triggers: {
      en: ["why did it analyse", "it ran by itself", "analysis started", "ran automatically"],
      pl: ["analiza sama sie", "analiza sama się", "uruchomila sie sama", "uruchomiła się sama", "dlaczego analiza"],
    },
    body: {
      en: "Opening Search with a question already in the address — from a link, or from an item you chose to ask about — **runs the analysis straight away**. There is no extra confirmation step, so a question you did not mean to ask is best changed before you open it rather than after.",
      pl: "Otwarcie Szukaj z pytaniem już w adresie — z linku albo z pozycji, o którą postanowiłeś zapytać — **od razu uruchamia analizę**. Nie ma dodatkowego potwierdzenia, więc pytanie zadane przez pomyłkę lepiej zmienić przed otwarciem niż po.",
    },
  },
  {
    id: "K-17",
    key: "search.no_results",
    intentClass: "STATE_EXPLAIN",
    mark: "VERIFIED",
    grounding: "§6",
    triggers: {
      en: ["no related articles", "no articles were found", "nothing found for my question"],
      pl: ["nie znaleziono powiazanych", "nie znaleziono powiązanych", "brak artykulow", "brak artykułów"],
    },
    body: {
      en: "*\"No related articles were found for this question\"* means the product retrieved no reporting it could stand behind for it. It is a statement about the reporting available to us, not about whether the thing you asked about happened. Asking in fewer, plainer words sometimes retrieves more.",
      pl: "„Nie znaleziono powiązanych artykułów dla tego pytania” oznacza, że produkt nie pobrał doniesień, za którymi mógłby ręczyć. To stwierdzenie o dostępnych nam doniesieniach, a nie o tym, czy to, o co pytasz, miało miejsce. Pytanie zadane prościej i krócej czasem pozwala pobrać więcej.",
    },
  },
  {
    id: "K-18",
    key: "askai.what",
    intentClass: "PRODUCT_CAPABILITY",
    mark: "VERIFIED",
    grounding: "§6",
    triggers: {
      en: ["what does ask ai do", "what is ask ai", "how does ask ai work"],
      pl: ["co robi ask ai", "czym jest ask ai", "jak dziala ask ai", "jak działa ask ai"],
    },
    body: {
      en: "Ask AI is the question panel you can open while reading. Opened from a story it asks about that story; opened on its own it asks about world events generally — the panel says which of the two it is doing. Its answers come from retrieved reporting and name their sources; when nothing relevant was retrieved it says so instead of answering.",
      pl: "Ask AI to panel pytań, który możesz otworzyć podczas czytania. Otwarty przy artykule pyta o ten artykuł; otwarty samodzielnie pyta ogólnie o wydarzenia na świecie — panel wskazuje, który z tych dwóch trybów jest aktywny. Odpowiedzi pochodzą z pobranych doniesień i wskazują źródła; gdy nic odpowiedniego nie pobrano, mówi o tym wprost zamiast odpowiadać.",
    },
  },
  {
    id: "K-19",
    key: "askai.not_assistant",
    intentClass: "PRODUCT_CAPABILITY",
    mark: "VERIFIED",
    grounding: "AskAiDock.tsx:6,160 -> analysisApi.ts:270 POST /analysis/news; grep -c accountFetch AskAiDock.tsx = 0 (control: 3 in app/history/page.tsx); analysis.service.ts:278 NO_EVIDENCE_MESSAGE",
    triggers: {
      en: ["can ask ai do", "ask ai assistant", "ask ai my account"],
      pl: ["czy ask ai moze", "czy ask ai może", "ask ai asystent"],
    },
    body: {
      en: "Ask AI answers questions about world events from retrieved reporting. It is not a general assistant, it does not act on your account, and it does not answer questions about the product — for those, ask here in Support.",
      pl: "Ask AI odpowiada na pytania o wydarzenia na świecie na podstawie pobranych doniesień. Nie jest ogólnym asystentem, nie wykonuje działań na Twoim koncie i nie odpowiada na pytania o produkt — o te pytaj tutaj, w Pomocy.",
    },
  },
  {
    id: "K-20",
    key: "workspace.analysis",
    intentClass: "PRODUCT_CONCEPT",
    mark: "VERIFIED",
    grounding: "§7.2",
    triggers: {
      en: ["analysis workspace", "what is the workspace"],
      pl: ["przestrzen analizy", "przestrzeń analizy", "czym jest przestrzen"],
    },
    body: {
      en: "The Analysis Workspace is what Search opens into once an answer exists: the question, the answer, the reporting behind it and the sources. It is the same place — you do not need to go anywhere else for it.",
      pl: "Przestrzeń analizy to to, w co otwiera się Szukaj, gdy istnieje odpowiedź: pytanie, odpowiedź, doniesienia, na których się opiera, i źródła. To to samo miejsce — nie musisz szukać go gdzie indziej.",
    },
  },
  {
    id: "K-21",
    key: "workspace.capability_list",
    intentClass: "NAV_LOCATE",
    mark: "VERIFIED",
    grounding: "§4, §7.2",
    triggers: {
      en: ["capability list", "module list", "intelligence modules", "what modules"],
      pl: ["lista modulow", "lista modułów", "moduly analityczne", "moduły analityczne"],
    },
    body: {
      en: "There is a separate page listing the intelligence modules and how far each has got — *Foundation ready*, *In development* or *Planned*. Only two of them open today: Country Intelligence, which is the World Map, and Research Intelligence, which is Search. The rest are listed so you can see what is coming, not because they can be opened.",
      pl: "Istnieje osobna strona z listą modułów analitycznych i tym, jak daleko zaszedł każdy z nich — *Foundation ready*, *In development* albo *Planned*. Dzisiaj otwierają się tylko dwa: Country Intelligence, czyli Mapa świata, i Research Intelligence, czyli Szukaj. Pozostałe są wymienione, abyś wiedział, co jest planowane, a nie ponieważ można je otworzyć.",
    },
  },
  {
    id: "K-23",
    key: "history.what",
    intentClass: "PRODUCT_CONCEPT",
    mark: "VERIFIED",
    grounding: "§2",
    triggers: {
      en: ["my past questions", "question history", "earlier questions", "history page"],
      pl: ["historia pytan", "historia pytań", "wczesniejsze pytania", "wcześniejsze pytania", "moje pytania"],
    },
    body: {
      en: "Your past questions are kept while you are signed in, and you can open one again. Choosing one **asks the question again now** — it does not show you the old answer, because an answer from last week would be presented as if it were current.",
      pl: "Twoje wcześniejsze pytania są przechowywane, gdy jesteś zalogowany, i możesz je otworzyć ponownie. Wybranie jednego **zadaje pytanie ponownie teraz** — nie pokazuje starej odpowiedzi, ponieważ odpowiedź z zeszłego tygodnia byłaby przedstawiona jako aktualna.",
    },
  },
  {
    id: "K-24",
    key: "sources.open_original",
    intentClass: "NAV_HOWTO",
    mark: "VERIFIED",
    grounding: "§6",
    triggers: {
      en: ["open the original", "original source", "read the article", "publisher link", "open in new tab"],
      pl: ["zrodlo oryginalne", "źródło oryginalne", "otworzyc artykul", "otworzyć artykuł", "link do wydawcy", "oryginalne zrodlo", "oryginalne źródło"],
    },
    body: {
      en: "Every retained item can be opened at its original source. The open control is a normal link — *\"Open source in a new tab\"* — so middle-click, copy-address and open-in-background all work as they do anywhere else. GlobalNews AI does not host the article; you read it at the publisher.",
      pl: "Każdą zachowaną pozycję można otworzyć w źródle oryginalnym. Element otwierania jest zwykłym linkiem — „Otwórz źródło w nowej karcie” — więc kliknięcie środkowym przyciskiem, kopiowanie adresu i otwieranie w tle działają tak jak wszędzie. GlobalNews AI nie przechowuje artykułu; czytasz go u wydawcy.",
    },
  },
  {
    id: "K-25",
    key: "sources.ask_about",
    intentClass: "NAV_HOWTO",
    mark: "VERIFIED",
    grounding: "R2.1 addendum §1 (facts 1-5) — converged Checkpoint D behaviour. SURFACE-QUALIFIED in B5-D: SourceCard.tsx:98 onAskAbout is OPTIONAL and :267 renders conditionally; EvidenceSelectionCard.tsx:961 passes it, MobileSpatialShell.tsx:1013-1029 and SourcesReporting.tsx:654 do not. R2.1 fact 6 (cross-device parity) is WITHDRAWN as measured false.",
    triggers: {
      en: ["magnifier", "ask about this", "ask about this story", "the second icon"],
      pl: ["lupa", "zapytaj o to", "drugi przycisk"],
    },
    body: {
      en: "On the desktop map, a retained item carries two separate controls. The arrow opens the item at its original publisher — an ordinary link, in a new tab, nothing else happens. Beside it, **Ask AI** turns the item into a question and opens it in Search, and arriving there **runs one analysis straight away** — there is no further confirmation step. So the arrow is for reading the source, and Ask AI is for asking GlobalNews AI about it. On the compact phone layout the retained item shows the arrow only.",
      pl: "Na mapie w widoku na komputerze zachowana pozycja ma dwa osobne elementy. Strzałka otwiera pozycję u jej pierwotnego wydawcy — to zwykły link, w nowej karcie, nic więcej się nie dzieje. Obok, **Zapytaj AI** zamienia pozycję w pytanie i otwiera je w Szukaj, a po przejściu **od razu uruchamia jedną analizę** — nie ma dodatkowego potwierdzenia. Strzałka służy więc do przeczytania źródła, a Zapytaj AI do zapytania GlobalNews AI o nie. W kompaktowym widoku na telefonie zachowana pozycja pokazuje tylko strzałkę.",
    },
  },
  {
    id: "K-26",
    key: "sources.why_listed",
    intentClass: "PRODUCT_CONCEPT",
    mark: "VERIFIED",
    grounding: "en.ts:93-95 / pl.ts:70-72 resultSourcesHeading|None|Truncated; support-ai.service.ts:112 ANSWER_SOURCES_LABEL, appended at :376",
    triggers: {
      en: ["why are sources listed", "what are the sources", "check the sources"],
      pl: ["dlaczego zrodla", "dlaczego źródła", "jakie zrodla", "jakie źródła", "sprawdzic zrodla", "sprawdzić źródła"],
    },
    body: {
      en: "An answer lists the sources it rests on so you can check it against the reporting rather than take our word for it. If a claim you care about is not in the listed sources, treat it as unsupported.",
      pl: "Odpowiedź wymienia źródła, na których się opiera, abyś mógł sprawdzić ją w doniesieniach, a nie polegać na naszym słowie. Jeśli istotnego dla Ciebie twierdzenia nie ma w wymienionych źródłach, traktuj je jako niepotwierdzone.",
    },
  },
  {
    id: "K-27",
    key: "sources.unavailable",
    intentClass: "STATE_EXPLAIN",
    mark: "VERIFIED",
    grounding: "en.ts:516-517 feedPanelUnavailableHeading|Body; en.ts:561 liveDataUnavailable; en.ts:564 liveUnavailableStoredUsed; en.ts:614 statusFeedUnavailable; news.service.ts:274 PROVIDER_FAILURES",
    triggers: {
      en: ["source unavailable", "source is unavailable", "feed unavailable", "why is a source"],
      pl: ["zrodlo niedostepne", "źródło niedostępne", "dlaczego zrodlo", "dlaczego źródło", "kanal niedostepny", "kanał niedostępny"],
    },
    body: {
      en: "A source shows as unavailable when GlobalNews AI could not retrieve from it just then — the provider did not answer, the request did not complete, or stored reporting was used instead of live. It is about that retrieval attempt, not about the source: it does not mean the source published nothing, and it does not mean it has been dropped. I cannot tell which applies on your screen right now.",
      pl: "Źródło jest oznaczone jako niedostępne, gdy GlobalNews AI nie mógł wtedy z niego pobrać danych — dostawca nie odpowiedział, żądanie się nie powiodło albo użyto zapisanych doniesień zamiast bieżących. Dotyczy to tej próby pobrania, a nie samego źródła: nie oznacza, że źródło nic nie opublikowało, ani że zostało usunięte. Nie jestem w stanie powiedzieć, który przypadek dotyczy tego, co widzisz teraz.",
    },
  },
  {
    id: "K-28",
    key: "watch.what",
    intentClass: "PRODUCT_CONCEPT",
    mark: "VERIFIED",
    grounding: "§5, §6",
    triggers: {
      en: ["what is watch", "what does watch do", "how does watch work"],
      pl: ["czym jest obserwacja", "co robi obserwacja", "jak dziala obserwacja", "jak działa obserwacja"],
    },
    body: {
      en: "Watch answers one question: **what GlobalNews AI first observed today in the countries you follow.** It sits on Home, it needs an account, and it is about today's retrieval.",
      pl: "Obserwacja odpowiada na jedno pytanie: **co GlobalNews AI zaobserwował dziś po raz pierwszy w krajach, które śledzisz.** Znajduje się na Stronie głównej, wymaga konta i dotyczy dzisiejszego pobierania.",
    },
  },
  {
    id: "K-29",
    key: "watch.not_alerts",
    intentClass: "PRODUCT_CAPABILITY",
    mark: "NOT YET AVAILABLE",
    grounding: "§4, §5",
    triggers: {
      en: ["does watch notify", "watch alerts", "notifications", "watchlist", "forecast", "will it tell me"],
      pl: ["powiadomienia", "alerty", "lista obserwowanych", "prognoza", "czy powiadomi"],
    },
    body: {
      en: "Watch does not notify you, does not run in the background and does not predict. There are no alerts, nothing is sent to you, and there is no watchlist or forecast — those are **not yet available**. Watch shows what was retrieved when you open it.",
      pl: "Obserwacja nie wysyła powiadomień, nie działa w tle i niczego nie przewiduje. Nie ma alertów, nic nie jest do Ciebie wysyłane, nie ma też listy obserwowanych ani prognoz — te funkcje są **jeszcze niedostępne**. Obserwacja pokazuje to, co pobrano, w momencie jej otwarcia.",
    },
  },
  {
    id: "K-30",
    key: "follow.how",
    intentClass: "NAV_HOWTO",
    mark: "VERIFIED",
    grounding: "§6",
    triggers: {
      en: ["how do i follow", "follow a country", "following countries", "how many countries can i follow"],
      pl: ["jak sledzic", "jak śledzić", "sledzic kraj", "śledzić kraj", "ile krajow", "ile krajów"],
    },
    body: {
      en: "Sign in, then use the follow control beside a country in the list. You can follow up to **50** countries; at the ceiling, unfollow one to add another.",
      pl: "Zaloguj się, a następnie użyj przycisku śledzenia przy kraju na liście. Możesz śledzić maksymalnie **50** krajów; po osiągnięciu limitu przestań śledzić jeden, aby dodać inny.",
    },
  },
  {
    id: "K-31",
    key: "watch.zero",
    intentClass: "STATE_EXPLAIN",
    mark: "VERIFIED",
    grounding: "§6",
    triggers: {
      en: ["nothing retrieved", "nothing for this country", "empty country", "why is it empty"],
      pl: ["nic nie pobrano", "pusty kraj", "dlaczego pusto"],
    },
    body: {
      en: "*\"Nothing retrieved for this country today\"* means today's retrieval reached nothing there. **That is a statement about our retrieval, not about the country** — it does not mean the country was quiet, and it does not mean your follow stopped working.",
      pl: "„Nic nie pobrano dziś dla tego kraju” oznacza, że dzisiejsze pobieranie nic tam nie objęło. **To stwierdzenie o naszym pobieraniu, a nie o tym kraju** — nie oznacza, że w kraju było spokojnie, ani że śledzenie przestało działać.",
    },
  },
  {
    id: "K-32",
    key: "follow.vs_watch",
    intentClass: "PRODUCT_CONCEPT",
    mark: "VERIFIED",
    grounding: "§5",
    triggers: {
      en: ["follow versus watch", "difference between follow and watch"],
      pl: ["roznica miedzy", "różnica między", "sledzenie a obserwacja", "śledzenie a obserwacja"],
    },
    body: {
      en: "Following a country is something you do; Watch is where you read the result. Following does not start a monitor and does not subscribe you to anything.",
      pl: "Śledzenie kraju to Twoje działanie; Obserwacja to miejsce, w którym czytasz wynik. Śledzenie nie uruchamia monitorowania i nie zapisuje Cię do żadnych powiadomień.",
    },
  },
  {
    id: "K-33",
    key: "language.available",
    intentClass: "PRODUCT_CAPABILITY",
    mark: "VERIFIED",
    grounding: "§6",
    triggers: {
      en: ["what languages", "change the language", "is it in polish", "language selector"],
      pl: ["jakie jezyki", "jakie języki", "zmienic jezyk", "zmienić język", "po polsku", "przelacznik jezyka", "przełącznik języka"],
    },
    body: {
      en: "GlobalNews AI is available in **English and Polish**. Change it with the language selector in the top bar; the choice is remembered in this browser.",
      pl: "GlobalNews AI jest dostępny w **języku angielskim i polskim**. Zmienisz go przełącznikiem języka na górnym pasku; wybór jest zapamiętywany w tej przeglądarce.",
    },
  },
  {
    id: "K-34",
    key: "language.analysis_rerun",
    intentClass: "STATE_EXPLAIN",
    mark: "VERIFIED",
    grounding: "§6",
    triggers: {
      en: ["changed the language", "analysis language", "answer in polish"],
      pl: ["zmiana jezyka", "zmiana języka", "jezyk analizy", "język analizy", "odpowiedz po polsku", "odpowiedź po polsku"],
    },
    body: {
      en: "Changing the language while an analysis is open **runs it again in the new language** rather than translating what was already on screen — so the answer is written in that language rather than converted into it.",
      pl: "Zmiana języka przy otwartej analizie **uruchamia ją ponownie w nowym języku**, a nie tłumaczy tego, co już było na ekranie — odpowiedź jest więc napisana w tym języku, a nie na niego przełożona.",
    },
  },
  {
    id: "K-35",
    key: "language.support_scope",
    intentClass: "PRODUCT_CAPABILITY",
    mark: "VERIFIED",
    grounding: "support-ai.service.ts:44 SupportAiLanguage = 'en' | 'pl' (keys the tables at :102,:107,:112,:117); only supportEn.ts and supportPl.ts exist",
    triggers: {
      en: ["support language", "do you answer in", "other languages here"],
      pl: ["jezyk wsparcia", "język wsparcia", "inne jezyki tutaj", "inne języki tutaj"],
    },
    body: {
      en: "Automatic Support answers are available in English and Polish only. Write in either, or a person from Support can take your question.",
      pl: "Automatyczne odpowiedzi wsparcia są dostępne wyłącznie po angielsku i po polsku. Napisz w jednym z tych języków albo niech zajmie się tym osoba z zespołu wsparcia.",
    },
  },
  {
    id: "K-36",
    key: "support.what",
    intentClass: "PRODUCT_CONCEPT",
    mark: "VERIFIED",
    grounding: "§2",
    triggers: {
      en: ["what is support", "what can i ask here", "what is this page for"],
      pl: ["czym jest pomoc", "o co moge zapytac", "o co mogę zapytać", "do czego sluzy ta strona", "do czego służy ta strona"],
    },
    body: {
      en: "This is Support. Ask how something works, where to find it, or report a problem. Questions about the product are answered here from written answers; questions about world events belong in Search. A person from Support can take anything I cannot.",
      pl: "To Pomoc. Zapytaj, jak coś działa, gdzie to znaleźć, albo zgłoś problem. Pytania o produkt otrzymują tutaj odpowiedzi z przygotowanych tekstów; pytania o wydarzenia na świecie należą do Szukaj. Osoba z zespołu wsparcia zajmie się tym, czego nie mogę.",
    },
  },
  {
    id: "K-37",
    key: "support.ai_or_human",
    intentClass: "META",
    mark: "VERIFIED",
    grounding: "TranscriptTurn.tsx:61-62 and :90-92 (authorship in the region accessible name); stateMachine.ts:30-31 declare and :43,:46,:73,:77 implement HUMAN-terminal and CLOSED->HUMAN",
    triggers: {
      en: ["are you a person", "are you human", "am i talking to a bot", "is this a human"],
      pl: ["czy jestes czlowiekiem", "czy jesteś człowiekiem", "czy rozmawiam z czlowiekiem", "czy rozmawiam z człowiekiem", "czy to bot"],
    },
    body: {
      en: "Every message here says who wrote it. Automatic answers are labelled as automated; a person from the Support team is labelled as the Support team. When a person takes over, that is said in the conversation, and after that nothing here is answered automatically.",
      pl: "Każda wiadomość tutaj wskazuje, kto ją napisał. Odpowiedzi automatyczne są oznaczone jako automatyczne; osoba z zespołu wsparcia jest oznaczona jako zespół wsparcia. Gdy przejmuje to człowiek, jest to powiedziane w rozmowie, a od tego momentu nic tutaj nie jest odpowiadane automatycznie.",
    },
  },
  {
    id: "K-38",
    key: "support.where_replies",
    intentClass: "PRODUCT_CONCEPT",
    mark: "VERIFIED",
    grounding: "supportEn.ts:35; absence of any outbound delivery: 0 mailer libs in backend/src, 0 mail/push deps in backend/package.json, 0 notification/mail modules, NOTIFICATION_DELIVERY occurs only in shared/src/watch.ts as a declared UNAVAILABLE capability. Controls alive: grep -c '\"@nestjs/common\"' backend/package.json = 1; find backend/src -iname '*support*' returns rows",
    triggers: {
      en: ["where will you reply", "where do i see the answer", "will you email me"],
      pl: ["gdzie odpowiecie", "gdzie zobacze odpowiedz", "gdzie zobaczę odpowiedź", "czy wysle mail", "czy wyślecie maila"],
    },
    body: {
      en: "Replies arrive in this conversation. Nothing is answered anywhere else, so there is no other place you need to check.",
      pl: "Odpowiedzi pojawiają się w tej rozmowie. Nic nie jest odpowiadane w innym miejscu, więc nie musisz sprawdzać nigdzie indziej.",
    },
  },
  {
    id: "K-39",
    key: "support.privacy_pointer",
    intentClass: "POLICY",
    mark: "VERIFIED",
    grounding: "SupportConversation.tsx:220 {!hasSent ? ( ... :228 disclosure.beforeFirstSend ... :231-232 the persistent compact form",
    triggers: {
      en: ["what happens to what i write", "who reads this", "is this private"],
      pl: ["co dzieje sie z tym co pisze", "co dzieje się z tym co piszę", "kto to czyta", "czy to prywatne"],
    },
    body: {
      en: "What happens to what you write here is stated on this surface before you send the first message, and it stays available in the conversation. If something in it is unclear, ask and a person from Support will answer it.",
      pl: "To, co dzieje się z tym, co tutaj piszesz, jest opisane na tej powierzchni przed wysłaniem pierwszej wiadomości i pozostaje dostępne w rozmowie. Jeśli coś jest niejasne, zapytaj — odpowie osoba z zespołu wsparcia.",
    },
  },
  {
    id: "K-40",
    key: "unavailable.general",
    intentClass: "STATE_EXPLAIN",
    mark: "VERIFIED",
    grounding: "§3, §4",
    triggers: {
      en: ["not yet available", "why can i not open", "greyed out", "does not open"],
      pl: ["jeszcze niedostepne", "jeszcze niedostępne", "dlaczego nie moge otworzyc", "dlaczego nie mogę otworzyć", "nie otwiera sie", "nie otwiera się"],
    },
    body: {
      en: "Some parts of GlobalNews AI are visible but **not yet available**: they are labelled that way and do not open. That is deliberate rather than a fault, and I cannot say when any of them will open.",
      pl: "Niektóre części GlobalNews AI są widoczne, ale **jeszcze niedostępne**: są tak oznaczone i nie otwierają się. Jest to zamierzone, a nie usterka, i nie mogę powiedzieć, kiedy któraś z nich zostanie udostępniona.",
    },
  },
  {
    id: "K-41",
    key: "unavailable.which",
    intentClass: "PRODUCT_CAPABILITY",
    mark: "VERIFIED",
    grounding: "§3, §4",
    triggers: {
      en: ["what works", "what is available", "what can i use", "what is finished"],
      pl: ["co dziala", "co działa", "co jest dostepne", "co jest dostępne", "czego moge uzywac", "czego mogę używać"],
    },
    body: {
      en: "Working today: **Home**, the **World Map** (country view), **Search** with its analysis, your **past questions**, **Watch** for countries you follow, **account settings**, and **Support**. Not yet available: the World, Politics, Business, Technology, Science, Health and About sections, and the intelligence modules other than the World Map and Search — including elections, economy, energy, markets, timelines, and anything forecast- or watchlist-shaped.",
      pl: "Działa dzisiaj: **Strona główna**, **Mapa świata** (widok krajów), **Szukaj** wraz z analizą, Twoje **wcześniejsze pytania**, **Obserwacja** dla śledzonych krajów, **ustawienia konta** i **Pomoc**. Jeszcze niedostępne: sekcje Świat, Polityka, Biznes, Technologia, Nauka, Zdrowie i O nas, a także moduły analityczne inne niż Mapa świata i Szukaj — w tym wybory, gospodarka, energia, rynki, osie czasu oraz wszystko o charakterze prognoz i list obserwowanych.",
    },
  },
  {
    id: "K-42",
    key: "unavailable.conflict",
    intentClass: "PRODUCT_CAPABILITY",
    mark: "NOT YET AVAILABLE",
    grounding: "§4",
    triggers: {
      en: ["conflict intelligence", "conflict module", "open conflict"],
      pl: ["conflict intelligence", "modul konfliktow", "moduł konfliktów"],
    },
    body: {
      en: "Conflict Intelligence is in development and cannot be opened yet. I will not point you at a part of the product that will not open for you.",
      pl: "Conflict Intelligence jest w rozwoju i nie można go jeszcze otworzyć. Nie będę wskazywać części produktu, która się dla Ciebie nie otworzy.",
    },
  },
];
