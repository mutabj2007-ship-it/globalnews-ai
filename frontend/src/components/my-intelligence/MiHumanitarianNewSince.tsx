import type { JSX } from 'react';
import type { LanguageCode, MyIntelligenceHumanitarianNewSince } from '@globalnews-ai/shared';
import { humanitarianEn } from '@/lib/i18n/dictionaries/humanitarianEn';
import { humanitarianPl } from '@/lib/i18n/dictionaries/humanitarianPl';

/**
 * MY INTELLIGENCE · HUMANITARIAN NEW SINCE — what the server decided, rendered (no client logic).
 *
 * The list arrives decided: lane A's delta feed over the ONE retained corpus, E1-admitted, matched
 * to this reader's followed countries and to the SAME previous-visit boundary as stories
 * (`MyIntelligenceFeedService`). This component adds nothing to that decision.
 *
 * Renders nothing when there is nothing to say: no items and no possible gap. A possible gap is
 * always stated, even with no items — a reader must not read an incomplete list as complete.
 * Every word is from the canonical EN/PL Humanitarian catalogue; figures are verbatim with their
 * publisher; retained records are never presented as current observations.
 */
export function MiHumanitarianNewSince({
  data,
  language,
}: {
  data: MyIntelligenceHumanitarianNewSince | null;
  language: LanguageCode;
}): JSX.Element | null {
  if (data === null || (data.items.length === 0 && !data.gapPossible)) return null;
  const s = language === 'pl' ? humanitarianPl : humanitarianEn;
  const measureLabel = (measure: string): string =>
    (s.vocabulary.impactMeasure as Record<string, string>)[measure] ??
    (s.vocabulary.statusMeasure as Record<string, string>)[measure] ??
    measure;

  return (
    <section
      aria-labelledby="mi-humanitarian-new-since-title"
      data-mi-humanitarian-new-since=""
      className="rounded-[12px] border border-[#15314f] bg-[#061527] px-4 py-3.5 md:px-5"
    >
      <h2 id="mi-humanitarian-new-since-title" className="text-[15px] font-bold text-white">
        {s.myIntelligence.newSinceTitle}
      </h2>
      <p className="mt-1 text-[12.5px] text-[#93a9c2]">{s.readerDisclosure.RETAINED_NOT_CURRENT}</p>
      {data.gapPossible ? (
        <p data-mi-humanitarian-gap="" className="mt-1 text-[12.5px] text-[#ffcf7d]">
          {s.myIntelligence.changesMayBeMissing}
        </p>
      ) : null}
      {data.items.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {data.items.map((item) => (
            <li
              key={item.observationKey}
              data-change={item.change}
              className="text-[13px] leading-snug text-[#dbe6f3]"
            >
              <span className="mr-2 rounded-[5px] border border-[#2b4a6d] px-1.5 py-[1px] text-[11px] font-semibold text-[#9cc3ff]">
                {item.change === 'REVISED'
                  ? s.myIntelligence.changeRevised
                  : s.myIntelligence.changeNew}
              </span>
              {item.figure !== null ? (
                <>
                  <span className="font-semibold text-white">
                    {String(item.figure.value)}
                    {item.figure.unit === null ? '' : ` ${item.figure.unit}`}
                  </span>{' '}
                  {measureLabel(item.figure.measure)}
                </>
              ) : (
                <span className="text-white">{item.title}</span>
              )}
              <span className="text-[#93a9c2]">
                {' · '}
                {item.countryIso3.join(', ')}
                {' · '}
                {s.askDisclosure.publishedByLabel.replace('{publisher}', item.publisher)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
