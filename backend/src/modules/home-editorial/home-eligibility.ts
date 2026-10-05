import type { NewsCategory } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PHONE-FIRST HOME CORRECTION R1 · §5 — HOME EDITORIAL ELIGIBILITY: BUSINESS AND CONFLICT ONLY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Applied on the server BEFORE a story can reach any visible Home surface (hero, region rows,
 * default story search). Deterministic, explainable, no AI, no provider call.
 *
 * Order of the rule:
 *   1. HARD EXCLUSION. Provider category sports/entertainment, or a sport / celebrity / gaming /
 *      lifestyle signal in the headline, rejects the story outright. A sports story is never
 *      renamed "business" because it mentions money ("club sold for $3bn" stays out).
 *   2. EVIDENCE. Business needs at least one STRONG business term (trade, inflation, refinery,
 *      investment …) — the word "market", a country name, or a business-category label alone is
 *      not enough. Conflict needs one STRONG conflict term (fighting, ceasefire, militia,
 *      airstrike, displaced …) or three WEAK ones (an accident that "killed" "military" officers is not, by itself, a conflict).
 *   3. The matched terms ARE the stated reason ("why this is on Home") — nothing is invented.
 *
 * Ambiguous words are deliberately weak or absent: "attack" (heart attack), "strike" (labour vs
 * air), "market", "security", "goal", "match", "shares" (as in "shares her story").
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
      /** The supporting terms found in the reporting, per domain. */
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

const BUSINESS_STRONG = [
  'economy', 'economic', 'economies', 'inflation', 'gdp', 'recession', 'central bank', 'interest rate',
  'interest rates', 'tariff', 'tariffs', 'trade deal', 'trade war', 'trade talks', 'exports', 'imports',
  'export ban', 'investment', 'investments', 'investor', 'investors', 'refinery', 'oil price', 'oil prices',
  'fuel price', 'fuel prices', 'energy prices', 'gas prices', 'electricity prices', 'budget', 'tax', 'taxes',
  'vat', 'debt', 'imf', 'world bank', 'bonds', 'bond yields', 'eurobond', 'currency', 'shilling', 'eurozone',
  'euro zone', 'unemployment', 'jobs', 'layoffs', 'job cuts', 'wages', 'minimum wage', 'workers strike',
  'stock exchange', 'stock market', 'earnings', 'revenue', 'profit', 'profits', 'acquisition', 'merger',
  'takeover', 'privatisation', 'privatization', 'regulator', 'regulation', 'regulations', 'antitrust',
  'competition authority', 'infrastructure', 'pipeline', 'port', 'railway', 'power plant', 'electricity',
  'blackout', 'power outage', 'supply chain', 'shipping', 'freight', 'cost of living', 'subsidy', 'subsidies',
  'manufacturing', 'factory', 'startup', 'start up', 'bank', 'banks', 'banking', 'loan', 'loans', 'credit',
  'mining', 'minerals', 'cobalt', 'copper', 'gold mine', 'oil field', 'gas field', 'lng', 'opec', 'crude',
  'agriculture', 'harvest', 'food prices', 'wheat', 'coffee exports', 'tea exports', 'tourism revenue',
  'sanctions', 'trade', 'company', 'companies', 'firm', 'firms', 'business', 'businesses', 'market share',
  'commodity', 'commodities', 'stock', 'stocks', 'orders worth', 'deal worth', 'contract worth',
  'payroll', 'expansion', 'ecb', 'european commission fines', 'single market', 'customs',
];

const CONFLICT_STRONG = [
  'war', 'wars', 'warfare', 'conflict', 'fighting', 'clashes', 'ceasefire', 'cease fire', 'truce',
  'militia', 'militias', 'rebel', 'rebels', 'insurgent', 'insurgents', 'insurgency', 'jihadist', 'jihadists',
  'al shabaab', 'al shabab', 'm23', 'rsf', 'hamas', 'hezbollah', 'houthi', 'houthis', 'isis', 'islamic state',
  'airstrike', 'airstrikes', 'air strike', 'air strikes', 'drone strike', 'drone strikes', 'shelling', 'missile',
  'missiles', 'rocket fire', 'bombardment', 'offensive', 'invasion', 'occupation', 'siege', 'hostage',
  'hostages', 'displaced', 'displacement', 'refugees', 'refugee camp', 'armed group', 'armed groups', 'gunmen',
  'terror attack', 'terrorist attack', 'suicide bomber', 'bombing', 'coup', 'peace talks', 'peace deal',
  'peace agreement', 'troops', 'military operation', 'massacre', 'genocide', 'war crimes', 'civilians killed',
  'civil war', 'humanitarian corridor', 'frontline', 'front line', 'annexation', 'blockade',
];

const CONFLICT_WEAK = [
  'military', 'army', 'soldiers', 'killed', 'violence', 'attack', 'attacks', 'explosion', 'security forces',
  'police', 'curfew', 'clash', 'protest', 'protests', 'unrest', 'tensions', 'border', 'weapons', 'defence', 'defense',
];

function normalize(value: string): string {
  return ` ${value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

function matches(text: string, terms: readonly string[]): string[] {
  const found: string[] = [];
  for (const term of terms) {
    const t = normalize(term).trim();
    if (t !== '' && text.includes(` ${t} `)) found.push(term);
  }
  return found;
}

export function assessHomeEligibility(input: HomeEligibilityInput): HomeEligibility {
  if (EXCLUDED_CATEGORIES.has(String(input.category))) {
    return { eligible: false, reason: 'EXCLUDED_CATEGORY', matched: String(input.category) };
  }
  const title = normalize(input.title ?? '');
  const body = normalize(`${input.title ?? ''} ${input.summary ?? ''}`);

  /* Exclusions read the HEADLINE (what the story is about) — a business story whose summary mentions
     a stadium is not sport; a "how to watch" fixture piece is sport whatever its category says. */
  for (const group of EXCLUSIONS) {
    const hit = matches(title, group.terms);
    if (hit.length > 0) return { eligible: false, reason: group.reason, matched: hit[0] };
  }

  const business = matches(body, BUSINESS_STRONG);
  const conflictStrong = matches(body, CONFLICT_STRONG);
  const conflictWeak = matches(body, CONFLICT_WEAK);

  /* "trade", "company", "business", "firm", "bank" are common enough that ONE of them in the summary
     alone is not evidence; they need a second business term or a headline position. */
  const COMMON = new Set(['trade', 'company', 'companies', 'firm', 'firms', 'business', 'businesses', 'bank', 'banks', 'credit', 'port', 'budget', 'tax']);
  const businessInTitle = matches(title, BUSINESS_STRONG);
  const businessOk =
    business.some((t) => !COMMON.has(t)) || business.length >= 2 || businessInTitle.length >= 1;
  const conflictOk = conflictStrong.length >= 1 || conflictWeak.length >= 3;

  if (!businessOk && !conflictOk) return { eligible: false, reason: 'NO_BUSINESS_OR_CONFLICT_EVIDENCE' };

  const domains: HomeDomain[] = [];
  /* Strength counts DISTINCTIVE terms only: "business", "firm", "company" … do not make a story weightier. */
  const businessScore = businessOk ? business.filter((t) => !COMMON.has(t)).length + businessInTitle.filter((t) => !COMMON.has(t)).length : 0;
  const conflictScore = conflictOk ? conflictStrong.length * 2 + conflictWeak.length + matches(title, CONFLICT_STRONG).length : 0;
  if (businessOk) domains.push('business');
  if (conflictOk) domains.push('conflict');
  const primary: HomeDomain = conflictScore > businessScore ? 'conflict' : businessOk ? 'business' : 'conflict';
  return {
    eligible: true,
    domains,
    primary,
    signals: { business: businessOk ? business : [], conflict: conflictOk ? [...conflictStrong, ...conflictWeak] : [] },
    strength: businessScore + conflictScore,
  };
}
