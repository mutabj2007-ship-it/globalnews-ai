import type { JSX } from 'react';
import Link from 'next/link';
import type { LanguageCode } from '@globalnews-ai/shared';
import { humanitarianEn } from '@/lib/i18n/dictionaries/humanitarianEn';
import { humanitarianPl } from '@/lib/i18n/dictionaries/humanitarianPl';
import type { HumanitarianHomeProjection } from '@/lib/humanitarian/humHomeProjection';

/**
 * HOME · HUMANITARIAN — the bounded projection of the ONE retained Humanitarian corpus
 * (humHomeProjection: E1-scoped reader read → G's display gate → H's brief).
 *
 * Renders NOTHING unless that projection exists: no admitted projection means no Humanitarian
 * module on Home — never an empty card, never "nothing happened", never a zero. Server-rendered,
 * no client state, no fetch, no model. Every word comes from the canonical EN/PL Humanitarian
 * catalogue; every figure is shown exactly as its source stated it, with who stated it, and every
 * E1-required disclosure is shown with it. Locations are never shown (country level only).
 */
function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));
}

export function HomeHumanitarian({
  projection,
  language,
}: {
  projection: HumanitarianHomeProjection | null;
  language: LanguageCode;
}): JSX.Element | null {
  if (projection === null) return null;
  const s = language === 'pl' ? humanitarianPl : humanitarianEn;
  const { brief } = projection;
  const measureLabel = (measure: string): string =>
    (s.vocabulary.impactMeasure as Record<string, string>)[measure] ??
    (s.vocabulary.statusMeasure as Record<string, string>)[measure] ??
    measure;

  return (
    <section
      aria-labelledby="home-humanitarian-heading"
      data-home-humanitarian=""
      className="rounded-[12px] border border-[#15314f] bg-[#061527] px-4 py-3.5 md:px-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="home-humanitarian-heading" className="text-[15px] font-bold text-white">
          {s.home.cardTitle}
        </h2>
        <Link
          href="/humanitarian"
          className="text-[12.5px] font-semibold text-[#9cc3ff] hover:underline"
        >
          {s.home.openHumanitarian}
        </Link>
      </div>
      <p className="mt-1 text-[12.5px] text-[#93a9c2]">
        {fill(s.home.retainedRecordCount, { count: projection.recordCount })}
        {brief.newestRetainedAt === null
          ? null
          : ` · ${fill(s.home.newestRetainedAt, { date: brief.newestRetainedAt.slice(0, 10) })}`}
      </p>

      {brief.figures.length > 0 ? (
        <ul data-home-humanitarian-figures="" className="mt-2.5 flex flex-col gap-1.5">
          {brief.figures.map((f) => (
            <li
              key={`${f.recordKey}:${f.measure}`}
              className="text-[13px] leading-snug text-[#dbe6f3]"
            >
              <span className="font-semibold text-white">
                {String(f.value)}
                {f.unit === null ? '' : ` ${f.unit}`}
              </span>{' '}
              {measureLabel(f.measure)}
              <span className="text-[#93a9c2]">
                {' · '}
                {s.claimClass[f.claimClass]}
                {' · '}
                {fill(s.askDisclosure.publishedByLabel, { publisher: f.providerId })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {brief.dimensionsUnknown.length > 0 ? (
        <p data-home-humanitarian-unknown="" className="mt-2 text-[12.5px] text-[#93a9c2]">
          {fill(s.home.areasWithoutEvidence, {
            count: brief.dimensionsUnknown.length,
            total: projection.totalDimensions,
          })}
        </p>
      ) : null}

      <ul data-home-humanitarian-disclosures="" className="mt-2.5 flex flex-col gap-0.5">
        {projection.disclosures.map((code) => (
          <li key={code} data-disclosure={code} className="text-[12px] leading-snug text-[#93a9c2]">
            {s.readerDisclosure[code]}
          </li>
        ))}
      </ul>

      <ul data-home-humanitarian-attribution="" className="mt-2 flex flex-col gap-0.5">
        {projection.attributions.map((a) => (
          <li
            key={`${a.publisher}|${a.relayAttribution ?? ''}|${a.originatingAgency ?? ''}`}
            className="text-[12px] text-[#93a9c2]"
          >
            {fill(s.askDisclosure.publishedByLabel, { publisher: a.publisher })}
            {a.relayAttribution === null ? null : ` · ${a.relayAttribution}`}
            {a.originatingAgency === null ? null : ` · ${a.originatingAgency}`}
          </li>
        ))}
      </ul>
    </section>
  );
}
