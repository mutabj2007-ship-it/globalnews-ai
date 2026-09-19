'use client';

/**
 * PART X · HUMANITARIAN — THE SHARED PRIMITIVES.
 *
 * Everything here exists so an absence has somewhere to render. There is no
 * component in this file that accepts a number and no component that accepts an
 * optional value with a silent default: every axis prop is REQUIRED, so a
 * composition that forgets one fails at compile time instead of rendering a
 * confident blank. That failure class has already bitten this codebase twice —
 * SupportScreen without `language`, MobileSpatialShell without `labelNames` — and
 * both were invisible until a browser audit.
 */
import type { JSX, ReactNode } from 'react';
import { HUM_HEADING, HUM_INK, HUM_LICENSED, HUM_LINE, HUM_MONO, HUM_SURFACE, HUM_TYPE, humTracking } from '@/lib/humanitarian/humTokens';
import { perRecordAbsenceToken, renderableArea, type AbsenceReason, type AreaIdentifier, type PrecisionState } from '@/lib/humanitarian/humDegraded';
import { humAbsenceChrome, type HumStrings } from '@/lib/humanitarian/humStrings';

export const microLabel = {
  fontFamily: HUM_MONO,
  fontSize: HUM_TYPE.monoMeta,
  letterSpacing: humTracking(0.09),
  textTransform: 'uppercase' as const,
  color: HUM_INK.label,
};

/** A panel edge. Uses the accepted ≥3:1 delineation step, never a fill difference. */
export const panelEdge = `1px solid ${HUM_LINE.structure}`;

export function Zone({ children, style, gn }: {
  children: ReactNode;
  style?: React.CSSProperties;
  gn: string;
}): JSX.Element {
  return (
    <section data-hum={gn} style={{ background: HUM_SURFACE.panel, minWidth: 0, ...style }}>
      {children}
    </section>
  );
}

/**
 * A fact chip. ACHROMATIC BY CONSTRUCTION — need, direction, confidence and precision
 * are read as words, and R20 requires every state to survive greyscale.
 */
/**
 * A fact chip. ACHROMATIC BY DEFAULT — need, direction, confidence and precision are read
 * as words, and R20 requires every state to survive greyscale.
 *
 * `accent` names a LICENSED semantic, never a mood. Only a caller that can point at the
 * rule gets to pass one, and the chip refuses to invent a sixth: the union is the
 * legality list. Everything without a rule renders neutral, which is most of the screen —
 * that is the point, because a hue that marks everything marks nothing.
 */
export type ChipAccent = 'mint' | 'amber' | 'sand' | 'violet' | 'cyan';

/*
 * An accent is a WASH plus a line plus ink, derived from the one semantic hue rather
 * than stored as three separate colours. The product's rule — "a hue may only carry its
 * assigned meaning" — is easier to keep when there is one value per meaning.
 */
const ACCENTS: Readonly<Record<ChipAccent, { fill: string; line: string; ink: string }>> = {
  mint: { fill: 'rgba(94, 216, 169, 0.10)', line: 'rgba(94, 216, 169, 0.42)', ink: HUM_LICENSED.mint },
  amber: { fill: 'rgba(242, 169, 60, 0.11)', line: 'rgba(242, 169, 60, 0.45)', ink: HUM_LICENSED.amber },
  sand: { fill: 'rgba(217, 196, 143, 0.09)', line: 'rgba(217, 196, 143, 0.38)', ink: HUM_LICENSED.sand },
  violet: { fill: 'rgba(171, 147, 237, 0.10)', line: 'rgba(171, 147, 237, 0.40)', ink: HUM_LICENSED.violet },
  cyan: { fill: 'rgba(58, 214, 230, 0.10)', line: 'rgba(58, 214, 230, 0.42)', ink: HUM_LICENSED.cyan },
};

export function Chip({ label, value, title, accent }: {
  label: string; value: string; title?: string; accent?: ChipAccent;
}): JSX.Element {
  const a = accent === undefined ? null : ACCENTS[accent];
  return (
    <span
      data-hum="chip"
      data-hum-accent={accent ?? 'none'}
      title={title}
      style={{
        display: 'inline-flex', gap: '6px', alignItems: 'baseline',
        /* A chip carries the frozen 0.21 step, so it reads as raised against the panel
           it sits on rather than as a border floating on the identical fill. */
        background: a?.fill ?? HUM_SURFACE.chip,
        border: `1px solid ${a?.line ?? HUM_LINE.border}`, padding: '3px 7px',
        fontFamily: HUM_MONO, fontSize: HUM_TYPE.monoMeta, letterSpacing: humTracking(0.08),
        textTransform: 'uppercase', color: HUM_INK.secondary, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: a === null ? HUM_INK.label : a.ink, opacity: a === null ? 1 : 0.75 }}>{label}</span>
      <span style={{ color: a?.ink ?? HUM_INK.primary, fontWeight: a === null ? 400 : 600 }}>{value}</span>
    </span>
  );
}

/**
 * THE ABSENCE ROW — the most important component in this domain.
 *
 * It renders WHY something is not shown, in its own treatment. It has no numeric
 * prop, so it cannot be handed a zero; and it is never conditional on the value
 * being falsy, so it cannot be skipped by an `&&` that a future edit turns truthy.
 */
export function Absence({ reason, t, note }: {
  reason: AbsenceReason;
  t: HumStrings;
  note?: string;
}): JSX.Element {
  /*
    THE TOKEN COMES FROM A CLOSED LOOKUP, NOT FROM THE PROP.

    Two call sites pass a DYNAMIC reason on the main frame, on both viewports. A cast, a
    widened string from a future producer, or a JSON payload could hand this component a
    value the type forbids — and the previous version printed whatever it was given
    straight into `data-hum-absence-reason`, which is a machine-readable token a page-wide
    selector can difference across records.

    `perRecordAbsenceToken` is TOTAL: its return type is `AbsenceReason`, never
    `AbsenceReason | undefined`, and every input resolves to a member of the closed set.
    Anything outside that set — a cast, a widened producer string, a protection-bearing
    value — resolves to `ORDINARY_AGGREGATION_REASON`. So the attribute is always emitted
    with a value drawn from the closed set, and the channel can carry a protection-bearing
    value neither as a token nor, because the string catalogue has no key for one, as
    visible text.

    It is deliberately NOT `undefined`. Checkpoint 3 returned `undefined` and React then
    omitted the attribute, which changed the body and made the absence of a marker into a
    marker of its own. Emitting the ordinary-aggregation token is what makes a protected
    record byte-identical to an ordinarily aggregated one.
  */
  /*
    Any value outside the closed set — including a protection-bearing one — resolves to the
    ORDINARY AGGREGATION reason, so a protected record emits the same bytes as a record
    aggregated for a non-protection cause. Checkpoint 3 resolved it to `undefined`, which
    dropped the attribute and changed the body: the absence of a marker was itself a
    marker. F requires byte-identity; E1 calls the same thing the omission channel.
  */
  const token = perRecordAbsenceToken(reason);
  return (
    <div
      data-hum="absence"
      data-hum-absence-reason={token}
      style={{
        display: 'flex', flexDirection: 'column', gap: '4px',
        borderInlineStart: `2px solid ${HUM_LINE.emphasis}`, paddingInlineStart: '10px',
        padding: '8px 0 8px 10px',
      }}
    >
      {/*
        DERIVED, NOT CONSTANT. This printed "Not assessed" above every reason, including
        both rights reasons — where an assessment may exist, may be sound, and may simply
        not be shown. The chrome now states whose limitation it is.
      */}
      <span data-hum="absence-chrome" style={{ ...microLabel, color: HUM_INK.tertiary }}>
        {humAbsenceChrome(t, token)}
      </span>
      <span style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary, lineHeight: 'var(--ar-lh, 1.45)' }}>
        {t.absence[token]}
      </span>
      {note !== undefined && (
        <span style={{ ...microLabel, letterSpacing: humTracking(0.07) }}>{note}</span>
      )}
    </div>
  );
}

/**
 * A GEOGRAPHY NAME, PASSED THROUGH THE FRAME'S DECLARED PRECISION.
 *
 * `row.area` was a bare string rendered verbatim, and the access renderer never consulted
 * `view.precision`. A name is a placement: printing a district under a province-level
 * declaration claims a resolution the pipeline cannot produce, and a synthetic area string
 * carrying a coordinate pair reached the DOM unaltered.
 *
 * Every geography name on this surface now goes through here. Finer than declared, or a
 * rung with no producer, and the NAME IS NOT RENDERED — the ceiling is stated instead.
 * It refuses in one direction only: precision is never increased, never inferred, and
 * never guessed to a nearest level.
 */
export function AreaLabel({ area, precision, t }: {
  area: AreaIdentifier;
  precision: PrecisionState;
  t: HumStrings;
}): JSX.Element {
  const r = renderableArea(area, precision);
  if (r.kind === 'NAMED') {
    return (
      <span data-hum="area" data-hum-area-precision={r.precision}
        style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary }}>
        {r.name}
      </span>
    );
  }
  return (
    <span data-hum="area" data-hum-area-clamped="true" data-hum-area-precision={r.declared}
      style={{ ...microLabel, color: HUM_INK.tertiary, letterSpacing: humTracking(0.06) }}>
      {t.absence.NOT_PRODUCIBLE_AT_THIS_PRECISION}
    </span>
  );
}

/** A dependency this lane cannot satisfy, named on screen rather than left blank. */
export function Dependency({ text, t }: { text: string; t: HumStrings }): JSX.Element {
  return (
    <div
      data-hum="dependency"
      style={{
        border: `1px solid ${HUM_LINE.border}`, padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: '5px', background: HUM_SURFACE.raised,
      }}
    >
      <span style={microLabel}>{t.common.dependencyRecorded}</span>
      <span style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary, lineHeight: 'var(--ar-lh, 1.45)' }}>{text}</span>
    </div>
  );
}

/**
 * HEADING HIERARCHY, BY WEIGHT AND BRIGHTNESS — NOT BY GIVING EACH ONE A COLOUR.
 *
 * The finding was that too much of the screen carried equal white weight. The fix is a
 * ladder with three rungs and ONE optional licensed accent, not seven different hues:
 *
 *   'primary'    a substrate region a reader navigates by    brightest, widest tracking
 *   'secondary'  a rail region                               dimmer, tighter
 *   'note'       a qualification on either                   dimmest
 *
 * `accent` is used only where the LICENSED semantic actually applies — mint on Watch,
 * amber on an attention condition — and is absent everywhere else. A heading tinted for
 * emphasis alone would be decoration, which R20's legality rule forbids.
 */
export type TitleLevel = 'primary' | 'secondary';

export function SectionTitle({ children, note, level = 'primary', accent }: {
  children: ReactNode;
  note?: string;
  level?: TitleLevel;
  accent?: string;
}): JSX.Element {
  const primary = level === 'primary';
  const ink = accent ?? (primary ? HUM_HEADING.primaryInk : HUM_HEADING.secondaryInk);
  return (
    <div data-hum="section-title" data-hum-level={level} style={{
      display: 'flex', gap: '9px', alignItems: 'baseline', flexWrap: 'wrap',
      paddingBlockEnd: '2px',
    }}>
      {/*
        THE MARKER IS THE PRODUCT'S OWN. The homepage marks a region with a small cyan
        dot beside a cyan mono eyebrow; that released treatment is what gives a heading
        presence without making it shout, and it is why these were failing as bold white
        text. A secondary heading keeps the marker and drops its brightness, so the
        hierarchy is one idea at two strengths rather than two different ideas.
      */}
      <span aria-hidden="true" style={{
        width: `${HUM_HEADING.markerPx}px`, height: `${HUM_HEADING.markerPx}px`,
        borderRadius: '50%', background: ink, flex: '0 0 auto',
        alignSelf: 'center', opacity: primary ? 1 : 0.55,
        boxShadow: primary ? `0 0 8px ${ink}66` : 'none',
      }} />
      <span style={{
        ...microLabel, color: ink,
        fontWeight: primary ? 600 : 500,
        letterSpacing: humTracking(primary ? 0.12 : 0.09),
      }}>
        {children}
      </span>
      {note !== undefined && (
        <span style={{ ...microLabel, color: HUM_HEADING.noteInk, letterSpacing: humTracking(0.06) }}>{note}</span>
      )}
    </div>
  );
}
