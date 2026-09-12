import type {
  AffectedParty,
  AgreementPoint,
  AnalysisApiResponse,
  AnalysisRetrievalContext,
  AnalysisSourceRef,
  ClaimReference,
  DifferenceItem,
  NewsAnalysisResult,
  NewsArticle,
  RelationalComposition,
  SignificanceLevel,
  SourcedClaim,
  TimelineEvent,
  TrustLevel,
  UncertaintyItem,
  WatchNextItem,
} from '@globalnews-ai/shared';

/**
 * H2A — ANALYSIS DIMENSION ADAPTER
 * ================================
 *
 * The deterministic presentation adapter for the approved Claude Design
 * Analysis Workspace (package GN-CD-ANALYSIS-WORKSPACE, reconciliation R1).
 *
 * WHAT THIS MODULE IS
 * -------------------
 * A pure, frontend-local view-model builder. It reads one already-fetched
 * AnalysisApiResponse and reorganises it into the shape the workspace
 * renders. That is the whole of its job.
 *
 * WHAT IT MUST NEVER DO (H2A authorization section 3)
 * ---------------------------------------------------
 *   - fetch anything;
 *   - generate new intelligence;
 *   - summarise or re-summarise model output;
 *   - rewrite, truncate or paraphrase a claim;
 *   - fabricate geography or geographic precision;
 *   - alter, re-index or invent a citation;
 *   - constitute a second analysis pipeline.
 *
 * There is no import of any API client here, and no network primitive is
 * referenced anywhere in this file. The single analysis request continues
 * to be issued by lib/api/analysisApi.ts and by nothing else.
 *
 * WHAT IT MAY DO
 * --------------
 * Select, group, count, map, classify, invert existing citation
 * relationships by articleId, and construct view-model objects from
 * fields the response already carries. Every string this module returns
 * is either verbatim production text or a stable, non-localized key.
 * It composes no sentence and localizes nothing — the rendering layer
 * owns display text and the dictionary owns wording.
 */

/* ------------------------------------------------------------------ *
 * 1. FIXED PRIMARY DIMENSIONS
 * ------------------------------------------------------------------ */

/**
 * The seven primary dimensions, in the exact approved presentation order
 * (02-DESKTOP-SPEC section 4, 03-MOBILE-SPEC section 2, R1 section 1.3).
 *
 * This list is FIXED. None of the seven preserved level-2 capabilities
 * becomes an eighth primary dimension (R1 field disposition section 8),
 * and no dimension is ever added or removed at runtime.
 *
 * These keys are also the mobile URL hash keys. They are deliberately
 * English and non-localized (03-MOBILE-SPEC section 2) so a deep link
 * survives a language change.
 */
export const PRIMARY_DIMENSION_KEYS = [
  'brief',
  'significance',
  'why-this-matters',
  'who-is-affected',
  'immediate-effects',
  'key-facts',
  'insufficient-evidence',
] as const;

export type PrimaryDimensionKey = (typeof PRIMARY_DIMENSION_KEYS)[number];

/* ------------------------------------------------------------------ *
 * 2. SEMANTIC ACCENT TOKENS
 * ------------------------------------------------------------------ */

/**
 * The six semantic hues of 05-COLOR-HUD-TOKENS section 2, referenced by
 * token NAME only. No hex value appears in this module: colour values
 * are a Tailwind concern and land in H2B. Naming the token here lets the
 * adapter carry semantic meaning without owning presentation.
 *
 * R1 colour errata section 5 restates two semantics in wording only —
 * gn-geo covers geographic, live AND temporal context (hence the
 * timeline and relationships sub-views), and gn-uncertain covers
 * unsettled evidence whether absent OR conflicting (hence the
 * differences sub-view). No hue is added, removed or re-mapped.
 */
export type AccentToken =
  'gn-verified' | 'gn-ai' | 'gn-geo' | 'gn-significance' | 'gn-uncertain' | 'gn-provenance';

/**
 * Dimension accents. 02-DESKTOP-SPEC section 4, explicitly left
 * UNCHANGED and authoritative by R1 colour errata section 4.
 */
const DIMENSION_ACCENTS: Readonly<Record<PrimaryDimensionKey, AccentToken>> = {
  brief: 'gn-ai',
  significance: 'gn-significance',
  'why-this-matters': 'gn-ai',
  'who-is-affected': 'gn-geo',
  'immediate-effects': 'gn-verified',
  'key-facts': 'gn-verified',
  'insufficient-evidence': 'gn-uncertain',
};

/* ------------------------------------------------------------------ *
 * 3. LEVEL-2 SUB-VIEWS (R1 section 1)
 * ------------------------------------------------------------------ */

export type SubViewKey =
  | 'reported-facts'
  | 'agreements'
  | 'differences'
  | 'reported-effects'
  | 'spillover'
  | 'timeline'
  | 'affected-entities'
  | 'relationships';

/**
 * R1 colour errata section 6 requires a visible label wherever a
 * sub-view's accent departs from its parent dimension's, so the
 * distinction survives greyscale and screen readers. It names exactly
 * two, and they are the only two here.
 *
 * Three segments carry a non-parent accent; only two are departures:
 *
 *   spillover   gn-ai vs parent gn-verified       -> AI_PROJECTED
 *   differences gn-uncertain vs parent gn-verified -> SOURCES_DIVERGE
 *   timeline    gn-geo vs parent gn-verified       -> no label
 *
 * The timeline segment is deliberately unlabelled. Errata section 5
 * restates gn-geo as "geographic, live AND temporal context" precisely
 * so that cyan on a timeline is the hue's own assigned meaning rather
 * than a departure from it. Labelling it would reassert a distinction
 * the errata removed on purpose, and R1 supplies no third label anyway.
 */
export type SubViewDivergenceLabel = 'AI_PROJECTED' | 'SOURCES_DIVERGE';

export interface SubViewDefinition {
  readonly key: SubViewKey;
  /** True for the dimension's own claim list, which always exists. */
  readonly isPrimarySegment: boolean;
  /** R1 colour errata section 6. */
  readonly accent: AccentToken;
  /**
   * Required whenever `accent` differs from the parent dimension accent.
   * Null when the sub-view inherits its parent's accent.
   */
  readonly divergenceLabel: SubViewDivergenceLabel | null;
}

/**
 * R1 section 1.3 — the final allocation, verbatim.
 *
 * Only these three dimensions carry a SubViewStrip. SIGNIFICANCE,
 * WHY THIS MATTERS, INSUFFICIENT EVIDENCE and EXECUTIVE BRIEF keep a
 * single view and never render a strip.
 *
 * Maximum three segments per dimension, by design.
 */
export const SUB_VIEW_ALLOCATION: Readonly<
  Partial<Record<PrimaryDimensionKey, readonly SubViewDefinition[]>>
> = {
  'key-facts': [
    { key: 'reported-facts', isPrimarySegment: true, accent: 'gn-verified', divergenceLabel: null },
    { key: 'agreements', isPrimarySegment: false, accent: 'gn-verified', divergenceLabel: null },
    {
      key: 'differences',
      isPrimarySegment: false,
      accent: 'gn-uncertain',
      divergenceLabel: 'SOURCES_DIVERGE',
    },
  ],
  'immediate-effects': [
    {
      key: 'reported-effects',
      isPrimarySegment: true,
      accent: 'gn-verified',
      divergenceLabel: null,
    },
    { key: 'spillover', isPrimarySegment: false, accent: 'gn-ai', divergenceLabel: 'AI_PROJECTED' },
    { key: 'timeline', isPrimarySegment: false, accent: 'gn-geo', divergenceLabel: null },
  ],
  'who-is-affected': [
    { key: 'affected-entities', isPrimarySegment: true, accent: 'gn-geo', divergenceLabel: null },
    { key: 'relationships', isPrimarySegment: false, accent: 'gn-geo', divergenceLabel: null },
  ],
};

/**
 * Mobile hash for a level-2 selection: `#{dimension}/{sub-view}`
 * (R1 section 1.2). Stable, English, non-localized. The primary segment
 * addresses its dimension alone, so an unchanged selection produces the
 * same hash the level-1 navigator already writes.
 */
export function subViewHash(dimension: PrimaryDimensionKey, subView: SubViewKey | null): string {
  if (subView === null) return `#${dimension}`;
  const definition = (SUB_VIEW_ALLOCATION[dimension] ?? []).find((entry) => entry.key === subView);
  if (definition === undefined || definition.isPrimarySegment) return `#${dimension}`;
  return `#${dimension}/${subView}`;
}

/* ------------------------------------------------------------------ *
 * 4. EVIDENCE METER (H2A authorization section 10)
 * ------------------------------------------------------------------ */

export type EvidenceMeterLabel = 'STRONG' | 'MODERATE' | 'LIMITED' | 'INSUFFICIENT' | 'UNRATED';

export interface EvidenceMeterState {
  /** The production value, or null when the response carried none. */
  readonly level: TrustLevel | null;
  readonly filledSegments: 0 | 1 | 2 | 3;
  readonly totalSegments: 3;
  readonly label: EvidenceMeterLabel;
  /**
   * THE LOAD-BEARING DISTINCTION.
   *
   * 'insufficient' and an absent trust state both fill zero segments,
   * and there the resemblance ends. 'insufficient' is a RATED result:
   * the evidence was assessed and found insufficient. An absent trust
   * state means no assessment happened at all. Collapsing the two would
   * assert something untrue about the analysis, and would contradict the
   * package's own non-negotiable 4 — "Insufficient Evidence is a
   * first-class result".
   *
   * `rated` is what guarantees they can never be confused, including in
   * the accessible name, regardless of how many segments are filled.
   */
  readonly rated: boolean;
}

/**
 * The CTO-approved mapping. Production's TrustLevel has FOUR members;
 * there is no 'strong' in the contract — 'high' is the production value
 * that the design labels STRONG.
 *
 *   high         -> 3 segments, STRONG,       rated
 *   moderate     -> 2 segments, MODERATE,     rated
 *   limited      -> 1 segment,  LIMITED,      rated
 *   insufficient -> 0 segments, INSUFFICIENT, rated
 *   absent       -> 0 segments, UNRATED,      NOT rated
 *
 * No numeric score is synthesised, ever. 07-INTERACTION-STATES section 4:
 * "Never interpolate a numeric score that the backend does not provide."
 */
export function resolveEvidenceMeter(level: TrustLevel | null | undefined): EvidenceMeterState {
  switch (level) {
    case 'high':
      return { level, filledSegments: 3, totalSegments: 3, label: 'STRONG', rated: true };
    case 'moderate':
      return { level, filledSegments: 2, totalSegments: 3, label: 'MODERATE', rated: true };
    case 'limited':
      return { level, filledSegments: 1, totalSegments: 3, label: 'LIMITED', rated: true };
    case 'insufficient':
      return { level, filledSegments: 0, totalSegments: 3, label: 'INSUFFICIENT', rated: true };
    default:
      return { level: null, filledSegments: 0, totalSegments: 3, label: 'UNRATED', rated: false };
  }
}

/* ------------------------------------------------------------------ *
 * 5. GEOGRAPHY (H2A authorization section 13)
 * ------------------------------------------------------------------ */

export type GeographicPrecision = 'city' | 'country' | 'unresolved';

export interface GeographicResolution {
  readonly precision: GeographicPrecision;
  readonly countryCode: string | null;
  readonly countryName: string | null;
  readonly city: string | null;
  /** Fuzzy-resolution disclosure, present only when the query was corrected. */
  readonly matchedFrom: string | null;
  readonly canonicalLocation: string | null;
  readonly matchConfidence: number | null;
}

/**
 * The ONLY geography this workspace may display.
 *
 *   city present    -> CITY-level capability
 *   country only    -> COUNTRY-level capability
 *   neither         -> unresolved
 *
 * Deliberately does NOT read NewsArticle.geographicPrecision. That field
 * can carry 'region', 'city' or 'coordinate' for an individual article,
 * and the design forbids displaying anything below the country the
 * ANALYSIS resolved. A field that exists is a field somebody eventually
 * renders; not reading it is the safeguard.
 *
 * No province, district, region or coordinate is inferred here, and
 * matchConfidence is a string-match provenance score, never a spatial
 * certainty — it is carried through for disclosure only.
 */
export function resolveGeography(
  retrievalContext: AnalysisRetrievalContext | undefined,
): GeographicResolution {
  const city = retrievalContext?.city ?? null;
  const countryName = retrievalContext?.countryName ?? null;

  let precision: GeographicPrecision = 'unresolved';
  if (city !== null && city.length > 0) precision = 'city';
  else if (countryName !== null && countryName.length > 0) precision = 'country';

  return {
    precision,
    countryCode: retrievalContext?.countryCode ?? null,
    countryName,
    city,
    matchedFrom: retrievalContext?.matchedFrom ?? null,
    canonicalLocation: retrievalContext?.canonicalLocation ?? null,
    matchConfidence: retrievalContext?.matchConfidence ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * 6. CITATION NUMBERING AND SOURCE SUPPORT INVERSION
 * ------------------------------------------------------------------ */

/**
 * Citation numbering, resolved by articleId and never by render index.
 *
 * This mirrors AnalysisCitation.tsx exactly — that component builds
 * `indexByArticleId` from `analysis.sources` and drops any chip that does
 * not resolve. Using the same array here is what keeps ONE numbering
 * system in the application rather than two that agree by accident.
 *
 * When the AI failed, `analysis` is null and no sources array exists; the
 * response's own `articles` then establishes numbering, so provenance
 * survives an analysis failure (R1 section 4).
 */
export function buildCitationNumbering(
  sources: readonly AnalysisSourceRef[] | undefined,
  articles: readonly NewsArticle[],
): ReadonlyMap<string, number> {
  const basis: readonly string[] =
    sources !== undefined && sources.length > 0
      ? sources.map((source) => source.articleId)
      : articles.map((article) => article.id);

  const numbering = new Map<string, number>();
  basis.forEach((articleId, index) => {
    if (!numbering.has(articleId)) numbering.set(articleId, index + 1);
  });
  return numbering;
}

/** Never derive a citation number from a rendered position. */
export function citationNumberFor(
  articleId: string,
  numbering: ReadonlyMap<string, number>,
): number | null {
  return numbering.get(articleId) ?? null;
}

/** Which dimension, and optionally which sub-view, a citation came from. */
export interface SupportOrigin {
  readonly dimension: PrimaryDimensionKey;
  readonly subView: SubViewKey | null;
}

export interface SourceSupportEntry {
  readonly articleId: string;
  /** null when this article carries no resolvable citation number. */
  readonly citationNumber: number | null;
  readonly article: NewsArticle;
  /** Trusted metadata rebuilt server-side from the article; null after an AI failure. */
  readonly source: AnalysisSourceRef | null;
  /** Every dimension/sub-view whose entries cite this article. */
  readonly supports: readonly SupportOrigin[];
  /**
   * A source cited by nothing is never hidden. It renders as
   * NOT CITED IN THIS ANALYSIS (08-DATA-BINDING-MAP item 32).
   */
  readonly supportState: 'cited' | 'not-cited-in-this-analysis';
}

interface CitedGroup {
  readonly origin: SupportOrigin;
  readonly sourceArticleIds: readonly (readonly string[])[];
}

function collectCitedGroups(analysis: NewsAnalysisResult | null): CitedGroup[] {
  if (analysis === null) return [];

  const ids = (entries: readonly { sourceArticleIds: string[] }[]): readonly string[][] =>
    entries.map((entry) => entry.sourceArticleIds);

  const groups: CitedGroup[] = [
    {
      origin: { dimension: 'significance', subView: null },
      sourceArticleIds: ids(analysis.significance?.rationale ?? []),
    },
    {
      origin: { dimension: 'why-this-matters', subView: null },
      sourceArticleIds: ids(analysis.relevance),
    },
    {
      origin: { dimension: 'who-is-affected', subView: 'affected-entities' },
      sourceArticleIds: ids(analysis.affectedParties),
    },
    {
      origin: { dimension: 'immediate-effects', subView: 'reported-effects' },
      sourceArticleIds: ids(analysis.immediateImpacts),
    },
    {
      origin: { dimension: 'immediate-effects', subView: 'spillover' },
      sourceArticleIds: ids(analysis.spilloverImplications),
    },
    {
      origin: { dimension: 'immediate-effects', subView: 'timeline' },
      sourceArticleIds: ids(analysis.timeline),
    },
    {
      origin: { dimension: 'key-facts', subView: 'reported-facts' },
      sourceArticleIds: ids(analysis.keyFacts),
    },
    {
      origin: { dimension: 'key-facts', subView: 'agreements' },
      sourceArticleIds: ids(analysis.agreements),
    },
    {
      origin: { dimension: 'key-facts', subView: 'differences' },
      sourceArticleIds: analysis.differences.flatMap((difference) =>
        difference.positions.map((position) => position.sourceArticleIds),
      ),
    },
    {
      origin: { dimension: 'insufficient-evidence', subView: null },
      sourceArticleIds: ids(analysis.uncertainties ?? []),
    },
    {
      // E-24 lives inside the Executive Brief, and its claims are cited.
      origin: { dimension: 'brief', subView: null },
      sourceArticleIds: ids(analysis.context),
    },
  ];

  return groups;
}

/**
 * The inverted citation map: for each retrieved article, which dimensions
 * and sub-views cite it.
 *
 * INVARIANTS (H2A authorization section 12)
 *   - inverted by articleId, never by render index;
 *   - sources are NOT sorted;
 *   - sources are NOT grouped;
 *   - uncited sources are NOT filtered out;
 *   - backend response order is authoritative and is preserved exactly.
 *
 * The returned array is index-aligned with `response.articles`, so a
 * caller that renders it in order reproduces the backend's own ordering
 * without needing to know that it did.
 */
export function buildSourceSupport(response: AnalysisApiResponse): readonly SourceSupportEntry[] {
  const analysis = response.analysis;
  const numbering = buildCitationNumbering(analysis?.sources, response.articles);

  const sourceByArticleId = new Map<string, AnalysisSourceRef>();
  (analysis?.sources ?? []).forEach((source) => {
    if (!sourceByArticleId.has(source.articleId)) sourceByArticleId.set(source.articleId, source);
  });

  const supportsByArticleId = new Map<string, SupportOrigin[]>();
  collectCitedGroups(analysis).forEach((group) => {
    group.sourceArticleIds.forEach((articleIds) => {
      articleIds.forEach((articleId) => {
        const existing = supportsByArticleId.get(articleId);
        if (existing === undefined) {
          supportsByArticleId.set(articleId, [group.origin]);
          return;
        }
        const alreadyRecorded = existing.some(
          (origin) =>
            origin.dimension === group.origin.dimension && origin.subView === group.origin.subView,
        );
        if (!alreadyRecorded) existing.push(group.origin);
      });
    });
  });

  // Response order, untouched: map over `articles` exactly as delivered.
  return response.articles.map((article) => {
    const supports = supportsByArticleId.get(article.id) ?? [];
    return {
      articleId: article.id,
      citationNumber: citationNumberFor(article.id, numbering),
      article,
      source: sourceByArticleId.get(article.id) ?? null,
      supports,
      supportState: supports.length > 0 ? 'cited' : 'not-cited-in-this-analysis',
    };
  });
}

/* ------------------------------------------------------------------ *
 * 7. PRESERVED LEVEL-2 CAPABILITIES (H2A authorization section 6)
 * ------------------------------------------------------------------ */

/**
 * E-24 — analysis.context.
 *
 * Production Context is SourcedClaim[], NOT prose. Every item carries
 * sourceArticleIds, and may carry evidenceBreadth and evidenceBasis.
 * Flattening it into an uncited paragraph would silently discard every
 * citation on every context item, which would break the package's own
 * non-negotiable 3 ("Evidence chain must stay legible") and the
 * claim-to-source relationship that 08 section 4 preserves.
 *
 * The items are therefore passed through untouched, so E-24 can render
 * prose typography over a structure that still knows its sources.
 */
export interface ContextDisclosureModel {
  readonly items: readonly SourcedClaim[];
  readonly count: number;
  readonly present: boolean;
  readonly accent: AccentToken;
}

/**
 * E-29 — analysis.relationalComposition.
 *
 * Production does NOT provide subject / relation / object triples. The
 * strings do not exist anywhere in the analysis contract, and the only
 * x/y pair in the system (AnalysisRelationalContext) is a backend
 * provider input that never reaches the frontend. Manufacturing a triple
 * would mean inventing both endpoints and the verb between them.
 *
 * The genuine structure is passed through unchanged: a backend-template
 * summary, two enums, and five buckets of ClaimReference. Bucket sizes
 * are counts of existing records, which is a permitted derivation.
 */
export interface RelationshipsModel {
  readonly composition: RelationalComposition | null;
  readonly present: boolean;
  readonly referenceCount: number;
  readonly bucketCounts: {
    readonly supporting: number;
    readonly reverse: number;
    readonly associationOnly: number;
    readonly mixed: number;
    readonly unclearOrNonSubstantive: number;
  };
  readonly accent: AccentToken;
}

export interface WatchNextModel {
  readonly items: readonly WatchNextItem[];
  readonly count: number;
  readonly present: boolean;
  readonly accent: AccentToken;
  /** Mandatory, never colour- or layout-dependent (R1 field disposition 3). */
  readonly qualifier: 'AI_PROJECTED_NOT_A_FORECAST';
}

/**
 * INSUFFICIENT EVIDENCE holds two structurally different things, and they
 * must stay distinguishable (H2A authorization section 9).
 *
 *   analysis.uncertainties  UncertaintyItem[]  -- carry sourceArticleIds
 *   analysis.unknowns       string[]           -- carry no citation at all
 *
 * Merging them would either invent citations for the unknowns or discard
 * the citations on the uncertainties. Neither is permitted, so they are
 * kept in separate arrays and counted separately.
 */
export interface InsufficientEvidenceModel {
  readonly citedUncertainties: readonly UncertaintyItem[];
  readonly uncitedUnknowns: readonly string[];
  readonly citedCount: number;
  readonly uncitedCount: number;
  readonly totalCount: number;
}

function buildRelationships(composition: RelationalComposition | undefined): RelationshipsModel {
  if (composition === undefined) {
    return {
      composition: null,
      present: false,
      referenceCount: 0,
      bucketCounts: {
        supporting: 0,
        reverse: 0,
        associationOnly: 0,
        mixed: 0,
        unclearOrNonSubstantive: 0,
      },
      accent: 'gn-geo',
    };
  }

  const bucketCounts = {
    supporting: composition.supportingClaims.length,
    reverse: composition.reverseClaims.length,
    associationOnly: composition.associationOnlyClaims.length,
    mixed: composition.mixedClaims.length,
    unclearOrNonSubstantive: composition.unclearOrNonSubstantiveClaims.length,
  };

  const referenceCount =
    bucketCounts.supporting +
    bucketCounts.reverse +
    bucketCounts.associationOnly +
    bucketCounts.mixed +
    bucketCounts.unclearOrNonSubstantive;

  return { composition, present: true, referenceCount, bucketCounts, accent: 'gn-geo' };
}

/**
 * Resolves one ClaimReference back to the entry it points at.
 *
 * Pure selection into the response's own already-validated arrays. The
 * reference is generated backend-side while iterating those same arrays
 * after validation (see shared/src/analysis.ts ClaimReference), so this
 * is a lookup, never a reconstruction. Returns null on an out-of-range
 * index rather than throwing, so a malformed reference degrades to
 * "not shown" instead of breaking the view.
 */
export function resolveClaimReference(
  analysis: NewsAnalysisResult,
  reference: ClaimReference,
): SourcedClaim | AgreementPoint | DifferenceItem | TimelineEvent | null {
  const section =
    reference.section === 'keyFacts'
      ? analysis.keyFacts
      : reference.section === 'agreements'
        ? analysis.agreements
        : reference.section === 'differences'
          ? analysis.differences
          : analysis.timeline;

  return section[reference.index] ?? null;
}

/* ------------------------------------------------------------------ *
 * 8. EXECUTIVE BRIEF ANSWER SELECTION (H2A authorization section 11)
 * ------------------------------------------------------------------ */

export const BRIEF_ANSWER_CELL_KEYS = [
  'what-happened',
  'where',
  'why-it-matters',
  'who-is-affected',
  'how-strong-is-the-evidence',
  'what-is-uncertain',
] as const;

export type BriefAnswerCellKey = (typeof BRIEF_ANSWER_CELL_KEYS)[number];

/**
 * R1 colour errata section 2, OPTION A: an answer cell inherits the
 * accent of the surface it opens. A cell has no independent colour
 * system — "the cell is a doorway; a doorway is painted the colour of
 * the room behind it".
 *
 * Two cells therefore open something that is NOT a primary dimension,
 * which is why a destination is a union rather than a dimension key:
 * WHERE opens the Geographic Intelligence rail module, and
 * HOW STRONG IS THE EVIDENCE opens the evidence-support popover.
 * The reference prototype linked both to a dimension instead; the
 * specification wins.
 */
export type BriefAnswerDestination =
  | { readonly kind: 'dimension'; readonly key: PrimaryDimensionKey }
  | { readonly kind: 'rail-module'; readonly key: 'geographic-intelligence' }
  | { readonly kind: 'popover'; readonly key: 'evidence-support' };

/**
 * The selected value of one cell.
 *
 * Every variant either carries verbatim production data or states that
 * the value is unresolved. There is deliberately no variant carrying a
 * composed sentence: prose generation is forbidden, so the adapter hands
 * the renderer the pieces and the renderer, with the dictionary, decides
 * how to say it.
 */
export type BriefAnswerValue =
  | { readonly kind: 'unresolved' }
  | { readonly kind: 'claim'; readonly claim: SourcedClaim }
  | { readonly kind: 'geography'; readonly geography: GeographicResolution }
  | {
      readonly kind: 'relevance-with-significance';
      readonly claim: SourcedClaim | null;
      readonly significanceLevel: SignificanceLevel | null;
    }
  | { readonly kind: 'affected-parties'; readonly parties: readonly AffectedParty[] }
  | {
      readonly kind: 'evidence-strength';
      readonly meter: EvidenceMeterState;
      readonly articlesRetrieved: number;
      readonly reportingClusterCount: number | null;
      readonly distinctSourceNameCount: number | null;
    }
  | {
      readonly kind: 'uncertainty';
      readonly count: number;
      readonly first: UncertaintyItem | null;
    };

export interface BriefAnswerCell {
  readonly key: BriefAnswerCellKey;
  /** R1 colour errata section 3, non-colour identity cue 1: mono 01..06. */
  readonly ordinal: '01' | '02' | '03' | '04' | '05' | '06';
  readonly destination: BriefAnswerDestination;
  readonly accent: AccentToken;
  readonly value: BriefAnswerValue;
  /**
   * The one permitted foreign-hue token (R1 colour errata section 3).
   * Significance renders as a labelled badge in the meta row of cell 03
   * and never as that cell's hue. Null on every other cell.
   */
  readonly significanceBadge: SignificanceLevel | null;
  /** A cell whose value is unresolved is non-interactive and aria-disabled. */
  readonly interactive: boolean;
}

/**
 * WHAT HAPPENED — the key fact with the highest existing
 * evidenceBreadth.sourceCount, tie-broken by original array order.
 *
 * Selection only. `sourceCount` is read from the field the backend
 * already computed; it is never recounted from sourceArticleIds.length,
 * which is a different quantity ("distinct canonical grounded source
 * article IDs") and could disagree.
 *
 * A fact with no evidenceBreadth scores 0 rather than being discarded,
 * so a response where no fact carries breadth still selects the first
 * fact rather than nothing.
 */
export function selectHighestCitedKeyFact(keyFacts: readonly SourcedClaim[]): SourcedClaim | null {
  let best: SourcedClaim | null = null;
  let bestCount = -1;

  keyFacts.forEach((fact) => {
    const count = fact.evidenceBreadth?.sourceCount ?? 0;
    // Strictly greater: an equal score never displaces the earlier item,
    // which is what makes the tie-break stable and order-defined.
    if (count > bestCount) {
      best = fact;
      bestCount = count;
    }
  });

  return best;
}

const BRIEF_CELL_DESTINATIONS: Readonly<Record<BriefAnswerCellKey, BriefAnswerDestination>> = {
  'what-happened': { kind: 'dimension', key: 'key-facts' },
  where: { kind: 'rail-module', key: 'geographic-intelligence' },
  'why-it-matters': { kind: 'dimension', key: 'why-this-matters' },
  'who-is-affected': { kind: 'dimension', key: 'who-is-affected' },
  'how-strong-is-the-evidence': { kind: 'popover', key: 'evidence-support' },
  'what-is-uncertain': { kind: 'dimension', key: 'insufficient-evidence' },
};

const BRIEF_CELL_ORDINALS: Readonly<
  Record<BriefAnswerCellKey, '01' | '02' | '03' | '04' | '05' | '06'>
> = {
  'what-happened': '01',
  where: '02',
  'why-it-matters': '03',
  'who-is-affected': '04',
  'how-strong-is-the-evidence': '05',
  'what-is-uncertain': '06',
};

/** R1 colour errata section 3 — the definitive six-cell accent mapping. */
const BRIEF_CELL_ACCENTS: Readonly<Record<BriefAnswerCellKey, AccentToken>> = {
  'what-happened': 'gn-verified',
  where: 'gn-geo',
  'why-it-matters': 'gn-ai',
  'who-is-affected': 'gn-geo',
  'how-strong-is-the-evidence': 'gn-verified',
  'what-is-uncertain': 'gn-uncertain',
};

export function selectBriefAnswers(response: AnalysisApiResponse): readonly BriefAnswerCell[] {
  const analysis = response.analysis;
  const geography = resolveGeography(response.retrievalContext);
  const meter = resolveEvidenceMeter(analysis?.trustState.level ?? null);

  const highestCitedKeyFact = selectHighestCitedKeyFact(analysis?.keyFacts ?? []);
  const firstRelevance = analysis?.relevance[0] ?? null;
  const significanceLevel = analysis?.significance?.level ?? null;
  const affectedParties = analysis?.affectedParties ?? [];
  const uncertainties = analysis?.uncertainties ?? [];

  const values: Readonly<Record<BriefAnswerCellKey, BriefAnswerValue>> = {
    'what-happened':
      highestCitedKeyFact === null
        ? { kind: 'unresolved' }
        : { kind: 'claim', claim: highestCitedKeyFact },

    // Unresolved geography never gains precision here: the resolver is
    // the only source, and it reports 'unresolved' rather than guessing.
    where:
      geography.precision === 'unresolved'
        ? { kind: 'unresolved' }
        : { kind: 'geography', geography },

    'why-it-matters':
      firstRelevance === null && significanceLevel === null
        ? { kind: 'unresolved' }
        : {
            kind: 'relevance-with-significance',
            claim: firstRelevance,
            significanceLevel,
          },

    'who-is-affected':
      affectedParties.length === 0
        ? { kind: 'unresolved' }
        : { kind: 'affected-parties', parties: affectedParties },

    'how-strong-is-the-evidence': {
      kind: 'evidence-strength',
      meter,
      articlesRetrieved: response.retrievalContext?.articlesRetrieved ?? 0,
      reportingClusterCount: response.sourceDiversity?.reportingClusterCount ?? null,
      distinctSourceNameCount: response.sourceDiversity?.distinctSourceNameCount ?? null,
    },

    'what-is-uncertain': {
      kind: 'uncertainty',
      count: uncertainties.length,
      first: uncertainties[0] ?? null,
    },
  };

  return BRIEF_ANSWER_CELL_KEYS.map((key) => ({
    key,
    ordinal: BRIEF_CELL_ORDINALS[key],
    destination: BRIEF_CELL_DESTINATIONS[key],
    accent: BRIEF_CELL_ACCENTS[key],
    value: values[key],
    significanceBadge: key === 'why-it-matters' ? significanceLevel : null,
    interactive: values[key].kind !== 'unresolved',
  }));
}

/* ------------------------------------------------------------------ *
 * 9. THE DIMENSION VIEW-MODEL
 * ------------------------------------------------------------------ */

export interface SubViewModel {
  readonly key: SubViewKey;
  readonly isPrimarySegment: boolean;
  readonly accent: AccentToken;
  readonly divergenceLabel: SubViewDivergenceLabel | null;
  readonly count: number;
  /**
   * R1 section 1.2: "a segment whose field is empty is not rendered".
   * The primary segment is always present, because a zero-count
   * dimension still renders its own empty state.
   */
  readonly present: boolean;
  readonly hash: string;
}

export interface DimensionModel {
  readonly key: PrimaryDimensionKey;
  readonly accent: AccentToken;
  /**
   * Item count for the index row. Null ONLY for the Executive Brief,
   * which is not a countable list and renders an em dash in the index.
   *
   * Every other dimension carries a number, INCLUDING 0. A zero-count
   * dimension is present, selectable and shows its empty state — it is
   * never removed from the view-model. This deliberately reverses the
   * older presentation behaviour where an empty section disappeared.
   */
  readonly count: number | null;
  readonly countable: boolean;
  /** Always true. Kept explicit so the contract is visible at the call site. */
  readonly present: true;
  /** Always true, including at count 0 (07-INTERACTION-STATES section 1). */
  readonly selectable: true;
  readonly isEmpty: boolean;
  readonly subViews: readonly SubViewModel[];
  /** False when no extra segment survived, per R1 section 1.2. */
  readonly stripVisible: boolean;
  readonly hash: string;
}

export interface AnalysisWorkspaceModel {
  readonly dimensions: readonly DimensionModel[];
  readonly briefAnswers: readonly BriefAnswerCell[];
  readonly context: ContextDisclosureModel;
  readonly watchNext: WatchNextModel;
  readonly relationships: RelationshipsModel;
  readonly insufficientEvidence: InsufficientEvidenceModel;
  readonly geography: GeographicResolution;
  readonly evidenceMeter: EvidenceMeterState;
  readonly sourceSupport: readonly SourceSupportEntry[];
  readonly citationNumbering: ReadonlyMap<string, number>;
  /** True when the AI failed; every dimension degrades to empty, sources survive. */
  readonly analysisUnavailable: boolean;
}

function countFor(key: PrimaryDimensionKey, analysis: NewsAnalysisResult | null): number | null {
  if (key === 'brief') return null;
  if (analysis === null) return 0;

  switch (key) {
    case 'significance':
      return analysis.significance?.rationale.length ?? 0;
    case 'why-this-matters':
      return analysis.relevance.length;
    case 'who-is-affected':
      return analysis.affectedParties.length;
    case 'immediate-effects':
      return analysis.immediateImpacts.length;
    case 'key-facts':
      return analysis.keyFacts.length;
    case 'insufficient-evidence':
      return (analysis.uncertainties?.length ?? 0) + analysis.unknowns.length;
  }
}

function subViewCount(key: SubViewKey, analysis: NewsAnalysisResult | null): number {
  if (analysis === null) return 0;

  switch (key) {
    case 'reported-facts':
      return analysis.keyFacts.length;
    case 'agreements':
      return analysis.agreements.length;
    case 'differences':
      return analysis.differences.length;
    case 'reported-effects':
      return analysis.immediateImpacts.length;
    case 'spillover':
      return analysis.spilloverImplications.length;
    case 'timeline':
      return analysis.timeline.length;
    case 'affected-entities':
      return analysis.affectedParties.length;
    case 'relationships':
      return buildRelationships(analysis.relationalComposition).referenceCount;
  }
}

/**
 * Builds the complete workspace view-model from one already-fetched
 * response. Deterministic: the same response always yields the same
 * model, and no value is read from anywhere but that response.
 */
export function buildAnalysisWorkspaceModel(response: AnalysisApiResponse): AnalysisWorkspaceModel {
  const analysis = response.analysis;

  const dimensions: DimensionModel[] = PRIMARY_DIMENSION_KEYS.map((key) => {
    const count = countFor(key, analysis);
    const definitions = SUB_VIEW_ALLOCATION[key] ?? [];

    const subViews: SubViewModel[] = definitions
      .map((definition) => {
        const segmentCount = subViewCount(definition.key, analysis);
        return {
          key: definition.key,
          isPrimarySegment: definition.isPrimarySegment,
          accent: definition.accent,
          divergenceLabel: definition.divergenceLabel,
          count: segmentCount,
          present: definition.isPrimarySegment || segmentCount > 0,
          hash: subViewHash(key, definition.key),
        };
      })
      .filter((subView) => subView.present);

    const extraSegments = subViews.filter((subView) => !subView.isPrimarySegment);

    return {
      key,
      accent: DIMENSION_ACCENTS[key],
      count,
      countable: key !== 'brief',
      present: true,
      selectable: true,
      isEmpty: count === 0,
      subViews,
      stripVisible: extraSegments.length > 0,
      hash: `#${key}`,
    };
  });

  return {
    dimensions,
    briefAnswers: selectBriefAnswers(response),
    context: {
      items: analysis?.context ?? [],
      count: analysis?.context.length ?? 0,
      present: (analysis?.context.length ?? 0) > 0,
      accent: 'gn-ai',
    },
    watchNext: {
      items: analysis?.watchNext ?? [],
      count: analysis?.watchNext.length ?? 0,
      present: (analysis?.watchNext.length ?? 0) > 0,
      accent: 'gn-ai',
      qualifier: 'AI_PROJECTED_NOT_A_FORECAST',
    },
    relationships: buildRelationships(analysis?.relationalComposition),
    insufficientEvidence: {
      citedUncertainties: analysis?.uncertainties ?? [],
      uncitedUnknowns: analysis?.unknowns ?? [],
      citedCount: analysis?.uncertainties?.length ?? 0,
      uncitedCount: analysis?.unknowns.length ?? 0,
      totalCount: (analysis?.uncertainties?.length ?? 0) + (analysis?.unknowns.length ?? 0),
    },
    geography: resolveGeography(response.retrievalContext),
    evidenceMeter: resolveEvidenceMeter(analysis?.trustState.level ?? null),
    sourceSupport: buildSourceSupport(response),
    citationNumbering: buildCitationNumbering(analysis?.sources, response.articles),
    analysisUnavailable: analysis === null,
  };
}
