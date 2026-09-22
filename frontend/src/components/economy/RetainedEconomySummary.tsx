import type { JSX } from 'react';
import type { RetainedObservation } from '@/lib/economy/economyObservationRead';
import type { EconomyLocale } from '@/lib/economy/strings';

/** The admitted single-period read. Disclosure is native HTML and makes no AI calls. */
export function RetainedEconomySummary({ observation, locale }: {
  observation: RetainedObservation; locale: EconomyLocale;
}): JSX.Element {
  const pl = locale === 'pl';
  const p = observation.provenance;
  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 10 }).format(observation.value);
  const period = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${observation.periodId}-01T00:00:00Z`));
  const fields = [
    [pl ? 'Źródło' : 'Source', p.institution],
    [pl ? 'Okres odniesienia' : 'Reference period', p.referencePeriod],
    [pl ? 'Data publikacji' : 'Published', p.publicationDateStated],
    [pl ? 'Data zachowania' : 'Retrieved', p.retrievedAt],
    [pl ? 'Język źródła' : 'Source language', p.sourceLanguage],
    [pl ? 'Podstawa indeksu' : 'Index base', p.basePeriod],
    [pl ? 'Licencja' : 'Licence', p.licence],
    ['SHA256', p.contentAddress],
    [pl ? 'Parser i ekstraktor' : 'Parser and extractor', `${p.parserId} ${p.parserVersion} · ${p.extractorId} ${p.extractorVersion}`],
  ];
  return <article data-econ="retained-summary" lang={locale} className="min-h-screen bg-sp-bg p-[16px] text-sp-ink md:p-[28px]">
    <div className="mx-auto flex max-w-[960px] flex-col gap-[20px]">
      <header className="space-y-[8px]">
        <h1 className="text-[22px] font-medium">{pl ? 'Gospodarka — potwierdzona obserwacja' : 'Economy — supported observation'}</h1>
        <p className="text-[14px] text-sp-ink-2"><span lang={p.sourceLanguage}>{observation.geographyLabel}</span> · {pl ? 'Najnowszy zachowany okres' : 'Latest retained period'}: <time dateTime={observation.periodId}>{period}</time></p>
      </header>
      <section aria-label={pl ? 'Obserwacja CPI' : 'CPI observation'} className="space-y-[12px] border border-sp-line bg-sp-panel p-[16px]">
        <h2 className="text-[16px]">{pl ? 'Ceny konsumpcyjne (CPI), zmiana rok do roku' : 'Consumer prices (CPI), year-on-year change'}</h2>
        <p data-econ="retained-value" className="text-[36px] leading-[1.2]">{value}{observation.unit === 'PERCENT' ? '%' : ` ${observation.unit}`}</p>
        <p className="text-[14px] leading-[1.6]">{pl ? 'Zmiana poziomu cen konsumpcyjnych względem tego samego miesiąca poprzedniego roku.' : 'Change in consumer prices compared with the same month of the previous year.'}</p>
        <p className="text-[14px] leading-[1.6]"><span lang={p.sourceLanguage}>{p.institution}</span> · {pl ? 'Opublikowano' : 'Published'} <time dateTime={p.publicationDateStated}>{p.publicationDateStated}</time></p>
        <p className="text-[14px] leading-[1.6]">{pl ? 'Jeden zachowany okres / trend nieustalony. To najnowsza obserwacja dostępna tutaj, nie potwierdzenie bieżącego poziomu cen.' : 'One retained period / trend not established. This is the latest observation held here, not confirmation of current price levels.'}</p>
        <div className="flex flex-wrap gap-[16px] text-[14px]">
          <a href="#economy-evidence" className="inline-flex min-h-[44px] items-center underline">{pl ? 'Zobacz dowód i źródło' : 'View evidence and source'}</a>
          {p.sourceUrl && <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center underline">{pl ? 'Otwórz dokument źródłowy' : 'Open source document'} ↗</a>}
        </div>
      </section>
      <section className="space-y-[8px] text-[14px] leading-[1.6]">
        <h2 className="text-[16px] font-medium">{pl ? 'Granice dostępnych danych' : 'What is missing'}</h2>
        <p>{pl ? 'Brak dodatkowych dopuszczonych obserwacji PKB, kursów walut, długu, stopy procentowej, handlu i zatrudnienia w tym widoku. Nie można porównać okresów ani ustalić trendu CPI.' : 'No additional admitted GDP, foreign exchange, debt, policy rate, trade or employment observations are available in this view. Period comparisons and a CPI trend cannot be established.'}</p>
      </section>
      <section id="economy-evidence" tabIndex={-1} className="space-y-[12px] border-t border-sp-line pt-[16px]">
        <h2 className="text-[16px] font-medium">{pl ? 'Dowód i pochodzenie danych' : 'Evidence and provenance'}</h2>
        <p lang={p.sourceLanguage} className="text-[14px]">{observation.seriesLabel} · {observation.geographyLabel}</p>
        <dl className="grid grid-cols-1 gap-[12px] text-[14px] sm:grid-cols-2">
          {fields.map(([label, content]) => <div key={label} className="min-w-0">
            <dt className="text-sp-ink-3">{label}</dt><dd className="break-words" lang={p.sourceLanguage}>{content}</dd>
          </div>)}
        </dl>
        {!p.sourceUrl && <p className="text-[14px]">{pl ? 'Adres dokumentu nie jest dostępny w tym odczycie; powyżej podano zachowane dane źródłowe.' : 'The document URL is unavailable in this read; retained provenance is shown above.'}</p>}
      </section>
    </div>
  </article>;
}
