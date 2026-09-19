'use client';

/**
 * H-07 · WATCH CONFIGURATION — shown, and honestly inactive.
 *
 * MINT IS THE ONLY LICENSED COLOUR ON THIS FRAME, and it marks Watch and nothing else.
 * Monitoring is never metered — 0 SAND, including the quiet-result payload.
 *
 * WHAT IS SHOWN VS WHAT IS BOUND. The Humanitarian triggers — access revision and
 * coverage-state movement — must be REGISTERED against the shared Watch vocabulary,
 * which is Main's additive mutation and has not landed. So the triggers are shown and
 * the binding is stated inactive. That is the accepted Economy DEP-3 posture, in its
 * own words: "A disabled truthful control is better than a local alert subsystem that
 * appears to work."
 *
 * COMPOSITE SCOPE IS DISABLED BY MEASURED LITERAL, not by assumption: canonical
 * `COMPOSITE_SCOPE_AVAILABILITY` reads 'UNAVAILABLE_PENDING_UPSTREAM'.
 */
import type { JSX } from 'react';
import { HUM_INK, HUM_LICENSED, HUM_LINE, HUM_TYPE } from '@/lib/humanitarian/humTokens';
import { HUM_HIT_TARGET_PX } from '@/lib/humanitarian/humConfig';
import { Dependency, SectionTitle, microLabel, panelEdge } from '../HumParts';
import { quietClaimFor } from '@/lib/humanitarian/humDegraded';
import type { HumStrings } from '@/lib/humanitarian/humStrings';
import type { HumSituationView } from '../HumanitarianModel';

const TRIGGERS = [
  'Material change in the humanitarian assessment',
  'Access condition revision in any area in scope',
  'Coverage state moves in either direction',
  'Restoration or improvement — delivered like any other change',
] as const;

export function WatchConfig({ view, t }: { view: HumSituationView; t: HumStrings }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <SectionTitle note="Persistent subjects only">Scope</SectionTitle>
        <div style={{ border: panelEdge, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary }}>This humanitarian situation</span>
            <span style={{ ...microLabel, color: HUM_LICENSED.mint }}>Available scope</span>
          </div>
          <div
            data-hum="composite-scope"
            data-hum-available="false"
            style={{
              padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px',
              borderTop: `1px solid ${HUM_LINE.hairline}`, opacity: 0.55,
            }}
          >
            <span style={{ fontSize: HUM_TYPE.body, color: HUM_INK.tertiary }}>
              Composite scope — e.g. EU-27, Great Lakes
            </span>
            <span style={{ ...microLabel }}>{t.watch.compositeUnavailable}</span>
            <span style={{ ...microLabel, letterSpacing: '0.06em' }}>{view.composite.degradedPath}</span>
          </div>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <SectionTitle note={t.watch.triggersInactive}>Triggers</SectionTitle>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {TRIGGERS.map((trigger) => (
            <li key={trigger} data-hum="watch-trigger" data-hum-bound="false"
              style={{ fontSize: HUM_TYPE.body, color: HUM_INK.tertiary }}>
              {trigger}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/*
          THE SECTION HEADING WAS 'Quiet result — checked, no material change'. Triggers
          are inactive, no Watch has ever run, and nothing was checked — so the heading
          resolves from the same claim the QUIET frame uses rather than asserting one of
          its own. The note below it is the design rule, which stands either way.
        */}
        <SectionTitle note="A Watch that reports nothing must be distinguishable from one that is broken">
          {t.quietFrame[quietClaimFor(view.change)]}
        </SectionTitle>
        <span style={{ ...microLabel, color: HUM_INK.tertiary }}>
          No urgency treatment · no amber · no count badge
        </span>
      </section>

      <button
        type="button"
        data-hum="watch-save"
        disabled
        aria-disabled="true"
        title={t.watch.triggersInactive}
        style={{
          minHeight: `${HUM_HIT_TARGET_PX}px`, padding: '0 14px', alignSelf: 'flex-start',
          background: 'transparent', border: `1px solid ${HUM_LINE.border}`, color: HUM_INK.tertiary,
          cursor: 'not-allowed', fontSize: HUM_TYPE.monoMeta, textTransform: 'uppercase',
        }}
      >
        Save watch — binding not active
      </button>

      <Dependency t={t} text="Humanitarian trigger registration (access revision, coverage-state movement) is an additive mutation to the shared Watch vocabulary and is Main's. No Humanitarian-local monitor is built." />
      <span style={{ ...microLabel, color: HUM_INK.tertiary }}>{t.watch.notMetered}</span>
    </div>
  );
}
