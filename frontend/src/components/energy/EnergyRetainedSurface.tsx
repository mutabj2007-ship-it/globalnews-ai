import type { EnergyReadResult } from '@globalnews-ai/shared';
import type { EnergyStrings } from '@/lib/energy/energyStrings';
import { energyHref, type EnergyUrlState } from '@/lib/energy/energyUrl';
import { ReturnControl } from '@/components/navigation/ReturnControl';
import { ENERGY_SURFACE, ENERGY_INK, ENERGY_LINE } from '@/lib/energy/energyTokens';

/** One coverage explanation; navigation never implies assessed subjects or flows. */
export function EnergyRetainedSurface({
  read,
  strings,
  urlState,
  locale,
}: {
  read: EnergyReadResult;
  strings: EnergyStrings;
  urlState: EnergyUrlState;
  locale: string;
}) {
  const pl = locale === 'pl';
  const explanation =
    read.kind === 'UNAVAILABLE'
      ? pl
        ? 'Nie można teraz odczytać zachowanych danych energii. Stan pokrycia pozostaje nieznany.'
        : 'Retained energy evidence cannot be read right now. Coverage is unknown.'
      : read.kind === 'EMPTY'
        ? pl
          ? 'Nie mamy jeszcze dopuszczonych danych o systemach, korytarzach ani obiektach energetycznych. Produkcja, moc, magazynowanie, awarie, przepływy i stan sieci pozostają niezmierzone.'
          : 'No admitted evidence is held for energy systems, corridors or assets yet. Generation, capacity, storage, outages, flows and grid conditions remain unmeasured.'
        : pl
          ? 'Pokazujemy wyłącznie zachowane fakty. Brakujące pomiary i oceny pozostają nieznane; aktualność względem ostatniej publikacji nie jest potwierdzona.'
          : 'Only retained facts are shown. Missing measurements and assessments remain unknown; the latest publisher edition is not verified.';
  return (
    <main
      lang={locale}
      data-energy-shell="retained"
      style={{
        minHeight: '100vh',
        background: ENERGY_SURFACE.void,
        color: ENERGY_INK.primary,
        padding: 'clamp(16px, 4vw, 40px)',
      }}
    >
      <div style={{ maxWidth: 1100, margin: 'auto', display: 'grid', gap: 24 }}>
        <ReturnControl language={locale} variant="microline" />
        <h1 style={{ margin: 0 }}>{pl ? 'Inteligencja energetyczna' : 'Energy Intelligence'}</h1>
        <nav
          aria-label={pl ? 'Widok energii' : 'Energy view'}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}
        >
          {(['spatial', 'change', 'flows'] as const).map((substrate) => (
            <a
              key={substrate}
              href={energyHref({ ...urlState, substrate, subject: null })}
              aria-current={urlState.substrate === substrate ? 'page' : undefined}
              style={{
                padding: '12px 16px',
                border: '1px solid ' + ENERGY_LINE.panel,
                color: ENERGY_INK.primary,
                background:
                  urlState.substrate === substrate ? ENERGY_SURFACE.chrome : 'transparent',
              }}
            >
              {strings.substrateCrumb[substrate]}
            </a>
          ))}
        </nav>
        <p
          data-energy-coverage={read.kind}
          role="status"
          style={{ margin: 0, maxWidth: '75ch', lineHeight: 1.7 }}
        >
          {explanation}
        </p>
        {read.observations.map((o) => (
          <article
            key={o.observationKey}
            style={{
              padding: 20,
              border: '1px solid ' + ENERGY_LINE.panel,
              overflowWrap: 'anywhere',
              display: 'grid',
              gap: 10,
            }}
          >
            <h2 style={{ margin: 0 }}>{o.subjectName}</h2>
            <span>
              {o.subjectType} · {o.geographyId} · {o.spatialPrecision}
            </span>
            <strong>
              {o.metric}: {o.value === null ? '—' : String(o.value)} {o.unit}
            </strong>
            <span>
              {pl ? 'Okres' : 'Period'}: {o.period} · {o.releaseStatus}
            </span>
            <span>
              {pl ? 'Źródło' : 'Source'}: {o.provenance.institution} ({o.provenance.providerId})
            </span>
            <span>
              {pl ? 'Zmiana publikacji' : 'Publisher change'}: {o.publisherChangedAt ?? '—'}
            </span>
            <span>
              {pl ? 'Zachowano' : 'Retained at'}: {o.provenance.retrievedAt}
            </span>
          </article>
        ))}
      </div>
    </main>
  );
}
