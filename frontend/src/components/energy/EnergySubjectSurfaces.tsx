'use client';

import { ENERGY_INK, ENERGY_LINE, ENERGY_RADIUS, ENERGY_SEMANTIC, ENERGY_SURFACE, ENERGY_TYPE } from '@/lib/energy/energyTokens';
import {
  ChangeStateTokens,
  DataTierBadge,
  ENERGY_TONE_HEX,
  ENERGY_TONE_LINE,
  Meta,
  PrecisionBadge,
  SandAffordance,
  SectionLabel,
  StateChip,
  WatchControl,
  mono,
} from '@/components/energy/EnergyParts';
import { ENERGY_GATES } from '@/lib/energy/energyFrame';
import { readerAvailability } from '@/lib/energy/energyDisclosure';
import { ENERGY_ABSENT, formatEnergyString, type EnergyStrings } from '@/lib/energy/energyStrings';
import { MachineReadable } from '@/lib/typography/runBoundary';
import type { EnergySubject } from '@/lib/energy/energyModel';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ONE HUD · ONE DRAWER · ONE LENS — FOR EVERY SUBJECT TYPE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R07 and the implementation matrix are emphatic that these are SINGLE
 * components rather than families:
 *
 *   "One HUD component serves chokepoint, corridor, asset and grid-node
 *    selection. FIELDS VARY BY SUBJECT TYPE; STRUCTURE AND PLACEMENT RULES DO
 *    NOT."
 *   "EXACTLY ONE DRAWER COMPONENT for every subject type."
 *   "One lens component for every persistent subject type."
 *
 * So there is no `ChokepointHud` and no `GridDrawer` in this file, and adding
 * one later would be the drift these rules exist to prevent — the R05
 * inherited-delta register records that asset selection INHERITS the chokepoint
 * HUD and a grid situation INHERITS the corridor drawer and lens.
 *
 * ── THE DIVISION OF LABOUR, WHICH IS ALSO A LIMIT ────────────────────────
 *
 *   HUD       explains quickly. Anchored, clamped, ONE route onward.
 *             "Never carries evidence lists, history or configuration."
 *   DRAWER    investigates. Takes the SINGLE right region BY REPLACEMENT.
 *   LENS      understands the subject. Transient, explicit ← return, not a route.
 *
 * Each limit is enforced by what the component is given: the HUD below has no
 * evidence prop and no timeline prop, so it cannot grow into a drawer.
 */

/* ══ THE HUD ═══════════════════════════════════════════════════════════════ */

interface HudProps {
  readonly subject: EnergySubject;
  readonly strings: EnergyStrings;
  /** Already clamped by the caller against the substrate's own bounds. */
  readonly x: number;
  readonly y: number;
  readonly onClose: () => void;
  readonly onInvestigate: () => void;
  readonly onToggleWatch: () => void;
}

export function EnergySubjectHud({ subject, strings, x, y, onClose, onInvestigate, onToggleWatch }: HudProps): JSX.Element {
  return (
    <div
      data-energy-surface="hud"
      data-energy-subject={subject.id}
      role="dialog"
      aria-label={subject.name}
      style={{
        position: 'absolute',
        width: '290px',
        left: `${x}px`,
        top: `${y}px`,
        background: 'rgba(9,16,25,.97)',
        border: `1px solid ${subject.readerState === null ? ENERGY_TONE_LINE[subject.tone] : ENERGY_LINE.achromatic}`,
        borderRadius: ENERGY_RADIUS.card,
        boxShadow: '0 18px 44px rgba(0,0,0,.6)',
      }}
    >
      <div style={{ padding: '12px 14px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {subject.readerState === null ? (
            subject.changeState === null ? null : <ChangeStateTokens state={subject.changeState} labels={strings.changeState} tone={subject.tone} />
          ) : (
            <StateChip state={subject.readerState} strings={strings} canonical={subject.canonicalAbsence} />
          )}
          <Meta>{strings.subjectType[subject.type]}</Meta>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...mono(11, ENERGY_INK.meta), background: 'none', border: 'none', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
        <span style={{ fontSize: '15.5px', fontWeight: 600, color: ENERGY_INK.primary }}>{subject.name}</span>
        <span style={{ fontSize: '12.5px', color: ENERGY_INK.secondary, lineHeight: 1.5 }}>
          {subject.brief ?? strings.stateWhy[subject.readerState ?? 'NO_DATA']}
        </span>
      </div>

      <div style={{ borderTop: `1px solid ${ENERGY_LINE.hairline}`, padding: '9px 14px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <Row label={strings.hudEvidence} value={subject.evidence.length === 0 ? ENERGY_ABSENT : String(subject.evidence.length)} tone={ENERGY_SEMANTIC.cyan} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', gap: '10px' }}>
          <span style={{ color: ENERGY_INK.dim }}>{strings.hudPrecision}</span>
          {/*
            MANDATORY. The HUD renders a precision statement whether the
            geometry was drawn or withheld — a withheld geometry still has an
            evidence precision, and hiding it would be the one case where a
            reader could infer precision from the renderer.
          */}
          {subject.geometry === null ? (
            <Meta tone={ENERGY_SEMANTIC.violet}>{formatEnergyString(strings.gateBlockedTemplate, { gate: subject.geometryWithheldBy ?? 'E01' })}</Meta>
          ) : (
            <PrecisionBadge precision={subject.geometry.precision} strings={strings} />
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', gap: '10px' }}>
          <span style={{ color: ENERGY_INK.dim }}>{strings.hudDataTier}</span>
          <DataTierBadge tier={subject.dataTier} strings={strings} />
        </div>
      </div>

      {/* ONE ROUTE ONWARD. There is exactly one, and it is the drawer. */}
      <div style={{ borderTop: `1px solid ${ENERGY_LINE.hairline}`, display: 'flex', gap: '8px', padding: '8px' }}>
        <WatchControl watched={subject.watched} strings={strings} onToggle={onToggleWatch} />
        <button
          type="button"
          onClick={onInvestigate}
          style={{
            flex: 1,
            minHeight: '44px',
            ...mono(undefined, ENERGY_SEMANTIC.cyan),
            background: 'none',
            border: `1px solid ${ENERGY_LINE.cyan}`,
            borderRadius: ENERGY_RADIUS.panel,
            cursor: 'pointer',
          }}
        >
          {strings.hudInvestigate}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
      <span style={{ color: ENERGY_INK.dim }}>{label}</span>
      <span style={{ color: tone ?? ENERGY_INK.quiet }}>{value}</span>
    </div>
  );
}

/* ══ THE DRAWER ════════════════════════════════════════════════════════════ */

interface DrawerProps {
  readonly subject: EnergySubject;
  readonly strings: EnergyStrings;
  readonly onClose: () => void;
  readonly onOpenLens: () => void;
  readonly onToggleWatch: () => void;
}

export function EnergySubjectDrawer({ subject, strings, onClose, onOpenLens, onToggleWatch }: DrawerProps): JSX.Element {
  return (
    <div data-energy-surface="drawer" data-energy-subject={subject.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        style={{
          padding: '13px 16px',
          borderBottom: `1px solid ${ENERGY_LINE.hairline}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flex: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Meta tone={ENERGY_SEMANTIC.cyan}>{strings.drawerTitle}</Meta>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...mono(11, ENERGY_INK.meta), background: 'none', border: 'none', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
        <span style={{ fontSize: '16px', fontWeight: 600, lineHeight: 1.3, color: ENERGY_INK.primary }}>{subject.name}</span>
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
          {subject.readerState === null ? (
            subject.changeState === null ? null : <ChangeStateTokens state={subject.changeState} labels={strings.changeState} tone={subject.tone} />
          ) : (
            <StateChip state={subject.readerState} strings={strings} canonical={subject.canonicalAbsence} />
          )}
          <Meta>{strings.subjectType[subject.type]}</Meta>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${ENERGY_LINE.hairlineSoft}`, display: 'flex', flexDirection: 'column', gap: '7px' }}>
          <SectionLabel>{strings.drawerAssessment}</SectionLabel>
          <span style={{ fontSize: '13px', color: ENERGY_INK.body, lineHeight: 1.55 }}>
            {subject.assessment ?? strings.stateWhy[subject.readerState ?? 'NO_DATA']}
          </span>
        </div>

        {subject.fields.map((field) => (
          <div
            key={field.id ?? field.key}
            style={{
              padding: '10px 16px',
              borderBottom: `1px solid ${ENERGY_LINE.hairlineFaint}`,
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <Meta>{field.key}</Meta>
            <span style={{ fontSize: '12px', color: ENERGY_INK.body, textAlign: 'right', lineHeight: 1.45 }}>{field.value}</span>
          </div>
        ))}

        <div style={{ padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SectionLabel tone={ENERGY_SEMANTIC.cyan}>
            {strings.hudEvidence.toUpperCase()} · {subject.evidence.length === 0 ? ENERGY_ABSENT : subject.evidence.length}
          </SectionLabel>
          {subject.evidence.length === 0 ? (
            /* An empty evidence list renders as COVERAGE GAP, not as a blank drawer. */
            <StateChip state="COVERAGE_GAP" strings={strings} canonical="NO_DATA_FOR_GEOGRAPHY" />
          ) : (
            subject.evidence.slice(0, 3).map((artifact) => <EvidenceRow key={artifact.id} artifact={artifact} strings={strings} />)
          )}
        </div>
      </div>

      <div
        style={{
          flex: 'none',
          borderTop: `1px solid ${ENERGY_LINE.hairline}`,
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '9px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <WatchControl watched={subject.watched} strings={strings} onToggle={onToggleWatch} />
          <button
            type="button"
            onClick={onOpenLens}
            style={{
              flex: 1,
              minHeight: '44px',
              ...mono(undefined, ENERGY_SEMANTIC.cyan),
              background: 'none',
              border: `1px solid ${ENERGY_LINE.cyan}`,
              borderRadius: ENERGY_RADIUS.panel,
              cursor: 'pointer',
            }}
          >
            {strings.drawerOpenLens}
          </button>
        </div>
        <Meta>{strings.drawerNote}</Meta>
      </div>
    </div>
  );
}

function EvidenceRow({
  artifact,
  strings,
}: {
  artifact: EnergySubject['evidence'][number];
  strings: EnergyStrings;
}): JSX.Element {
  /*
    R2 — THE READER STATE IS DERIVED FROM BOTH AXES, NEVER FROM RIGHTS ALONE.
    `readerAvailability` takes the whole record; there is no single-axis form of
    it to call by mistake. Exposure dominates, so a refused series lands on
    COVERAGE GAP and is indistinguishable from a benign one.
  */
  const availability = artifact.disclosure === null ? 'AVAILABLE' : readerAvailability(artifact.disclosure);
  return (
    <div
      data-energy-evidence-role={artifact.role}
      style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '8px', borderBottom: `1px solid ${ENERGY_LINE.hairlineFaint}` }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ ...mono(undefined, ENERGY_INK.meta), border: `1px solid ${ENERGY_LINE.chip}`, padding: '2px 5px', borderRadius: ENERGY_RADIUS.chip }}>
          {artifact.sourceClass === null ? ENERGY_ABSENT : strings.sourceClass[artifact.sourceClass]}
        </span>
        <div style={{ flex: 1 }} />
        <Meta>{artifact.language}</Meta>
      </div>
      <span style={{ fontSize: '12px', color: ENERGY_INK.body, lineHeight: 1.4 }}>{artifact.title}</span>
      {/*
        A DISPUTED ARTIFACT IS SHOWN, LABELLED. There is no branch in this
        component that removes one — R08: "Disputed and contradicted artifacts
        are retained and labelled, NEVER HIDDEN."
      */}
      <Meta
        tone={
          availability === 'UNAVAILABLE_LICENSED'
            ? ENERGY_SEMANTIC.violet
            : availability === 'COVERAGE_GAP'
              ? ENERGY_SEMANTIC.achromatic
              : artifact.role === 'DISPUTED'
                ? ENERGY_SEMANTIC.amber
                : ENERGY_INK.meta
        }
      >
        {availability === 'AVAILABLE'
          ? strings.evidenceRole[artifact.role]
          : availability === 'UNAVAILABLE_LICENSED'
            ? strings.state.UNAVAILABLE_LICENSED
            : strings.state.COVERAGE_GAP}
      </Meta>
    </div>
  );
}

/* ══ THE LENS ══════════════════════════════════════════════════════════════ */

interface LensProps {
  readonly subject: EnergySubject;
  readonly strings: EnergyStrings;
  readonly returnLabel: string;
  readonly onClose: () => void;
  readonly onToggleWatch: () => void;
  readonly onOpenAsk: () => void;
  readonly children?: React.ReactNode;
}

export function EnergySituationLens({
  subject,
  strings,
  returnLabel,
  onClose,
  onToggleWatch,
  onOpenAsk,
  children,
}: LensProps): JSX.Element {
  return (
    <div
      data-energy-surface="lens"
      data-energy-subject={subject.id}
      role="dialog"
      aria-modal="true"
      aria-label={subject.name}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,9,15,.72)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'stretch',
        padding: '28px 32px',
        zIndex: 40,
      }}
    >
      <div
        style={{
          flex: 1,
          maxWidth: '1720px',
          background: ENERGY_SURFACE.raised,
          border: `1px solid ${ENERGY_LINE.cyan}`,
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '50px',
            flex: 'none',
            borderBottom: `1px solid ${ENERGY_LINE.hairline}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 18px',
            gap: '14px',
            background: ENERGY_SURFACE.chrome,
          }}
        >
          {/* EXPLICIT CONTEXTUAL RETURN. The lens is not a route; this is how it closes. */}
          <button type="button" onClick={onClose} style={{ ...mono(11, ENERGY_SEMANTIC.cyan), background: 'none', border: 'none', cursor: 'pointer', minHeight: '44px' }}>
            ← {returnLabel}
          </button>
          <span style={{ color: ENERGY_INK.rule }}>/</span>
          <Meta>{strings.lensTitle}</Meta>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...mono(11, ENERGY_INK.meta), background: 'none', border: 'none', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div
            style={{
              width: '440px',
              flex: 'none',
              borderRight: `1px solid ${ENERGY_LINE.hairline}`,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'auto',
            }}
          >
            <div style={{ padding: '22px 24px 18px', display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: `1px solid ${ENERGY_LINE.hairlineSoft}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {subject.readerState === null ? (
                  subject.changeState === null ? null : <ChangeStateTokens state={subject.changeState} labels={strings.changeState} tone={subject.tone} />
                ) : (
                  <StateChip state={subject.readerState} strings={strings} canonical={subject.canonicalAbsence} />
                )}
                <Meta>{strings.subjectType[subject.type]}</Meta>
              </div>
              <span style={{ fontSize: `${ENERGY_TYPE.lensHeadlinePx}px`, fontWeight: 600, lineHeight: 1.25, letterSpacing: '-.015em', color: ENERGY_INK.primary }}>
                {subject.headline ?? subject.name}
              </span>
              <span style={{ fontSize: '14px', color: ENERGY_INK.secondary, lineHeight: 1.6 }}>
                {subject.assessment ?? strings.stateWhy[subject.readerState ?? 'NO_DATA']}
              </span>
              <div style={{ display: 'flex', gap: '22px', paddingTop: '4px' }}>
                <Stat label={strings.lensConfidence} value={subject.confidence ?? ENERGY_ABSENT} />
                <Stat label={strings.lensRevisions} value={subject.revisions ?? ENERGY_ABSENT} />
                <Stat label={strings.lensLastChecked} value={subject.lastChecked ?? ENERGY_ABSENT} />
              </div>
            </div>

            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '9px', borderBottom: `1px solid ${ENERGY_LINE.hairlineSoft}` }}>
              <SectionLabel>{strings.lensUncertain}</SectionLabel>
              <span style={{ fontSize: '13px', color: ENERGY_INK.secondary, lineHeight: 1.6 }}>{subject.uncertainty ?? ENERGY_ABSENT}</span>
            </div>

            {/*
              ── R2 · THE MONITOR-NEXT SURFACE IS NOT HERE, AND NOT BEHIND A FLAG ──

              R1 rendered the heading with a withheld statement beneath it. Main's
              R2 delta withdraws that: *"Do not build it. Do not build it behind a
              flag either — a flag is a decision to build it and defer the switch.
              WITHHOLD IT; DO NOT SHOW A PLACEHOLDER. A 'coming soon' slot for the
              monitor-next surface tells a reader the ranking exists, which is most
              of what the hold protects."*

              So there is no heading, no slot and no string. The lens goes from
              uncertainty straight to its footer, and a reader learns nothing about
              a ranking — including that one was ever contemplated.

              The condition that would lift it is testable before any data exists
              (E04-2): strip every piece of our own coverage metadata from the
              ranking inputs; if the ordering changes, the surface is refused.
            */}

            <div style={{ flex: 1 }} />

            <div style={{ padding: '16px 24px', borderTop: `1px solid ${ENERGY_LINE.hairline}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '9px' }}>
                <WatchControl watched={subject.watched} strings={strings} onToggle={onToggleWatch} />
                <button
                  type="button"
                  onClick={onOpenAsk}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    ...mono(10.5, ENERGY_SEMANTIC.cyan),
                    background: 'none',
                    border: `1px solid ${ENERGY_LINE.cyan}`,
                    borderRadius: ENERGY_RADIUS.panel,
                    cursor: 'pointer',
                  }}
                >
                  {strings.askTitle.split(' · ')[0]} · {strings.askZeroCost}
                </button>
              </div>
              <SandAffordance strings={strings} onOpen={onOpenAsk} />
              <Meta>{strings.pricedBeforeExecution}</Meta>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <Meta>{label}</Meta>
      <span style={{ fontSize: '13px', color: ENERGY_INK.body }}>{value}</span>
    </div>
  );
}

/** The lens right column: geography facet, affected systems, timeline, evidence, cross-domain. */
export function EnergyLensDetail({
  subject,
  strings,
  facet,
}: {
  subject: EnergySubject;
  strings: EnergyStrings;
  facet: React.ReactNode;
}): JSX.Element {
  return (
    <>
      <div style={{ flex: 'none', height: '270px', position: 'relative', borderBottom: `1px solid ${ENERGY_LINE.hairlineSoft}`, overflow: 'hidden' }}>
        {facet}
        <span style={{ position: 'absolute', top: '12px', left: '16px', ...mono(undefined, ENERGY_INK.quiet), letterSpacing: '.18em', textShadow: '0 1px 6px #000' }}>
          {strings.lensGeographyFacet}
        </span>
        <div style={{ position: 'absolute', bottom: '10px', left: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          {subject.geometry === null ? (
            <Meta tone={ENERGY_SEMANTIC.violet}>
              {formatEnergyString(strings.gateBlockedTemplate, { gate: subject.geometryWithheldBy ?? 'E01' })} {ENERGY_GATES[subject.geometryWithheldBy ?? 'E01'].stops}
            </Meta>
          ) : (
            <MachineReadable>
              <PrecisionBadge precision={subject.geometry.precision} strings={strings} withRule />
            </MachineReadable>
          )}
          <div style={{ flex: 1 }} />
          <Meta tone={ENERGY_SEMANTIC.violet}>{strings.vesselUnavailable}</Meta>
        </div>
      </div>

      <div style={{ padding: '16px 22px 12px', display: 'flex', flexDirection: 'column', gap: '11px', borderBottom: `1px solid ${ENERGY_LINE.hairlineSoft}`, flex: 'none' }}>
        <SectionLabel>{strings.lensAffected}</SectionLabel>
        <div style={{ display: 'flex', gap: '10px' }}>
          {subject.affectedSystems.map((system) => (
            <div
              key={system.label}
              style={{
                flex: 1,
                minWidth: 0,
                border: `1px solid ${ENERGY_LINE.hairline}`,
                borderTop: `2px solid ${ENERGY_TONE_HEX[system.tone]}`,
                borderRadius: ENERGY_RADIUS.panel,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '12.5px', color: ENERGY_INK.primary, lineHeight: 1.35 }}>{system.label}</span>
              <Meta>{system.meta}</Meta>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: '9px', overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SectionLabel>{strings.lensTimeline}</SectionLabel>
            <div style={{ flex: 1 }} />
            <Meta>{strings.lensTimelineAppendOnly}</Meta>
          </div>
          {subject.timeline.length === 0 ? (
            <span style={{ fontSize: '12.5px', color: ENERGY_INK.quiet }}>{strings.revisionSpineSingle}</span>
          ) : (
            subject.timeline.map((entry) => (
              <div key={`${entry.at}-${entry.text}`} style={{ display: 'flex', gap: '14px', padding: '9px 0', borderBottom: `1px solid ${ENERGY_LINE.hairlineFaint}` }}>
                <span style={{ width: '96px', flex: 'none', ...mono(undefined, ENERGY_INK.meta), paddingTop: '2px' }}>{entry.at}</span>
                <span style={{ width: '4px', flex: 'none', background: ENERGY_TONE_HEX[entry.tone], borderRadius: '1px' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {entry.changeState === null ? null : (
                    <ChangeStateTokens state={entry.changeState} labels={strings.changeState} tone={entry.tone} />
                  )}
                  <span style={{ fontSize: '12.5px', color: ENERGY_INK.body, lineHeight: 1.45 }}>{entry.text}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ width: '320px', flex: 'none', borderLeft: `1px solid ${ENERGY_LINE.hairlineSoft}`, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${ENERGY_LINE.hairlineSoft}`, display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <SectionLabel tone={ENERGY_SEMANTIC.cyan}>
              {strings.hudEvidence.toUpperCase()} · {subject.evidence.length === 0 ? ENERGY_ABSENT : subject.evidence.length}
            </SectionLabel>
            <span style={{ fontSize: '12px', color: ENERGY_INK.meta, lineHeight: 1.45 }}>{strings.disputedRetained}</span>
          </div>
          {subject.evidence.map((artifact) => (
            <div key={artifact.id} style={{ padding: '11px 16px', borderBottom: `1px solid ${ENERGY_LINE.hairlineFaint}` }}>
              <EvidenceRow artifact={artifact} strings={strings} />
            </div>
          ))}

          <div style={{ padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <SectionLabel>{strings.lensCrossDomain}</SectionLabel>
            {/*
              R2 · THE PRICE-OWNERSHIP RULING, WHERE A READER MEETS IT.

              The one place Energy touches price is this list, and it touches it
              as a REFERENCE. Saying so here is cheaper than a reader inferring
              from a Market row that Energy holds a price series — which is the
              inference the dictionary line used to invite.
            */}
            <span style={{ fontSize: '11.5px', color: ENERGY_INK.meta, lineHeight: 1.45 }}>
              {strings.crossDomainMarketOwnership}
            </span>
            {subject.crossDomain.map((reference) => (
              <div key={reference.domain} style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingBottom: '7px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Meta tone={ENERGY_INK.dim}>{reference.domain}</Meta>
                  <div style={{ flex: 1 }} />
                  <Meta>{strings.askZeroCost}</Meta>
                </div>
                <span style={{ fontSize: '11.5px', color: ENERGY_INK.secondary, lineHeight: 1.4 }}>
                  {/* An absent reference SAYS SO. It never renders blank. */}
                  {reference.state === 'NO_ASSESSED_CONSEQUENCE' ? strings.crossDomainNoConsequence : reference.summary}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
