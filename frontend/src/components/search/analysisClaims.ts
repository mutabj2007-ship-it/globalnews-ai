import type {
  AffectedParty,
  AffectedPartyType,
  AgreementPoint,
  AnalysisApiResponse,
  AnalysisSourceRef,
  ClaimReference,
  DifferencePosition,
  DirectionalEligibility,
  EvidenceBreadth,
  EvidenceSufficiency,
  NewsAnalysisResult,
  NewsArticle,
  SourcedClaim,
  TimelineEvent,
  UncertaintyItem,
  WatchNextItem,
} from '@globalnews-ai/shared';
import { resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import { buildCitationNumbering, citationNumberFor } from './analysisDimensions';
import type { PrimaryDimensionKey, SubViewKey } from './analysisDimensions';

/**
 * H2C — the pure claim/evidence view-model for the Analysis Workspace.
 *
 * This module answers one question: for a given dimension, what are the
 * entries, and for each entry what is the complete chain
 *
 *     claim -> citation -> source -> provenance
 *
 * It is pure. No React, no JSX, no DOM, no timers, no IO, no network
 * primitive of any kind. It reads an AnalysisApiResponse that
 * SearchPageClient has already fetched through lib/api/analysisApi.ts
 * and returns plain data.
 *
 * THREE RULES IT EXISTS TO ENFORCE
 *
 * 1. NO NEW TEXT. Every string that reaches the screen is copied
 *    verbatim out of the production contract. Nothing here composes,
 *    paraphrases, summarises, truncates or re-words a claim, an
 *    excerpt or an outlet name. 08-DATA-BINDING-MAP class B permits a
 *    deterministic transform and forbids generated text; this module
 *    only selects, counts and maps.
 *
 * 2. NO FABRICATED QUANTITY. The only numbers it emits are counts of
 *    records that exist: how many distinct article IDs an entry cites,
 *    and the backend's own evidenceBreadth when the payload carries
 *    one. It never estimates, interpolates, scores, or converts a
 *    count into a percentage. It never reads analysis.confidence —
 *    the contract documents that field as model self-assessment
 *    metadata that is explicitly NOT the authoritative trust signal.
 *
 * 3. NO CITATION BY POSITION. Citation numbers come from the H2A
 *    numbering map, which is keyed by articleId. Render order never
 *    determines a citation number, so re-ordering a list can never
 *    silently re-attribute evidence to the wrong publisher.
 *
 * COUNT LOCK. The entry list this module produces for a dimension is
 * the same list analysisDimensions.ts counted when it built the index
 * row. That agreement is asserted in analysisClaims.spec.ts for every
 * dimension, so the number in the navigator and the number of cards in
 * the viewport cannot drift apart.
 */

/**
 * What kind of contract record an entry came from. The frontend needs
 * this because the four shapes carry genuinely different information —
 * an affected party has a party and an effect, an `unknowns` string has
 * no citations at all — and flattening them into one opaque "claim"
 * would either lose that or invite the UI to invent the missing parts.
 */
export type ClaimEntryKind = 'claim' | 'affected-party' | 'uncertainty' | 'unknown';

/** One resolved claim -> source link. */
export interface ClaimCitation {
  readonly articleId: string;
  /**
   * From the H2A articleId-keyed numbering map. Null when the cited
   * article is not in the numbering basis at all — a real state that
   * must render as an unresolved citation rather than a guessed index.
   */
  readonly citationNumber: number | null;
  /**
   * Publisher from the analysis source record, else the retrieved
   * article's provider-supplied sourceName. Null when neither exists;
   * the pill then renders its index disc alone (E-17 permits exactly
   * this). Never a placeholder, never "Unknown source".
   */
  readonly outletName: string | null;
  /** True iff this citation resolved to a known source or article record. */
  readonly resolved: boolean;
}

/**
 * Milestone #32 excerpt provenance, carried through verbatim. The
 * contract is explicit that this proves the text was present in what
 * the model was shown for that source — not that it entails the claim.
 * The presentation layer must not upgrade it into confirmation.
 */
export interface ClaimEvidenceBasis {
  readonly articleId: string;
  readonly citationNumber: number | null;
  readonly outletName: string | null;
  readonly excerpt: string;
}

export interface ClaimEntry {
  /** Per-dimension ordinal, zero-padded (E-16). The non-colour identity cue. */
  readonly ordinal: string;
  readonly kind: ClaimEntryKind;
  /** Verbatim contract text. Never re-worded. */
  readonly text: string;
  /** Affected-party entries only; null everywhere else. */
  readonly party: string | null;
  readonly partyType: AffectedPartyType | null;
  readonly citations: readonly ClaimCitation[];
  /** Distinct cited article IDs on this entry. A count of records, nothing more. */
  readonly citationCount: number;
  /**
   * The backend's own breadth signal, verbatim, when the payload
   * carries one (absent on results generated before Milestone #32).
   * Never synthesised so that a card can show a number.
   */
  readonly evidenceBreadth: EvidenceBreadth | null;
  readonly evidenceBasis: ClaimEvidenceBasis | null;
  /** True when the entry cites nothing — E-16's UNCITED state. */
  readonly uncited: boolean;
}

function outletFor(
  articleId: string,
  sources: ReadonlyMap<string, AnalysisSourceRef>,
  articles: ReadonlyMap<string, NewsArticle>,
): { outletName: string | null; resolved: boolean } {
  const source = sources.get(articleId);
  if (source !== undefined && source.publisher.trim() !== '') {
    return { outletName: source.publisher, resolved: true };
  }
  const article = articles.get(articleId);
  if (article !== undefined && article.sourceName.trim() !== '') {
    return { outletName: article.sourceName, resolved: true };
  }
  // Known to the numbering basis but carrying no usable name, or not
  // known at all. Either way the honest render is the disc alone.
  return { outletName: null, resolved: source !== undefined || article !== undefined };
}

interface Lookups {
  readonly numbering: ReadonlyMap<string, number>;
  readonly sources: ReadonlyMap<string, AnalysisSourceRef>;
  readonly articles: ReadonlyMap<string, NewsArticle>;
}

function buildLookups(response: AnalysisApiResponse): Lookups {
  const sources = new Map<string, AnalysisSourceRef>();
  for (const source of response.analysis?.sources ?? []) {
    if (!sources.has(source.articleId)) sources.set(source.articleId, source);
  }
  const articles = new Map<string, NewsArticle>();
  for (const article of response.articles) {
    if (!articles.has(article.id)) articles.set(article.id, article);
  }
  return {
    numbering: buildCitationNumbering(response.analysis?.sources, response.articles),
    sources,
    articles,
  };
}

function citationsFor(
  sourceArticleIds: readonly string[],
  lookups: Lookups,
): readonly ClaimCitation[] {
  const seen = new Set<string>();
  const out: ClaimCitation[] = [];
  for (const articleId of sourceArticleIds) {
    if (seen.has(articleId)) continue;
    seen.add(articleId);
    const { outletName, resolved } = outletFor(articleId, lookups.sources, lookups.articles);
    out.push({
      articleId,
      citationNumber: citationNumberFor(articleId, lookups.numbering),
      outletName,
      resolved,
    });
  }
  return out;
}

function basisFor(
  claim: { evidenceBasis?: { articleId: string; excerpt: string } },
  lookups: Lookups,
): ClaimEvidenceBasis | null {
  const basis = claim.evidenceBasis;
  if (basis === undefined) return null;
  const { outletName } = outletFor(basis.articleId, lookups.sources, lookups.articles);
  return {
    articleId: basis.articleId,
    citationNumber: citationNumberFor(basis.articleId, lookups.numbering),
    outletName,
    // Verbatim. E-16 is explicit: never paraphrased, never truncated
    // mid-sentence. Visual clamping is the component's business.
    excerpt: basis.excerpt,
  };
}

function ordinalFor(index: number): string {
  const n = index + 1;
  return n < 10 ? `0${n}` : String(n);
}

function fromSourcedClaim(claim: SourcedClaim, index: number, lookups: Lookups): ClaimEntry {
  const citations = citationsFor(claim.sourceArticleIds, lookups);
  return {
    ordinal: ordinalFor(index),
    kind: 'claim',
    text: claim.claim,
    party: null,
    partyType: null,
    citations,
    citationCount: citations.length,
    evidenceBreadth: claim.evidenceBreadth ?? null,
    evidenceBasis: basisFor(claim, lookups),
    uncited: citations.length === 0,
  };
}

function fromAffectedParty(party: AffectedParty, index: number, lookups: Lookups): ClaimEntry {
  const citations = citationsFor(party.sourceArticleIds, lookups);
  return {
    ordinal: ordinalFor(index),
    kind: 'affected-party',
    // The effect is the finding; the party is its subject. Both are
    // carried separately so the card can label the entity without the
    // presentation layer having to split a sentence apart.
    text: party.effect,
    party: party.party,
    partyType: party.partyType,
    citations,
    citationCount: citations.length,
    evidenceBreadth: party.evidenceBreadth ?? null,
    evidenceBasis: basisFor(party, lookups),
    uncited: citations.length === 0,
  };
}

function fromUncertainty(item: UncertaintyItem, index: number, lookups: Lookups): ClaimEntry {
  const citations = citationsFor(item.sourceArticleIds, lookups);
  return {
    ordinal: ordinalFor(index),
    kind: 'uncertainty',
    text: item.description,
    party: null,
    partyType: null,
    citations,
    citationCount: citations.length,
    // UncertaintyItem carries no evidenceBreadth or evidenceBasis in
    // the contract. Nothing is invented to fill the gap.
    evidenceBreadth: null,
    evidenceBasis: null,
    uncited: citations.length === 0,
  };
}

function fromUnknown(text: string, index: number): ClaimEntry {
  return {
    ordinal: ordinalFor(index),
    kind: 'unknown',
    text,
    party: null,
    partyType: null,
    // `unknowns` is a free-text string array with no citation field at
    // all. It is a first-class result (08 row 29) and it is genuinely
    // uncited — that is information, not a defect to paper over.
    citations: [],
    citationCount: 0,
    evidenceBreadth: null,
    evidenceBasis: null,
    uncited: true,
  };
}

/**
 * The entries for one dimension, in contract order.
 *
 * The mapping below mirrors analysisDimensions.ts's own countFor()
 * exactly, dimension for dimension and array for array. That is the
 * whole point: the index count and the rendered cards are two views of
 * one selection, not two independent selections that happen to agree.
 *
 * `brief` returns an empty list — the Executive Brief is E-09 plus the
 * E-10 answer grid, not a list of cards, which is also why its index
 * count is null rather than a number.
 */
export function buildDimensionClaims(
  response: AnalysisApiResponse,
  dimension: PrimaryDimensionKey,
): readonly ClaimEntry[] {
  const analysis: NewsAnalysisResult | null = response.analysis;
  if (analysis === null || dimension === 'brief') return [];

  const lookups = buildLookups(response);

  switch (dimension) {
    case 'significance':
      return (analysis.significance?.rationale ?? []).map((claim, i) =>
        fromSourcedClaim(claim, i, lookups),
      );
    case 'why-this-matters':
      return analysis.relevance.map((claim, i) => fromSourcedClaim(claim, i, lookups));
    case 'who-is-affected':
      return analysis.affectedParties.map((party, i) => fromAffectedParty(party, i, lookups));
    case 'immediate-effects':
      return analysis.immediateImpacts.map((claim, i) => fromSourcedClaim(claim, i, lookups));
    case 'key-facts':
      return analysis.keyFacts.map((claim, i) => fromSourcedClaim(claim, i, lookups));
    case 'insufficient-evidence': {
      // Order matches countFor()'s own addition: uncertainties first,
      // then unknowns. Ordinals run across the combined list so the
      // card numbering matches the single count shown in the index.
      const uncertainties = analysis.uncertainties ?? [];
      const entries: ClaimEntry[] = uncertainties.map((item, i) =>
        fromUncertainty(item, i, lookups),
      );
      analysis.unknowns.forEach((text, i) => {
        entries.push(fromUnknown(text, uncertainties.length + i));
      });
      return entries;
    }
  }
}

/**
 * The number a card shows beside "cited by". Prefers the backend's own
 * breadth signal, which is authoritative and computed server-side from
 * already-resolved canonical IDs; falls back to the count of distinct
 * citations actually present on the entry. Both are counts of existing
 * records. Returns null only when there is nothing to count, so the
 * component omits the line rather than printing a zero that reads like
 * a measurement.
 */
export function citedSourceCount(entry: ClaimEntry): number | null {
  if (entry.evidenceBreadth !== null) return entry.evidenceBreadth.sourceCount;
  if (entry.citationCount > 0) return entry.citationCount;
  return null;
}

/**
 * E-09's two direct fields, read here rather than in the shell.
 *
 * The workspace components deliberately never touch a production
 * response field themselves — one module interprets the response, and
 * everything above it consumes that interpretation. Null when the AI
 * failed or produced no summary, which is what makes E-09 omit itself
 * and the answer grid move up rather than render an empty hero.
 */
export interface ExecutiveBriefModel {
  /** Verbatim `analysis.summary`. Never re-summarised, never trimmed of content. */
  readonly summary: string;
  readonly generatedAt: string;
  /**
   * C907 CORRECTION 3 — the backend ASSESSED this brief and refused it, so
   * `summary` is empty by construction and E-09 must say why rather than
   * disappear. See brief-fail-closed.util.ts.
   */
  readonly withheld: boolean;
  /** The backend's measured statement of the defect. Null unless `withheld`. */
  readonly withheldReason: string | null;
}

export function buildExecutiveBriefModel(
  response: AnalysisApiResponse,
): ExecutiveBriefModel | null {
  const analysis = response.analysis;
  if (analysis === null) return null;

  /*
    C907 — THE WITHHELD CASE IS CHECKED BEFORE THE EMPTY-STRING CASE, and that
    order is the whole point. A withheld brief IS an empty summary, so the
    blank-summary guard below would otherwise return null and E-09 would omit
    itself silently — the reader would see the answer grid move up and would
    never learn that a brief had been produced, measured and rejected. Silence
    is what the ruling's "truthful degradation state" forbids.

    The remaining `null` return keeps its original meaning exactly: no summary
    was ever produced, nothing was assessed, and there is nothing to report.
  */
  if (analysis.briefState?.availability === 'withheld-non-compliant') {
    return {
      summary: '',
      generatedAt: analysis.generatedAt,
      withheld: true,
      withheldReason: analysis.briefState.reason ?? null,
    };
  }

  if (analysis.summary.trim() === '') return null;

  return {
    summary: analysis.summary,
    generatedAt: analysis.generatedAt,
    withheld: false,
    withheldReason: null,
  };
}

/**
 * The counts behind E-05. Both are counts of records the payload
 * already carries, and each names exactly what it counts.
 *
 * `reportingClusterCount` is null when `sourceDiversity` is absent —
 * the contract marks that field optional because several service paths
 * construct a response without it. A null cluster count renders as no
 * cluster figure at all; it never falls back to the article count,
 * which would silently present articles as clusters.
 */
export interface TelemetryModel {
  readonly articlesRetrieved: number;
  readonly reportingClusterCount: number | null;
  /**
   * R2a — THE EVIDENCE-USED COUNT, AND WHY IT IS NOT DERIVED HERE.
   *
   * `trustState.distinctSourceArticleCount`, passed through untouched.
   * The contract defines it as "distinct validated article IDs
   * represented across grounded keyFacts/agreements/differences.
   * positions/timeline" — a backend figure computed after grounding
   * validation, over a narrower population than the retrieved pool.
   *
   * It is deliberately NOT recomputed from `sourceSupport`. A
   * client-side count would be a second, unvalidated definition of the
   * same idea, and the two would drift the first time validation
   * changed. One number, one owner.
   *
   * Null when there is no analysis — the AI failed, sources survive,
   * and there is no evidence-used figure to state. It never falls back
   * to the retrieved count.
   *
   * WHAT IT MAY NEVER BE CALLED. The contract is explicit that it is
   * "NOT a claim that all of them corroborate the same specific
   * conclusion, and NOT a claim of editorial/publisher independence".
   * `analysisWorkspaceContent.spec.ts` asserts that vocabulary never
   * reaches the rendered markup.
   */
  readonly evidenceUsedCount: number | null;
}

export function buildTelemetryModel(response: AnalysisApiResponse): TelemetryModel {
  return {
    articlesRetrieved: response.retrievalContext.articlesRetrieved,
    reportingClusterCount: response.sourceDiversity?.reportingClusterCount ?? null,
    evidenceUsedCount: response.analysis?.trustState.distinctSourceArticleCount ?? null,
  };
}

/* ================================================================== *
 * H2D — level-2 sub-view selection (E-26, E-28, E-29)
 *
 * The same three rules from the top of this file apply unchanged: no
 * new text, no fabricated quantity, no citation by position. What is
 * added here is only WHICH contract array a segment reads.
 *
 * The allocation itself is NOT re-declared. analysisDimensions.ts owns
 * SUB_VIEW_ALLOCATION and computes each segment's presence and count;
 * this module only resolves the entries behind a segment the adapter
 * has already decided exists. The specs assert the two agree, so a
 * strip segment can never say "3" over a panel showing four.
 * ================================================================== */

/**
 * The five segments whose entries are ordinary claim cards.
 *
 * `differences`, `timeline` and `relationships` are deliberately absent:
 * each carries a shape a flat claim list cannot express without losing
 * something — a topic and its competing positions, a timestamp, a
 * backend-authored relational verdict — and each has its own builder
 * below. Asking this function for one returns an empty list rather than
 * a flattened approximation.
 */
export function buildSubViewClaims(
  response: AnalysisApiResponse,
  subView: SubViewKey,
): readonly ClaimEntry[] {
  const analysis = response.analysis;
  if (analysis === null) return [];
  const lookups = buildLookups(response);

  switch (subView) {
    case 'reported-facts':
      return analysis.keyFacts.map((claim, i) => fromSourcedClaim(claim, i, lookups));
    case 'agreements':
      return analysis.agreements.map((point, i) => fromAgreementPoint(point, i, lookups));
    case 'reported-effects':
      return analysis.immediateImpacts.map((claim, i) => fromSourcedClaim(claim, i, lookups));
    case 'spillover':
      return analysis.spilloverImplications.map((claim, i) => fromSourcedClaim(claim, i, lookups));
    case 'affected-entities':
      return analysis.affectedParties.map((party, i) => fromAffectedParty(party, i, lookups));
    case 'differences':
    case 'timeline':
    case 'relationships':
      return [];
  }
}

function fromAgreementPoint(point: AgreementPoint, index: number, lookups: Lookups): ClaimEntry {
  const citations = citationsFor(point.sourceArticleIds, lookups);
  return {
    ordinal: ordinalFor(index),
    kind: 'claim',
    text: point.point,
    party: null,
    partyType: null,
    citations,
    citationCount: citations.length,
    evidenceBreadth: point.evidenceBreadth ?? null,
    evidenceBasis: basisFor(point, lookups),
    uncited: citations.length === 0,
  };
}

function fromDifferencePosition(
  position: DifferencePosition,
  index: number,
  lookups: Lookups,
): ClaimEntry {
  const citations = citationsFor(position.sourceArticleIds, lookups);
  return {
    ordinal: ordinalFor(index),
    kind: 'claim',
    text: position.description,
    party: null,
    partyType: null,
    citations,
    citationCount: citations.length,
    evidenceBreadth: position.evidenceBreadth ?? null,
    evidenceBasis: basisFor(position, lookups),
    uncited: citations.length === 0,
  };
}

/**
 * One disagreement: a topic and the competing positions reported on it.
 *
 * The topic is NOT a finding and carries no citations of its own — the
 * positions do. Flattening this into one list would silently assert
 * that the positions agree, which is the exact opposite of what the
 * segment exists to show.
 */
export interface DifferenceGroup {
  readonly ordinal: string;
  /** Verbatim `differences[].topic`. */
  readonly topic: string;
  readonly positions: readonly ClaimEntry[];
}

export function buildDifferenceGroups(response: AnalysisApiResponse): readonly DifferenceGroup[] {
  const analysis = response.analysis;
  if (analysis === null) return [];
  const lookups = buildLookups(response);
  return analysis.differences.map((difference, index) => ({
    ordinal: ordinalFor(index),
    topic: difference.topic,
    positions: difference.positions.map((position, i) =>
      fromDifferencePosition(position, i, lookups),
    ),
  }));
}

/**
 * One timeline event, in the order the payload supplied.
 *
 * `timestamp` is carried verbatim. `timeValid` records whether it
 * parses at all, so the component can omit the time line for an
 * unparseable value instead of printing "Invalid Date" or guessing one.
 * Nothing here sorts, interpolates, or derives a duration: the contract
 * supplies instants, never intervals.
 */
export interface TimelineEntry {
  readonly ordinal: string;
  readonly timestamp: string;
  readonly timeValid: boolean;
  readonly event: string;
  readonly citations: readonly ClaimCitation[];
  readonly citationCount: number;
  readonly evidenceBreadth: EvidenceBreadth | null;
  readonly evidenceBasis: ClaimEvidenceBasis | null;
  readonly uncited: boolean;
}

function fromTimelineEvent(event: TimelineEvent, index: number, lookups: Lookups): TimelineEntry {
  const citations = citationsFor(event.sourceArticleIds, lookups);
  return {
    ordinal: ordinalFor(index),
    timestamp: event.timestamp,
    timeValid: !Number.isNaN(new Date(event.timestamp).getTime()),
    event: event.event,
    citations,
    citationCount: citations.length,
    evidenceBreadth: event.evidenceBreadth ?? null,
    evidenceBasis: basisFor(event, lookups),
    uncited: citations.length === 0,
  };
}

export function buildTimelineEntries(response: AnalysisApiResponse): readonly TimelineEntry[] {
  const analysis = response.analysis;
  if (analysis === null) return [];
  const lookups = buildLookups(response);
  return analysis.timeline.map((event, index) => fromTimelineEvent(event, index, lookups));
}

/* ------------------------------------------------------------------ *
 * E-29 — relational composition
 * ------------------------------------------------------------------ */

export const RELATIONAL_BUCKET_KEYS = [
  'supporting',
  'reverse',
  'associationOnly',
  'mixed',
  'unclearOrNonSubstantive',
] as const;

export type RelationalBucketKey = (typeof RELATIONAL_BUCKET_KEYS)[number];

export interface RelationalBucket {
  readonly key: RelationalBucketKey;
  readonly count: number;
  readonly entries: readonly ClaimEntry[];
}

/**
 * The backend's relational conclusion, resolved for display.
 *
 * `summary` is Milestone #41's own authored text and is rendered
 * VERBATIM. This module does not re-derive direction, sufficiency or
 * causality, and it does not synthesise subject/relation/object
 * triples — the contract contains no triples to render. What it does is
 * resolve each ClaimReference back to the claim it points at, so a
 * reader can see which findings sit in which bucket.
 *
 * Returns null when the payload carries no relationalComposition, which
 * is the ordinary case: the relational path only exists for questions
 * asked about a relationship between two things.
 */
export interface RelationshipsSurfaceModel {
  readonly summary: string;
  readonly directionalEligibility: DirectionalEligibility;
  readonly evidenceSufficiency: EvidenceSufficiency;
  readonly buckets: readonly RelationalBucket[];
  readonly totalReferences: number;
}

function textOfReference(
  analysis: NewsAnalysisResult,
  reference: ClaimReference,
): { text: string; sourceArticleIds: readonly string[] } | null {
  switch (reference.section) {
    case 'keyFacts': {
      const entry = analysis.keyFacts[reference.index];
      return entry === undefined
        ? null
        : { text: entry.claim, sourceArticleIds: entry.sourceArticleIds };
    }
    case 'agreements': {
      const entry = analysis.agreements[reference.index];
      return entry === undefined
        ? null
        : { text: entry.point, sourceArticleIds: entry.sourceArticleIds };
    }
    case 'differences': {
      const entry = analysis.differences[reference.index];
      /* A difference is a topic, not a grounded claim; its positions carry
         the citations. The topic is shown with no citations of its own
         rather than borrowing its positions'. */
      return entry === undefined ? null : { text: entry.topic, sourceArticleIds: [] };
    }
    case 'timeline': {
      const entry = analysis.timeline[reference.index];
      return entry === undefined
        ? null
        : { text: entry.event, sourceArticleIds: entry.sourceArticleIds };
    }
  }
}

export function buildRelationshipsSurface(
  response: AnalysisApiResponse,
): RelationshipsSurfaceModel | null {
  const analysis = response.analysis;
  if (analysis === null) return null;
  const composition = analysis.relationalComposition;
  if (composition === undefined) return null;

  const lookups = buildLookups(response);
  const source: Readonly<Record<RelationalBucketKey, readonly ClaimReference[]>> = {
    supporting: composition.supportingClaims,
    reverse: composition.reverseClaims,
    associationOnly: composition.associationOnlyClaims,
    mixed: composition.mixedClaims,
    unclearOrNonSubstantive: composition.unclearOrNonSubstantiveClaims,
  };

  const buckets = RELATIONAL_BUCKET_KEYS.map((key) => {
    const references = source[key];
    const entries: ClaimEntry[] = [];
    references.forEach((reference, index) => {
      const resolved = textOfReference(analysis, reference);
      if (resolved === null) return;
      const citations = citationsFor(resolved.sourceArticleIds, lookups);
      entries.push({
        ordinal: ordinalFor(index),
        kind: 'claim',
        text: resolved.text,
        party: null,
        partyType: null,
        citations,
        citationCount: citations.length,
        evidenceBreadth: null,
        evidenceBasis: null,
        uncited: citations.length === 0,
      });
    });
    /* The count is the reference count the backend supplied, not the
       number that happened to resolve. If they differ, a reference
       pointed at nothing and the panel shows fewer rows than the count
       — visible, rather than quietly reconciled. */
    return { key, count: references.length, entries };
  });

  return {
    summary: composition.summary,
    directionalEligibility: composition.directionalEligibility,
    evidenceSufficiency: composition.evidenceSufficiency,
    buckets,
    totalReferences: buckets.reduce((total, bucket) => total + bucket.count, 0),
  };
}

/* ------------------------------------------------------------------ *
 * E-13 — geography, and E-25 — watch next
 * ------------------------------------------------------------------ */

/**
 * The world-map identifier for a resolved country, or null.
 *
 * `retrievalContext.countryCode` may be ISO2, ISO3 or a name — the
 * contract says any identifier resolveCountryByAnyIdentifier accepts.
 * The world map's existing deep-link convention (WorldMapGateway) is
 * `/map?country=<iso3>`, so this normalises to iso3 and returns null
 * when nothing resolves. Nothing is guessed from a partial match.
 */
export interface GeographicLink {
  readonly iso2: string;
  readonly iso3: string;
  readonly canonicalName: string;
}

export function resolveGeographicLink(countryCode: string | null): GeographicLink | null {
  if (countryCode === null || countryCode.trim() === '') return null;
  const country = resolveCountryByAnyIdentifier(countryCode);
  if (country === undefined) return null;
  return { iso2: country.iso2, iso3: country.iso3, canonicalName: country.name };
}

/**
 * E-25 — the analytical watch-next items, verbatim.
 *
 * This is the CURRENT analysis's forward indicators and nothing else.
 * It is not a follow list, not a watchlist, not an alert, and it
 * persists nothing: the array lives exactly as long as the response
 * object does.
 */
export interface WatchNextEntry {
  readonly ordinal: string;
  readonly claim: string;
  readonly hingeType: WatchNextItem['hingeType'];
  readonly citations: readonly ClaimCitation[];
  readonly evidenceBreadth: EvidenceBreadth | null;
  readonly evidenceBasis: ClaimEvidenceBasis | null;
  readonly uncited: boolean;
}

export function buildWatchNextEntries(response: AnalysisApiResponse): readonly WatchNextEntry[] {
  const analysis = response.analysis;
  if (analysis === null) return [];
  const lookups = buildLookups(response);
  return analysis.watchNext.map((item, index) => {
    const citations = citationsFor(item.sourceArticleIds, lookups);
    return {
      ordinal: ordinalFor(index),
      claim: item.claim,
      hingeType: item.hingeType,
      citations,
      evidenceBreadth: item.evidenceBreadth ?? null,
      evidenceBasis: basisFor(item, lookups),
      uncited: citations.length === 0,
    };
  });
}

/**
 * E-24 — the context items, verbatim, each keeping its own citations.
 *
 * Context is model-composed interpretation that frames the analysis. It
 * is grounded like any other claim, so it is carried as ClaimEntry and
 * rendered with the same citation row — the evidence chain is not
 * weaker inside the hero than outside it.
 */
export function buildContextEntries(response: AnalysisApiResponse): readonly ClaimEntry[] {
  const analysis = response.analysis;
  if (analysis === null) return [];
  const lookups = buildLookups(response);
  return analysis.context.map((claim, i) => fromSourcedClaim(claim, i, lookups));
}
