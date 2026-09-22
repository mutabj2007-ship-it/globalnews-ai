import type { SpecialistDomainId } from '@/lib/specialist/specialistDomain';
import type { IndicatorStrip, ObservedIndicator } from '@/lib/specialist/indicatorStrip';
import type { HudLine } from '@/lib/specialist/hudGrammar';
import { type ObservationAbsenceState, type ReaderAbsenceState, readerAbsence } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * IMIHIGO / DELIVERY · THE PROVIDER-FREE PREVIEW — AND IT CONTAINS NO DELIVERY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * *"The ceiling in one sentence: a complete, reviewable delivery surface with
 * no delivery data in it."*
 *
 * **Bind nothing Rwandan to the preview route.** *"A preview that binds real
 * districts to fixture figures is a fabricated Imihigo report, and it will be
 * screenshotted."* Every subject below is a placeholder with no real-world
 * referent.
 *
 * This is also what makes §6.4 safe: **the preview carries no commitments, so
 * it can disclose no sensitive commitment.**
 *
 * **This module is DELETED when `/delivery` opens. It is not inherited by it.**
 */

export const DELIVERY_DOMAIN: SpecialistDomainId = 'DELIVERY';

export const DELIVERY_PREVIEW_SCOPE = {
  iso2: 'ZZ',
  label: 'No subject bound',
} as const;

/* ═══ IM1-1 · THE PERSON IS NOT REPRESENTABLE, NOT MERELY FORBIDDEN ══════ */

/**
 * A delivery subject.
 *
 * **THE ACCOUNTABLE UNIT IS THE SUBJECT; THE PERSON IS NOT.** There is no
 * `officialName`, no `officialId` and no person field of any kind — *absent,
 * not nullable, not optional.* The failure mode this prevents is a searchable,
 * sortable, durable performance dossier on named local-government officials,
 * assembled out of their employer's internal accountability process and given a
 * reach that process never had.
 *
 * **The test is mechanical: if a name can be a key, it is a subject.** No field
 * here can be a key for a person, because no field here carries one.
 *
 * `ParticipantEntityCard` — the platform's identity surface — is NOT ALLOWED on
 * this surface for the same reason (`E1-IM-1` is HOLD), and it is not imported
 * anywhere in this lane. A guard asserts that.
 *
 * `IM1-4` closes the reconstruction route as well: district figure + officials
 * roster + tenure dates is a person-level score assembled from permitted parts.
 * **The platform must not carry an official-tenure roster keyed to districts**,
 * and nothing in this lane does.
 */
export interface DeliverySubjectRef {
  readonly subjectId: string;
  readonly label: string;
  /** `DISTRICT` or `SECTOR` — a governed identity, never a drawable shape. */
  readonly scope: 'DISTRICT' | 'SECTOR';
}

/* ═══ THE `/delivery` GATE, RECORDED IN CODE ════════════════════════════ */

/**
 * WHY `/delivery` IS NOT OPENED, AND THE TWO CONDITIONS, WHERE THE NEXT PERSON
 * WILL FIND THEM.
 *
 * §6.4 rules that the declared sensitive class is **not implemented in this
 * round and no sensitive-class-aware code path is written**, because its
 * required mitigation does not exist:
 *
 *   `IM2-3` requires coarsening ACROSS THE WHOLE DECLARED CLASS. The producible
 *   precision set is `['COUNTRY', 'SECTOR', 'UNKNOWN']`, and `DISTRICT` — the
 *   only intermediate rung — is produced by nothing. **A sensitive sector
 *   record has no governed intermediate rung to coarsen to.**
 *
 * *"An unworkable mitigation is not used, and writing a coarsening path that
 * resolves to COUNTRY would implement IM2-3's own failure — a class visible by
 * its treatment, at the crudest possible contrast."*
 *
 * **Nobody may open `/delivery` until both conditions hold.** There is no
 * override.
 */
export const DELIVERY_LIVE_ROUTE_GATE: readonly { readonly condition: string; readonly met: false }[] = [
  {
    condition:
      'DISTRICT is producible. Today PRODUCIBLE_SPATIAL_PRECISION is COUNTRY/SECTOR/UNKNOWN — DISTRICT is declared and produced by nothing, so IM2-3 coarsening has no rung to reach.',
    met: false,
  },
  {
    condition:
      'A governed sensitive-class registry exists, keyed on the publisher’s own sector/category code. Today: none. IM2-1 forbids classifying sensitivity from free text.',
    met: false,
  },
] as const;

export function deliveryLiveRouteMayOpen(): boolean {
  return DELIVERY_LIVE_ROUTE_GATE.every((gate) => gate.met);
}

/**
 * "NO GEOMETRY" IS NOT A SECURITY CONTROL, AND THIS LANE MAY NOT CITE IT AS ONE.
 *
 * E1's `IM2-4`, carried so it cannot be forgotten: *"416 named sectors with
 * full parentage are perfectly identifying as a list. A picker discloses
 * exactly what a choropleth would."* The absence of boundary geometry is a
 * COVERAGE FACT. Nobody — including H — may later cite it as protection.
 */
export const GEOMETRY_ABSENCE_IS_NOT_A_SECURITY_CONTROL = true as const;

/**
 * DISTRICT COARSENING IS NOT GOVERNED AND IS NOT CLAIMED HERE.
 *
 * `SPATIAL_PRECISION_LADDER` puts `SECTOR` at rank 2 (fine) and `DISTRICT` at
 * rank 3 (coarser), and only `COUNTRY`, `SECTOR` and `UNKNOWN` are producible.
 * There is no coarsening control in this lane, no function that implements one,
 * and no code path that assumes one.
 */
export const DISTRICT_COARSENING_IS_NOT_IMPLEMENTED = true as const;

/* ═══ THE FOUR REGIONS ══════════════════════════════════════════════════ */

/**
 * §2.1 · The HUD line.
 *
 * `CHANGE` collapses whenever no achieved result is published, and nothing is
 * published here. `PRIMARY_MEASURE` collapses for the same reason. **A missing
 * figure does not render as `0`, `—`, `N/A`, or an empty box of the same
 * width** — an empty value collapses the slot, and it is never padded.
 *
 * **`amber` is `null` for every slot not expressing change or lateness**, and
 * for Imihigo that means amber appears in `CHANGE` and nowhere else. `CHANGE`
 * is collapsed here, so there is no amber on this surface at all.
 *
 * `WATCH` is omitted per §8 — no member exists and none is registered.
 */
export function deliveryPreviewHud(modeLabel: string, scopeLabel: string): HudLine {
  return {
    MODE: { value: modeLabel, amber: null },
    SCOPE: { value: scopeLabel, amber: null },
  };
}

export const DELIVERY_COLLAPSED_SLOTS = [
  'STATE',
  'PRIMARY_MEASURE',
  'CHANGE',
  'CONFIDENCE',
  'WATCH',
] as const;

/**
 * §2.2 · COMPOSING commitment · target · progress · result — AND THE SHAPE OF
 * A COMMITMENT WITH NO RESULT.
 *
 *   commitment  ->  the indicator SUBJECT
 *   target      ->  the indicator's stated target, ReadingSourceClass OFFICIAL
 *   progress    ->  magnitudeFraction, ONLY where the publisher states one
 *   result      ->  the indicator value, ONLY where the publisher states one
 *
 * A commitment with a target and no reported result is an indicator with
 * direction **`UNKNOWN`** and `magnitudeFraction` **`null`**. The strip already
 * models *"we have the subject but not the movement"*, so nothing new was
 * needed.
 *
 * **`magnitudeBasis` is omitted**, which is what makes `magnitudeFraction`
 * return `null` — *"a bar with an undeclared basis is a picture of a number
 * nobody can check."* No progress bar renders.
 *
 * **NO COMPLETION PERCENTAGE, RANKING, SCORE OR TREND IS COMPUTED ANYWHERE IN
 * THIS LANE.** That is a direct prohibition and rests on no registry:
 * `IMIHIGO_DERIVATION_RULES` does not exist and is neither created nor cited.
 * It is additionally unreachable today — no registered source, zero carried
 * records, no claim type, no derivation engine.
 */
export function commitmentWithoutResult(subjectId: string, label: string): ObservedIndicator {
  return {
    indicatorId: subjectId,
    label,
    /* No result is published, so there is no value to state. */
    value: '',
    direction: 'UNKNOWN',
    window: 'NOT STATED',
    observedAt: null,
    /* magnitudeBasis deliberately omitted -> magnitudeFraction() returns null -> no bar. */
    provenanceRef: [],
  };
}

/**
 * The strip, with **no commitments bound**.
 *
 * `indicatorMaxFor('DELIVERY')` is 5 today via the accepted fallback. **No
 * DELIVERY exception is registered** — the file's own words are *"No other
 * domain is registered, so Election and Delivery get five."*
 */
export const DELIVERY_PREVIEW_STRIP: IndicatorStrip = {
  domain: DELIVERY_DOMAIN,
  indicators: [],
};

/* ═══ RC-1..RC-6 · THE UNRANKED SUBJECT LIST ═══════════════════════════ */

/**
 * ── REGION 3 IS NOT AN ATTENTION QUEUE ───────────────────────────────────
 *
 * `MAIN-…-PLAN-B-R3` withdraws R2's assignment of `AttentionQueue` to this
 * region: *"a structure whose defining field is a rank is the wrong home for a
 * list that may not have one."* NISR publishes no attention ordering, no
 * upstream service ranks these subjects, and none ever may.
 *
 * §6.2 is unchanged in substance and now rests on `RC-3` rather than on
 * `queueWasOrderedUpstream`, **which was never going to be true here.**
 *
 * *"Identity and addressability are one thing. Drawable boundary geometry is
 * another. A selector, a list, a breadcrumb and a scope label are all identity
 * and are all allowed. Anything that draws is geometry and is forbidden."*
 *
 * The union below is a LOCAL copy, per `R-RC-1`/`R-RC-4`; a guard asserts it is
 * identical to Election's so the two cannot drift.
 */
export const ORDER_REASONS = ['AUTHORITY_PUBLISHED', 'LEXICAL', 'UPSTREAM_ASSESSED'] as const;
export type OrderReason = (typeof ORDER_REASONS)[number];

/** `UPSTREAM_ASSESSED` is subtracted, so it is unassignable rather than merely forbidden. */
export type VerticalOrderReason = Exclude<OrderReason, 'UPSTREAM_ASSESSED'>;

/**
 * One row. **No rank field, no ordinal, no index** — and, per `IM1-1`, no person
 * field either. A field that could hold either is a field a caller eventually
 * fills.
 */
export interface UnrankedSubjectRow {
  readonly id: string;
  readonly label: string;
  readonly stateLabel?: string;
}

export interface UnrankedSubjectList {
  readonly headerLabel: string;
  readonly orderReason: VerticalOrderReason;
  readonly rows: readonly UnrankedSubjectRow[];
}

/**
 * The preview's subject list.
 *
 * **`orderReason` is `LEXICAL`, and the reason it is that value:** NISR
 * publishes no attention ordering for districts or sectors and none is inferred,
 * so there is no `AUTHORITY_PUBLISHED` sequence to carry; `UPSTREAM_ASSESSED` is
 * unavailable to this vertical by construction. The placeholder labels are in
 * lexical order by label, which is what the field declares.
 */
export const DELIVERY_SUBJECT_LIST: UnrankedSubjectList = {
  headerLabel: 'SUBJECTS',
  orderReason: 'LEXICAL',
  rows: [
    { id: 'placeholder-subject-1', label: 'Placeholder subject A', stateLabel: 'PREVIEW' },
    { id: 'placeholder-subject-2', label: 'Placeholder subject B', stateLabel: 'PREVIEW' },
    { id: 'placeholder-subject-3', label: 'Placeholder subject C', stateLabel: 'PREVIEW' },
  ],
};

/* ═══ §7 · ABSENCE, AND THE DISJOINTNESS RULE ═══════════════════════════ */

/**
 * **A district with no Imihigo evidence has NOT underperformed. It has not been
 * reported on.**
 *
 * `NOT_ASSESSED` reaches the reader through the M08 projection — imported, not
 * reimplemented — and carries its assertion *"nothing has been assessed"*,
 * **never a value**.
 *
 * The inverse closes by the same rule: `ASSESSED_NOTHING_QUALIFIED` is
 * unreachable without its three evidence facts, so **silence cannot imply
 * achievement either.** Absence may not read as failure; absence may not read
 * as success.
 */
export const DELIVERY_ABSENCE_INTERNAL: ObservationAbsenceState = 'NOT_ASSESSED';

export function deliveryReaderAbsence(): ReaderAbsenceState {
  return readerAbsence(DELIVERY_ABSENCE_INTERNAL);
}

/**
 * §7.1 / D-2 · THE THREE DISJOINT TREATMENTS.
 *
 * *"The treatment for `NOT_ASSESSED` and the treatment for a LOW reported value
 * must be visually disjoint. No shared hue, no shared weight, no shared
 * position on any scale. A reader who has learned the low-value treatment must
 * not read the absence treatment as a weak version of it."*
 *
 * And D-2 adds the third: *"A loading state that borrows the absence treatment
 * asserts 'nothing has been assessed' before the surface has asked."* That is
 * `R-C` — *a check that could not run is UNMEASURED, never PASS* — applied to a
 * pixel.
 *
 * Disjointness is declared as data and proven on **three independent axes at
 * once**: ink, border and whether a numeral is present. The hex values are the
 * `sp-*` family's own, quoted so the comparison is a named-colour comparison
 * and not a class-name comparison.
 */
export interface DeliveryTreatment {
  readonly inkClass: string;
  readonly inkHex: string;
  readonly border: 'DASHED' | 'SOLID' | 'NONE';
  readonly carriesNumeral: boolean;
  readonly glyph: string | null;
  readonly busy: boolean;
}

export const DELIVERY_TREATMENTS: Readonly<
  Record<'LOADING' | 'ABSENCE' | 'LOW_VALUE', DeliveryTreatment>
> = {
  LOADING: {
    inkClass: 'text-sp-ink-3',
    inkHex: '#64798a',
    border: 'DASHED',
    carriesNumeral: false,
    glyph: '⋯',
    busy: true,
  },
  /** Achromatic, no numeral, and it states what it asserts. It is never a scale position. */
  ABSENCE: {
    inkClass: 'text-sp-ink-2',
    inkHex: '#9db3c0',
    border: 'NONE',
    carriesNumeral: false,
    glyph: '—',
    busy: false,
  },
  /** A LOW value the publisher reported. Full reading strength, because it is a result. */
  LOW_VALUE: {
    inkClass: 'text-sp-ink',
    inkHex: '#e4eef4',
    border: 'SOLID',
    carriesNumeral: true,
    glyph: null,
    busy: false,
  },
};

export function deliveryTreatmentsDifferOn(
  a: DeliveryTreatment,
  b: DeliveryTreatment,
): readonly string[] {
  const axes: string[] = [];
  if (a.inkHex !== b.inkHex) axes.push('ink');
  if (a.border !== b.border) axes.push('border');
  if (a.carriesNumeral !== b.carriesNumeral || a.glyph !== b.glyph) axes.push('numeral');
  return axes;
}
