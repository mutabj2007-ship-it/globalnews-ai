import type { NewsCategory } from '@globalnews-ai/shared';
import { COUNTRIES, COUNTRY_ALIASES_BY_ISO3, getCuratedCityNames } from '@globalnews-ai/shared';
import { COUNTRY_DEMONYMS_BY_ISO3, demonymForms } from '../news/country/country-relevance.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME EDITORIAL ELIGIBILITY: BUSINESS AND CONFLICT ONLY, AT SUBJECT LEVEL
 * (PHONE-FIRST HOME CORRECTION R1 §5 · HOME DATA TRUTH CORRECTION R1 B1)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Applied on the server BEFORE a story can reach any visible Home surface (hero, region rows,
 * default story search). Deterministic, explainable, no AI, no provider call.
 *
 *   1. HARD EXCLUSION. Provider category sports/entertainment, or a sport / celebrity / gaming /
 *      lifestyle signal in the headline, rejects the story outright.
 *   2. SUBJECT ZONE. Evidence is read from the HEADLINE and the summary's LEAD SENTENCE only: a
 *      long publisher text mentions many incidental things ("electricity goes off" in a story
 *      about smuggled alcohol) that are not what the story is about.
 *   3. EVIDENCE FAMILIES, NOT WORDS. Evidence is a governed PHRASE FAMILY ("crude oil", "levies on
 *      imported sugar", "fighters seize town", "war in <country>"), never an isolated common word.
 *      Common / ambiguous single words (bank, port, stock, jobs, shipping, electricity, crude,
 *      war, conflict, offensive, occupation, invasion, market …) are in NO family on their own.
 *   4. ADMISSION, per domain: a STRONG family in the headline; or two DISTINCT families in the
 *      subject zone with at least one in the headline; or a STRONG family in the lead sentence
 *      corroborated by a second distinct family. Business and conflict are judged separately:
 *      "trade war" is trade evidence, never armed-conflict evidence.
 *   5. The admitting families ARE the reason ("why this is on Home"); nothing is invented.
 */
export type HomeDomain = 'business' | 'conflict';

export interface HomeEligibilityInput {
  readonly title: string;
  readonly summary?: string | null;
  readonly category: NewsCategory | string;
}

export type HomeEligibility =
  | {
      readonly eligible: true;
      readonly domains: readonly HomeDomain[];
      readonly primary: HomeDomain;
      /** The admitting evidence families, per domain (diagnostic keys, not reader copy). */
      readonly signals: { readonly business: readonly string[]; readonly conflict: readonly string[] };
      readonly strength: number;
    }
  | { readonly eligible: false; readonly reason: HomeRejection; readonly matched?: string };

export type HomeRejection =
  | 'EXCLUDED_CATEGORY'
  | 'SPORT'
  | 'CELEBRITY_ENTERTAINMENT'
  | 'GAMING'
  | 'LIFESTYLE'
  | 'NO_BUSINESS_OR_CONFLICT_EVIDENCE';

const EXCLUDED_CATEGORIES: ReadonlySet<string> = new Set(['sports', 'entertainment']);

const EXCLUSIONS: ReadonlyArray<{ reason: HomeRejection; terms: readonly string[] }> = [
  {
    reason: 'SPORT',
    terms: [
      'football', 'soccer', 'afcon', 'premier league', 'champions league', 'la liga', 'serie a', 'bundesliga',
      'world cup', 'qualifier', 'qualifiers', 'fixture', 'fixtures', 'lineups', 'line ups', 'kick off', 'kickoff',
      'how to watch', 'where to watch', 'live streaming', 'live stream', 'scoreline', 'striker', 'midfielder',
      'goalkeeper', 'hat trick', 'transfer window', 'tournament', 'championship', 'olympic', 'olympics',
      'grand prix', 'formula one', 'formula 1', 'nba', 'nfl', 'fifa', 'uefa', 'cricket', 'tennis', 'rugby',
      'marathon', 'athletics', 'boxing', 'ufc', 'golf', 'derby', 'semi final', 'semifinal', 'quarter final',
      'quarterfinal', 'match report', 'head coach', 'squad', 'cup', 'davis cup',
      'billie jean king cup', 'grand slam', 'wimbledon', 'playoff', 'playoffs', 'medal', 'medals',
      /* B1 — club ownership and sponsorship are sport business, not Home business */
      'fc', 'football club', 'sponsorship', 'kit sponsor',
    ],
  },
  {
    reason: 'CELEBRITY_ENTERTAINMENT',
    terms: [
      'celebrity', 'celebrities', 'actor', 'actress', 'singer', 'rapper', 'album', 'box office', 'hollywood',
      'bollywood', 'nollywood', 'movie', 'film review', 'tv show', 'reality show', 'red carpet', 'netflix series',
      'concert', 'music video', 'grammy', 'oscars', 'oscar', 'emmy', 'gossip', 'dating', 'engaged to',
      'wedding photos', 'influencer', 'kardashian', 'trailer',
    ],
  },
  {
    reason: 'GAMING',
    terms: [
      'video game', 'video games', 'gaming', 'playstation', 'xbox', 'nintendo', 'esports', 'e sports',
      'game release', 'gameplay', 'steam sale', 'fortnite', 'minecraft',
    ],
  },
  {
    reason: 'LIFESTYLE',
    terms: [
      'recipe', 'recipes', 'horoscope', 'zodiac', 'fashion week', 'beauty tips', 'skincare', 'weight loss',
      'workout', 'diet tips', 'travel guide', 'best places to', 'things to do', 'lifestyle', 'wellness tips',
      'dating tips', 'home decor',
    ],
  },
];

/**
 * Phrases whose words would otherwise look like evidence but whose sense is not business or
 * armed conflict. Removed from the subject zone before any family is read.
 */
const NOT_EVIDENCE: readonly RegExp[] = [
  /\bconflicts? of interests?\b/g,
  /\binvasions? of privacy\b/g,
  /\bwar of words\b/g,
  /\btug of war\b/g,
  /\bwar (photographer|photographers|correspondent|correspondents|reporter|veteran|veterans|memorial|museum|hero|movie|film|novel|game|games|chest)s?\b/g,
  /\b(heart|panic|asthma|dog|shark|snake|crocodile|hippo|lion|leopard|elephant|bee) attacks?\b/g,
  /\boffensive (remarks?|comments?|language|content|posts?|tweets?|jokes?|words?|messages?|slurs?|behaviou?r|line|lineman|coordinator)\b/g,
  /\b(culture|cold|price|bidding|talent|turf|console|streaming) wars?\b/g,
  /\bworld wars?( (i|ii|one|two|1|2))?\b/g,
  /\bbank holidays?\b/g,
  /\briver ?banks?\b/g,
  /\bstock(s|ing|ed)? up\b/g,
  /\bfree shipping\b/g,
  /\bsteve jobs\b/g,
  /\bon duty\b/g,
  /\bduty (free|of care)\b/g,
  /\bfighting (corruption|crime|poverty|disease|malaria|hunger|cancer|for)\b/g,
  /* FINAL CORRECTION · R2 — BACKGROUND, NOT THE EVENT: who holds a place, or which war a place serves,
     describes the setting ("fire kills 24 children in rebel-controlled city"; "arrests near a base
     used for the Iran war"), not what happened. */
  /\b(rebel|rebels|militia|militant|militants|jihadist|insurgent|army|military|m23|houthi|taliban) (held|controlled|run|occupied|seized|ruled)( [a-z]+)? (city|cities|town|towns|area|areas|territory|territories|region|regions|zone|zones|east|province|capital)\b/g,
  /\b(used|deployed|stationed|involved|operating)( [a-z0-9]+){0,4} (in|for|during) (the )?([a-z]+ ){0,2}(war|wars|conflict)\b/g,
  /\b(used|deployed|stationed) to (strike|attack|bomb|hit|target)( [a-z]+){0,2}\b/g,
  /\b(war|conflict) (torn|ravaged|hit|scarred|weary|affected|stricken)\b/g,
  /\bin (the )?shadow of( [a-z]+){0,4} (war|wars|conflict)\b/g,
];

interface Family {
  readonly key: string;
  readonly domain: HomeDomain;
  /** STRONG: a governed phrase that states the subject by itself. Otherwise SUPPORT. */
  readonly strong: boolean;
  /** Corroboration only — never counts toward admission (FINAL CORRECTION · R2). */
  readonly corroborating?: true;
  readonly re: RegExp;
}

const W = '(?: [a-z0-9]+)'; // one following word, in normalized text

const FAMILIES: readonly Family[] = [
  /* ── BUSINESS · STRONG ─────────────────────────────────────────────── */
  { key: 'import-duty', domain: 'business', strong: true, re: new RegExp(`\\b(tariffs?|import (duty|duties|levy|levies|tax|taxes|ban|bans)|excise (duty|duties)|customs (duty|duties))\\b|\\b(levy|levies|duty|duties|taxes|tax)${W}{0,4} (imports?|imported|exports?|exported)\\b|\\b(imports?|imported|exports?)${W}{0,4} (levy|levies|duty|duties|tariffs?)\\b`) },
  { key: 'trade-policy', domain: 'business', strong: true, re: /\b(trade (deals?|wars?|talks|agreements?|pacts?|deficit|surplus|disputes?|tensions|barriers|bans?|policy|routes?|corridor|bloc|crackdown|restrictions)|export bans?|free trade|customs union|common market|shipping (routes?|lanes?)|sea lanes?)\b/ },
  { key: 'sanctions-policy', domain: 'business', strong: true, re: new RegExp(`\\b(lift[a-z]*|impos[a-z]*|eas(e|es|ed|ing)|tighten[a-z]*|new|exemptions? from|waivers? (on|from)|relief from)${W}{0,4} sanctions?\\b|\\bsanctions? (relief|bill|package|regime|waivers?|exemptions?)\\b`) },
  { key: 'energy-project', domain: 'business', strong: true, re: /\b(nuclear|hydro|hydroelectric|solar|wind|geothermal|coal|gas fired) (power )?(plants?|stations?|projects?|farms?)\b|\bpower (stations?|projects?)\b/ },
  { key: 'infrastructure-attack', domain: 'business', strong: true, re: new RegExp(`\\b(pipelines?|refiner(y|ies)|oil (facilit(y|ies)|terminals?|fields?)|power (plants?|stations?|grid)|tankers?|cargo ships?|merchant (ships?|vessels?))${W}{0,2} (attack[a-z]*|struck|hit|bombed|sabotag[a-z]*|targeted|seized)\\b|\\battacks? on${W}{0,4} (pipelines?|refiner(y|ies)|oil (facilit(y|ies)|terminals?|fields?)|power (plants?|grid)|tankers?|shipping)\\b`) },
  { key: 'trade-disruption', domain: 'business', strong: true, re: new RegExp(`\\b(disrupt[a-z]*|halt[a-z]*|stall[a-z]*|delay[a-z]*|block[a-z]*|slows?|slowed|slowing|paralys[a-z]*|suspend[a-z]*|choke[a-z]*|reopen[a-z]*|resum[a-z]*|restor[a-z]*)${W}{0,4} (trade|exports?|imports?|cargo|freight|shipments?|shipping|supply chains?|supplies|deliveries)\\b|\\b(trade|exports?|imports?|cargo|freight|shipments?|shipping|supply chains?)${W}{0,3} (disrupt[a-z]*|halt[a-z]*|stall[a-z]*|delay[a-z]*|blocked|stranded|slows?|slowed|suspended)\\b`) },
  { key: 'energy-price', domain: 'business', strong: true, re: /\b(oil|fuel|petrol|diesel|gas|electricity|energy|power|pump) (prices?|tariffs?|costs?|bills?)\b|\bprices? of (oil|fuel|petrol|diesel|gas|electricity|crude)\b/ },
  { key: 'oil-gas', domain: 'business', strong: true, re: /\b(crude oil|brent|wti|opec[a-z]*|oil sales|oil (output|production|exports?|imports?|fields?|wells?|reserves|discovery|discoveries|deal|deals|block|blocks|sector|industry)|refiner(y|ies)|oil refining|lng|gas fields?|oil and gas)\b/ },
  { key: 'power-outage', domain: 'business', strong: true, re: /\b(power (outages?|cuts?|rationing|shortages?|blackouts?)|load shedding|grid (collapse|failure)|nationwide blackouts?)\b/ },
  { key: 'inflation', domain: 'business', strong: true, re: /\b(inflation|deflation|consumer price index|cpi)\b/ },
  { key: 'growth', domain: 'business', strong: true, re: /\b(gdp|recession|economic (growth|slowdown|crisis|recovery|output|contraction)|economy (grew|grows|shrank|shrinks|contracted|contracts|expanded|expands|slowed|slows))\b/ },
  { key: 'rates', domain: 'business', strong: true, re: /\b(central bank|interest rates?|monetary policy|policy rate|benchmark rate|lending rates?|rate (hikes?|cuts?|decision))\b/ },
  { key: 'currency', domain: 'business', strong: true, re: /\b(shillings?|currency|currencies|exchange rates?|forex|foreign exchange|devaluation|dollar shortage)\b/ },
  { key: 'cost-of-living', domain: 'business', strong: true, re: /\b(cost of living|food prices|rising prices|soaring prices|higher prices|price (hikes?|increases?|rises?|controls?|caps?))\b/ },
  { key: 'labour', domain: 'business', strong: true, re: /\b(unemployment|job (cuts|losses)|layoffs?|laid off|minimum wage|wage (increases?|hikes?|talks|deal|bill)|pay (rise|deal|dispute)|workers? strike|strike by [a-z]+ workers)\b/ },
  { key: 'markets', domain: 'business', strong: true, re: /\b(stock (exchange|market)s?|share prices?|credit ratings?|sovereign ratings?|rating (downgrade|upgrade)s?|gold prices?|bond (yields?|market)|eurobonds?|treasury (bills?|bonds?)|securities exchange|ipo|initial public offering)\b/ },
  { key: 'public-finance', domain: 'business', strong: true, re: /\b(budget (deficit|shortfall|cuts?|estimates|speech)|public debt|national debt|debt (relief|restructuring|default|crisis|repayments?|servicing|burden)|imf|world bank|fiscal|finance bill|supplementary budget|tax (revenue|collection|hikes?|increases?|cuts?|reforms?|relief|measures)|revenue authority|tax authority|excise)\b/ },
  { key: 'company-results', domain: 'business', strong: true, re: new RegExp(`\\b(profits?|revenues?|earnings|turnover|sales|net income|losses?)${W}{0,2} (rises?|rose|grows?|grew|growth|jumps?|jumped|falls?|fell|drops?|dropped|surges?|surged|declines?|declined|doubles?|doubled|soars?|soared|slumps?|slumped|climbs?|climbed)\\b|\\b(posts?|reports?|records?|posted|reported|recorded|books?|booked)${W}{0,3} (profits?|loss|losses|revenues?|earnings)\\b`) },
  { key: 'business-disruption', domain: 'business', strong: true, re: new RegExp(`\\b(business(es)? (disruption|closures?|shut[a-z]*)|(shut|shuts|halts?|halted|suspends?|suspended)${W}? (operations|production|output))\\b`) },
  /* ── BUSINESS · SUPPORT (count only as one of two distinct families) ── */
  { key: 'price-move', domain: 'business', strong: false, re: new RegExp(`\\b(prices?|costs?|fares?|rents?)${W}{0,3} (rise|rises|rising|rose|climb[a-z]*|soar[a-z]*|jump[a-z]*|surg[a-z]*|increas[a-z]*|hike[a-z]*|fall|falls|fell|drop[a-z]*|doubl[a-z]*)\\b`) },
  { key: 'staples', domain: 'business', strong: false, re: /\b(maize|flour|unga flour|sugar|wheat|rice|bread|cooking oil|beans|milk|fertili[sz]ers?|coffee|tea exports|cocoa|cotton|cashews?|staples?|foodstuffs?)\b/ },
  { key: 'investment', domain: 'business', strong: false, re: /\b(invest(ment|ments|or|ors|s|ed|ing)?|financing|funding round|fdi|venture capital)\b/ },
  { key: 'trade-flows', domain: 'business', strong: false, re: /\b(exports?|exported|exporters?|imports?|imported|importers?|cargo|shipments?)\b/ },
  { key: 'levy', domain: 'business', strong: false, re: /\b(levy|levies|duty|duties|surcharges?)\b/ },
  { key: 'industry', domain: 'business', strong: false, re: /\b(factor(y|ies)|manufactur[a-z]+|millers?|mills|industrial|industries)\b/ },
  { key: 'mining', domain: 'business', strong: false, re: /\b(mining|miners|minerals|cobalt|copper|coltan|lithium|tungsten|tin ore|gold)\b/ },
  { key: 'infrastructure', domain: 'business', strong: false, re: /\b(infrastructure|railway|sgr|pipelines?|power plants?|dams?|highways?|expressways?)\b/ },
  { key: 'regulation', domain: 'business', strong: false, re: /\b(regulators?|regulation|regulations|antitrust|competition authority|licen[cs]es?)\b/ },
  { key: 'sanctions', domain: 'business', strong: false, re: /\b(sanctions?|embargo(es)?)\b/ },
  { key: 'subsidy', domain: 'business', strong: false, re: /\b(subsid(y|ies|ise|ize|ised|ized))\b/ },
  { key: 'finance', domain: 'business', strong: false, re: /\b(debts?|borrowing|lenders?|bonds|banking sector|microfinance|mobile money|digital payments?|payments? systems?|fintech)\b/ },
  { key: 'economy', domain: 'business', strong: false, re: /\b(economy|economic|economies|economists?)\b/ },
  { key: 'corporate', domain: 'business', strong: false, re: new RegExp(`\\b(profits?|revenues?|earnings|turnover|shareholders?|dividends?|mergers?|acquisitions?|acquires?|acquired|takeover|payroll|market share|(orders?|contracts?|deals?) worth|wins?${W}{0,2} (orders|contracts?|tenders?))\\b`) },
  { key: 'tax-policy', domain: 'business', strong: false, re: /\b(vat|taxman|taxpayers?|taxation)\b/ },
  { key: 'tourism', domain: 'business', strong: false, re: /\b(tourism (revenue|earnings|receipts|sector)|tourist arrivals)\b/ },
  /* ── CONFLICT · STRONG ─────────────────────────────────────────────── */
  { key: 'armed-conflict', domain: 'conflict', strong: true, re: /\b(civil war|armed (conflict|conflicts|groups?|men|clashes|attack|attacks|violence|rebellion)|rebel (alliance|alliances|groups?|forces|held|coalition|movement|offensive|fighters)|naval blockade|military (offensive|occupation|operation|operations|campaign|escalation)|ground (offensive|invasion|assault)|humanitarian corridor|forced displacement|escalation of (violence|fighting|hostilities)|hostilities|civilians killed|cross border (attack|attacks|raid|raids|shelling))\b/ },
  /* named attack types: a charge or plot ABOUT one is legal process, not a conflict development */
  { key: 'terror-attack', domain: 'conflict', strong: true, re: /\b(suicide (bomb|bomber|bombers|bombing)|terror(ist)? (attacks?|plots?)|car bomb|roadside bomb)\b/ },
  /* atrocity crimes are usually NAMED in legal process; under a legal headline they are not a current development */
  { key: 'atrocity-crimes', domain: 'conflict', strong: true, re: /\b(war crimes|crimes against humanity)\b/ },
  { key: 'ceasefire', domain: 'conflict', strong: true, re: /\b(ceasefire|cease fire|truce|peace (talks|deal|agreement|process|accord|negotiations)|armistice|end (the )?war|end to (the )?(war|fighting))\b/ },
  { key: 'air-war', domain: 'conflict', strong: true, re: /\b(air ?strikes?|drone (strike|strikes|attack|attacks)|shelling|bombardment|rocket (fire|attack|attacks)|missile (strike|strikes|attack|attacks|barrage))\b/ },
  { key: 'named-armed-actor', domain: 'conflict', strong: true, re: /\b(al shabaab|al shabab|m23|hamas|hezbollah|houthis?|isis|islamic state|boko haram|janjaweed|rapid support forces|allied democratic forces|wagner group|lra|lord s resistance army)\b/ },
  { key: 'armed-action', domain: 'conflict', strong: true, re: new RegExp(`\\b(fighters|rebels|militants|insurgents|militias?|jihadists|gunmen|guerrillas|troops|paramilitar[a-z]+|bandits)${W}{0,3} (seize[sd]?|seizing|captur[a-z]+|overr[au]n|overrunning|took control|take control|storm[a-z]*|attack[a-z]*|raid[a-z]*|kill[a-z]*|ambush[a-z]*|abduct[a-z]*|shell[a-z]*|advanc[a-z]*|clash[a-z]*|massacr[a-z]*)\\b|\\b(seized|captured|overrun|attacked|raided|stormed|killed|ambushed|abducted) by (fighters|rebels|militants|insurgents|militias?|jihadists|gunmen|armed men|troops)\\b`) },
  /* ── CONFLICT · SUPPORT ────────────────────────────────────────────── */
  { key: 'armed-actors', domain: 'conflict', strong: false, re: /\b(fighters|rebels?|militants?|insurgents?|insurgency|militias?|jihadists?|gunmen|guerrillas?|paramilitar[a-z]+|troops|bandits)\b/ },
  { key: 'displacement', domain: 'conflict', strong: false, re: /\b(displaced|displacement|refugees?|idps?|fled|flee|flees|fleeing|exodus)\b/ },
  { key: 'violence', domain: 'conflict', strong: false, re: /\b(ambush(ed|es)?|massacres?|bombings?|clashes|hostages?|abduct[a-z]*|fighting)\b/ },
  /* FINAL CORRECTION · R2 — CORROBORATION ONLY: casualty and generic attack words describe fires, crime,
     policing and accidents as readily as war. They never count toward admission; they may only add
     weight to a story some other conflict family already admits. */
  { key: 'casualties', domain: 'conflict', strong: false, corroborating: true, re: /\b(killed|dead|deaths|wounded|injured|casualties|death toll|killings|violence)\b/ },
  { key: 'generic-attack', domain: 'conflict', strong: false, corroborating: true, re: /\b(attacks?|attacked|raids?|raided|assault(ed|s)?|shootings?|gunfire|stabbings?)\b/ },
  { key: 'military-ops', domain: 'conflict', strong: false, re: /\b(frontline|front line|siege|blockade|coup|junta|annexation|missiles?|rockets?|mobili[sz]ation|military base|airbase)\b/ },
];

/* ── "<place> war" / "war in <place>" — the war words count only when tied to a named place ─── */
const WAR_WORDS: ReadonlySet<string> = new Set(['war', 'wars', 'conflict', 'conflicts', 'fighting', 'invasion', 'occupation', 'offensive', 'blockade', 'siege']);
/* attack words count only AFTER a named place / demonym ("Russian attack", "Israeli strikes"): "attack
   on X" is too often figurative ("Trump's attack on Canada") */
const PLACE_PREFIXED_ONLY: ReadonlySet<string> = new Set(['attack', 'attacks', 'strikes', 'raid', 'raids', 'incursion', 'incursions']);
const PLACE_PREPOSITIONS: ReadonlySet<string> = new Set(['in', 'on', 'with', 'against', 'between', 'over', 'of', 'across', 'inside']);
const PLACE_FILLERS: ReadonlySet<string> = new Set(['the', 'eastern', 'western', 'northern', 'southern', 'central', 'north', 'south', 'east', 'west']);
const NON_ARMED_BEFORE: ReadonlySet<string> = new Set(['trade', 'tariff', 'price', 'currency', 'culture', 'cold', 'bidding', 'talent', 'turf', 'tug', 'words', 'legal', 'court', 'political', 'boardroom', 'cyber', 'hybrid', 'verbal', 'personal']);

let countryNames: ReadonlySet<string> | null = null;
let placeNames: ReadonlySet<string> | null = null;
function normalizedSet(values: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const v of values) {
    const n = normalize(v).trim();
    /* two-letter identifiers ("us", "uk") are ordinary words in prose; never a place here */
    if (n.length > 2) out.add(n);
  }
  return out;
}
/** Canonical country names, aliases and demonyms (singular and regular plural) — no cities. */
function countries(): ReadonlySet<string> {
  if (countryNames !== null) return countryNames;
  countryNames = normalizedSet([
    ...COUNTRIES.filter((c) => c.status === undefined).map((c) => c.name),
    ...Object.keys(COUNTRY_ALIASES_BY_ISO3),
    ...Object.values(COUNTRY_DEMONYMS_BY_ISO3).flatMap((list) => (list ?? []).flatMap(demonymForms)),
  ]);
  return countryNames;
}
/** Countries plus the canonical curated cities. */
function places(): ReadonlySet<string> {
  if (placeNames !== null) return placeNames;
  placeNames = new Set([...countries(), ...normalizedSet(getCuratedCityNames())]);
  return placeNames;
}

function namesPlaceAt(tokens: readonly string[], from: number, step: 1 | -1, set: ReadonlySet<string> = places()): boolean {
  let i = from;
  while (i >= 0 && i < tokens.length && PLACE_FILLERS.has(tokens[i]) && step === 1) i += step;
  for (let len = 1; len <= 3; len++) {
    const start = step === 1 ? i : i - len + 1;
    const end = step === 1 ? i + len : i + 1;
    if (start < 0 || end > tokens.length) break;
    if (set.has(tokens.slice(start, end).join(' '))) return true;
  }
  return false;
}

/**
 * Whether a text names ANY country (canonical names, aliases, demonyms, curated cities; "US",
 * "UK", "UAE" only when written in capitals). Used by Home geography (B3) to tell a headline that
 * locates the story elsewhere from one that names no place at all.
 */
export function namesAnyCountry(raw: string): boolean {
  if (/\b(US|U\.S\.|UK|U\.K\.|UAE)\b/.test(raw)) return true;
  const tokens = normalize(raw).trim().split(' ');
  const set = places();
  for (let i = 0; i < tokens.length; i++) {
    for (let len = 1; len <= 3 && i + len <= tokens.length; len++) {
      if (set.has(tokens.slice(i, i + len).join(' '))) return true;
    }
  }
  return false;
}

/** the token before i, skipping a possessive "s" ("Israel s war") */
function before(tokens: readonly string[], i: number): number {
  return tokens[i - 1] === 's' ? i - 2 : i - 1;
}

function placeWar(text: string): boolean {
  const tokens = text.trim().split(' ');
  for (let i = 0; i < tokens.length; i++) {
    if (PLACE_PREFIXED_ONLY.has(tokens[i])) {
      /* FINAL CORRECTION · R2 — only a COUNTRY or demonym ("Russian attack"); a city never makes a
         generic attack or raid ("Mombasa raid") armed conflict */
      if (i > 0 && namesPlaceAt(tokens, before(tokens, i), -1, countries())) return true;
      continue;
    }
    if (!WAR_WORDS.has(tokens[i])) continue;
    if (i > 0 && NON_ARMED_BEFORE.has(tokens[i - 1])) continue;
    if (i > 0 && namesPlaceAt(tokens, before(tokens, i), -1)) return true;
    if (i + 2 < tokens.length + 1 && PLACE_PREPOSITIONS.has(tokens[i + 1] ?? '') && namesPlaceAt(tokens, i + 2, 1)) return true;
  }
  return false;
}

const MONEY = /(?:[$£€₹]\s?\d|\b\d[\d,.]*\s?(?:bn|billion|million|trillion|mn|crore|lakh)\b|\b(?:usd|kes|ksh|tzs|ugx|rwf|frw|etb|eur|gbp|sh)\s?\d)/i;

function normalize(value: string): string {
  return ` ${value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

function stripNotEvidence(text: string): string {
  let t = text;
  for (const re of NOT_EVIDENCE) t = t.replace(re, ' ');
  return t.replace(/\s+/g, ' ');
}

function matches(text: string, terms: readonly string[]): string[] {
  const found: string[] = [];
  for (const term of terms) {
    const t = normalize(term).trim();
    if (t !== '' && text.includes(` ${t} `)) found.push(term);
  }
  return found;
}

/** The summary's lead sentence (≤ 45 words): what the story is about, before incidental detail. */
export function leadSentence(summary: string | null | undefined): string {
  const s = (summary ?? '').trim();
  if (s === '') return '';
  /* a sentence ends after two lowercase letters/digits/closing marks — never inside "U.S." or "Mr." */
  const first = s.split(/(?<=[\p{Ll}\p{N}”’"')\]]{2}[.!?])\s+(?=["“'‘(\p{Lu}\p{N}])/u)[0] ?? s;
  return first.split(/\s+/).slice(0, 45).join(' ');
}

interface ZoneFamilies {
  readonly title: ReadonlySet<string>;
  readonly lead: ReadonlySet<string>;
}

function familiesIn(rawText: string, domain: HomeDomain): Set<string> {
  const text = stripNotEvidence(normalize(rawText));
  const out = new Set<string>();
  for (const f of FAMILIES) if (f.domain === domain && f.re.test(text)) out.add(f.key);
  if (domain === 'conflict' && placeWar(text)) out.add('place-war');
  if (domain === 'business' && MONEY.test(rawText)) out.add('money');
  return out;
}

const LEGAL_PROCESS = /\b(accused|accuses|suspects?|suspected|plot|plots|plotting|plotted|arrest(s|ed|ing)?|charged|charges|charging|jailed|jails|sentenced|sentences|trial|trials|tried|prosecut[a-z]*|court|courts|indicted|indictment|convicted|conviction|extradit[a-z]*|acquitted|lawsuit|sued|tribunal|custody|detained)\b/;
const LEGAL_BACKGROUND_KEYS: readonly string[] = ['place-war', 'atrocity-crimes', 'terror-attack'];

const STRONG_KEYS: ReadonlySet<string> = new Set([...FAMILIES.filter((f) => f.strong).map((f) => f.key), 'place-war']);

const CORROBORATING_KEYS: ReadonlySet<string> = new Set(FAMILIES.filter((f) => f.corroborating).map((f) => f.key));

function admits(z: ZoneFamilies): { ok: boolean; families: string[] } {
  const counts = (k: string): boolean => !CORROBORATING_KEYS.has(k);
  const all = [...new Set([...z.title, ...z.lead])].filter(counts);
  const titleCounted = [...z.title].filter(counts);
  const titleStrong = titleCounted.some((k) => STRONG_KEYS.has(k));
  const leadStrong = [...z.lead].some((k) => STRONG_KEYS.has(k));
  const ok = titleStrong || (all.length >= 2 && titleCounted.length >= 1) || (leadStrong && all.length >= 2);
  /* strong families first: they are the stated reason */
  return { ok, families: all.sort((a, b) => Number(STRONG_KEYS.has(b)) - Number(STRONG_KEYS.has(a))) };
}

export function assessHomeEligibility(input: HomeEligibilityInput): HomeEligibility {
  if (EXCLUDED_CATEGORIES.has(String(input.category))) {
    return { eligible: false, reason: 'EXCLUDED_CATEGORY', matched: String(input.category) };
  }
  const titleRaw = input.title ?? '';
  const title = normalize(titleRaw);

  /* Exclusions read the HEADLINE (what the story is about) — a business story whose summary mentions
     a stadium is not sport; a "how to watch" fixture piece is sport whatever its category says. */
  for (const group of EXCLUSIONS) {
    const hit = matches(title, group.terms);
    if (hit.length > 0) return { eligible: false, reason: group.reason, matched: hit[0] };
  }

  const lead = leadSentence(input.summary);
  const business = admits({ title: familiesIn(titleRaw, 'business'), lead: familiesIn(lead, 'business') });
  /* FINAL CORRECTION · R2 — when the headline's event is a legal process (arrest, charge, trial,
     sentence …), naming a war ("<place> war") or an atrocity crime is the case's background, not a
     current conflict development: those families do not count; another conflict family must. */
  const legal = LEGAL_PROCESS.test(stripNotEvidence(title));
  const conflictZone = (raw: string): Set<string> => {
    const f = familiesIn(raw, 'conflict');
    if (legal) for (const k of LEGAL_BACKGROUND_KEYS) f.delete(k);
    return f;
  };
  const conflict = admits({ title: conflictZone(titleRaw), lead: conflictZone(lead) });
  if (!business.ok && !conflict.ok) return { eligible: false, reason: 'NO_BUSINESS_OR_CONFLICT_EVIDENCE' };

  const score = (families: readonly string[]): number =>
    families.reduce((s, k) => s + (STRONG_KEYS.has(k) ? 3 : 1), 0);
  const businessScore = business.ok ? score(business.families) : 0;
  const conflictScore = conflict.ok ? score(conflict.families) : 0;
  const domains: HomeDomain[] = [];
  if (business.ok) domains.push('business');
  if (conflict.ok) domains.push('conflict');
  const primary: HomeDomain = conflictScore > businessScore ? 'conflict' : business.ok ? 'business' : 'conflict';
  return {
    eligible: true,
    domains,
    primary,
    signals: { business: business.ok ? business.families : [], conflict: conflict.ok ? conflict.families : [] },
    strength: businessScore + conflictScore,
  };
}

/**
 * "Why it is here" in plain words: the topic of the ADMITTING evidence families, never raw
 * matched tokens. A family with no reader label (e.g. a money amount) adds none.
 */
const TOPIC_LABELS: ReadonlyArray<{ label: string; keys: readonly string[] }> = [
  { label: 'Energy and fuel', keys: ['energy-price', 'oil-gas', 'power-outage', 'energy-project', 'infrastructure-attack'] },
  { label: 'Prices and cost of living', keys: ['inflation', 'cost-of-living', 'price-move', 'staples'] },
  { label: 'Money, debt and finance', keys: ['rates', 'markets', 'currency', 'public-finance', 'finance'] },
  { label: 'Trade and transport', keys: ['import-duty', 'trade-policy', 'sanctions-policy', 'trade-disruption', 'trade-flows', 'levy', 'sanctions'] },
  { label: 'Companies and investment', keys: ['company-results', 'corporate', 'investment', 'industry', 'mining', 'business-disruption'] },
  { label: 'Jobs and incomes', keys: ['labour'] },
  { label: 'Public policy and regulation', keys: ['regulation', 'tax-policy', 'subsidy'] },
  { label: 'Infrastructure', keys: ['infrastructure'] },
  { label: 'Growth and the economy', keys: ['growth', 'economy', 'tourism'] },
  { label: 'Armed conflict', keys: ['armed-conflict', 'atrocity-crimes', 'air-war', 'named-armed-actor', 'armed-action', 'place-war', 'armed-actors', 'military-ops'] },
  { label: 'Ceasefire and peace efforts', keys: ['ceasefire'] },
  { label: 'Displacement and humanitarian impact', keys: ['displacement'] },
  { label: 'Attacks and security', keys: ['terror-attack', 'violence', 'casualties'] },
];

/** Families in the order given (strong first), mapped to at most two distinct reader labels. */
export function plainTopicLabels(families: readonly string[]): string[] {
  const out: string[] = [];
  for (const key of families) {
    const label = TOPIC_LABELS.find((t) => t.keys.includes(key))?.label;
    if (label !== undefined && !out.includes(label)) out.push(label);
  }
  return out.slice(0, 2);
}
