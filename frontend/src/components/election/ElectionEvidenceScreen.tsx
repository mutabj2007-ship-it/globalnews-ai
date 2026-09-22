import { ReturnControl } from '@/components/navigation/ReturnControl';
import type { ElectionReadResponse } from '@/lib/election/electionRead';
import type { ReadResult } from '@/lib/evidence/retainedReaders';

export function ElectionEvidenceScreen({
  locale,
  compact,
  result,
}: {
  locale: 'en' | 'pl';
  compact: boolean;
  result: ReadResult<ElectionReadResponse>;
}) {
  const t = (en: string, pl: string) => (locale === 'pl' ? pl : en);
  const data = result.status === 'READ' ? result.data : null;
  return (
    <main
      data-evidence="election"
      data-layout={compact ? 'phone' : 'desktop'}
      className="min-h-screen bg-sp-bg p-4 pb-28 text-sp-ink md:p-7 md:pb-28"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-5 break-words">
        <header>
          <ReturnControl language={locale} variant="microline" />
          <h1 className="text-xl font-semibold">
            {t('Kenya · retained election evidence', 'Kenia · zachowane materiały wyborcze')}
          </h1>
          <p className="mt-2 text-sm">
            {t(
              'Coverage is limited to the places and events identified in each record. This is not national election coverage.',
              'Zakres obejmuje wyłącznie miejsca i wydarzenia wskazane w rekordach. To nie jest przegląd wyborów w całym kraju.',
            )}
          </p>
        </header>
        {!data ? (
          <p role="status">
            {t(
              'Evidence reader unavailable. Holdings could not be checked; this is not evidence of no election activity.',
              'Czytnik materiałów jest niedostępny. Nie można sprawdzić zasobu; nie oznacza to braku aktywności wyborczej.',
            )}
          </p>
        ) : data.state === 'COVERAGE_GAP' ? (
          <section
            data-evidence-state={data.reason ?? 'COVERAGE_GAP'}
            className="border border-sp-line p-4"
          >
            <h2>
              {data.reason === 'READER_DISABLED'
                ? t('Public evidence reader is off', 'Publiczny czytnik materiałów jest wyłączony')
                : t(
                    'No evidence available from this read',
                    'Brak materiałów dostępnych w tym odczycie',
                  )}
            </h2>
            <p className="mt-2 text-sm">
              {t(
                'No contestant list or result is inferred. A closed or withheld reader does not mean the retained archive is empty.',
                'Nie wywnioskowano listy kandydatów ani wyniku. Wyłączony czytnik lub wstrzymany odczyt nie oznacza pustego archiwum.',
              )}
            </p>
          </section>
        ) : (
          data.records.map((r) => (
            <article
              key={r.id}
              data-evidence-state={r.kind}
              className="flex flex-col gap-3 border border-sp-line bg-sp-panel p-4"
            >
              <h2 className="text-lg">{r.election.publisherEventLabel}</h2>
              <p>
                {r.label} · <code>{r.kind}</code>
              </p>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt>{t('Geography', 'Geografia')}</dt>
                  <dd>
                    {r.election.administrativeGeography
                      .map((g) => `${g.label}${g.officialCode ? ` (${g.officialCode})` : ''}`)
                      .join(' · ')}
                  </dd>
                </div>
                <div>
                  <dt>{t('Event identity / office', 'Identyfikator wydarzenia / urząd')}</dt>
                  <dd>
                    {r.election.eventId} ·{' '}
                    {r.election.electivePosition ?? t('Not stated', 'Nie podano')}
                  </dd>
                </div>
                <div>
                  <dt>{t('Election date', 'Data wyborów')}</dt>
                  <dd>{r.election.electionDate ?? t('Not stated', 'Nie podano')}</dd>
                </div>
                <div>
                  <dt>{t('Authority / source language', 'Organ / język źródła')}</dt>
                  <dd>
                    {r.source.publisher} · {r.sourceLanguage}
                  </dd>
                </div>
                <div>
                  <dt>
                    {t(
                      'Declaration date (not a publication date)',
                      'Data ogłoszenia (nie data publikacji)',
                    )}
                  </dt>
                  <dd>{r.declaredAt ?? t('Not stated', 'Nie podano')}</dd>
                </div>
                <div>
                  <dt>{t('Publication date', 'Data publikacji')}</dt>
                  <dd>{t('Not separately retained', 'Nie zachowano oddzielnie')}</dd>
                </div>
                <div>
                  <dt>{t('Captured at', 'Czas zachowania')}</dt>
                  <dd>{r.capturedAt}</dd>
                </div>
              </dl>
              {r.publisherStatus && <p>{r.publisherStatus}</p>}
              {r.kind === 'OFFICIAL_DECLARATION' && (
                <section>
                  <h3>
                    {t(
                      'Person declared elected by the authority',
                      'Osoba ogłoszona przez organ jako wybrana',
                    )}
                  </h3>
                  <p>
                    {r.declaredPerson?.ballotName} · {r.declaredPerson?.partyAsPublished}
                  </p>
                  {r.qualifiedReading && <p>{r.qualifiedReading}</p>}
                </section>
              )}
              {r.kind === 'FORM_AVAILABLE' && (
                <p>
                  {r.availability} · {r.documentRole}
                </p>
              )}
              {r.kind === 'FORM_REPORTED' && (
                <p>
                  {r.label} · {r.reported} / {r.total} · {r.unitLabel}
                </p>
              )}
              {r.kind === 'TALLY_OBSERVATION' && (
                <section>
                  <p>
                    {r.publisherStatedAt} · {r.scope?.reported} / {r.scope?.total} ·{' '}
                    {r.scope?.unitLabel}
                  </p>
                  {r.readings?.map((reading, i) => (
                    <p key={i}>
                      {reading.candidateBallotName} · {reading.partyAsPublished} ·{' '}
                      {reading.qualifiedReading}
                    </p>
                  ))}
                </section>
              )}
              <a
                className="underline [overflow-wrap:anywhere]"
                href={r.source.url}
                target="_blank"
                rel="noreferrer"
              >
                {t('Original document', 'Dokument źródłowy')} · {r.citation.locator}
              </a>
              <blockquote lang={r.sourceLanguage} className="text-sm">
                {r.citation.statement}
              </blockquote>
              <details className="text-sm">
                <summary>
                  {t('Retained document reference', 'Identyfikator zachowanego dokumentu')}
                </summary>
                <p className="[overflow-wrap:anywhere]">SHA-256: {r.source.artifactSha256}</p>
              </details>
              <p className="text-sm">
                {t(
                  'Source wording is preserved. This record does not establish a complete contestant list, national totals, or polling-station coverage. Evidence states are distinct and are never promoted into one another.',
                  'Zachowano brzmienie źródła. Ten rekord nie stanowi pełnej listy kandydatów, sum krajowych ani danych ze wszystkich lokali. Stany dowodowe są odrębne i nie są automatycznie zmieniane.',
                )}
              </p>
            </article>
          ))
        )}
        <section className="text-sm">
          <h2>{t('Evidence states', 'Stany dowodowe')}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            <li>
              FORM_AVAILABLE —{' '}
              {t('a form exists; no result implied', 'formularz istnieje; nie oznacza wyniku')}
            </li>
            <li>
              FORM_REPORTED —{' '}
              {t(
                'reported form coverage with its denominator',
                'zgłoszony zakres formularzy z mianownikiem',
              )}
            </li>
            <li>
              TALLY_OBSERVATION —{' '}
              {t(
                'a time-bounded, qualified tally observation',
                'ograniczona czasowo, opisana obserwacja zliczania',
              )}
            </li>
            <li>
              OFFICIAL_DECLARATION —{' '}
              {t(
                'the authority’s declaration for the specified event',
                'ogłoszenie organu dla wskazanego wydarzenia',
              )}
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
