import type { CountryMeta, LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import {
  COUNTRIES,
  getCuratedCityNames,
  getLocalizedCountryName,
  resolveCountryByCity,
} from '@globalnews-ai/shared';

export interface CountryRelevanceResult {
  score: number;
  isRelevant: boolean;
  reasons: string[];
}

const COUNTRY_CONTEXT_TERMS = [
  'government',
  'president',
  'capital',
  'army',
  'military',
  'border',
  'citizens',
  'nationals',
  'country',
  'state',
  'province',
  'city',
  'refugees',
  'migrants',
  'embassy',
  'election',
  'parliament',
  'economy',
  'war',
  'conflict',
  'peace',
  'humanitarian',
];

const PERSON_CONTEXT_TERMS = [
  'student',
  'pupil',
  'class',
  'school',
  'teacher',
  'professor',
  'doctor',
  'actor',
  'actress',
  'player',
  'singer',
  'candidate',
  'aged',
  'born',
  'mr',
  'mrs',
  'ms',
  'dr',
];

/**
 * G2 CORRECTION B — DEMONYMS, AS AN EXPLICIT CURATED TABLE.
 *
 * Explicit entries are safer than generating demonyms: English forms are
 * irregular ('dutch', 'swiss', 'filipino') and a generated suffix rule would
 * manufacture words that are not demonyms at all.
 *
 * TIER 1 below is safe under the capitalisation guard alone. TIER 2 needs the
 * non-locative compound exclusions as well, and each entry there is annotated
 * with the collision that puts it in that tier.
 *
 * THREE DEMONYMS ARE DELIBERATELY ABSENT and must stay absent — they are
 * ambiguous between sovereign states or dominated by non-geographic senses:
 *
 *   'korean'     -> South Korea AND North Korea. Only the explicit compound
 *                   forms appear below.
 *   'congolese'  -> DR Congo AND Congo.
 *   'guinean'    -> Guinea, Equatorial Guinea AND Papua New Guinea. Only the
 *                   unambiguous 'papua new guinean' appears below.
 *   'dominican'  -> Dominican Republic AND Dominica; also a religious order.
 *   'american'   -> the United States, but also Latin/South/Central/North
 *                   American and African American. The worst collision here.
 *   'georgian'   -> Georgia, the US state, an architectural period, a name.
 *   'english' / 'scottish' / 'welsh' -> not ISO entities, and 'english' would
 *                   match almost every article ever written.
 */
const COUNTRY_DEMONYMS: Partial<Record<string, string[]>> = {
  /* ── TIER 1 — no known non-geographic sense ──────────────────────────── */
  CAN: ['canadian'],
  MEX: ['mexican'],
  BRA: ['brazilian'],
  ARG: ['argentine', 'argentinian'],
  CHL: ['chilean'],
  COL: ['colombian'],
  PER: ['peruvian'],
  VEN: ['venezuelan'],
  GBR: ['british'],
  IRL: ['irish'],
  ITA: ['italian'],
  NLD: ['dutch'],
  AUT: ['austrian'],
  FIN: ['finnish'],
  POL: ['polish'],
  UKR: ['ukrainian'],
  ROU: ['romanian'],
  CZE: ['czech'],
  HUN: ['hungarian'],
  SRB: ['serbian'],
  HRV: ['croatian'],
  ISL: ['icelandic'],
  CYP: ['cypriot'],
  SVK: ['slovak', 'slovakian'],
  SVN: ['slovenian', 'slovene'],
  BGR: ['bulgarian'],
  ALB: ['albanian'],
  MNE: ['montenegrin'],
  BIH: ['bosnian'],
  MDA: ['moldovan'],
  BLR: ['belarusian'],
  LTU: ['lithuanian'],
  LVA: ['latvian'],
  EST: ['estonian'],
  PAK: ['pakistani'],
  BGD: ['bangladeshi'],
  IDN: ['indonesian'],
  PHL: ['filipino', 'philippine'],
  VNM: ['vietnamese'],
  MYS: ['malaysian'],
  SGP: ['singaporean'],
  TWN: ['taiwanese'],
  IRN: ['iranian'],
  IRQ: ['iraqi'],
  SYR: ['syrian'],
  PSE: ['palestinian'],
  SAU: ['saudi'],
  ARE: ['emirati'],
  QAT: ['qatari'],
  JOR: ['jordanian'],
  LBN: ['lebanese'],
  YEM: ['yemeni'],
  ARM: ['armenian'],
  AZE: ['azerbaijani'],
  KAZ: ['kazakh'],
  UZB: ['uzbek'],
  NPL: ['nepali', 'nepalese'],
  LKA: ['sri lankan'],
  MNG: ['mongolian'],
  KWT: ['kuwaiti'],
  OMN: ['omani'],
  EGY: ['egyptian'],
  LBY: ['libyan'],
  DZA: ['algerian'],
  TUN: ['tunisian'],
  ETH: ['ethiopian'],
  KEN: ['kenyan'],
  TZA: ['tanzanian'],
  UGA: ['ugandan'],
  NGA: ['nigerian'],
  GHA: ['ghanaian'],
  SEN: ['senegalese'],
  MLI: ['malian'],
  TCD: ['chadian'],
  CMR: ['cameroonian'],
  AGO: ['angolan'],
  ZMB: ['zambian'],
  ZWE: ['zimbabwean'],
  MOZ: ['mozambican'],
  ZAF: ['south african'],
  NAM: ['namibian'],
  RWA: ['rwandan'],
  AUS: ['australian'],
  FJI: ['fijian'],
  KOR: ['south korean'],
  PRK: ['north korean'],
  SDN: ['sudanese'],
  SSD: ['south sudanese'],
  PNG: ['papua new guinean'],

  /* ── TIER 2 — real demonyms with a real non-geographic sense; each is
     covered by NON_LOCATIVE_COMPOUNDS below ──────────────────────────── */
  FRA: ['french'],
  DEU: ['german'],
  RUS: ['russian'],
  CHE: ['swiss'],
  DNK: ['danish'],
  GRC: ['greek'],
  TUR: ['turkish'],
  ESP: ['spanish'],
  PRT: ['portuguese'],
  BEL: ['belgian'],
  SWE: ['swedish'],
  NOR: ['norwegian'],
  JPN: ['japanese'],
  ISR: ['israeli'],
  MAR: ['moroccan'],
  CUB: ['cuban'],
  MLT: ['maltese'],
  SOM: ['somali'],
  MMR: ['burmese'],
  THA: ['thai'],
  CHN: ['chinese'],
  IND: ['indian'],
  AFG: ['afghan'],
  MKD: ['macedonian'],
  NER: ['nigerien'],
};

/**
 * G2 CORRECTION B-3 — PHRASES WHERE A DEMONYM NAMES A THING, NOT A PLACE.
 *
 * A food, a breed, a product or an organisation. Where a demonym occurs ONLY
 * inside one of these, it is not evidence of location.
 *
 * BOUNDED ON PURPOSE. This list is small, curated and closed — the same species
 * of table shared/countries.ts already keeps for aliases and cities. It is NOT
 * and cannot be exhaustive, and it must not be grown indefinitely: the weight
 * separation in scoreCountryRelevance (a demonym never outranks a place) is
 * what bounds the damage when a compound is missing from here.
 *
 * It can only ever REMOVE a resolution, so a miss fails closed.
 */
const NON_LOCATIVE_COMPOUNDS: Partial<Record<string, string[]>> = {
  danish: ['danish pastry', 'danish pastries'],
  french: [
    'french fries',
    'french fry',
    'french press',
    'french door',
    'french doors',
    'french toast',
    'french bulldog',
  ],
  german: ['german shepherd', 'german shepherds', 'german measles'],
  russian: ['russian roulette', 'russian dressing'],
  swiss: ['swiss cheese', 'swiss army'],
  greek: ['greek yogurt', 'greek yoghurt'],
  turkish: ['turkish delight', 'turkish bath', 'turkish baths'],
  spanish: ['spanish flu', 'spanish moss'],
  portuguese: ['portuguese man o war', 'portuguese man of war'],
  belgian: ['belgian waffle', 'belgian waffles'],
  swedish: ['swedish massage'],
  norwegian: ['norwegian cruise line', 'norwegian cruise'],
  japanese: ['japanese knotweed'],
  israeli: ['israeli couscous'],
  moroccan: ['moroccan oil'],
  cuban: ['cuban sandwich', 'cuban heel'],
  maltese: ['maltese terrier'],
  burmese: ['burmese cat'],
  thai: ['pad thai', 'thai curry', 'thai massage'],
  chinese: ['chinese takeaway', 'chinese takeout'],
  indian: ['indian ocean', 'indian summer', 'west indian', 'american indian'],
  canadian: ['canadian bacon'],
  mexican: ['mexican standoff'],
  brazilian: ['brazilian wax'],
};

/**
 * G2 CORRECTION A — THE CURATED CITIES THIS COUNTRY OWNS.
 *
 * NO NEW GEOGRAPHIC DATA. Every entry is derived at module load from the two
 * functions shared/countries.ts already exports for exactly this purpose:
 * getCuratedCityNames() enumerates the curated CITY_TO_ISO3 keys, and
 * resolveCountryByCity() maps each one to its country. Nothing here is
 * authored, guessed, or inferred from a category, and no coordinate is
 * invented — a city only ever names the country the repository already says
 * it belongs to.
 *
 * WHY PRECOMPUTED. scoreCountryRelevance() is called once per country, so a
 * caller sweeping the whole world runs it 195 times over one article. Building
 * this table once at load keeps that sweep the same shape it already had; the
 * per-call work is one Record lookup.
 *
 * The values are the curated keys verbatim, lowercase, and are compared with
 * the SAME preparedContainsPhrase() whole-phrase test the country name uses —
 * so 'delhi' cannot match inside 'New Delhi Road' by substring, and multi-word
 * curated entries such as 'new delhi' and 'addis ababa' still match as phrases.
 */
const CURATED_CITIES_BY_ISO3: Record<string, string[]> = (() => {
  const table: Record<string, string[]> = {};

  for (const city of getCuratedCityNames()) {
    const country = resolveCountryByCity(city);

    if (!country) {
      continue;
    }

    (table[country.iso3] ??= []).push(city);
  }

  return table;
})();

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * M66.14B — PREPARED TEXT, COMPUTED ONCE.
 *
 * normalize() runs two Unicode-property regex passes over its whole input, and
 * containsWholePhrase() used to call it on the ARTICLE TEXT every single time.
 * A single scoreCountryRelevance() call performs 30-60 such checks, and callers
 * that sweep every country repeat all of them 195 times over text that never
 * changes. Preparing each distinct text once and reusing it is worth ~5x on that
 * workload and costs nothing on the existing single-country path.
 *
 * THIS IS A REFACTOR, NOT A RULE CHANGE. Same normalization, same comparison,
 * same order, same results. normalize() is pure and deterministic, so computing
 * it once is identical to computing it sixty times. No weight, threshold, alias,
 * demonym, localized name, ISO check, context term or reasons string is touched,
 * and no candidate is skipped. Proven by a differential test in this file's spec.
 *
 * containsWholePhrase() KEEPS ITS SIGNATURE so articleMentionsCity() and every
 * other caller are untouched; it is now a thin wrapper over the two halves.
 */
function prepareText(text: string): string {
  return ` ${normalize(text)} `;
}

function preparedContainsPhrase(preparedText: string, phrase: string): boolean {
  const normalizedPhrase = normalize(phrase);

  return normalizedPhrase.length > 0 ? preparedText.includes(` ${normalizedPhrase} `) : false;
}

function containsWholePhrase(text: string, phrase: string): boolean {
  return preparedContainsPhrase(prepareText(text), phrase);
}

/**
 * Milestone #50 Phase C (multilingual country-relevance containment)
 * — `localizedName` is new and optional. Every existing caller that
 * never passes it (search()/GNewsProvider.search() context, or any
 * call with no language context) behaves byte-for-byte as before:
 * only the canonical English name and demonyms are checked. When
 * present, it's an ADDITIONAL positive signal alongside the canonical
 * name — never a replacement — derived centrally via
 * getLocalizedCountryName() (Intl.DisplayNames, the same mechanism
 * already established for display in Milestone #49), never a second,
 * manually-maintained translation table. Because it's resolved from
 * THAT country's own ISO2 code specifically, a Polish localized name
 * can never accidentally match a different country's article (Poland
 * resolves "Polska", not Germany's "Niemcy" or any other country's
 * name).
 */
/**
 * G2 CORRECTION B — LONGEST NAME WINS.
 *
 * PRE-EXISTING DEFECT, FIXED. preparedContainsPhrase is a whole-phrase test on
 * space-padded text, so 'South Sudan' CONTAINS ' sudan '. Sudan therefore
 * matched every South Sudan article and — on the resulting score tie — won it
 * on COUNTRIES declaration order. The same shape affects Congo inside DR Congo,
 * and Guinea inside Equatorial Guinea, Papua New Guinea and Guinea-Bissau.
 *
 * DERIVED, NOT CURATED. The table below is computed at module load from
 * COUNTRIES itself: for each country name, the OTHER country names that contain
 * it as a whole phrase. No pair is hand-listed, so a future country name cannot
 * reintroduce the defect by being forgotten here.
 *
 * The rule: a country's own name does not count as evidence while a strictly
 * longer country name that contains it is present in the same text.
 */
const LONGER_NAMES_BY_ISO3: Record<string, string[]> = (() => {
  const table: Record<string, string[]> = {};

  for (const country of COUNTRIES) {
    const padded = ` ${normalize(country.name)} `;

    const longer = COUNTRIES.filter(
      (other) =>
        other.iso3 !== country.iso3 &&
        normalize(other.name).length > normalize(country.name).length &&
        ` ${normalize(other.name)} `.includes(padded),
    ).map((other) => other.name);

    if (longer.length > 0) {
      table[country.iso3] = longer;
    }
  }

  return table;
})();

/**
 * G1 — COUNTRY/SUBNATIONAL COLLISION.
 *
 * THE DEFECT THIS CLOSES, measured on the real article that exposed it.
 * "Bago Mourns Village Head Killed By Bandits In Niger", whose text names Niger
 * State in Nigeria, resolved to the sovereign country NIGER — and when the text
 * spelled out "Niger State, Nigeria" in full, Niger still beat Nigeria 100 to
 * 40. Being named outright was worth less than being half of somebody else's
 * name. The same shape sends "State of Georgia" to sovereign Georgia and "New
 * Mexico" to sovereign Mexico.
 *
 * WHY THE EXISTING GUARD DID NOT CATCH IT. LONGER_NAMES_BY_ISO3 above suppresses
 * a country whose name is contained, as a whole phrase, in a longer COUNTRY
 * name — which is what stops Sudan winning South Sudan articles. It is derived
 * from COUNTRIES and therefore knows country names and nothing else. " nigeria "
 * does not contain " niger " (the padding fails), and no subdivision vocabulary
 * exists anywhere in this repository to consult.
 *
 * THIS IS THE SAME MECHANISM, NOT A NEW ONE. It is the longer-name override
 * extended from country names to a deliberately tiny, hand-checked set of
 * subnational names that collide with a sovereign country. It adds no scoring
 * tier, no weight and no threshold.
 *
 * DELIBERATELY NOT A WORLD SUBDIVISION GAZETTEER. Three entries, each one an
 * administrative name that is unambiguous on its own. Enumerating the world's
 * subdivisions would be a data layer, and this repair was not authorised to
 * build one — nor could it, honestly, from inside this file.
 *
 * WHAT IS DELIBERATELY ABSENT, and must stay absent:
 *   "georgia state"  — Georgia State University, Georgia State Panthers. The
 *                      string describes institutions far more often than the
 *                      place, and this guard has to stay geographical.
 *   "niger delta"    — a region of Nigeria, but the phrase is also used loosely
 *                      of the river basin across borders. Not unambiguous.
 *   bare "georgia"   — the sovereign country. Obviously.
 *
 * PRECISION-FIRST, AND UNRESOLVED IS AN ACCEPTABLE ANSWER. `parentIso3` is set
 * only where the phrase alone establishes the parent country beyond argument.
 * Where it would not, the entry would suppress the collision and offer nothing,
 * leaving the article unresolved — which is better than an unsupported claim.
 */
interface SubnationalCollision {
  /** The subnational name, exactly as written. Matched as a whole phrase. */
  readonly phrase: string;
  /** ISO3 of the sovereign country whose NAME collides inside that phrase. */
  readonly collidesWithIso3: string;
  /**
   * ISO3 of the sovereign country the phrase actually belongs to, when the
   * phrase alone proves it. Undefined means "suppress, but claim nothing".
   */
  readonly parentIso3?: string;
}

const SUBNATIONAL_COLLISIONS: readonly SubnationalCollision[] = [
  // Niger State, Nigeria. The confirmed case. Nigeria has exactly one state of
  // this name and no other country has a "Niger State", so the parent is proven.
  { phrase: 'niger state', collidesWithIso3: 'NER', parentIso3: 'NGA' },

  // The State of Georgia, United States. The full form only — see the note above
  // on why "georgia state" is excluded.
  { phrase: 'state of georgia', collidesWithIso3: 'GEO', parentIso3: 'USA' },

  // New Mexico, United States. A single unambiguous administrative name that
  // happens to contain a sovereign country's name; no qualifier word involved,
  // which is why a rule about the word "State" alone would not have caught it.
  { phrase: 'new mexico', collidesWithIso3: 'MEX', parentIso3: 'USA' },
];

/** Collisions that suppress a given country, indexed once at module load. */
const COLLISIONS_SUPPRESSING_ISO3: Record<string, SubnationalCollision[]> = (() => {
  const table: Record<string, SubnationalCollision[]> = {};
  for (const collision of SUBNATIONAL_COLLISIONS) {
    (table[collision.collidesWithIso3] ??= []).push(collision);
  }
  return table;
})();

/** Collisions that provide parent-country evidence for a given country. */
const COLLISIONS_NAMING_PARENT_ISO3: Record<string, SubnationalCollision[]> = (() => {
  const table: Record<string, SubnationalCollision[]> = {};
  for (const collision of SUBNATIONAL_COLLISIONS) {
    if (collision.parentIso3) {
      (table[collision.parentIso3] ??= []).push(collision);
    }
  }
  return table;
})();

/**
 * G1 — the suppression half.
 *
 * DOCUMENT-LEVEL. Called once per country from scoreCountryRelevance() with
 * the prepared FULL text, not per field. Once a text has established that
 * "Georgia" here means the US state, every other bare "Georgia" in that same
 * text means it too. An occurrence-scoped rule does not satisfy the requirement
 * that "State of Georgia, USA" must never resolve to sovereign Georgia — a
 * headline reading "Georgia lawmakers pass..." still carries a bare occurrence
 * worth 60 on its own, and the article resolves to the wrong country anyway.
 * That is not hypothetical: it is what the first attempt at this repair did.
 *
 * THE COST, STATED PLAINLY: an article genuinely about sovereign Mexico that
 * also mentions New Mexico loses its Mexico evidence and will most likely
 * resolve to nothing. That is the trade this rule makes, it is pinned by its
 * own test rather than left to be discovered, and unresolved is the outcome the
 * contract prefers over an unsupported claim.
 */
function isOverriddenBySubnationalCollision(preparedText: string, country: CountryMeta): boolean {
  const collisions = COLLISIONS_SUPPRESSING_ISO3[country.iso3] ?? [];

  return collisions.some((collision) => preparedContainsPhrase(preparedText, collision.phrase));
}

/**
 * G1 — the parent-evidence half.
 *
 * "Niger State" is as certain a statement that an article concerns Nigeria as
 * the word "Nigeria" would be, so it is OR-ed into the SAME two place signals
 * at the SAME weights, exactly as G2 CORRECTION A did for curated cities. No
 * new tier, no new weight.
 */
function containsSubnationalParentReference(preparedText: string, country: CountryMeta): boolean {
  const collisions = COLLISIONS_NAMING_PARENT_ISO3[country.iso3] ?? [];

  return collisions.some((collision) => preparedContainsPhrase(preparedText, collision.phrase));
}

/**
 * G2 — the subdivision qualifier must not argue for the wrong nation.
 *
 * 'state' and 'province' are COUNTRY_CONTEXT_TERMS, so before this repair the
 * word "State" in "Niger State" ADDED to sovereign Niger's score: measured,
 * "Attack in Niger." scored 30 and "Attack in Niger State." scored 35. The very
 * token that proves the place is a subdivision was counted as proof that it is
 * a nation.
 *
 * THE FIX IS SCOPED TO THE COLLIDING COUNTRY AND TO THE MATCHED PHRASE. The
 * collision phrase is removed from the text this country's context terms are
 * counted over, and from nothing else. 'state' and 'province' stay in
 * COUNTRY_CONTEXT_TERMS and keep counting everywhere else and for every other
 * country — "the state visit", "the province declared" are ordinary country
 * context and are untouched, which is asserted by its own test.
 */
function textForContextTerms(preparedFullText: string, country: CountryMeta): string {
  const collisions = COLLISIONS_SUPPRESSING_ISO3[country.iso3] ?? [];

  if (collisions.length === 0) {
    return preparedFullText;
  }

  return collisions.reduce((text, collision) => {
    const normalizedPhrase = normalize(collision.phrase);

    return normalizedPhrase.length > 0 ? text.split(` ${normalizedPhrase} `).join('  ') : text;
  }, preparedFullText);
}

function isOverriddenByLongerName(preparedText: string, country: CountryMeta): boolean {
  const longer = LONGER_NAMES_BY_ISO3[country.iso3] ?? [];

  return longer.some((name) => preparedContainsPhrase(preparedText, name));
}

/**
 * G2 CORRECTION B — DEMONYMS NO LONGER COUNT HERE.
 *
 * This function is PLACE evidence only: the canonical name, the localized name,
 * and (via containsCuratedCityReference at the call site) a curated city.
 * Demonyms moved to containsDemonymReference() and score lower, because a
 * demonym states nationality or origin and NOT where an event happened —
 * 'Chinese-owned factory opens in Kenya' is a Kenya story.
 */
function containsCountryReference(
  preparedText: string,
  country: CountryMeta,
  localizedName?: string,
): boolean {
  if (isOverriddenByLongerName(preparedText, country)) {
    return false;
  }

  if (preparedContainsPhrase(preparedText, country.name)) {
    return true;
  }

  return Boolean(localizedName) && preparedContainsPhrase(preparedText, localizedName as string);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasPersonContext(preparedText: string): boolean {
  return PERSON_CONTEXT_TERMS.some((term) => preparedContainsPhrase(preparedText, term));
}

/**
 * G2 — PROPER-NAME PROTECTION FOR CURATED CITIES.
 *
 * A CITY TOKEN IS NOT AUTOMATICALLY EVIDENCE OF LOCATION. That is the whole
 * rule, and Milestone 27 is the test that holds this file to it: a stored
 * article is RETRIEVED by a free-text search for the city, so if the same token
 * is then allowed to prove the article is about the country, the check has
 * become circular and CountryNewsService has no gate at all.
 *
 * WHAT THIS REPLACED, AND WHY. The first version of this guard required PERSON
 * context before it would reject anything — because the collisions named at the
 * time were Denzel WASHINGTON, PARIS Hilton and Irving BERLIN, all people. That
 * was the wrong category. 'Kigali Coffee Co. opens new location' is an
 * ORGANISATION, and a brand article contains no person-context term by
 * construction, so the guard could never fire on the class it most needed to
 * catch. It scored 65 for Rwanda and broke the Milestone 27 assertion.
 *
 * PERSONHOOD WAS NEVER THE DISTINGUISHING FEATURE. ADJACENCY IS:
 *
 *     Denzel Washington · Paris Hilton · Kigali Coffee Co.
 *     Washington Post   · Berlin Wall  · Tokyo Olympics
 *
 * A curated city sitting beside another CAPITALISED word is part of a NAME. A
 * city doing the work of a place is not — 'Kigali hosts', 'Berlin coalition',
 * 'Beijing reports', 'Kyiv says', 'Nairobi expands', 'Warsaw confirmed'.
 *
 * THE TEST, IN ORDER:
 *
 *  1. A GEOGRAPHIC PREPOSITION SETTLES IT. 'in Kigali', 'from Berlin', 'near
 *     Moscow' — introduced as a location, it IS the location, whatever follows.
 *     This is the same idea AnalysisService's COUNTRY_CONTEXT_PATTERN already
 *     encodes for queries, and it is what keeps 'in New Delhi' and 'in Addis
 *     Ababa' working inside otherwise capitalised copy.
 *
 *  2. PRECEDED BY A CAPITALISED WORD -> a name. 'Denzel Washington'. Minus the
 *     geographic prefixes ('North', 'South', 'New', ...) that
 *     isLikelySurnameOnlyMention() already excludes for the same reason, so
 *     'New Delhi' and 'South Sudan' are never mistaken for surnames.
 *
 *  3. FOLLOWED BY A CAPITALISED WORD -> a name. 'Kigali Coffee', 'Paris
 *     Hilton', 'Berlin Wall', 'Tokyo Olympics', 'Moscow Exchange'.
 *
 * MULTI-WORD CITIES ARE NO LONGER EXEMPT. The old exemption reasoned that
 * 'new delhi' cannot be a personal name — true, and irrelevant, because it can
 * certainly be part of an organisation name. The city is matched as a whole
 * phrase and the adjacency test is applied to the phrase, so 'New Delhi
 * announces...' and 'Addis Ababa hosts...' still read as places (the following
 * word is lower case) while 'New Delhi Metro Corp' would not.
 *
 * NO BRAND LIST, NO SPECIAL CASE. The rule is structural. It cannot be defeated
 * by a company this table has never heard of, and it needs no maintenance.
 *
 * FAILING CLOSED IS THE POINT. A rejection drops the CITY evidence only. The
 * article can still resolve on other evidence — 'Kigali marks anniversary with
 * Rwanda ceremony' resolves through the country name — and where it cannot, the
 * honest answer is Location unresolved. No location beats the wrong location.
 *
 * KNOWN AND ACCEPTED LIMITATION — TITLE-CASED HEADLINES.
 * In a fully title-cased headline ('Kigali Marks Anniversary') every word is
 * capitalised, so rule 3 cannot tell a name from a sentence and the city
 * evidence is dropped. That is a FALSE NEGATIVE, chosen deliberately: it fails
 * closed, rule 1 still rescues the prepositional forms, such an article can
 * still resolve through a country name, and every provider fixture in this
 * repository is sentence-cased. Documented rather than guessed at, per CTO
 * decision; a future milestone that fixes it should expect this file's
 * title-case test to fail and be converted.
 */
const CITY_GEOGRAPHIC_PREPOSITIONS = [
  'in',
  'from',
  'at',
  'near',
  'across',
  'into',
  'outside',
  'around',
  'to',
];

/** Mirrors the geographic prefixes isLikelySurnameOnlyMention() already excludes. */
const CITY_GEOGRAPHIC_PREFIXES = new Set(['north', 'south', 'east', 'west', 'new']);

function isLikelyProperNameCityMention(rawText: string, city: string): boolean {
  const capitalized = city
    .split(/\s+/)
    .map((word) => escapeRegExp(word.charAt(0).toUpperCase() + word.slice(1)))
    .join('\\s+');

  // 1. Introduced as a place.
  const introducedAsPlace = new RegExp(
    `\\b(?:${CITY_GEOGRAPHIC_PREPOSITIONS.join('|')})\\s+${capitalized}\\b`,
    'i',
  );

  if (introducedAsPlace.test(rawText)) {
    return false;
  }

  // 2. Preceded by a capitalised word.
  const preceded = new RegExp(`\\b([A-Z][a-z]+)\\s+${capitalized}\\b`).exec(rawText);

  if (preceded && !CITY_GEOGRAPHIC_PREFIXES.has(preceded[1].toLowerCase())) {
    return true;
  }

  // 3. Followed by a capitalised word.
  return new RegExp(`\\b${capitalized}\\s+[A-Z][a-zA-Z]*`).test(rawText);
}

/**
 * G2 CORRECTION B — DEMONYM EVIDENCE.
 *
 * Three guards, in order, before a demonym counts at all.
 *
 * B-1  CAPITALISED IN THE SOURCE. normalize() lowercases everything, so an
 *      unguarded table resolves POLAND from 'nail polish' and AFGHANISTAN from
 *      'an afghan draped over the sofa'. A proper adjective is always
 *      capitalised and the colliding common word never is, so the raw text
 *      settles it. Title case and full upper case both count; nothing else does.
 *
 * B-3  NOT ONLY INSIDE A NON-LOCATIVE COMPOUND. 'Danish pastry' is capitalised,
 *      so B-1 cannot catch it. The compound is removed from the text and the
 *      demonym re-tested: if every occurrence was inside one, it does not count.
 *
 *      LONGEST DEMONYM WINS, same rule and same reason as the names above:
 *      'south sudanese' contains ' sudanese ', so South Sudan must take it.
 *      Derived from the table, not hand-listed.
 *
 * The weight this earns is set at the call site, and it is deliberately BELOW
 * a place — see scoreCountryRelevance.
 */
const LONGER_DEMONYMS: Record<string, string[]> = (() => {
  const all = Object.values(COUNTRY_DEMONYMS).flatMap((list) => list ?? []);
  const table: Record<string, string[]> = {};

  for (const demonym of all) {
    const longer = all.filter(
      (other) => other.length > demonym.length && ` ${other} `.includes(` ${demonym} `),
    );

    if (longer.length > 0) {
      table[demonym] = longer;
    }
  }

  return table;
})();

/**
 * An ISO 3166-1 code, written as a code: the exact uppercase token, on word
 * boundaries, in the un-normalized source. See the call site for the eight
 * English function words this stops from scoring as countries.
 */
function containsIsoCode(rawText: string, code: string): boolean {
  return new RegExp(`\\b${escapeRegExp(code.toUpperCase())}\\b`).test(rawText);
}
/** Title case and full upper case, both anchored on word boundaries. */
function appearsCapitalized(rawText: string, phrase: string): boolean {
  const words = phrase.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return false;
  }

  const titleCase = words
    .map((word) => escapeRegExp(word.charAt(0).toUpperCase() + word.slice(1)))
    .join('\\s+');

  const upperCase = words.map((word) => escapeRegExp(word.toUpperCase())).join('\\s+');

  return new RegExp(`\\b(?:${titleCase}|${upperCase})\\b`).test(rawText);
}

/** Removes every non-locative compound for this demonym from a prepared text. */
function withoutNonLocativeCompounds(preparedText: string, demonym: string): string {
  const compounds = NON_LOCATIVE_COMPOUNDS[demonym] ?? [];

  return compounds.reduce(
    (text, compound) => text.split(` ${normalize(compound)} `).join(' '),
    preparedText,
  );
}

function containsDemonymReference(
  preparedText: string,
  rawText: string,
  country: CountryMeta,
): boolean {
  const demonyms = COUNTRY_DEMONYMS[country.iso3] ?? [];

  return demonyms.some((demonym) => {
    if (!preparedContainsPhrase(preparedText, demonym)) {
      return false;
    }

    // B-1 — the source must actually capitalise it.
    if (!appearsCapitalized(rawText, demonym)) {
      return false;
    }

    // Longest demonym wins: 'South Sudanese' is not evidence of Sudan.
    const longer = LONGER_DEMONYMS[demonym] ?? [];

    if (longer.some((other) => preparedContainsPhrase(preparedText, other))) {
      return false;
    }

    // B-3 — it must survive outside its non-locative compounds.
    return preparedContainsPhrase(withoutNonLocativeCompounds(preparedText, demonym), demonym);
  });
}
/**
 * G2 CORRECTION A — does this text name the country through one of ITS OWN
 * curated cities?
 *
 * Kept OUT of containsCountryReference() on purpose. That function is also
 * called by isLikelySurnameOnlyMention(), where folding cities in would have
 * silently disarmed the country surname guard; and leaving it byte-identical
 * keeps another lane's in-flight formatting of it intact.
 *
 * `rawText` is the un-normalized source, because the proper-name shapes are
 * capitalisation-dependent — see isLikelyProperNameCityMention above. The
 * prepared full text is no longer needed: the guard is structural now and does
 * not consult article-wide person context.
 */
function containsCuratedCityReference(
  preparedText: string,
  rawText: string,
  country: CountryMeta,
): boolean {
  const cities = CURATED_CITIES_BY_ISO3[country.iso3] ?? [];

  return cities.some(
    (city) =>
      preparedContainsPhrase(preparedText, city) && !isLikelyProperNameCityMention(rawText, city),
  );
}

function isLikelySurnameOnlyMention(
  preparedTitle: string,
  preparedSummary: string,
  summary: string,
  country: CountryMeta,
  localizedName?: string,
): boolean {
  if (containsCountryReference(preparedTitle, country, localizedName)) {
    return false;
  }

  if (!hasPersonContext(preparedSummary)) {
    return false;
  }

  const escapedCountryName = escapeRegExp(country.name);

  const surnamePattern = new RegExp(`\\b[A-Z][a-z]+\\s+${escapedCountryName}\\b`);

  const match = summary.match(surnamePattern);

  if (!match) {
    return false;
  }

  const precedingWord = match[0].split(/\s+/)[0]?.toLowerCase();

  // Avoid treating geographic names such as "South Sudan" as surnames.
  const geographicPrefixes = new Set(['north', 'south', 'east', 'west', 'new']);

  return !geographicPrefixes.has(precedingWord);
}

/**
 * Whether an article's title or summary mentions a given city, as a
 * whole phrase (case-insensitive, punctuation-tolerant).
 *
 * This is deliberately a separate boolean signal rather than folded
 * into scoreCountryRelevance's own 0-100 additive scale: that scale
 * already saturates at 100 from country-name/context-term matches
 * alone, so adding more points to the same capped scale would let
 * city-relevant and merely country-relevant articles tie at the
 * ceiling and defeat city-first ranking. Callers should treat this as
 * a higher-priority sort key layered on top of the existing country
 * relevance score, not as a replacement for it.
 */
export function articleMentionsCity(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  city: string,
): boolean {
  const title = article.title ?? '';
  const summary = article.summary ?? '';
  const fullText = `${title} ${summary}`;

  return containsWholePhrase(fullText, city);
}

/**
 * Milestone #50 Phase C — `language` is new and optional. Every
 * existing caller that never passes it (none currently do, outside
 * CountryNewsService's own new call site) behaves byte-for-byte as
 * before — only the canonical English name/ISO codes/demonyms are
 * evaluated. When present and not 'en' (English text always already
 * matches the canonical name directly), the corresponding localized
 * country name is resolved via getLocalizedCountryName() and checked
 * as an ADDITIONAL signal in both the title and summary checks —
 * never replacing the canonical-name check, so English mentions of
 * "Poland" continue to be recognized even while Polish retrieval is
 * active (canonical-name compatibility is preserved unconditionally).
 */
export function scoreCountryRelevance(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  country: CountryMeta,
  language?: LanguageCode,
): CountryRelevanceResult {
  const title = article.title ?? '';
  const summary = article.summary ?? '';
  const fullText = `${title} ${summary}`;

  const preparedTitle = prepareText(title);
  const preparedSummary = prepareText(summary);
  const preparedFullText = prepareText(fullText);

  const localizedName =
    language && language !== 'en' ? getLocalizedCountryName(country.iso2, language) : undefined;

  let score = 0;
  const reasons: string[] = [];

  /*
    G2 CORRECTION A — A CURATED CITY IS THE SAME KIND OF EVIDENCE AS THE NAME.

    'Kyiv says talks resume' names Ukraine exactly as surely as 'Ukraine says'
    does, and the repository already holds the mapping. So a curated-city hit
    is OR-ed into the SAME two signals at the SAME weights (+60 title, +30
    summary) rather than becoming a third signal on a new scale.

    NO THRESHOLD MOVES. isRelevant is still >= 35 and no weight changed, so an
    article this correction does not reach scores exactly what it scored before
    and still resolves to nothing. Location unresolved is preserved wherever the
    evidence genuinely is not there.
  */
  /*
    G1 — THE COLLISION IS JUDGED OVER THE WHOLE ARTICLE, NOT PER FIELD.

    Measured, and it is why the first attempt at this repair did not work: the
    confirmed article carries "Niger State" only in its SUMMARY, while its
    TITLE reads "...Bandits In Niger". A per-field check suppressed the summary
    and left the title's bare "Niger" scoring 60, so the article still resolved
    to the sovereign country. Once a text has established that "Niger" here
    means the Nigerian state, every other bare occurrence in that same text
    means it too.

    THE NAME IS SUPPRESSED. THE CURATED CITY AND THE DEMONYM ARE NOT. An
    article that says "Niger State" and also says "Niamey" is contradicting
    itself, and a real capital or a real demonym is independent evidence this
    guard has no business discarding.
  */
  const nameSuppressedByCollision = isOverriddenBySubnationalCollision(preparedFullText, country);

  const titleHasCountryReference =
    (!nameSuppressedByCollision &&
      containsCountryReference(preparedTitle, country, localizedName)) ||
    containsCuratedCityReference(preparedTitle, title, country) ||
    // G1 — "Niger State" names Nigeria as surely as "Nigeria" does.
    containsSubnationalParentReference(preparedTitle, country);

  const summaryHasCountryReference =
    (!nameSuppressedByCollision &&
      containsCountryReference(preparedSummary, country, localizedName)) ||
    containsCuratedCityReference(preparedSummary, summary, country) ||
    containsSubnationalParentReference(preparedSummary, country);

  /*
    G2 CORRECTION B — PLACE EVIDENCE OUTRANKS DEMONYM EVIDENCE.

    A demonym states nationality or origin. It does not state where an event
    happened: 'Chinese-owned factory opens in Kenya' is a Kenya story, and
    'Ukrainian refugees settle in Poland' is a Poland story. So the demonym is a
    LOWER-weight signal than a country name or a curated city, and it is only
    consulted for a field that carries no place evidence at all.

    45 IN THE TITLE clears the 35 threshold on its own, so 'Ukrainian forces
    repel...' resolves. 25 IN THE SUMMARY does NOT clear it alone, so a passing
    nationality mention needs corroborating country-context terms before it can
    put a marker on a map.

    NO EXISTING WEIGHT MOVES AND THE THRESHOLD DOES NOT MOVE. 60/30 for a place,
    8/12 for ISO codes, up to 20 for context terms, -50 for a surname-only
    mention and isRelevant >= 35 are all exactly what they were. 45 and 25 are
    new weights for a new signal, chosen so that a place always wins the argmax
    against a demonym.
  */
  const titleHasDemonym =
    !titleHasCountryReference && containsDemonymReference(preparedTitle, title, country);

  const summaryHasDemonym =
    !summaryHasCountryReference && containsDemonymReference(preparedSummary, summary, country);

  if (titleHasCountryReference) {
    score += 60;
    reasons.push('country reference appears in title');
  } else if (titleHasDemonym) {
    score += 45;
    reasons.push('demonym appears in title');
  }

  if (summaryHasCountryReference) {
    score += 30;
    reasons.push('country reference appears in summary');
  } else if (summaryHasDemonym) {
    score += 25;
    reasons.push('demonym appears in summary');
  }

  /*
    G2 CORRECTION B — AN ISO CODE ONLY COUNTS WHEN IT IS WRITTEN AS A CODE.

    PRE-EXISTING DEFECT, FIXED. normalize() lowercases before matching, so these
    two checks were awarding points for ordinary English words. Measured against
    the sentence 'The board can and are expected to meet ... it is so, per the
    notes':

        can -> CAN +12    and -> AND +12    are -> ARE +12    per -> PER +12
        it  -> ITA  +8    is  -> ISL  +8    so  -> SOM  +8    to  -> TON  +8

    Eight countries scoring on function words. Alone it never cleared 35, which
    is why it stayed invisible — but it decided ARGMAX. It is exactly what made
    'Indian students face new Canadian visa rules' resolve to India: the word
    'in' in the summary handed IND a +8 that broke a tie which should have been
    a tie, and CTO decision requires that headline to be UNRESOLVED.

    NEITHER WEIGHT CHANGES. +8 and +12 are exactly what they were, and the
    threshold is untouched. What changes is WHEN the signal fires: a country
    code is an uppercase token ('USA and GBR sign accord'), never a preposition.
    This is the same principle as the demonym capitalisation guard, applied to
    codes, and it is checked against the raw text for the same reason.
  */
  if (containsIsoCode(fullText, country.iso2)) {
    score += 8;
    reasons.push('ISO2 code appears');
  }

  if (containsIsoCode(fullText, country.iso3)) {
    score += 12;
    reasons.push('ISO3 code appears');
  }

  /*
    G2 — the subdivision qualifier inside a collision phrase does not count as
    context for the country it collides with. For every other country, and for
    every other occurrence of 'state' or 'province', this is preparedFullText
    unchanged.
  */
  const preparedContextText = textForContextTerms(preparedFullText, country);

  const contextMatches = COUNTRY_CONTEXT_TERMS.filter((term) =>
    preparedContainsPhrase(preparedContextText, term),
  ).length;

  if (contextMatches > 0) {
    const contextScore = Math.min(contextMatches * 5, 20);
    score += contextScore;
    reasons.push(`${contextMatches} country-context term(s) found`);
  }

  if (isLikelySurnameOnlyMention(preparedTitle, preparedSummary, summary, country, localizedName)) {
    score -= 50;
    reasons.push('likely surname-only mention');
  }

  const finalScore = Math.max(0, Math.min(100, score));

  return {
    score: finalScore,
    isRelevant: finalScore >= 35,
    reasons,
  };
}

/**
 * M66.14B — the article's single canonical country, or undefined.
 *
 * NOT A SECOND ALGORITHM. An argmax over the existing scoreCountryRelevance(),
 * which country-news.service.ts and analysis.service.ts already trust. Every
 * rule about demonyms, aliases, localized names, context terms, person context
 * and surname-only mentions lives there and is unchanged; this adds no rule and
 * cannot make an article relevant to a country the scorer rejected.
 *
 * WHY undefined RATHER THAN A BEST GUESS. The 35-point isRelevant threshold is
 * the scorer's own statement that below it there is no evidence of a country,
 * and an article about cryptocurrency markets genuinely has no country.
 * Returning the least-bad candidate would put a marker on a map for an article
 * that never mentioned anywhere. Absence is the honest answer.
 *
 * TIE-BREAKING is deterministic: on an exact score tie the earlier entry in
 * COUNTRIES wins, because the comparison is strict `>`. COUNTRIES is a fixed
 * literal array, so the same article always resolves the same way — but a tie's
 * winner reflects declaration order, not a judgement that one country is more
 * relevant.
 *
 * `language` is forwarded verbatim, where it only ever ADDS the localized
 * country name as an extra positive signal and never replaces the canonical
 * English one. That is what lets a Polish interface resolve an English article,
 * and it is asserted in this file's spec.
 */
/**
 * G-ALPHA-2 — DEMONYM RESOLUTION FOR QUERY ROUTING.
 *
 * WHY THIS EXISTS. The routing layer could not resolve a demonym at all:
 * measured on the accepted Alpha, "Ukrainian", "Russian", "Kenyan", "Rwandan"
 * and "Polish" all resolved to NOTHING, while the twelve matching country names
 * resolved 12/12. That is why a question about "the Ukrainian and Russian
 * conflicts" detected no geography and fell through to a generic news search.
 *
 * IT REUSES THE TABLE ABOVE RATHER THAN INTRODUCING A SECOND ONE. COUNTRY_DEMONYMS
 * is already curated, already tier-annotated, already carries its deliberate
 * absences ('american', 'korean', 'congolese', 'guinean', 'dominican',
 * 'georgian', 'english'), and NON_LOCATIVE_COMPOUNDS already knows that a french
 * fry is not France. A second table for routing would be a second place for all
 * of that judgement to drift.
 *
 * IT RETURNS A LIST, NOT A WINNER, AND THAT IS THE POINT. "the Ukrainian and
 * Russian conflicts" yields TWO countries. Collapsing that to one would be an
 * invention; the caller is expected to treat two or more as a multi-entity
 * question, not as a single-country feed.
 *
 * FAIL-CLOSED IN BOTH DIRECTIONS. A demonym occurring only inside a
 * non-locative compound is not counted, and an unrecognised word yields
 * nothing. This function can only ever ADD a country the curated table already
 * vouched for; it never guesses one.
 */
export function resolveCountriesByDemonym(text: string): CountryMeta[] {
  const prepared = prepareText(text);
  const found: Array<{ country: CountryMeta; at: number }> = [];

  for (const [iso3, demonyms] of Object.entries(COUNTRY_DEMONYMS)) {
    if (!demonyms) continue;

    /*
     * THE ORDER IS THE SENTENCE'S, NOT THE TABLE'S.
     *
     * Iterating COUNTRY_DEMONYMS yields countries in table order, so
     * "Kenyan, Rwandan and Ugandan trade" came back Kenya, Uganda, Rwanda —
     * a list the user never wrote. That matters downstream: these become the
     * SIDES of a comparison, and the CTO's requirement is that a comparison
     * follows the question. Each country therefore records the position of
     * its earliest matching demonym, and the result is sorted by it.
     */
    let earliest = -1;

    for (const demonym of demonyms) {
      if (occursOnlyInNonLocativeCompound(prepared, demonym)) continue;

      const at = indexOfPreparedPhrase(prepared, demonym);

      if (at >= 0 && (earliest < 0 || at < earliest)) {
        earliest = at;
      }
    }

    if (earliest < 0) continue;

    const country = COUNTRIES.find((candidate) => candidate.iso3 === iso3);

    if (country && !found.some((existing) => existing.country.iso3 === country.iso3)) {
      found.push({ country, at: earliest });
    }
  }

  return found.sort((a, b) => a.at - b.at).map((entry) => entry.country);
}

/**
 * Position of a whole-word phrase inside prepared text, or -1. Uses the exact
 * space-delimited containment rule preparedContainsPhrase() uses, so a phrase
 * this reports as present is a phrase that function also reports as present —
 * there is one matching rule here, not two.
 */
function indexOfPreparedPhrase(preparedText: string, phrase: string): number {
  const normalizedPhrase = normalize(phrase);

  return normalizedPhrase.length > 0 ? preparedText.indexOf(` ${normalizedPhrase} `) : -1;
}

/**
 * True when every occurrence of the demonym in this text sits inside a phrase
 * that names a thing rather than a place. Mirrors the rule scoreCountryRelevance
 * already applies; kept as a helper so the two cannot diverge.
 */
function occursOnlyInNonLocativeCompound(preparedText: string, demonym: string): boolean {
  const compounds = NON_LOCATIVE_COMPOUNDS[normalize(demonym)];

  if (!compounds || compounds.length === 0) {
    return false;
  }

  let remaining = preparedText;

  for (const compound of compounds) {
    const normalizedCompound = normalize(compound);
    if (normalizedCompound.length === 0) continue;
    remaining = remaining.split(` ${normalizedCompound} `).join(' ');
  }

  return !preparedContainsPhrase(remaining, demonym);
}

export interface PrimaryCountryResult {
  /** ISO 3166-1 alpha-2, matching CountryMeta.iso2. */
  countryCode: string;
  /** Canonical English name, matching CountryMeta.name. */
  countryName: string;
  /** The winning score, for logging and tests. */
  score: number;
}

/**
 * G-SEARCH-COUNTRY-DEVELOPMENT-SALIENCE-1 — NARROW READ-ONLY EXPOSURE.
 *
 * country-development-eligibility.util.ts needs exactly two things this file
 * already owns: the curated demonym table and this file's own normalization.
 * They are exposed rather than copied so there is ONE demonym table and ONE
 * normalizer in the repository. Nothing here is new and nothing is changed --
 * both are the existing private values, re-exported under names that say what
 * a reader outside this file is allowed to assume about them.
 *
 * The table is exposed AS READONLY. A second module must be able to read the
 * curated judgement, including its deliberate omissions, and must never be
 * able to extend it -- an added demonym would silently change country
 * relevance scoring for every article in the system.
 */
export const COUNTRY_DEMONYMS_BY_ISO3: Readonly<Partial<Record<string, readonly string[]>>> =
  COUNTRY_DEMONYMS;

/** This file's own normalization, so callers cannot drift from it. */
export function normalizeForCountryMatch(value: string): string {
  return normalize(value);
}

export function resolvePrimaryCountry(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  language?: LanguageCode,
): PrimaryCountryResult | undefined {
  /*
    G2 CORRECTION B — A TIE IS NOT AN ANSWER. FAIL CLOSED.

    This used to keep the first country to reach the top score, which meant the
    winner of a tie was decided by the order COUNTRIES happens to be declared
    in. DECLARATION ORDER MUST NEVER DETERMINE GEOGRAPHIC TRUTH: it is not a
    judgement about the article, and the reader is shown a country and a map
    marker as if it were.

    So the result is the UNIQUE maximum or nothing. 'Indian students face new
    Canadian visa rules' carries equal evidence for two countries and now
    resolves to no country at all, which is what Location unresolved is for.

    THIS ALSO CHANGES PLACE-VS-PLACE TIES, deliberately. 'Russia and India
    expand energy cooperation' names two countries in the title with identical
    evidence; picking Russia because RUS is declared before IND was never a
    finding about the article. The rule admits no exception, because any
    exception is declaration order deciding again.
  */
  let best: PrimaryCountryResult | undefined;
  let tied = false;

  for (const country of COUNTRIES) {
    const relevance = scoreCountryRelevance(article, country, language);

    if (!relevance.isRelevant) {
      continue;
    }

    if (best === undefined || relevance.score > best.score) {
      best = {
        countryCode: country.iso2,
        countryName: country.name,
        score: relevance.score,
      };
      tied = false;
      continue;
    }

    if (relevance.score === best.score) {
      tied = true;
    }
  }

  return tied ? undefined : best;
}
