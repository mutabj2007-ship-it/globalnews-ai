'use client';

import { useReducer, type JSX } from 'react';
import { SpecialistHudLine } from '@/components/specialist/SpecialistHudLine';
import { HUD_LINE_PX } from '@/lib/specialist/hudGrammar';
import type { HudLine } from '@/lib/specialist/hudGrammar';
import { resolvePolStrings, type PolLocale, type PolStrings } from '@/lib/politics/politicsStrings';
import {
  POLITICS_POLL_SLOTS, POLITICS_SOURCE_CLASS_SLOTS, POLITICS_SUBJECT_SLOTS,
} from '@/lib/politics/politicsSubject';
import { POLITICS_EVENT_KINDS } from '@/lib/politics/politicsDomain';
import { Absent, Chip, Field, POL_MICRO, Panel, Region, Well } from './PolParts';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART VIII · POLITICS — THE DESKTOP READER SURFACE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PHASE 1 §4 GIVES FOUR ZONES AND SAYS WHAT MAY NOT JOIN THEM:
 *
 *   1  political state header    jurisdiction · assessment · confidence · precision ceiling
 *   2  attention queue           capped rail, ordered upstream, change state + evidence delta
 *   3  primary substrate         the selected subject, and the summoned map when geography matters
 *   4  context rail              collapsible, capped: Watch · Timeline · evidence · Ask · Deep Analysis
 *
 * *"Nothing else is permanently resident. Polls, actor profiles, relationship graphs, source
 * comparisons, legal context and Watch configuration are reached through popup, drawer or
 * workspace."* This composition adds no fifth region, and R14 is why the rails are capped
 * rather than proportional: *"rails stay capped … the substrate absorbs all surplus … no new
 * permanent region is created because room exists."*
 *
 * ── SITUATION-FIRST, WHICH IS VISIBLE EVEN WITH NOTHING TO SHOW ───────────
 *
 * §3: *"The dashboard opens on material political change and persistent political subjects,
 * never on 'latest political news'. Articles are evidence. The persistent political subject
 * is the product."* So the substrate's first region is the three PERSISTENT SUBJECT TYPES,
 * not a feed and not a headline list — a reader can see the product's unit of account before
 * a single subject exists.
 *
 * ── WHAT IS NOT HERE, DELIBERATELY ────────────────────────────────────────
 *
 * No party, candidate, institution, officeholder, jurisdiction, date, count or percentage
 * appears anywhere in this file. No ranking, no ordering control, no score, no winner, no
 * severity and no hue that varies by political state. §4 of the activation forbids each of
 * those, and a guard asserts the first of them against the rendered text.
 */

type Drawer = 'PROVENANCE' | 'READINESS';

interface View { readonly drawer: Drawer | null }
type Action = { k: 'OPEN'; v: Drawer } | { k: 'CLOSE' };
const reducer = (s: View, a: Action): View => (a.k === 'OPEN' ? { drawer: a.v } : { drawer: null });

/**
 * R14's caps, transcribed. *"Attention rail ≈ 320–360 · context rail ≈ 360–400."*
 * The lower bound of each band is used: these rails hold labels and unbound slots today, and
 * a rail sized for content it does not have is the empty-canvas failure §12 of the activation
 * names.
 */
const ATTENTION_RAIL_PX = 320;
const CONTEXT_RAIL_PX = 360;
/** *"Prose stays capped"* — the family measure, at the low end of R14's 68–76ch. */
const PROSE_CH = 68;
/** *"The page caps and centres beyond roughly 2100."* */
const PAGE_CAP_PX = 2100;

/**
 * THE HUD LINE — SHARED GRAMMAR, CONSUMED NOT COPIED.
 *
 * `SpecialistHudLine` types its `domain` as `string`, so Politics uses it today without the
 * `SpecialistDomainId` widening that `politicsDomain.ts` holds as a seam. Four of the seven
 * `HUD_SLOTS` are populated with their absent value; three — `PRIMARY_MEASURE`, `CHANGE`,
 * `WATCH` — are OMITTED rather than dashed, because `renderableSlots` drops what is absent
 * and a HUD that dashes every slot is a bar of nothing.
 *
 * `STATE` deliberately carries the unavailable word rather than a political state: the slot
 * exists, and what fills it is not this lane's to choose.
 */
function politicsHud(t: PolStrings): HudLine {
  /*
    TWO SLOTS, AND THE OTHER FIVE ARE OMITTED RATHER THAN DASHED.

    The first build populated MODE, STATE, SCOPE and CONFIDENCE, and the capture showed
    why that was wrong: SCOPE and CONFIDENCE both rendered `AWAITING VERIFIED DATA`, so the
    bar read `POLITICS · NOT ASSESSED · AWAITING VERIFIED DATA · AWAITING VERIFIED DATA` —
    the same phrase twice, forty pixels apart, over a header that had already given both
    facts their own labelled slot.

    A HUD is a summary line. Summarising nothing four times is not a summary, and
    `renderableSlots` exists precisely so a slot with nothing to say is absent rather than
    filled. MODE names the surface; STATE carries the one axis a reader glances at. The
    other five return when something distinguishes them.
  */
  return {
    MODE: { value: t.domain },
    STATE: { value: t.labels.notAssessed },
  };
}

export function PoliticsScreen({ locale }: { locale: PolLocale }): JSX.Element {
  const [view, dispatch] = useReducer(reducer, { drawer: null });
  const res = resolvePolStrings(locale);
  const t = res.strings;

  return (
    <main
      data-pol="screen"
      data-pol-drawer={view.drawer ?? 'none'}
      className="flex min-h-screen flex-col bg-sp-bg text-sp-ink"
      style={{ maxWidth: `${PAGE_CAP_PX}px`, marginInline: 'auto', width: '100%' }}
    >
      {/*
        THE FALLBACK IS DISCLOSED, NEVER SILENT. One slim line — the same treatment Market
        and Humanitarian use — so a Polish reader is told before reading a single label.
      */}
      {res.fellBack && (
        <div data-pol="locale-fallback" className={`${POL_MICRO} border-b border-sp-line bg-sp-panel-2 px-[20px] py-[8px] text-sp-ink-3`}>
          {t.labels.localeFallback}
        </div>
      )}

      {/* ══ ZONE 1 · POLITICAL STATE HEADER ══════════════════════════════ */}
      <header data-pol="zone-header" className="flex flex-col gap-[12px] border-b border-sp-line bg-sp-panel px-[20px] py-[16px]">
        <div className="flex flex-wrap items-baseline justify-between gap-[12px]">
          <div className="flex flex-col gap-[6px]">
            <span className={POL_MICRO}>GlobalNews AI · {t.domain}</span>
            <h1 className="text-[22px] font-semibold text-sp-ink">{t.zones.HEADER}</h1>
          </div>
          {/*
            §9, ON THE FRAME. A reader deciding whether to touch anything deserves to know
            that touching it is free. The spec calls ordinary browsing zero-AI and meters
            only explicit analytical actions, with the cost shown first.
          */}
          <span className={POL_MICRO}>{t.labels.zeroAiNavigation}</span>
        </div>

        {/*
          THE FOUR AXES, AS FOUR SLOTS — §5 RENDERED AS GEOMETRY.

          *"Political status, lifecycle event, shared change state and confidence are four
          independent axes and are never merged into a single chip or colour."* Four labelled
          fields, no shared container, no shared colour, and no compound value. A merge would
          now have to be written on purpose.
        */}
        {/*
          CAPPED, NOT STRETCHED. `auto-fit` across 1512px put ~300px of nothing between four
          short labels, so the four axes read as four unrelated corners of the screen rather
          than as one row a reader compares across. R14's rule for surplus width is that it
          goes to the substrate — *"the substrate absorbs all surplus"* — and a header row is
          not the substrate.
        */}
        <div data-pol="axes" className="grid max-w-[900px] gap-[12px_24px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))]">
          <Field label={t.labels.subjectType}><Absent label={t.labels.awaitingData} /></Field>
          <Field label={t.labels.lifecycleEvent}><Absent label={t.labels.awaitingData} /></Field>
          <Field label={t.labels.changeState}><Absent label={t.labels.awaitingData} /></Field>
          <Field label={t.labels.confidence}><Absent label={t.labels.awaitingData} /></Field>
        </div>

        {/*
          ══ SCOPE AND PRECISION — §8, AND THE ONE THING THIS FRAME MUST NOT IMPLY ══

          The activation: *"do not imply a country/region is bound when the runtime subject
          is unbound."* No jurisdiction is named, and the precision PAIR is rendered because
          §8 makes both first-class and they are different facts — what a figure carries,
          and what this deployment may ever show. Both are absent, and §8's rule is that
          missing precision is *"made honest and visible, never filled"*.
        */}
        <div data-pol="scope" className="flex max-w-[900px] flex-wrap gap-[12px_24px]">
          <Field label={t.labels.jurisdiction}><Absent label={t.labels.awaitingData} /></Field>
          <Field label={t.labels.precision}><Absent label={t.labels.awaitingData} /></Field>
          <Field label={t.labels.precisionCeiling}><Absent label={t.labels.awaitingData} /></Field>
          <Field label={t.labels.lastReassessment}><Absent label={t.labels.awaitingData} /></Field>
        </div>

        <div style={{ height: `${HUD_LINE_PX}px` }} className="border-t border-sp-line/60">
          <SpecialistHudLine line={politicsHud(t)} domain="POLITICS" />
        </div>
      </header>

      {view.drawer === null ? (
        /*
          THE THREE-ZONE BODY — R14's laptop/desktop/wide behaviour in one grid.

          Attention rail capped, substrate as `1fr` absorbing every surplus pixel, context
          rail capped. At narrow widths the columns collapse and the rails follow the
          substrate, which is the ordering the compact composition uses.
        */
        <div
          data-pol="body"
          className="relative grid flex-1 gap-[18px_24px] overflow-auto p-[20px] [align-content:start] [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:var(--pol-cols)]"
          style={{ ['--pol-cols' as string]: `minmax(0, ${ATTENTION_RAIL_PX}px) minmax(0, 1fr) minmax(0, ${CONTEXT_RAIL_PX}px)` }}
        >
          {/* ══ ZONE 2 · ATTENTION QUEUE ═══════════════════════════════════ */}
          <Region title={t.zones.ATTENTION}>
            <Panel className="p-[14px]">
              {/*
                AN EMPTY QUEUE IS A RESULT, NOT AN ERROR — the shared queue's own
                `emptyIsResult` semantics, stated in words because the geometry alone cannot
                say it. Nothing here is ordered: C·2 keeps ranking upstream, R11 puts
                materiality into the SHARED attentionRank, and §4 of the activation forbids
                ranking political actors at all.
              */}
              <p className="text-[13px] leading-[1.5] text-sp-ink-2" style={{ maxWidth: `${PROSE_CH}ch` }}>
                {t.labels.emptyIsResult}
              </p>
            </Panel>
          </Region>

          {/* ══ ZONE 3 · PRIMARY SUBSTRATE ═════════════════════════════════ */}
          <div className="flex min-w-0 flex-col gap-[18px]">
            {/*
              THE THREE PERSISTENT SUBJECT TYPES — §2's *"three new persistent subject types
              are requested, and only three"*. This is the product's unit of account, shown
              before any subject exists, and it is the honest answer to "what will this
              dashboard contain".

              NO COUNT IS SHOWN. Zero elections is a claim about a jurisdiction; no source is
              a statement about us. The activation forbids fake protest counts, and a `0` a
              reader reads as a count is one.
            */}
            <Region title={t.zones.SUBSTRATE} note={t.labels.awaitingData}>
              <div data-pol="subject-slots" className="grid gap-[1px] bg-sp-line [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
                {POLITICS_SUBJECT_SLOTS.map((slot) => (
                  <div key={slot.subjectType} data-pol="subject-slot" data-pol-subject={slot.subjectType}
                    className="flex min-w-0 flex-col gap-[6px] bg-sp-panel p-[12px_14px]">
                    <span className={POL_MICRO}>{t.subjectTypes[slot.subjectType]}</span>
                    {/*
                      §8 OF THE ACTIVATION, AT ITS SHARPEST. The protest slot must not imply
                      `no unrest` or `safe`. `Not assessed` is the accepted equivalent it
                      names, and it is true of all three slots for the same reason — a
                      subject exists as a type, and nothing has been assessed.
                    */}
                    <span className="text-[13px] text-sp-ink-2">{t.labels.notAssessed}</span>
                  </div>
                ))}
              </div>
            </Region>

            {/* The substrate well — where the selected subject will be drawn. */}
            <Panel className="flex flex-col gap-[12px] p-[16px_18px]">
              <div className="flex flex-wrap items-baseline justify-between gap-[10px]">
                <span className={POL_MICRO}>{t.labels.assessment}</span>
                <span className={POL_MICRO}>{t.labels.awaitingData}</span>
              </div>
              <Well label={t.labels.awaitingData} />
              <div className="grid gap-[12px_20px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
                <Field label={t.labels.stage}><Absent label={t.labels.awaitingData} /></Field>
                <Field label={t.labels.actors}><Absent label={t.labels.awaitingData} /></Field>
                <Field label={t.labels.evidence}><Absent label={t.labels.noVerifiedEvidence} /></Field>
                <Field label={t.labels.crossDomain}><Absent label={t.labels.awaitingData} /></Field>
              </div>
            </Panel>

            {/*
              ══ INSTITUTIONAL / POLICY CONTEXT — the lifecycle-event kinds ══

              R01's O7 names the event kinds that move a political subject: *"vote,
              resignation, appointment, court ruling, coalition agreement, commission
              decision, rally"*. They are KINDS, not events — no institution is named, no
              parliament, no court, no commission — which is what lets the region exist
              truthfully while G measures **0 of 24 producers**.
            */}
            <Region title={t.labels.lifecycleEvent}>
              <div className="flex flex-wrap gap-[6px]">
                {POLITICS_EVENT_KINDS.map((kind) => (
                  <Chip key={kind}>{t.eventKinds[kind]} · {POLITICS_ABSENT_CHIP}</Chip>
                ))}
              </div>
            </Region>

            {/*
              ══ POLLING — THE DESIGNED EMPTY STATE (§7 / R09) ══

              Ten labelled fields and not one number. §7 is emphatic — *"no aggregation into
              a pseudo-forecast"*, *"no commercial polling feed is assumed to exist; the
              empty state is a designed state"* — and D-04 adds that where method, geography
              or question differ, no trend line is drawn. There is no series here, no
              comparison, and no field from which one could be derived.
            */}
            <Region title={t.labels.polling} note={t.labels.awaitingData}>
              <Panel className="grid gap-[12px_20px] p-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
                {POLITICS_POLL_SLOTS.map((slot) => (
                  <Field key={slot.field} label={t.pollFields[slot.field]}>
                    <Absent label={t.labels.awaitingData} />
                  </Field>
                ))}
              </Panel>
            </Region>
          </div>

          {/* ══ ZONE 4 · CONTEXT RAIL ══════════════════════════════════════ */}
          <div data-pol="zone-context" className="flex min-w-0 flex-col gap-[16px]">
            <Region title={t.zones.CONTEXT}>
              <div className="flex flex-col gap-[10px]">
                {/*
                  WATCH IS THE SHARED PRODUCT MECHANISM. The activation: *"reuse the shared
                  accepted Watch/Follow surface. Do not create a Politics-specific alert
                  system."* So this is an entry point and a state, never a second alert
                  engine — Part VIII agrees, calling Politics *"a domain lens over shared
                  capabilities … not a second Watch, map, Ask, Timeline or evidence system"*.
                */}
                <Field label={t.labels.watch}><Absent label={t.labels.awaitingData} /></Field>
                <Field label={t.labels.timeline}><Absent label={t.labels.awaitingData} /></Field>
                <Field label={t.labels.ask}><Absent label={t.labels.awaitingData} /></Field>
                <Field label={t.labels.deepAnalysis}><Absent label={t.labels.awaitingData} /></Field>
              </div>
            </Region>

            {/*
              ══ PROVENANCE — THE SEVEN EPISTEMIC STATES, ALL SEVEN ══

              §6 requires them to *"stay visibly distinct"*. An empty surface is exactly where
              seven quietly becomes three, so all seven are rendered unbound. The control
              below opens the reader-facing provenance explanation; no source, publisher or
              institution is named beside an absent artifact.
            */}
            <Region title={t.labels.sourceClass}>
              <div className="flex flex-col">
                {POLITICS_SOURCE_CLASS_SLOTS.map((slot) => (
                  <div key={slot.state} data-pol="source-class" data-pol-state={slot.state}
                    className="flex items-baseline justify-between gap-[10px] border-b border-sp-line/50 py-[6px] last:border-b-0">
                    <span className="text-[12px] text-sp-ink-2">{t.epistemic[slot.state]}</span>
                    <Absent label={t.labels.noVerifiedEvidence} />
                  </div>
                ))}
              </div>
              <button type="button" data-pol="open-provenance" onClick={() => dispatch({ k: 'OPEN', v: 'PROVENANCE' })}
                className={`${POL_MICRO} mt-[4px] min-h-[44px] self-start border border-sp-line px-[12px] text-sp-ink-2`}>
                {t.labels.showProvenance} →
              </button>
            </Region>

            {/*
              REGION H — the readiness detail, behind the quietest control on the surface.
              *"Do not allow readiness/debug information to dominate."*
            */}
            <button type="button" data-pol="open-readiness" onClick={() => dispatch({ k: 'OPEN', v: 'READINESS' })}
              className={`${POL_MICRO} min-h-[44px] self-start px-[2px] text-left text-sp-ink-3`}>
              {t.labels.developerDetail}
            </button>
          </div>
        </div>
      ) : (
        /*
          THE DRAWER REPLACES THE BODY — R13: *"popup explains, drawer investigates … no
          popup-on-popup, no sheet-on-sheet, one sustained panel at a time."*
        */
        <div data-pol="drawer" data-pol-drawer-open={view.drawer} role="region"
          aria-label={view.drawer === 'PROVENANCE' ? t.labels.showProvenance : t.labels.developerDetail}
          className="relative flex flex-1 flex-col gap-[16px] overflow-auto p-[20px]"
          style={{ maxWidth: `${PROSE_CH + 18}ch` }}>
          <div className="flex items-center justify-between gap-[12px]">
            <h2 className={`${POL_MICRO} text-sp-ink-2`}>
              {view.drawer === 'PROVENANCE' ? t.labels.showProvenance : t.labels.developerDetail}
            </h2>
            <button type="button" data-pol="drawer-close" onClick={() => dispatch({ k: 'CLOSE' })}
              className={`${POL_MICRO} min-h-[44px] border border-sp-line px-[14px] text-sp-ink-2`}>
              {t.labels.close}
            </button>
          </div>

          {view.drawer === 'PROVENANCE' && (
            <div className="flex flex-col gap-[10px]">
              {/*
                §6's rule, stated to the reader rather than only obeyed: the class attaches to
                the ARTIFACT, never permanently to the institution. That is why the seven are
                a vocabulary here and not a list of publishers.
              */}
              {POLITICS_SOURCE_CLASS_SLOTS.map((slot) => (
                <Field key={slot.state} label={t.epistemic[slot.state]}>
                  <Absent label={t.labels.noVerifiedEvidence} />
                </Field>
              ))}
            </div>
          )}

          {view.drawer === 'READINESS' && (
            <div className="flex flex-col gap-[12px]">
              <p className="text-[13px] leading-[1.5] text-sp-ink-2" style={{ maxWidth: `${PROSE_CH}ch` }}>
                {t.labels.awaitingData} · {t.labels.noVerifiedEvidence}
              </p>
              <Field label={t.labels.subjectType}>
                {POLITICS_SUBJECT_SLOTS.map((s) => t.subjectTypes[s.subjectType]).join(' · ')}
              </Field>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

/** The chip's absent marker, so the glyph is not spelled a second time in JSX text. */
const POLITICS_ABSENT_CHIP = '—';
