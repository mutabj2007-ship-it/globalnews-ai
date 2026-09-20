import type { JSX } from 'react';

import { ECON_SURFACE, ECON_LINE, ECON_INK } from './econTokens';
import {
  ECONOMY_READ_ABSENCE_TEXT,
  type EconomyReadResult,
} from '@/lib/economy/economyObservationRead';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE ONE REAL FIGURE — AND ITS PROVENANCE, BESIDE IT RATHER THAN BEHIND IT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The Product Owner has to be able to see ONE unmistakably real, source-backed Economy
 * observation. This is it, and everything about it is designed so it cannot be mistaken
 * for one of the illustrative frames around it.
 *
 * ── WHAT IT WILL NOT DO ───────────────────────────────────────────────────
 *
 * It renders NOTHING when nothing is retained — it renders the ABSENCE, with the reason,
 * naming the platform rather than the world. *"A gap is never a zero and never an empty
 * cell with no explanation."* It has no fixture path, no placeholder number and no
 * default value: a reader who sees a figure here is seeing one that came out of a
 * retained artifact, and a reader who sees a sentence is being told why there is none.
 *
 * ── AND IT IS NOT A REDESIGN ──────────────────────────────────────────────
 *
 * It is one panel, in the Economy surface's own achromatic tokens, added beside the
 * existing architecture. No card moves, no card is retitled, and no unrelated card is
 * populated — GDP, unemployment, debt and the rest stay in the truthful not-held states
 * they were already in, because manufacturing a value to make the screen look complete is
 * the one thing this round forbids outright.
 */
export function RetainedObservationPanel({
  read,
}: {
  readonly read: EconomyReadResult;
}): JSX.Element {
  const isObservation = read.kind === 'OBSERVATIONS' && read.observations.length > 0;

  return (
    <section
      data-econ="retained-observation"
      aria-label="Retained official observation"
      style={{
        background: ECON_SURFACE.panel,
        border: `1px solid ${ECON_LINE.emphasis}`,
        borderRadius: 2,
        padding: '12px 14px',
        margin: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        /* Compact-first: at 390px this wraps rather than scrolls, like every other row
           in the accepted top chrome. */
        maxWidth: 1920,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: 8,
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: ECON_INK.secondary,
        }}
      >
        <span>Retained official observation</span>
        <span aria-hidden="true">·</span>
        <span>{isObservation ? 'Source-backed' : 'Not held'}</span>
      </div>

      {!isObservation ? (
        /* THE ABSENCE, WITH ITS REASON. Never an em-dash on its own. */
        <p data-econ="retained-observation-absence" style={{ margin: 0, fontSize: 13, color: ECON_INK.secondary }}>
          {read.kind === 'UNAVAILABLE'
            ? ECONOMY_READ_ABSENCE_TEXT[read.reason]
            : ECONOMY_READ_ABSENCE_TEXT.NO_DISPLAYABLE_OBSERVATION}
        </p>
      ) : (
        (() => {
          const o = read.observations[0]!;
          const p = o.provenance;
          return (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 }}>
                <span
                  data-econ="retained-observation-value"
                  style={{ fontSize: 30, lineHeight: 1.1, color: ECON_INK.primary, fontVariantNumeric: 'tabular-nums' }}
                >
                  {o.value}
                  {/*
                    LOGICAL, NOT PHYSICAL. `marginLeft` here was a real RTL defect the Economy
                    layout guard caught — and this comment was a SECOND one: written
                    without braces it was not a comment at all, it was a JSX text child,
                    so the panel printed its own source code beside the figure.
                  */}
                  <span style={{ fontSize: 16, marginInlineStart: 3 }}>
                    {o.unit === 'PERCENT' ? '%' : ` ${o.unit}`}
                  </span>
                </span>
                <span style={{ fontSize: 13, color: ECON_INK.primary }}>
                  {o.seriesLabel}
                  {o.geographyLabel === '' ? '' : ` · ${o.geographyLabel}`}
                </span>
              </div>

              <dl
                data-econ="retained-observation-provenance"
                style={{
                  margin: 0,
                  display: 'grid',
                  /* Two columns on a desktop frame, one at compact width. */
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '2px 16px',
                  fontSize: 11,
                  color: ECON_INK.secondary,
                }}
              >
                <Row label="Reference period" value={p.referencePeriod} />
                <Row label="Published" value={p.publicationDateStated} />
                <Row label="Source" value={p.institution} />
                <Row label="Licence" value={p.licence} />
                <Row label="Index base" value={p.basePeriod} />
                <Row label="Edition language" value={p.sourceLanguage} />
                <Row label="Artifact" value={`sha256 ${p.contentAddress.slice(0, 12)}…`} />
                <Row label="Read by" value={`${p.parserId} ${p.parserVersion} · ${p.extractorId}`} />
              </dl>
            </>
          );
        })()
      )}
    </section>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
      <dt style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>{label}</dt>
      <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{value}</dd>
    </div>
  );
}
