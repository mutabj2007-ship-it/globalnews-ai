'use client';

/**
 * H-05 · EVIDENCE AND COMPETING READINGS — degraded.
 *
 * NEITHER READING IS EVER PROMOTED, and on today's contracts there are no readings
 * to promote: the Evidence Artifact and Competing Readings shapes occur ZERO times
 * in shared/src, and the Part V renderer that would draw a cross-domain reading is
 * mounted by nothing. So this states the claim standing that IS on record and the
 * dependency that is not.
 *
 * A standing unverified claim is RECORDED AND SHOWN. R08: it "is recorded and never
 * converted into an assessment or a figure".
 */
import type { JSX } from 'react';
import { HUM_INK, HUM_TYPE } from '@/lib/humanitarian/humTokens';
import { Absence, Chip, Dependency, SectionTitle, microLabel } from '../HumParts';
import type { HumStrings } from '@/lib/humanitarian/humStrings';
import type { HumSituationView } from '../HumanitarianModel';

export function EvidenceReadings({ view, t }: { view: HumSituationView; t: HumStrings }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <section data-hum="claim-standing" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <SectionTitle note="Epistemic axis — about the claim, not the assessment">
          {t.standing[view.standing.standing]}
        </SectionTitle>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Chip label="Standing" value={t.standing[view.standing.standing]} />
          <Chip label="Confidence" value={t.confidence.NOT_APPLICABLE} />
        </div>
        {view.evidence.standingClaimOnRecord && (
          <span style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary, lineHeight: 'var(--ar-lh, 1.45)' }}>
            {t.standing.onRecordNotConverted}
          </span>
        )}
        <span style={{ ...microLabel, color: HUM_INK.tertiary }}>{t.standing.supersededUnavailable}</span>
      </section>

      <section data-hum="evidence-set" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <SectionTitle note="Originals, translation provenance and confidence travel with every artifact">
          Evidence set
        </SectionTitle>
        <Absence reason="NO_VALIDATED_BASELINE" t={t} />
        {/* F T-B2 — read from the model, not written here. See PopulationNeed. */}
        <Absence reason={view.rights.reason} t={t}
          note="A source may exist and be unusable. Rights and evidence are separate axes; collapsing them would let “we may not show it” read as “there is nothing”." />
      </section>

      <Dependency t={t} text="Evidence Artifact, Source and Competing Readings shapes do not exist in shared/src, and the Part V presentation components that would render a cross-domain reading are reachable from no application root." />
    </div>
  );
}
