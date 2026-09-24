'use client';

import { useReducer, type JSX } from 'react';
import type { PoliticsReadResponse, RetainedPoliticsObservation } from '@globalnews-ai/shared';
import { ReturnControl } from '@/components/navigation/ReturnControl';
import {
  COMPACT_CHANGE_STRIP_PX, COMPACT_CHROME_HARD_MAX, COMPACT_TOP_BAR_PX,
} from '@/lib/specialist/hudGrammar';
import { resolvePolStrings, type PolLocale } from '@/lib/politics/politicsStrings';
import {
  POLITICS_POLL_SLOTS, POLITICS_SOURCE_CLASS_SLOTS, POLITICS_SUBJECT_SLOTS,
} from '@/lib/politics/politicsSubject';
import { Absent, Field, POL_MICRO, Panel, Region } from './PolParts';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART VIII · POLITICS — THE COMPACT READER SURFACE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * NOT THE DESKTOP SCREEN AT 390px, and R14 is explicit about why: the phone is a
 * *"single column, attention/data-first"*, its disclosure is *"detents PEEK/HALF/FULL/
 * WORKSPACE, replacement sheets"*, and *"map is summoned context, not a permanent region"*.
 * The desktop frame has three capped columns and a resident context rail; this one has
 * neither, and a squeezed desktop would have both.
 *
 * ── THE ORDER, AND WHY IT DIFFERS FROM THE DESKTOP READING ORDER ──────────
 *
 * Desktop reads attention-rail → substrate → context-rail across. Compact reads DOWN, and
 * R13's PEEK contents decide what comes first: *"subject identity, change state, one line of
 * assessment."* So the first screenful is identity and the four axes, then the persistent
 * subject types, then the assessment, and only then polling and provenance. The context rail
 * has no compact equivalent that is not simply "further down", and pretending otherwise is
 * how a rail becomes a second resident region on a phone.
 *
 * ── THE CHROME CAP IS INHERITED, NOT CHOSEN ───────────────────────────────
 *
 * `COMPACT_TOP_BAR_PX` 52 + `COMPACT_CHANGE_STRIP_PX` 30 = `COMPACT_CHROME_HARD_MAX` 82.
 * Part IV R2 §16.2 sets it and the shared module carries it, so this surface reads the
 * constant rather than re-deciding a figure that is already ruled.
 *
 * ── LABELS WRAP, THEY DO NOT TRUNCATE ─────────────────────────────────────
 *
 * `Protest / mobilisation campaign` and `Independent assessment` are the product's own
 * vocabulary, and a truncated epistemic state is a different epistemic state. Every label
 * below is allowed to wrap.
 */

type Sheet = 'PROVENANCE' | 'READINESS';

interface View { readonly sheet: Sheet | null; readonly selected: string | null }
type Action =
  | { k: 'OPEN'; v: Sheet }
  | { k: 'CLOSE' }
  | { k: 'SELECT'; v: string };
const reducer = (s: View, a: Action): View => {
  if (a.k === 'OPEN') return { ...s, sheet: a.v };
  if (a.k === 'SELECT') return { sheet: null, selected: a.v };
  return { ...s, sheet: null };
};

/**
 * The detent heights, from R13's mobile model.
 *
 * `PROVENANCE` opens at HALF — it is seven labelled rows a reader scans. `READINESS` opens
 * at HALF too, because it is three lines; a FULL sheet for three lines is a sheet that
 * looks broken. Replacement only: the reducer holds ONE sheet, so a second cannot stack.
 */
const DETENT_VH: Readonly<Record<Sheet, number>> = { PROVENANCE: 55, READINESS: 42 };

function provenancePublisher(observation: RetainedPoliticsObservation): string | null {
  return observation.provenance.institution ?? observation.provenance.providerId ?? null;
}

export function PoliticsCompactScreen({ locale, read }: { locale: PolLocale; read: PoliticsReadResponse }): JSX.Element {
  const [view, dispatch] = useReducer(reducer, {
    sheet: null,
    selected: read.observations[0]?.observationKey ?? null,
  });
  const res = resolvePolStrings(locale);
  const t = res.strings;
  const selected =
    read.observations.find((observation) => observation.observationKey === view.selected) ??
    read.observations[0] ??
    null;
  const subjects = read.observations.filter(
    (observation, index, all) =>
      all.findIndex((candidate) => candidate.subjectId === observation.subjectId) === index,
  );

  return (
    <main data-pol="compact-screen" data-pol-sheet={view.sheet ?? 'none'}
      className="flex min-h-screen flex-col bg-sp-bg text-sp-ink">

      {res.fellBack && (
        <div data-pol="locale-fallback" className={`${POL_MICRO} break-words border-b border-sp-line bg-sp-panel-2 px-[14px] py-[8px] text-sp-ink-3`}>
          {t.labels.localeFallback}
        </div>
      )}

      {/* ══ COMPACT CHROME — 52 + 30, the inherited hard max ═════════════ */}
      <header data-pol="compact-chrome" data-pol-chrome-max={COMPACT_CHROME_HARD_MAX}
        className="flex shrink-0 flex-col border-b border-sp-line bg-sp-panel">
        <div style={{ height: `${COMPACT_TOP_BAR_PX}px` }} className="flex items-center justify-between gap-[10px] px-[14px]">
          <div className="flex min-w-0 items-center gap-[8px]">
            {/* ALPHA MAJOR CONVERGENCE R1 — HOST B: leading item of the EXISTING top micro-line. No row is added; this line already renders at its own height. */}
            <ReturnControl language={locale} variant="microline" iconOnly />
            <span className="text-[15px] font-semibold text-sp-ink">{t.domain}</span>
          </div>
          <span className={POL_MICRO}>{selected ? t.labels.retainedEvidence : t.labels.notAssessed}</span>
        </div>
        {/*
          THE CHANGE STRIP. One row, 30px, and it carries the CHANGE axis alone — not a
          merge of the four. §5's prohibition applies at 390px exactly as it does at 1512.
        */}
        <div style={{ height: `${COMPACT_CHANGE_STRIP_PX}px` }} className="flex items-center gap-[10px] border-t border-sp-line/60 px-[14px]">
          <span className={POL_MICRO}>{t.labels.changeState}</span>
          <Absent label={t.labels.notAssessed} />
        </div>
      </header>

      <div data-pol="compact-body" className="flex flex-1 flex-col gap-[16px] overflow-auto p-[14px]">
        {/*
          PEEK CONTENTS FIRST — identity and the four axes, each in its own row so the
          §5 separation survives a single column. A two-up grid at 390px would pair them,
          and a pair reads as one compound state.
        */}
        <Region title={t.zones.HEADER}>
          <div className="flex flex-col gap-[10px]">
            <Field label={t.labels.subjectType}>
              {selected ? t.subjectTypes[selected.subjectType] : <Absent label={t.labels.awaitingData} />}
            </Field>
            <Field label={t.labels.lifecycleEvent}>
              {selected ? t.observationKinds[selected.observationKind] : <Absent label={t.labels.awaitingData} />}
            </Field>
            <Field label={t.labels.confidence}><Absent label={t.labels.notAssessed} /></Field>
            <Field label={t.labels.jurisdiction}><Absent label={t.labels.awaitingData} /></Field>
            {/* §8's pair, kept together and kept apart from jurisdiction. */}
            <Field label={t.labels.precision}><Absent label={t.labels.awaitingData} /></Field>
            <Field label={t.labels.precisionCeiling}><Absent label={t.labels.awaitingData} /></Field>
          </div>
        </Region>

        {/* ATTENTION — data-first, and an empty queue is a result. */}
        <Region title={t.zones.ATTENTION}>
          <Panel className="p-[12px]">
            <p className="break-words text-[13px] leading-[1.5] text-sp-ink-2">
              {read.observations.length > 0 ? t.labels.retainedSubjectsAvailable : t.labels.emptyIsResult}
            </p>
          </Panel>
        </Region>

        {/*
          THE THREE PERSISTENT SUBJECT TYPES — stacked rows rather than the desktop's cell
          grid. At 390px three cells side by side truncate `Protest / mobilisation campaign`
          to something that is not its name.
        */}
        <Region title={t.zones.SUBSTRATE}>
          <div className="flex flex-col">
            {POLITICS_SUBJECT_SLOTS.map((slot) => (
              <div key={slot.subjectType} data-pol="subject-slot" data-pol-subject={slot.subjectType}
                className="flex items-baseline justify-between gap-[12px] border-b border-sp-line/50 py-[10px] last:border-b-0">
                <span className="min-w-0 break-words text-[13px] text-sp-ink-2">{t.subjectTypes[slot.subjectType]}</span>
                <span className={`${POL_MICRO} shrink-0`}>
                  {read.observations.some((observation) => observation.subjectType === slot.subjectType)
                    ? t.labels.retainedEvidence
                    : t.labels.notAssessed}
                </span>
              </div>
            ))}
          </div>
          {subjects.length > 0 ? (
            <div className="mt-[8px] flex flex-col border border-sp-line bg-sp-panel">
              {subjects.map((observation) => (
                <button
                  key={observation.subjectId}
                  type="button"
                  aria-pressed={selected?.subjectId === observation.subjectId}
                  onClick={() => dispatch({ k: 'SELECT', v: observation.observationKey })}
                  className="flex min-h-[58px] flex-col gap-[4px] border-b border-sp-line/50 px-[10px] py-[9px] text-left last:border-b-0"
                >
                  <span className={POL_MICRO}>
                    {t.subjectTypes[observation.subjectType]} · {t.stages[observation.claim.stage]}
                  </span>
                  <span className="line-clamp-2 break-words text-[12px] leading-[1.45] text-sp-ink-2">
                    {observation.claim.sourceText}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Region>

        <Region title={t.labels.assessment} note={selected ? t.labels.notAssessed : t.labels.awaitingData}>
          <Panel className="flex flex-col gap-[10px] p-[12px]">
            <Field label={t.labels.stage}>
              {selected ? t.stages[selected.claim.stage] : <Absent label={t.labels.awaitingData} />}
            </Field>
            <Field label={t.labels.actors}><Absent label={t.labels.notAssessed} /></Field>
            <Field label={t.labels.evidence}>
              {selected?.sourceReference.sourceUrl ? (
                <a
                  href={selected.sourceReference.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sp-cyan"
                >
                  {selected.sourceReference.citation ?? t.labels.openSource}
                </a>
              ) : selected?.sourceReference.citation ? (
                selected.sourceReference.citation
              ) : (
                <Absent label={t.labels.noVerifiedEvidence} />
              )}
            </Field>
            <Field label={t.labels.crossDomain}><Absent label={t.labels.awaitingData} /></Field>
          </Panel>
        </Region>

        {/*
          POLLING, COMPACT. The ten fields survive the squeeze — §7 carries all of them with
          every number, and dropping four on a phone would mean a reader on a phone gets a
          number with less of its methodology than a reader at a desk.
        */}
        <Region title={t.labels.polling} note={t.labels.awaitingData}>
          <Panel className="grid gap-[10px_14px] p-[12px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,120px),1fr))]">
            {POLITICS_POLL_SLOTS.map((slot) => (
              <Field key={slot.field} label={t.pollFields[slot.field]}>
                <Absent label={t.labels.awaitingData} />
              </Field>
            ))}
          </Panel>
        </Region>

        {/* Watch/Follow and Timeline stay reachable on the phone, as the activation requires. */}
        <Region title={t.zones.CONTEXT}>
          <div className="flex flex-col gap-[10px]">
            <Field label={t.labels.watch}><Absent label={t.labels.awaitingData} /></Field>
            <Field label={t.labels.timeline}>
              {selected ? selected.publishedAt : <Absent label={t.labels.awaitingData} />}
            </Field>
            <Field label={t.labels.ask}><Absent label={t.labels.awaitingData} /></Field>
          </div>
        </Region>

        <button type="button" data-pol="open-provenance" onClick={() => dispatch({ k: 'OPEN', v: 'PROVENANCE' })}
          className={`${POL_MICRO} min-h-[44px] self-start border border-sp-line px-[12px] text-sp-ink-2`}>
          {t.labels.showProvenance} →
        </button>

        <button type="button" data-pol="open-readiness" onClick={() => dispatch({ k: 'OPEN', v: 'READINESS' })}
          className={`${POL_MICRO} min-h-[44px] self-start break-words px-[2px] text-left text-sp-ink-3`}>
          {t.labels.developerDetail}
        </button>
      </div>

      {/*
        THE REPLACEMENT SHEET. One at a time — the reducer holds a single value, so a second
        sheet is structurally the same act as changing which one is open, exactly as R13
        requires.
      */}
      {view.sheet !== null && (
        <section data-pol="compact-sheet" data-pol-detent={view.sheet} role="region"
          aria-label={view.sheet === 'PROVENANCE' ? t.labels.showProvenance : t.labels.developerDetail}
          style={{ height: `${DETENT_VH[view.sheet]}vh` }}
          className="flex shrink-0 flex-col gap-[12px] overflow-auto border-t border-sp-line bg-sp-panel p-[14px]">
          <div className="flex items-center justify-between gap-[10px]">
            <h2 className={`${POL_MICRO} text-sp-ink-2`}>
              {view.sheet === 'PROVENANCE' ? t.labels.showProvenance : t.labels.developerDetail}
            </h2>
            <button type="button" data-pol="sheet-close" onClick={() => dispatch({ k: 'CLOSE' })}
              className={`${POL_MICRO} min-h-[44px] border border-sp-line px-[14px] text-sp-ink-2`}>
              {t.labels.close}
            </button>
          </div>

          {view.sheet === 'PROVENANCE' && (
            <div className="flex flex-col gap-[10px]">
              {selected ? (
                <Panel className="flex flex-col gap-[9px] p-[12px]">
                  <Field label={t.labels.subject}>
                    {t.subjectTypes[selected.subjectType]} · {t.stages[selected.claim.stage]}
                  </Field>
                  <Field label={t.labels.sourceType}>{selected.provenance.sourceType}</Field>
                  <Field label={t.labels.evidenceRole}>
                    {selected.provenance.evidenceRole ?? <Absent label={t.labels.awaitingData} />}
                  </Field>
                  <Field label={t.labels.publisher}>
                    {provenancePublisher(selected) ?? <Absent label={t.labels.awaitingData} />}
                  </Field>
                  <Field label={t.labels.publishedAt}>{selected.publishedAt}</Field>
                  <Field label={t.labels.retrievedAt}>{selected.temporal.retrievedAt}</Field>
                  <Field label={t.labels.evidence}>{selected.claim.sourceText}</Field>
                  {selected.sourceReference.sourceUrl && (
                    <a
                      href={selected.sourceReference.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] self-start border border-sp-line px-[12px] py-[10px] text-[12px] text-sp-cyan"
                    >
                      {t.labels.openSource} →
                    </a>
                  )}
                </Panel>
              ) : null}
              {POLITICS_SOURCE_CLASS_SLOTS.map((slot) => (
                <div key={slot.state} data-pol="source-class" data-pol-state={slot.state}
                  className="flex items-baseline justify-between gap-[10px] border-b border-sp-line/50 py-[8px] last:border-b-0">
                  <span className="min-w-0 break-words text-[12px] text-sp-ink-2">{t.epistemic[slot.state]}</span>
                  <Absent label={t.labels.noVerifiedEvidence} />
                </div>
              ))}
            </div>
          )}

          {view.sheet === 'READINESS' && (
            <p className="break-words text-[13px] leading-[1.5] text-sp-ink-2">
              {read.observations.length > 0 ? t.labels.retainedEvidence : t.labels.awaitingData} · {read.absence ?? t.labels.notAssessed}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
