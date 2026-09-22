import { SpecialistHudLine } from '@/components/specialist/SpecialistHudLine';
import { ReturnControl } from '@/components/navigation/ReturnControl';
import type { PoliticsReadResponse } from '@globalnews-ai/shared';
import type { ReadResult } from '@/lib/evidence/retainedReaders';
import { resolvePolStrings } from '@/lib/politics/politicsStrings';

export function PoliticsEvidenceScreen({
  locale,
  result,
}: {
  locale: 'en' | 'pl';
  result: ReadResult<PoliticsReadResponse>;
}) {
  const t = (en: string, pl: string) => (locale === 'pl' ? pl : en);
  const strings = resolvePolStrings(locale).strings;
  const subjectTypes =
    locale === 'pl'
      ? {
          ELECTION: 'Wybory',
          LEGISLATIVE_SUBJECT: 'Proces legislacyjny',
          PROTEST_CAMPAIGN: 'Protest / kampania mobilizacyjna',
        }
      : strings.subjectTypes;
  const data = result.status === 'READ' ? result.data : null;
  return (
    <main
      data-evidence="politics"
      className="min-h-screen bg-sp-bg p-4 pb-28 text-sp-ink md:p-7 md:pb-28"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-5 break-words">
        <header>
          <ReturnControl language={locale} variant="microline" />
          <h1 className="text-xl font-semibold">
            {t('Politics · evidence coverage', 'Polityka · zakres materiałów')}
          </h1>
          <p className="mt-2">
            {t(
              'A lack of governed evidence does not mean nothing happened.',
              'Brak materiałów dopuszczonych do użycia nie oznacza, że nic się nie wydarzyło.',
            )}
          </p>
        </header>
        <SpecialistHudLine
          domain="POLITICS"
          line={{
            MODE: { value: t('Politics', 'Polityka') },
            STATE: {
              value: data?.observations.length
                ? t('Retained evidence', 'Zachowane materiały')
                : t('Not assessed', 'Nie oceniono'),
            },
          }}
        />
        <section
          className="border border-sp-line bg-sp-panel p-4"
          data-politics-state={!data ? 'UNAVAILABLE' : (data.absence ?? 'EVIDENCE')}
        >
          <h2>
            {!data
              ? t('Retained ledger could not be checked', 'Nie można sprawdzić rejestru')
              : data.absence === 'EVIDENCE_WITHHELD'
                ? t(
                    'Evidence withheld by governance checks',
                    'Materiały wstrzymane po kontroli zasad',
                  )
                : data.observations.length === 0
                  ? t(
                      'No governed evidence retained',
                      'Brak zachowanych materiałów dopuszczonych do użycia',
                    )
                  : t(
                      'Governed retained observations',
                      'Zachowane obserwacje dopuszczone do użycia',
                    )}
          </h2>
          <p className="mt-2 text-sm">
            {data
              ? t(
                  'Checked: the versioned Politics capture ledger through the governed retained reader. Generic news is not automatically admitted. No acquisition runs on this page.',
                  'Sprawdzono: wersjonowany rejestr materiałów Polityki przez czytnik kontrolujący dopuszczenie. Wiadomości ogólne nie są automatycznie dopuszczane. Ta strona nie uruchamia pozyskiwania danych.',
                )
              : t(
                  'The reader did not return a valid response. Retention and coverage remain unknown.',
                  'Czytnik nie zwrócił poprawnej odpowiedzi. Stan zasobu i zakres pozostają nieznane.',
                )}
          </p>
          {data && (
            <p className="mt-2">
              {t('Observations returned', 'Zwrócone obserwacje')}: {data.observations.length}
              {data.truncated
                ? t(
                    ' · Partial response; additional retained observations exist.',
                    ' · Odpowiedź częściowa; istnieją dodatkowe zachowane obserwacje.',
                  )
                : ''}
            </p>
          )}
          {data?.coverage && (
            <p className="mt-2 text-sm">
              {t(
                'Captures checked / observations admitted',
                'Sprawdzone materiały / dopuszczone obserwacje',
              )}
              : {data.coverage.checkedCaptures} / {data.coverage.admittedObservations}
              {data.coverage.withheld
                ? t(
                    ' · Some evidence was withheld; coverage is incomplete.',
                    ' · Część materiałów wstrzymano; zakres jest niepełny.',
                  )
                : ''}
            </p>
          )}
          <p className="mt-2 text-sm">
            {t(
              'Jurisdiction: stated per source when retained; no country-wide or global coverage is implied.',
              'Jurysdykcja: podana przy źródle, jeśli ją zachowano; nie zakłada się zasięgu krajowego ani globalnego.',
            )}
          </p>
        </section>
        <section>
          <h2>{t('Supported subject types', 'Obsługiwane typy podmiotów')}</h2>
          <p>{Object.values(subjectTypes).join(' · ')}</p>
          <p className="mt-2 text-sm">
            {t(
              'Admissible source classes: official sources, news reporting and public data, after evidence and rights review. These are eligibility classes, not a claim that sources were captured.',
              'Dopuszczalne klasy źródeł: źródła urzędowe, doniesienia prasowe i dane publiczne, po kontroli materiału i praw. Są to klasy kwalifikujące się do przeglądu, nie potwierdzenie zachowania źródeł.',
            )}
          </p>
        </section>
        {data?.observations.map((o) => (
          <article
            key={o.observationKey}
            className="flex flex-col gap-2 border border-sp-line bg-sp-panel p-4"
          >
            <h2>
              {o.subjectId} · {subjectTypes[o.subjectType]}
            </h2>
            <p>
              {t('Source class / role', 'Klasa / rola źródła')}: {o.provenance.sourceType} ·{' '}
              {o.provenance.evidenceRole}
            </p>
            <p>
              {t('Source jurisdiction', 'Jurysdykcja źródła')}:{' '}
              {o.provenance.jurisdiction ?? t('Not retained', 'Nie zachowano')}
            </p>
            <p>
              {t(
                'Publisher statement; not an independent assessment',
                'Wypowiedź wydawcy; nie niezależna ocena',
              )}
            </p>
            <blockquote lang={o.provenance.language}>{o.claim.sourceText}</blockquote>
            <p>
              {t('Subject stage', 'Etap podmiotu')}: {o.claim.stage}
            </p>
            <p className="text-sm">
              {t('Attribute authorship', 'Autorstwo atrybutów')}:{' '}
              {o.attributeAuthorship.map((a) => a.attribute + ': ' + a.authorship).join(' · ')}
            </p>
            <p>
              {t('Publication / capture', 'Publikacja / zachowanie')}: {o.publishedAt} /{' '}
              {o.temporal.retrievedAt}
            </p>
            <p>
              {t('Source language', 'Język źródła')}: {o.provenance.language}
            </p>
            <a className="underline [overflow-wrap:anywhere]" href={o.sourceReference.sourceUrl}>
              {t('Original source', 'Źródło oryginalne')} · {o.identity.upstreamAuthority}
            </a>
          </article>
        ))}
        <p className="text-sm">
          {t(
            'Official records, reported claims, allegations and independent assessments are different evidence categories. A report is not a verified fact. No independent political assessment is supplied by this reader.',
            'Dokumenty urzędowe, doniesienia, zarzuty i niezależne oceny to różne kategorie materiałów. Doniesienie nie jest zweryfikowanym faktem. Ten czytnik nie dostarcza niezależnej oceny politycznej.',
          )}
        </p>
      </div>
    </main>
  );
}
