import type { AskCompanionTopic, AskRecentReporting as RecentReporting } from '@/lib/api/askV2Api';
import { safeExternalHref, type DisplayLocale } from '@globalnews-ai/shared';
import { askCountryName } from '@/lib/ask/askCountryName';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { askFormatDate } from '@/lib/ask/askDirection';

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
/*
  R4 · PHASE B — the EN/PL `T` record that lived here was module-private, so no overlay could
  reach it and no coverage report could count it: ten keys, six of them templates, that a
  French reader would have been shown in English whatever the catalogues did. They now live in
  `askSurfaceStrings.ts`, verbatim.
*/

/*
  R4 · PHASE B — this read `toLocaleDateString(locale === 'pl' ? 'pl-PL' : 'en-GB', …)`.
  Correct for two locales, silently English for five, and incapable of Eastern-Arabic
  numerals. `askFormatDate` is the one date formatter the Ask surface has, built from the
  locale's own `Intl` formatting profile, and it already renders the product's frozen
  day-month-year arrangement.
*/
function day(iso: string, locale: DisplayLocale): string {
  return askFormatDate(iso, locale) ?? '';
}

export function AskRecentReporting({
  reporting,
  locale,
}: {
  readonly reporting: RecentReporting;
  readonly locale: DisplayLocale;
}): JSX.Element {
  const t = askShellStrings(locale).askRecentReportingStrings;
  const place = askCountryName(reporting.country, locale) ?? reporting.country;
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
      className="mt-4 rounded-[12px] border border-[var(--ask-read-line,#1d4a73)] bg-[var(--ask-read-sunk,#04162b)] p-3.5 md:p-4"
    >
      <h3 className="text-[14px] font-bold text-[var(--ask-read-ink,#cfe2f2)]">{title}</h3>
      <p className="mt-1 text-[0.75rem] leading-[1.4] text-[var(--ask-read-ink2,#8fa6c0)]">{t.note}</p>
      {reporting.status === 'LISTED' ? (
        <ul className="mt-3 flex flex-col gap-2">
          {reporting.items.map((item) => (
            <li key={item.url} className="text-[14px] leading-[1.45]">
              <a
                href={safeExternalHref(item.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--ask-read-control-ink,#93cdf5)] underline-offset-2 hover:underline"
              >
                {item.title}
              </a>
              <span className="block text-[0.75rem] text-[var(--ask-read-ink2,#8fa6c0)]">
                {item.sourceName} · {day(item.publishedAt, locale)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[14px] text-[var(--ask-read-ink,#cfe2f2)]">
          {reporting.status === 'NONE_RETAINED' ? t.none : t.unavailable}
        </p>
      )}
    </section>
  );
}
