/**
 * @globalnews-ai/shared
 *
 * This package is the single source of truth for types, interfaces,
 * enums, and constants shared between the `frontend` and `backend`
 * workspaces. It contains NO business logic in Sprint 1 — it exists
 * purely as project-foundation scaffolding.
 *
 * Example of future usage (Sprint 2+):
 *   export interface Article { id: string; title: string; ... }
 *   export enum UserRole { ADMIN, EDITOR, VIEWER }
 */

export const SHARED_PACKAGE_NAME = '@globalnews-ai/shared';

export * from './news';
export * from './analysis';
export * from './analysis-budget';
export * from './countries';
export * from './query-normalization';
export * from './geo-fuzzy-resolver';
export * from './countryDisplayName';
export * from './officialSources';
export * from './rights/source-rights';
/*
  PUBLISHER FEEDS RECOVERY R1 — the recovered C55 `SourceType`, plus the one
  corroboration rule the ruling requires. Placed beside './officialSources'
  because the two describe the same axis: who is speaking, and whether they can
  confirm each other.
*/
export * from './source-type';

/*
  B3.1 — the provenance structures the Economy read model needs. Recovered from
  canonical C55 WITHOUT its `SourceType` declaration, which './source-type'
  above already owns; the two unions were measured equivalent first. Placed
  after it so the dependency direction is visible in the barrel itself.
*/
export * from './source-provenance';

/*
  B5-A — OAUTH V1 frozen state set: cancelled | failed.

  Declared in shared because the BACKEND writes the auth_error parameter and the
  FRONTEND reads it; a second copy of the admissible set would be a second
  answer to one question. isAuthErrorCode is the only admission test on either
  side, which is what makes repeated/array/object query shapes inert without a
  special case for each.
*/
export * from './auth-error';

/*
  B3.1 — LANG-UI-7 display-locale TYPES only. Recovering them activates no
  language: the SELECTABLE registry is a separate, frontend-owned deployment
  fact (lib/i18n/languages.ts), and it remains ['en','pl'].
*/
export * from './language';

/*
  B4-A — the governed Economy read model. C55 promoted it into shared/src to
  settle the C36 Gate 4 conflict (Option 1), adopting the backend value-semantics
  vocabulary with a TOTAL, transitional ECONOMY_LEGACY_UI_* map for the old
  frontend names. Both lanes bind here; neither declares its own axes.
*/
export * from './economy';
export * from './economy/lineage';
export * from './economy/route-eligibility';
export * from './signals';
export * from './support';
export * from './follows';
export * from './storyIdentity';

/*
  WATCH TYPES ONLY -- MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, PO ruling 5.

  Exported so the accepted geography-ladder contract spec can be restored:
  `administrative-ladder.contract.spec.ts` depends on `deriveScopeChain`, which
  depends on these types. THIS EXPORTS TYPES AND CONSTANTS, NOTHING ELSE --
  there is no WatchModule, no controller, no scheduler and no route in this
  candidate, and Watch remains Stage 0. Restoring an executable geography
  contract is not activating Watch, and `WATCH_RUNTIME_ACTIVE` in the frontend
  is still `false`.
*/
export * from './watch';

/*
  CONFLICT + SPECIALIST CLAIM BOUNDARY -- forward-ported from canonical under
  PO ruling 3. These are the shared vocabulary the specialist claim registry and
  ConflictClaimModule are typed against; both files are byte-identical to the
  accepted authority and neither imports anything.
*/
export * from './specialist-claim';
export * from './conflict';
export * from './market';
export * from './official-data/snapshot';
export * from './official-data/snapshot-admission';
export * from './official-data/json-numeric';
export * from './official-data/json-strict';
export * from './official-data/transport';
export * from './official-data/parser-registry';
export * from './official-data/admission-evaluator';
/* NISR FIRST REAL DATA R1 — the application/pdf row's own parser. Exported so the
   composition root can install a text-layer extractor; nothing else imports it. */
export * from './official-data/providers/nisr-cpi.decoder';
export * from './humanitarian/spatial-geometry';
export * from './humanitarian/geometry-authority';
export * from './humanitarian/authority-cadence';

/*
  SECURITY — THE ACCEPTED PART IX CONTRACT, CONVERGED ONTO THIS LINEAGE.

  The module is the accepted authority from `integration/alpha-convergence-2` `3db5a09`
  (`MAIN-SECURITY-PLATFORM-1-R1`), landed byte-identical except for ONE repointed import.
  H measured two blockers that stopped it compiling here, and both are closed:

    A · `security/index.ts` imported `EvidenceRole · SourceProvenance · SourceType` from
        `'../sourceModel'`, a module this lineage split into `source-provenance.ts` and
        `source-type.ts`. The import now names the two current owners. `sourceModel` was
        NOT recreated — see the note at that import.

    B · Re-exporting the module through this barrel collided on those three names, which
        this barrel already exports from their owning modules above. The Security module's
        convenience re-export was withdrawn rather than the owners being renamed or
        duplicated, so each semantic type keeps EXACTLY ONE authoritative export. See the
        note at that site.

  `absence.ts` is the N-11 presentation vocabulary at the path Main ruled. It is kept as
  its own file and exported beside the contract, never folded into it: it carries Main's
  reader labels verbatim and must have exactly one definition in the tree.
*/
export * from './security';
export * from './security/absence';

/*
  THE GENERIC NON-NUMERIC OBSERVATION CONTRACT — MAIN-POLITICS-PLATFORM-PROMOTION-R3 #1.

  Landed byte-identical. It is exported here rather than inside a domain because it is not
  Politics' to own: Politics is its FIRST CONSUMER, not its author, and the type parameter
  is what keeps the generic record from becoming a catch-all.

  ── THE R1 HOLD, NOW CLOSED ───────────────────────────────────────────────

  The Politics R1 landing held steps #3–#5 because `shared/src/politics/index.ts` and
  `shared/src/relationships/index.ts` imported `SpatialPrecision` and `LocationProvenance`
  from `'../news'`, and neither was declared anywhere in `shared/src` on this lineage.
  Recovering the C39 declarations by hand would have pre-empted CF-D1, which assigned that
  promotion to Main WITH A RULING attached.

  `MAIN-CONFLICT-CANONICAL-FOUNDATION-R2` made the ruling and delivered
  `shared/src/spatial/precision.ts`. Both imports are repointed at that one canonical
  authority — not recovered, not stubbed, not duplicated — and the move is landed.
*/
export * from './observation/domain-observation';

/*
  ── M08 · THE DOMAIN-NEUTRAL ABSENCE AUTHORITY ──────────────────────────────

  `MAIN-SHARED-ABSENCE-M08-CLOSEOUT-R1`. Seven internal states, one LITERAL
  floor, and a deliberately lossy reader projection: the seven reach a reader
  as three, so a protected withhold is indistinguishable from an ordinary
  absence. That non-injectivity is the anti-oracle property, and it is the
  reason this must never grow one reader label per internal state.

  It is exported from the OBSERVATION layer rather than from any domain because
  the measurement that opened M08 found exactly one absence vocabulary in the
  repository — Security's — and a second domain needing the same semantics is
  what turns a domain vocabulary into a shared one. Security now ALIASES into
  this union rather than declaring a parallel five; Energy will consume it and
  mint no `ENE_*` twins.

  It imports nothing, which is why it can sit above every domain module here.
*/
export * from './observation/absence';

/*
  CF-D1 · THE SPATIAL PRECISION AUTHORITY — ONE OWNER, NO COMPATIBILITY DUPLICATE.

  `MAIN-CONFLICT-CANONICAL-FOUNDATION-R2`, landed byte-identical. This is the promotion the
  Politics R1 landing was held on: `SpatialPrecision` and `LocationProvenance` now have a
  canonical home in `shared/`, so nothing has to be recovered by hand from `3db5a09` and no
  provenance type arrives stubbed.

  PRECISION IS NOT GEOMETRY, IS NOT DENOTATION, AND IS NOT PROVENANCE. The ladder says how
  finely a location is known; the geometry says what shape was drawn; the denotation says
  what that shape is claimed to BE; the provenance says who said so. This module owns the
  first and the last and deliberately owns neither of the middle two.

  THE DISPLAY HALF STAYS IN THE FRONTEND. `PRODUCIBLE_SPATIAL_PRECISION`, the ceilings and
  `precisionExceedsGeometry` are NOT promoted here — the backend must never learn what a
  precision looks like. What is deleted is the duplicated ladder, not the frontend file.
*/
export * from './spatial/precision';

/* POLITICS — steps #3-#5 of MAIN-POLITICS-PLATFORM-PROMOTION-R3, landed now that CF-D1 is
   closed. Byte-identical from MAIN-POLITICS-PLATFORM-1-R2 apart from two repointed
   imports, each documented at its site. MERGED into this barrel, never overwritten by
   R2's 23-export C39 copy. */
export * from './politics';
export * from './relationships';

/* THE CANONICAL CONFLICT OBSERVATION — identity, ownership resolver, severity authority,
   geography and revision semantics. A DIFFERENT module from  beside it, which
   carries the display vocabulary; both are exported and neither shadows the other. */
export * from './conflict/observation';

/*
  THE CANONICAL CONFLICT OBSERVATION — including the ownership resolver.

  `conflict/observation.ts` is a DIFFERENT module from `conflict.ts` beside it: the older
  file carries the Conflict display vocabulary (states, severities, indicators, watch
  scopes), this one the observation model, identity and ownership rule. Both are exported
  and neither shadows the other.

  `resolveConflictEventOwner` lands here rather than being written by Code. It is the M-2
  closure over ONE canonical occurrence, and `CONFLICT_EVENT_OWNERS` already contains
  `POLITICS`, so a Politics producer calls it instead of declaring a second ownership
  vocabulary.
*/

export * from './politics/retained';

// Security R2 contracts; public activation remains gated by the Alpha authority.
export * from './security/observation';
export * from './security/read-model';

// Public absence-only Humanitarian reader; acquisition stays unprovisioned.
export * from './humanitarian/retained-read';

export * from './global-reach';
export * from './global-reach-regions';

export * from './comparison-coverage';
