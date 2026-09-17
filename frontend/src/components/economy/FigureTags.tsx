import type { CSSProperties, ReactNode } from 'react';
import type { EconomyLocale } from '@/lib/economy/strings';
import { economyStrings } from '@/lib/economy/strings';
import type { FigureAxes, FigureSlot, Observation } from '@/lib/economy/types';
import { economyFigure, figureIsGap, figureSemantics, gapReason } from '@/lib/economy/economyAdapters';
import { ECON_INK, ECON_MONO } from './econTokens';

/**
 * ECON-UI-1 — THE THREE AXES, COMPOSED ON THE FIGURE.
 *
 * Phase 1 §3: release status, value kind and freshness are three INDEPENDENT closed sets,
 * never merged into one state list. "None of the three uses hue: the encoding is a mono
 * marker glyph, a mono label and one of three ink levels."
 *
 * The glyph inventory is closed and lives here, in one place, so no surface can invent a
 * fourth marker:
 *
 *   dotted underline = not yet firm (PRELIM)
 *   bracket          = not an observation (FORECAST)
 *   tilde            = modelled (ESTIMATED)
 *   strike           = superseded (a prior vintage in the revision track)
 *   em-dash          = absent (a GAP slot, with its reason) — never a zero, never an empty cell
 */

/** The glyph the FIGURE ITSELF carries, decided by the axes rather than by the caller. */
function figureStyle(axes: FigureAxes): CSSProperties {
  const style: CSSProperties = {};
  if (axes.releaseStatus === 'PRELIMINARY') {
    // not yet firm
    style.borderBottom = `1px dotted ${ECON_INK.label}`;
    style.alignSelf = 'flex-start';
  }
  if (axes.valueKind === 'FORECAST' || axes.valueKind === 'DERIVED') {
    // authority without observation, or a model output: de-emphasised ink
    style.color = ECON_INK.tertiary;
  }
  if (axes.freshness === 'STALE' || axes.freshness === 'AGEING') {
    // reduced ink means AGE, not unimportance
    style.color = ECON_INK.reduced;
  }
  return style;
}

/**
 * Renders a SLOT. A forecast is bracketed, a derived value tilde-marked, and an ABSENT figure
 * is an em-dash — reached through the slot's GAP branch, not through a null value.
 *
 * There is deliberately no `value: number | null` parameter any more. That signature let a
 * caller hold a null and decide for itself what it meant; a slot forces the caller to have
 * already answered "does this figure exist?" before asking how to print it.
 */
export function figureText(slot: FigureSlot): string {
  if (figureIsGap(slot)) return '—';
  const o = slot.observation;
  const body = `${o.value}${o.unit}`;
  if (o.semantics.valueKind === 'FORECAST') return `[${body}]`;
  if (o.semantics.valueKind === 'DERIVED') return `~${body}`;
  return body;
}

export function EconomyFigure({
  slot, sizePx, weight = 400, children,
}: {
  /**
   * The SLOT, not a value and its axes. A caller can no longer hand this component a number
   * with no semantics, or semantics with no number — the contract's structure supplies both
   * together or states that neither exists.
   */
  slot: FigureSlot;
  sizePx: number;
  weight?: 400 | 500 | 600;
  children?: ReactNode;
}): JSX.Element {
  const axes = figureSemantics(slot);
  return (
    <span
      data-econ="figure"
      data-figure-kind={slot.kind}
      data-release-status={axes?.releaseStatus ?? 'NONE'}
      data-value-kind={axes?.valueKind ?? 'NONE'}
      data-freshness={axes?.freshness ?? 'NONE'}
      data-gap-reason={gapReason(slot) ?? undefined}
      style={{
        fontFamily: ECON_MONO, fontSize: `${sizePx}px`, fontWeight: weight,
        color: ECON_INK.primary, ...(axes ? figureStyle(axes) : { color: ECON_INK.reduced }),
      }}
    >
      {children ?? figureText(slot)}
    </span>
  );
}

/**
 * The dot-separated meta line beneath a figure.
 *
 * Order is fixed: release status, then value kind, then freshness. A FORECAST carries NO
 * release status — it has no publication cycle — so the first slot is simply absent
 * rather than filled with a placeholder, and the same is true of an absent value.
 *
 * Compact rule: "Release status is never dropped to save width. Where all three axes
 * cannot fit, value kind and freshness collapse into the sheet and the status tag stays
 * on the figure." `collapse` implements exactly that and nothing more.
 */
export function FigureAxesLine({
  axes, locale, extra, collapse = false, sizePx = 10,
}: {
  axes: FigureAxes;
  locale: EconomyLocale;
  /** Period, forecaster, cadence — appended after the axes, never in place of them. */
  extra?: string;
  collapse?: boolean;
  sizePx?: number;
}): JSX.Element {
  const t = economyStrings(locale);
  const parts: string[] = [];

  if (axes.releaseStatus) {
    parts.push(
      axes.releaseStatus === 'REVISED' && axes.revisionOrdinal !== undefined
        ? `${t.releaseStatus.REVISED} ${axes.revisionOrdinal}`
        : t.releaseStatus[axes.releaseStatus],
    );
  }
  if (!collapse) {
    if (axes.valueKind !== 'ACTUAL' || axes.releaseStatus !== null) {
      parts.push(t.valueKind[axes.valueKind]);
    }
    parts.push(t.freshness[axes.freshness]);
  }
  if (extra) parts.push(extra);

  return (
    <span
      data-econ="figure-axes"
      style={{
        fontFamily: ECON_MONO, fontSize: `${sizePx}px`, letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))',
        color: ECON_INK.label, textTransform: 'uppercase',
      }}
    >
      {parts.join(' · ')}
    </span>
  );
}

/** A prior vintage in the revision track: struck, retained, never deleted. */
export function SupersededFigure({ observation }: { observation: Observation }): JSX.Element {
  return (
    <span
      data-econ="figure-superseded"
      style={{
        fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 22px)', color: ECON_INK.tertiary,
        textDecoration: 'line-through', minWidth: '74px',
      }}
    >
      {figureText(economyFigure(observation))}
    </span>
  );
}
