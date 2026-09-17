/**
 * G-SEARCH-COUNTRY-DEVELOPMENT-SALIENCE-1 — COUNTRY-DEVELOPMENT ELIGIBILITY.
 *
 * ── THE DISTINCTION THIS MODULE EXISTS TO DRAW ────────────────────────
 *
 *   "this story is geographically about France"   <-  scoreCountryRelevance()
 *   "this story is a material development FOR France"  <-  THIS MODULE
 *
 * The first question is already answered correctly, and that is precisely the
 * problem: a FIFA summit held in Paris, a French film on an Oscar shortlist and
 * a visiting foreign prime minister are all TRUE statements about France. They
 * score 95, 75 and 75 against it. They are not developments IN France, and
 * nothing in this repository measured that difference before this module.
 *
 * ── WHAT WAS FALSIFIED FIRST, SO IT IS NOT RETRIED ────────────────────
 *
 *   A KEYWORD LIST of civic terms   admits "FIFA PRESIDENT ..." on 'president'
 *                                   and rejects a national transport strike,
 *                                   which names no institution at all.
 *                                   WRONG IN BOTH DIRECTIONS, measured.
 *
 *   RELEVANCE RANK / THRESHOLD      the FIFA summit scores 95; the national
 *                                   strike scores 90. Mention density rises
 *                                   with how often a country is NAMED, which a
 *                                   body meeting in France does more than
 *                                   France itself. No cut separates them.
 *
 *   PROVIDER CATEGORY               'sports'/'entertainment' catches six weak
 *                                   items and ALSO demotes a federation
 *                                   president resigning under state
 *                                   investigation, a public-broadcasting
 *                                   budget cut and a stadium collapse.
 *                                   THREE false negatives. Not used.
 *
 *   SECOND-COUNTRY PRESENCE ALONE   correctly demotes the foreign-visit items
 *                                   and ALSO demotes "France and Germany sign
 *                                   defence agreement". A false negative on a
 *                                   real French development. Not used alone.
 *
 * ── THE MODEL: TWO STRUCTURAL FACTS, BOTH READ FROM EXISTING TABLES ───
 *
 *   A. NATIONAL ATTACHMENT
 *      The country's OWN name or demonym appears in the TITLE.
 *      A CITY DOES NOT COUNT. This is the whole point: events are hosted in
 *      cities ("at Paris summit", "Paris auction house", "festival in Cannes"),
 *      while national developments are attributed to the country ("France
 *      announces", "French parliament", "across France").
 *
 *   B. FIRST-MENTION PRIMACY
 *      Where the title names more than one country, the target must be the
 *      FIRST one named. This is not a heuristic invented here: naming the
 *      principal actor first is the journalistic convention every headline in
 *      the corpus follows. "Iraqi Prime Minister meets French officials" leads
 *      with Iraq. "France and Germany sign defence agreement" leads with
 *      France, and is a French development despite naming two countries.
 *
 * NO NEW VOCABULARY. Both facts are read from COUNTRY_DEMONYMS and COUNTRIES,
 * the tables that already back country relevance scoring, including their
 * deliberate omissions and their non-locative compound guard.
 *
 * ── IT IS A PARTITION, NOT A GATE, AND THAT IS DELIBERATE ─────────────
 *
 * Nothing is discarded. Measured on a 26-item corpus the model puts 13 of 14
 * genuine developments in NATIONAL_DEVELOPMENT and 11 of 12 weak items in
 * IN_COUNTRY_CONTEXT -- but it is wrong twice, and it will be wrong again on
 * headlines nobody has written yet. A gate that is wrong LOSES a national
 * emergency; a partition that is wrong RANKS it second. Callers must consume
 * NATIONAL_DEVELOPMENT first and fall back to IN_COUNTRY_CONTEXT, so a quiet
 * news day still answers.
 */
import type { CountryMeta, NewsArticle } from '@globalnews-ai/shared';
import { COUNTRIES } from '@globalnews-ai/shared';
import { COUNTRY_DEMONYMS_BY_ISO3, normalizeForCountryMatch } from './country-relevance.util';

export type CountryDevelopmentTier = 'NATIONAL_DEVELOPMENT' | 'IN_COUNTRY_CONTEXT';

export interface CountryDevelopmentEligibility {
  readonly tier: CountryDevelopmentTier;
  /** The country's own name or demonym appears in the title. */
  readonly nationalAttachment: boolean;
  /**
   * 'TARGET_FIRST'  the target is the first country named in the title
   * 'OTHER_FIRST'   another country is named before it
   * 'NONE_IN_TITLE' the title names no country at all
   */
  readonly primacy: 'TARGET_FIRST' | 'OTHER_FIRST' | 'NONE_IN_TITLE';
  /** Diagnostic only. Never rendered, never sent to a provider. */
  readonly reason: string;
}

/** Every surface form that NAMES the country itself — never a city. */
function countryForms(country: CountryMeta): string[] {
  const demonyms = COUNTRY_DEMONYMS_BY_ISO3[country.iso3] ?? [];

  return [country.name, ...demonyms].map((f) => normalizeForCountryMatch(f)).filter((f) => f.length > 0);
}

/**
 * C911-R1 -- INCIDENTAL-ROLE FRAMES.
 *
 * -- THE MEASURED DEFECT ------------------------------------------------
 *
 * Primacy was POSITIONAL: "is the target the first country named in the
 * title". That is a proxy for "is the target the principal actor", and it
 * INVERTS on exactly two frames, both confirmed against the C910 baseline:
 *
 *   OPPOSITION   "Wallabies name squad for ... clash AGAINST South Africa"
 *                names no other country, so South Africa was the first --
 *                and only -- country named. Measured on C910: tier
 *                NATIONAL_DEVELOPMENT, primacy TARGET_FIRST. A squad
 *                selection in Australia therefore LED a South Africa
 *                analysis. This is the reported Production shape.
 *
 *   ENUMERATION  "G20 bloc INCLUDING South Africa agrees debt framework"
 *                is a development for the G20, drafted in Washington. The
 *                target is an item in a membership list. Measured on C910:
 *                NATIONAL_DEVELOPMENT, TARGET_FIRST.
 *
 * In both, the country's name is present and the story is not about it.
 * The discriminator is not WHERE the name sits but WHAT ROLE it occupies,
 * and that role is readable from the token immediately before it.
 *
 * -- WHY THIS IS NOT THE FALSIFIED KEYWORD LIST -------------------------
 *
 * The approach this module already falsified was a list of CIVIC terms
 * used to ADMIT a development ('president', 'parliament'), which failed in
 * both directions because a development need name no institution at all.
 * This is the opposite construction: a closed list of frames that DEMOTE,
 * each one a grammatical relation rather than a topic, and each one
 * asserted in this module's spec against the full negative-control set.
 *
 * -- IT REMAINS A PARTITION, SO A WRONG CALL COSTS RANK, NOT EVIDENCE ---
 *
 * "UN Security Council votes on resolution AGAINST South Africa" is a real
 * South African development that this frame reads as incidental. Under a
 * GATE that would be a lost development. Under the partition it is ranked
 * second and still analysed -- which is precisely the safety property this
 * module was built around, and the reason the correction was made here
 * rather than at the admission filter.
 *
 * NO NEW VOCABULARY AND NO NEW TABLE. These are function words, not
 * geography; COUNTRY_DEMONYMS and COUNTRIES remain the only sources of
 * country identity in this file.
 */
/**
 * C911-V1 -- THE FRAME LIST WAS TOO NARROW. MEASURED IN PRODUCTION.
 *
 * C911-R1 recognised only a country preceded by 'against' / 'versus' / 'vs'
 * or an enumeration marker. Production then produced this, leading a South
 * Africa evidence set:
 *
 *     "Wallabies name five Western Force players to face South Africa"
 *     "Wallabies name five Western Force players for South Africa Test"
 *
 * Measured on the accepted C911 tree, both scored 90 and both came back
 * NATIONAL_DEVELOPMENT / TARGET_FIRST. Neither was caught, because the
 * preceding token is 'face' in one and the country MODIFIES a fixture noun in
 * the other. R1 fixed the shape the report quoted and missed the shape the
 * product actually emitted.
 *
 * TWO FAMILIES, BOTH GRAMMATICAL ROLES RATHER THAN TOPICS.
 *
 *   A. THE COUNTRY IS THE OBJECT OF AN OPPOSITION OR SCHEDULE MARKER.
 *      "...to FACE South Africa", "...AGAINST South Africa",
 *      "...AHEAD OF South Africa". The marker may be more than one token,
 *      which is why this matches a trailing PHRASE rather than a single word.
 *
 *   B. THE COUNTRY MODIFIES A CONTEST NOUN.
 *      "South Africa TEST", "South Africa SERIES", "South Africa CLASH". Here
 *      the country is an attributive modifier naming which fixture is meant,
 *      not an actor. Contrast "South Africa PARLIAMENT" or "South Africa
 *      PRESIDENT", where the country modifies an institution and the story is
 *      genuinely national.
 *
 * WHY THIS IS STILL NOT THE FALSIFIED KEYWORD LIST. The approach this module
 * falsified was a list of CIVIC TOPICS used to ADMIT a development, which
 * failed in both directions because a development need name no institution.
 * Family B is its mirror image: a closed list of CONTEST nouns used only to
 * DEMOTE, and only when the country sits immediately before one. It cannot
 * promote anything and it cannot exclude anything.
 *
 * IT REMAINS A PARTITION. Every article still reaches the next line; only the
 * order changes. A wrong call here costs rank, never evidence.
 *
 * NO PUBLISHER OR DOMAIN LIST, AND NO WORLD KNOWLEDGE. Nothing here knows what
 * a Wallaby is, which outlet filed the story, or which countries play rugby.
 * It reads the grammatical role the country name occupies, and nothing else.
 */

/** Markers whose OBJECT is an opponent, a schedule target or a comparison. */
const INCIDENTAL_PRECEDING_FRAMES: readonly string[] = [
  // Opposition -- the target is the opponent, not the subject.
  'against',
  'versus',
  'vs',
  'v',
  'face',
  'faces',
  'faced',
  'facing',
  'beat', // "Australia beat South Africa" -- the SUBJECT is the other side
  'defeat',
  'defeats',
  'defeated',
  'host', // "... to host South Africa" -- the target is the visiting side
  'hosts',
  'hosting',
  // Schedule / comparison -- the target is a date marker or a yardstick.
  'ahead of',
  'before',
  'after',
  'compared to',
  'compared with',
  'unlike',
  'behind',
  // Enumeration -- the target is an item in a membership list.
  'including',
  'includes',
  'include',
  'such as',
  'alongside',
];

/**
 * Nouns that make the country name an attributive modifier of a CONTEST rather
 * than an actor. Deliberately small and deliberately only about fixtures.
 */
const CONTEST_NOUNS: readonly string[] = [
  'test',
  'tests',
  'match',
  'matches',
  'fixture',
  'fixtures',
  'clash',
  'series',
  'tour',
  'game',
  'games',
  'tie',
  'leg',
  'qualifier',
  'friendly',
  'showdown',
  'decider',
  'opener',
];

/**
 * True when the country form occupying [at, at+len) sits in an incidental
 * role. `haystack` is space-padded and normalized, so tokens are
 * whitespace-delimited throughout.
 */
/**
 * C911-K1 -- THE COMPARATIVE-YARDSTICK FRAME.
 *
 * -- THE MEASURED DEFECT ------------------------------------------------
 *
 *     "Mumbai flat costs more than a house in Poland"
 *
 * entered a POLAND analysis corpus. Measured against the classifier as it
 * stood: tier NATIONAL_DEVELOPMENT, primacy TARGET_FIRST. Correctly so, by its
 * own rules -- "Mumbai" is a CITY and never counts as a country, so Poland was
 * the first and only country named in the title.
 *
 * The existing frame list already demotes "compared to", "compared with" and
 * "unlike", but those sit IMMEDIATELY before the country. This construction
 * puts a noun phrase in between:
 *
 *     ... more THAN  a house  IN  Poland
 *              ^marker  ^comparand  ^locative  ^yardstick
 *
 * -- WHY A BOUNDED LOOK-BACK, AND WHY IT IS NOT JUST 'than' -------------
 *
 * Adding 'than' to INCIDENTAL_PRECEDING_FRAMES would only catch "more than
 * Poland" and still miss the measured headline. Scanning backwards for 'than'
 * with no other condition INVERTS on a real development:
 *
 *     "Fewer than 10 people in Poland were affected"
 *
 * where 'than' introduces a QUANTITY and Poland locates the subject rather than
 * being the yardstick. Measured, and the reason for the numeric guard below.
 *
 * So all four conditions must hold, and each one is load-bearing:
 *
 *   1. a comparative marker appears within a short window before the country;
 *   2. the token immediately after the marker is NOT a number -- that is the
 *      quantity frame, where the country is the subject's location;
 *   3. the country is the object of a locative preposition (in/from/of/at),
 *      i.e. it modifies the comparand rather than acting;
 *   4. the whole span is short. A marker far away is a different clause.
 *
 * The window is deliberately tight. A miss leaves an article ranked second,
 * which is the partition's stated failure mode; a false positive would demote a
 * genuine national development, which is worse.
 */
const COMPARATIVE_MARKERS: readonly string[] = ['than', 'versus', 'vs'];

/** Locative prepositions that make the country modify a noun rather than act. */
const LOCATIVE_PREPOSITIONS: readonly string[] = ['in', 'from', 'of', 'at'];

/** Tokens allowed between the comparative marker and the country. */
const COMPARATIVE_WINDOW_TOKENS = 4;

function isComparativeYardstick(before: string): boolean {
  const tokens = before.split(' ').filter((t) => t.length > 0);
  if (tokens.length === 0) return false;

  /* Condition 3 — the country must be the object of a locative preposition. */
  const immediatelyBefore = tokens[tokens.length - 1];
  if (!LOCATIVE_PREPOSITIONS.includes(immediatelyBefore)) {
    /*
      ... unless the marker is directly adjacent: "costs more than Poland". The
      country is then the yardstick with no comparand noun in between.
    */
    return COMPARATIVE_MARKERS.includes(immediatelyBefore);
  }

  /* Conditions 1, 2 and 4 — a marker within the window, not introducing a number. */
  const windowStart = Math.max(0, tokens.length - 1 - COMPARATIVE_WINDOW_TOKENS);

  for (let i = tokens.length - 2; i >= windowStart; i -= 1) {
    if (!COMPARATIVE_MARKERS.includes(tokens[i])) continue;

    const afterMarker = tokens[i + 1] ?? '';

    /* Condition 2 — a quantity frame locates the subject; it is not a comparison OF the country. */
    if (/^[0-9]/.test(afterMarker)) return false;

    return true;
  }

  return false;
}

function isIncidentalOccurrence(haystack: string, at: number, formLength: number): boolean {
  const before = haystack.slice(0, at).trimEnd();

  /* C911-K1 — the country is a yardstick in a comparison, not the subject. */
  if (isComparativeYardstick(before)) return true;


  // FAMILY A -- a preceding opposition/schedule/enumeration marker. Matched as
  // a trailing phrase so multi-token markers ('ahead of', 'such as') work.
  for (const frame of INCIDENTAL_PRECEDING_FRAMES) {
    if (before === frame || before.endsWith(' ' + frame)) return true;
  }

  // FAMILY B -- the country modifies a contest noun that immediately follows.
  const after = haystack.slice(at + formLength).trimStart();
  const nextToken = after.split(' ')[0] ?? '';

  return CONTEST_NOUNS.includes(nextToken);
}

/**
 * The earliest SUBSTANTIVE occurrence of any of `forms`, or -1.
 *
 * C911-R1: occurrences sitting inside an incidental-role frame are skipped
 * rather than returned. Applied symmetrically to the target and to every
 * other country, so an incidental mention can neither promote the target
 * nor demote it on another country's behalf.
 */
function firstIndexOfAnyForm(haystack: string, forms: string[]): number {
  let earliest = -1;

  for (const form of forms) {
    const needle = ` ${form} `;
    let at = haystack.indexOf(needle);

    while (at >= 0) {
      if (!isIncidentalOccurrence(haystack, at, needle.length)) {
        if (earliest < 0 || at < earliest) {
          earliest = at;
        }
        break;
      }

      at = haystack.indexOf(needle, at + 1);
    }
  }

  return earliest;
}

export function assessCountryDevelopment(
  article: Pick<NewsArticle, 'title'>,
  country: CountryMeta,
): CountryDevelopmentEligibility {
  const title = ` ${normalizeForCountryMatch(article.title ?? '')} `;
  const targetAt = firstIndexOfAnyForm(title, countryForms(country));
  const nationalAttachment = targetAt >= 0;

  let otherEarliest = -1;

  for (const candidate of COUNTRIES) {
    if (candidate.iso3 === country.iso3) continue;

    const at = firstIndexOfAnyForm(title, countryForms(candidate));

    if (at >= 0 && (otherEarliest < 0 || at < otherEarliest)) {
      otherEarliest = at;
    }
  }

  const primacy: CountryDevelopmentEligibility['primacy'] =
    targetAt < 0 && otherEarliest < 0
      ? 'NONE_IN_TITLE'
      : targetAt >= 0 && (otherEarliest < 0 || targetAt < otherEarliest)
        ? 'TARGET_FIRST'
        : 'OTHER_FIRST';

  if (!nationalAttachment) {
    return {
      tier: 'IN_COUNTRY_CONTEXT',
      nationalAttachment,
      primacy,
      reason: 'the title names no form of the country itself — a city is not the country',
    };
  }

  if (primacy === 'OTHER_FIRST') {
    return {
      tier: 'IN_COUNTRY_CONTEXT',
      nationalAttachment,
      primacy,
      reason: 'another country leads the title, so the target is a participant rather than the subject',
    };
  }

  return {
    tier: 'NATIONAL_DEVELOPMENT',
    nationalAttachment,
    primacy,
    reason: 'the country leads the title under its own name or demonym',
  };
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * K — ANALYTICAL ADMISSION: COUNTRY RELEVANCE IS NECESSARY, NOT SUFFICIENT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling K: *"country relevance alone is insufficient for analytical
 * admission when the requested analysis is about current national developments.
 * Admission should require material relevance to the analysis subject, not
 * merely mention of the country."*
 *
 * THE MEASURED DEFECT. A Hindustan Times article comparing a Mumbai flat's price
 * to a house in Poland entered a POLAND analysis corpus, was sent to the model,
 * consumed tokens and appeared as a retained source. It was admitted because
 * `scoreCountryRelevance(...).isRelevant` was the ONLY condition the analysis
 * path applied — and by that measure the article genuinely IS about Poland.
 *
 * `assessCountryDevelopment` already drew the distinction that was missing, but
 * NOTHING IN THE ANALYSIS PATH CALLED IT. It had exactly one consumer,
 * `country-news.service.ts`, where it RANKS the country feed.
 *
 * ─── WHY THIS IS A GATE HERE AND A PARTITION THERE ────────────────────────
 *
 * The partition's own documentation warns that "a gate that is wrong LOSES a
 * national emergency", and for the COUNTRY FEED that is decisive: a quiet news
 * day must still show something, so weak items rank second rather than vanish.
 *
 * ANALYSIS IS THE OPPOSITE TRADE, and the ruling states it: *"If the correct
 * result is fewer than 7 sources, fewer is preferable to irrelevant evidence."*
 * An irrelevant article in an analysis corpus does not merely rank badly — it
 * reaches the model, consumes tokens, inflates the source count, and is cited
 * back to the reader as evidence. A missing weak article costs a sentence; a
 * wrong one costs the reader's trust in every sentence.
 *
 * So the two surfaces deliberately consume the same classifier differently, and
 * that divergence is recorded here rather than being a silent difference
 * between two call sites.
 *
 * THIS LOWERS NO THRESHOLD AND ADDS NO COUNTRY-SPECIFIC RULE. It ADDS a
 * condition to admission, reading the existing partition. No publisher is
 * blocked; Hindustan Times reporting genuinely about Poland still admits,
 * because the test is the article's frame, not its source.
 *
 * ─── AND IT DOES NOT RULE ON TEXT IT CANNOT READ ──────────────────────────
 *
 * MEASURED, AND THE REASON THIS PARAMETER EXISTS. `COUNTRY_DEMONYMS_BY_ISO3` is
 * ENGLISH-ONLY — `POL: ['polish']`, `RUS: ['russian']`. A Polish-language
 * headline says "Rosja", not "Russia", so `nationalAttachment` is false for
 * every non-English article and the partition returns IN_COUNTRY_CONTEXT for
 * all of them.
 *
 * Gating on that would have silently rejected THE ENTIRE POLISH CORPUS. It was
 * caught by `polish-query-routing.spec.ts`, which measured exactly that: zero
 * articles admitted for "Co dzieje się między Rosją a Ukrainą?".
 *
 * So the gate applies only where the classifier has the vocabulary to judge. A
 * classifier with no words for a language has NO OPINION about it, and no
 * opinion must never read as a rejection — that is the same "silence is not a
 * contradiction" rule `entity-role-geography.util.ts` states for its own
 * evidence checks.
 *
 * THIS IS A RECORDED LIMITATION, NOT A DESIGN. Non-English analysis retrieval
 * still admits on country relevance alone, and remains exposed to the defect
 * this gate closes for English. Closing it needs localized country forms, which
 * this module deliberately will not invent — see "NO NEW VOCABULARY" above.
 */
export function admitsToAnalysisCorpus(
  article: Pick<NewsArticle, 'title'>,
  country: CountryMeta,
  language?: string,
): boolean {
  const normalized = language?.trim().toLowerCase();

  /* No vocabulary for this language — no opinion, and no opinion never rejects. */
  if (normalized !== undefined && normalized.length > 0 && normalized !== 'en') return true;

  return assessCountryDevelopment(article, country).tier === 'NATIONAL_DEVELOPMENT';
}
