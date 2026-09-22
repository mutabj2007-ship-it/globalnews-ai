'use client';

import { useState } from 'react';
import type { JSX } from 'react';
import { SpecialistHudLine } from '@/components/specialist/SpecialistHudLine';
import { HUD_LINE_PX } from '@/lib/specialist/hudGrammar';
import type { ImihigoView } from '@/lib/imihigo/retainedModel';
import type { DeliveryLocale } from '@/lib/delivery/deliveryStrings';
import { DEL_MICRO, Panel, Region, SubjectRow } from './DelParts';

/** Retained binding of H R2's four-region dashboard; shared tokens and neutral rows. */
export function ImihigoScreen({ view, compact, locale }: {
  view: ImihigoView; compact: boolean; locale: DeliveryLocale;
}): JSX.Element {
  const pl = locale === 'pl';
  const [search, setSearch] = useState('');
  const [entityClass, setEntityClass] = useState('all');
  const matches = (row: ImihigoView['current'][number]['records'][number]) =>
    (entityClass === 'all' || row.entityClass === entityClass) && row.entity.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale));
  const total = view.current.reduce((count, capture) => count + capture.records.length, 0);
  const shown = view.current.reduce((count, capture) => count + capture.records.filter(matches).length, 0);
  const t = pl ? {
    title: 'Imihigo — wyniki oceny', marker: 'Ocena NISR · zachowane dane źródłowe',
    note: 'Wyniki oficjalnej oceny NISR. GlobalNews AI nie oblicza ocen ani rankingów.',
    hud: 'Zakres oceny', commitments: 'Wskaźniki i cele', subjects: 'Oceniane jednostki', readings: 'Źródła i historia wersji',
    absent: 'Brak zachowanych danych. Brak danych nie oznacza słabych wyników.',
    missing: 'W zachowanym zestawie nie ma celów ani wskaźników przypisanych do poszczególnych jednostek.',
    coverage: '27 dystryktów oraz miasto Kigali wraz z podległymi dystryktami. Brak ocen poszczególnych ministerstw i rad w tym zestawie.',
    order: 'Alfabetycznie · bez rankingu produktu', evidence: 'Dowód źródłowy', source: 'Dokument źródłowy',
    evaluation: 'Ocena', captured: 'Data zachowania', language: 'Język źródła',
    revision: 'Wersja', original: 'Pierwsza zachowana publikacja; numer wersji wydawcy niepodany',
    noReadings: 'Brak dodatkowych zachowanych interpretacji.', target: 'Cel', indicator: 'Wskaźnik',
    unsupported: 'Niepodany w zachowanym zestawie',
  } : {
    title: 'Imihigo — evaluation results', marker: 'NISR evaluation · retained source evidence',
    note: 'Official NISR evaluation results. GlobalNews AI does not calculate scores or rankings.',
    hud: 'Evaluation scope', commitments: 'Indicators and targets', subjects: 'Evaluated entities', readings: 'Sources and revision history',
    absent: 'No retained evidence. Missing evidence does not imply underperformance.',
    missing: 'Entity-level targets and indicators are not available in this retained selection.',
    coverage: '27 districts and the City of Kigali with its affiliated districts. Individual ministry and board scores are not admitted in this selection.',
    order: 'Alphabetical · no product ranking', evidence: 'Source evidence', source: 'Source document',
    evaluation: 'Evaluation', captured: 'Captured', language: 'Source language',
    revision: 'Revision', original: 'First retained publication; publisher revision number not stated',
    noReadings: 'No additional retained interpretations.', target: 'Target', indicator: 'Indicator',
    unsupported: 'Not stated in retained selection',
  };
  return (
    <div data-del-shell={compact ? 'compact' : 'desktop'} data-del-order-reason="LEXICAL"
      className="flex min-h-screen flex-col gap-[18px] bg-sp-bg px-[16px] py-[18px] text-sp-ink-2 md:px-[28px]">
      <header className="flex flex-col gap-[8px]">
        <h1 className="text-[17px] font-medium leading-[1.3] text-sp-ink">{t.title}</h1>
        <p className={DEL_MICRO}>{t.marker}</p>
        {view.state === 'retained' && <div data-imihigo="summary" className="max-w-[80ch] space-y-[8px] text-[14px] leading-[1.6]">
          <p><strong>{view.current.map(c => c.reportPeriod).join(' · ')} · {total} {pl ? 'ocenianych jednostek' : 'evaluated entities'}</strong></p>
          <p>{t.coverage}</p>
          <p>{pl ? 'Imihigo to zobowiązania dotyczące wyników działań publicznych. Każda liczba jest oficjalnym wynikiem oceny NISR za podany okres.' : 'Imihigo are public performance commitments. Each number is an official NISR evaluation result for the stated period.'}</p>
          <p>{pl ? 'Dla dystryktów zachowano „Final Score”; źródłowa kolumna nie podaje jednostki. Wynik Kigali to łączna ocena miasta i podległych dystryktów, podana w %. Nie są to osobne oceny dystryktów Kigali. Jeden okres nie pozwala ustalić trendu.' : 'District values retain the source label “Final Score”; that source column states no unit. Kigali is a combined result for the city and affiliated districts, stated in %. It does not give separate scores for Kigali districts. One period cannot establish a trend.'}</p>
        </div>}
        <p className="max-w-[72ch] text-[12px] leading-[1.55] text-sp-ink-3">{t.note}</p>
      </header>
      <Region title={t.hud}>
        <Panel className="px-[10px]">
          <div style={{ height: `${HUD_LINE_PX}px` }} className="flex items-center">
            <SpecialistHudLine domain="DELIVERY" line={{ MODE: { value: 'IMIHIGO', amber: null }, SCOPE: { value: 'Rwanda', amber: null } }} />
          </div>
        </Panel>
        {view.current.map(capture => <p key={capture.captureId} className={DEL_MICRO}>
          {capture.reportPeriod} · {t.evaluation}: {capture.evaluationDate.value} ({capture.evaluationDate.precision}) · NISR
        </p>)}
        {view.state === 'empty' && <p data-imihigo="empty" className="text-[12px]">{t.absent}</p>}
      </Region>
      <Region title={t.commitments}>
        <Panel className="p-[12px]"><p className="text-[12px] leading-[1.55] text-sp-ink-3">{view.state === 'empty' ? t.absent : t.missing}</p></Panel>
      </Region>
      <Region title={t.subjects} note={t.order}>
        <div className="flex flex-wrap items-end gap-[12px] text-[14px]">
          <label className="flex min-w-0 flex-col gap-[4px]">{pl ? 'Szukaj jednostki' : 'Search entities'}
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} className="min-h-[44px] max-w-full border border-sp-line bg-sp-panel px-[10px] text-sp-ink" />
          </label>
          <label className="flex min-w-0 flex-col gap-[4px]">{pl ? 'Rodzaj jednostki' : 'Entity type'}
            <select value={entityClass} onChange={event => setEntityClass(event.target.value)} className="min-h-[44px] max-w-full border border-sp-line bg-sp-panel px-[10px] text-sp-ink">
              <option value="all">{pl ? 'Wszystkie jednostki' : 'All entities'}</option>
              <option value="district">{pl ? 'Dystrykty' : 'Districts'}</option>
              <option value="city-of-kigali">{pl ? 'Kigali — wynik łączny' : 'Kigali — combined result'}</option>
            </select>
          </label>
          <p role="status">{shown} / {total} {pl ? 'jednostek' : 'entities'}</p>
          {(search || entityClass !== 'all') && <button type="button" onClick={() => { setSearch(''); setEntityClass('all'); }} className="min-h-[44px] underline">{pl ? 'Wyczyść filtry' : 'Clear filters'}</button>}
        </div>
        {shown === 0 && view.state === 'retained' && <p>{pl ? 'Brak jednostek pasujących do filtrów.' : 'No entities match these filters.'}</p>}
        {view.current.map(capture => <Panel key={capture.captureId}>
          <ul data-del="subjects" className="flex flex-col">
            {capture.records.filter(matches).map(row => <SubjectRow key={row.entity} label={row.entity} state={`NISR · ${row.result.value}${row.result.unit ?? ''}`}>
              <p><span lang={capture.sourceLanguage}>{row.result.label}</span> · {capture.cycle} · {row.entityClass === 'district' ? (pl ? 'Dystrykt' : 'District') : (pl ? 'Kigali — wynik łączny' : 'Kigali — combined result')}</p>
              <details className="mt-[8px]">
                <summary className="cursor-pointer">{t.evidence}</summary>
                <p lang={capture.sourceLanguage}>{row.provenance.section} · PDF {row.provenance.pdfPage} / {row.provenance.printedPage}</p>
                {row.provenance.columnHeader && <p lang={capture.sourceLanguage}>{row.provenance.columnHeader}</p>}
                <blockquote lang={capture.sourceLanguage}>{row.provenance.quote}</blockquote>
                {row.target && <p>{t.target}: {row.target.value}</p>}
                {row.indicator && <p>{t.indicator}: {row.indicator.value}</p>}
                <p>{t.language}: {capture.sourceLanguage}</p>
                <p lang={capture.sourceLanguage}>{capture.sourceDocument}</p>
                <a className="underline" href={`${capture.sourceUrl}#page=${row.provenance.pdfPage}`} target="_blank" rel="noreferrer">{t.source} · NISR</a>
              </details>
            </SubjectRow>)}
          </ul>
        </Panel>)}

      </Region>
      <Region title={t.readings}>
        <Panel className="p-[12px]">
          <p className="text-[12px] leading-[1.5] text-sp-ink-3">{t.noReadings}</p>
          {view.history.map(capture => <details key={capture.captureId} className="mt-[12px] min-w-0 break-words text-[12px] leading-[1.6]">
            <summary className="cursor-pointer">{capture.sourceDocument} · {t.revision}: {capture.revisionOf === null ? t.original : capture.revisionLabel}</summary>
            <p>{capture.publisher} · {capture.license}</p>
            <p>{t.evaluation}: {capture.evaluationDate.value} ({capture.evaluationDate.precision})</p>
            <p>{t.captured}: <time dateTime={capture.capturedAt}>{capture.capturedAt}</time></p>
            <p>{t.language}: {capture.sourceLanguage} · {capture.parser} · {capture.decoder}</p>
            <p className="break-all">SHA256: {capture.sha256}</p>
            <p className="break-all">{capture.sourceUrl}</p>
            {capture.revisionOf !== null && <p className="break-all">{capture.revisionOf}</p>}
          </details>)}
        </Panel>
      </Region>
      <footer className={DEL_MICRO}>RW · Imihigo · NISR</footer>
    </div>
  );
}
