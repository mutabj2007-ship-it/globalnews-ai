'use client';

/**
 * H-03 · AFFECTED POPULATION AND NEED PROFILE — degraded.
 *
 * The design draws two population estimates here and marks them NOT COMPARABLE. On
 * today's contracts there are NO estimates, so the frame shows the SLOTS and their
 * reasons. That is the difference between "we have nothing" and "there is nothing".
 *
 * EVERY SECTOR IS LISTED. A sector omitted reads as one that does not matter, and
 * NOT ASSESSED gets its own treatment — never a zero, never an empty ramp step.
 */
import type { JSX } from 'react';
import { HUM_INK, HUM_LINE, HUM_TYPE } from '@/lib/humanitarian/humTokens';
import { Absence, Chip, Dependency, SectionTitle, microLabel, panelEdge } from '../HumParts';
import type { HumStrings } from '@/lib/humanitarian/humStrings';
import type { HumSituationView } from '../HumanitarianModel';

export function PopulationNeed({ view, t }: { view: HumSituationView; t: HumStrings }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <section data-hum="population" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <SectionTitle note="Aggregate · no individual records">Affected population</SectionTitle>
        <Absence reason="NO_VALIDATED_BASELINE" t={t}
          note="No estimate is shown because none is published for this scope. An unpublished estimate is not a zero." />
        {/*
          F T-B2 — THE REASON IS READ FROM THE MODEL, NOT WRITTEN HERE.

          This was `reason="RIGHTS_RESTRICTED"` while `ownerNamed` beside it came from
          `view.rights`. Half the sentence tracked the state and half was a literal, so the
          two could disagree with nothing to catch it. `RIGHTS_UNAVAILABLE` is "we cannot
          show it at all" and `RIGHTS_RESTRICTED` is "we can show it, coarser" — only the
          first carries "may exist", only the second mentions precision, and rendering
          either from a literal makes the sentence independent of the state it describes.
        */}
        <Absence reason={view.rights.reason} t={t} note={view.rights.ownerNamed} />
      </section>

      <section data-hum="need-by-sector" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <SectionTitle note={`${t.need.noComposite} · ${t.need.perAreaPerMethod}`}>{t.need.title}</SectionTitle>
        <div style={{ border: panelEdge }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 140px', gap: '1px',
            background: HUM_LINE.hairline,
          }}>
            <span style={{ ...microLabel, background: HUM_INK.inverted, padding: '8px 10px' }}>{t.need.sector}</span>
            <span style={{ ...microLabel, background: HUM_INK.inverted, padding: '8px 10px' }}>{t.need.level}</span>
            {view.sectors.map((row) => (
              <div key={row.sector} style={{ display: 'contents' }}>
                <span
                  data-hum="sector-name"
                  style={{ background: HUM_INK.inverted, padding: '10px', fontSize: HUM_TYPE.body, color: HUM_INK.secondary }}
                >
                  {t.sectors[row.sector]}
                </span>
                <span
                  data-hum="sector-level"
                  data-hum-need-level={row.level}
                  style={{ background: HUM_INK.inverted, padding: '10px' }}
                >
                  <Chip label="" value={t.needLevels[row.level]} />
                </span>
              </div>
            ))}
          </div>
        </div>
        <span style={{ ...microLabel, color: HUM_INK.tertiary }}>
          {t.coverage.notZeroNeed}
        </span>
      </section>

      <Dependency t={t} text="Comparability flag on measures, and the Assessment Revision schema, are shared contracts that do not exist. Until they do, no two estimates may share an axis and no revision may be cited." />
    </div>
  );
}
