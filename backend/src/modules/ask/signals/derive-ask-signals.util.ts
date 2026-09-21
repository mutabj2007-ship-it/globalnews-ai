import { resolveCountryByAnyIdentifier, type AskContext } from '@globalnews-ai/shared';
import { detectRequestedDomains } from '../../analysis/query/detect-analytical-domains.util';
import type { ComputeClassificationInput } from '../../compute/classification/classify-compute.util';

/**
 * BETA-SIMPLE-ASK-SAND-1 §5/§20 — turns one Ask question into the
 * deterministic planning signals the classifier runs on.
 *
 * §20: "A clever prompt must not bypass compute classification. The
 * backend determines that a request qualifies as Deep Analysis even
 * if entered through ordinary Ask."
 *
 * This file is where that determination gets its inputs, and the
 * design constraint is that it must be:
 *
 *   - DETERMINISTIC — the same question always produces the same
 *     signals, so a user cannot re-roll a cheaper price by asking
 *     again;
 *   - FREE — no model call. Spending AI quota to decide whether to
 *     spend AI quota would defeat §31's stated goal;
 *   - REUSING EXISTING REPOSITORY LOGIC — it calls
 *     detectRequestedDomains() (the analysis module's own domain
 *     detector) and resolveCountryByAnyIdentifier() (shared's own
 *     country resolver) rather than introducing a second, separately-
 *     evolving notion of "what domains is this about" or "what
 *     country is this". §25's discipline about not rewriting
 *     retrieval-adjacent logic applies here too.
 */

/**
 * Words that introduce an explicit multi-region scope. Kept small and
 * literal — this is a cost-classification heuristic, not a geography
 * engine, and the country resolver above does the real work.
 *
 * A regional phrase counts as multiple countries because retrieval for
 * "across East Africa" genuinely fans out per country, which is the
 * cost §5 is trying to capture. The value is deliberately set at the
 * DEEP_ANALYSIS country threshold rather than an invented larger
 * number: a regional question is at least multi-country, and claiming
 * to know precisely how many would be false precision.
 */
const REGIONAL_SCOPE_PATTERN =
  /\b(?:across|throughout|region|regional|worldwide|globally|global|continent|africa|europe|asia|americas|middle east|sub-saharan|east africa|west africa|north africa|southern africa|eu|asean|g7|g20|nato|opec)\b/i;

/** Weight a regional phrase contributes, in "countries". */
const REGIONAL_SCOPE_COUNTRY_WEIGHT = 3;

/**
 * Phrases that explicitly request a long-form report rather than an
 * answer. These map to RESEARCH_REPORT, the largest workload in §5's
 * model.
 */
const REPORT_REQUEST_PATTERN =
  /\b(?:full report|research report|write (?:me )?a report|comprehensive report|detailed report|produce a report|generate a report|white ?paper|dossier)\b/i;

/**
 * Phrases that explicitly request deep/exhaustive analysis through
 * ordinary Ask — §20's central case.
 */
const DEEP_ANALYSIS_REQUEST_PATTERN =
  /\b(?:deep (?:analysis|dive)|in-depth analysis|exhaustive|comprehensive analysis|thorough analysis|full analysis|analyse in detail|analyze in detail)\b/i;

/**
 * Phrases requesting long history. Converted to a day count so the
 * classifier's single time-window rule handles them, rather than
 * adding a parallel "is historical" flag it would also have to weigh.
 */
const HISTORICAL_PATTERNS: readonly { pattern: RegExp; days: number }[] = [
  { pattern: /\b(?:last|past|previous)\s+(\d{1,2})\s+years?\b/i, days: 365 },
  { pattern: /\b(?:last|past|previous)\s+(\d{1,3})\s+months?\b/i, days: 30 },
  { pattern: /\b(?:last|past|previous)\s+(\d{1,4})\s+days?\b/i, days: 1 },
  { pattern: /\b(?:since|from)\s+(?:19|20)\d{2}\b/i, days: 365 },
  { pattern: /\b(?:historically|over the decades?|long[- ]term trend)\b/i, days: 365 * 3 },
];

/**
 * Maximum tokens scanned for country names.
 *
 * Bounded because this runs on every Ask turn and the question can be
 * up to 1000 characters (AnalyzeNewsDto's @MaxLength). An unbounded
 * scan over a long question with a large country table is a
 * per-request cost on the hot path, and the cap is generous enough
 * that no realistic question loses a country from it.
 */
const MAX_SCANNED_TOKENS = 120;

/** ISO-style ALL-CAPS tokens, matching AnalysisService's own existing convention. */
const ALL_CAPS_CODE_TOKEN_PATTERN = /\b[A-Z]{2,3}\b/g;

export interface AskSignalInput {
  /** The normalized question text. */
  normalizedQuestion: string;
  /** §4 — context carried in from the originating surface. */
  context?: AskContext;
  /** True when the caller pressed an explicit Deep Analysis action. */
  explicitDeepAnalysisAction?: boolean;
}

export type AskSignals = Omit<ComputeClassificationInput, 'kind' | 'storedResultAvailable'>;

/**
 * Counts the distinct real countries a question refers to.
 *
 * Deliberately conservative about bare country NAMES, reusing the
 * reasoning AnalysisService already documents: several real country
 * names (Georgia, Turkey, Chad, Jordan) are also ordinary
 * nouns/proper nouns, so a false positive is easy. Here the stakes of
 * a false positive are specific — it could escalate an ordinary
 * question into a priced Deep Analysis — so the scan requires either
 * an exact ISO-style ALL-CAPS code or a capitalized token that
 * resolves to a real country.
 */
function countDistinctCountries(text: string, context?: AskContext): number {
  const found = new Set<string>();

  if (context?.countryCode) {
    const resolved = resolveCountryByAnyIdentifier(context.countryCode);
    if (resolved) found.add(resolved.iso2);
  }

  const tokens = text.split(/\s+/).slice(0, MAX_SCANNED_TOKENS);

  for (const rawToken of tokens) {
    // Strip surrounding punctuation but keep internal hyphens/apostrophes.
    const token = rawToken.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (token.length < 2) continue;

    const isAllCapsCode =
      token.length <= 3 && token === token.toUpperCase() && /^[A-Z]{2,3}$/.test(token);
    const isCapitalized = /^\p{Lu}/u.test(token);

    if (!isAllCapsCode && !isCapitalized) continue;

    const resolved = resolveCountryByAnyIdentifier(token);
    if (resolved) found.add(resolved.iso2);
  }

  // Multi-word country names ("United Arab Emirates", "Democratic
  // Republic of the Congo") never appear as a single token, so the
  // whole string is offered to the resolver as well. This cannot
  // double-count: results go into the same Set, keyed by ISO code.
  const whole = resolveCountryByAnyIdentifier(text);
  if (whole) found.add(whole.iso2);

  let count = found.size;

  if (REGIONAL_SCOPE_PATTERN.test(text)) {
    // A regional phrase means at least multi-country retrieval,
    // whether or not individual countries were named.
    count = Math.max(count, REGIONAL_SCOPE_COUNTRY_WEIGHT);
  }

  // A question with no detectable geography is still one question
  // about something; treating it as 0 countries would let the
  // combined-signal rule read "narrow" when it is simply unresolved.
  return Math.max(count, 1);
}

/** Extracts an explicit history request as a day count, when present. */
function detectTimeWindowDays(text: string, context?: AskContext): number | undefined {
  let maxDays: number | undefined;

  for (const { pattern, days } of HISTORICAL_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;

    const quantity = match[1] ? Number(match[1]) : 1;
    const total = Number.isFinite(quantity) && quantity > 0 ? quantity * days : days;
    maxDays = Math.max(maxDays ?? 0, total);
  }

  // An explicit context window (e.g. '7d' from a category surface)
  // never ESCALATES beyond what the question itself asks for — it is
  // a UI filter, not a request for historical synthesis — so it is
  // only used when the question named no window of its own.
  if (maxDays === undefined && context?.timeWindow) {
    const match = /^(\d{1,4})d$/i.exec(context.timeWindow);
    if (match) return Number(match[1]);
  }

  return maxDays;
}

/**
 * Derives every planning signal for one Ask turn.
 *
 * `contextualOnly` is deliberately always false here. A contextual
 * answer is one that needs no fresh retrieval, and whether that is
 * true is a property of what the retrieval layer finds, not of the
 * question's wording — claiming it from text alone would let a
 * plausible-sounding question skip retrieval entirely. The category
 * surfaces set it explicitly (§17), because there the caller genuinely
 * knows it is rendering stored intelligence.
 */
export function deriveAskSignals(input: AskSignalInput): AskSignals {
  const text = input.normalizedQuestion;

  const domains = detectRequestedDomains(text);
  const distinctDomains = new Set(domains.map((occurrence) => occurrence.domain));

  return {
    contextualOnly: false,
    countryCount: countDistinctCountries(text, input.context),
    // As with countries, a question always concerns at least one
    // subject area even when the detector recognizes none.
    domainCount: Math.max(distinctDomains.size, 1),
    requestedTimeWindowDays: detectTimeWindowDays(text, input.context),
    explicitDeepAnalysisRequest:
      input.explicitDeepAnalysisAction === true || DEEP_ANALYSIS_REQUEST_PATTERN.test(text),
    explicitReportRequest: REPORT_REQUEST_PATTERN.test(text),
  };
}

/** Exported for tests and for Admin diagnostics of a surprising classification. */
export const ASK_SIGNAL_PATTERNS = {
  regionalScope: REGIONAL_SCOPE_PATTERN,
  reportRequest: REPORT_REQUEST_PATTERN,
  deepAnalysisRequest: DEEP_ANALYSIS_REQUEST_PATTERN,
  allCapsCodeToken: ALL_CAPS_CODE_TOKEN_PATTERN,
} as const;
