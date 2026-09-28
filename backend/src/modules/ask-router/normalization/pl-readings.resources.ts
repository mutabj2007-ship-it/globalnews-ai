/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE C — POLISH READINGS RESOURCES.
 *
 * Authority: L-ASK-R2-EN-PL-NORMALIZATION-CLOSURE-R1 (01-ADAPTER-CONTRACT §4) and its
 * R1-RESIDUAL ADDENDUM (C-1, C-2, C-3'), plus the contract's QQ-10 (§3).
 *
 * THE DISCIPLINE, carried unchanged from L:
 *   - every set is CLOSED, generated forward and matched WHOLE-TOKEN — no stemmer, no
 *     suffix stripping, nothing inferred backward from user text;
 *   - every set is KEYED BY THE ENGLISH CONCEPT IT MIRRORS, so parity is visible in the
 *     shape of the data and a spec diffs the keys against the English authority;
 *   - no Polish form is added to any English array, and no English determiner appears in
 *     a Polish reading (contract §3: "no simulated Polish articles").
 *
 * Word ends in Polish patterns are `(?![\p{L}\p{N}])`, never `\b`: JS `\b` is ASCII-based
 * and the `u` flag does not change it (L 00 §4.3).
 */

import type { AnalyticalDomain } from '../../analysis/query/detect-analytical-domains.util';

type FormSet = Readonly<Record<string, readonly string[]>>;

export const PL_WORD_END = String.raw`(?![\p{L}\p{N}])`;
const rx = (body: string): RegExp => new RegExp(body, 'iu');

/* ── 1 · DOMAINS — L's PL_DOMAIN_FORMS, verbatim ─────────────────────────────
   Keyed by canonical's English DOMAIN_KEYWORDS entry. Over-coverage is a divergence
   exactly as under-coverage is (L 01 §4). */
export const PL_DOMAIN_FORMS: Readonly<Record<AnalyticalDomain, FormSet>> = {
  political: {
    political: [
      'polityczny',
      'polityczna',
      'polityczne',
      'politycznej',
      'politycznym',
      'politycznych',
      'politycznymi',
    ],
    politics: ['polityka', 'polityki', 'polityce', 'politykę', 'polityką'],
    government: [
      'rząd',
      'rządu',
      'rządowi',
      'rządem',
      'rządzie',
      'rządy',
      'rządów',
      'rządowy',
      'rządowa',
      'rządowe',
    ],
    president: [
      'prezydent',
      'prezydenta',
      'prezydentowi',
      'prezydentem',
      'prezydencie',
      'prezydenci',
    ],
    parliament: [
      'parlament',
      'parlamentu',
      'parlamentowi',
      'parlamencie',
      'parlamentem',
      'parlamentarny',
    ],
    minister: [
      'minister',
      'ministra',
      'ministrowi',
      'ministrem',
      'ministrze',
      'ministrowie',
      'premier',
      'premiera',
      'premierowi',
      'premierem',
      'premierze',
    ],
    election: [
      'wybory',
      'wyborów',
      'wyborach',
      'wyborami',
      'wyborom',
      'wyborczy',
      'wyborcza',
      'wyborcze',
    ],
  },
  economic: {
    economic: [
      'ekonomiczny',
      'ekonomiczna',
      'ekonomiczne',
      'ekonomicznej',
      'ekonomicznym',
      'gospodarczy',
      'gospodarcza',
      'gospodarcze',
      'gospodarczej',
      'gospodarczym',
    ],
    economy: [
      'gospodarka',
      'gospodarki',
      'gospodarce',
      'gospodarkę',
      'gospodarką',
      'ekonomia',
      'ekonomii',
      'ekonomię',
    ],
    trade: [
      'handel',
      'handlu',
      'handlem',
      'handlowy',
      'handlowa',
      'handlowe',
      'handlowej',
      'wymiana',
    ],
    investment: [
      'inwestycja',
      'inwestycje',
      'inwestycji',
      'inwestycją',
      'inwestycyjny',
      'inwestycyjna',
    ],
    financial: ['finansowy', 'finansowa', 'finansowe', 'finansowej', 'finansowym', 'finansowych'],
    finance: ['finanse', 'finansów', 'finansom', 'finansami'],
    gdp: ['pkb'],
    business: [
      'biznes',
      'biznesu',
      'biznesie',
      'biznesem',
      'biznesowy',
      'przedsiębiorstwo',
      'przedsiębiorstwa',
    ],
  },
  security: {
    security: [
      'bezpieczeństwo',
      'bezpieczeństwa',
      'bezpieczeństwu',
      'bezpieczeństwem',
      'bezpieczeństwie',
    ],
    military: [
      'militarny',
      'militarna',
      'militarne',
      'militarnej',
      'militarnym',
      'militarnych',
      'wojskowy',
      'wojskowa',
      'wojskowe',
      'wojskowym',
    ],
    'armed forces': ['wojsko', 'wojska', 'wojsku', 'wojskiem', 'siły', 'zbrojne', 'zbrojnych'],
    conflict: ['konflikt', 'konfliktu', 'konflikcie', 'konfliktem', 'konflikty', 'konfliktów'],
    violence: ['przemoc', 'przemocy', 'przemocą'],
    threat: [
      'zagrożenie',
      'zagrożenia',
      'zagrożeniu',
      'zagrożeniem',
      'zagrożeń',
      'groźba',
      'groźby',
    ],
    defence: ['obrona', 'obrony', 'obronie', 'obroną', 'obronny', 'obronna', 'obronne', 'obronnej'],
  },
  diplomatic: {
    diplomatic: [
      'dyplomatyczny',
      'dyplomatyczna',
      'dyplomatyczne',
      'dyplomatycznej',
      'dyplomatycznych',
    ],
    diplomacy: ['dyplomacja', 'dyplomacji', 'dyplomację', 'dyplomacją'],
    bilateral: [
      'dwustronny',
      'dwustronna',
      'dwustronne',
      'dwustronnej',
      'dwustronnych',
      'bilateralny',
    ],
    embassy: ['ambasada', 'ambasady', 'ambasadzie', 'ambasadę', 'ambasadą'],
    ambassador: ['ambasador', 'ambasadora', 'ambasadorowi', 'ambasadorem', 'ambasadorze'],
    'foreign relations': ['zagraniczne', 'zagranicznych', 'stosunki', 'stosunków'],
    summit: ['szczyt', 'szczytu', 'szczycie', 'szczytem'],
  },
  social: {
    social: ['społeczny', 'społeczna', 'społeczne', 'społecznej', 'społecznym', 'społecznych'],
    society: ['społeczeństwo', 'społeczeństwa', 'społeczeństwie', 'społeczeństwem'],
    community: ['społeczność', 'społeczności', 'wspólnota', 'wspólnoty', 'wspólnocie'],
    education: ['edukacja', 'edukacji', 'edukację', 'edukacyjny', 'oświata', 'oświaty'],
    healthcare: [
      'zdrowotna',
      'zdrowotnej',
      'zdrowotny',
      'zdrowotne',
      'zdrowie',
      'zdrowia',
      'zdrowiu',
    ],
    welfare: ['socjalny', 'socjalna', 'socjalne', 'socjalnej', 'opieka', 'opieki'],
    humanitarian: ['humanitarny', 'humanitarna', 'humanitarne', 'humanitarnej', 'humanitarnych'],
  },
  infrastructure: {
    infrastructure: [
      'infrastruktura',
      'infrastruktury',
      'infrastrukturze',
      'infrastrukturę',
      'infrastrukturą',
    ],
    roads: [
      'droga',
      'drogi',
      'drodze',
      'drogę',
      'dróg',
      'drogami',
      'drogowy',
      'drogowa',
      'drogowe',
    ],
    transport: ['transport', 'transportu', 'transporcie', 'transportem', 'transportowy'],
    construction: ['budowa', 'budowy', 'budowie', 'budowę', 'budownictwo', 'budownictwa'],
    energy: [
      'energia',
      'energii',
      'energię',
      'energią',
      'energetyczny',
      'energetyczna',
      'energetyczne',
    ],
    utilities: ['komunalne', 'komunalnych', 'media'],
    railway: ['kolej', 'kolei', 'koleją', 'kolejowy', 'kolejowa', 'kolejowe'],
    airport: ['lotnisko', 'lotniska', 'lotnisku', 'lotniskiem', 'lotnisk'],
  },
  technology: {
    technology: ['technologia', 'technologii', 'technologię', 'technologią'],
    technological: [
      'technologiczny',
      'technologiczna',
      'technologiczne',
      'technologicznej',
      'technologicznych',
    ],
    digital: ['cyfrowy', 'cyfrowa', 'cyfrowe', 'cyfrowej', 'cyfrowych', 'cyfryzacja', 'cyfryzacji'],
    innovation: [
      'innowacja',
      'innowacje',
      'innowacji',
      'innowacyjny',
      'innowacyjna',
      'innowacyjne',
    ],
    internet: ['internet', 'internetu', 'internecie', 'internetem'],
    software: ['oprogramowanie', 'oprogramowania', 'oprogramowaniu', 'oprogramowaniem'],
    telecom: ['telekomunikacja', 'telekomunikacji', 'telekomunikacyjny', 'telekomunikacyjne'],
  },
  regional: {
    regional: [
      'regionalny',
      'regionalna',
      'regionalne',
      'regionalnej',
      'regionalnym',
      'regionalnych',
    ],
    region: ['region', 'regionu', 'regionie', 'regionem', 'regiony', 'regionów', 'regionach'],
    neighbouring: [
      'sąsiedni',
      'sąsiednia',
      'sąsiednie',
      'sąsiednich',
      'sąsiad',
      'sąsiada',
      'sąsiedzi',
      'sąsiadów',
    ],
    'cross-border': [
      'transgraniczny',
      'transgraniczna',
      'transgraniczne',
      'transgranicznej',
      'transgranicznych',
    ],
  },
};

/** L's aliases for the two PL keys whose EN key is spelt differently in canonical. */
export const PL_DOMAIN_KEY_ALIASES: Readonly<Record<string, string>> = {
  'security:defence': 'security:defense',
  'regional:neighbouring': 'regional:neighboring',
};

/* ── 2 · CURRENTNESS, DATES, NEGATION, RELATIONS — L's PL sets, verbatim ───── */

/** mirrors CURRENCY_MARKERS — words that mean the question is about NOW. */
export const PL_CURRENT = [
  'dzisiaj',
  'dziś',
  'teraz',
  'obecnie',
  'aktualnie',
  'najnowszy',
  'najnowsze',
  'najnowsza',
  'najnowszych',
  'najnowszym',
  'bieżący',
  'bieżąca',
  'bieżące',
  'ostatnio',
  'wczoraj',
  'dotychczas',
  'trwający',
  'trwające',
  'rozwija',
  'wiadomości',
  'nagłówki',
  'nagłówków',
  'doniesienia',
  'relacje',
];
export const PL_DATEWORD = ['wczoraj', 'przedwczoraj', 'jutro', 'pojutrze'];
export const PL_MONTHS = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
];
export const PL_PERIOD_HEADS = [
  'ciągu',
  'przeciągu',
  'ostatnich',
  'ostatnim',
  'ostatniego',
  'kwartale',
];
export const PL_NEGATION = ['nie', 'nigdy', 'żaden', 'żadna', 'żadne', 'żadnych', 'bez', 'ani'];
/** mirrors the comparison arm: compare | comparison | versus | vs. */
export const PL_COMPARISON = [
  'porównaj',
  'porównanie',
  'porównania',
  'porównać',
  'porównajmy',
  'kontra',
];
/** R1-RESIDUAL C-1 — change/movement and stance terms, mirrored concept-for-concept. */
export const PL_CHANGE = [
  'zmiana',
  'zmiany',
  'zmianie',
  'zmianę',
  'zmianą',
  'zmian',
  'wzrost',
  'wzrostu',
  'wzroście',
  'wzrosła',
  'wzrósł',
  'spadek',
  'spadku',
  'spadła',
  'spadł',
  'zmieniło',
  'zmieniła',
  'zmienił',
];
export const PL_STANCE = [
  'stanowisko',
  'stanowiska',
  'stanowisku',
  'stanowiskiem',
  'opinia',
  'opinii',
  'opinię',
  'reakcja',
  'reakcji',
  'odpowiedź',
  'odpowiedzi',
  'polityka',
  'polityki',
];

/** L's current-office construction (read, then bound to the frozen current-status axis). */
export const PL_OFFICE_CONSTRUCTION = rx(
  String.raw`(?:^|[^\p{L}\p{N}])kto\s+jest\s+(?:obecnie\s+|teraz\s+)?(prezydentem|premierem|ministrem|przewodniczącym)` +
    PL_WORD_END,
);

/* ── 3 · STATED PERIOD — the PL mirror of G's producer C, rule for rule ──────
   G's `detectStatedPeriod` is the accepted EN producer of `time.statedPeriod` (BF-09).
   The frozen router's own L2 row records PL "dzisiaj" as a stated period, exactly as G
   records EN "today". These rules mirror G's RULES in G's order — ranges, absolute
   dates, relative-to-ask, bare year — and carry G's precision/anchor/bound values, so
   an EN question and its PL twin state the same period with the same meaning. No clock:
   a relative period is recorded, never resolved (G C, contract §2). */

const PL_MONTH_GEN =
  '(?:stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|wrze[śs]nia|pa[źz]dziernika|listopada|grudnia)';
const PL_MONTH_NOM_LOC =
  '(?:stycze[ńn]|styczniu|luty|lutym|marzec|marcu|kwiecie[ńn]|kwietniu|maj|maju|czerwiec|czerwcu|lipiec|lipcu|sierpie[ńn]|sierpniu|wrzesie[ńn]|wrze[śs]niu|pa[źz]dziernik|pa[źz]dzierniku|listopad|listopadzie|grudzie[ńn]|grudniu)';

export interface PeriodRule {
  readonly pattern: RegExp;
  readonly precision: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'RANGE';
  readonly anchor: 'ABSOLUTE' | 'RELATIVE_TO_ASK';
  readonly bound: 'CLOSED_PAST' | 'OPEN_RECENT' | 'POINT_IN_TIME' | 'UNBOUNDED';
  /** The G rule this mirrors, so a reviewer can pair them. */
  readonly mirrors: string;
}

const W = PL_WORD_END;
const S = String.raw`(?<![\p{L}\p{N}])`;

export const PL_PERIOD_RULES: readonly PeriodRule[] = [
  /* ranges first — G's order */
  {
    pattern: rx(`${S}mi[ęe]dzy\\s+\\d{1,2}\\s+a\\s+\\d{1,2}\\s+${PL_MONTH_GEN}\\s+\\d{4}`),
    precision: 'RANGE',
    anchor: 'ABSOLUTE',
    bound: 'CLOSED_PAST',
    mirrors: 'between D and D MONTH YYYY',
  },
  {
    pattern: rx(
      `${S}od\\s+\\d{1,2}\\s+${PL_MONTH_GEN}\\s+\\d{4}\\s+do\\s+\\d{1,2}\\s+${PL_MONTH_GEN}\\s+\\d{4}`,
    ),
    precision: 'RANGE',
    anchor: 'ABSOLUTE',
    bound: 'CLOSED_PAST',
    mirrors: 'from D MONTH YYYY to D MONTH YYYY',
  },
  {
    pattern: /\d{4}-\d{2}-\d{2}\s+do\s+\d{4}-\d{2}-\d{2}/iu,
    precision: 'RANGE',
    anchor: 'ABSOLUTE',
    bound: 'CLOSED_PAST',
    mirrors: 'YYYY-MM-DD to YYYY-MM-DD',
  },
  /* explicit absolute dates */
  {
    pattern: rx(`${S}\\d{1,2}\\s+${PL_MONTH_GEN}\\s+\\d{4}`),
    precision: 'DAY',
    anchor: 'ABSOLUTE',
    bound: 'POINT_IN_TIME',
    mirrors: 'D MONTH YYYY',
  },
  {
    pattern: /\d{4}-\d{2}-\d{2}/u,
    precision: 'DAY',
    anchor: 'ABSOLUTE',
    bound: 'POINT_IN_TIME',
    mirrors: 'YYYY-MM-DD',
  },
  {
    pattern: rx(`${S}${PL_MONTH_NOM_LOC}\\s+\\d{4}`),
    precision: 'MONTH',
    anchor: 'ABSOLUTE',
    bound: 'CLOSED_PAST',
    mirrors: 'MONTH YYYY',
  },
  /* relative, anchored to the instant of asking */
  {
    pattern: rx(`${S}(?:dzisiaj|dzi[śs])${W}`),
    precision: 'DAY',
    anchor: 'RELATIVE_TO_ASK',
    bound: 'POINT_IN_TIME',
    mirrors: 'today',
  },
  {
    pattern: rx(`${S}wczoraj${W}`),
    precision: 'DAY',
    anchor: 'RELATIVE_TO_ASK',
    bound: 'POINT_IN_TIME',
    mirrors: 'yesterday',
  },
  {
    pattern: rx(`${S}w\\s+(?:zesz[łl]ym|ubieg[łl]ym|poprzednim)\\s+tygodniu${W}`),
    precision: 'WEEK',
    anchor: 'RELATIVE_TO_ASK',
    bound: 'CLOSED_PAST',
    mirrors: 'last week',
  },
  {
    pattern: rx(`${S}w\\s+tym\\s+tygodniu${W}`),
    precision: 'WEEK',
    anchor: 'RELATIVE_TO_ASK',
    bound: 'OPEN_RECENT',
    mirrors: 'this week',
  },
  {
    pattern: rx(`${S}w\\s+(?:zesz[łl]ym|ubieg[łl]ym|poprzednim)\\s+miesi[ąa]cu${W}`),
    precision: 'MONTH',
    anchor: 'RELATIVE_TO_ASK',
    bound: 'CLOSED_PAST',
    mirrors: 'last month',
  },
  {
    pattern: rx(`${S}w\\s+tym\\s+miesi[ąa]cu${W}`),
    precision: 'MONTH',
    anchor: 'RELATIVE_TO_ASK',
    bound: 'OPEN_RECENT',
    mirrors: 'this month',
  },
  {
    pattern: rx(`${S}w\\s+tym\\s+roku${W}`),
    precision: 'YEAR',
    anchor: 'RELATIVE_TO_ASK',
    bound: 'OPEN_RECENT',
    mirrors: 'this year',
  },
  {
    pattern: rx(`${S}w\\s+(?:zesz[łl]ym|ubieg[łl]ym|poprzednim)\\s+roku${W}`),
    precision: 'YEAR',
    anchor: 'RELATIVE_TO_ASK',
    bound: 'CLOSED_PAST',
    mirrors: 'last year',
  },
  /* a bare year, last */
  {
    pattern: /(?<!\d)(?:19|20)\d{2}(?!\d)/u,
    precision: 'YEAR',
    anchor: 'ABSOLUTE',
    bound: 'CLOSED_PAST',
    mirrors: 'YYYY',
  },
];

/* ── 4 · STATED-PERIOD FALLBACK — L's residual periods beyond G's closed set ──
   G's producer has no rule for "in the last three months", "since January", "next week"
   or "tomorrow"; L's reading does (C-1 DATE_STATED / PERIOD_STATED). These are consulted
   only when G's rules return nothing, in BOTH languages, mirrored pair for pair. */
export interface FallbackPeriodRule {
  readonly pattern: RegExp;
  readonly anchor: 'ABSOLUTE' | 'RELATIVE_TO_ASK';
  readonly mirrors: string;
}

export const EN_FALLBACK_PERIOD_RULES: readonly FallbackPeriodRule[] = [
  {
    pattern: /\b(?:in\s+the\s+)?(?:last|past)\s+\w+\s+(?:days?|weeks?|months?|years?|quarters?)\b/i,
    anchor: 'RELATIVE_TO_ASK',
    mirrors: 'last N units',
  },
  {
    pattern:
      /\bsince\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
    anchor: 'RELATIVE_TO_ASK',
    mirrors: 'since MONTH',
  },
  {
    pattern: /\bnext\s+(?:week|month|year)\b/i,
    anchor: 'RELATIVE_TO_ASK',
    mirrors: 'next week|month|year',
  },
  { pattern: /\btomorrow\b/i, anchor: 'RELATIVE_TO_ASK', mirrors: 'tomorrow' },
  { pattern: /\blast\s+night\b/i, anchor: 'RELATIVE_TO_ASK', mirrors: 'last night' },
];

export const PL_FALLBACK_PERIOD_RULES: readonly FallbackPeriodRule[] = [
  {
    pattern: rx(
      `${S}(?:w\\s+)?(?:ci[ąa]gu\\s+|przeci[ąa]gu\\s+)?ostatnich\\s+[\\p{L}\\p{N}]+\\s+(?:dni|tygodni|miesi[ęe]cy|lat|kwarta[łl][óo]w)${W}`,
    ),
    anchor: 'RELATIVE_TO_ASK',
    mirrors: 'last N units',
  },
  {
    pattern: rx(`${S}od\\s+${PL_MONTH_GEN}${W}`),
    anchor: 'RELATIVE_TO_ASK',
    mirrors: 'since MONTH',
  },
  {
    pattern: rx(`${S}w\\s+przysz[łl]ym\\s+(?:tygodniu|miesi[ąa]cu|roku)${W}`),
    anchor: 'RELATIVE_TO_ASK',
    mirrors: 'next week|month|year',
  },
  { pattern: rx(`${S}jutro${W}`), anchor: 'RELATIVE_TO_ASK', mirrors: 'tomorrow' },
  { pattern: rx(`${S}wczoraj\\s+wieczorem${W}`), anchor: 'RELATIVE_TO_ASK', mirrors: 'last night' },
];

/* ── 5 · READER CATEGORY — the PL mirror of G's producer B category terms ─────
   Keyed by G's EN `READER_CATEGORY_TERMS` key. Naming, not aboutness — the same narrow
   discipline as G: a word that merely relates to a category is not here. */
export const PL_CATEGORY_FORMS: Readonly<Record<string, readonly string[]>> = {
  entertainment: [
    'rozrywka',
    'rozrywki',
    'rozrywce',
    'rozrywkę',
    'rozrywką',
    'rozrywkowe',
    'rozrywkowych',
  ],
  'show business': ['show-biznes', 'showbiznes', 'showbiznesu', 'showbiznesie'],
  culture: ['kultura', 'kultury', 'kulturze', 'kulturę', 'kulturą'],
  sport: ['sport', 'sportu', 'sporcie', 'sportem', 'sportowe', 'sportowych'],
  politics: ['polityka', 'polityki', 'polityce', 'politykę', 'polityką'],
  political: [
    'polityczny',
    'polityczna',
    'polityczne',
    'politycznej',
    'politycznym',
    'politycznych',
  ],
  business: ['biznes', 'biznesu', 'biznesie', 'biznesem', 'biznesowe', 'biznesowych'],
  economy: [
    'gospodarka',
    'gospodarki',
    'gospodarce',
    'gospodarkę',
    'gospodarką',
    'ekonomia',
    'ekonomii',
    'ekonomię',
  ],
  economic: [
    'gospodarczy',
    'gospodarcza',
    'gospodarcze',
    'gospodarczej',
    'gospodarczym',
    'ekonomiczny',
    'ekonomiczna',
    'ekonomiczne',
    'ekonomicznej',
  ],
  technology: ['technologia', 'technologii', 'technologię', 'technologią'],
  science: ['nauka', 'nauki', 'nauce', 'naukę', 'nauką'],
  scientific: ['naukowy', 'naukowa', 'naukowe', 'naukowej', 'naukowych'],
  health: ['zdrowie', 'zdrowia', 'zdrowiu', 'zdrowiem'],
  world: ['świat', 'świata', 'świecie', 'światem'],
};

/* ── 6 · QQ-10 · THE POLISH SEMANTIC SUBJECT ───────────────────────────────────
   G's EN discriminator is the determiner: a role takes an article, a name does not.
   Polish has no articles, and the contract forbids simulating them. Polish marks the
   same difference IN THE QUESTION FRAME instead:

     "Czym jest inflacja?"        asks what X IS — a kind or a named concept
                                  ≡ EN bare / indefinite subject ("What is inflation?")
     "Jaka jest stopa inflacji?"  asks for the VALUE of X — presupposes a referent
                                  ≡ EN definite description ("What is the inflation rate?")
     "Kto jest prezydentem?"      identity of an office holder — a role
                                  ≡ EN "Who is the president?"
     "Kim jest Kagame?"           identity of a named person
                                  ≡ EN "Who is Kagame?"

   So the frame carries the meaning English puts in the article. That is equivalence
   of meaning, not of grammar — the reading records WHICH meaning, never an article. */

export type PlSubjectFrameKind = 'CONCEPT' | 'IDENTITY' | 'VALUE';

export interface PlSubjectFrame {
  readonly pattern: RegExp;
  readonly kind: PlSubjectFrameKind;
  /** The G `REFERENCE_FRAMES` member this frame mirrors in meaning. */
  readonly mirrors: string;
}

export const PL_SUBJECT_FRAMES: readonly PlSubjectFrame[] = [
  {
    pattern: /^czym\s+(?:jest|s[ąa]|by[łl]a?|by[łl]o|by[łl]y)\s+(.+)$/iu,
    kind: 'CONCEPT',
    mirrors: 'what is|was|are|were X',
  },
  {
    pattern: /^co\s+to\s+(?:jest|s[ąa]|by[łl]o)\s+(.+)$/iu,
    kind: 'CONCEPT',
    mirrors: 'what is|was|are|were X',
  },
  /* NOT "co oznacza X" (≡ "what does X mean"): G's EN frames do not read that shape, and a
     Polish frame English lacks is over-coverage — measured on L pair RF2. */
  {
    pattern: /^(?:wyja[śs]nij|wyt[łl]umacz)\s+(?:mi\s+)?(?:czym\s+(?:jest|s[ąa])\s+)?(.+)$/iu,
    kind: 'CONCEPT',
    mirrors: 'explain X',
  },
  { pattern: /^opisz\s+(.+)$/iu, kind: 'CONCEPT', mirrors: 'describe X' },
  {
    pattern: /^jak\s+dzia[łl]a(?:j[ąa])?\s+(.+)$/iu,
    kind: 'CONCEPT',
    mirrors: 'how does|do X work',
  },
  {
    pattern: /^(?:opowiedz|powiedz)\s+mi\s+o\s+(.+)$/iu,
    kind: 'CONCEPT',
    mirrors: 'tell me about X',
  },
  { pattern: /^co\s+wiesz\s+o\s+(.+)$/iu, kind: 'CONCEPT', mirrors: 'what do you know about X' },
  {
    pattern: /^kim\s+(?:jest|s[ąa]|by[łl]a?|byli)\s+(.+)$/iu,
    kind: 'IDENTITY',
    mirrors: 'who is|was|are|were X',
  },
  { pattern: /^kto\s+(?:jest|by[łl]a?)\s+(.+)$/iu, kind: 'IDENTITY', mirrors: 'who is|was X' },
  {
    pattern: /^(?:jaki|jaka|jakie|jacy)\s+(?:jest|s[ąa]|by[łl]a?|by[łl]o|by[łl]y|byli)\s+(.+)$/iu,
    kind: 'VALUE',
    mirrors: 'what is|was THE X (definite)',
  },
  {
    pattern: /^ile\s+(?:wynosi|wynosz[ąa]|wynosi[łl]a?|wynosi[łl]o)\s+(.+)$/iu,
    kind: 'VALUE',
    mirrors: 'what is THE X (definite)',
  },
];

/**
 * G's `OFFICE_HEAD_NOUNS`, keyed by the EN noun, with the closed Polish surface forms
 * for the same office. A spec asserts every key is one of G's nouns, so this can never
 * cover an office English does not. Forms include the instrumental that the identity
 * frame takes ("Kto jest prezydentem?").
 */
export const PL_OFFICE_HEAD_NOUNS: Readonly<Record<string, readonly string[]>> = {
  president: ['prezydent', 'prezydenta', 'prezydentem', 'prezydentowi', 'prezydencie'],
  'vice president': ['wiceprezydent', 'wiceprezydenta', 'wiceprezydentem'],
  'prime minister': ['premier', 'premiera', 'premierem', 'premierowi', 'premierze'],
  'deputy prime minister': ['wicepremier', 'wicepremiera', 'wicepremierem'],
  'head of state': ['głowa państwa', 'głową państwa'],
  'head of government': ['szef rządu', 'szefem rządu'],
  government: ['rząd', 'rządu', 'rządem', 'rządzie'],
  cabinet: ['gabinet', 'gabinetu', 'gabinetem'],
  parliament: ['parlament', 'parlamentu', 'parlamentem', 'sejm', 'sejmu', 'sejmem'],
  senate: ['senat', 'senatu', 'senatem'],
  ministry: ['ministerstwo', 'ministerstwa', 'ministerstwem'],
  minister: ['minister', 'ministra', 'ministrem', 'ministrowi'],
  'central bank': ['bank centralny', 'banku centralnego', 'bankiem centralnym'],
  'supreme court': ['sąd najwyższy', 'sądu najwyższego', 'sądem najwyższym'],
  'constitutional court': ['trybunał konstytucyjny', 'trybunału konstytucyjnego'],
  'attorney general': [
    'prokurator generalny',
    'prokuratora generalnego',
    'prokuratorem generalnym',
  ],
  'electoral commission': ['komisja wyborcza', 'komisji wyborczej', 'komisją wyborczą'],
  presidency: ['prezydencja', 'prezydencji', 'prezydencją'],
  monarch: ['monarcha', 'monarchy', 'monarchą'],
  king: ['król', 'króla', 'królem'],
  queen: ['królowa', 'królowej', 'królową'],
  governor: ['gubernator', 'gubernatora', 'gubernatorem'],
  ambassador: ['ambasador', 'ambasadora', 'ambasadorem'],
  embassy: ['ambasada', 'ambasady', 'ambasadą'],
  military: ['wojsko', 'wojska', 'wojskiem'],
  'armed forces': ['siły zbrojne', 'sił zbrojnych', 'siłami zbrojnymi'],
};

/**
 * G's DEFINITE determiners ('this', 'that', 'these', 'those', 'my', 'our', 'their') are
 * words Polish HAS — demonstratives and possessives — so their Polish equivalents mark a
 * referent exactly as they do in English. ('the' has no Polish counterpart and none is
 * simulated.)
 */
export const PL_DEFINITE_DETERMINERS: readonly string[] = [
  'ten',
  'ta',
  'to',
  'tego',
  'tej',
  'temu',
  'tę',
  'tym',
  'tą',
  'ci',
  'te',
  'tych',
  'tymi',
  'tamten',
  'tamta',
  'tamto',
  'tamci',
  'tamte',
  'mój',
  'moja',
  'moje',
  'mojego',
  'mojej',
  'moi',
  'nasz',
  'nasza',
  'nasze',
  'naszego',
  'naszej',
  'nasi',
  'ich',
  'jego',
  'jej',
];

/** G's NON_NAME_INTERNAL, in Polish: words that cannot sit inside a name. */
export const PL_NON_NAME_INTERNAL: readonly string[] = [
  'w',
  'we',
  'na',
  'o',
  'od',
  'do',
  'z',
  'ze',
  'dla',
  'przez',
  'przy',
  'po',
  'pod',
  'nad',
  'między',
  'wobec',
  'i',
  'oraz',
  'lub',
  'albo',
  'a',
  'jest',
  'są',
  'był',
  'była',
  'było',
  'się',
  'dzieje',
  'dzieją',
  'tutaj',
  'tu',
  'teraz',
];
