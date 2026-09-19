import type { SecurityAbsenceState } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART IX · SECURITY — MAIN'S ZONE AUTHORITY, TRANSCRIBED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * AUTHORITY. `MAIN-SECURITY-PARTIX-FINAL-VISUAL-AUTHORITY-R1`
 * (`6f63613d2c31c41a679e299b36f178989f99de18e0d7711c73b6fa07c812d7b3`, manifest self-check
 * 3/3 OK), file `manifest/SECURITY-ZONE-AUTHORITY.tsv` — 42 rows, seven columns.
 *
 * **Nothing in this file is a decision.** Main ruled all six Product Owner questions and
 * closed M-2; the activation says so in one line — *"there is no remaining product/security
 * decision for H to invent."* Every value below is the TSV's, and the one thing this lane
 * added is the SHAPE that lets a guard check conformance row by row.
 *
 * ── WHY THE MANIFEST IS DATA HERE AND NOT PROSE IN A COMPONENT ────────────
 *
 * A zone table that lives in comments is a table nobody can test. Main's own report counts
 * its rows from the TSV rather than from memory, and records that an earlier draft asserted
 * 26/13/3 from recall and was wrong. The same discipline applies downstream: the frame
 * renders FROM this table, and `securityVisualFrame.spec.ts` asserts the rendered surface
 * against it — so a zone that quietly appears, disappears or changes class fails a test
 * rather than surviving a review.
 */

/** Main's closed vocabulary for column 4. No other value is admissible. */
export type ZoneExistence =
  | 'YES_REQUIRED'
  | 'YES'
  | 'YES_GENERIC_LABEL_ONLY'
  | 'NO_NOT_RENDERED'
  | 'NO_REQUIRES_DATA';

/** Main's closed vocabulary for column 6. `permitted` occurs on zero zones. */
export type ZonePersonRule = 'NO_SLOT_ABSENT' | 'NO_GATE_REQUIRED' | 'NA_REGION_NOT_RENDERED';

/** Column 5 — one of the five N-11 tokens, or a non-state. */
export type ZoneNeutralState = SecurityAbsenceState | 'NOT_RENDERED' | 'NA';

export interface SecurityZone {
  readonly id: string;
  readonly existence: ZoneExistence;
  readonly neutralState: ZoneNeutralState;
  readonly personRule: ZonePersonRule;
}

/**
 * THE 42 ROWS.
 *
 * Reader labels are NOT carried here — they are in `securityStrings.ts`, because a label is
 * copy and this is structure. Mixing them would put English in a conformance table and make
 * the table untranslatable and the copy untestable at the same time.
 */
export const SECURITY_ZONES: readonly SecurityZone[] = [
  /* ── REGION A · state bar · 8 zones ──────────────────────────────────── */
  { id: 'A0', existence: 'YES_REQUIRED', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'A1', existence: 'YES', neutralState: 'NA', personRule: 'NO_SLOT_ABSENT' },
  { id: 'A2', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'A3', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'A4', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'A5', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'A6', existence: 'YES', neutralState: 'NA', personRule: 'NO_SLOT_ABSENT' },
  { id: 'A7', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },

  /* ── REGION B · attention queue · 4 zones ────────────────────────────── */
  { id: 'B1', existence: 'YES', neutralState: 'NA', personRule: 'NO_SLOT_ABSENT' },
  { id: 'B2', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'B3', existence: 'NO_REQUIRES_DATA', neutralState: 'NOT_RENDERED', personRule: 'NA_REGION_NOT_RENDERED' },
  { id: 'B4', existence: 'YES_REQUIRED', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },

  /* ── REGION C · substrate · 13 zones ─────────────────────────────────── */
  { id: 'C0', existence: 'YES', neutralState: 'NA', personRule: 'NO_SLOT_ABSENT' },
  { id: 'C1', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'C2', existence: 'YES_REQUIRED', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'C3', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'C4', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'C5', existence: 'YES_GENERIC_LABEL_ONLY', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'C6', existence: 'NO_NOT_RENDERED', neutralState: 'NOT_RENDERED', personRule: 'NA_REGION_NOT_RENDERED' },
  { id: 'C7', existence: 'YES_GENERIC_LABEL_ONLY', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'C8', existence: 'NO_NOT_RENDERED', neutralState: 'NOT_RENDERED', personRule: 'NA_REGION_NOT_RENDERED' },
  { id: 'C9', existence: 'NO_REQUIRES_DATA', neutralState: 'NOT_RENDERED', personRule: 'NA_REGION_NOT_RENDERED' },
  { id: 'C10', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'C11', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_GATE_REQUIRED' },
  { id: 'C12', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },

  /* ── REGION D · context bar · 5 zones ────────────────────────────────── */
  { id: 'D1', existence: 'YES', neutralState: 'NA', personRule: 'NO_SLOT_ABSENT' },
  { id: 'D2', existence: 'YES', neutralState: 'NA', personRule: 'NO_SLOT_ABSENT' },
  { id: 'D3', existence: 'YES', neutralState: 'NA', personRule: 'NO_GATE_REQUIRED' },
  { id: 'D4', existence: 'YES', neutralState: 'NA', personRule: 'NO_GATE_REQUIRED' },
  { id: 'D5', existence: 'YES', neutralState: 'NA', personRule: 'NO_SLOT_ABSENT' },

  /* ── DETENTS · 4 zones ───────────────────────────────────────────────── */
  { id: 'P1', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'P2', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'P3', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },
  { id: 'P4', existence: 'YES', neutralState: 'SEC_NOT_ASSESSED', personRule: 'NO_SLOT_ABSENT' },

  /* ── WITHHELD · 8 zones · enumerated so they are not rebuilt by accident ─ */
  { id: 'X1', existence: 'NO_NOT_RENDERED', neutralState: 'NOT_RENDERED', personRule: 'NA_REGION_NOT_RENDERED' },
  { id: 'X2', existence: 'NO_NOT_RENDERED', neutralState: 'NOT_RENDERED', personRule: 'NA_REGION_NOT_RENDERED' },
  { id: 'X3', existence: 'NO_REQUIRES_DATA', neutralState: 'NOT_RENDERED', personRule: 'NA_REGION_NOT_RENDERED' },
  { id: 'X4', existence: 'NO_NOT_RENDERED', neutralState: 'NOT_RENDERED', personRule: 'NA_REGION_NOT_RENDERED' },
  { id: 'X5', existence: 'NO_NOT_RENDERED', neutralState: 'NOT_RENDERED', personRule: 'NA_REGION_NOT_RENDERED' },
  { id: 'X6', existence: 'NO_NOT_RENDERED', neutralState: 'NOT_RENDERED', personRule: 'NA_REGION_NOT_RENDERED' },
  { id: 'X7', existence: 'NO_NOT_RENDERED', neutralState: 'NOT_RENDERED', personRule: 'NA_REGION_NOT_RENDERED' },
  { id: 'X8', existence: 'NO_NOT_RENDERED', neutralState: 'NOT_RENDERED', personRule: 'NA_REGION_NOT_RENDERED' },
];

/** A zone the frame must render. `NO_*` zones leave no trace of any kind. */
export function zoneIsRendered(zone: SecurityZone): boolean {
  return zone.existence === 'YES'
    || zone.existence === 'YES_REQUIRED'
    || zone.existence === 'YES_GENERIC_LABEL_ONLY';
}

export function securityZone(id: string): SecurityZone | null {
  return SECURITY_ZONES.find((z) => z.id === id) ?? null;
}

/**
 * Region geometry — Part IX's own, unmodified, at the three breakpoints.
 *
 * *"Four permanent regions. E is not a fifth region. Wide screens expand the same
 * intelligence object; they do not multiply dashboard regions. B and C never nest as
 * scrolling surfaces."*
 */
export const SECURITY_GEOMETRY = {
  /** A · state — full width, FIXED height, prose capped at 74ch. */
  stateHeightPx: [96, 104, 104] as const,
  /** B · attention — capped, never absorbs surplus, scrolls internally. */
  attentionWidthPx: [320, 360, 360] as const,
  /** C · substrate — principal absorber, min 560, grows only as itself. */
  substrateWidthPx: [896, 1068, 1236] as const,
  substrateMinPx: 560,
  /** D · context — full width, fixed height. */
  contextHeightPx: [64, 72, 72] as const,
  /** The page caps and centres past the cap; surplus becomes margin. */
  pageCapPx: 1680,
  proseCapCh: 74,
} as const;

/** Detents — PEEK is a pixel height; HALF and FULL are viewport fractions. */
export const SECURITY_DETENTS = {
  PEEK_PX: 152,
  HALF_VH: 52,
  FULL_VH: 92,
} as const;

/**
 * FORBIDDEN COPY — Main's rule 6, verbatim, *"at any breakpoint, in any detent"*.
 *
 * It is a constant rather than a comment so a guard can sweep the rendered surface against
 * it. Every entry is a sentence that would be TRUE-SOUNDING and UNEARNED: each one answers
 * "is it safe?" when the only honest answer available is "nobody looked".
 */
export const SECURITY_FORBIDDEN_COPY: readonly string[] = [
  'No incidents',
  'All clear',
  'Nothing to report',
  'No threats detected',
  'Secure',
  'Normal',
  '0 incidents',
];

/**
 * THE TWO WITHHELD TAXONOMIES, NAMED HERE SO THEY ARE NEVER NAMED ON A SURFACE.
 *
 * Main's rule 4: *"The substrate name is safe; the taxonomy beneath it is not … An
 * enumeration discloses a capability."* C5 and C7 render their substrate NAME; C6 and C8 —
 * the ten asset classes and the six zone classes — are withheld entirely.
 *
 * They are listed in this module for ONE purpose: a guard sweeps the rendered surface for
 * every member and fails if any appears. Keeping the list in a lib module that no component
 * imports is what lets the prohibition be tested without the prohibited words ever reaching
 * a component file.
 */
export const SECURITY_WITHHELD_ASSET_CLASSES: readonly string[] = [
  'rail', 'ports', 'airports', 'energy grids', 'pipelines',
  'communications', 'defence production', 'border crossings', 'data centres',
];

export const SECURITY_WITHHELD_ZONE_CLASSES: readonly string[] = [
  'border segment', 'corridor', 'airport perimeter',
  'critical zone', 'maritime area', 'airspace region',
];

/**
 * X4 — the category that must not exist in any form.
 *
 * *"DO_NOT_EXPOSE at SEC-AGG-1 verbatim. MUST NOT BE INTRODUCED in any form incl legend
 * placeholder example or copy. Not hidden - absent. A withheld-region marker for them would
 * itself be the disclosure."*
 *
 * Same mechanism as above, and the reason it is worth repeating: for X4 even a *"withheld"*
 * marker is the leak, so the only place these words may appear in the tree is a guard's
 * input.
 */
export const SECURITY_X4_NEVER_INTRODUCED: readonly string[] = [
  'shelter', 'shelters', 'emergency-response asset', 'emergency response asset',
  'protected person', 'protected persons',
];
