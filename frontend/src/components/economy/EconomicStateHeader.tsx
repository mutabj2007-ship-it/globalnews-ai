import type { EconomyLocale } from '@/lib/economy/strings';
import { economyStrings } from '@/lib/economy/strings';
import type { EconomySubject } from '@/lib/economy/types';
import { assessmentChangeState, assessmentPriorChangeState } from '@/lib/economy/types';
import { ECON_INK, ECON_LINE, ECON_MONO, ECON_SURFACE } from './econTokens';
import { PROSE_MAX_CH } from '@/lib/economy/economyConfig';

/**
 * ECON-UI-1 — ECONOMIC STATE HEADER. 12 columns. Answers Q3: what is the current
 * economic assessment?
 *
 * The change-state chip is rendered ACHROMATIC pending the shared token registry, and the
 * prior state is named beside it (desktop delta 08) so the reader sees a TRANSITION
 * rather than a label. Confidence is a tag, not a colour.
 */
export function EconomicStateHeader({
  subject, locale, gutterPx, observationsAvailable = true,
}: {
  subject: EconomySubject;
  locale: EconomyLocale;
  gutterPx: number;
  /**
   * ECON-DATA-1. An assessment is DERIVED FROM OBSERVATIONS — `Assessment` even carries
   * `computedFromObservationIds`. With no observation source there is nothing for it to
   * be computed from, so the change state, the prior state and the confidence tag are
   * withheld rather than shown with nothing behind them. The header keeps the subject and
   * its scope, which are not observations.
   */
  observationsAvailable?: boolean;
}): JSX.Element {
  const t = economyStrings(locale);
  const a = subject.assessment;
  /*
    ECON-UI-ASSESSMENT-R1. Read through the accessors, never off a local field. `changeState` is
    null exactly when no producer formed an assessment, so the chip is now gated by the OBJECT's
    honesty as well as by `observationsAvailable`. Either alone would have hidden it; only the
    first makes the underlying data true.
  */
  const changeState = assessmentChangeState(a);
  const priorChangeState = assessmentPriorChangeState(a);

  const tagRest = {
    fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.09em * var(--ar-ls-mul, 1))',
    textTransform: 'uppercase' as const, color: ECON_INK.label,
    border: `1px solid ${ECON_LINE.border}`, padding: '3px 7px',
  };

  return (
    <header
      data-econ="state-header"
      style={{
        flex: '0 0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        justifyContent: 'space-between', gap: '14px',
        padding: `16px ${gutterPx}px`,
        borderBottom: `1px solid ${ECON_LINE.structure}`, background: ECON_SURFACE.panel,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'max(var(--ar-fs-min, 0px), 20px)', fontWeight: 600, letterSpacing: 'calc(-0.01em * var(--ar-ls-mul, 1))', color: ECON_INK.primary }}>
            {subject.name}
          </span>
          <span style={tagRest}>{subject.scopeLabel}</span>
          <span style={tagRest}>{subject.contextLabel}</span>
        </div>
        {/*
          The standing assessment sentence. Capped at the prose measure so it never runs
          the frame width, at 1920 or anywhere else.
        */}
        <p
          data-econ={observationsAvailable ? 'assessment-sentence' : 'assessment-withheld'}
          style={{
            margin: 0, fontSize: 'max(var(--ar-fs-min, 0px), 15px)', lineHeight: 'var(--ar-lh, 1.5)', color: ECON_INK.secondary,
            maxWidth: `${PROSE_MAX_CH}ch`,
          }}
        >
          {observationsAvailable ? a.statement : t.noObservationBody}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {!observationsAvailable && (
          <span data-econ="assessment-unavailable" style={{ ...tagRest, padding: '4px 8px' }}>
            {t.noObservationTitle}
          </span>
        )}
        {observationsAvailable && priorChangeState && (
          <span data-econ="prior-change-state" style={{ ...tagRest, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))' }}>
            {t.wasPriorState}: {t.changeState[priorChangeState]}
          </span>
        )}
        {observationsAvailable && changeState && (
        <span
          data-econ="change-state"
          data-change-state={changeState}
          style={{
            fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.09em * var(--ar-ls-mul, 1))',
            textTransform: 'uppercase', color: ECON_INK.inverted,
            background: ECON_LINE.accentLine, padding: '4px 8px',
          }}
        >
          {t.changeState[changeState]}
        </span>
        )}
        {observationsAvailable && (
        <span data-econ="confidence" style={{ ...tagRest, padding: '4px 8px' }}>
          {t.confidence[a.confidence]}
        </span>
        )}
      </div>
    </header>
  );
}
