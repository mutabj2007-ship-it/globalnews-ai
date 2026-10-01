import {
  assertNoNarrativeFiller,
  type AskHandoffRefusal,
  type HumanitarianAnalysisWorkspace,
  type HumanitarianAskHandoff,
  type HumanitarianWorkspaceDimension,
  type HumanitarianWorkspaceDimensionId,
  type ObservationAbsenceState,
} from '@globalnews-ai/shared';
import type { HumLocale, HumStrings } from './humStrings';

/**
 * PART X · HUMANITARIAN — THE WORKSPACE'S READER LAYER.
 *
 * The semantics are in `shared/humanitarian/analysis-workspace`, which carries no
 * reader-facing string on purpose. This file is the only place the projection becomes
 * words, and it is the only place a locale is consulted.
 *
 * THREE RULES IT ENFORCES RATHER THAN DOCUMENTS.
 *   1. An absence label is looked up, never defaulted. There is no `??` fallback: a
 *      state with no authored label throws, because a missing label silently rendered
 *      as the empty string is an absence a reader cannot see.
 *   2. `ASSESSED_NOTHING_QUALIFIED` has no label slot anywhere, so no code path and no
 *      copy edit can make this surface say "checked, nothing qualified".
 *   3. The Ask question is COMPOSED from the subject's publisher-stated kinds, and a
 *      kind with no authored label refuses the handoff instead of printing its token.
 *      A reader must never be shown `SOURCE_INUNDATION_EXTENT`.
 */

export class HumWorkspaceCopyMissing extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HumWorkspaceCopyMissing';
  }
}

export function humDimensionLabel(t: HumStrings, id: HumanitarianWorkspaceDimensionId): string {
  const label = t.workspace.dimensions[id];
  if (label === undefined || label.length === 0) {
    throw new HumWorkspaceCopyMissing(`HUM_WORKSPACE_DIMENSION_LABEL_MISSING: '${id}'.`);
  }
  return label;
}

/**
 * The reason an empty dimension is empty, in the reader's words. `null` is not a
 * reason and is refused here rather than rendered as nothing.
 */
export function humAbsenceLabel(t: HumStrings, absence: ObservationAbsenceState | null): string {
  if (absence === null) {
    throw new HumWorkspaceCopyMissing(
      'HUM_WORKSPACE_ABSENCE_WITHOUT_STATE: an empty dimension named no reason.',
    );
  }
  if (absence === 'ASSESSED_NOTHING_QUALIFIED') {
    throw new HumWorkspaceCopyMissing(
      'HUM_WORKSPACE_ABSENCE_REASSURES: this surface has no slot for a positive finding.',
    );
  }
  const label = t.workspace.absence[absence];
  if (label === undefined || label.length === 0) {
    throw new HumWorkspaceCopyMissing(`HUM_WORKSPACE_ABSENCE_LABEL_MISSING: '${absence}'.`);
  }
  return label;
}

/** Reading order comes from the projection, never from the component tree. */
export function humWorkspaceRows(
  workspace: HumanitarianAnalysisWorkspace,
): readonly HumanitarianWorkspaceDimension[] {
  return workspace.dimensions;
}

/* ────────────────────────────────────────────────────────────────────────────
   THE OBSERVATION KINDS A READER MAY BE SHOWN.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Authored per locale, and DELIBERATELY NOT EXHAUSTIVE. The substrate admits exactly
 * one kind today. A second kind arriving must be authored here before it can appear in
 * a question, which is a translation decision rather than a rendering accident.
 */
const OBSERVATION_KIND_LABELS: Readonly<Record<'en' | 'pl', Readonly<Record<string, string>>>> = {
  en: { SOURCE_INUNDATION_EXTENT: 'the recorded flood extent' },
  pl: { SOURCE_INUNDATION_EXTENT: 'zapisany zasięg zalania' },
};

export type HumAskCompositionRefusal = AskHandoffRefusal | 'KIND_NOT_AUTHORED';

export type HumAskComposition =
  | { readonly available: false; readonly refusal: HumAskCompositionRefusal }
  | { readonly available: true; readonly question: string };

/**
 * THE QUESTION THE READER WOULD HAVE TYPED, NOT A PROMPT.
 *
 * It is a plain question in the reader's language, built only from publisher-stated
 * kinds. It carries no instruction, no role, no system text and no record identifier —
 * Ask V2's turn DTO is four fields and resolves scope server-side from the question, so
 * the question is the whole carrier and it has to read like one a person wrote.
 */
export function humAskQuestion(
  handoff: HumanitarianAskHandoff,
  locale: HumLocale,
): HumAskComposition {
  if (!handoff.available) return { available: false, refusal: handoff.refusal };
  const table = locale === 'pl' ? OBSERVATION_KIND_LABELS.pl : OBSERVATION_KIND_LABELS.en;
  const phrases: string[] = [];
  for (const kind of handoff.observationKinds) {
    const phrase = table[kind];
    if (phrase === undefined) return { available: false, refusal: 'KIND_NOT_AUTHORED' };
    phrases.push(phrase);
  }
  const subject = phrases.join(locale === 'pl' ? ' i ' : ' and ');
  const question =
    locale === 'pl'
      ? `Co wiadomo o tej sytuacji humanitarnej na podstawie ${subject}?`
      : `What is known about this humanitarian situation from ${subject}?`;
  return { available: true, question };
}

export function humAskUnavailableLabel(t: HumStrings, refusal: HumAskCompositionRefusal): string {
  if (refusal === 'KIND_NOT_AUTHORED') return t.workspace.askUnavailableKind;
  const label = t.workspace.askUnavailable[refusal];
  if (label === undefined || label.length === 0) {
    throw new HumWorkspaceCopyMissing(`HUM_WORKSPACE_ASK_REFUSAL_LABEL_MISSING: '${refusal}'.`);
  }
  return label;
}

/* ────────────────────────────────────────────────────────────────────────────
   OPENING A STORED ANALYSIS — NAVIGATION, NEVER A RUN.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The accepted stored-analysis address is `/ask?operation=<id>`, read display-only by
 * `GET /ask-v2/operations/:id` — 0 AI, 0 provider, 0 Sand. This builds that href and
 * nothing else: there is no execute, accept, reserve or run path in this module, and no
 * `?q=` is ever produced, because a `q` would arrive at Ask as a question to compute.
 */
const OPERATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function humStoredAnalysisHref(operationId: string | null): string | null {
  if (operationId === null) return null;
  if (!OPERATION_ID_PATTERN.test(operationId)) return null;
  return `/ask?operation=${encodeURIComponent(operationId)}`;
}

/**
 * Every string this surface will show for an empty dimension, checked against the
 * shared reassurance list. Exported so the suite runs it over both authored locales
 * rather than over a sample.
 */
export function assertWorkspaceCopyDoesNotReassure(t: HumStrings, where: string): void {
  for (const [state, text] of Object.entries(t.workspace.absence)) {
    assertNoNarrativeFiller(text, `${where} absence.${state}`);
  }
  for (const [refusal, text] of Object.entries(t.workspace.askUnavailable)) {
    assertNoNarrativeFiller(text, `${where} askUnavailable.${refusal}`);
  }
  assertNoNarrativeFiller(t.workspace.subtitle, `${where} subtitle`);
  assertNoNarrativeFiller(t.workspace.unknownRoster, `${where} unknownRoster`);
  assertNoNarrativeFiller(t.workspace.askUnavailableKind, `${where} askUnavailableKind`);
}
