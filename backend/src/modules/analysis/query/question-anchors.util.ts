import {
  COUNTRIES,
  COUNTRY_ALIASES_BY_ISO3,
  EAST_AFRICA_MEMBERS,
  EU27_MEMBERS,
  MIDDLE_EAST_MEMBERS,
  findCountryByIso3,
} from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK RELIABILITY R1 — QUESTION ANCHORS: WHO AND WHAT THE READER ACTUALLY ASKED ABOUT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Observed failures (Alpha/Production, 2026-10-05): "Rwanda … Congo conflict" was answered with
 * Rwandan condom-price and savings stories; "oil prices in Rwanda" with 16 Rwanda reports none of
 * which mentioned a price; "Iranian–US war … East African region" with US deportations to Burundi.
 * Retrieval kept ONE country and dropped the relationship and the topic, and nothing checked the
 * final evidence against the question.
 *
 * This module reads the ORIGINAL question deterministically (no AI, no provider) into:
 *   · actors — every named country (names, governed aliases, demonyms) and named region
 *     (East Africa / Middle East / Europe-EU) as alias groups;
 *   · topics — salient subject families (fuel prices, armed conflict, inflation, trade, …);
 *   · relation — whether the actors are LINKED (between / relation to / X–Y war / affecting Y),
 *     so every actor must be present in one report, or a SET (compare X and Y), so one is enough.
 * and gives one admission rule for a retrieved report. It never invents an anchor: a question with
 * no recognised topic and a single place is not gated (the country feed is the answer to it).
 */
export interface AnchorGroup {
  readonly key: string;
  readonly label: string;
  readonly terms: readonly string[];
  /** Topic groups only: the plain search phrase for an anchored retrieval. */
  readonly query?: string;
}

export interface QuestionAnchors {
  readonly actors: readonly AnchorGroup[];
  readonly topics: readonly AnchorGroup[];
  readonly relation: 'LINKED' | 'SET' | 'NONE';
  /** True when the gate should be applied (see `gateApplies`). */
  readonly gated: boolean;
}

const DEMONYMS: Readonly<Record<string, string>> = {
  rwandan: 'RWA', rwandans: 'RWA', tanzanian: 'TZA', tanzanians: 'TZA', kenyan: 'KEN', kenyans: 'KEN',
  ugandan: 'UGA', ugandans: 'UGA', burundian: 'BDI', burundians: 'BDI', congolese: 'COD', ethiopian: 'ETH',
  ethiopians: 'ETH', somali: 'SOM', somalian: 'SOM', sudanese: 'SDN', 'south sudanese': 'SSD', eritrean: 'ERI',
  djiboutian: 'DJI', iranian: 'IRN', iranians: 'IRN', persian: 'IRN', israeli: 'ISR', israelis: 'ISR',
  palestinian: 'PSE', palestinians: 'PSE', lebanese: 'LBN', syrian: 'SYR', iraqi: 'IRQ', saudi: 'SAU',
  yemeni: 'YEM', emirati: 'ARE', qatari: 'QAT', turkish: 'TUR', egyptian: 'EGY', jordanian: 'JOR',
  russian: 'RUS', russians: 'RUS', ukrainian: 'UKR', ukrainians: 'UKR', american: 'USA', americans: 'USA',
  chinese: 'CHN', indian: 'IND', british: 'GBR', french: 'FRA', german: 'DEU', polish: 'POL', nigerian: 'NGA',
  'south african': 'ZAF', ghanaian: 'GHA', mozambican: 'MOZ', zambian: 'ZMB', malawian: 'MWI',
  america: 'USA', kinshasa: 'COD', goma: 'COD', kigali: 'RWA', nairobi: 'KEN', kampala: 'UGA',
  'dar es salaam': 'TZA', dodoma: 'TZA', 'addis ababa': 'ETH', mogadishu: 'SOM', juba: 'SSD', tehran: 'IRN',
  kyiv: 'UKR', moscow: 'RUS', washington: 'USA', 'tel aviv': 'ISR', gaza: 'PSE',
};

/** Extra article-side spellings per country (what a report about it is likely to contain). */
const EXTRA_TERMS: Readonly<Record<string, readonly string[]>> = {
  COD: ['congo', 'drc', 'dr congo', 'democratic republic of the congo', 'congolese', 'kinshasa', 'goma', 'm23', 'kivu'],
  USA: ['united states', 'u.s.', 'us', 'usa', 'america', 'american', 'washington', 'trump', 'white house', 'pentagon'],
  IRN: ['iran', 'iranian', 'tehran', 'islamic republic'],
  RUS: ['russia', 'russian', 'moscow', 'kremlin', 'putin'],
  UKR: ['ukraine', 'ukrainian', 'kyiv', 'zelensky', 'zelenskyy'],
  GBR: ['united kingdom', 'uk', 'britain', 'british'],
  ARE: ['uae', 'united arab emirates', 'emirati', 'dubai', 'abu dhabi'],
};

const REGIONS: ReadonlyArray<{ key: string; label: string; cues: readonly string[]; members: readonly string[] }> = [
  { key: 'region:east-africa', label: 'East Africa', cues: ['east africa', 'east african', 'eastern africa', 'east african region', 'eac', 'east african community'], members: EAST_AFRICA_MEMBERS },
  { key: 'region:middle-east', label: 'Middle East', cues: ['middle east', 'middle eastern', 'gulf region', 'mideast'], members: MIDDLE_EAST_MEMBERS },
  { key: 'region:european-union', label: 'Europe', cues: ['european union', 'europe', 'european', 'eu'], members: EU27_MEMBERS },
];

/** Topic families: a cue in the QUESTION activates the family; any of its terms admits a report. */
const TOPICS: ReadonlyArray<{ key: string; label: string; query: string; cues: RegExp; terms: readonly string[] }> = [
  {
    key: 'fuel-prices',
    label: 'fuel / oil prices',
    query: 'fuel prices',
    cues: /\b(oil|fuel|petrol|gasoline|diesel|kerosene|crude)\b/,
    terms: ['oil price', 'oil prices', 'fuel price', 'fuel prices', 'pump price', 'pump prices', 'petrol', 'diesel', 'kerosene', 'gasoline', 'crude', 'brent', 'opec', 'fuel', 'epra', 'rura', 'ewura', 'energy regulator'],
  },
  {
    key: 'armed-conflict',
    label: 'armed conflict',
    query: 'conflict',
    cues: /\b(conflict|conflicts|war|wars|fighting|clash|clashes|ceasefire|cease-fire|truce|rebels?|militias?|insurgen\w*|peace talks|peace deal|offensive|invasion|airstrikes?|military)\b/,
    terms: ['conflict', 'war', 'fighting', 'clash', 'clashes', 'ceasefire', 'truce', 'rebel', 'rebels', 'militia', 'm23', 'troops', 'army', 'military', 'peace', 'offensive', 'attack', 'attacks', 'airstrike', 'airstrikes', 'missile', 'missiles', 'strike', 'strikes', 'insurgent', 'insurgents', 'killed', 'displaced', 'refugees', 'sanctions', 'hostilities'],
  },
  {
    key: 'inflation',
    label: 'inflation and prices',
    query: 'inflation',
    cues: /\b(inflation|cpi|consumer prices?|cost of living|price rises?)\b/,
    terms: ['inflation', 'consumer price', 'consumer prices', 'cpi', 'cost of living', 'prices', 'price'],
  },
  {
    key: 'trade',
    label: 'trade',
    query: 'trade',
    cues: /\b(trade|trading|tariffs?|exports?|imports?|customs|cross-border|border trade)\b/,
    terms: ['trade', 'trading', 'tariff', 'tariffs', 'export', 'exports', 'import', 'imports', 'customs', 'border', 'traders', 'cargo', 'shipping'],
  },
  {
    key: 'economy',
    label: 'economy',
    query: 'economy',
    cues: /\b(econom\w*|gdp|growth|central bank|interest rates?|budget|debt|currency|shilling|investment|business(es)?)\b/,
    terms: ['economy', 'economic', 'gdp', 'growth', 'inflation', 'central bank', 'interest rate', 'budget', 'debt', 'currency', 'shilling', 'franc', 'investment', 'investors', 'business', 'businesses', 'tax', 'taxes', 'imf', 'world bank', 'exports', 'imports', 'trade', 'jobs', 'prices', 'revenue', 'bond', 'loan'],
  },
  {
    key: 'elections',
    label: 'elections and politics',
    query: 'election',
    cues: /\b(elections?|vote|voting|ballot|polls?|campaign|parliament|president\w*|opposition)\b/,
    terms: ['election', 'elections', 'vote', 'voting', 'ballot', 'poll', 'polls', 'campaign', 'parliament', 'president', 'opposition', 'candidate', 'electoral'],
  },
];

/** Words that join actors into ONE relationship (every actor must appear in a report). */
const LINKED = /\b(between|in relation to|relation(s|ship)? (with|to|between)|relations with|tensions? with|war (with|against|between)|conflict (with|between)|affect(s|ing|ed)?|impact(s|ing|ed)?( on)?|influence( of| on)?|effects? (of|on)|spill ?over|against)\b|\b[a-z]+\s*[-–—]\s*[a-z]+\s+(war|conflict|tensions?|talks|deal|relations)\b/;

export function normalizeText(value: string): string {
  return ` ${value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    /* possessives: "Kenya's economy" names Kenya */
    .replace(/'s\b/g, '')
    .replace(/[^\p{L}\p{N}.']+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

function hasPhrase(text: string, phrase: string): boolean {
  const p = normalizeText(phrase).trim();
  return p !== '' && text.includes(` ${p} `);
}

function countryGroup(iso3: string): AnchorGroup | null {
  const meta = findCountryByIso3(iso3);
  if (meta === undefined) return null;
  const aliases = Object.entries(COUNTRY_ALIASES_BY_ISO3)
    .filter(([, code]) => code === iso3)
    .map(([alias]) => alias)
    .filter((a) => a.length >= 3 || iso3 === 'USA' || iso3 === 'GBR');
  const demonyms = Object.entries(DEMONYMS)
    .filter(([, code]) => code === iso3)
    .map(([d]) => d);
  return {
    key: iso3,
    label: meta.name,
    terms: [...new Set([meta.name.toLowerCase(), ...aliases, ...demonyms, ...(EXTRA_TERMS[iso3] ?? [])])],
  };
}

/** Countries named in the question, in reading order (names, governed aliases, demonyms, capitals). */
export function countriesNamedIn(question: string): string[] {
  const text = normalizeText(question);
  const found: Array<{ iso3: string; at: number }> = [];
  const consider = (phrase: string, iso3: string): void => {
    const p = normalizeText(phrase).trim();
    if (p.length < 2) return;
    /* Two-letter aliases ("us", "uk") only when written in capitals in the original. */
    if (p.length <= 3 && /^(us|uk)$/.test(p) && !new RegExp(`\\b${p.toUpperCase()}\\b`).test(question)) return;
    const at = text.indexOf(` ${p} `);
    if (at >= 0) found.push({ iso3, at });
  };
  for (const c of COUNTRIES) {
    if (c.status !== undefined) continue;
    consider(c.name, c.iso3);
  }
  for (const [alias, iso3] of Object.entries(COUNTRY_ALIASES_BY_ISO3)) consider(alias, iso3);
  for (const [d, iso3] of Object.entries(DEMONYMS)) consider(d, iso3);
  /* A bare "Congo" in news questions means the DRC (the eastern-Congo conflict) unless Brazzaville is named. */
  if (hasPhrase(text, 'congo') && !hasPhrase(text, 'brazzaville') && !hasPhrase(text, 'republic of the congo')) {
    found.push({ iso3: 'COD', at: text.indexOf(' congo ') });
  }
  /* "Guinea" inside "Papua New Guinea"/"Equatorial Guinea" etc. is handled by longest-first below. */
  found.sort((a, b) => a.at - b.at);
  const out: string[] = [];
  for (const f of found) {
    if (f.iso3 === 'COG' && found.some((g) => g.iso3 === 'COD')) continue;
    if (!out.includes(f.iso3)) out.push(f.iso3);
  }
  return out;
}

export function regionsNamedIn(question: string): string[] {
  const text = normalizeText(question);
  return REGIONS.filter((r) => r.cues.some((cue) => (cue === 'eu' ? /\bEU\b/.test(question) : hasPhrase(text, cue)))).map((r) => r.key);
}

export function questionAnchorsOf(question: string): QuestionAnchors {
  const text = normalizeText(question);
  const actors: AnchorGroup[] = [];
  for (const iso3 of countriesNamedIn(question)) {
    const g = countryGroup(iso3);
    if (g !== null) actors.push(g);
  }
  for (const key of regionsNamedIn(question)) {
    const r = REGIONS.find((x) => x.key === key)!;
    const memberTerms = r.members.flatMap((iso3) => countryGroup(iso3)?.terms ?? []);
    actors.push({ key: r.key, label: r.label, terms: [...new Set([...r.cues.filter((c) => c !== 'eu'), ...memberTerms])] });
  }
  const topics: AnchorGroup[] = TOPICS.filter((t) => t.cues.test(text)).map((t) => ({ key: t.key, label: t.label, terms: t.terms, query: t.query }));
  /* "economy" is implied by inflation/trade questions; keep the most specific family only. */
  const specific = topics.filter((t) => t.key !== 'economy');
  const finalTopics = specific.length > 0 && topics.some((t) => t.key === 'economy') && !/\beconom/.test(text) ? specific : topics;
  const relation: QuestionAnchors['relation'] = actors.length >= 2 ? (LINKED.test(text) ? 'LINKED' : 'SET') : 'NONE';
  const gated = (actors.length >= 1 && finalTopics.length >= 1) || relation === 'LINKED';
  return { actors, topics: finalTopics, relation, gated };
}

export interface AnchorVerdict {
  readonly admitted: boolean;
  readonly missing: readonly string[];
}

/**
 * One report against the question. LINKED: every actor must be present (the relationship itself);
 * SET: at least one actor; every active topic family must be present. Ungated questions admit all.
 */
export function admitsReport(anchors: QuestionAnchors, report: { title: string; summary?: string | null }): AnchorVerdict {
  if (!anchors.gated) return { admitted: true, missing: [] };
  const text = normalizeText(`${report.title} ${report.summary ?? ''}`);
  const has = (g: AnchorGroup): boolean => g.terms.some((t) => hasPhrase(text, t));
  const missing: string[] = [];
  if (anchors.relation === 'LINKED') {
    for (const a of anchors.actors) if (!has(a)) missing.push(a.label);
  } else if (anchors.actors.length > 0 && !anchors.actors.some(has)) {
    missing.push(anchors.actors.map((a) => a.label).join(' / '));
  }
  for (const t of anchors.topics) if (!has(t)) missing.push(t.label);
  return { admitted: missing.length === 0, missing };
}

/** A stable short key for caches and diagnostics. */
export function anchorsKey(anchors: QuestionAnchors): string {
  if (!anchors.gated) return '';
  return `${anchors.relation}:${anchors.actors.map((a) => a.key).join('+')}:${anchors.topics.map((t) => t.key).join('+')}`;
}

/**
 * Bounded anchored search phrases (at most two) for when the ordinary retrieval kept a single
 * country and dropped the relationship or topic: LINKED → all actors + topic in one query
 * ("Rwanda DR Congo conflict"); SET → one query per actor with the topic ("Russia conflict").
 */
export function anchoredQueries(anchors: QuestionAnchors): string[] {
  if (!anchors.gated) return [];
  const topic = anchors.topics.map((t) => t.query ?? t.label).slice(0, 2).join(' ');
  if (anchors.relation === 'LINKED' || anchors.actors.length <= 1) {
    return [[...anchors.actors.map((a) => a.label), topic].filter((part) => part !== '').join(' ')];
  }
  return anchors.actors.slice(0, 2).map((a) => [a.label, topic].filter((part) => part !== '').join(' '));
}

const SUBJECT_STOP = new Set([
  'what', 'which', 'when', 'where', 'whose', 'there', 'their', 'about', 'please', 'could', 'would', 'should',
  'tell', 'show', 'give', 'indicate', 'explain', 'describe', 'today', 'tonight', 'right', 'currently', 'latest',
  'happening', 'going', 'doing', 'with', 'from', 'that', 'this', 'these', 'those', 'have', 'does', 'into', 'more',
]);

/**
 * ASK RELIABILITY R1 (E) — does an EARLIER sentence of this same message name a subject, so a later
 * "How is it?" refers to it rather than to a previous turn? Named actors / topic families count, and
 * so does any earlier sentence with two or more content words.
 */
export function sameMessageSubject(question: string): boolean {
  const sentences = question
    .split(/(?<=[.?!;])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  if (sentences.length < 2) return false;
  const earlier = sentences.slice(0, -1).join(' ');
  const anchors = questionAnchorsOf(earlier);
  if (anchors.actors.length > 0 || anchors.topics.length > 0) return true;
  const content = normalizeText(earlier)
    .trim()
    .split(' ')
    .filter((w) => w.length >= 4 && !SUBJECT_STOP.has(w));
  return content.length >= 2;
}

/**
 * ASK RELIABILITY R1 (B) — does a MIXED turn's explanatory clause depend on the rest of the
 * message? It does when the message names a place/region the clause does not ("Kenya's economy …
 * Explain the three most important changes"), or when the clause refers back ("the three most
 * important changes", "it", "these"). A self-contained clause ("Explain how a central bank sets
 * interest rates") is answered alone, exactly as before.
 */
export function stableClauseNeedsMessage(stableClause: string, message: string): boolean {
  if (stableClause.trim() === message.trim()) return false;
  const inClause = new Set(questionAnchorsOf(stableClause).actors.map((a) => a.key));
  const missingPlace = questionAnchorsOf(message).actors.some((a) => !inClause.has(a.key));
  const refersBack =
    /\b(?:it|its|they|them|their|these|those|this|that)\b/i.test(stableClause) ||
    /\bthe\s+(?:two|three|four|five|main|most|key|biggest|largest)\b/i.test(stableClause);
  return missingPlace || refersBack;
}
