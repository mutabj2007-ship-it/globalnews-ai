import type { JSX } from 'react';

import { figureObservation } from '@/lib/economy/economyAdapters';
import type { Series } from '@/lib/economy/types';
import { ECON_INK, ECON_LINE, ECON_MONO, ECON_SURFACE } from './econTokens';

export function ObservedIdentityContext({
  series,
  onOpenSources,
}: {
  readonly series: Series;
  readonly onOpenSources: () => void;
}): JSX.Element {
  const observation = figureObservation(series.latest);
  const geography = series.model.geographyId ?? series.model.economyIso2;
  const source =
    observation?.provenance.institution ??
    observation?.provenance.providerId ??
    'Official source';

  const micro = {
    fontFamily: ECON_MONO,
    fontSize: 'max(var(--ar-fs-min, 0px), 9px)',
    letterSpacing: 'calc(0.06em * var(--ar-ls-mul, 1))',
    color: ECON_INK.tertiary,
  };

  return (
    <div
      data-econ="observed-identity-context"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 28px', alignItems: 'flex-end', minWidth: 0 }}
    >
      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <span style={{ ...micro, textTransform: 'none' }}>geo</span>
        <div
          data-econ="observed-geography"
          data-geo={geography}
          data-bound="true"
          style={{
            marginTop: 7,
            border: `1px solid ${ECON_LINE.hairline}`,
            background: ECON_SURFACE.raised,
            padding: '9px 11px',
            display: 'flex',
            gap: 10,
            alignItems: 'baseline',
          }}
        >
          <span style={{ ...micro, color: ECON_INK.primary }}>{geography}</span>
          <span style={{ fontSize: 13, color: ECON_INK.secondary }}>
            {series.model.label}
          </span>
        </div>
      </div>

      <div data-econ="observed-period" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{ ...micro, textTransform: 'none' }}>period</span>
        <span style={{ fontFamily: ECON_MONO, fontSize: 13, color: ECON_INK.primary }}>
          {observation?.periodId ?? '—'}
        </span>
        <span style={micro}>
          {series.model.cadence ?? 'CADENCE UNKNOWN'}
        </span>
      </div>

      <button
        type="button"
        data-econ="observed-provenance-line"
        onClick={onOpenSources}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 12px',
          alignItems: 'baseline',
          minWidth: 0,
          textAlign: 'start',
          cursor: 'pointer',
          border: `1px solid ${ECON_LINE.border}`,
          background: 'transparent',
          padding: '8px 11px',
        }}
      >
        <span style={micro}>source</span>
        <span style={{ fontFamily: ECON_MONO, fontSize: 11, color: ECON_INK.primary }}>
          {source}
        </span>
        <span aria-hidden="true" style={{ ...micro, color: ECON_INK.label }}>→</span>
      </button>
    </div>
  );
}
