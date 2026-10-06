import {
  EAST_AFRICA_MEMBERS,
  EU27_MEMBERS,
  HOME_REGION_ORDER,
  MIDDLE_EAST_MEMBERS,
  findCountryByIso3,
  productCoverageScope,
  type HomeEditorialDomain,
  type HomeEditorialResponse,
  type HomeFreshness,
  type HomeHero,
  type HomeRegionId,
  type HomeRegionRow,
  type HomeStoryCard,
  type HomeStoryCountry,
  type HomeVisibilityPolicy,
} from '@globalnews-ai/shared';
import { computeArticleRef } from '../news/identity/article-ref.util';
import { assessHomeEligibility, plainTopicLabels } from './home-eligibility';
import { supportedCountries } from './home-geography';

/**
 * PHONE-FIRST HOME CORRECTION R1 · §3, §6, §11 — the pure assembly of the Home editorial read:
 * eligibility → region relationship → same-development grouping → freshness/ranking → hero →
 * rows. No I/O (the service supplies rows), so every rule is unit-testable.
 */
export const HOME_VISIBILITY_POLICY: HomeVisibilityPolicy = Object.freeze({
  priorityWindowHours: 72,
  discussionWindowDays: 7,
  discussionMinParticipants: 2,
  earlierWindowDays: 30,
  perRegionMax: 8,
  sparseBelow: 3,
  heroRotationHours: 6,
});

export const REGION_MEMBERS: Readonly<Record<HomeRegionId, ReadonlySet<string>>> = {
  'region:east-africa': new Set(EAST_AFRICA_MEMBERS),
  'region:european-union': new Set(EU27_MEMBERS),
  'region:middle-east': new Set(MIDDLE_EAST_MEMBERS),
};

export interface RetainedRow {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly summary: string | null;
  readonly imageUrl: string | null;
  readonly sourceId: string | null;
  readonly sourceName: string;
  readonly category: string;
  readonly publishedAt: Date;
  readonly publishedAtBasis: 'publisher' | 'observed';
  readonly fetchedAt: Date;
  /** Relevant countries (ArticleCountry.isRelevant), ISO3 with relevance score. */
  readonly countries: readonly { readonly iso3: string; readonly relevance: number }[];
}

export interface DiscussionActivity {
  readonly comments: number;
  readonly participants: number;
  readonly lastActivityAt: Date;
}

export interface HomePreferences {
  readonly countries: ReadonlySet<string>;
  readonly domains: ReadonlySet<HomeEditorialDomain>;
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'over', 'after', 'amid', 'about', 'says', 'said',
  'will', 'has', 'have', 'are', 'was', 'were', 'its', 'their', 'more', 'than', 'new', 'as', 'at', 'in', 'on', 'of',
  'to', 'a', 'an', 'by', 'is', 'be', 'it', 'least', 'including',
]);

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 3 && !STOP.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

const SAME_DEVELOPMENT_JACCARD = 0.5;
const SAME_DEVELOPMENT_SPAN_MS = 4 * 24 * 3_600_000;
const HOUR = 3_600_000;

interface Candidate {
  readonly row: RetainedRow;
  readonly domains: readonly HomeEditorialDomain[];
  readonly primary: HomeEditorialDomain;
  readonly signals: readonly string[];
  readonly strength: number;
  readonly tokens: Set<string>;
  /** HOME DATA TRUTH B3 — the tagged countries the story itself supports (headline / lead). */
  readonly countries: RetainedRow['countries'];
  readonly regionRelevance: ReadonlyMap<HomeRegionId, number>;
}

interface Group {
  readonly lead: Candidate; // newest report = latest development
  readonly members: Candidate[];
}

export function regionsOf(countries: RetainedRow['countries']): Map<HomeRegionId, number> {
  const out = new Map<HomeRegionId, number>();
  for (const c of countries) {
    for (const id of HOME_REGION_ORDER) {
      if (REGION_MEMBERS[id].has(c.iso3)) out.set(id, Math.max(out.get(id) ?? 0, c.relevance));
    }
  }
  return out;
}

/** Eligible, real, in-window candidates. Mock rows and future-dated rows never qualify. */
export function candidatesOf(rows: readonly RetainedRow[], now: Date, requireRegion = true): Candidate[] {
  const out: Candidate[] = [];
  for (const row of rows) {
    if (row.id.startsWith('mock-') || (row.sourceId ?? '').startsWith('mock-')) continue;
    if (row.publishedAt.getTime() > now.getTime() + 10 * 60_000) continue;
    const verdict = assessHomeEligibility({ title: row.title, summary: row.summary, category: row.category });
    if (!verdict.eligible) continue;
    /* HOME DATA TRUTH B3 — region placement only from countries the story itself names */
    const countries = supportedCountries(row, row.countries);
    const regionRelevance = regionsOf(countries);
    if (requireRegion && regionRelevance.size === 0) continue;
    out.push({
      row,
      domains: verdict.domains,
      primary: verdict.primary,
      signals: [...new Set([...verdict.signals[verdict.primary], ...verdict.signals.business, ...verdict.signals.conflict])].slice(0, 4),
      strength: verdict.strength,
      tokens: titleTokens(row.title),
      countries,
      regionRelevance,
    });
  }
  return out;
}

/** Same-development grouping: near-identical headlines within ±4 days are one card. */
export function groupSameDevelopment(candidates: readonly Candidate[]): Group[] {
  const sorted = [...candidates].sort((a, b) => b.row.publishedAt.getTime() - a.row.publishedAt.getTime());
  const groups: Group[] = [];
  for (const c of sorted) {
    const home = groups.find(
      (g) =>
        Math.abs(g.lead.row.publishedAt.getTime() - c.row.publishedAt.getTime()) <= SAME_DEVELOPMENT_SPAN_MS &&
        g.members.some((m) => jaccard(m.tokens, c.tokens) >= SAME_DEVELOPMENT_JACCARD),
    );
    if (home) home.members.push(c);
    else groups.push({ lead: c, members: [c] });
  }
  return groups;
}

function country(iso3: string): HomeStoryCountry {
  return { iso3, name: findCountryByIso3(iso3)?.name ?? iso3 };
}

export interface AssemblyInput {
  readonly rows: readonly RetainedRow[];
  readonly storyIdByUrl: ReadonlyMap<string, string>;
  readonly discussionByStory: ReadonlyMap<string, DiscussionActivity>;
  readonly preferences: HomePreferences | null;
  readonly now: Date;
  readonly policy?: HomeVisibilityPolicy;
}

interface Ranked {
  readonly group: Group;
  readonly card: HomeStoryCard;
  readonly score: number;
}

function freshnessOf(group: Group, discussion: DiscussionActivity | null, now: Date, policy: HomeVisibilityPolicy): HomeFreshness {
  const window = policy.priorityWindowHours * HOUR;
  const newest = group.lead.row.publishedAt.getTime();
  const oldest = Math.min(...group.members.map((m) => m.row.publishedAt.getTime()));
  if (now.getTime() - newest <= window) return now.getTime() - oldest <= window ? 'LAST_72H' : 'DEVELOPING';
  if (
    discussion !== null &&
    discussion.participants >= policy.discussionMinParticipants &&
    now.getTime() - discussion.lastActivityAt.getTime() <= policy.discussionWindowDays * 24 * HOUR
  ) {
    return 'ACTIVE_DISCUSSION';
  }
  return 'EARLIER';
}

const TIER: Record<HomeFreshness, number> = { LAST_72H: 3, DEVELOPING: 3, ACTIVE_DISCUSSION: 2, EARLIER: 1 };

export function cardOf(
  group: Group,
  storyIdByUrl: ReadonlyMap<string, string>,
  discussionByStory: ReadonlyMap<string, DiscussionActivity>,
  now: Date,
  policy: HomeVisibilityPolicy,
): { card: HomeStoryCard; discussion: DiscussionActivity | null } {
  const lead = group.lead;
  const storyId = storyIdByUrl.get(lead.row.url) ?? group.members.map((m) => storyIdByUrl.get(m.row.url)).find((s) => s !== undefined) ?? null;
  const discussion = storyId === null ? null : discussionByStory.get(storyId) ?? null;
  const others = group.members.filter((m) => m !== lead);
  const regions = HOME_REGION_ORDER.filter((id) => group.members.some((m) => m.regionRelevance.has(id)));
  const countryCodes = [...new Set(group.members.flatMap((m) => [...m.countries].sort((a, b) => b.relevance - a.relevance).map((c) => c.iso3)))];
  const card: HomeStoryCard = {
    articleRef: computeArticleRef(lead.row.url),
    storyId,
    url: lead.row.url,
    title: lead.row.title,
    summary: lead.row.summary && lead.row.summary.trim() !== '' ? lead.row.summary : null,
    imageUrl: lead.row.imageUrl,
    publisher: lead.row.sourceName,
    sourceId: lead.row.sourceId,
    publishedAt: lead.row.publishedAt.toISOString(),
    publishedAtBasis: lead.row.publishedAtBasis,
    firstSeenAt: lead.row.fetchedAt.toISOString(),
    category: lead.row.category,
    primaryDomain: lead.domains.length > 0 ? lead.primary : null,
    domains: [...new Set(group.members.flatMap((m) => m.domains))],
    signals: lead.signals,
    topics: plainTopicLabels([...new Set(group.members.flatMap((m) => m.signals))]),
    countries: countryCodes.slice(0, 4).map(country),
    regions,
    freshness: freshnessOf(group, discussion, now, policy),
    otherReports: {
      count: others.length,
      publishers: [...new Set(others.map((m) => m.row.sourceName).filter((p) => p !== lead.row.sourceName))].slice(0, 4),
      firstReportedAt: new Date(Math.min(...group.members.map((m) => m.row.publishedAt.getTime()))).toISOString(),
    },
    discussion:
      discussion === null
        ? null
        : { comments: discussion.comments, participants: discussion.participants, lastActivityAt: discussion.lastActivityAt.toISOString() },
    sourceStatus: 'RETAINED_PUBLISHER_REPORT',
  };
  return { card, discussion };
}

/**
 * Ranking (contract §11). Freshness tier first; inside a tier, evidence strength, regional
 * relevance and independent reports; discussion adds a CAPPED bonus from unique participants
 * (never raw comment volume), so it can keep a story up but never outrank a material development.
 */
function scoreOf(group: Group, card: HomeStoryCard, discussion: DiscussionActivity | null, now: Date): number {
  const ageDays = (now.getTime() - group.lead.row.publishedAt.getTime()) / (24 * HOUR);
  const relevance = Math.max(0, ...group.members.flatMap((m) => [...m.regionRelevance.values()]));
  const strength = Math.min(group.lead.strength, 6);
  const corroboration = Math.min(new Set(group.members.map((m) => m.row.sourceName)).size - 1, 4);
  const talk = discussion === null ? 0 : Math.min(discussion.participants, 4);
  /* ASK RELIABILITY R1 (§10) — local original East African reporting leads the international
     aggregators that otherwise dominate by volume (a bounded nudge inside the same freshness tier). */
  const local = group.members.some((m) => isEastAfricanLocalPublisher(m.row.sourceName)) ? 8 : 0;
  return TIER[card.freshness] * 100 + strength * 3 + Math.min(relevance, 100) / 10 + corroboration * 2 + talk * 2 + local - ageDays * 4;
}

function sixHourBucket(now: Date, hours: number): number {
  return Math.floor(now.getTime() / (hours * HOUR));
}

export function assembleHomeEditorial(input: AssemblyInput): HomeEditorialResponse {
  const policy = input.policy ?? HOME_VISIBILITY_POLICY;
  const now = input.now;
  const earliest = now.getTime() - policy.earlierWindowDays * 24 * HOUR;
  const rows = input.rows.filter((r) => r.publishedAt.getTime() >= earliest);
  const groups = groupSameDevelopment(candidatesOf(rows, now));
  const ranked: Ranked[] = groups
    .map((group) => {
      const { card, discussion } = cardOf(group, input.storyIdByUrl, input.discussionByStory, now, policy);
      return { group, card, score: scoreOf(group, card, discussion, now) };
    })
    .sort((a, b) => b.score - a.score || b.card.publishedAt.localeCompare(a.card.publishedAt));

  /* HERO — explicit preferences first; otherwise a stable high-impact default. */
  let hero: HomeHero | null = null;
  const prefs = input.preferences;
  const used = new Set<Ranked>();
  if (ranked.length > 0) {
    let pick: Ranked | undefined;
    let matched: HomeHero['matched'] = { countries: [], domains: [] };
    if (prefs !== null && (prefs.countries.size > 0 || prefs.domains.size > 0)) {
      /* A followed COUNTRY is the most specific preference and always leads; then a matching
         interest; inside each, the ordinary ranking (freshness first). */
      const scored = ranked
        .map((r) => {
          const countries = r.card.countries.filter((c) => prefs.countries.has(c.iso3));
          const domains = r.card.domains.filter((d) => prefs.domains.has(d));
          const rank = (countries.length > 0 ? 2 : 0) + (domains.length > 0 ? 1 : 0);
          return { r, countries, domains, rank };
        })
        .filter((x) => x.rank > 0)
        .sort((a, b) => (b.rank >= 2 ? 1 : 0) - (a.rank >= 2 ? 1 : 0) || b.r.score - a.r.score || b.rank - a.rank);
      if (scored.length > 0) {
        pick = scored[0].r;
        matched = { countries: scored[0].countries, domains: scored[0].domains };
      }
    }
    const basis = pick === undefined ? 'DEFAULT' : 'PREFERENCES';
    if (pick === undefined) {
      const fresh = ranked.filter((r) => r.card.freshness === 'LAST_72H' || r.card.freshness === 'DEVELOPING');
      /* ASK RELIABILITY R1 (§10) — the default hero leads with East Africa when a fresh East African
         development qualifies; otherwise the strongest fresh development anywhere in scope. */
      const freshEastAfrica = fresh.filter((r) => r.card.regions.includes('region:east-africa'));
      const pool = (freshEastAfrica.length > 0 ? freshEastAfrica : fresh.length > 0 ? fresh : ranked).slice(0, 3);
      pick = pool[sixHourBucket(now, policy.heroRotationHours) % pool.length];
    }
    used.add(pick);
    const more = ranked.filter((r) => r !== pick && (r.card.freshness === 'LAST_72H' || r.card.freshness === 'DEVELOPING')).slice(0, 2);
    for (const r of more) used.add(r);
    hero = { story: pick.card, basis, matched, more: more.map((r) => r.card) };
  }

  /* ROWS — each story once, in the region where it is most relevant; hero stories are not repeated. */
  const byRegion = new Map<HomeRegionId, Ranked[]>(HOME_REGION_ORDER.map((id) => [id, []]));
  const totals = new Map<HomeRegionId, { recent: number; total: number }>(HOME_REGION_ORDER.map((id) => [id, { recent: 0, total: 0 }]));
  for (const r of ranked) {
    for (const id of r.card.regions) {
      const t = totals.get(id)!;
      t.total++;
      if (r.card.freshness === 'LAST_72H' || r.card.freshness === 'DEVELOPING') t.recent++;
    }
    if (used.has(r)) continue;
    let best: HomeRegionId | null = null;
    let bestRel = -1;
    for (const id of HOME_REGION_ORDER) {
      const rel = Math.max(-1, ...r.group.members.map((m) => m.regionRelevance.get(id) ?? -1));
      if (rel > bestRel) {
        bestRel = rel;
        best = id;
      }
    }
    if (best !== null) byRegion.get(best)!.push(r);
  }
  const regions: HomeRegionRow[] = HOME_REGION_ORDER.map((id) => {
    const scope = productCoverageScope(id)!;
    const stories = byRegion.get(id)!.slice(0, policy.perRegionMax).map((r) => r.card);
    return {
      id,
      scopeLabel: scope.scopeLabel,
      disclosure: scope.disclosure,
      memberCount: scope.members.length,
      state: stories.length === 0 ? 'EMPTY' : stories.length < policy.sparseBelow ? 'SPARSE' : 'OK',
      stories,
      counts: totals.get(id)!,
    };
  });

  return { generatedAt: now.toISOString(), policy, hero, regions, degraded: false };
}

export function degradedHomeEditorial(now: Date, policy: HomeVisibilityPolicy = HOME_VISIBILITY_POLICY): HomeEditorialResponse {
  return {
    generatedAt: now.toISOString(),
    policy,
    hero: null,
    degraded: true,
    regions: HOME_REGION_ORDER.map((id) => {
      const scope = productCoverageScope(id)!;
      return {
        id,
        scopeLabel: scope.scopeLabel,
        disclosure: scope.disclosure,
        memberCount: scope.members.length,
        state: 'UNAVAILABLE' as const,
        stories: [],
        counts: { recent: 0, total: 0 },
      };
    }),
  };
}

/** Known East African local publishers (names as retained providers report them). */
const EAST_AFRICAN_LOCAL_PUBLISHERS = [
  'the standard', 'nation', 'daily nation', 'business daily', 'the star', 'capital fm', 'the citizen', 'daily news',
  'the new times', 'kt press', 'taarifa', 'igihe', 'daily monitor', 'new vision', 'the eastafrican', 'the east african',
  'addis standard', 'the reporter', 'garowe online', 'hiiraan', 'radio okapi', 'actualite.cd', 'sudans post',
  'radio tamazuj', 'eye radio', 'iwacu', 'kenyans.co.ke', 'tuko', 'mwananchi', 'the chronicles',
];
export function isEastAfricanLocalPublisher(name: string): boolean {
  const n = name.trim().toLowerCase();
  return EAST_AFRICAN_LOCAL_PUBLISHERS.some((p) => n === p || n.startsWith(`${p} `) || n.endsWith(` ${p}`));
}
