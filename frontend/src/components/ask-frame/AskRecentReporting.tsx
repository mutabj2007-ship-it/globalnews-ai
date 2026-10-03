import type { AskCompanionTopic, AskRecentReporting as RecentReporting } from '@/lib/api/askV2Api';
import type { AskR2Locale } from '@/lib/ask/askR2Strings';
import { safeExternalHref } from '@globalnews-ai/shared';
import { localisedCountryName } from '@/lib/map/geography/displayName';

/**
 * TRUST & CONVERSATIONAL EXPERIENCE R1 — mixed background + current developments.
 *
 * Beside a place-background answer (history, travel preparation), the reporting this product has
 * RETAINED about the same place in the last two weeks: dated headlines with their publishers,
 * listed — not analysed, not summarised, and not used in the background answer above. Its absence
 * is stated, never hidden. Zero AI; the links open the publishers.
 *
 * CTO P0 · Defect E — the items now serve the question's TASK (travel notices for a travel
 * question…), so the block is titled by that task. An answer stored before the task rule has no
 * topic and keeps its original title.
 */
const T: Record<
  AskR2Locale,
  {
    title: (place: string, days: number) => string;
    topic: Record<AskCompanionTopic, (place: string, days: number) => string>;
    note: string;
    none: string;
    unavailable: string;
  }
> = {
  en: {
    title: (place, days) => `Recent reporting about ${place} (last ${days} days)`,
    topic: {
      TRAVEL: (place, days) => `Current travel notices · ${place} (last ${days} days)`,
      ECONOMY: (place, days) => `Recent economic reporting · ${place} (last ${days} days)`,
      SECURITY: (place, days) => `Recent security reporting · ${place} (last ${days} days)`,
      BUSINESS: (place, days) =>
        `Recent business and trade reporting · ${place} (last ${days} days)`,
      SCIENCE: (place, days) => `Recent science reporting · ${place} (last ${days} days)`,
    },
    note: 'Listed, not analysed: the answer above is general background and does not use these reports.',
    none: 'No recent reporting about this place is held right now. That is not evidence that nothing is happening.',
    unavailable: 'Recent reporting could not be checked just now.',
  },
  pl: {
    title: (place, days) => `Najnowsze doniesienia: ${place} (ostatnie ${days} dni)`,
    topic: {
      TRAVEL: (place, days) =>
        `Bieżące komunikaty dla podróżnych · ${place} (ostatnie ${days} dni)`,
      ECONOMY: (place, days) =>
        `Najnowsze doniesienia gospodarcze · ${place} (ostatnie ${days} dni)`,
      SECURITY: (place, days) =>
        `Najnowsze doniesienia o bezpieczeństwie · ${place} (ostatnie ${days} dni)`,
      BUSINESS: (place, days) =>
        `Najnowsze doniesienia o biznesie i handlu · ${place} (ostatnie ${days} dni)`,
      SCIENCE: (place, days) => `Najnowsze doniesienia naukowe · ${place} (ostatnie ${days} dni)`,
    },
    note: 'Lista bez analizy: powyższa odpowiedź to ogólne tło i nie korzysta z tych doniesień.',
    none: 'Nie mamy teraz najnowszych doniesień o tym miejscu. To nie dowód, że nic się nie dzieje.',
    unavailable: 'Nie udało się teraz sprawdzić najnowszych doniesień.',
  },
};

function day(iso: string, locale: AskR2Locale): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(locale === 'pl' ? 'pl-PL' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
}

export function AskRecentReporting({
  reporting,
  locale,
}: {
  readonly reporting: RecentReporting;
  readonly locale: AskR2Locale;
}): JSX.Element {
  const t = T[locale];
  const place = localisedCountryName(reporting.country, locale) ?? reporting.country;
  const title = (reporting.topic === undefined ? t.title : t.topic[reporting.topic])(
    place,
    reporting.windowDays,
  );
  return (
    <section
      data-ask="recent-reporting"
      data-ask-recent-status={reporting.status}
      data-ask-recent-topic={reporting.topic}
      aria-label={title}
      className="mt-4 rounded-[12px] border border-[#1d4a73] bg-[#04162b] p-3.5 md:p-4"
    >
      <h3 className="text-[14px] font-bold text-[#cfe2f2]">{title}</h3>
      <p className="mt-1 font-mono text-[11.5px] leading-[1.4] text-[#8fa6c0]">{t.note}</p>
      {reporting.status === 'LISTED' ? (
        <ul className="mt-3 flex flex-col gap-2">
          {reporting.items.map((item) => (
            <li key={item.url} className="text-[14px] leading-[1.45]">
              <a
                href={safeExternalHref(item.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#93cdf5] underline-offset-2 hover:underline"
              >
                {item.title}
              </a>
              <span className="block font-mono text-[11.5px] text-[#8fa6c0]">
                {item.sourceName} · {day(item.publishedAt, locale)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[14px] text-[#cfe2f2]">
          {reporting.status === 'NONE_RETAINED' ? t.none : t.unavailable}
        </p>
      )}
    </section>
  );
}
