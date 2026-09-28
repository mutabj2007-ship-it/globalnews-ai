/**
 * ASK R2 CORE ROUTER — BASELINE FACT REGISTER
 *
 * UPDATED AFTER THE CTO'S INDEPENDENT VERIFICATION. The final-correction ruling states
 * nine facts as MEASURED at 60d4aa9, which discharges part of ruling 5 from the other
 * direction: BF-03, BF-06 and BF-13 move from carried or assumed to MEASURED_BY_CTO, and
 * five facts are added for what the ruling newly establishes about Ask V2 and sand.
 *
 * The ruling also states: "Current canonical release has moved forward for frontend/Home
 * work, but backend/shared Ask code remains unchanged from this baseline." This router is
 * backend/shared, so the baseline holds for everything in this package.
 *
 * CTO ruling 5: "Architecture code assumptions must be revalidated against
 * 60d4aa91f327fe9c468d838d540db0e325798007. Main's conceptual architecture remains
 * approved; only code-specific facts are remeasured."
 *
 * REVALIDATION COULD NOT BE PERFORMED IN THIS SESSION. There is no clone, no linked
 * computer, and the GitHub API refuses every repository path for this session (403,
 * "GitHub access to this repository is not enabled for this session"), with no tool
 * available to request access. Re-attempted at the start of this round; unchanged.
 *
 * So ruling 5 is discharged as far as it can be: every code-specific fact this package
 * depends on is enumerated here with its source, the tree it was measured on, and what
 * would falsify it. Probe BF-1 asserts the register is complete and that no fact claims
 * to be verified at the named baseline, so a later reader cannot mistake carried facts
 * for measured ones.
 *
 * WHAT THIS BUYS. Revalidation becomes a checklist someone with the tree can execute in
 * one pass, and each row names the corpus rows or probes that would change if the fact
 * turns out false.
 */

export type FactStatus =
  /**
   * Independently verified by the CTO at 60d4aa9 and stated in the ruling. The strongest
   * status in this register. Still not measured by THIS session, which BF-2 asserts.
   */
  | 'MEASURED_BY_CTO'
  /** Measured by a named lane artefact, on a named tree that is NOT the CTO baseline. */
  | 'CARRIED_OTHER_TREE'
  /** Measured by a named lane artefact ON the CTO baseline. Still not re-measured here. */
  | 'CARRIED_AT_BASELINE'
  /** No lane has measured it; this package assumes it. The weakest status. */
  | 'ASSUMED';

export interface BaselineFact {
  readonly id: string;
  /** The code-specific claim, in the narrowest true form (G-REPORT-1). */
  readonly claim: string;
  readonly source: string;
  readonly measuredOn: string;
  readonly status: FactStatus;
  /** What this package does differently if the fact is false. */
  readonly ifFalse: string;
  /** Corpus rows or probes that would change. */
  readonly affects: readonly string[];
}

export const BASELINE_FACTS: readonly BaselineFact[] = [
  {
    id: 'BF-01',
    claim: 'classifyQueryIntent exposes exactly the eight QueryIntent members reproduced in ports.ts',
    source: 'H — ASK R2 handoff contract R1',
    measuredOn: '30fd93637094041e9b046df7c6f68e7648c6e354',
    status: 'CARRIED_OTHER_TREE',
    ifFalse:
      'the QueryIntent union is wrong and every row keyed on a present-tense intent must be re-derived',
    affects: ['PRESENT_TENSE_INTENTS', 'all CURRENT_REPORTING rows', 'V1'],
  },
  {
    id: 'BF-02',
    claim: 'detectAnalyticalDomains exposes 8 AnalyticalDomain members, of which only `security` is attested',
    source: 'Main — ASK INTELLIGENCE ENGINE R2 (count); L (the `security` member)',
    measuredOn: 'Worktrees/map-ask-geography-r1; Worktrees/alpha-convergence-2',
    status: 'CARRIED_OTHER_TREE',
    ifFalse: 'the ILLUSTRATIVE prefix discipline stands, but corpus domain values need replacing',
    affects: ['B6a', 'B6b', 'L1', 'L3', 'R1-row', 'R2-row', 'G-4'],
  },
  {
    id: 'BF-03',
    claim: 'the landed scope chain is requested region -> typed -> entity -> story -> map country, with typedScopeOverridesStory true',
    source: 'G — ASK R2 context/geography follow-up, quoted verbatim from analysis.service.ts:1149-1159',
    measuredOn: 'Worktrees/map-mobile-r1',
    status: 'MEASURED_BY_CTO',
    ifFalse:
      'LANDED_SCOPE_LATTICE is wrong and every divergenceKind is unreliable. The CTO has now verified the load-bearing half directly: "current typed geography/region outranks inherited story context." The ordering of the remaining rungs is still carried from G.',
    affects: ['LANDED_SCOPE_LATTICE', 'P1', 'P4', 'P5', 'E-3', 'R1-6', 'all RULED rows'],
  },
  {
    id: 'BF-04',
    claim: 'analysis.module.ts imports NewsModule, AuthModule and HistoryModule only, so Ask can reach news reporting and nothing else',
    source: 'Main — ASK INTELLIGENCE ENGINE R2 (analysis.module.ts:27)',
    measuredOn: 'Worktrees/map-ask-geography-r1',
    status: 'CARRIED_OTHER_TREE',
    ifFalse: 'the capability map is wrong in the direction that matters most',
    affects: ['CAPABILITY_MAP', 'B2', 'O1', 'NC2', 'H-4', 'R3-3'],
  },
  {
    id: 'BF-05',
    claim: 'no file, multipart, parser or code-execution infrastructure exists in the backend',
    source: 'E1 — ASK R2 existing-capability map §1.17, §1.18, §2',
    measuredOn: '60d4aa91f327fe9c468d838d540db0e325798007',
    status: 'CARRIED_AT_BASELINE',
    ifFalse: 'the SECURITY_HOLD and NOT_IMPLEMENTED states would be understating what exists',
    affects: ['B4', 'B5', 'C2'],
  },
  {
    id: 'BF-06',
    claim: 'Conflict is the only registered specialist domain, SpecialistModule adds no route, and nothing calls the registry',
    source: 'Main — ASK INTELLIGENCE ENGINE R2; MA §6; F — Support runtime convergence (0 non-spec referrers)',
    measuredOn: 'Worktrees/map-ask-geography-r1; release line',
    status: 'MEASURED_BY_CTO',
    ifFalse: 'a specialist seam may already be callable, and ruling 4 would permit an execution plan. The CTO has verified the rule directly: "no specialist is proven to be a bound Ask executor merely because it is registered or has a route."',
    affects: ['SPECIALIST_CLAIM state', 'B6b', 'R1-row', 'R2-row', 'R4-2', 'R4-3'],
  },
  {
    id: 'BF-07',
    claim: 'SavedStory and POST/GET/DELETE /users/me/saved/stories are live; AnalysisSelectionDto with MAX_SELECTED_STORIES = 8 is accepted and built',
    source: 'E1 — ASK R2 existing-capability map §0, §14; H — handoff contract §3.1',
    measuredOn: '60d4aa9; 30fd936',
    status: 'CARRIED_AT_BASELINE',
    ifFalse: 'the personal-intelligence rows and the selection ladder are wrong',
    affects: ['B7a', 'B7b', 'B7c', 'B7d'],
  },
  {
    id: 'BF-08',
    claim: 'the analytical-domain vocabulary never imports NewsCategory, and no topic dimension exists anywhere',
    source: 'E1 §1.7 (separation); G B-1 (no topic dimension)',
    measuredOn: '60d4aa9; Worktrees/map-mobile-r1',
    status: 'CARRIED_OTHER_TREE',
    ifFalse: 'topic may be transportable, and the TOPIC constraint would be carried rather than offered',
    affects: ['B3', 'W1', 'R2-4', 'R2-5'],
  },
  {
    id: 'BF-09',
    claim: 'no time channel exists in shared/src, the DTO or lib/ask',
    source: 'G B-2, stated as negative evidence',
    measuredOn: 'Worktrees/map-mobile-r1',
    status: 'CARRIED_OTHER_TREE',
    ifFalse: 'the TIME constraint would be carried, and six BROADENING_OFFERED rows become EXECUTABLE',
    affects: ['B3', 'H1', 'L1', 'G1', 'I-3', 'R2-5'],
  },
  {
    id: 'BF-10',
    claim: 'the axis-derivation vocabulary is English by construction: 59/59 keywords and 24/24 patterns ASCII, 22/24 using word boundaries',
    source: 'L — ASK R2 multilingual intent and evidence R1',
    measuredOn: 'Worktrees/alpha-convergence-2',
    status: 'CARRIED_OTHER_TREE',
    ifFalse: 'DERIVATION_COVERAGE is wrong and the multilingual gate may be suppressing real coverage',
    affects: ['DERIVATION_COVERAGE', 'L2', 'L3', 'L4', 'L5', 'J-1', 'J-3'],
  },
  {
    id: 'BF-11',
    claim: 'the producible-precision ceiling for a transported scope is COUNTRY',
    source: 'E1 §1.6 (administrative-ladder.contract is accepted authority); E1 OB-6 via G B-4, itself UNMEASURED',
    measuredOn: '60d4aa9 (contract); OB-6 unmeasured',
    status: 'ASSUMED',
    ifFalse: 'sub-national scope may be transportable and B6a would be EXECUTABLE rather than broadened',
    affects: ['B6a', 'GeographyAxis.producibleCeiling'],
  },
  {
    id: 'BF-12',
    claim: 'a server-verified identity can be attached without authenticating POST /analysis/news, and the route stays public',
    source: 'Main — ASK INTELLIGENCE ENGINE R2 finding 3',
    measuredOn: 'Worktrees/map-ask-geography-r1',
    status: 'CARRIED_OTHER_TREE',
    ifFalse: 'the IDENTITY_GATED state and the IDENTITY_REQUIRED terminal need re-deriving',
    affects: ['B7a', 'B7b'],
  },
  {
    id: 'BF-13',
    claim: 'the compute-consent mechanism exists in some trees and not others, and which tree is the Ask baseline was UNMEASURED at the time Main wrote it',
    source: 'Main — ASK INTELLIGENCE ENGINE R2, reported as a conflict, not resolved',
    measuredOn: 'six trees compared; git identity unmeasurable from that session',
    status: 'MEASURED_BY_CTO',
    ifFalse:
      'nothing — this is now settled. The CTO verified both halves: "/search?q= alone is not compute consent" and "Search requires an explicit one-shot consent grant or explicit Run." AWAITING_COMPUTE_CONSENT models a mechanism that exists.',
    affects: ['C1', 'C3', 'MU-8'],
  },
  {
    id: 'BF-14',
    claim: 'AnalysisApiResponse carries 12 fields and neither an operationId nor a resultId',
    source: 'H — handoff contract §1.3',
    measuredOn: '30fd93637094041e9b046df7c6f68e7648c6e354',
    status: 'CARRIED_OTHER_TREE',
    ifFalse: 'an EXECUTABLE plan may already have a result address, closing C-R10',
    affects: ['docs/01-CONFLICTS.md C-R10'],
  },
  {
    id: 'BF-15',
    claim: 'the rate limit on POST /analysis/news is 5 per 60 seconds and must not be raised',
    source: 'E1 §3.3',
    measuredOn: '60d4aa91f327fe9c468d838d540db0e325798007',
    status: 'CARRIED_AT_BASELINE',
    ifFalse: 'fan-out budgeting changes; this package emits at most one retrieval leg so nothing here breaks',
    affects: ['nothing in this package — recorded so the constraint is not lost'],
  },

  /* ---- added after the CTO's independent verification ---- */
  {
    id: 'BF-16',
    claim: 'AskV2Module is registered in AppModule, ASK_V2_ENABLED is default-off, and ASK_EXECUTION_PORT is bound to UNWIRED_ASK_EXECUTION_PORT',
    source: 'CTO final-correction ruling, stated as MEASURED',
    measuredOn: '60d4aa91f327fe9c468d838d540db0e325798007',
    status: 'MEASURED_BY_CTO',
    ifFalse: 'nothing in this package; recorded because it settles H-D3',
    affects: [
      'ROUTER-D6 — the substrate question. Ask V2 has persistence and lifecycle but NO bound execution engine, so a router mounted there would plan against an unwired port.',
    ],
  },
  {
    id: 'BF-17',
    claim: 'SAND_CHARGING_ENABLED = false',
    source: 'CTO final-correction ruling, stated as MEASURED',
    measuredOn: '60d4aa91f327fe9c468d838d540db0e325798007',
    status: 'MEASURED_BY_CTO',
    ifFalse: 'the design audit row for sand would change',
    affects: ['docs/07-DESIGN-COMPATIBILITY.md — sand appears only on compute, and is not charged'],
  },
  {
    id: 'BF-18',
    claim: 'no landed producer exists for the explicit or materially-required specialist-domain axis',
    source: 'this package; the CTO ruling requires the distinction and names no producer',
    measuredOn: 'not measured — no lane has looked for one',
    status: 'ASSUMED',
    ifFalse: 'the requiredness axis could be derived rather than declared',
    affects: ['SpecialistRequestAxis', 'D3a', 'D3b', 'D3-1'],
  },
  {
    id: 'BF-19',
    claim: 'backend and shared Ask code is unchanged from the baseline even though canonical has advanced for frontend/Home work',
    source: 'CTO final-correction ruling',
    measuredOn: '60d4aa91f327fe9c468d838d540db0e325798007',
    status: 'MEASURED_BY_CTO',
    ifFalse: 'the whole register would need re-dating against the newer canonical release',
    affects: ['every fact in this register — this is what keeps the baseline valid for a backend/shared router'],
  },
  {
    id: 'BF-20',
    claim: 'the frozen Ask design authority package D25 was stated as supplied directly in the freeze ruling, but did NOT arrive in this session, and its SHA256 remains unverified',
    source: 'this session, re-checked at the freeze pass: no uploads directory exists, the project carries the v1.8 board (sha256 194977b4...) and no D25 entry, and a filesystem search for the name returns nothing',
    measuredOn: 'not available',
    status: 'ASSUMED',
    ifFalse: 'the matrix could be audited against D25 itself. NOTE: the freeze ruling text supplies explicit design rulings for every previously-mismatched row, so those rows are resolved BY RULING rather than by reading D25 — which is a stronger basis, not a weaker one. What stays unaudited is only D25 content the ruling does not mention.',
    affects: ['docs/07-DESIGN-COMPATIBILITY.md — 12 of 29 rows still depend on unread D25 text', 'probe DA-5'],
  },
];
