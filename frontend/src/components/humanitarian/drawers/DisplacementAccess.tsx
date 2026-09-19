'use client';

/**
 * H-04 · DISPLACEMENT AND ACCESS — and this frame IS the Beta default.
 *
 * Part X's own implementation record: "This frame is itself the degraded geographic
 * state and is the Beta default." Route geometry is unsupported and
 * `PRODUCIBLE_ROUTE_GEOMETRY` is false, so displacement is NAMED ENDPOINTS ONLY —
 * no path, no corridor arrow, no interpolated line, at any renderer resolution.
 *
 * ACCESS IS ITS OWN AXIS, with its own revision and its own cause reference, and the
 * cause is REFERENCED to Conflict or Security rather than adjudicated here. R08:
 * "Access can be open while need is critical."
 */
import type { JSX } from 'react';
import { HUM_INK, HUM_LINE, HUM_TYPE } from '@/lib/humanitarian/humTokens';
import { Absence, AreaLabel, Chip, Dependency, SectionTitle, microLabel, panelEdge } from '../HumParts';
import type { HumStrings } from '@/lib/humanitarian/humStrings';
import type { HumSituationView } from '../HumanitarianModel';

export function DisplacementAccess({ view, t }: { view: HumSituationView; t: HumStrings }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <section data-hum="displacement" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <SectionTitle note={`${t.spatial.namedEndpointsOnly} · ${t.spatial.noRouteGeometry}`}>
          Displacement
        </SectionTitle>
        <Absence reason="NO_VALIDATED_BASELINE" t={t}
          note="These would be periodic estimates between named areas, not observed journeys. No arrow is drawn even when figures exist." />
      </section>

      <section data-hum="access" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <SectionTitle note={t.access.ownAxis}>{t.access.title}</SectionTitle>
        <div style={{ border: panelEdge, display: 'flex', flexDirection: 'column' }}>
          {/*
            THIS RENDERER USED TO DROP `row.absence` ENTIRELY while `Absence` rendered it
            elsewhere — one field, two renderers, opposite behaviour, and no decision
            anywhere in the candidate about which was intended. It is decided here: the
            reason renders. Safe-by-omission is safe only until the next renderer, and a
            dropped reason is the calm blank this domain exists to refuse.
          */}
          {view.access.map((row, i) => (
            <div
              key={`${row.area.name}-${row.area.precision}-${i}`}
              data-hum="access-row"
              data-hum-access={row.condition}
              style={{
                padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'baseline',
                justifyContent: 'space-between', flexWrap: 'wrap',
                borderTop: i === 0 ? 'none' : `1px solid ${HUM_LINE.hairline}`,
              }}
            >
              <AreaLabel area={row.area} precision={view.precision} t={t} />
              <Chip label="" value={t.access[row.condition]} />
              {row.absence !== null && (
                <span style={{ flex: '1 0 100%' }}>
                  <Absence reason={row.absence} t={t} />
                </span>
              )}
            </div>
          ))}
        </div>
        <span style={{ ...microLabel, color: HUM_INK.tertiary }}>{t.access.notAssessedIsNotOpen}</span>
      </section>

      {/*
        SENSITIVE-LOCATION PROTECTION.
        What is stated: that protection is on, and that a shared contract is missing.
        What is NEVER stated: a coordinate, a radius, a protected class, a site name,
        or a count of protected sites. There is no control here that reveals anything,
        because no such control exists at any role — and the guard asserts the
        vocabulary for one is absent from the whole domain.
      */}
      <section data-hum="sensitive-location" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <SectionTitle note={t.sensitive.protectionOn}>{t.sensitive.title}</SectionTitle>
        <span style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary, lineHeight: 'var(--ar-lh, 1.45)' }}>
          {t.sensitive.noReveal}
        </span>
        <Dependency t={t} text={view.sensitive.dependency} />
      </section>

      <span style={{ ...microLabel, color: HUM_INK.tertiary }}>{t.spatial.degraded} · {t.spatial.notAvailable}</span>
    </div>
  );
}
