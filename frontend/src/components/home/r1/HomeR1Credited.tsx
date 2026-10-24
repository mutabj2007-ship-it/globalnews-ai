import type { JSX } from 'react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { formatObservationalTime } from '@/lib/formatRelativeTime';
import { licenceAttributionStrings } from '@/lib/i18n/licenceAttributionStrings';
import { LicenceAttribution, isFullyCredited } from '@/components/attribution/LicenceAttribution';

/**
 * E1 V7 — CREDITED REPORTING on Home: the ONLY surface that renders `NewsResponse.creditedArticles`.
 *
 * Each item is its headline (unchanged, PLAIN TEXT — CTO R177: never a link), its publisher and
 * publication time, and the full licence credit line, whose "Read Original ↗" is the only link out. Nothing else of the text, and NO image: media
 * is dropped unconditionally (C-GV4). An item that is not fully credited is not rendered at all, and
 * with no credited item the section is absent (it never claims anything about other coverage).
 */
export function HomeR1Credited({
  articles,
  language,
}: {
  readonly articles: readonly NewsArticle[];
  readonly language: LanguageCode;
}): JSX.Element | null {
  const credited = articles.filter(isFullyCredited);
  if (credited.length === 0) return null;
  const t = licenceAttributionStrings(language);
  return (
    <section aria-labelledby="home-r1-credited" data-home-r1-credited="" lang={t.lang} className="rounded-[14px] border border-[var(--gt-line)] bg-[var(--gt-card)] p-4">
      <h2 id="home-r1-credited" className="font-display text-[18px] font-bold text-[var(--gt-ink)]">
        {t.sectionTitle}
      </h2>
      <p className="text-[12.5px] text-[var(--gt-ink2)]">{t.sectionNote}</p>
      <ul className="mt-3 flex flex-col divide-y divide-[var(--gt-line2)] border-t border-[var(--gt-line2)]">
        {credited.slice(0, 6).map((article) => {
          const at = formatObservationalTime(article.publishedAt, article.publishedAtBasis, language);
          return (
            <li key={article.id} data-credited-item="" className="py-3">
              <h3 data-credited-title="" className="text-[15px] font-bold leading-[1.35] text-[var(--gt-ink)]">
                {article.title}
              </h3>
              <p className="mt-1 text-[12px] text-[var(--gt-ink2)]">{at === '' ? article.sourceName : `${article.sourceName} · ${at}`}</p>
              <LicenceAttribution article={article} language={language} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
