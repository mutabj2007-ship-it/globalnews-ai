'use client';

/**
 * H-10 · CROSS-DOMAIN, ASK AND DEEP ANALYSIS — priced, and disabled honestly.
 *
 * R15's degraded rule is written for exactly this case, verbatim: "if no cost
 * estimate is available the control is disabled and reads COST UNAVAILABLE — CANNOT
 * INVOKE. It never falls back to invoking without a stated price."
 *
 * MEASURED: the Ask module is four files — two contracts, two specs — with no
 * service, controller or registration, and no route owns it. `/workspace` is a
 * capability catalogue, not a runtime. So Deep Analysis is DISABLED WITH A REASON
 * rather than wired to nothing, and it is not a dead button: it states why.
 *
 * CROSS-DOMAIN IS A COUNT, NOT A CARD. `SituationModule` is registered nowhere and
 * the Part V reference renderer is unmounted, so a reference card here would be
 * fabricated. The count is honest; a card would not be.
 */
import type { JSX } from 'react';
import { HUM_INK, HUM_LICENSED, HUM_LINE, HUM_TYPE } from '@/lib/humanitarian/humTokens';
import { HUM_HIT_TARGET_PX } from '@/lib/humanitarian/humConfig';
import { Dependency, SectionTitle, microLabel } from '../HumParts';
import type { HumStrings } from '@/lib/humanitarian/humStrings';
import type { HumSituationView } from '../HumanitarianModel';

export function AnalysisHandoff({ view, t }: { view: HumSituationView; t: HumStrings }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <SectionTitle note={t.analysis.storedFree}>{t.analysis.title}</SectionTitle>

      <button
        type="button"
        data-hum="deep-analysis"
        data-hum-cost="unavailable"
        disabled
        aria-disabled="true"
        title={t.analysis.costUnavailable}
        style={{
          minHeight: `${HUM_HIT_TARGET_PX}px`, padding: '0 14px', alignSelf: 'flex-start',
          background: 'transparent', border: `1px solid ${HUM_LICENSED.sand}`, color: HUM_INK.tertiary,
          cursor: 'not-allowed', fontSize: HUM_TYPE.monoMeta, textTransform: 'uppercase',
        }}
      >
        {t.analysis.deepAnalysis} — {t.analysis.costUnavailable}
      </button>

      <section data-hum="cross-domain" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <SectionTitle note={t.analysis.referenceCountOnly}>{t.analysis.crossDomain}</SectionTitle>
        <span data-hum="cross-domain-count" style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary }}>
          {t.common.noData}
        </span>
        <span style={{ ...microLabel, color: HUM_INK.tertiary, borderTop: `1px solid ${HUM_LINE.hairline}`, paddingTop: '8px' }}>
          Humanitarian never adjudicates cause. A confirmed consequence may sit beside a disputed cause owned by another domain.
        </span>
      </section>

      <Dependency t={t} text="Ask AI is contracts only — no service, controller or registration, and no route owns it. Cross-domain situation identity requires SituationModule, which is registered in no backend module, and the Part V reference renderer is unmounted." />
    </div>
  );
}
