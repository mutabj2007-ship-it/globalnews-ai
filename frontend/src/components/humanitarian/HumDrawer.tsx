'use client';

/**
 * PART X · HUMANITARIAN — ONE DRAWER SHELL, SIX CONTENTS.
 *
 * R12, verbatim: "No popup-on-popup; drawers replace and never stack; one sustained
 * panel at a time" and "a drawer replaces zones C and D but never occludes the status
 * header or the assessment statement."
 *
 * REPLACEMENT IS STRUCTURAL, NOT POLICED. The shell takes ONE `kind` and the view
 * state holds ONE `drawer` value, so there is no array to push onto and no z-index
 * race to lose. Opening a second drawer replaces the first because that is the only
 * thing the type permits.
 */
import type { JSX } from 'react';
import { HUM_INK, HUM_LINE, HUM_MONO, HUM_SURFACE, HUM_TYPE, humTracking } from '@/lib/humanitarian/humTokens';
import { HUM_HIT_TARGET_PX } from '@/lib/humanitarian/humConfig';
import type { HumDrawerKind } from '@/lib/humanitarian/humState';
import type { HumStrings } from '@/lib/humanitarian/humStrings';
import type { HumSituationView } from './HumanitarianModel';
import { PopulationNeed } from './drawers/PopulationNeed';
import { DisplacementAccess } from './drawers/DisplacementAccess';
import { EvidenceReadings } from './drawers/EvidenceReadings';
import { WatchConfig } from './drawers/WatchConfig';
import { TimelineHistory } from './drawers/TimelineHistory';
import { AnalysisHandoff } from './drawers/AnalysisHandoff';

export function HumDrawer({ kind, view, t, onClose }: {
  kind: HumDrawerKind;
  view: HumSituationView;
  t: HumStrings;
  onClose: () => void;
}): JSX.Element {
  return (
    <section
      data-hum="drawer"
      data-hum-drawer-kind={kind}
      aria-label={t.drawers[kind]}
      style={{
        background: HUM_SURFACE.panel, display: 'flex', flexDirection: 'column',
        minHeight: 0, minWidth: 0, borderTop: `1px solid ${HUM_LINE.structure}`,
      }}
    >
      <header
        style={{
          padding: '14px 18px', borderBottom: `1px solid ${HUM_LINE.structure}`,
          background: HUM_SURFACE.raised, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '10px', flex: '0 0 auto',
        }}
      >
        <span style={{
          fontFamily: HUM_MONO, fontSize: HUM_TYPE.monoMeta, letterSpacing: humTracking(0.1),
          textTransform: 'uppercase', color: HUM_INK.primary,
        }}>
          {t.drawers[kind]}
        </span>
        <button
          type="button"
          data-hum="drawer-close"
          onClick={onClose}
          style={{
            minHeight: `${HUM_HIT_TARGET_PX}px`, minWidth: `${HUM_HIT_TARGET_PX}px`,
            padding: '0 12px', background: 'transparent', cursor: 'pointer',
            border: `1px solid ${HUM_LINE.border}`, color: HUM_INK.secondary,
            fontFamily: HUM_MONO, fontSize: HUM_TYPE.monoMeta, letterSpacing: humTracking(0.08),
            textTransform: 'uppercase',
          }}
        >
          {t.common.close}
        </button>
      </header>

      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '16px 18px' }}>
        {kind === 'POPULATION_NEED' && <PopulationNeed view={view} t={t} />}
        {kind === 'DISPLACEMENT_ACCESS' && <DisplacementAccess view={view} t={t} />}
        {kind === 'EVIDENCE' && <EvidenceReadings view={view} t={t} />}
        {kind === 'WATCH' && <WatchConfig view={view} t={t} />}
        {kind === 'TIMELINE' && <TimelineHistory view={view} t={t} />}
        {kind === 'ANALYSIS' && <AnalysisHandoff view={view} t={t} />}
      </div>
    </section>
  );
}
