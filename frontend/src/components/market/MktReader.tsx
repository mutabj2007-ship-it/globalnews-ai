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
      <h2 style={{
        margin: 0, fontSize: MKT_TYPE.title, fontWeight: 600, color: MKT_INK.primary,
      }}>{t.reader.headlineNone}</h2>
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
 * RIGHTS AND ACTIVATION ARE SHOWN AS TWO FACTS, NEVER AS ONE VERDICT.
 *
 * SI-18.5 makes them independent and both required. A single "available / unavailable"
 * pill would collapse them, and the collapse is how a surface ends up implying that a
 * provider with rights but no activation is live. `TED` reads *"Rights permit use. Not
 * activated, so it is not running."* — which is both true halves in one sentence.
 *
 * World Bank and ECB are not rows here. They have no rights record at all, and an empty
 * checkbox beside their name would say they are one switch away.
 */
export function CapabilityList({ rows, t }: {
  rows: readonly MarketCapabilityRow[]; t: MktStrings;
}): JSX.Element {
  return (
    <div data-mkt="capability" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {rows.map((p) => (
        <div
          key={p.providerId}
          data-mkt="capability-row"
          data-mkt-provider={p.providerId}
          data-mkt-runnable={String(p.runnable)}
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'baseline',
            border: `1px solid ${MKT_LINE.hairline}`, padding: '9px 12px',
          }}
        >
          <span style={{ fontSize: MKT_TYPE.body, color: MKT_INK.primary, fontWeight: 600 }}>
            <Identifier>{p.providerId}</Identifier>
          </span>
          <span style={{
            ...micro, color: MKT_INK.tertiary, textTransform: 'none',
            letterSpacing: mktTracking(0.01), whiteSpace: 'normal', flex: '1 1 18ch',
          }}>
            {p.runnable ? '' : t.reader.providerNotActivated}
          </span>
        </div>
      ))}
      <p style={{ margin: '2px 0 0', fontSize: MKT_TYPE.monoMeta, color: MKT_INK.tertiary,
        whiteSpace: 'normal', maxWidth: '62ch' }}>{t.reader.capabilityNone}</p>
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
