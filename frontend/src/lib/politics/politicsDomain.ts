import type { SpecialistDomainConfig } from '@/lib/specialist/specialistDomain';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART VIII · POLITICS — THE DOMAIN VOCABULARIES, AND THE SEAM THAT IS NOT WIRED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Everything here is Part VIII's own vocabulary, transcribed. Nothing is invented, nothing
 * is ranked, and no value in this file is an observation about any country, party, person
 * or institution.
 *
 * ── THE SEAM THIS LANE MAY NOT CLOSE ──────────────────────────────────────
 *
 * `SpecialistDomainId` has SIX members — `CONFLICT · ELECTION · DELIVERY · ECONOMY ·
 * MARKET · SECURITY` — and **`POLITICS` is not one of them.** `ELECTION` is there, and it
 * is NOT this domain: Part VIII's own R01 makes Election **object O2**, one of three
 * persistent subject types inside Politics, alongside Legislative Subject and Protest /
 * Mobilisation Campaign. Mapping the domain onto one of its own objects would be inventing
 * an equivalence the design does not state.
 *
 * Widening that union is a shared-contract change, and E1's Politics review already carries
 * it as an open item — **S-4 `SpecialistDomainId` frontend union · SAFE TO DEFER**, with
 * the note that it *"remains a presentation-layer change"*. It is deferred, not decided.
 *
 * So this lane does not register Politics and does not widen the union. It writes the
 * config that registration will take, exactly as `registerSpecialistDomain` will receive
 * it, and leaves it unregistered. `POLITICS_DOMAIN_SEAM` below is that object — the
 * integration seam prepared, the decision left where it belongs.
 *
 * ── WHAT THE FRAME USES INSTEAD, AND WHY THAT IS NOT A SECOND ARCHITECTURE ─
 *
 * `SpecialistHudLine` takes `domain: string`, not `SpecialistDomainId`, so the shared HUD
 * grammar is consumed directly. `HUD_SLOTS`, the R14 geometry caps and the Spatial `sp-*`
 * token family are all shared and all used unchanged. The two shared modules that DO type
 * their domain — `attentionQueue` and `participantEntity` — need a domain id only to carry
 * an item or an actor, and this frame carries neither: with no observation there is no
 * ranked row and no political actor to name. The geometry those modules will occupy is
 * rendered; the typed payloads are the thing waiting on the seam.
 */

/* ───────────────────────────────────────────────────────────────────────────
 * §5 · THE FOUR AXES, AND THE RULE THAT KEEPS THEM APART
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Phase 1 §5, which is a prohibition before it is a vocabulary:
 *
 *   *"Political status, lifecycle event, shared change state and confidence are four
 *   independent axes and are never merged into a single chip or colour."*
 *
 * They are four exported constants for that reason. A single `PoliticsState` union would
 * be the merge the spec forbids, arriving as a type rather than as a chip, and it is the
 * easiest version of this mistake to make and the hardest to see afterwards.
 *
 * §5 also carries a second prohibition this file must honour by ABSENCE: *"No political
 * severity ladder is created; Conflict severity is not inherited."* There is no severity
 * constant here, and `CONFLICT_SEVERITIES` is not imported.
 */

/** Axis 1 — where a persistent subject currently stands. Never a judgement of it. */
export const POLITICS_SUBJECT_TYPES = [
  'ELECTION',
  'LEGISLATIVE_SUBJECT',
  'PROTEST_CAMPAIGN',
] as const;
export type PoliticsSubjectType = (typeof POLITICS_SUBJECT_TYPES)[number];

/**
 * Axis 2 — the lifecycle event that last moved a subject.
 *
 * R08's model is an event ON a subject, never a subject of its own. The members here are
 * the event KINDS Part VIII's R01 names in O7 — *"vote, resignation, appointment, court
 * ruling, coalition agreement, commission decision, rally"* — and nothing else. G measured
 * **0 of 24 producers** for these, so not one of them can be populated today.
 */
export const POLITICS_EVENT_KINDS = [
  'VOTE',
  'RESIGNATION',
  'APPOINTMENT',
  'COURT_RULING',
  'COALITION_AGREEMENT',
  'COMMISSION_DECISION',
  'RALLY',
] as const;
export type PoliticsEventKind = (typeof POLITICS_EVENT_KINDS)[number];

/** Axis 3 — the SHARED change state. Politics adds no member and renames none. */
export const POLITICS_CHANGE_AXIS = 'SHARED_CHANGE_STATE' as const;

/** Axis 4 — confidence, carried with its limitations (§6), never as a score. */
export const POLITICS_CONFIDENCE_LEVELS = ['LOW', 'MODERATE', 'HIGH'] as const;
export type PoliticsConfidence = (typeof POLITICS_CONFIDENCE_LEVELS)[number];

/* ───────────────────────────────────────────────────────────────────────────
 * §6 · THE SEVEN EPISTEMIC STATES
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * *"Seven epistemic states — confirmed fact, official position, political claim,
 * allegation, independent assessment, disputed reading, unverified report — stay visibly
 * distinct."*
 *
 * SEVEN, AND THE COUNT IS LOAD-BEARING. The temptation on a data-free surface is to show
 * three — verified, unverified, disputed — because nothing populates the others. Collapsing
 * them would be a design decision taken by an empty state, and §6 is the sentence that
 * forbids it. The activation says the same thing in its own words: *"do not collapse
 * materially different states if Part VIII distinguishes them."*
 *
 * Source class attaches to the ARTIFACT, never permanently to the institution (§6). These
 * are therefore artifact classes, and no institution is named anywhere in this file.
 */
export const POLITICS_EPISTEMIC_STATES = [
  'CONFIRMED_FACT',
  'OFFICIAL_POSITION',
  'POLITICAL_CLAIM',
  'ALLEGATION',
  'INDEPENDENT_ASSESSMENT',
  'DISPUTED_READING',
  'UNVERIFIED_REPORT',
] as const;
export type PoliticsEpistemicState = (typeof POLITICS_EPISTEMIC_STATES)[number];

/* ───────────────────────────────────────────────────────────────────────────
 * §7 · POLLING — THE FIELDS THAT MUST TRAVEL WITH A NUMBER
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * *"Pollster, field dates, sample size, methodology, geography, margin of error, sponsor,
 * freshness, official status and single-poll-vs-trend are all carried."*
 *
 * This list is the reason the polling region can be drawn with no data at all and still be
 * worth approving: it shows a reader WHAT WILL TRAVEL WITH EVERY NUMBER before any number
 * exists. R09 makes that explicit — *"the empty state is a designed state"* — and D-04
 * bounds it: a poll is an artifact, never an indicator series, and where method, geography
 * or question differ, **no trend line is drawn**.
 *
 * `SINGLE_POLL_VS_TREND` is in the list and is the field that prevents the aggregation §7
 * forbids. It is not a computed comparability flag; it is a disclosure that one poll is one
 * poll.
 */
export const POLITICS_POLL_FIELDS = [
  'POLLSTER',
  'FIELD_DATES',
  'SAMPLE_SIZE',
  'METHODOLOGY',
  'GEOGRAPHY',
  'MARGIN_OF_ERROR',
  'SPONSOR',
  'FRESHNESS',
  'OFFICIAL_STATUS',
  'SINGLE_POLL_VS_TREND',
] as const;
export type PoliticsPollField = (typeof POLITICS_POLL_FIELDS)[number];

/* ───────────────────────────────────────────────────────────────────────────
 * THE PREPARED SEAM
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * The config `registerSpecialistDomain` will receive, the day the union carries `POLITICS`.
 *
 * It is typed against `SpecialistDomainConfig` with only the `id` replaced, so every other
 * field is checked by the compiler today and the shape cannot drift while it waits. It is
 * deliberately NOT passed to `registerSpecialistDomain`: registering a domain routes a
 * reader to surfaces, and the routing decision is Main's.
 *
 * `queueRankingRule` states a rule this layer does not execute — C·2 keeps ranking upstream,
 * and R11 puts materiality into the SHARED attentionRank rather than a Politics score. The
 * honesty rules are Part VIII's own sentences, carried so they can be cited rather than
 * remembered.
 */
export type PoliticsDomainSeam = Omit<SpecialistDomainConfig, 'id'> & { readonly id: 'POLITICS' };

export const POLITICS_DOMAIN_SEAM: PoliticsDomainSeam = {
  id: 'POLITICS',
  objectSubtypes: [...POLITICS_SUBJECT_TYPES],
  /* Politics contributes NO geometry — Spatial v1.7 is reused unchanged (§8). */
  mapLayers: [],
  queueRankingRule:
    'Ordered upstream by the shared assessment service on shared attentionRank (R11). '
    + 'Politics computes no rank and no political score, and never orders by party, actor or outcome.',
  indicatorIds: [],
  assessmentSections: ['ASSESSMENT_LINE', 'EVIDENCE', 'STAGE', 'ACTORS', 'CROSS_DOMAIN'],
  watchScopes: ['ELECTION', 'LEGISLATIVE_SUBJECT', 'PROTEST_CAMPAIGN', 'POLITICAL_THEME'],
  meteredActions: ['DEEP_POLITICAL_COMPARISON', 'MULTI_COUNTRY_COMPARISON', 'CROSS_DOMAIN_SYNTHESIS'],
  honestyRules: [
    'Four independent axes: political status, lifecycle event, shared change state, confidence. Never merged into one chip or colour.',
    'No political severity ladder. Conflict severity is not inherited.',
    'Source class attaches to the artifact, never permanently to the institution.',
    'Polls are individually cited evidence artifacts. No aggregation into a pseudo-forecast.',
    'Precision and precision ceiling are first-class visible elements. Missing precision is never filled.',
    'Zero-AI navigation: ordinary browsing costs no user-metered AI.',
  ],
  claim: {
    claims: [
      'institutional and governmental political developments',
      'legislative and policy process',
      'elections and electoral process',
      'sustained civic mobilisation within the Politics threshold',
    ],
    doesNotClaim: [
      'organised armed-actor hostilities',
      'security incidents at the governed Security threshold',
      'any judgement of a candidate, party or government',
    ],
    landsOn: 'the persistent political subject, opened at its current assessment',
  },
};

/**
 * THE ONE SEAM THIS LANE HOLDS, NAMED SO IT CANNOT BE MISTAKEN FOR AN OVERSIGHT.
 *
 * Part VIII **R08** routes `PROTEST_ESCALATED` to *"Protest Campaign, plus a linked Conflict
 * object on escalation (C-07)"*. Main's **M-2** routes an escalation that does NOT meet the
 * organised-armed-hostility criteria to **SECURITY**. Both are accepted; they disagree about
 * one occurrence.
 *
 * Part VIII's own R10 §18 explains why, and predicts its own staleness: *"Politics ↔ Security
 * (future, §18) — Security is not authorised."* Part IX now exists, so the premise has
 * expired — which makes this a design written before a domain existed, not a defect.
 *
 * G raised it and did not apply it, on the same operating rule this lane follows. So no
 * escalation classification is encoded anywhere in this frame: no escalation control, no
 * escalation state, no route to Conflict or Security, and no empty slot shaped like one.
 * The protest region carries its subject-type name and `Not assessed`, which is true under
 * either ruling.
 */
export const POLITICS_ESCALATION_SEAM_HELD: string =
  'PROTEST_ESCALATED routing: Part VIII R08 -> Conflict; MAIN M-2 -> Security. '
  + 'Unresolved. No escalation classification is encoded in this frame.';
