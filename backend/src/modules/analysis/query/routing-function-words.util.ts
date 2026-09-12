/**
 * G-ALPHA-2 STAGE 1 — A LONE FUNCTION WORD IS NEVER GEOGRAPHY.
 *
 * THE DEFECT. Country resolution accepts ISO alpha-2/alpha-3 identifiers
 * case-insensitively, and several of those codes are spelled exactly like
 * ordinary English and Polish function words. Nothing in the pipeline asked
 * whether a token was being used as a place, so the sentence
 *
 *     "Explain what quantum is and elaborate more about it."
 *
 * matched COUNTRY_CONTEXT_PATTERN on "about it", handed the segment "it" to the
 * resolver, got Italy (ISO2 "IT"), and routed the entire question into the
 * Italian country feed. Measured on the governing Alpha baseline, the following
 * lowercase tokens each resolve to a sovereign country:
 *
 *   EN (17): am->Armenia  at->Austria  be->Belgium  by->Belarus
 *            do->Dominican Republic    in->India    is->Iceland  it->Italy
 *            me->Montenegro  my->Malaysia  no->Norway  so->Somalia
 *            to->Tonga  us->United States  and->Andorra  are->UAE
 *            can->Canada
 *   PL  (9): to->Tonga  za->South Africa  do->Dominican Republic
 *            co->Colombia  bo->Bolivia  ci->Cote d'Ivoire  mu->Mauritius
 *            na->Namibia  my->Malaysia
 *
 * WHY THIS LIST IS NOT THAT LIST. The set below is a closed list of CLOSED-CLASS
 * words — pronouns, determiners, prepositions, conjunctions, auxiliaries,
 * particles — in the two languages the product serves. It is deliberately NOT
 * derived from the country table. Enumerating today's collisions would silently
 * stop protecting the product the moment a code was added, and it would encode
 * an accident of the gazetteer as if it were a rule. The rule is linguistic: a
 * word that can only ever be grammatical scaffolding is not the user naming a
 * place. Every entry is verified in the accompanying spec to be a function word
 * and never a country NAME — only codes collide here, never names, so no
 * country becomes unreachable by its own name.
 *
 * WHAT STILL RESOLVES. The guard refuses a lone function word only when it is
 * written in prose case. An explicitly capitalised code is untouched, because
 * ordinary prose essentially never spells a common word in full caps
 * mid-sentence — the same reasoning that already lets
 * ALL_CAPS_CODE_TOKEN_PATTERN scan ungated. So:
 *
 *     "news in US"    -> United States   (kept: explicit code)
 *     "IT sector"     -> Italy           (kept: unchanged pre-existing behaviour)
 *     "about it"      -> no geography    (fixed)
 *     "co dzieje sie" -> no geography    (fixed)
 *
 * And multi-word candidates are never consulted at all: this can only ever
 * refuse a single bare token, so "in the United States", "in India", "in Italy"
 * and every other real geographic phrase take precisely the path they took
 * before.
 */

/**
 * English closed-class words. Restricted to grammatical scaffolding; no noun,
 * verb, adjective or adverb that could name or describe a place appears here.
 */
const ENGLISH_FUNCTION_WORDS: readonly string[] = [
  'a',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'am',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  'can',
  'cannot',
  'could',
  'did',
  'do',
  'does',
  'doing',
  'done',
  'down',
  'during',
  'each',
  'either',
  'few',
  'for',
  'from',
  'further',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'here',
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  'i',
  'if',
  'in',
  'inside',
  'into',
  'is',
  'it',
  'its',
  'itself',
  'just',
  'may',
  'me',
  'might',
  'mine',
  'more',
  'most',
  'much',
  'must',
  'my',
  'myself',
  'neither',
  'no',
  'nor',
  'not',
  'now',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'ought',
  'our',
  'ours',
  'ourselves',
  'out',
  'outside',
  'over',
  'own',
  'same',
  'shall',
  'she',
  'should',
  'so',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'upon',
  'us',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'whether',
  'which',
  'while',
  'who',
  'whom',
  'whose',
  'why',
  'will',
  'with',
  'within',
  'would',
  'you',
  'your',
  'yours',
  'yourself',
];

/**
 * Polish closed-class words. The product ships a Polish surface, so a Polish
 * sentence must be protected by the same rule; "co", "to", "za", "do", "bo",
 * "ci", "mu" and "na" are among the most frequent words in the language and
 * every one of them resolves to a country today.
 */
const POLISH_FUNCTION_WORDS: readonly string[] = [
  'a',
  'aby',
  'albo',
  'ale',
  'ani',
  'az',
  'aż',
  'bardzo',
  'bez',
  'bo',
  'by',
  'byc',
  'być',
  'byl',
  'był',
  'byla',
  'była',
  'byli',
  'bylo',
  'było',
  'ci',
  'co',
  'czy',
  'czym',
  'dla',
  'do',
  'gdy',
  'gdzie',
  'go',
  'i',
  'ich',
  'ile',
  'im',
  'jak',
  'jaka',
  'jaki',
  'jakie',
  'je',
  'jego',
  'jej',
  'jest',
  'jeszcze',
  'juz',
  'już',
  'ja',
  'ją',
  'kto',
  'ktory',
  'który',
  'ktora',
  'która',
  'ktore',
  'które',
  'lub',
  'ma',
  'mi',
  'moze',
  'może',
  'mu',
  'my',
  'na',
  'nad',
  'nam',
  'nas',
  'nasz',
  'nic',
  'nie',
  'nim',
  'niz',
  'niż',
  'o',
  'od',
  'oraz',
  'on',
  'ona',
  'one',
  'oni',
  'ono',
  'po',
  'pod',
  'przed',
  'przez',
  'przy',
  'sa',
  'są',
  'sie',
  'się',
  'tak',
  'takze',
  'także',
  'tam',
  'te',
  'tego',
  'tej',
  'ten',
  'teraz',
  'tez',
  'też',
  'to',
  'tu',
  'tych',
  'tylko',
  'tym',
  'u',
  'w',
  'we',
  'wiec',
  'więc',
  'wszystko',
  'wy',
  'z',
  'za',
  'ze',
  'że',
  'zeby',
  'żeby',
];

/**
 * The routing guard's vocabulary. Exported so the intent classifier and the
 * geographic resolver share ONE list — two copies would be two places for the
 * same rule to drift.
 */
export const ROUTING_FUNCTION_WORDS: ReadonlySet<string> = new Set<string>([
  ...ENGLISH_FUNCTION_WORDS,
  ...POLISH_FUNCTION_WORDS,
]);

/**
 * Strips surrounding punctuation so a token lifted straight out of a sentence
 * ("it.", "(it)", "it's" -> "its") is judged on its word, not its punctuation.
 * Apostrophes are removed rather than treated as separators so the possessive
 * and contracted forms fold onto the base entry.
 */
function toComparableWord(token: string): string {
  return token
    .normalize('NFC')
    .replace(/['’]/g, '')
    .replace(/^[^\p{L}\p{N}]+/gu, '')
    .replace(/[^\p{L}\p{N}]+$/gu, '')
    .toLowerCase();
}

/**
 * True when the token is grammatical scaffolding in either supported language.
 * Case-insensitive by design: this answers "what word is this", not "how was it
 * written". The written form is a separate question, asked by
 * isExplicitCountryCodeToken() below.
 */
export function isRoutingFunctionWord(token: string): boolean {
  const word = toComparableWord(token);

  return word.length > 0 && ROUTING_FUNCTION_WORDS.has(word);
}

/**
 * True when the token is written the way an ISO code is written and no other
 * way — two or three letters, all capitals. "US", "UK", "IT", "AND" qualify;
 * "us", "Us", "USA1", "United" do not.
 */
export function isExplicitCountryCodeToken(token: string): boolean {
  const bare = token.replace(/^[^\p{L}\p{N}]+/gu, '').replace(/[^\p{L}\p{N}]+$/gu, '');

  return /^[A-Z]{2,3}$/.test(bare);
}

/**
 * THE GUARD. True when this candidate must not be allowed to resolve to a
 * place.
 *
 * Fires only for a candidate that is a SINGLE bare token which is a function
 * word written in prose case. A multi-word candidate, a capitalised code, and
 * anything outside the closed list all return false and proceed unchanged, so
 * the guard can only ever subtract the misreadings it was built for.
 */
export function blocksGeographicRouting(candidate: string): boolean {
  const trimmed = candidate.trim();

  if (trimmed.length === 0) {
    return false;
  }

  if (/\s/.test(trimmed)) {
    return false;
  }

  if (isExplicitCountryCodeToken(trimmed)) {
    return false;
  }

  return isRoutingFunctionWord(trimmed);
}
