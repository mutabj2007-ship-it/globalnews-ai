import type { EconomyLocale } from '@/lib/economy/strings';
import { economyStrings } from '@/lib/economy/strings';
import type { AttentionRow } from '@/lib/economy/types';
import { ECON_INK, ECON_LINE, ECON_MONO, ECON_SURFACE } from './econTokens';

/**
 * ECON-UI-1 — THE ATTENTION QUEUE. Answers Q1 (what changed) and Q2 (which indicators
 * deserve attention).
 *
 * A9, AND THE REASON THIS COMPONENT IS SHORT: **THE UI ORDERS; IT NEVER SCORES.**
 *
 * `attentionRank` arrives from the shared assessment service. This module does not
 * calculate it, normalize it, bucket it, threshold it, weight it, or re-rank it — and it
 * does not read Conflict severity either. The single permitted operation is a stable
 * descending sort, below, and a guard asserts that no arithmetic operator is ever applied
 * to the field anywhere in the Economy module.
 *
 * The rank is not printed. It is an ordering input, not a score to show a reader.
 */
export function orderByAttentionRank(rows: readonly AttentionRow[]): AttentionRow[] {
  // Stable sort on the supplied value. No transformation of any kind.
  return [...rows].sort((a, b) => (a.attentionRank < b.attentionRank ? 1 : a.attentionRank > b.attentionRank ? -1 : 0));
}

export function AttentionQueue({
  rows, locale, selectedId, onSelect, railPx,
}: {
  rows: readonly AttentionRow[];
  locale: EconomyLocale;
  selectedId?: string;
  onSelect?: (row: AttentionRow) => void;
  railPx: number;
}): JSX.Element {
  const t = economyStrings(locale);
  const ordered = orderByAttentionRank(rows);

  return (
    <aside
      data-econ="attention-rail"
      aria-label={t.attentionTitle}
      style={{
        // Fixed at every width from 1360 up. Never scales, never becomes a second substrate.
        width: `${railPx}px`, flex: `0 0 ${railPx}px`,
        background: ECON_SURFACE.ground, display: 'flex', flexDirection: 'column', minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '13px 16px', borderBottom: `1px solid ${ECON_LINE.hairline}`,
          background: ECON_SURFACE.panel, display: 'flex', alignItems: 'baseline',
          justifyContent: 'space-between', gap: '10px',
        }}
      >
        <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.1em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.primary }}>
          {t.attentionTitle}
        </span>
        <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
          {t.attentionRankNote}
        </span>
      </div>

      <ul
        data-econ="attention-list"
        style={{ flex: '1 1 auto', overflow: 'hidden', display: 'flex', flexDirection: 'column', listStyle: 'none', margin: 0, padding: 0 }}
      >
        {ordered.map((row, i) => {
          const active = row.id === selectedId;
          const promoted = row.changeState === 'SIGNIFICANT_CHANGE' || row.changeState === 'NEW';
          return (
            <li key={row.id} style={{ display: 'flex' }}>
              <button
                type="button"
                data-econ="attention-row"
                data-change-state={row.changeState}
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect?.(row)}
                style={{
                  flex: '1 1 auto', textAlign: 'start', cursor: 'pointer',
                  padding: '13px 16px',
                  borderBottom: i === ordered.length - 1 ? 'none' : `1px solid ${ECON_LINE.hairline}`,
                  borderLeft: active ? `2px solid ${ECON_LINE.accentLine}` : '2px solid transparent',
                  background: active ? ECON_SURFACE.selected : 'transparent',
                  display: 'flex', flexDirection: 'column', gap: '7px',
                }}
              >
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                  <span
                    data-econ="row-change-state"
                    style={{
                      fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.09em * var(--ar-ls-mul, 1))',
                      textTransform: 'uppercase', padding: '2px 6px',
                      ...(promoted
                        ? { color: ECON_INK.inverted, background: ECON_LINE.accentLine }
                        : { color: ECON_INK.secondary, border: `1px solid ${ECON_LINE.emphasis}` }),
                    }}
                  >
                    {t.changeState[row.changeState]}
                  </span>
                  <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', color: ECON_INK.label }}>{row.ageLabel}</span>
                </span>
                <span style={{ fontSize: 'max(var(--ar-fs-min, 0px), 14px)', lineHeight: 'var(--ar-lh, 1.45)', color: ECON_INK.primary }}>{row.headline}</span>
                {/*
                  The row may NAME a triggering lifecycle event. The event is never ranked
                  independently — it is named on the row of its persistent subject.
                */}
                <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', color: ECON_INK.label }}>
                  {row.provenance}
                  {row.triggeringEvent ? ` · ${row.triggeringEvent.label}` : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
