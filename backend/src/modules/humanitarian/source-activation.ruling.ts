/**
 * ════════════════════════════════════════════════════════════════════════════
 * HUMANITARIAN SOURCE ADMISSION, RIGHTS AND ACTIVATION — E1 RULING R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * HUMANITARIAN-E1-SOURCE-ACTIVATION-R1.
 *
 * This file is a RULING, encoded. It is not a provider, not a client, not a
 * scheduler and not a registration: it imports nothing from this monorepo and
 * nothing from `node:*`, so it cannot acquire, persist or render anything. The
 * only behaviour it has is REFUSAL.
 *
 * ── WHY IT IS CODE AND NOT A DOCUMENT ────────────────────────────────────
 *
 * E1 has measured twice in this project what a ruling that lives only in prose
 * is worth. E1-P-1: `PROTECTED` was vocabulary rather than behaviour across 160
 * surface × kind combinations. The producer's own file says the same thing about
 * its disabled state — "the disabled state is a property of the code rather than
 * of a config file somebody has to remember not to change". A matrix in a
 * markdown file is a config file somebody has to remember not to change.
 *
 * So the six-value verdict vocabulary, the three verdicts, the field allowlists,
 * the rights scope and the geometry precision rule are all declarations a test
 * can read, and the acquisition guard refuses for every declared source. If a
 * later lane flips a verdict to `CLEARED_FOR_ALPHA_RUNTIME`, the spec fails by
 * name; it does not quietly become true.
 *
 * ── WHAT THIS RULING DOES NOT DO ─────────────────────────────────────────
 *
 * It activates nothing. It weakens no geometry protection — every protection
 * decision still belongs to the installed `ProtectionAuthority`, and this file
 * declares no class id, no partition key and no rule for choosing either, for
 * the same reason the Copernicus producer does not. It invents no Product Owner
 * rights approval: where PO confirmation is required, the exact question is
 * carried as a blocking condition and the verdict stays short of runtime.
 */

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · THE FIXED VERDICT VOCABULARY
 * ══════════════════════════════════════════════════════════════════════════ */

export const SOURCE_ACTIVATION_VERDICTS = [
  /** A reviewed, hash-bound, offline capture may be taken. NOT a runtime fetch. */
  'CLEARED_FOR_DEV_CAPTURE',
  /** The only verdict that authorises acquisition by a running Alpha process. */
  'CLEARED_FOR_ALPHA_RUNTIME',
  'NOT_CLEARED',
  'CREDENTIAL_REQUIRED',
  'RIGHTS_CONFIRMATION_REQUIRED',
  'PROTECTION_AUTHORITY_REQUIRED',
] as const;

export type SourceActivationVerdict = (typeof SOURCE_ACTIVATION_VERDICTS)[number];

/**
 * THE ONE VERDICT THAT PERMITS ACQUISITION, DERIVED RATHER THAN RESTATED.
 *
 * A second hand-written list of "runtime-permitting verdicts" drifts from the
 * first the moment a seventh verdict is added — silently, because both lists
 * look correct in isolation. The same technique the geometry contract uses for
 * `READER_PRESENTABLE_DERIVATION_METHODS`, and for the same reason.
 */
export const RUNTIME_PERMITTING_VERDICT: SourceActivationVerdict = 'CLEARED_FOR_ALPHA_RUNTIME';

export function verdictPermitsRuntimeAcquisition(verdict: SourceActivationVerdict): boolean {
  return verdict === RUNTIME_PERMITTING_VERDICT;
}

/**
 * DEV CAPTURE IS NOT RUNTIME ACQUISITION.
 *
 * Stated as a function rather than a sentence because the confusion is the
 * predictable one: a reviewed offline capture is evidence a human fetched and
 * hashed, and the retained-evidence admission path already requires a
 * hash-bound approval that cannot be read from the candidate body. A scheduled
 * process that fetches the same bytes is a different thing with a different
 * verdict.
 */
export function devCaptureImpliesRuntime(): false {
  return false;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · RIGHTS SCOPE — FEED-LEVEL IS NOT ITEM-LEVEL
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The standing instruction: "Do not treat a feed-level licence as automatically
 * covering every linked article, image or third-party item. 'Curated' is not a
 * rights basis."
 *
 * Both halves get a call site here rather than a paragraph.
 */

export const RIGHTS_SCOPES = [
  /** The publisher's own structured record: identifiers, dates, codes, geometry. */
  'PUBLISHER_OWN_RECORD',
  /** Text the publisher itself authored and published under the cited instrument. */
  'PUBLISHER_OWN_PROSE',
  /** An item the publisher relays from someone else. Rights are the author's. */
  'THIRD_PARTY_ITEM',
  /** A binary the publisher relays: attachment, map image, photograph. */
  'THIRD_PARTY_BINARY',
] as const;

export type RightsScope = (typeof RIGHTS_SCOPES)[number];

/** A feed-level instrument covers the publisher's own material and nothing else. */
export const FEED_LEVEL_COVERED_SCOPES: readonly RightsScope[] = Object.freeze([
  'PUBLISHER_OWN_RECORD',
  'PUBLISHER_OWN_PROSE',
]);

export class RightsScopeRefused extends Error {}

export function assertFeedLevelLicenceCovers(scope: RightsScope): void {
  if (FEED_LEVEL_COVERED_SCOPES.indexOf(scope) === -1) {
    throw new RightsScopeRefused(
      `RIGHTS_SCOPE_NOT_COVERED_BY_FEED_INSTRUMENT: '${scope}'. A feed-level licence is the ` +
        "publisher's grant over the publisher's own material. The author of a relayed item " +
        'granted nothing, and an aggregator cannot grant what it does not hold.',
    );
  }
}

const REFUSED_RIGHTS_BASIS_WORDS: readonly string[] = Object.freeze([
  'curated',
  'curation',
  'aggregated',
  'publicly available',
  'public domain by practice',
  'fair use',
]);

export class RightsBasisRefused extends Error {}

/**
 * A rights basis names an INSTRUMENT. It does not describe how the data was
 * collected or how widely it can be seen.
 */
export function assertRightsBasisIsAnInstrument(basis: string): void {
  const normalised = basis.trim().toLowerCase();
  if (normalised.length === 0) {
    throw new RightsBasisRefused(
      'RIGHTS_BASIS_EMPTY: an empty basis satisfies every "has a rights basis" assertion ' +
        'vacuously. E1 rule R-B.',
    );
  }
  for (const word of REFUSED_RIGHTS_BASIS_WORDS) {
    if (normalised === word || normalised.startsWith(word + ' ') || normalised === word + '.') {
      throw new RightsBasisRefused(
        `RIGHTS_BASIS_NOT_AN_INSTRUMENT: '${basis}'. That describes how the data was obtained ` +
          'or how visible it is, not who granted which acts to whom.',
      );
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · SCOPE COMPLETENESS — AND THE INVENTORY THAT MUST NEVER BE PUBLISHED
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The Copernicus terms restrict some activations under Article 53 of Regulation
 * (EU) 2021/696. The producer's rights block already states the consequence and
 * it is the counter-intuitive one: *never publish an activation inventory, and
 * never publish "no activation here" — the gaps would be the sensitive ones.*
 *
 * The same shape already exists in the alerts lane as `scopeCompleteness`, where
 * no declared source reaches `ALL_ACTIVE_FOR_SCOPE`. This ruling declares the
 * value for all three humanitarian sources and refuses the claim in code, so a
 * reader-facing "complete for this area" cannot be asserted by a later caller
 * without tripping a guard.
 */

export const SCOPE_COMPLETENESS_STATES = [
  'ALL_ACTIVE_FOR_SCOPE',
  'SUBSET_BY_PUBLISHER_SELECTION',
  'COMPLETENESS_NOT_ESTABLISHED',
] as const;

export type ScopeCompleteness = (typeof SCOPE_COMPLETENESS_STATES)[number];

export class ScopeCompletenessRefused extends Error {}

export function assertNoCompletenessClaim(sourceId: string, state: ScopeCompleteness): void {
  if (state === 'ALL_ACTIVE_FOR_SCOPE') {
    throw new ScopeCompletenessRefused(
      `HUMANITARIAN_COMPLETENESS_CLAIM_REFUSED: '${sourceId}' may not assert ALL_ACTIVE_FOR_SCOPE. ` +
        'An exhaustive activation list and a statement that an area has no activation are the ' +
        'same disclosure read from opposite ends, and the restricted activations are exactly the ' +
        'ones the gaps would locate.',
    );
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4 · PROTECTED GEOMETRY — WHAT MAY NEVER ARRIVE, AT ANY PRECISION
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The accepted geometry contract already decides what happens to a record once
 * it exists: protection resolves before capability, `PROTECTED` maps to
 * `NOT_SHOWN`, a protective coarsening never reaches a reader, and an aggregate
 * over an incomplete set is refused. None of that is restated here and none of
 * it is weakened.
 *
 * What this ruling adds is ADMISSION. The contract's fail-closed behaviour
 * protects a record it holds; it cannot protect against a denotation that
 * should never have been ingested, because the denotation IS the disclosure:
 * a facility outline is sensitive at full precision and sensitive coarsened,
 * since a coarsened facility still says "a facility is here".
 *
 * WITHHOLD RATHER THAN TRANSFORM — the producer's own rule, and the reason this
 * list refuses rather than coarsens. There is no coarsening path on the reader
 * side (`PROTECTIVE_COARSENING_PRESENTATION` is held unreachable by design), so
 * a ruling that answered "admit it, coarsened" would be asking for a path the
 * accepted contract deliberately does not have.
 */

export const ADMITTED_HUMANITARIAN_DENOTATIONS: readonly string[] = Object.freeze([
  /** The flooded/burned/affected extent itself. The Copernicus producer's denotation. */
  'AFFECTED_AREA',
  /** A pre-existing public unit. The partition ladder is built from these. */
  'ADMINISTRATIVE_UNIT',
  /** The publisher's own reference location for the event, as published. */
  'EVENT_LOCATION',
]);

/**
 * REFUSED AT ADMISSION, WITH THE REASON EACH ONE IS REFUSED.
 *
 * Carried as a reasoned map rather than a bare list, because the next lane that
 * wants one of these will want to know which argument it has to beat.
 */
export const REFUSED_HUMANITARIAN_DENOTATIONS: Readonly<Record<string, string>> = Object.freeze({
  ASSET_OR_FACILITY:
    'A facility outline is the protected fact. Coarsening does not help: a coarsened ' +
    'facility still says a facility is there, and on a humanitarian surface that is the ' +
    'whole question. PROTECTION_AUTHORITY_REQUIRED, never an admission default.',
  OBSERVATION_FOOTPRINT:
    'The sensor coverage is what was TASKED, not what was observed. Publishing the set of ' +
    'footprints publishes the activation inventory sideways, and Article 53 restricted ' +
    'activations are precisely the ones the gaps locate.',
  SOURCE_REPORTED_CENTROID:
    'A polygon arriving wearing a point’s clothes. The producer refuses the coercion; ' +
    'admitting the denotation would reintroduce it upstream of the refusal.',
  DERIVED_REPRESENTATIVE_POINT:
    'Ours, not the publisher’s. GEOMETRY_SOURCE_CENTROID_IS_NOT_OURS exists because this ' +
    'is the confusion that actually happens.',
  ANALYSIS_EXTENT:
    'Our analysis boundary, not a source assertion. Admitting it from a source would make ' +
    'the source the claimant of our own scoping decision.',
});

export class DenotationNotAdmitted extends Error {}

export function assertDenotationAdmitted(sourceId: string, denotation: string): void {
  if (ADMITTED_HUMANITARIAN_DENOTATIONS.indexOf(denotation) !== -1) return;
  const reason = REFUSED_HUMANITARIAN_DENOTATIONS[denotation];
  throw new DenotationNotAdmitted(
    `HUMANITARIAN_DENOTATION_NOT_ADMITTED: '${sourceId}' may not supply '${denotation}'. ` +
      (reason ?? 'Not on the admitted list. An undeclared denotation is refused, not defaulted.'),
  );
}

/**
 * THE INFERENCE SURFACES. Each one is a thing a reader could learn from a shape
 * that is individually harmless.
 *
 * Numbers 3 and 5 are already guarded by the accepted contract
 * (`assertNoGeometricAggregateOverSet`, `declaredEligibleMembership`); they are
 * named here so a reader of this ruling does not have to know that to see the
 * whole set.
 */
export const PROTECTED_INFERENCE_SURFACES: readonly string[] = Object.freeze([
  'EXHAUSTIVE_ACTIVATION_INVENTORY',
  'ABSENCE_ASSERTION_FOR_AN_AREA',
  'SET_AGGREGATE_OVER_A_SET_WITH_A_WITHHELD_MEMBER',
  'FACILITY_OR_ASSET_GEOMETRY_AT_ANY_PRECISION',
  'FIRST_APPEARANCE_TIMING_OF_A_PROTECTED_PARTITION',
  'PERSON_LEVEL_PROFILE_BUILT_FROM_PUBLIC_POLICY_MONITORING',
]);

/* ══════════════════════════════════════════════════════════════════════════
 * 5 · THE THREE RULINGS
 * ══════════════════════════════════════════════════════════════════════════ */

export const HUMANITARIAN_SOURCE_IDS = ['GDACS', 'RELIEFWEB', 'COPERNICUS_EMS'] as const;
export type HumanitarianSourceId = (typeof HUMANITARIAN_SOURCE_IDS)[number];

export interface SourceActivationRuling {
  readonly sourceId: HumanitarianSourceId;
  readonly verdict: SourceActivationVerdict;
  /** ISO-8601. A ruling that cannot be dated cannot be shown to precede an activation. */
  readonly ruledAt: string;
  /** The INSTRUMENT. Checked by `assertRightsBasisIsAnInstrument`. */
  readonly rightsBasis: string;
  readonly rightsEvidenceUrl: string;
  /** Verbatim, or `null` when the publisher’s own wording has not been retrieved. */
  readonly attributionVerbatim: string | null;
  /** The exact host a governed fetch would have to name. DECLARED, not registered. */
  readonly governedHost: string;
  readonly permittedEndpoints: readonly string[];
  readonly admittedFields: readonly string[];
  readonly refusedFields: Readonly<Record<string, string>>;
  readonly scopeCompleteness: ScopeCompleteness;
  readonly prohibitedInterpretations: readonly string[];
  /** Every condition that must close before the verdict could move. Never empty here. */
  readonly blockingConditions: readonly string[];
}

const GDACS: SourceActivationRuling = {
  sourceId: 'GDACS',
  /*
    CLEARED_FOR_DEV_CAPTURE AND NOT ONE STEP FURTHER.

    A reviewed, hash-bound offline capture for internal review is not
    communication to the public, and the retained-evidence path already keeps
    those two apart: `decideSecuritySourceEligibility` returns
    `publicEvidencePermitted: false` with "retention confers no public
    eligibility", and the retained store grants no reader role access to raw
    captures.

    It is NOT cleared further, and the reason is on the record rather than in a
    judgement call: the GDACS Terms of use state no licence model and grant no
    express act. "Free to retrieve" and "licensed to redistribute" are different
    facts, and the second one is the one a reader-facing surface needs.
  */
  verdict: 'CLEARED_FOR_DEV_CAPTURE',
  ruledAt: '2026-10-01',
  rightsBasis:
    'GDACS Terms of use (March 2025), read with the GDACS MHEWS API quickstart v1. The ' +
    'quickstart states the acknowledgement GDACS requests; the Terms of use state no licence ' +
    'model and enumerate no granted act, and supply the data "as is" without warranty.',
  rightsEvidenceUrl: 'https://www.gdacs.org/documents/2025/GDACS_Terms_of_use_Mar_25.pdf',
  /* Verbatim from the API quickstart, which is where GDACS states it. */
  attributionVerbatim: 'Global Disaster Alert and Coordination System, GDACS',
  governedHost: 'www.gdacs.org',
  permittedEndpoints: Object.freeze([
    'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH',
    'https://www.gdacs.org/gdacsapi/api/events/geteventlist/events4app',
  ]),
  /*
    IDENTIFIERS, TIMES, PLACES AND THE PUBLISHER'S OWN GEOMETRY. Nothing that
    states an impact, and nothing that carries markup.
  */
  admittedFields: Object.freeze([
    'eventtype',
    'eventid',
    'episodeid',
    'name',
    'fromdate',
    'todate',
    'datemodified',
    'iso3',
    'affectedcountries',
    'alertlevel',
    'episodealertlevel',
    'bbox',
    'geometry',
    'url.details',
    'url.report',
  ]),
  refusedFields: Object.freeze({
    htmldescription:
      'Publisher-authored markup. Rights are covered, but it is a stored-content injection ' +
      'surface and it carries interpretation we would be restating as our own.',
    description:
      'Same prose, same interpretation problem, minus the markup. Admit the identifiers and ' +
      'link to the publisher instead of paraphrasing a disaster.',
    severitydata:
      'An impact ESTIMATE. The Terms of use say alerts "may require further validation" and ' +
      '"should not be used for decision making without prior confirmation of their validity"; ' +
      'storing the number as a fact is exactly the confirmation nobody performed.',
    sendai:
      'Indicator figures. Same objection as severitydata, with a framework name attached that ' +
      'would lend them authority they do not carry at this stage.',
    impacts:
      'Links to impact figures. Admitting the link is admitting the figure one hop later.',
    icon: 'A styling binary. No evidentiary content, and a third-party asset on the wire.',
    glide: 'Not needed for identity, and an undeclared field is refused rather than defaulted.',
  }),
  scopeCompleteness: 'COMPLETENESS_NOT_ESTABLISHED',
  prohibitedInterpretations: Object.freeze([
    'Do not restate `alertlevel` or `episodealertlevel` as our own severity judgement; it is ' +
      "GDACS's score, attributed to GDACS or not shown.",
    'Do not present population-exposure or Sendai figures as observed impact.',
    'Do not treat the event geometry as the exact location of anything; it is the publisher’s ' +
      'reference point for an event, which is why its denotation is EVENT_LOCATION.',
    'Do not present GDACS output as a basis for action: the publisher states its alerts must ' +
      'not substitute official local or national authority information.',
  ]),
  blockingConditions: Object.freeze([
    'RIGHTS: the Terms of use grant no express act of reproduction, distribution or ' +
      'communication to the public. No reader-facing surface may carry GDACS content until a ' +
      'grant is confirmed. PRODUCT OWNER QUESTION, STATED ONCE, BELOW.',
    'TRANSPORT: `www.gdacs.org` is not a registered governed host. ' +
      '`assertUrlIsFetchable` compares the hostname EXACTLY against the registry, so an ' +
      'unregistered host refuses as HOST_NOT_THE_GOVERNED_HOST. Registration is a separate ' +
      'authorised change and this ruling does not make it.',
    'FIELDS: the admitted list is derived from the GDACS API quickstart and the IFRC Monty ' +
      'model, both DOCUMENTATION. No capture has been taken, so field presence, types and ' +
      'nesting are UNMEASURED (E1 rule R-C) and must be verified against the first reviewed ' +
      'capture before any admission test is called passing.',
  ]),
};

const RELIEFWEB: SourceActivationRuling = {
  sourceId: 'RELIEFWEB',
  /*
    CREDENTIAL_REQUIRED, AND IT BITES BEFORE THE DEV CAPTURE, NOT AFTER IT.

    ReliefWeb requires a PRE-APPROVED `appname` from 1 November 2025. Today is
    2026-10-01, so the requirement is in force now — not pending. A capture
    taken without one is a call made outside the publisher's stated terms, which
    is why this verdict is not CLEARED_FOR_DEV_CAPTURE with a note.
  */
  verdict: 'CREDENTIAL_REQUIRED',
  ruledAt: '2026-10-01',
  rightsBasis:
    'ReliefWeb API Terms of Service: "Anyone can use the ReliefWeb API. Reports, Jobs and ' +
    'Training data available via ReliefWeb API is contributed by information partners and may ' +
    'contain copyrighted material." Users must respect the intellectual property rights of the ' +
    'original source. The ReliefWeb site itself is under Creative Commons Attribution 4.0 ' +
    'International; that covers ReliefWeb’s own material and NOT a partner’s report.',
  rightsEvidenceUrl: 'https://apidoc.reliefweb.int/',
  attributionVerbatim: null,
  governedHost: 'api.reliefweb.int',
  permittedEndpoints: Object.freeze(['https://api.reliefweb.int/v2/reports']),
  /*
    METADATA AND THE PUBLISHER'S OWN POINTERS. The report itself stays at the
    publisher, which is also the only reading of "respect the intellectual
    property rights of the original source" that survives contact with a
    retention store.
  */
  admittedFields: Object.freeze([
    'id',
    'title',
    'url',
    'url_alias',
    'origin',
    'source.name',
    'source.shortname',
    'source.homepage',
    'date.created',
    'date.changed',
    'date.original',
    'language',
    'format',
    'theme',
    'disaster',
    'country',
    'primary_country',
  ]),
  refusedFields: Object.freeze({
    body:
      'THE FULL TEXT OF SOMEONE ELSE’S REPORT. "Main text in Markdown format" is the whole ' +
      'work, the rights are the contributing partner’s, and a feed-level instrument does not ' +
      'convey them. RightsScope THIRD_PARTY_ITEM.',
    'body-html':
      'The same work in markup. Refused for the rights reason and again for the injection ' +
      'surface.',
    file:
      'Partner attachments — PDFs, datasets. THIRD_PARTY_BINARY. Also the usual place a ' +
      'person-level annex hides inside an otherwise aggregate report.',
    image: 'Partner imagery. THIRD_PARTY_BINARY, and frequently photographs of people.',
    headline:
      'ReliefWeb’s editorial selection plus a summary of the partner’s text. Mixed ' +
      'authorship in one field is the shape that defeats attribute-level authorship.',
  }),
  scopeCompleteness: 'SUBSET_BY_PUBLISHER_SELECTION',
  prohibitedInterpretations: Object.freeze([
    'Do not attribute a partner’s report to ReliefWeb. ReliefWeb relayed it; the partner ' +
      'wrote it, and `source.name` is who must be cited.',
    'Do not treat the result set as the state of a crisis. It is what partners submitted and ' +
      'ReliefWeb selected — SUBSET_BY_PUBLISHER_SELECTION, and the gaps are editorial.',
    'Do not derive a person-level or facility-level record from report prose. Monitoring a ' +
      'published policy statement and profiling the people named in it are different activities ' +
      'and only the first is in scope.',
  ]),
  blockingConditions: Object.freeze([
    'CREDENTIAL: a pre-approved `appname` must be obtained (request form linked from the API ' +
      'parameters documentation) before ANY call, including a development capture. The ' +
      'requirement took effect 1 November 2025 and is in force today.',
    'QUOTA: the publisher states a maximum of 1000 calls per day and 1000 entries per call. ' +
      'Any future acquisition design must declare a ceiling under those numbers and a shared ' +
      'budget with the alerts lane, which names ReliefWeb as GATED for the same reason.',
    'RIGHTS: `body`, `body-html`, `file` and `image` carry third-party copyright and are ' +
      'refused at admission, not filtered at presentation. A later lane that wants an excerpt ' +
      'needs an item-level basis, not this instrument.',
    'TRANSPORT: `api.reliefweb.int` is not a registered governed host, and the credential ' +
      'would have to be held where a producer cannot read it.',
  ]),
};

const COPERNICUS_EMS: SourceActivationRuling = {
  sourceId: 'COPERNICUS_EMS',
  /*
    THE EXISTING `NOT_CLEARED` IS RE-EVALUATED AND REPLACED BY A MORE SPECIFIC
    VERDICT, NOT A WEAKER ONE.

    `HUMANITARIAN_PRODUCER_ACTIVATION = 'NOT_CLEARED'` was correct and stays
    true of ACTIVATION. What this ruling adds is WHICH GATE IS BINDING, because
    "not cleared" does not tell the next lane what to do.

    Measured in this tree, at this base: `HUMANITARIAN_PROVISIONING` is
    `undefined`, so `humanitarianModuleImports()` returns an empty array, the
    authority module is never imported and no `ProtectionAuthority` is ever
    installed. Every consequence follows from that one fact —
    `assertAuthorityIsInstalled` refuses, `keyFor` cannot return keys, and every
    record would be withheld as `RECORD_NOT_KEYED_BY_AUTHORITY`. The binding
    gate is protection authority, and it is binding BEFORE rights and before
    transport.

    RIGHTS IMPROVED AND ARE STILL NOT COMPLETE. One of the five conditions the
    producer carried is now discharged: the Copernicus citation wording has been
    retrieved verbatim and is recorded below, so "reworded attribution is not
    attribution" no longer blocks on a missing string. Commercial use is still
    not addressed on the publisher’s terms page, so the E-5 reading stays
    CONDITIONAL and remains a Product Owner item.
  */
  verdict: 'PROTECTION_AUTHORITY_REQUIRED',
  ruledAt: '2026-10-01',
  rightsBasis:
    'Copernicus EMS On-Demand Mapping Terms and Conditions: "free, full and open access to ' +
    'Copernicus Service Information without any express or implied warranty"; permitted acts ' +
    '"(a) reproduction; (b) distribution; (c) communication to the public; (d) adaptation, ' +
    'modification and combination with other data" and "(e) any combination of points (a) to ' +
    '(d)". Attribution: "Where the user communicates to the public or distributes data of the ' +
    'CEMS On-Demand Mapping, he/she shall inform the recipients of the source of that data".',
  rightsEvidenceUrl: 'https://mapping.emergency.copernicus.eu/terms-and-conditions/',
  /*
    VERBATIM, RETRIEVED THIS ROUND FROM THE PUBLISHER’S CITATION GUIDELINES.
    The On-Demand Mapping form is the one this producer needs; the
    activation-specific forms are recorded in RIGHTS-AND-ATTRIBUTION.md.
  */
  attributionVerbatim:
    'Copernicus Emergency Management Service On-Demand Mapping (© European Union, 2012-present_year)',
  governedHost: 'mapping.emergency.copernicus.eu',
  /* No endpoint is ruled permitted: the binding gate is upstream of transport. */
  permittedEndpoints: Object.freeze([]),
  /*
    EXACTLY THE FIELDS THE EXISTING PRODUCER READS. This ruling does not widen
    the producer’s payload type by one field, because a producer that carried a
    place to put a population count would eventually have one put there.
  */
  admittedFields: Object.freeze([
    'activationCode',
    'productId',
    'featureId',
    'geometryType',
    'crs',
    'coordinates',
  ]),
  refusedFields: Object.freeze({
    population:
      'The producer publishes no population field and an observed-event delineation states ' +
      'none. Admitting one would invent the figure at the boundary.',
    severity: 'Not published by a delineation. Same objection.',
    accessState: 'Not published by a delineation. Same objection.',
    impactCount: 'Not published by a delineation. Same objection.',
    classification:
      'A protection decision. GX-3 assigns `protectionClassId` upstream from a declared ' +
      'class and never computes it from the payload; a source-supplied classification is the ' +
      'payload steering its own protection.',
    thirdPartyLayer:
      'Third-party data reached through the portal "may be subject to different license ' +
      'terms" and must be separated at ingestion, not admitted alongside EMS product data.',
  }),
  scopeCompleteness: 'COMPLETENESS_NOT_ESTABLISHED',
  prohibitedInterpretations: Object.freeze([
    'Never publish an activation inventory, and never publish "no activation here". Some ' +
      'activations are restricted under Article 53 of Regulation (EU) 2021/696, and an ' +
      'exhaustive list and an absence claim disclose the same gaps from opposite ends.',
    'Do not present an inundation extent as a statement about people. The denotation is ' +
      'AFFECTED_AREA: it says where the water is, not who was in it.',
    'Do not restate "for information purposes only" data as a finding.',
    'Do not infer rights over a linked third-party layer from the EMS instrument.',
  ]),
  blockingConditions: Object.freeze([
    'PROTECTION AUTHORITY (BINDING): no reviewed `GovernedAuthorityStore` binding exists — ' +
      '`HUMANITARIAN_PROVISIONING` is `undefined` at this base. No authority is installed, so ' +
      'no record can be keyed and every record would be withheld. Provisioning plus a passing ' +
      'boot validation is the gate.',
    'PROTECTION CLASSES: the protected-class and partition declarations are E1’s to author ' +
      'and are not authored at this base. An empty registry is refused by GA-44 at seal time, ' +
      'which is the correct behaviour and also means activation cannot proceed on silence.',
    'RIGHTS (CONDITIONAL): commercial use is not addressed on the publisher’s terms page. ' +
      'PRODUCT OWNER QUESTION, STATED ONCE, BELOW.',
    'WRITE PATH: PA-E1-1, the column-level GRANT preventing a producer role from blanking ' +
      '`protection_class_id` and `presentation_partition_key`, must be in force in the ' +
      'provisioned store before any write path is wired. E1 executed that attack before the ' +
      'grant existed and it succeeded with `UPDATE 1`.',
  ]),
};

export const HUMANITARIAN_SOURCE_RULINGS: Readonly<
  Record<HumanitarianSourceId, SourceActivationRuling>
> = Object.freeze({
  GDACS,
  RELIEFWEB,
  COPERNICUS_EMS,
});

/**
 * THE TWO PRODUCT OWNER QUESTIONS, STATED ONCE EACH AND NOT ASSUMED ANSWERED.
 *
 * The contract's instruction is "If PO confirmation is genuinely required: state
 * the exact question once." These are those questions, verbatim, as constants a
 * register entry can quote rather than paraphrase.
 */
export const PRODUCT_OWNER_RIGHTS_QUESTIONS: readonly string[] = Object.freeze([
  'COPERNICUS_EMS: the EMS On-Demand Mapping terms grant reproduction, distribution, ' +
    'communication to the public and adaptation under "free, full and open access", and do not ' +
    'mention commercial use either way. Do you accept that grant as covering GlobalNews AI’s ' +
    'commercial use, with the verbatim citation applied — yes or no?',
  'GDACS: the GDACS Terms of use state no licence model and grant no express act, while the API ' +
    'documentation requests acknowledgement as "Global Disaster Alert and Coordination System, ' +
    'GDACS". Do you authorise seeking a written grant from JRC/GDACS before any reader-facing ' +
    'use — yes or no?',
]);

/* ══════════════════════════════════════════════════════════════════════════
 * 6 · THE ACQUISITION GUARD — DERIVED FROM THE RULINGS, NOT RESTATED
 * ══════════════════════════════════════════════════════════════════════════ */

export class HumanitarianAcquisitionRefused extends Error {}

/**
 * Refuses unless the source's own ruling carries the runtime-permitting verdict.
 *
 * It reads `HUMANITARIAN_SOURCE_RULINGS`, so there is no second place where the
 * answer could be stated differently — the failure the producer's `governedCode`
 * lookup exists to prevent, applied to verdicts instead of refusal codes.
 */
export function assertAcquisitionPermitted(sourceId: string): void {
  const ruling = (HUMANITARIAN_SOURCE_RULINGS as Readonly<Record<string, SourceActivationRuling>>)[
    sourceId
  ];
  if (ruling === undefined) {
    throw new HumanitarianAcquisitionRefused(
      `HUMANITARIAN_SOURCE_NOT_RULED: '${sourceId}' has no activation ruling. An unruled source ` +
        'is refused, never defaulted — an incomplete set satisfies every "contains no ' +
        'unauthorised source" assertion vacuously (E1 rule R-B).',
    );
  }
  if (!verdictPermitsRuntimeAcquisition(ruling.verdict)) {
    throw new HumanitarianAcquisitionRefused(
      `HUMANITARIAN_ACQUISITION_NOT_PERMITTED: '${sourceId}' is ruled '${ruling.verdict}'. ` +
        `Blocking conditions: ${ruling.blockingConditions.length}. Only ` +
        `'${RUNTIME_PERMITTING_VERDICT}' authorises acquisition by a running process, and no ` +
        'source holds it under this ruling.',
    );
  }
}

/** Field admission, closed per source. An undeclared field is refused. */
export function assertFieldAdmitted(sourceId: HumanitarianSourceId, field: string): void {
  const ruling = HUMANITARIAN_SOURCE_RULINGS[sourceId];
  if (ruling.admittedFields.indexOf(field) !== -1) return;
  const reason = ruling.refusedFields[field];
  throw new RightsScopeRefused(
    `HUMANITARIAN_FIELD_NOT_ADMITTED: '${sourceId}.${field}'. ` +
      (reason ?? 'Not on the admitted list for this source.'),
  );
}
