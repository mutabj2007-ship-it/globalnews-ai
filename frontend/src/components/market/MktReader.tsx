'use client';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART VII · THE READER-FACING MARKET COMPONENTS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHAT CHANGED, AND WHY THESE ARE NEW FILES RATHER THAN EDITS.
 *
 * The readiness substrate answered "what can this platform observe". It was correct and
 * it is kept — a reader can still reach it, below the fold, in its own register. But its
 * primary frame read like an engineering console: contract constants as headlines,
 * `MARKET_RUNTIME_ENABLED_SUBJECTS = [] (0)` as a row, NOT READY as the loudest pill on
 * the page. That is the right surface for a lane and the wrong one for a reader.
 *
 * These components are the reader's half. They present an OBSERVATION the way Part VII
 * §9 describes a Market Movement Card, reduced to the items the accepted contract can
 * actually supply, with every omission stated rather than faked.
 *
 * ── WHAT §9 ASKS FOR, AND WHAT IS BUILT ───────────────────────────────────
 *
 *   §9.1  change state chip      NOT BUILT — only 2 of 7 states are producible and no
 *                                change state is attached to an observation. §9 says the
 *                                chip comes from the shared vocabulary ONLY.
 *   §9.2  object name and type   PARTIAL  — the contract carries `seriesId`, a code. The
 *                                card renders it as a machine-readable identifier and
 *                                says the published name is not carried.
 *   §9.3  intelligence statement NOT BUILT — no assessment producer exists.
 *   §9.4  value with its unit    BUILT    — and §9 marks the value optional, which is why
 *                                a null value is an absence rather than a zero.
 *   §9.5  change                 NOT BUILT — needs two comparable periods; R10's
 *                                comparability flag has no member in any contract.
 *   §9.6  period and baseline    PARTIAL  — the period is printed; there is no baseline.
 *   §9.7  freshness chip         BUILT, REQUIRED — derived in `mktReadModel`, never
 *                                assumed. R10: no component displays a value without one.
 *   §9.8  materiality            NOT BUILT — no assessment.
 *   §9.9  exposure               NOT BUILT — no edges.
 *   §9.10 confidence             NOT BUILT — no producer.
 *   §9.11 source line            BUILT, REQUIRED — provider and source class. An
 *                                observation the read port cannot attribute is refused
 *                                upstream and never reaches this file.
 *   §9.12 geography chip         NOT BUILT — no geography on the observation.
 *   §9.13 Watch state            NOT BUILT — MARKET Watch subject types are not
 *                                registered.
 *   §9.14 cross-domain row       NOT BUILT — no reference renderer.
 *
 * §9 itself permits the reduced card: *"A defence procurement subject or a sector
 * condition renders the same card with no numeric value and no percentage."* What it
 * forbids is forcing every object into a price, and nothing here does.
 *
 * ── THE RULE THAT SHAPES EVERY COMPONENT BELOW ────────────────────────────
 *
 * R10 rule 2: *"No component implies real-time behaviour: no auto-tick, no
 * flash-on-update, no ticker tape, no live-pulse affordance, anywhere in Phase 1."*
 * Nothing here animates, polls, or carries a liveness affordance. §7: direction is
 * achromatic — there is no up-green/down-red anywhere, and no direction glyph at all,
 * because no change is computed.
 */

import type { JSX, ReactNode } from 'react';
import {
  MKT_HEADING,
  MKT_HIT_TARGET_PX,
  MKT_INK,
  MKT_LICENSED,
  MKT_LINE,
  MKT_SURFACE,
  MKT_TYPE,
  mktTracking,
} from '@/lib/market/mktTokens';
import { Identifier, edge, micro } from './MktParts';
import {
  deriveFreshness,
  type MarketCapabilityRow,
  type MarketFreshnessState,
  type MarketReadUnavailableReason,
  type MarketStoredObservation,
} from '@/lib/market/mktReadModel';
import type { MktStrings } from '@/lib/market/mktStrings';

/* ───────────────────────────────────────────────────────────────────────────
 * FIELD — one labelled fact inside a card
 * ─────────────────────────────────────────────────────────────────────────── */

function Field({ label, children, wide = false }: {
  label: string; children: ReactNode; wide?: boolean;
}): JSX.Element {
  return (
    <div data-mkt="field" style={{
      display: 'flex', flexDirection: 'column', gap: '3px',
      gridColumn: wide ? '1 / -1' : 'auto', minWidth: 0,
    }}>
      <span style={{ ...micro, color: MKT_INK.label }}>{label}</span>
      <span style={{
        fontSize: MKT_TYPE.body, color: MKT_INK.primary,
        whiteSpace: 'normal', overflowWrap: 'anywhere',
      }}>{children}</span>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * FRESHNESS CHIP — R10, and the one chip that is never optional
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * ACHROMATIC BY RULE. §7 freezes the semantic colour inventory and grants Market no
 * accent; `MARKET_ACCENT_TBD` holds the slot. A freshness state is not an alarm, so it
 * takes the neutral chip treatment and earns its distinction from copy and border, never
 * from a hue. `STALE` is not drawn in amber: amber is reserved to approved shared change.
 */
export function FreshnessChip({ state, t }: {
  state: MarketFreshnessState; t: MktStrings;
}): JSX.Element {
  return (
    <span
      data-mkt="freshness"
      data-mkt-freshness={state.kind}
      data-mkt-freshness-provenance={state.atProvenance ?? 'NONE'}
      style={{
        ...micro, whiteSpace: 'nowrap', padding: '3px 8px',
        border: `1px solid ${MKT_LINE.border}`, color: MKT_INK.secondary,
        background: MKT_SURFACE.chip,
      }}
    >
      {t.freshness[state.kind]}
      {state.at !== null && (
        <>
          {' · '}
          <Identifier>{state.at}</Identifier>
        </>
      )}
    </span>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * OBSERVATION CARD
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * THE VALUE IS PRINTED AS THE PUBLISHER PUBLISHED IT.
 *
 * No locale formatter, no thousands separator, no rounding, no currency symbol inferred
 * from a unit string. G's P0 measurement is the reason: `QUANTITY_IN_100KG` is hundreds
 * of kilograms with nothing in the payload saying so, Eurostat yields carry no unit field
 * at all, and a formatter that decides `PC` means percent has made a claim the source did
 * not. The unit renders beside the value as its own labelled fact, in the source's own
 * token, and R10's rounding rule stays satisfied because nothing rounds.
 */
export function ObservationCard({ o, t }: {
  o: MarketStoredObservation; t: MktStrings;
}): JSX.Element {
  const freshness = deriveFreshness(o);
  return (
    <article
      data-mkt="observation"
      data-mkt-series={o.seriesId}
      data-mkt-release={o.releaseStatus}
      style={{
        border: edge, background: MKT_SURFACE.panel,
        padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px',
      }}
    >
      {/* §9.2 — identity, and the honest note that a published name is not carried */}
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'baseline' }}>
        <span style={{ ...micro, color: MKT_HEADING.secondaryInk }}>{t.reader.seriesIdentifier}</span>
        <span style={{ fontSize: MKT_TYPE.bodyLarge, color: MKT_INK.primary, fontWeight: 600 }}>
          <Identifier>{o.seriesId}</Identifier>
        </span>
        <FreshnessChip state={freshness} t={t} />
        <span data-mkt="release" style={{ ...micro, color: MKT_INK.tertiary }}>
          {t.release[o.releaseStatus]}
        </span>
      </header>

      {/* §9.4 value + unit · §9.6 period · the vintage, labelled with its provenance */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 148px), 1fr))',
        gap: '12px 18px',
      }}>
        <Field label={t.reader.value}>
          <Identifier>{o.value === null ? '—' : String(o.value)}</Identifier>
        </Field>
        <Field label={t.reader.unit}>
          <Identifier>{o.unit}</Identifier>
        </Field>
        <Field label={t.reader.period}>
          <Identifier>{o.periodId}</Identifier>
        </Field>
        <Field label={t.reader.vintage}>
          <VintageValue o={o} t={t} />
        </Field>
      </div>

      {/* §9.11 — the source line. Never absent: the read port refuses an unattributed row. */}
      <footer data-mkt="provenance" style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'baseline',
        borderBlockStart: `1px solid ${MKT_LINE.hairline}`, paddingBlockStart: '10px',
      }}>
        <span style={{ ...micro, color: MKT_INK.label }}>{t.reader.source}</span>
        <span style={{ fontSize: MKT_TYPE.body, color: MKT_INK.secondary }}>
          <Identifier>{o.provider}</Identifier>
        </span>
        <span style={{ ...micro, color: MKT_INK.label }}>{t.reader.sourceClass}</span>
        <span style={{ fontSize: MKT_TYPE.body, color: MKT_INK.secondary }}>
          <Identifier>{o.sourceClass}</Identifier>
        </span>
        {!o.retentionIsFinal && (
          <span data-mkt="provisional" style={{ ...micro, color: MKT_INK.tertiary, textTransform: 'none',
            letterSpacing: mktTracking(0.01), whiteSpace: 'normal' }}>
            {t.reader.provisionalRetention}
          </span>
        )}
      </footer>

      <p style={{
        margin: 0, fontSize: MKT_TYPE.monoMeta, color: MKT_INK.tertiary,
        whiteSpace: 'normal', overflowWrap: 'anywhere',
      }}>{t.reader.seriesNameNotCarried}</p>
    </article>
  );
}

/**
 * The vintage, and which of the three timestamps it is — SI-9.2. An `INGEST_SNAPSHOT`
 * observation has no publisher vintage, and the card says exactly that instead of
 * printing our download time under a heading that reads like the publisher's.
 */
function VintageValue({ o, t }: { o: MarketStoredObservation; t: MktStrings }): JSX.Element {
  if (o.vintageProvenance === 'PUBLISHER_VINTAGE' && o.publisherVintage !== null) {
    return (
      <>
        <Identifier>{o.publisherVintage}</Identifier>
        <span style={{ ...micro, color: MKT_INK.label, display: 'block', marginBlockStart: '2px' }}>
          {t.reader.vintagePublisher}
        </span>
      </>
    );
  }
  if (o.vintageProvenance === 'PUBLISHER_CHANGED_AT' && o.publisherChangedAt !== null) {
    return (
      <>
        <Identifier>{o.publisherChangedAt}</Identifier>
        <span style={{ ...micro, color: MKT_INK.label, display: 'block', marginBlockStart: '2px' }}>
          {t.reader.vintageChanged}
        </span>
      </>
    );
  }
  return <span style={{ color: MKT_INK.tertiary }}>{t.reader.vintageNone}</span>;
}

/* ───────────────────────────────────────────────────────────────────────────
 * THE UNAVAILABLE STATE
 * ─────────────────────────────────────────────────────────────────────────── */

const READ_REASON_KEY = {
  NO_READ_ENDPOINT: 'readNoEndpoint',
  NO_ACTIVATED_PROVIDER: 'readNoActivatedProvider',
  NO_OBSERVATION_STORED: 'readNoObservation',
  NO_DISPLAYABLE_OBSERVATION: 'readNoDisplayable',
} as const satisfies Record<MarketReadUnavailableReason, keyof MktStrings['reader']>;

/**
 * THE SENTENCE THAT DOES THE WORK IS THE SECOND ONE.
 *
 * The readiness substrate's *"That describes what we hold — it is not a statement about
 * the market"* is reused verbatim, because it is the whole reason this surface is safe to
 * show a reader: without it, an empty Market page reads as a calm market. It is carried
 * here rather than rewritten, and the reason is stated beside it so a reader learns which
 * limitation is ours.
 */
export function ReadUnavailable({ reason, t }: {
  reason: MarketReadUnavailableReason; t: MktStrings;
}): JSX.Element {
  return (
    <section
      data-mkt="read-unavailable"
      data-mkt-read-reason={reason}
      style={{
        border: edge, background: MKT_SURFACE.panel, padding: '18px 20px',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}
    >
      {/*
        DEMOTED FROM THE PAGE'S SECOND-LARGEST TYPE TO A LABEL.

        This was `MKT_TYPE.title` at weight 600 — the same ramp as the `<h1>` above it —
        so the loudest two things on a market dashboard were its name and a denial. The
        heading level is kept, because it is still the heading of this region and a screen
        reader needs it; only the ramp moved, to the micro label the rest of the surface
        uses for a region name.
      */}
      <h2 style={{ ...micro, margin: 0, color: MKT_INK.secondary }}>{t.reader.headlineNone}</h2>
      {/*
        F's RATIFIED SENTENCE, REUSED RATHER THAN REWRITTEN.

        `labels.observationBody` is the copy F ratified for exactly this moment, and it
        is the sentence that stops an empty Market page reading as a calm market. Writing
        a second sentence that means the same thing would leave two to keep true and would
        aim L's Polish at the wrong one.
      */}
      <p style={{ margin: 0, fontSize: MKT_TYPE.body, color: MKT_INK.secondary,
        whiteSpace: 'normal', maxWidth: '62ch' }}>
        {t.labels.observationBody}
      </p>
      {/* And WHICH limitation it is — the part F's sentence deliberately does not carry. */}
      <p style={{ margin: 0, fontSize: MKT_TYPE.body, color: MKT_INK.tertiary,
        whiteSpace: 'normal', maxWidth: '62ch' }}>
        {t.reader[READ_REASON_KEY[reason]]}
      </p>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * CAPABILITY — two conditions, shown separately
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * WHICH SOURCES THIS SURFACE MAY USE, AND WHETHER ANY IS RUNNING — SUBORDINATE.
 *
 * This was a stack of bordered cards, one per provider, headed and placed at the top of
 * the context rail. The activation rules that shape out: the capability rail *"must no
 * longer visually dominate the intelligence canvas"* and the surface must *"not lead with
 * provider execution status"*. So it is now three hairline rows at the foot of the rail,
 * with no card edge and no heading dot of its own.
 *
 * RIGHTS AND ACTIVATION ARE STILL TWO FACTS, NEVER ONE VERDICT. SI-18.5 makes them
 * independent and both required. A single "available / unavailable" pill would collapse
 * them, and the collapse is how a surface ends up implying that a provider with rights but
 * no activation is live. Demoting a row is a layout decision; collapsing it would have been
 * a truth decision, and only the first was asked for.
 *
 * WORLD BANK AND ECB ARE STILL NOT ROWS HERE. They have no rights record at all, and an
 * empty checkbox beside their name would say they are one switch away.
 */
export function CapabilityList({ rows, t }: {
  rows: readonly MarketCapabilityRow[]; t: MktStrings;
}): JSX.Element {
  return (
    <div data-mkt="capability" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {rows.map((p) => (
        <div
          key={p.providerId}
          data-mkt="capability-row"
          data-mkt-provider={p.providerId}
          data-mkt-rights={String(p.rightsEligible)}
          data-mkt-activated={String(p.activated)}
          data-mkt-runnable={String(p.runnable)}
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'baseline',
            padding: '5px 0', borderBottom: `1px solid ${MKT_LINE.hairline}`, minWidth: 0,
          }}
        >
          <span style={{ ...micro, color: MKT_INK.secondary, flex: '0 0 auto' }}>
            <Identifier>{p.providerId}</Identifier>
          </span>
          {/*
            TWO FACTS, STILL SEPARATE — SI-18.5 SURVIVES THE DEMOTION.

            Rights and activation are independent and both required, and they are still
            rendered as two things: the rights word, then the activation word. A single
            "available / unavailable" pill would collapse them, and the collapse is how a
            surface ends up implying that a provider with rights but no activation is live.
            The row got quieter; it did not get vaguer.
          */}
          {p.rightsEligible && (
            <span data-mkt="capability-rights" style={{
              ...micro, color: MKT_INK.label, textTransform: 'none',
              letterSpacing: mktTracking(0.01), flex: '0 0 auto',
            }}>{t.reader.capabilityRights}</span>
          )}
          <span data-mkt="capability-activation" style={{
            ...micro, color: MKT_INK.tertiary, textTransform: 'none',
            letterSpacing: mktTracking(0.01), whiteSpace: 'normal', flex: '1 1 12ch',
          }}>
            {p.runnable ? t.reader.capabilityActivation : t.reader.providerNotActivated}
          </span>
        </div>
      ))}
      <p style={{ margin: '6px 0 0', fontSize: MKT_TYPE.monoMeta, color: MKT_INK.tertiary,
        whiteSpace: 'normal', maxWidth: '48ch' }}>{t.reader.capabilityNone}</p>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * STATUS STRIP — Z1, reduced to what is true
 * ─────────────────────────────────────────────────────────────────────────── */

export function MarketStatus({ held, t }: { held: number; t: MktStrings }): JSX.Element {
  return (
    <div data-mkt="status" data-mkt-held={String(held)} style={{
      display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'baseline',
    }}>
      <span style={{ ...micro, color: MKT_INK.label }}>{t.reader.observations}</span>
      <span data-mkt="status-value" style={{
        ...micro, padding: '3px 8px', border: `1px solid ${held > 0 ? MKT_LICENSED.mint : MKT_LINE.border}`,
        color: held > 0 ? MKT_LICENSED.mint : MKT_INK.tertiary,
        background: held > 0 ? 'transparent' : MKT_SURFACE.chip, whiteSpace: 'nowrap',
      }}>
        {/*
          F M-1 / M-2 · HELD, NOT DATA, AND COUNTED FROM RECORDS.
          "NO OBSERVATION DATA" is true and one word from reading as *there is no market
          data* — a claim about the world. `held` is `observations.length`: a count of
          records this surface is holding, never a readiness flag.
        */}
        {held > 0
          ? `${t.labels.observationBadgeHeld} · ${held}`
          : t.labels.observationBadgeZero}
      </span>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * REGION B · Z1 — COVERAGE AND FRESHNESS
 * ─────────────────────────────────────────────────────────────────────────── */

/** The absent-figure glyph. Not a zero, never formatted, and it carries no unit. */
const ABSENT = '—';

/**
 * THE KPI GEOMETRY, WITH THE FIGURE WITHHELD.
 *
 * R11 names this zone *"Coverage and freshness strip — what data is present, at what tier,
 * how fresh; watched-object count"*, resident and low height, and adds the constraint that
 * decides its treatment: *"Not a ticker. No values, no auto-update."* So a strip that shows
 * `—` in every cell is not a degraded version of this zone — it is this zone, with the
 * coverage it currently has.
 *
 * ── WHY THESE SIX CELLS ───────────────────────────────────────────────────
 *
 * They are the six Market subject kinds from R01's Object Capability Matrix, which is the
 * accepted answer to *"what does this surface report"*. Nothing here is an instrument, a
 * ticker or a commodity name: naming `BRENT` or `WIG20` beside an absent figure would put a
 * specific market object on screen that this platform has never observed, and that is the
 * fabrication the activation forbids even when the number beside it is a dash.
 *
 * The parallel is Economy's `PRODUCTION_SHAPED_SUBJECT`, which lists six structural series
 * by generic name for exactly this reason and states it: *"the labels are generic economic
 * indicator names, not any country's published figures."*
 *
 * ── WHY THERE IS NO WATCHED-OBJECT COUNT ──────────────────────────────────
 *
 * R11 asks for one and it is deliberately absent. Market Watch subject types are not
 * registered — `labels.watchUnavailable` is the measured fact — so a `0` here would not
 * mean *nothing is watched*; it would mean *watching works and you have chosen nothing*.
 * The count returns when the subject types do.
 */
export function CoverageStrip({ t }: { t: MktStrings }): JSX.Element {
  const kinds = Object.keys(t.subjects);
  return (
    <section data-mkt="zone-b" data-mkt-region="coverage" style={{
      display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'baseline' }}>
        <span style={{ ...micro, color: MKT_INK.label }}>{t.reader.coverage}</span>
        <span data-mkt="coverage-freshness" style={{ ...micro, color: MKT_INK.tertiary }}>
          {t.freshness.UNAVAILABLE}
        </span>
      </div>
      <div style={{
        display: 'grid', gap: '1px', background: MKT_LINE.hairline,
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 128px), 1fr))',
      }}>
        {kinds.map((kind) => (
          <div key={kind} data-mkt="coverage-cell" data-mkt-subject={kind} style={{
            background: MKT_SURFACE.panel, padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0,
          }}>
            <span style={{ ...micro, color: MKT_INK.label, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
              {t.subjects[kind]}
            </span>
            <span data-mkt="figure-absent" aria-label={t.reader.awaitingData} style={{
              fontFamily: "var(--ar-family, 'IBM Plex Mono', monospace)",
              fontSize: MKT_TYPE.bodyLarge, color: MKT_INK.tertiary,
            }}>{ABSENT}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * REGION C · Z4 — THE SUBSTRATE PANEL
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * THE PANEL THAT HOLDS ITS PLACE, AND THE LINE IT REFUSES TO DRAW.
 *
 * R11's Z4 is *"one substrate at a time: time series, ranked comparison, exposure graph,
 * corridor map, timeline"*, resident, absorbing surplus width. Before this, the surface had
 * no Z4 at all when the read was unavailable: the region was the unavailable notice, so the
 * dashboard's largest area was a paragraph.
 *
 * NO PLOTTED LINE, NO BASELINE, NO AXIS, NO GRIDLINES. A horizontal rule across an empty
 * plot reads as a series that did not move, and on a market surface *did not move* is a
 * claim about prices. The inert diagonal hatch is the same treatment Economy's mini-map and
 * corridor wells use to mean *this is a plot area and it is not plotting*.
 *
 * R10 rule 2 governs what may animate here, and the answer is nothing: *"no auto-tick, no
 * flash-on-update, no ticker tape, no live-pulse affordance, anywhere in Phase 1."* There is
 * no shimmer and no skeleton — a pulsing bar shaped like a price says one is arriving.
 */
export function SubstratePanel({ t, children }: {
  t: MktStrings; children?: ReactNode;
}): JSX.Element {
  return (
    <section data-mkt="zone-c" style={{
      border: edge, background: MKT_SURFACE.panel, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '220px', minWidth: 0,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ ...micro, color: MKT_INK.label }}>{t.reader.observations}</span>
        <span style={{ ...micro, color: MKT_INK.label }}>{t.reader.awaitingData}</span>
      </div>
      {children ?? (
        <div data-mkt="substrate-well" role="img" aria-label={t.reader.awaitingData} style={{
          flex: '1 1 auto', minHeight: '140px',
          backgroundImage: `repeating-linear-gradient(135deg, ${MKT_SURFACE.raised} 0 7px, ${MKT_SURFACE.panel} 7px 14px)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span data-mkt="figure-absent" style={{
            fontFamily: "var(--ar-family, 'IBM Plex Mono', monospace)",
            fontSize: MKT_TYPE.title, color: MKT_INK.tertiary,
          }}>{ABSENT}</span>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * REGION D · change and freshness context
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * CHANGE AND FRESHNESS, IN THE PLACE THEY WILL ALWAYS BE.
 *
 * §9.5 marks change NOT BUILT and states the reason: it needs two comparable periods, and
 * R10's comparability flag has no member in any accepted contract. So the change slot shows
 * the absent glyph and will keep showing it until a contract can express comparability —
 * this region is not a promise that a percentage is coming, it is where one would go.
 *
 * THE FRESHNESS SLOT IS NOT BLANK, AND THAT IS THE DIFFERENCE. R10 makes freshness the one
 * chip that is never optional: *"no component displays a value without one."* Its six-member
 * vocabulary already contains the member for this case — `UNAVAILABLE` — so the slot is
 * filled from the governed set rather than emptied. A freshness slot that goes blank when
 * there is no data is a surface that only tells you how fresh something is when the answer
 * is flattering.
 *
 * `STATE_NOT_DERIVABLE` is deliberately NOT printed here. It is precise and it is
 * engineering: it belongs in the readiness disclosure, where `absence` already carries it
 * along with the sentence that matters most about it — *"this is not 'no material change'."*
 */
export function ChangeContext({ t }: { t: MktStrings }): JSX.Element {
  const slot = {
    fontFamily: "var(--ar-family, 'IBM Plex Mono', monospace)",
    fontSize: MKT_TYPE.body, color: MKT_INK.tertiary,
  };
  return (
    <div data-mkt="zone-d" style={{
      display: 'flex', flexWrap: 'wrap', gap: '6px 20px', alignItems: 'baseline', minWidth: 0,
    }}>
      <span style={{ ...micro, color: MKT_INK.label }}>{t.reader.change}</span>
      <span data-mkt="figure-absent" aria-label={t.reader.awaitingData} style={slot}>{ABSENT}</span>
      <span style={{ ...micro, color: MKT_INK.label }}>{t.reader.freshness}</span>
      <span data-mkt="freshness" data-mkt-freshness="UNAVAILABLE" style={{ ...micro, color: MKT_INK.tertiary }}>
        {t.freshness.UNAVAILABLE}
      </span>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * REGION E · the provenance affordance
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * WHERE THIS CAME FROM — ONE CONTROL, AND NO PUBLISHER NAMED BESIDE AN ABSENT FIGURE.
 *
 * §9.11 makes the source line required on an OBSERVATION, and the read port refuses a row
 * it cannot attribute, so a populated card always carries its provider and source class.
 * With nothing held there is no provenance to state, and the honest affordance is the
 * question rather than an answer: a reader can ask where a figure would come from, and the
 * taxonomy that answers it opens in a drawer.
 *
 * NO GREYED PROVIDER NAME. Printing `TED` or `EUROSTAT` faintly beside a dash is the one
 * move this region could make that would assert something untrue — it would say this figure
 * came from that publisher. Which sources the surface MAY use is a different question, it
 * has its own region, and it is answered there.
 */
export function ProvenanceAffordance({ t, onOpen }: {
  t: MktStrings; onOpen: () => void;
}): JSX.Element {
  return (
    <button type="button" data-mkt="zone-e" onClick={onOpen} style={{
      ...micro, minHeight: `${MKT_HIT_TARGET_PX}px`, padding: '0 14px',
      border: `1px solid ${MKT_LINE.border}`, background: MKT_SURFACE.chip,
      color: MKT_INK.secondary, cursor: 'pointer', alignSelf: 'flex-start',
      display: 'inline-flex', alignItems: 'center', gap: '10px',
    }}>
      <span>{t.reader.showProvenance}</span>
      <span aria-hidden="true" style={{ color: MKT_INK.label }}>→</span>
    </button>
  );
}

/**
 * THE PROVENANCE TAXONOMY, BEHIND THE CONTROL ABOVE.
 *
 * Four labelled facts, in the order a card prints them, each showing what it will carry
 * rather than a value: the source, its class, the vintage and which of the three timestamps
 * that vintage is. That last one is the engineering detail the activation asks to be placed
 * behind a secondary disclosure, and it is the detail most worth keeping somewhere — SI-9.2
 * exists because an ingest snapshot printed under a heading that reads like the publisher's
 * is how a download time becomes a publication date.
 */
export function ProvenanceDetail({ t }: { t: MktStrings }): JSX.Element {
  const rows: readonly (readonly [string, string])[] = [
    [t.reader.source, ABSENT],
    [t.reader.sourceClass, ABSENT],
    [t.reader.vintage, t.reader.vintageNone],
    [t.reader.vintagePublisher, t.reader.vintageChanged],
  ];
  return (
    <div data-mkt="provenance-detail" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{
          display: 'flex', gap: '14px', justifyContent: 'space-between', alignItems: 'baseline',
          flexWrap: 'wrap', padding: '9px 0', borderBottom: `1px solid ${MKT_LINE.hairline}`,
        }}>
          <span style={{ ...micro, color: MKT_INK.label, flex: '1 1 18ch' }}>{label}</span>
          <span style={{ fontSize: MKT_TYPE.body, color: MKT_INK.tertiary, whiteSpace: 'normal' }}>
            {value}
          </span>
        </div>
      ))}
      <p style={{ margin: '10px 0 0', fontSize: MKT_TYPE.body, color: MKT_INK.tertiary,
        whiteSpace: 'normal', maxWidth: '62ch' }}>{t.reader.provisionalRetention}</p>
    </div>
  );
}
