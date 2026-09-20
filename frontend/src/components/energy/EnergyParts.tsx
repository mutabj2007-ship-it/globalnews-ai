'use client';

import type { CSSProperties, ReactNode } from 'react';
import {
  ENERGY_GATES,
  ENERGY_STATE_TREATMENT,
  type EnergyDataTier,
  type EnergyGateId,
  type EnergyPrecision,
  type EnergyReaderState,
} from '@/lib/energy/energyFrame';
import { ENERGY_INK, ENERGY_LINE, ENERGY_RADIUS, ENERGY_SEMANTIC, ENERGY_TYPE } from '@/lib/energy/energyTokens';
import {
  ENERGY_META_COUNT_STYLE,
  ENERGY_META_RECENCY_STYLE,
  ENERGY_META_ROW_STYLE,
  ENERGY_META_SEPARATOR,
  ENERGY_META_STATEMENT_STYLE,
  ENERGY_STATE_CAUSE_STYLE,
  formatMetaCount,
  formatMetaRecency,
  serviceAxisStyle,
  splitMetaRecency,
} from '@/lib/energy/energyOverflow';
import { MachineReadable } from '@/lib/typography/runBoundary';
import {
  causeMustBeShown,
  changeStateTokens,
  type ChangeState,
  type ChangeStateLabels,
} from '@/lib/observation/changeState';
import { formatEnergyString, type EnergyStrings } from '@/lib/energy/energyStrings';
import type { EnergyRowMeta, EnergyTone, EnergyZoneState } from '@/lib/energy/energyModel';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART XI PRIMITIVES — THE PIECES THAT CANNOT LIE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Each primitive below is shaped so the honesty rule holds STRUCTURALLY rather
 * than by review. The pattern is the same one the accepted Ask frame uses: if a
 * component has no prop for the wrong thing, no caller can pass it.
 *
 *   `StateChip`      takes a state and NO value. A chip cannot carry a figure.
 *   `AbsenceBlock`   takes a state and REQUIRES the sentence that says why.
 *   `SandAffordance` takes no number. There is no price prop to fill in.
 *   `PrecisionBadge` is REQUIRED beside every geometry; there is no geometry
 *                    component in this frame that renders without one.
 *
 * ── THE TREATMENTS ARE THE SEMANTICS ──────────────────────────────────────
 *
 * The four absence states are separated by BORDER TREATMENT AND LABEL, never by
 * a borrowed hue — solid achromatic, dashed achromatic, solid violet, label
 * only. That is what lets a colour-blind reader, a greyscale print and a
 * screen-reader user each get the same four distinctions.
 */

export const ENERGY_TONE_HEX: Readonly<Record<EnergyTone, string>> = {
  cyan: ENERGY_SEMANTIC.cyan,
  mint: ENERGY_SEMANTIC.mint,
  amber: ENERGY_SEMANTIC.amber,
  red: ENERGY_SEMANTIC.red,
  violet: ENERGY_SEMANTIC.violet,
  sand: ENERGY_SEMANTIC.sand,
  achromatic: ENERGY_SEMANTIC.achromatic,
};

export const ENERGY_TONE_LINE: Readonly<Record<EnergyTone, string>> = {
  cyan: ENERGY_LINE.cyan,
  mint: ENERGY_LINE.mint,
  amber: ENERGY_LINE.amber,
  red: ENERGY_LINE.red,
  violet: ENERGY_LINE.violet,
  sand: ENERGY_LINE.sand,
  achromatic: ENERGY_LINE.achromatic,
};

/**
 * §E — THE METADATA STYLE READS THE SCRIPT-SCOPED TOKENS.
 *
 * A caller that passes no size gets `var(--ene-meta-fs)`, which resolves to the
 * frozen Latin 10px everywhere except an Arabic-script subtree, where it
 * resolves to the accepted 11px floor with tracking neutralised. No component
 * branches on locale, so no surface can forget to.
 *
 * A caller that passes an explicit size is asking for a NON-metadata size (the
 * 10.5px and 11px chrome sizes the frozen file specifies), and those are left
 * exactly as frozen — the override governs the metadata floor, not every label.
 */
export const mono = (size?: number, color: string = ENERGY_INK.meta): CSSProperties => ({
  fontFamily: ENERGY_TYPE.mono,
  fontSize: size === undefined ? 'var(--ene-meta-fs)' : `${size}px`,
  letterSpacing: size === undefined ? 'var(--ene-meta-ls)' : '.12em',
  color,
});

/** A label the reader can read and a screen reader announces by name. */
export function Meta({ children, tone, size }: { children: ReactNode; tone?: string; size?: number }): JSX.Element {
  return <span style={mono(size, tone ?? ENERGY_INK.meta)}>{children}</span>;
}

/* ── THE ABSENCE CHIP ─────────────────────────────────────────────────────
   Takes a state. Takes no value, no count and no number: there is no prop for
   one, so a chip can never become a figure. */

interface StateChipProps {
  readonly state: EnergyReaderState;
  readonly strings: EnergyStrings;
  /** Carried so the canonical member survives into telemetry even where one chip shows. */
  readonly canonical?: string | null;
}

export function StateChip({ state, strings, canonical = null }: StateChipProps): JSX.Element {
  const treatment = ENERGY_STATE_TREATMENT[state];
  const violet = treatment === 'solidViolet';
  const colour = violet ? ENERGY_SEMANTIC.violet : ENERGY_SEMANTIC.achromatic;

  const border =
    treatment === 'labelOnly'
      ? 'none'
      : `1px ${treatment === 'dashedAchromatic' ? 'dashed' : 'solid'} ${violet ? ENERGY_LINE.violet : ENERGY_LINE.achromatic}`;

  return (
    <span
      data-energy-state={state}
      data-energy-treatment={treatment}
      data-energy-canonical={canonical ?? undefined}
      style={{
        ...mono(undefined, colour),
        border,
        padding: treatment === 'labelOnly' ? '3px 0' : '3px 6px',
        borderRadius: ENERGY_RADIUS.chip,
        whiteSpace: 'nowrap',
      }}
    >
      {strings.state[state]}
    </span>
  );
}

/**
 * ── §D · THE CHANGE STATE, AS TWO ELEMENTS. NEVER AS ONE STRING. ─────────
 *
 * M01 is RESOLVED and this is where the resolution becomes visible. The state
 * is a record of two required fields and it renders as two boxes:
 *
 *   service   absorbs the pressure — `flex: 1 1 auto`, ellipsis
 *   cause     `flex: none` — never shrinks, never truncates
 *
 * `RESTORED · CAUSE OPEN` therefore CANNOT truncate away the unresolved-cause
 * fact, because the fact is in its own box rather than in the tail of a string
 * an ellipsis would clip. That is §F-3 as a structure instead of a courtesy.
 *
 * ── THE `·` IS AN OPERATOR, NOT A CHARACTER IN A LABEL ───────────────────
 *
 * Which is also L04-F2's answer for free: the middle dot is a bidi NEUTRAL, so
 * between an RTL run and a Latin run it resolves to the paragraph direction —
 * *a separator that moves is a separator that stops separating.* As its own
 * element it sits inside the isolation boundary instead of floating between two
 * unisolated runs.
 *
 * ── WHY THE CAUSE FLOOR RENDERS NO CHIP, AND WHY THAT IS NOT A COLLAPSE ──
 *
 * `CAUSE_NOT_ASSESSED` is the floor — *we have not looked* — and the frozen
 * design renders five of its seven placeholders with no cause phrase at all.
 * Printing `CAUSE NOT ASSESSED` beside every quiet row would change the frozen
 * composition, which this round may not do.
 *
 * So the floor renders no visible token, and **the full two-axis value is in the
 * accessible name in every case** — a screen-reader user hears "cause not
 * assessed" where a sighted reader sees the frozen single token. The model still
 * carries both fields; nothing is collapsed, and `causeMustBeShown` is asserted
 * separately so `CAUSE_OPEN` can never take this path.
 */
export function ChangeStateTokens({
  state,
  labels,
  tone,
  variant = 'chip',
}: {
  state: ChangeState;
  labels: ChangeStateLabels;
  tone: EnergyTone;
  /**
   * ── `bare` RESTORES THE FROZEN DENSE-ROW TYPOGRAPHY, IT DOES NOT CHANGE IT ─
   *
   * The frozen file renders the CHANGE-GRID row's state as a plain mono label —
   * `font-family:mono; font-size:10px; letter-spacing:.1em; color:{{row.tone}}`
   * — with **no border and no padding**. The FEED, HUD, drawer and lens use the
   * bordered chip (`border:1px … ; padding:3px 6px; border-radius:2px`). R1
   * bordered both, which was a departure from the frozen file that nobody
   * noticed until Polish needed the room back.
   *
   * It needed it precisely: two borders and their padding cost ~28px of the
   * 190px column, and the separator and gaps ~16px more. `WZNOWIONO` (63px) +
   * `PRZYCZYNA OTWARTA` (119px) is 182px — it fits the frozen bare row and does
   * not fit the bordered one. So restoring the frozen typography is what lets
   * BOTH Polish tokens render whole, and the `·` is dropped in this variant for
   * the reason Main gives for dropping it in RTL: *"the two tokens are already
   * separate boxes."*
   */
  variant?: 'chip' | 'bare';
}): JSX.Element {
  const [service, cause] = changeStateTokens(state, labels);
  const showCause = state.cause !== 'CAUSE_NOT_ASSESSED';
  const mustShow = causeMustBeShown(state);
  const bare = variant === 'bare';

  const box: CSSProperties = bare
    ? {}
    : {
        border: `1px solid ${ENERGY_TONE_LINE[tone]}`,
        padding: '3px 6px',
        borderRadius: ENERGY_RADIUS.chip,
      };

  return (
    <span
      data-energy-change-service={state.service}
      data-energy-change-cause={state.cause}
      data-energy-variant={variant}
      /* F-2 — the complete semantic value, whatever the visible line does. */
      aria-label={`${service} · ${cause}`}
      style={{
        display: 'flex',
        /*
          4px, AND THE CORRECTED STORY IS RECORDED RATHER THAN THE FIRST ONE.

          This comment first claimed that dropping the gap from 5px to 4px made
          the Polish `RESTORED` token render whole. **Re-measurement disproved
          it.** In the shipped Polish row `PRZYCZYNA OTWARTA` occupies 122.8px
          of the frozen 190px column, which allots the service 63.2px against a
          natural ~64.8px — so it still clipped, by about a character and a
          half, at either gap. The first reading mistook the ALLOTTED width for
          the NATURAL one.

          R3 · L's delivered `PRZYWRÓCONO` (11 characters, 77.0px in L's
          advance model) is LONGER than the R2 placeholder it replaces, so it
          clips further, and saying so is the point: the fit was never the
          guarantee. `CAUSE_OPEN` is, and it is structural.

          The 4px is kept because it is strictly more room at no cost, not
          because it solves anything. What it does not do is change the
          guarantee, and the guarantee is the point: MEASURED ACROSS EVERY ROW
          IN BOTH LANGUAGES, THE CAUSE TOKEN IS NEVER CLIPPED. Main's own
          arithmetic predicted this — the joined form is 203px against 190px, so
          the pair genuinely does not fit at this density in Polish — and §F-3's
          answer was never that both would fit. It was that the fact which must
          not be lost is the one in the box that cannot shrink.
        */
        gap: bare ? '4px' : '6px',
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'flex-end',
        ...mono(undefined, ENERGY_TONE_HEX[tone]),
      }}
    >
      {/*
        F-4′ · the ellipsis is DECIDED, not declared. `serviceAxisStyle` grants
        `text-overflow: ellipsis` only where the vocabulary's minimum
        unambiguous prefix still fits the worst case this element can fall to
        (190px less the widest cause label less the gap). The delivered
        vocabularies pass at one character; the rejected verb-first Polish
        family would not, and would have been left to overflow visibly instead.
      */}
      <span
        data-energy-token="service"
        style={{
          ...serviceAxisStyle(Object.values(labels.service), Object.values(labels.cause)),
          ...box,
        }}
      >
        {service}
      </span>
      {showCause ? (
        <>
          {/* The composition operator, as its own element — omitted where the boxes already separate. */}
          {bare ? null : (
            <span aria-hidden="true" style={{ flex: 'none', color: ENERGY_INK.rule }}>
              ·
            </span>
          )}
          <span
            data-energy-token="cause"
            data-energy-must-show={mustShow ? 'true' : undefined}
            style={{ ...ENERGY_STATE_CAUSE_STYLE, ...box }}
          >
            {cause}
          </span>
        </>
      ) : null}
    </span>
  );
}

/* ── THE ABSENCE BLOCK — A CHIP THAT CANNOT APPEAR WITHOUT ITS REASON ─────
   "Every zone with nothing to show says WHY there is nothing." The `why`
   sentence is a required prop, so a zone cannot render its absence silently. */

interface AbsenceBlockProps {
  readonly zone: EnergyZoneState;
  readonly strings: EnergyStrings;
  readonly label?: string;
}

/**
 * ── R2 · A SECURITY WITHHOLDING IS NOT DISTINGUISHABLE FROM AN ABSENCE ────
 *
 * R1 rendered every gate by name — `data-energy-gate="E01"`, and a visible line
 * reading *"E01 sits with E1."* **That was an oracle, and R2 removes it.**
 * E1's D-1 states the rule and the reason:
 *
 *   *"A security withholding must not be distinguishable from an ordinary
 *    absence. No fifth reader state, no 'withheld for security' label. A
 *    distinguishable withhold NAMES PRECISELY THE SET YOU WERE PROTECTING, to
 *    everyone."*
 *
 * and D-4 closes the devtools route: the canonical member survives internally
 * *"and must not be reachable from the reader's response payload, or the first
 * rule is defeated by devtools."*
 *
 * So a security gate (E01–E04) contributes **nothing** to the render: no label,
 * no sentence, no attribute. The zone renders the ordinary absence with the
 * ordinary reason, exactly as a coverage gap for a benign cause would — and
 * `COVERAGE GAP` is reachable for benign reasons on the same surface, which is
 * D-3 and is what keeps the state from being a security label wearing a neutral
 * name.
 *
 * Non-security gates are a different question and stay visible. A reader who is
 * told a licence position is unmeasured (G01), that a price is unset (M07) or
 * that a vocabulary is pending (M01) learns something true about the platform
 * and nothing about what is being protected.
 */
const SECURITY_GATES: readonly string[] = ['E01', 'E02', 'E03', 'E04'];

export function isSecurityGate(gate: string | null | undefined): boolean {
  return typeof gate === 'string' && SECURITY_GATES.includes(gate);
}

export function AbsenceBlock({ zone, strings, label }: AbsenceBlockProps): JSX.Element {
  const disclosable = zone.gate !== null && !isSecurityGate(zone.gate);
  const gate = disclosable ? ENERGY_GATES[zone.gate as keyof typeof ENERGY_GATES] : null;

  const why =
    gate === null
      ? strings.stateWhy[zone.readerState]
      : `${strings.stateWhy[zone.readerState]} ${formatEnergyString(strings.gateBlockedTemplate, { gate: gate.id })}`;

  return (
    <div
      data-energy-absence={zone.readerState}
      data-energy-canonical={zone.canonicalAbsence ?? undefined}
      /* Only a non-security gate reaches the DOM. See the docblock. */
      data-energy-gate={gate?.id}
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 16px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <StateChip state={zone.readerState} strings={strings} canonical={zone.canonicalAbsence} />
        {label === undefined ? null : <Meta>{label}</Meta>}
      </div>
      <span style={{ fontSize: '12.5px', color: ENERGY_INK.quiet, lineHeight: 1.55 }}>{why}</span>
      {gate === null ? null : (
        <span style={{ ...mono(undefined, ENERGY_INK.dim), lineHeight: 1.6 }}>
          {gate.id} sits with {gate.owner}. It does not stop {gate.doesNotStop}.
        </span>
      )}
    </div>
  );
}

/* ── PRECISION — MANDATORY, AND SAYING SO ────────────────────────────────
   "A geometry without a precision statement must not render." This badge is a
   required child of every geometry surface in the frame, and it always carries
   the rule beside the value so the renderer is never mistaken for the witness. */

export function PrecisionBadge({
  precision,
  strings,
  withRule = false,
}: {
  precision: EnergyPrecision;
  strings: EnergyStrings;
  withRule?: boolean;
}): JSX.Element {
  return (
    <span data-energy-precision={precision} style={{ display: 'inline-flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span style={mono(undefined, ENERGY_INK.quiet)}>{strings.precision[precision]}</span>
      {withRule ? <span style={mono(undefined, ENERGY_INK.dim)}>{strings.precisionRule}</span> : null}
    </span>
  );
}

export function DataTierBadge({ tier, strings }: { tier: EnergyDataTier; strings: EnergyStrings }): JSX.Element {
  const unavailable = tier === 'LICENSED' || tier === 'NOT_AVAILABLE';
  return (
    <span
      data-energy-tier={tier}
      style={mono(undefined, unavailable ? ENERGY_SEMANTIC.violet : ENERGY_INK.quiet)}
    >
      {strings.dataTier[tier]}
    </span>
  );
}

/* ── WATCH — MINT AND A TEXT LABEL, AND NOTHING ELSE IS MINT ─────────────
   R11: "Watch state renders as mint PLUS A TEXT LABEL." The label is not
   optional, because mint alone would make a watched subject and a quiet subject
   distinguishable by colour only — which the non-colour-redundancy rule
   forbids. When E02 gates the scope, the control renders as the gate rather
   than as an offer the platform cannot honour. */

/**
 * ── R2 · SINGLE-ASSET WATCH IS CLEARED, AND THE GATE IS WITHDRAWN ────────
 *
 * R1 gated Watch on infrastructure behind E02 and rendered the gate in violet.
 * **Both halves were wrong.** E1's §C lists what proceeds:
 *
 *   *"Watch on situations, corridors, grid situations, AND SINGLE ASSETS"*
 *
 * Only `COMPOSITE_REGIONAL_WATCH` is held — a **reader-assembled** set, because
 * *"if the reader can define the membership, the platform is maintaining their
 * watchlist … the size of the set is not what makes it one; the AUTHORSHIP
 * is."* That capability is simply **not built**: there is no control for it
 * anywhere in this frame, so there is nothing to gate and nothing to explain.
 *
 * And the violet was wrong independently — violet is the entitlement boundary
 * and nothing else, so routing a security withhold to it told a reader that
 * **paying would reveal it**, which is both false and informative (E1's D-2).
 *
 * Three conditions bind the scopes that DO exist, and all three are structural
 * here rather than remembered:
 *
 *   1. **Watch never exceeds the subject's precision.** This control carries no
 *      precision of its own and emits no delta, so it cannot.
 *   2. **Watchability is declared, not earned.** The control renders for every
 *      subject regardless of whether one currently carries an assessment —
 *      *"if an asset becomes watchable only once something is happening to it,
 *      'watchable' is itself the disclosure."* Dark from declaration, not from
 *      arrival.
 *   3. **No attention aggregates, ever.** There is no watcher count, no "N
 *      readers are watching", no trending-watched list and no ranking by watch
 *      volume — and no prop through which one could arrive.
 */
export function WatchControl({
  watched,
  strings,
  onToggle,
}: {
  watched: boolean;
  strings: EnergyStrings;
  onToggle?: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      data-energy-watch={watched ? 'active' : 'inactive'}
      onClick={onToggle}
      aria-pressed={watched}
      style={{
        ...mono(undefined, watched ? ENERGY_SEMANTIC.mint : ENERGY_INK.quiet),
        border: `1px solid ${watched ? ENERGY_LINE.mint : ENERGY_LINE.achromatic}`,
        borderRadius: ENERGY_RADIUS.panel,
        background: 'transparent',
        minHeight: '44px',
        padding: '0 13px',
        cursor: 'pointer',
        flex: 1,
      }}
    >
      {watched ? strings.watchWatching : strings.watchNotWatching}
    </button>
  );
}

/* ── THE PRICED HANDOFF, WITHOUT A PRICE ─────────────────────────────────
   ZONE-TO-DATA: "price unknown -> affordance shows the action, NEVER A NUMBER
   MAIN DID NOT SET." This component HAS NO NUMBER PROP. The frozen design's
   12 / 18 / 24 are illustrative fixtures for a pricing table that does not
   exist, so they do not cross into the implementation in either frame. */

export function SandAffordance({ strings, onOpen }: { strings: EnergyStrings; onOpen?: () => void }): JSX.Element {
  return (
    <button
      type="button"
      data-energy-price="unset"
      data-energy-gate="M07"
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        minHeight: '44px',
        width: '100%',
        padding: '0 14px',
        border: `1px solid ${ENERGY_LINE.sand}`,
        borderRadius: ENERGY_RADIUS.panel,
        background: 'rgba(216,192,138,.06)',
        cursor: 'pointer',
      }}
    >
      <span style={mono(10.5, ENERGY_SEMANTIC.sand)}>{strings.deepAnalysisTitle}</span>
      {/* The slot where a price would go, carrying the absence rather than a fixture. */}
      <span style={mono(10.5, ENERGY_INK.quiet)}>{strings.priceNotSet}</span>
    </button>
  );
}

/* ── SMALL SHARED FURNITURE ──────────────────────────────────────────────── */

export function SectionLabel({ children, tone }: { children: ReactNode; tone?: string }): JSX.Element {
  return (
    <span style={{ ...mono(undefined, tone ?? ENERGY_INK.meta), letterSpacing: '.16em' }}>{children}</span>
  );
}

export function Hairline(): JSX.Element {
  return <div style={{ height: '1px', background: ENERGY_LINE.hairline }} />;
}

/**
 * The permanent provenance banner. It is not dismissible and not conditional on
 * anything but which data set is in force, because both statements it can make
 * are ones a reader must not miss: that these are design fixtures, or that the
 * platform holds no Energy data at all.
 */
export function FrameBanner({
  source,
  strings,
}: {
  source: 'governed' | 'design-fixture';
  strings: EnergyStrings;
}): JSX.Element {
  const fixture = source === 'design-fixture';
  return (
    <div
      data-energy-frame-banner={source}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '0 16px',
        height: '38px',
        flex: 'none',
        background: 'rgba(7,13,22,.96)',
        borderTop: `1px solid ${ENERGY_LINE.hairline}`,
      }}
    >
      <span style={{ ...mono(undefined, fixture ? ENERGY_SEMANTIC.amber : ENERGY_SEMANTIC.violet), letterSpacing: '.14em', flex: 'none' }}>
        {fixture ? strings.fixtureBanner : strings.governedBanner}
      </span>
      <span
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          fontSize: '11.5px',
          color: ENERGY_INK.meta,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {fixture ? strings.fixtureBannerBody : strings.governedBannerBody}
      </span>
    </div>
  );
}

/**
 * ══ R3 · `RowMeta` — TWO ELEMENTS, ONE LINE, A NUMERAL THAT CANNOT CLIP ════
 *
 * The structural version of L's ruling 2. The component has no prop that could
 * join the two values into one string and no prop that could let the count
 * shrink, so the protection holds by shape rather than by review — the same
 * pattern `StateChip` uses to make a chip unable to carry a figure.
 *
 *   recency   `flex:1 1 auto; min-width:0` + the clamp   — may ellipsize
 *   `·`       rendered by the CONTAINER                  — cannot be clipped
 *             away, cannot be orphaned, and is `aria-hidden` because the
 *             accessible name carries its own separator
 *   count     `flex:none`, no `text-overflow`            — NUM-1: never clips
 *
 * The numeral and the hour value are `MachineReadable` — the accepted bidi
 * primitive, `dir="ltr"` + `unicode-bidi: isolate`, with 28 consumers. **A
 * second isolation primitive is not grown here**, which is the instruction
 * already attached to L04-F1.
 *
 * NOTHING BELOW NAMES `left` OR `right`. `text-overflow: ellipsis` clips the
 * LOGICAL end, which flips under `dir="rtl"`; a physical spelling is correct
 * today and silently moves the ellipsis onto the numeral in an RTL locale.
 */
export function RowMeta({ meta, strings }: { meta: EnergyRowMeta; strings: EnergyStrings }): JSX.Element {
  if (meta.kind === 'STATEMENT') {
    return (
      <span
        data-energy-meta="statement"
        title={meta.statement}
        aria-label={meta.statement}
        style={{ ...mono(undefined, ENERGY_INK.meta), ...ENERGY_META_STATEMENT_STYLE }}
      >
        {meta.statement}
      </span>
    );
  }

  const parts = splitMetaRecency(meta.checkedHours, strings);
  const recency = formatMetaRecency(meta.checkedHours, strings);
  const count = formatMetaCount(meta.count, meta.counted, strings);

  return (
    <span
      data-energy-meta="evidenced"
      /*
        F-2′ · the container's accessible name is the ORDERED JOIN of the
        elements' full values, separated as rendered — and each element's own
        visible text stays a prefix of its own full value. Without the
        per-element restatement, a conforming implementation and a
        non-conforming one are indistinguishable once the first element clips.
      */
      aria-label={`${recency} ${ENERGY_META_SEPARATOR} ${count}`}
      style={{ ...mono(undefined, ENERGY_INK.meta), ...ENERGY_META_ROW_STYLE }}
    >
      <span data-energy-meta-part="recency" title={recency} style={ENERGY_META_RECENCY_STYLE}>
        {parts.prefix}
        <MachineReadable>{parts.value}</MachineReadable>
        {parts.suffix}
      </span>
      <span aria-hidden="true" style={{ flex: 'none', color: ENERGY_INK.rule }}>
        {ENERGY_META_SEPARATOR}
      </span>
      {/* NUM-1 · the count and its noun are ONE element, and it does not shrink. */}
      <span data-energy-meta-part="count" style={ENERGY_META_COUNT_STYLE}>
        <MachineReadable>{String(meta.count)}</MachineReadable> {strings.metaCounted[meta.counted]}
      </span>
    </span>
  );
}
