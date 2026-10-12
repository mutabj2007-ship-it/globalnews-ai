/*
  RETRIEVAL R1 · WP6 — DETERMINISTIC ANSWER-COMPOSITION CHECKER (CTO R3B §5).

  Pure: (answer text, what the evidence establishes) → stable finding codes. No model, no provider,
  no I/O, no retry, no charge. It never rewrites, removes or reorders the answer: it only REPORTS, so
  it can never silently omit a valid finding or invent structure. What a caller does with a finding
  (record it, disclose it, withhold through the existing fail-closed path) is a separate, reviewed
  decision; this module has no side effects.

  Rules are conservative and lexical. A rule that needs facts about the evidence (which numbers it
  contains, which places are not established, whether a claim is disputed, how many independent
  reporting chains exist) is ACTIVE ONLY when the caller supplies that fact — absent context, the rule
  is silent rather than guessing.
*/

export type CompositionFinding =
  | 'UNATTRIBUTED_CASUALTY_FIGURE'
  | 'NUMBER_NOT_IN_EVIDENCE'
  | 'FIRST_REPORT_CLAIM'
  | 'CORROBORATION_OVER_SINGLE_CHAIN'
  | 'SCORE_OR_CONFIDENCE_MARKER'
  | 'BOLD_OVERUSE'
  | 'GEOGRAPHY_NOT_ESTABLISHED'
  | 'NEGATIVE_EVENT_ASSERTION'
  | 'URL_NOT_IN_EVIDENCE'
  | 'CITATION_NOT_IN_EVIDENCE'
  | 'UNCITED_BULLET'
  | 'DISPUTED_CLAIM_RESOLVED'
  | 'DESCRIPTIVE_NUMBER_AS_IMPACT'
  | 'UNVERIFIED_CAUSE_ASSERTED'
  | 'ALLEGATION_AS_FACT'
  | 'VOLUME_STATED_AS_PRICE'
  | 'STATEMENT_WITHOUT_OUTLET'
  | 'QUOTE_NOT_IN_EVIDENCE';

export interface CompositionContext {
  /** Every evidence id the answer may cite as `[ev-…]`. Enables CITATION_NOT_IN_EVIDENCE / UNCITED_BULLET. */
  readonly evidenceIds?: readonly string[];
  /** Every URL in the evidence. Enables URL_NOT_IN_EVIDENCE. */
  readonly evidenceUrls?: readonly string[];
  /** The evidence's own text (facts, titles, times) plus deterministic engine output. Enables NUMBER_NOT_IN_EVIDENCE and QUOTE_NOT_IN_EVIDENCE. */
  readonly evidenceText?: readonly string[];
  /** The reader's question: its own figures may be restated only where marked as not supported. */
  readonly questionText?: string;
  /** Independent reporting chains behind the answer (syndicated copies count once). */
  readonly independentChains?: number;
  /** Place names the evidence does NOT establish for this event. */
  readonly placesNotEstablished?: readonly string[];
  /** Coverage / rights hold or an unsupported language: no report checked ≠ no event. */
  readonly coverageHold?: boolean;
  /** Disputed details: every variant must be presented together, never one alone. */
  readonly disputed?: ReadonlyArray<{ readonly variants: readonly string[] }>;
  /** Numbers that describe the setting (market size), never an impact. */
  readonly descriptiveNumbers?: readonly string[];
  /** The cause is not established by the evidence. */
  readonly causeUnknown?: boolean;
  /** Terms naming an alleged actor / claim that may only appear attributed. */
  readonly allegationTerms?: readonly string[];
  /** The evidence reports volumes only, no prices. */
  readonly volumeOnly?: boolean;
  /** Publisher names in the evidence: an official's statement names the outlet that carried it. */
  readonly publishers?: readonly string[];
  /** Bullets must each carry a citation marker. */
  readonly requireCitedBullets?: boolean;
}

const ATTRIBUTION =
  /\b(?:according to|said|says|told|reported(?:ly)?|reports?|claim(?:s|ed)?|alleg(?:e|es|ed|edly|ations?)|sources?|per|cited|stated?|accused|denie[sd])\b/iu;
const CITATION = /\[(ev-[a-z0-9-]+)\]/giu;
const HAS_CITATION = /\[ev-[a-z0-9-]+\]/iu;
const CASUALTY =
  /\b(?:killed|dead|died|deaths?|wounded|injured|casualt(?:y|ies)|fatalit(?:y|ies)|victims?)\b/iu;
const NUMBER = /(?<![\w.:])\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|(?<![\w.:])\d+(?:\.\d+)?%?/gu;
const FIRST_REPORT =
  /\b(?:first (?:reported|to report|broke)|broke the (?:story|news)|was the first (?:outlet|source))\b/iu;
const CORROBORATION =
  /\b(?:several|multiple|many|numerous|various) (?:outlets|sources|media|reports|news organi[sz]ations)\b|\bwidely reported\b|\bindependently (?:confirmed|verified|reported)\b|\bcorroborated\b/iu;
const SCORE =
  /\b\d+(?:\.\d+)?\s*\/\s*10\b|\bconfidence(?:\s+(?:score|level))?\s*[:=]?\s*\d+(?:\.\d+)?\s*%|\b(?:score|rating)\s*[:=]\s*\d+|\b(?:high|medium|low) confidence\b/iu;
const NEGATIVE_EVENT =
  /\b(?:no (?:fire|attack|incident|event|ambush)\b|nothing happened|did not happen|there (?:was|were) no (?:fire|attack|incident)|no reports? (?:exist|of)|never happened)/iu;
/** A sentence that explicitly qualifies what it says as not established. */
const QUALIFIED =
  /\b(?:not (?:yet )?(?:supported|verified|established|confirmed|evidence|proof)|unverified|unsupported|does(?: not|n't) mean|cannot be confirmed)\b/iu;
const CAUSE =
  /\b(?:caused by|was due to|due to an?|started because|the cause was|sparked by|triggered by)\b/iu;
const IMPACT =
  /\b(?:lost|losses?|killed|dead|injured|wounded|affected|displaced|destroyed|damaged|victims?|casualt\w*)\b/iu;
const PRICE =
  /\b(?:price|prices|cost|costs|fare|fares|tariff|tariffs|inflation)\b[^.]{0,40}\b(?:rose|risen|rising|increased?|fell|fallen|dropped|declined?|went up|went down|jumped|surged)\b|\b(?:rose|increased|jumped|surged)\b[^.]{0,20}\b(?:price|prices|cost|costs|fares|tariffs)\b/iu;
const OFFICIAL =
  /\b(?:mayor|official|officials|police|minister|spokes(?:person|man|woman)|governor|army|military)\b/iu;
const SPOKE = /\b(?:said|says|told|stated|announced)\b/iu;
const URL = /https?:\/\/[^\s)\]>|]+/giu;
/** A quoted span in straight, curly, guillemet or low-high quotes (one line). */
const QUOTED = /["“”«»„]([^"“”«»„\n]{3,}?)["“”«»„]/gu;
const normQuote = (text: string) =>
  text.replace(/[‘’]/gu, "'").replace(/\s+/gu, ' ').trim().toLowerCase();

const stripMarkup = (text: string) => text.replace(/\*\*/gu, '').replace(/`/gu, '');
const normNumber = (n: string) => n.replace(/,/gu, '').replace(/%$/u, '');
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

function sentencesOf(text: string): string[] {
  return text
    .split(/\n+/u)
    .flatMap((line) =>
      line.replace(/^\s*(?:[-*+]|\d+[.)]|#{1,6})\s+/u, '').split(/(?<=[.!?])\s+(?=[A-Z"“(\[])/u),
    )
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function wordsOf(text: string): number {
  return stripMarkup(text)
    .split(/\s+/u)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function assessAnswerComposition(
  answer: string,
  ctx: CompositionContext = {},
): CompositionFinding[] {
  const found = new Set<CompositionFinding>();
  const plain = stripMarkup(answer);
  const sentences = sentencesOf(answer).map(stripMarkup);

  /* Every precise casualty count is attributed. */
  for (const s of sentences) {
    if (CASUALTY.test(s) && /\d/u.test(s.replace(CITATION, '')) && !ATTRIBUTION.test(s))
      found.add('UNATTRIBUTED_CASUALTY_FIGURE');
  }

  /* Every number appears in the evidence or the engine output (years and list markers excluded).
     A figure from the reader's own question may be restated only in a sentence that marks it as
     not supported / unverified (a premise check), never as a finding. */
  if (ctx.evidenceText !== undefined) {
    const known = new Set((ctx.evidenceText.join(' \n ').match(NUMBER) ?? []).map(normNumber));
    const asked = new Set((ctx.questionText?.match(NUMBER) ?? []).map(normNumber));
    for (const s of sentences) {
      const body = s.replace(CITATION, '').replace(URL, '');
      for (const raw of body.match(NUMBER) ?? []) {
        const n = normNumber(raw);
        if (/^(?:19|20)\d{2}$/u.test(n) || known.has(n)) continue;
        if (asked.has(n) && QUALIFIED.test(s)) continue;
        found.add('NUMBER_NOT_IN_EVIDENCE');
      }
    }
  }

  /* A quotation is exact or it is not a quotation: every quoted span of three or more words must
     appear verbatim in the evidence text (case, apostrophe style and spacing aside). Paraphrase is
     fine; an invented or reworded quotation is not. */
  if (ctx.evidenceText !== undefined) {
    const evidence = normQuote(ctx.evidenceText.join(' \n '));
    for (const m of plain.replace(CITATION, '').matchAll(QUOTED)) {
      const span = normQuote(m[1] ?? '');
      if (span.split(' ').length >= 3 && !evidence.includes(span))
        found.add('QUOTE_NOT_IN_EVIDENCE');
    }
  }

  if (FIRST_REPORT.test(plain)) found.add('FIRST_REPORT_CLAIM');
  if (
    ctx.independentChains !== undefined &&
    ctx.independentChains <= 1 &&
    CORROBORATION.test(plain)
  )
    found.add('CORROBORATION_OVER_SINGLE_CHAIN');
  if (SCORE.test(plain)) found.add('SCORE_OR_CONFIDENCE_MARKER');

  /* Selective emphasis: at most 6 bold spans per 100 words (floor 2), no bold span over 12 words. */
  const bold = [...answer.matchAll(/\*\*([^*]+)\*\*/gu)].map((m) => m[1] ?? '');
  const words = Math.max(1, wordsOf(answer));
  if (bold.length > Math.max(2, (6 * words) / 100) || bold.some((b) => wordsOf(b) > 12))
    found.add('BOLD_OVERUSE');

  for (const place of ctx.placesNotEstablished ?? []) {
    /* "Republic of the Congo" never matches inside "Democratic Republic of the Congo" */
    if (new RegExp(`(?<!democratic\\s)\\b${escapeRegExp(place)}\\b`, 'iu').test(plain))
      found.add('GEOGRAPHY_NOT_ESTABLISHED');
  }
  if (
    ctx.coverageHold === true &&
    sentences.some((s) => NEGATIVE_EVENT.test(s) && !QUALIFIED.test(s))
  )
    found.add('NEGATIVE_EVENT_ASSERTION');

  if (ctx.evidenceUrls !== undefined) {
    for (const url of plain.match(URL) ?? [])
      if (!ctx.evidenceUrls.includes(url.replace(/[.,;]+$/u, ''))) found.add('URL_NOT_IN_EVIDENCE');
  }
  if (ctx.evidenceIds !== undefined) {
    for (const m of answer.matchAll(CITATION))
      if (!ctx.evidenceIds.includes(m[1] ?? '')) found.add('CITATION_NOT_IN_EVIDENCE');
    if (ctx.requireCitedBullets === true) {
      for (const line of answer.split(/\n/u)) {
        if (/^\s*[-*+]\s+/u.test(line) && !HAS_CITATION.test(line)) found.add('UNCITED_BULLET');
      }
    }
  }

  const lower = plain.toLowerCase();
  for (const { variants } of ctx.disputed ?? []) {
    if (variants.filter((v) => lower.includes(v.toLowerCase())).length === 1)
      found.add('DISPUTED_CLAIM_RESOLVED');
  }
  for (const s of sentences) {
    const sLower = s.toLowerCase();
    if ((ctx.descriptiveNumbers ?? []).some((n) => s.includes(n)) && IMPACT.test(s))
      found.add('DESCRIPTIVE_NUMBER_AS_IMPACT');
    if (ctx.causeUnknown === true && CAUSE.test(s) && !ATTRIBUTION.test(s) && !QUALIFIED.test(s))
      found.add('UNVERIFIED_CAUSE_ASSERTED');
    if (
      (ctx.allegationTerms ?? []).some((t) => sLower.includes(t.toLowerCase())) &&
      !ATTRIBUTION.test(s)
    )
      found.add('ALLEGATION_AS_FACT');
    if (
      ctx.publishers !== undefined &&
      OFFICIAL.test(s) &&
      SPOKE.test(s) &&
      !HAS_CITATION.test(s) &&
      !ctx.publishers.some((p) => sLower.includes(p.toLowerCase()))
    )
      found.add('STATEMENT_WITHOUT_OUTLET');
    if (
      ctx.volumeOnly === true &&
      PRICE.test(s) &&
      !/\b(?:not|no|does not|doesn't|unrelated)\b/iu.test(s)
    )
      found.add('VOLUME_STATED_AS_PRICE');
  }
  return [...found].sort();
}
