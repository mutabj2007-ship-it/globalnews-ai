import type { NewsArticle } from '@globalnews-ai/shared';
import { resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import type { AskR2Route } from '../ask-router/ask-r2-route';
import {
  governedInstitution,
  namesInstitution,
  namesSubject,
  readInstitutionalStatusQuestion,
  type GovernedInstitutionId,
} from '../news/relevance/governed-institutions';
import {
  normalizePublisherName,
  resolveRegistrableDomain,
} from '../news/identity/publisher-identity.util';
import { clusterArticlesWithMembership } from '../analysis/duplicates/cluster-articles.util';
import { COUNTRY_DEMONYMS_BY_ISO3 } from '../news/country/country-relevance.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CURRENT STATUS CORROBORATION R1 — THE DETERMINISTIC CORROBORATION SEAM
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Frozen C's current-status contract admits CURRENT_REPORTING_PARTIAL_VERIFICATION when "at
 * least two independent fresh reporting sources agree". CTO ruling: a model saying two
 * sources agree is NOT backend verification. This module is the backend-owned fact: it reads
 * ONLY admitted reporting articles and their deterministic metadata/text, makes ZERO model
 * calls, and returns a typed corroborated fact — or says exactly why there is none.
 *
 * TWO FACT FAMILIES, nothing broader (no embeddings, no classifier, no entailment):
 *
 *   OFFICE_HOLDER  office + country → one person, from bounded EN/PL surface patterns
 *                  ("Polish President Karol Nawrocki", "prezydent Polski Karol Nawrocki").
 *   POLICY_RATE    a governed institution → one rate, canonical basis points
 *                  ("NBP … reference rate at 5.75%" → 575; "stopa referencyjna 5,75 proc.").
 *
 * A report QUALIFIES only if every one of these is ESTABLISHED (never inferred):
 *   - a trustworthy publication time (publishedAtBasis 'publisher', parseable, not future);
 *   - no older than 7 days at execution (or the reader's stricter stated period, when one is
 *     carried and understood — an unrecognised period is not guessed: nothing qualifies);
 *   - a normalized registrable publisher domain;
 *   - the fact extracted independently from THAT report's own title/summary.
 * Qualifying reports then COUNT only if pairwise independent: different registrable domains,
 * different normalized source names (when available), and not members of the same
 * duplicate-like reporting cluster (the landed clustering rule). Any disagreement among
 * qualifying extractions is a conflict, and a conflict corroborates nothing.
 *
 * It is REPORTING evidence and stays REPORTING: nothing here is, or is labelled, OFFICIAL.
 */

export type CorroborationFamily = 'OFFICE_HOLDER' | 'POLICY_RATE';
export type SupportedOffice = 'PRESIDENT' | 'PRIME_MINISTER';

export type CorroborationTarget =
  | {
      readonly family: 'OFFICE_HOLDER';
      readonly office: SupportedOffice;
      readonly countryIso3: string;
    }
  | { readonly family: 'POLICY_RATE'; readonly institutionId: GovernedInstitutionId };

export interface ExtractedFact {
  readonly family: CorroborationFamily;
  /** The canonical comparison key: folded person name, or `bps:<n>`. */
  readonly key: string;
  /** The fact as reported: the person's name as written, or the rate in basis points. */
  readonly value: string | number;
}

export type CorroborationReason =
  | 'CORROBORATED'
  | 'UNSUPPORTED_FACT_FAMILY'
  | 'PERIOD_UNESTABLISHED'
  | 'NO_QUALIFYING_REPORT'
  | 'CONFLICTING_FACTS'
  | 'INSUFFICIENT_INDEPENDENT_REPORTS';

export interface CorroborationResult {
  readonly corroborated: boolean;
  readonly reason: CorroborationReason;
  readonly family: CorroborationFamily | null;
  readonly fact: ExtractedFact | null;
  /** Independent, fresh, agreeing reports — the number passed to the answer derivation. */
  readonly qualifyingReports: number;
  /** The freshest corroborating report's publication time; null unless corroborated. */
  readonly asOf: string | null;
  readonly articleIds: readonly string[];
}

export const CORROBORATION_MAX_AGE_DAYS = 7;
const DAY_MS = 86_400_000;
/** A publication time this far in the future is a clock/feed error, not a fresh report. */
const FUTURE_SKEW_MS = 5 * 60_000;

/* ── 1 · the target, from the route (the plan's own reading) ─────────────────── */

const OFFICE_OF_READER_TERM: Readonly<Record<string, SupportedOffice>> = {
  president: 'PRESIDENT',
  prezydentem: 'PRESIDENT',
  'prime minister': 'PRIME_MINISTER',
  premierem: 'PRIME_MINISTER',
};

/** Which supported fact this current-status plan asks for, or null (unsupported family). */
export function corroborationTargetOf(route: AskR2Route): CorroborationTarget | null {
  const status = route.envelope.currentStatus;
  if (!status.requested) return null;
  if (status.readerTerms.includes('POLICY_RATE')) {
    const shape = readInstitutionalStatusQuestion(route.envelope.rawQuestion);
    return shape === null ? null : { family: 'POLICY_RATE', institutionId: shape.institution.id };
  }
  const office = status.readerTerms
    .map((term) => OFFICE_OF_READER_TERM[term.toLowerCase().replace(/\s+/g, ' ')])
    .find((value): value is SupportedOffice => value !== undefined);
  const typed = route.envelope.geography.candidates.find((c) => c.source === 'TYPED_GEOGRAPHY');
  if (office === undefined || typed === undefined) return null;
  return { family: 'OFFICE_HOLDER', office, countryIso3: typed.value };
}

/* ── 2 · extraction — bounded surface patterns, per report ────────────────────── */

/** "polish" → [Pp][Oo]…: a case-insensitive span inside an otherwise case-SENSITIVE pattern. */
function anyCase(phrase: string): string {
  return [...phrase]
    .map((ch) => {
      if (/\s/.test(ch)) return '\\s+';
      const lower = ch.toLowerCase();
      const upper = ch.toUpperCase();
      if (lower !== upper) return `[${lower}${upper}]`;
      return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
}
const alt = (phrases: readonly string[]): string => `(?:${phrases.map(anyCase).join('|')})`;

/** A person as written: exactly two capitalised name tokens (given + family, hyphen allowed). */
const NAME_TOKEN = String.raw`\p{Lu}[\p{Ll}\p{M}]+(?:-\p{Lu}[\p{Ll}\p{M}]+)?`;
const NAME = `(${NAME_TOKEN})\\s+(${NAME_TOKEN})`;
/** Title-case headline words that can never be a name token ("Karol Nawrocki Says"). */
const NOT_A_NAME = new Set(
  (
    'the a an of and or says said to in on for with is was has have will meets visits vetoes signs ' +
    'calls urges warns backs rejects names appoints wins loses after as at by from new first ' +
    'mówi powiedział spotyka podpisał zawetował wzywa ostrzega'
  ).split(' '),
);

const EN_OFFICE: Readonly<Record<SupportedOffice, readonly string[]>> = {
  PRESIDENT: ['president'],
  PRIME_MINISTER: ['prime minister'],
};
/** PL: the NOMINATIVE office noun only — an inflected name ("prezydenta Karola Nawrockiego")
 *  would not compare equal to the nominative, so those constructions are not read at all. */
const PL_OFFICE: Readonly<Record<SupportedOffice, readonly string[]>> = {
  PRESIDENT: ['prezydent'],
  PRIME_MINISTER: ['premier'],
};
/** PL genitive country forms, reviewed per country. Unlisted countries: EN patterns only. */
const PL_COUNTRY_GENITIVE: Readonly<Partial<Record<string, readonly string[]>>> = {
  POL: ['polski', 'rp', 'rzeczypospolitej polskiej'],
};
/** A match preceded by one of these is not the CURRENT holder. */
const NOT_CURRENT_BEFORE =
  /(?:former|ex|late|then|incoming|previous|by[łl][aey]?(?:go|m)?|poprzedni\p{L}*|zmar[łl]\p{L}*)[\s-]*$/iu;

function officePatterns(office: SupportedOffice, iso3: string): RegExp[] {
  const country = resolveCountryByAnyIdentifier(iso3);
  if (country === undefined) return [];
  const name = country.name.toLowerCase();
  const demonyms = COUNTRY_DEMONYMS_BY_ISO3[iso3] ?? [];
  const O = alt(EN_OFFICE[office]);
  const Cname = alt([name]);
  const Cposs = `${Cname}['’]s`;
  const Cadj = alt([...demonyms, `${name}'s`, `${name}’s`]);
  const patterns = [
    /* "Polish President Karol Nawrocki", "Poland's President Karol Nawrocki" */
    `${Cadj}\\s+${O}\\s+${NAME}`,
    /* "President of Poland Karol Nawrocki", "president of Poland, Karol Nawrocki" */
    `${O}\\s+of\\s+${Cname}\\s*,?\\s+${NAME}`,
    /* "President Karol Nawrocki of Poland" */
    `${O}\\s+${NAME}\\s+of\\s+${Cname}(?![\\p{L}])`,
    /* "Karol Nawrocki, Poland's president" / ", the president of Poland" / ", the Polish president" */
    `${NAME}\\s*,\\s*(?:${alt(['the'])}\\s+)?(?:${[
      `${Cposs}\\s+${O}`,
      `${O}\\s+of\\s+${Cname}`,
      ...(demonyms.length > 0 ? [`${alt(demonyms)}\\s+${O}`] : []),
    ].join('|')})(?![\\p{L}])`,
  ];
  const genitive = PL_COUNTRY_GENITIVE[iso3];
  if (genitive !== undefined) {
    const Opl = alt(PL_OFFICE[office]);
    const Cgen = alt(genitive);
    /* "prezydent Polski Karol Nawrocki", "premier RP Donald Tusk" */
    patterns.push(`${Opl}\\s+${Cgen}\\s+${NAME}`);
    /* "Karol Nawrocki, prezydent Polski" */
    patterns.push(`${NAME}\\s*,\\s*${Opl}\\s+${Cgen}(?![\\p{L}])`);
  }
  return patterns.map((source) => new RegExp(source, 'gu'));
}

function fold(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .replace(/\s+/g, ' ')
    .trim();
}

function textOf(article: Pick<NewsArticle, 'title' | 'summary'>): string[] {
  return [article.title ?? '', ...(article.summary ?? '').split(/(?<=[.!?])\s+/)].filter(
    (s) => s.trim().length > 0,
  );
}

/** One person per report, or null (none, or two different people — ambiguous). */
export function extractOfficeHolder(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  office: SupportedOffice,
  countryIso3: string,
): ExtractedFact | null {
  const patterns = officePatterns(office, countryIso3);
  const found = new Map<string, string>();
  for (const sentence of textOf(article)) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      for (const match of sentence.matchAll(pattern)) {
        const [given, family] = [match[1], match[2]];
        if (given === undefined || family === undefined) continue;
        if (NOT_A_NAME.has(given.toLowerCase()) || NOT_A_NAME.has(family.toLowerCase())) continue;
        if (NOT_CURRENT_BEFORE.test(sentence.slice(0, match.index ?? 0))) continue;
        const written = `${given} ${family}`;
        found.set(fold(written), written);
      }
    }
  }
  if (found.size !== 1) return null;
  const [[key, value]] = [...found.entries()] as [[string, string]];
  return { family: 'OFFICE_HOLDER', key, value };
}

const PERCENT =
  /(?<![\p{L}\p{N}.,])(\d{1,2}(?:[.,]\d{1,2})?)\s?(?:%|percent\b|per\s+cent\b|proc\.?|procent\p{L}*)/giu;
/** Where the rate subject is first stated in a sentence (governed forms, whole words). */
function subjectIndex(sentence: string, forms: readonly string[]): number {
  let first = -1;
  for (const form of forms) {
    const source = form
      .split(/\s+/)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+');
    const match = new RegExp(`(?<![\\p{L}\\p{N}])${source}(?![\\p{L}\\p{N}])`, 'iu').exec(sentence);
    if (match !== null && (first === -1 || match.index < first)) first = match.index;
  }
  return first;
}

/**
 * One rate per report, in basis points, or null (none, or ambiguous). Within a sentence that
 * names the institution AND the rate subject, the rate is the FIRST percentage stated after
 * the subject ("reference rate at 5.75% as inflation eased to 4.1%" → 575; "cut rates by 25
 * basis points to 5.50%" → 550; "stopa referencyjna wynosi 5,75 proc." → 575). A report whose
 * sentences yield different rates is ambiguous and yields nothing.
 */
export function extractPolicyRate(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  institutionId: GovernedInstitutionId,
): ExtractedFact | null {
  const institution = governedInstitution(institutionId);
  const subject = institution.subjects.find((s) => s.id === 'POLICY_RATE');
  if (subject === undefined) return null;
  const values = new Set<number>();
  for (const sentence of textOf(article)) {
    /* The institution AND the rate subject must be stated in the SAME sentence as the number. */
    if (!namesInstitution(sentence, institution) || !namesSubject(sentence, subject)) continue;
    const at = subjectIndex(sentence, subject.forms);
    const next = [...sentence.matchAll(PERCENT)].find((m) => (m.index ?? -1) > at);
    if (at === -1 || next === undefined) continue;
    const bps = Math.round(Number((next[1] ?? '').replace(',', '.')) * 100);
    if (bps >= 0 && bps <= 5000) values.add(bps);
  }
  if (values.size !== 1) return null;
  const [bps] = [...values] as [number];
  return { family: 'POLICY_RATE', key: `bps:${bps}`, value: bps };
}

export function extractFact(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  target: CorroborationTarget,
): ExtractedFact | null {
  return target.family === 'OFFICE_HOLDER'
    ? extractOfficeHolder(article, target.office, target.countryIso3)
    : extractPolicyRate(article, target.institutionId);
}

/* ── 3 · freshness window, including the reader's stricter stated period ────── */

const PERIOD_DAYS: Readonly<Record<string, number>> = {
  today: 1,
  dzisiaj: 1,
  dziś: 1,
  yesterday: 2,
  wczoraj: 2,
  'this week': 7,
  'w tym tygodniu': 7,
  'past week': 7,
  'last week': 7,
  'ostatni tydzień': 7,
  'w ostatnim tygodniu': 7,
};

/** Days, or null when a stated period is carried but not understood (never guessed). */
export function freshnessWindowDays(statedPeriod: string | null): number | null {
  if (statedPeriod === null || statedPeriod.trim() === '') return CORROBORATION_MAX_AGE_DAYS;
  const days = PERIOD_DAYS[statedPeriod.trim().toLowerCase()];
  return days === undefined ? null : Math.min(days, CORROBORATION_MAX_AGE_DAYS);
}

/* ── 4 · corroboration ─────────────────────────────────────────────────────── */

interface Qualified {
  readonly article: NewsArticle;
  readonly at: number;
  readonly domain: string;
  readonly source: string | undefined;
  readonly fact: ExtractedFact;
}

const none = (
  reason: CorroborationReason,
  family: CorroborationFamily | null,
): CorroborationResult => ({
  corroborated: false,
  reason,
  family,
  fact: null,
  qualifyingReports: 0,
  asOf: null,
  articleIds: [],
});

export function corroborateCurrentStatus(input: {
  readonly target: CorroborationTarget | null;
  readonly articles: readonly NewsArticle[];
  readonly now: Date;
  readonly statedPeriod: string | null;
  readonly minIndependentReports: number;
}): CorroborationResult {
  const { target } = input;
  if (target === null) return none('UNSUPPORTED_FACT_FAMILY', null);
  const windowDays = freshnessWindowDays(input.statedPeriod);
  if (windowDays === null) return none('PERIOD_UNESTABLISHED', target.family);

  const now = input.now.getTime();
  const qualified: Qualified[] = [];
  for (const article of input.articles) {
    if (article.publishedAtBasis !== 'publisher') continue;
    const at = Date.parse(article.publishedAt ?? '');
    if (!Number.isFinite(at) || at > now + FUTURE_SKEW_MS || now - at > windowDays * DAY_MS)
      continue;
    const domain = resolveRegistrableDomain(article.url ?? '');
    if (domain === undefined) continue;
    const fact = extractFact(article, target);
    if (fact === null) continue;
    qualified.push({
      article,
      at,
      domain,
      source: normalizePublisherName(article.sourceName ?? ''),
      fact,
    });
  }
  if (qualified.length === 0) return none('NO_QUALIFYING_REPORT', target.family);

  /* Any disagreement among fresh, trustworthy, extracted reports corroborates nothing. */
  const keys = new Set(qualified.map((q) => q.fact.key));
  if (keys.size > 1) return none('CONFLICTING_FACTS', target.family);

  /* Independence: domain, source identity, duplicate-like cluster — each pairwise distinct. */
  const clusterOf = new Map<string, number>();
  clusterArticlesWithMembership(qualified.map((q) => q.article)).forEach((cluster, i) => {
    for (const member of cluster.members) clusterOf.set(member.id, i);
  });
  const chosen: Qualified[] = [];
  for (const q of [...qualified].sort((a, b) => b.at - a.at)) {
    const cluster = clusterOf.get(q.article.id);
    const independent = chosen.every(
      (c) =>
        c.domain !== q.domain &&
        (c.source === undefined || q.source === undefined || c.source !== q.source) &&
        (cluster === undefined || clusterOf.get(c.article.id) !== cluster),
    );
    if (independent) chosen.push(q);
  }
  const first = chosen[0];
  if (first === undefined || chosen.length < input.minIndependentReports) {
    return {
      ...none('INSUFFICIENT_INDEPENDENT_REPORTS', target.family),
      qualifyingReports: chosen.length,
    };
  }
  return {
    corroborated: true,
    reason: 'CORROBORATED',
    family: target.family,
    fact: first.fact,
    qualifyingReports: chosen.length,
    /* The freshest corroborating report — never the model's generation time. */
    asOf: new Date(Math.max(...chosen.map((c) => c.at))).toISOString(),
    articleIds: chosen.map((c) => c.article.id),
  };
}
