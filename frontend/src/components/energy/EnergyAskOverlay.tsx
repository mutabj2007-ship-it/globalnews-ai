'use client';

import { ENERGY_INK, ENERGY_LINE, ENERGY_RADIUS, ENERGY_SEMANTIC, ENERGY_SURFACE, ENERGY_TYPE } from '@/lib/energy/energyTokens';
import { AbsenceBlock, Meta, SandAffordance, SectionLabel, mono } from '@/components/energy/EnergyParts';
import type { EnergyStrings } from '@/lib/energy/energyStrings';
import type { EnergyFrameData, EnergySubject } from '@/lib/energy/energyModel';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK — 0 SAND, AND NOT A COMPUTE ENGINE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Main ruled the structural half of M07, and it is the half that governs this
 * component entirely:
 *
 *   "Ask executes nothing; it answers from STORED assessments, STORED evidence
 *    and STORED cross-domain references; any new synthesis is an EXPLICIT
 *    HANDOFF to the shared Workspace / Deep Analysis path, PRICED BEFORE
 *    EXECUTION. That satisfies 'opening Energy causes 0 AI/provider
 *    execution'."
 *
 * So this file contains NO fetch, NO model call, NO submit handler and NO input
 * that could carry one. Opening the overlay is a render. The metered path is a
 * single affordance that states the action and, per ZONE-TO-DATA, carries no
 * number Main has not set.
 *
 * ── WHEN NOTHING IS STORED ───────────────────────────────────────────────
 *
 * The governed frame stores nothing, so Ask says exactly that and offers
 * nothing. It does NOT offer to find out — an offer to synthesise from an empty
 * store is how a 0-Sand surface becomes a paid one by accident.
 */

interface EnergyAskOverlayProps {
  readonly data: EnergyFrameData;
  readonly subject: EnergySubject | null;
  readonly strings: EnergyStrings;
  readonly returnLabel: string;
  readonly compact: boolean;
  readonly onClose: () => void;
}

export function EnergyAskOverlay({ data, subject, strings, returnLabel, compact, onClose }: EnergyAskOverlayProps): JSX.Element {
  const zone = data.zones.ask;
  const nothingStored = data.subjects.length === 0;

  const examples = subject === null
    ? [strings.askContextFields[0], strings.askContextFields[3]]
    : [`${subject.name} — ${strings.lensUncertain.toLowerCase()}`, strings.lensCrossDomain.toLowerCase()];

  return (
    <div
      data-energy-surface="ask"
      role="dialog"
      aria-modal="true"
      aria-label={strings.askTitle}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,9,15,.74)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: compact ? '100%' : '460px',
          maxWidth: '100%',
          background: ENERGY_SURFACE.chrome,
          borderLeft: `1px solid ${ENERGY_LINE.cyan}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${ENERGY_LINE.hairline}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button" onClick={onClose} style={{ ...mono(11, ENERGY_SEMANTIC.cyan), background: 'none', border: 'none', cursor: 'pointer', minHeight: '44px' }}>
            ← {returnLabel}
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...mono(11, ENERGY_INK.meta), background: 'none', border: 'none', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: `1px solid ${ENERGY_LINE.hairlineSoft}` }}>
          <SectionLabel tone={ENERGY_SEMANTIC.cyan}>{strings.askTitle}</SectionLabel>
          <span style={{ fontSize: '12.5px', color: ENERGY_INK.quiet, lineHeight: 1.55 }}>{strings.askContextTitle}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {strings.askContextFields.map((field) => (
              <span
                key={field}
                style={{
                  ...mono(undefined, ENERGY_INK.body),
                  letterSpacing: '.06em',
                  border: `1px solid ${ENERGY_LINE.panel}`,
                  padding: '4px 7px',
                  borderRadius: ENERGY_RADIUS.chip,
                }}
              >
                {field}
              </span>
            ))}
          </div>
        </div>

        {nothingStored ? (
          zone === undefined ? null : <AbsenceBlock zone={zone} strings={strings} label={strings.askTitle} />
        ) : (
          examples.map((question) => (
            <div key={question} style={{ padding: '14px 18px', borderBottom: `1px solid ${ENERGY_LINE.hairlineSoft}`, display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={{ fontSize: '13px', color: ENERGY_INK.primary, lineHeight: 1.5 }}>{question}</span>
              <Meta>{strings.askZeroCost}</Meta>
            </div>
          ))
        )}

        {nothingStored ? null : (
          <span style={{ padding: '14px 18px 0', fontSize: '12.5px', color: ENERGY_INK.quiet, lineHeight: 1.55 }}>{strings.askNothingStored}</span>
        )}

        <div
          style={{
            margin: '16px 18px',
            border: `1px solid ${ENERGY_LINE.sand}`,
            borderRadius: ENERGY_RADIUS.card,
            background: 'rgba(216,192,138,.06)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <SectionLabel tone={ENERGY_SEMANTIC.sand}>{strings.deepAnalysisTitle}</SectionLabel>
          <SandAffordance strings={strings} />
          <Meta>{strings.pricedBeforeExecution}</Meta>
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ padding: '14px 18px', borderTop: `1px solid ${ENERGY_LINE.hairline}` }}>
          <span style={{ fontSize: '11.5px', color: ENERGY_INK.meta, lineHeight: 1.55 }}>{strings.askReturnNote}</span>
        </div>
      </div>
    </div>
  );
}
