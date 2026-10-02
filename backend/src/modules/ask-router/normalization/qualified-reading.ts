/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE C — THE QUALIFIED-READING BOUNDARY (L)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Port of L's `normalization-boundary.reference.mts` (R1 + RESIDUAL ADDENDUM, C-1 / C-2 /
 * C-3' ON) into production form. Contract §4:
 *
 *   - sourceLanguage / normalizationLanguage / displayLanguage stay distinct;
 *   - the reading preserves entities, geography, dates, numbers, negation, topic,
 *     analytical domains, relations, stated periods and currentness;
 *   - it does NOT manufacture router output, route, intent or a confidence band — the
 *     type has no such field (L N-1), and a spec asserts it at run time.
 *
 * WHAT CHANGED FROM L'S REFERENCE, AND WHY
 *
 *   1. L's reference fed `routeAskQuestion` (ask-route.contract.ts). That router is NOT on
 *      the release line (it exists only on snapshot 3db5a09), and contract §1 makes frozen
 *      C the one routing authority. So `routeWithReading` is not ported, and neither are
 *      the EN shape readings L EXTRACTED FROM THAT ROUTER'S SOURCE TEXT (definition, event,
 *      analytical, follow-up, open-information): frozen C consumes none of them, and
 *      re-typing another router's patterns here would be the second router §1 forbids.
 *      The reading reaches frozen C through `envelope-source.ts`.
 *   2. The frozen time axis is bound to G's accepted producer C (`detectStatedPeriod`),
 *      with its PL mirror, as `statedTime`. L's `dates`/`periods` stay as L read them;
 *      they drive currentness and the C-1 defeaters exactly as before.
 *   3. G's reader-topic category (producer B) is carried as `readerCategory`, with its PL
 *      mirror, because the frozen topic axis takes the category the reader NAMED.
 *   4. QQ-10: the reading carries the language-independent `subject` reading G's
 *      eligibility rule consumes (see `semantic-subject.ts`).
 *   5. C-3' settlement forms are built from the landed gazetteer module rather than by
 *      re-reading its JSON file.
 *   6. GATE H (Main R1.1 MC-052, MC-069), two residuals at the geography boundary:
 *      a token already read as a stated date is not also a place ("August 2026" is not
 *      Augusta, USA), and an unqualified ambiguous country name ("Congo") is CONTESTED
 *      through the landed `detectAmbiguousCountryMention`, never the resolver's pick.
 *
 * Everything else — resources, whole-token matching, provenance values, loss detection,
 * failure states, the C-1/C-2/C-3' corrections — is L's, unchanged in meaning.
 */

import {
  detectRequestedDomains,
  type AnalyticalDomain,
} from '../../analysis/query/detect-analytical-domains.util';
import { classifyQueryIntent } from '../../analysis/query/query-intent.util';
import { resolvePolishCountry } from '../../analysis/query/polish-country-forms.util';
import { resolveGeography } from '../../geo/geo-resolver';
import { detectAmbiguousCountryMention } from '../../analysis/anchor/event-anchor.util';
import { resolveCountriesByDemonym } from '../../news/country/country-relevance.util';
import { resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import { allCities, allExonyms } from '../../geo/geo-gazetteer';
import { detectStatedPeriod } from '../../analysis/context-producers/stated-period.producer';
import { detectReaderTopic } from '../../analysis/context-producers/reader-topic.producer';
import type { SubjectReading } from '../../analysis/context-producers/addendum.contract';
import {
  EN_FALLBACK_PERIOD_RULES,
  PL_CATEGORY_FORMS,
  PL_CHANGE,
  PL_COMPARISON,
  PL_CURRENT,
  PL_DATEWORD,
  PL_DOMAIN_FORMS,
  PL_FALLBACK_PERIOD_RULES,
  PL_MONTHS,
  PL_NEGATION,
  PL_OFFICE_CONSTRUCTION,
  PL_PERIOD_HEADS,
  PL_PERIOD_RULES,
  PL_STANCE,
} from './pl-readings.resources';
import { readSemanticSubject } from './semantic-subject';

/* ── 1 · THE THREE LANGUAGE AXES ─────────────────────────────────────────── */

export type LanguageCode = 'en' | 'pl' | 'sw' | 'fr' | 'es' | 'ar' | 'rw';

/** Languages whose READINGS RESOURCES exist. Not a public-support claim. */
export const READABLE_LANGUAGES: readonly LanguageCode[] = ['en', 'pl'];

export type AskOrigin = 'ASK' | 'MAP' | 'ANALYSIS';

export interface NormalizationRequest {
  /** EXACT user text. Never rewritten, never translated, never normalized in place. */
  readonly originalQuestion: string;
  /** The language the question was ASKED in. */
  readonly sourceLanguage: LanguageCode;
  /** The language whose readings resources are used to read it. */
  readonly normalizationLanguage: LanguageCode;
  /** The language the answer will be RENDERED in. */
  readonly displayLanguage: LanguageCode;
  readonly origin: AskOrigin;
  /**
   * Countries (ISO3) SUPPLIED BY THE ORIGINATING SURFACE (the map). Never invented here,
   * and never confused with geography read from the text: provenance SUPPLIED_BY_SURFACE.
   */
  readonly originCountries?: readonly string[];
}

/* ── 2 · THE QUALIFIED NORMALIZED SEMANTIC REPRESENTATION ────────────────── */

export type ReadingProvenance =
  'SURFACE_FORM_SET' | 'LEXICON_WHOLE_TOKEN' | 'CANONICAL_RESOLVER' | 'SUPPLIED_BY_SURFACE';
/* There is deliberately no SUBSTRING provenance (L): a coincidence cannot be represented
   in this type, so it cannot be produced. */

export interface ReadingElement<T> {
  readonly value: T;
  readonly matchedText?: string;
  readonly provenance: ReadingProvenance;
  /** Which resource produced it — language-keyed, never an English array. */
  readonly source: string;
}

export type CurrentnessReading = 'CURRENT' | 'PERIOD_STATED' | 'DATE_STATED' | 'STANDING';

/** The period the reader stated, at their own precision (G producer C, and its PL mirror). */
export interface StatedTimeReading {
  /** Verbatim span of the normalized question. Never resolved against a clock. */
  readonly statedPeriod: string;
  readonly anchor: 'ABSOLUTE' | 'RELATIVE_TO_ASK';
  readonly source: string;
}

export type DefinitionDefeater =
  'DATE_STATED' | 'PERIOD_STATED' | 'QUANTITATIVE_CHANGE' | 'INSTITUTIONAL_POSITION';

export interface QualifiedReading {
  readonly originalQuestion: string;
  readonly sourceLanguage: LanguageCode;
  readonly normalizationLanguage: LanguageCode;
  readonly displayLanguage: LanguageCode;

  readonly entities: readonly ReadingElement<string>[];
  readonly geography: readonly ReadingElement<string>[];
  readonly dates: readonly ReadingElement<string>[];
  readonly periods: readonly ReadingElement<string>[];
  readonly statedTime?: StatedTimeReading;
  readonly numbers: readonly ReadingElement<string>[];
  readonly negation: readonly ReadingElement<string>[];
  readonly topic?: ReadingElement<string>;
  /** The news category the reader NAMED (G producer B), as its EN category key. */
  readonly readerCategory?: ReadingElement<string>;
  readonly domains: readonly ReadingElement<AnalyticalDomain>[];
  readonly relations: readonly ReadingElement<'COMPARISON' | 'CAUSE' | 'TREND'>[];
  readonly currentness: ReadingElement<CurrentnessReading>;
  /** QQ-10: the question's subject, as a MEANING (never as an article). */
  readonly subject: SubjectReading;
  /** Shape readings frozen C's inputs need. NOT an intent, NOT a route. */
  readonly shape: {
    /** A current-office construction ("who is the president of X", "kto jest prezydentem"). */
    readonly officeConstruction: boolean;
    readonly officeTerm?: string;
    /** A currency marker is present ("latest", "dzisiaj"). */
    readonly currencyMarker: boolean;
    /** R1-RESIDUAL C-1: a number stated with a change term. */
    readonly quantitativeChange: boolean;
    /** R1-RESIDUAL C-1: a stance asked of a named institution. */
    readonly institutionalPosition: boolean;
  };
  /** R1-RESIDUAL C-1: the readings that defeat a stable-definition reading. */
  readonly defeaters: readonly DefinitionDefeater[];
}

/* ── 3 · FAILURE STATES ──────────────────────────────────────────────────── */

export type NormalizationFailure =
  | 'LANGUAGE_NOT_READABLE'
  | 'NO_READABLE_CONTENT'
  | 'LOAD_BEARING_LOSS'
  | 'LANGUAGE_DECLARATION_CONFLICT';

export type LossKind =
  'NEGATION' | 'NUMBER' | 'DATE' | 'PERIOD' | 'ENTITY' | 'GEOGRAPHY' | 'DOMAIN' | 'RELATION';

export const LOAD_BEARING_LOSSES: readonly LossKind[] = [
  'NEGATION',
  'NUMBER',
  'DATE',
  'PERIOD',
  'ENTITY',
  'GEOGRAPHY',
];

export interface ReadingLoss {
  readonly kind: LossKind;
  readonly detectedText: string;
  readonly why: string;
}

export type NormalizationOutcome =
  | {
      readonly status: 'QUALIFIED';
      readonly reading: QualifiedReading;
      readonly losses: readonly [];
    }
  | {
      readonly status: 'DEGRADED';
      readonly reading: QualifiedReading;
      readonly losses: readonly ReadingLoss[];
    }
  | {
      readonly status: 'NOT_READ';
      readonly failure: NormalizationFailure;
      readonly losses: readonly ReadingLoss[];
    };

/* ── 4 · C-3' — SUB-NATIONAL POLISH SURFACE FORMS, ADJECTIVAL ONLY ──────────
   L's measured correction: oblique CASE forms of settlement names collide with ordinary
   nouns ("Granica" is a village and the word for border), so only adjectival forms are
   generated. Built forward from names canonical already holds. */

const MIN_SETTLEMENT_FORM = 4;
const SETTLEMENT_ADJECTIVAL_SUFFIXES = [
  'ski',
  'ska',
  'skie',
  'skim',
  'skiej',
  'skiego',
  'skich',
  'skimi',
];

function polishSettlementForms(base: string): string[] {
  const b = base.toLowerCase();
  const stem = b.endsWith('a') ? b.slice(0, -1) : b;
  const out = new Set<string>();
  for (const suf of SETTLEMENT_ADJECTIVAL_SUFFIXES) out.add(stem + suf);
  return [...out].filter((f) => f.length >= MIN_SETTLEMENT_FORM);
}

let settlementIndex: ReadonlyMap<string, string> | undefined;

/** Polish settlement bases held by canonical (gazetteer cities + exonym map), cc PL. */
export function polishSettlementBases(): ReadonlySet<string> {
  const bases = new Set<string>();
  for (const c of allCities()) if (c.cc === 'PL') bases.add(c.n);
  for (const e of allExonyms()) if (e.cc === 'PL') bases.add(e.x);
  return bases;
}

export function polishSettlementIndex(): ReadonlyMap<string, string> {
  if (settlementIndex === undefined) {
    const index = new Map<string, string>();
    for (const b of polishSettlementBases()) {
      for (const f of polishSettlementForms(b)) index.set(f, 'POL');
    }
    settlementIndex = index;
  }
  return settlementIndex;
}

/* ── 5 · MATCHING · WHOLE TOKEN ONLY ─────────────────────────────────────── */

/** Unicode-aware tokenizer. `\b` is ASCII-based in JS and is deliberately unused. */
export function tokens(text: string): readonly string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+(?:[.,][\p{N}]+)*/gu) ?? [];
}

function hasToken(toks: readonly string[], set: readonly string[]): string | undefined {
  for (const t of toks) if (set.includes(t)) return t;
  return undefined;
}

const el = <T>(
  value: T,
  matchedText: string | undefined,
  provenance: ReadingProvenance,
  source: string,
): ReadingElement<T> =>
  matchedText === undefined
    ? { value, provenance, source }
    : { value, matchedText, provenance, source };

/* ── 6 · ENGLISH RESOURCES L'S READING OWNS (not another router's) ───────── */

const EN_DATE = [
  /\byesterday\b/i,
  /\blast\s+night\b/i,
  /\btomorrow\b/i,
  /\bon\s+\d{1,2}\s+\w+\s+\d{4}\b/i,
  /\bin\s+(?:19|20)\d{2}\b/i,
  /\bnext\s+week\b/i,
];
const EN_PERIOD = [
  /\b(?:in\s+the\s+)?last\s+\w+\s+(?:days?|weeks?|months?|years?|quarters?)\b/i,
  /\bsince\s+\w+/i,
  /\bover\s+the\s+past\b/i,
];
const EN_NEGATION =
  /\b(?:not|never|no|without|neither|nor|didn't|did\s+not|has\s+not|have\s+not)\b/i;
const EN_COMPARISON = /\bcompare\b|\bversus\b|\bvs\.?\b|\bdifference\s+between\b/i;
const EN_CURRENT = /\b(?:today|right\s+now|now|currently|latest|newest|current)\b/i;
const EN_OFFICE =
  /\bwho\s+is\s+(?:the\s+)?(?:current\s+)?(president|prime\s+minister|minister|chair(?:man|person)?)\b/i;
const EN_CHANGE = [
  'change',
  'changes',
  'changed',
  'increase',
  'increased',
  'decrease',
  'decreased',
  'rise',
  'risen',
  'rose',
  'fall',
  'fell',
  'fallen',
  'growth',
  'grew',
  'decline',
  'declined',
  'shift',
  'swing',
  'drop',
  'dropped',
];
const EN_STANCE = ['position', 'stance', 'view', 'views', 'policy', 'response', 'reaction', 'line'];

/** G producer C's normalization, so a PL span is a span of the same normalized text. */
/*
  TRUST & CONVERSATIONAL EXPERIENCE R1 — "Who was Napoleon?" was read as Napoleon, Ohio (USA): a
  person frame ("who was / who is / who were <Name>") names a PERSON. Only a sub-country match
  (a town or province, never a country) that sits exactly in the name slot of that frame is
  dropped; "Who is the president of Kenya?" (a country, not the name slot) is untouched.
*/
const PERSON_FRAME = /^\s*(?:who\s+(?:was|is|were|are)|kim\s+(?:by[łl]|jest|s[ąa]))\s+(.+?)\s*[?.!]*\s*$/iu;
function isPersonFrameTown(
  text: string,
  geo: { readonly precision: string; readonly matchedText?: string },
): boolean {
  if (geo.precision === 'COUNTRY' || geo.matchedText === undefined) return false;
  const slot = PERSON_FRAME.exec(text)?.[1];
  if (slot === undefined) return false;
  const name = slot.replace(/^(?:the|a|an)\s+/i, '').toLowerCase();
  return name.startsWith(geo.matchedText.toLowerCase());
}

function normalizeForPeriod(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readStatedTime(text: string, pl: boolean): StatedTimeReading | undefined {
  if (!pl) {
    const g = detectStatedPeriod(text);
    if (g !== null)
      return { statedPeriod: g.statedPeriod, anchor: g.anchor, source: 'G:detectStatedPeriod' };
  } else {
    const normalized = normalizeForPeriod(text);
    for (const rule of PL_PERIOD_RULES) {
      const m = rule.pattern.exec(normalized);
      if (m !== null)
        return {
          statedPeriod: m[0],
          anchor: rule.anchor,
          source: `PL_PERIOD_RULES(${rule.mirrors})`,
        };
    }
  }
  const normalized = normalizeForPeriod(text);
  for (const rule of pl ? PL_FALLBACK_PERIOD_RULES : EN_FALLBACK_PERIOD_RULES) {
    const m = rule.pattern.exec(normalized);
    if (m !== null) {
      return {
        statedPeriod: m[0].trim(),
        anchor: rule.anchor,
        source: `${pl ? 'PL' : 'EN'}_FALLBACK_PERIOD_RULES(${rule.mirrors})`,
      };
    }
  }
  return undefined;
}

function readCategory(
  text: string,
  toks: readonly string[],
  pl: boolean,
): ReadingElement<string> | undefined {
  if (!pl) {
    const topic = detectReaderTopic(text);
    return topic.categoryTerm === undefined
      ? undefined
      : el(topic.categoryTerm, topic.categoryTerm, 'LEXICON_WHOLE_TOKEN', 'G:detectReaderTopic');
  }
  for (const [key, forms] of Object.entries(PL_CATEGORY_FORMS)) {
    const h = hasToken(toks, forms);
    if (h !== undefined) return el(key, h, 'SURFACE_FORM_SET', 'PL_CATEGORY_FORMS');
  }
  return undefined;
}

/* ── 7 · THE BOUNDARY ────────────────────────────────────────────────────── */

export function normalizeAskQuestion(req: NormalizationRequest): NormalizationOutcome {
  const text = req.originalQuestion.trim();
  const losses: ReadingLoss[] = [];

  if (text.length === 0) return { status: 'NOT_READ', failure: 'NO_READABLE_CONTENT', losses: [] };
  if (!READABLE_LANGUAGES.includes(req.sourceLanguage)) {
    return { status: 'NOT_READ', failure: 'LANGUAGE_NOT_READABLE', losses: [] };
  }
  if (req.normalizationLanguage !== req.sourceLanguage) {
    return { status: 'NOT_READ', failure: 'LANGUAGE_DECLARATION_CONFLICT', losses: [] };
  }

  const pl = req.sourceLanguage === 'pl';
  const toks = tokens(text);

  /* GATE H (Main MC-078) — "no signal" and "a news topic" must stop being the same output.
     A question written in another language than the one declared is not read as if it were
     the declared one (it resolved "Lage" to a German city and answered from news). */
  const declaredWords = toks.filter((t) => (pl ? PL_FUNCTION_WORDS : EN_FUNCTION_WORDS).has(t));
  const foreignWords = toks.filter((t) => FOREIGN_FUNCTION_WORDS.has(t));
  if (foreignWords.length >= 2 && foreignWords.length > declaredWords.length) {
    return { status: 'NOT_READ', failure: 'LANGUAGE_DECLARATION_CONFLICT', losses: [] };
  }

  /* domains — language-keyed, whole token, provenance-carrying */
  const domains: ReadingElement<AnalyticalDomain>[] = [];
  if (pl) {
    for (const [domain, forms] of Object.entries(PL_DOMAIN_FORMS) as [
      AnalyticalDomain,
      Readonly<Record<string, readonly string[]>>,
    ][]) {
      let found: string | undefined;
      for (const set of Object.values(forms)) {
        const h = hasToken(toks, set);
        if (h !== undefined) {
          found = h;
          break;
        }
      }
      if (found !== undefined)
        domains.push(el(domain, found, 'SURFACE_FORM_SET', 'PL_DOMAIN_FORMS'));
    }
  } else {
    for (const d of detectRequestedDomains(text)) {
      domains.push(el(d.domain, undefined, 'CANONICAL_RESOLVER', 'detectRequestedDomains'));
    }
  }

  /* geography — surface-supplied first, then canonical resolvers only */
  const geography: ReadingElement<string>[] = [];
  for (const iso3 of req.originCountries ?? []) {
    geography.push(el(iso3, undefined, 'SUPPLIED_BY_SURFACE', `origin:${req.origin}`));
  }
  /* CANONICAL PARITY (L): called exactly as canonical calls it — no options. */
  const geo = resolveGeography(text);
  const readPlace = (iso3: string, matched: string | undefined, source: string): void => {
    if (!geography.some((g) => g.value === iso3 && g.provenance !== 'SUPPLIED_BY_SURFACE')) {
      geography.push(el(iso3, matched, 'CANONICAL_RESOLVER', source));
    }
  };
  if (geo.provenance === 'CONTESTED') {
    /* R1-RESIDUAL C-2 — several countries named and none is the subject is MULTI_ENTITY,
       every member determinable; only a genuine ambiguity is CONTESTED. */
    const multiplicity = geo.reason === 'COUNTRY_ONLY' && geo.candidates.length >= 2;
    if (multiplicity) {
      for (const p of geo.candidates)
        readPlace(p.country.iso3, geo.matchedText, 'resolveGeography:MULTI_ENTITY (C-2)');
    } else {
      geography.push(
        el('CONTESTED', geo.matchedText, 'CANONICAL_RESOLVER', 'resolveGeography:CONTESTED'),
      );
    }
  } else if (geo.precision !== 'UNKNOWN' && !isPersonFrameTown(text, geo)) {
    const chosen = geo.place ? [geo.place] : geo.candidates;
    /* GATE H (G V4-C1/V4-C4) — a demonym ("Rwandan") is ENTITY geography, provenance-
       distinct from a typed place; the landed demonym resolver is the producer. */
    const demonym =
      geo.matchedText !== undefined && resolveCountriesByDemonym(geo.matchedText).length > 0;
    for (const p of chosen)
      readPlace(p.country.iso3, geo.matchedText, demonym ? DEMONYM_SOURCE : 'resolveGeography');
  } else if (!pl) {
    /* GATE H (G V2-C1) — the canonical resolver treats capitalisation as evidence, so
       "security developments in kenya" named nothing on /ask while the Map dock (the landed
       COUNTRY_CONTEXT_PATTERN) read Kenya. Same pattern here: a governed country NAME after a
       place preposition, never an ISO code ("in it", "in us") and never a lowercase
       homograph ("in turkey"). */
    const m =
      /\b(?:in|from|about|across|inside|within)\s+((?:the\s+)?[a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,2})/i.exec(
        text,
      );
    const words =
      m?.[1]
        ?.toLowerCase()
        .replace(/^the\s+/, '')
        .split(/\s+/) ?? [];
    for (let k = words.length; k >= 1; k -= 1) {
      const candidate = words.slice(0, k).join(' ');
      if (candidate.length < 4 || LOWERCASE_HOMOGRAPHS.has(candidate)) continue;
      const c = resolveCountryByAnyIdentifier(candidate);
      if (
        c !== undefined &&
        candidate.toUpperCase() !== c.iso2 &&
        candidate.toUpperCase() !== c.iso3
      ) {
        readPlace(c.iso3, candidate, 'COUNTRY_CONTEXT_PATTERN (landed parity, case-insensitive)');
        break;
      }
    }
  }
  if (pl) {
    for (const t of toks) {
      const c = resolvePolishCountry(t);
      if (
        c &&
        !geography.some((g) => g.value === c.iso3 && g.provenance !== 'SUPPLIED_BY_SURFACE')
      ) {
        geography.push(
          el(c.iso3, t, 'SURFACE_FORM_SET', 'polish-country-forms.util (G-ALPHA-2.1 A)'),
        );
      }
    }
    /* R1-RESIDUAL C-3' — the sub-national rung of the same mechanism. */
    const index = polishSettlementIndex();
    for (const t of toks) {
      const iso = index.get(t);
      if (
        iso &&
        !geography.some((g) => g.value === iso && g.provenance !== 'SUPPLIED_BY_SURFACE')
      ) {
        geography.push(
          el(iso, t, 'SURFACE_FORM_SET', "PL_SETTLEMENT_INDEX (C-3', gazetteer + exonym map)"),
        );
      }
    }
  }

  /* entities — canonical classifier's countries, plus PL forms */
  const entities: ReadingElement<string>[] = [];
  for (const c of classifyQueryIntent(text, {}).countries) {
    entities.push(el(c.iso3, undefined, 'CANONICAL_RESOLVER', 'classifyQueryIntent'));
  }
  if (pl) {
    for (const t of toks) {
      const c = resolvePolishCountry(t);
      if (c && !entities.some((e) => e.value === c.iso3)) {
        entities.push(
          el(c.iso3, t, 'SURFACE_FORM_SET', 'polish-country-forms.util (G-ALPHA-2.1 A)'),
        );
      }
    }
  }

  /* numbers — U+0030..0039 plus the Polish decimal comma */
  const numbers: ReadingElement<string>[] = [];
  for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) {
    numbers.push(
      el(m[0], m[0], 'LEXICON_WHOLE_TOKEN', pl ? 'PL_NUMERALS(decimal comma)' : 'EN_NUMERALS'),
    );
  }

  /* dates and periods — L's readings, unchanged */
  const dates: ReadingElement<string>[] = [];
  const periods: ReadingElement<string>[] = [];
  if (pl) {
    /* "od <month>" is a STATED PERIOD, the twin of "since January", so the month is not
       also emitted as a date. */
    const sinceMonth = text.match(/(?:^|[^\p{L}])od\s+([\p{L}]+)/iu);
    const sinceWord = sinceMonth?.[1];
    const sinceIsMonth = sinceWord !== undefined && PL_MONTHS.includes(sinceWord.toLowerCase());
    if (sinceIsMonth && sinceMonth)
      periods.push(
        el(`od ${sinceWord}`, sinceMonth[0].trim(), 'LEXICON_WHOLE_TOKEN', 'PL_PERIOD_SINCE'),
      );
    const h = hasToken(toks, PL_DATEWORD);
    if (h) dates.push(el(h, h, 'LEXICON_WHOLE_TOKEN', 'PL_DATEWORD'));
    const mo = hasToken(toks, PL_MONTHS);
    if (mo && !sinceIsMonth) dates.push(el(mo, mo, 'LEXICON_WHOLE_TOKEN', 'PL_MONTHS'));
    const year = text.match(/(?<!\d)(?:19|20)\d{2}(?!\d)/);
    if (year) dates.push(el(year[0], undefined, 'LEXICON_WHOLE_TOKEN', 'PL_YEAR'));
    const pd = hasToken(toks, PL_PERIOD_HEADS);
    if (pd) periods.push(el(pd, pd, 'LEXICON_WHOLE_TOKEN', 'PL_PERIOD_HEADS'));
  } else {
    for (const r of EN_DATE) {
      const m = text.match(r);
      if (m) dates.push(el(m[0], m[0], 'LEXICON_WHOLE_TOKEN', 'EN_DATE'));
    }
    for (const r of EN_PERIOD) {
      const m = text.match(r);
      if (m) periods.push(el(m[0], m[0], 'LEXICON_WHOLE_TOKEN', 'EN_PERIOD'));
    }
  }

  /* negation */
  const negation: ReadingElement<string>[] = [];
  if (pl) {
    const h = hasToken(toks, PL_NEGATION);
    if (h) negation.push(el(h, h, 'LEXICON_WHOLE_TOKEN', 'PL_NEGATION'));
  } else {
    const m = text.match(EN_NEGATION);
    if (m) negation.push(el(m[0], m[0], 'LEXICON_WHOLE_TOKEN', 'EN_NEGATION'));
  }

  /* relations */
  const relations: ReadingElement<'COMPARISON' | 'CAUSE' | 'TREND'>[] = [];
  if (pl) {
    const h = hasToken(toks, PL_COMPARISON);
    if (h) relations.push(el('COMPARISON', h, 'LEXICON_WHOLE_TOKEN', 'PL_COMPARISON'));
  } else if (EN_COMPARISON.test(text)) {
    relations.push(el('COMPARISON', undefined, 'LEXICON_WHOLE_TOKEN', 'EN_COMPARISON'));
  }

  /* currentness */
  const curTok = pl ? hasToken(toks, PL_CURRENT) : text.match(EN_CURRENT)?.[0];
  const firstPeriod = periods[0];
  const firstDate = dates[0];
  const currentness: ReadingElement<CurrentnessReading> = firstPeriod
    ? el('PERIOD_STATED', firstPeriod.matchedText, firstPeriod.provenance, firstPeriod.source)
    : firstDate
      ? el('DATE_STATED', firstDate.matchedText, firstDate.provenance, firstDate.source)
      : curTok
        ? el('CURRENT', curTok, 'LEXICON_WHOLE_TOKEN', pl ? 'PL_CURRENT' : 'EN_CURRENT')
        : el('STANDING', undefined, 'LEXICON_WHOLE_TOKEN', pl ? 'PL_CURRENT' : 'EN_CURRENT');

  /* R1-RESIDUAL C-1 — language-neutral, computed from facts already on the reading */
  const changeTok = hasToken(toks, pl ? PL_CHANGE : EN_CHANGE);
  const stanceTok = hasToken(toks, pl ? PL_STANCE : EN_STANCE);
  const quantitativeChange = numbers.length > 0 && changeTok !== undefined;
  const institutionalPosition =
    stanceTok !== undefined && domains.some((d) => d.value === 'political');
  const defeaters: DefinitionDefeater[] = [];
  if (dates.length > 0) defeaters.push('DATE_STATED');
  if (periods.length > 0) defeaters.push('PERIOD_STATED');
  if (quantitativeChange) defeaters.push('QUANTITATIVE_CHANGE');
  if (institutionalPosition) defeaters.push('INSTITUTIONAL_POSITION');

  const office = (pl ? PL_OFFICE_CONSTRUCTION : EN_OFFICE).exec(text);

  /* LOSS DETECTION — detected but not representable */
  if (pl) {
    if (/\d/.test(text) && numbers.length === 0)
      losses.push({ kind: 'NUMBER', detectedText: text, why: 'digits present, none represented' });
    const negTok = hasToken(toks, PL_NEGATION);
    if (negTok && negation.length === 0)
      losses.push({
        kind: 'NEGATION',
        detectedText: negTok,
        why: 'negation token present, not represented',
      });
  }

  const firstDomain = domains[0];
  const statedTime = readStatedTime(text, pl);

  /* GATE H — Main MC-052: one token, one reading. A place the resolver found INSIDE a span
     already read as a date or stated period ("August" in "August 2026") is dropped. */
  const timeSpans = [...dates, ...periods]
    .map((d) => d.matchedText?.toLowerCase())
    .concat(statedTime?.statedPeriod.toLowerCase())
    .filter((t): t is string => t !== undefined && t.length > 0);
  for (let i = geography.length - 1; i >= 0; i -= 1) {
    const g = geography[i]!;
    const at = g.matchedText?.toLowerCase();
    if (
      g.provenance === 'CANONICAL_RESOLVER' &&
      at !== undefined &&
      timeSpans.some((t) => t.includes(at))
    )
      geography.splice(i, 1);
  }
  /* GATE H — Main MC-069: "Congo" names two countries. The landed ambiguity rule decides;
     the resolver's arbitrary candidate is removed and the place is read as CONTESTED. */
  const ambiguous = detectAmbiguousCountryMention(text);
  if (ambiguous !== undefined) {
    for (let i = geography.length - 1; i >= 0; i -= 1) {
      const g = geography[i]!;
      if (g.provenance !== 'SUPPLIED_BY_SURFACE' && ambiguous.candidates.includes(g.value))
        geography.splice(i, 1);
    }
    if (!geography.some((g) => g.value === 'CONTESTED')) {
      geography.push(
        el(
          'CONTESTED',
          ambiguous.mention,
          'CANONICAL_RESOLVER',
          'detectAmbiguousCountryMention (landed, ANCHORING R1 F)',
        ),
      );
    }
  }
  const readerCategory = readCategory(text, toks, pl);
  const reading: QualifiedReading = {
    originalQuestion: req.originalQuestion,
    sourceLanguage: req.sourceLanguage,
    normalizationLanguage: req.normalizationLanguage,
    displayLanguage: req.displayLanguage,
    entities,
    geography,
    dates,
    periods,
    ...(statedTime ? { statedTime } : {}),
    numbers,
    negation,
    ...(firstDomain
      ? {
          topic: el(
            String(firstDomain.value),
            firstDomain.matchedText,
            firstDomain.provenance,
            firstDomain.source,
          ),
        }
      : {}),
    ...(readerCategory ? { readerCategory } : {}),
    domains,
    relations,
    currentness,
    subject: readSemanticSubject(text, pl ? 'pl' : 'en'),
    shape: {
      officeConstruction: office !== null,
      ...(office?.[1] ? { officeTerm: office[1].toLowerCase() } : {}),
      currencyMarker: curTok !== undefined,
      quantitativeChange,
      institutionalPosition,
    },
    defeaters,
  };

  /* GATE H (Main MC-078) — nothing was read at all: no word of the declared language, no
     place, domain, entity, number, date, period or category, and no capitalised name. That
     is "no signal", and it is disclosed as such instead of being searched as news. */
  const contentFree =
    declaredWords.length === 0 &&
    geography.length === 0 &&
    domains.length === 0 &&
    entities.length === 0 &&
    numbers.length === 0 &&
    dates.length === 0 &&
    periods.length === 0 &&
    readerCategory === undefined &&
    !/(?:^|[^\p{L}])\p{Lu}\p{Ll}/u.test(req.originalQuestion);
  if (contentFree) return { status: 'NOT_READ', failure: 'NO_READABLE_CONTENT', losses: [] };

  const loadBearing = losses.filter((l) => LOAD_BEARING_LOSSES.includes(l.kind));
  if (loadBearing.length > 0) return { status: 'NOT_READ', failure: 'LOAD_BEARING_LOSS', losses };
  if (losses.length > 0) return { status: 'DEGRADED', reading, losses };
  return { status: 'QUALIFIED', reading, losses: [] };
}

/*
 * GATE H (Main MC-078) — closed function-word sets. Evidence of WHICH language a question is
 * written in, never a reading of it: a question in the declared language uses these words;
 * one in another language uses that language's. The foreign set holds only words that are
 * not also English or Polish words ("die", "in", "o", "a" are excluded on purpose).
 */
const EN_FUNCTION_WORDS: ReadonlySet<string> = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'what',
  'who',
  'whom',
  'how',
  'why',
  'when',
  'where',
  'which',
  'in',
  'on',
  'of',
  'for',
  'about',
  'to',
  'and',
  'or',
  'does',
  'do',
  'did',
  'has',
  'have',
  'had',
  'this',
  'that',
  'these',
  'those',
  'with',
  'from',
  'at',
  'by',
  'it',
  'will',
  'can',
  'there',
  'any',
  'me',
  'my',
  'i',
  'tell',
  'show',
  'give',
  'news',
  'latest',
  'happening',
  'happened',
  'explain',
  'compare',
  'and',
  'than',
  'between',
]);
const PL_FUNCTION_WORDS: ReadonlySet<string> = new Set([
  'co',
  'jak',
  'jest',
  'są',
  'był',
  'była',
  'było',
  'byli',
  'w',
  'we',
  'na',
  'o',
  'z',
  'ze',
  'kto',
  'kim',
  'czym',
  'dlaczego',
  'gdzie',
  'kiedy',
  'czy',
  'i',
  'oraz',
  'się',
  'to',
  'ten',
  'ta',
  'jaki',
  'jaka',
  'jakie',
  'od',
  'do',
  'dla',
  'po',
  'przez',
  'nie',
  'który',
  'która',
  'które',
  'mi',
  'mnie',
  'moje',
  'pokaż',
  'powiedz',
  'wyjaśnij',
  'porównaj',
  'dzieje',
  'wiadomości',
  'między',
  'a',
]);
const FOREIGN_FUNCTION_WORDS: ReadonlySet<string> = new Set([
  /* de */ 'der',
  'das',
  'ist',
  'und',
  'wie',
  'wer',
  'nicht',
  'ein',
  'eine',
  'ich',
  'mit',
  'für',
  'auf',
  'sind',
  'warum',
  'wo',
  'wann',
  'welche',
  'gibt',
  'es',
  'im',
  'dem',
  'des',
  /* fr */ 'le',
  'la',
  'les',
  'est',
  'et',
  'qui',
  'que',
  'quoi',
  'une',
  'dans',
  'pour',
  'sur',
  'pourquoi',
  'comment',
  'quel',
  'quelle',
  'sont',
  'du',
  'au',
  'aux',
  /* es / pt / it */ 'el',
  'los',
  'las',
  'qué',
  'cómo',
  'quién',
  'una',
  'por',
  'para',
  'está',
  'cuál',
  'dónde',
  'il',
  'che',
  'di',
  'è',
  'sono',
  'perché',
  'não',
  'são',
  'qual',
  'onde',
  'uma',
]);

/** The reading source that marks a place read from a demonym (entity geography). */
export const DEMONYM_SOURCE = 'resolveGeography:DEMONYM';

/** Country names that are ordinary lowercase words; read only when the reader capitalises. */
const LOWERCASE_HOMOGRAPHS: ReadonlySet<string> = new Set([
  'turkey',
  'chad',
  'jordan',
  'georgia',
  'china',
  'japan',
  'niger',
  'guinea',
  'panama',
]);

/** Keys a reading must never carry (L N-1). Asserted by spec. */
export const FORBIDDEN_READING_KEYS: readonly string[] = [
  'route',
  'intent',
  'classification',
  'confidence',
  'questionClass',
];

/**
 * GATE H (Main MC-002/004/006/008/010) — the Polish office construction's country, for the
 * landed Map-dock path. "Kto jest obecnie prezydentem Rwandy?" names Rwanda as plainly as
 * "Who is the current president of Rwanda?" does; G producer A reads only the English
 * construction, so a Polish reader on the Map got the selected Map country instead. This is
 * the SAME reading the Ask R2 route uses (one boundary, no second country table): the first
 * place the reader typed, only when the question is a Polish office construction.
 */
export function polishOfficeGeographyCountryCode(text: string): string | null {
  if (!PL_OFFICE_CONSTRUCTION.test(text)) return null;
  const outcome = normalizeAskQuestion({
    originalQuestion: text,
    sourceLanguage: 'pl',
    normalizationLanguage: 'pl',
    displayLanguage: 'pl',
    origin: 'ASK',
  });
  if (outcome.status === 'NOT_READ') return null;
  const typed = outcome.reading.geography.find(
    (g) => g.provenance !== 'SUPPLIED_BY_SURFACE' && g.value !== 'CONTESTED',
  );
  return typed?.value ?? null;
}
