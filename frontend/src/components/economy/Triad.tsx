import type { EconomyLocale } from '@/lib/economy/strings';
import { economyStrings } from '@/lib/economy/strings';
import type { ActualExpectedPrevious } from '@/lib/economy/types';
import { EconomyFigure, FigureAxesLine } from './FigureTags';
import { economyFigure, figureSemantics, slotPeriodLabel } from '@/lib/economy/economyAdapters';
import { ECON_INK, ECON_LINE, ECON_MONO, ECON_SURFACE } from './econTokens';

/**
 * ECON-UI-1 — ACTUAL / EXPECTED / PREVIOUS, plus the derived surprise (Phase 1 §5).
 *
 * EXPECTED IS A DERIVED BENCHMARK, NOT AN OBSERVATION AND NOT A SOURCE (COL-5). It
 * therefore carries NO release-status tag — it has no publication cycle of its own — and
 * its meta line states the aggregation method, N and cutoff instead. That asymmetry is
 * the point of the component, so it is expressed in the markup rather than left to data.
 *
 * The surprise cell is DERIVED from the other two and is dropped when the HUD is open
 * (desktop state 02 renders three cells, 01 renders four).
 */
export function Triad({
  triad, locale, selected = false, showSurprise = true, cellBasisPx = 130,
}: {
  triad: ActualExpectedPrevious;
  locale: EconomyLocale;
  selected?: boolean;
  showSurprise?: boolean;
  cellBasisPx?: number;
}): JSX.Element {
  const t = economyStrings(locale);

  const cell: React.CSSProperties = {
    flex: `1 1 ${cellBasisPx}px`,
    background: selected ? ECON_SURFACE.selected : ECON_SURFACE.raised,
    padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: '5px',
  };
  const label: React.CSSProperties = {
    fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.1em * var(--ar-ls-mul, 1))',
    textTransform: 'uppercase', color: ECON_INK.label,
  };

  return (
    <div
      data-econ="triad"
      data-selected={selected ? 'true' : 'false'}
      style={{
        display: 'flex', flexWrap: 'wrap', gap: '1px', background: ECON_LINE.hairline,
        // Selection is a 1px light border plus a raised fill. No hue.
        border: `1px solid ${selected ? ECON_LINE.accentLine : ECON_LINE.hairline}`,
        position: selected ? 'relative' : undefined,
      }}
    >
      <div style={cell} data-econ="triad-actual">
        <span style={label}>{t.actual}</span>
        <EconomyFigure slot={triad.actual} sizePx={26} weight={500} />
        {/* A gap has no axes to line up beneath it — its reason is carried on the figure. */}
        {figureSemantics(triad.actual) && (
          <FigureAxesLine axes={figureSemantics(triad.actual)!} locale={locale} />
        )}
      </div>

      {triad.expected && (
        <div style={cell} data-econ="triad-expected">
          <span style={label}>{t.expected}</span>
          {/*
            Bracketed, because a consensus benchmark is not an observation. Rendered
            through the same figure primitive so the glyph rule cannot drift.
          */}
          {/*
            A consensus benchmark is DERIVED and carries no release status — the contract
            types that as `valueKind: Extract<EconomyValueKind, 'DERIVED'>`, so it cannot be
            mistaken for an observation. Rendered through the same primitive as a synthetic
            observation slot so the glyph rule cannot drift.
          */}
          <EconomyFigure
            slot={economyFigure({
              seriesId: triad.expected.seriesId,
              periodId: triad.expected.periodId,
              vintage: triad.expected.collectionCutoff,
              value: triad.expected.value,
              unit: triad.expected.unit,
              semantics: { releaseStatus: null, valueKind: 'DERIVED', freshness: 'FRESH' },
              provenance: { sourceType: 'PUBLIC_DATA' },
            })}
            sizePx={26}
          />
          <span
            data-econ="consensus-meta"
            style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))', color: ECON_INK.label, textTransform: 'uppercase' }}
          >
            {t.valueKind.DERIVED} · {triad.expected.aggregationMethod} N={triad.expected.contributorCount} · cutoff {triad.expected.collectionCutoff}
          </span>
        </div>
      )}

      {triad.previous && (
        <div style={cell} data-econ="triad-previous">
          <span style={label}>{t.previous}</span>
          <EconomyFigure slot={triad.previous} sizePx={26} />
          {figureSemantics(triad.previous) && (
            <FigureAxesLine
              axes={figureSemantics(triad.previous)!}
              locale={locale}
              extra={slotPeriodLabel(triad.previous)}
            />
          )}
        </div>
      )}

      {showSurprise && triad.surprise !== null && (
        <div style={cell} data-econ="triad-surprise">
          <span style={label}>{t.surprise}</span>
          <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 26px)', fontWeight: 500, color: ECON_INK.primary }}>
            {triad.surprise > 0 ? '+' : ''}{triad.surprise}
          </span>
          <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))', color: ECON_INK.label, textTransform: 'uppercase' }}>
            {triad.surpriseUnit} vs consensus
          </span>
        </div>
      )}
    </div>
  );
}
