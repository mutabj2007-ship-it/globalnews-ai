'use client';

import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatRelativeTime } from '@/lib/formatRelativeTime';

/**
 * The Evidence Library, as a SEPARATE DESTINATION.
 *
 * 06 §2 placed this "after the three-zone workspace ends", reached by
 * scrolling. Under R4 the page has no scroll at all (F-4), so that route
 * is structurally unavailable and the handoff resolves it: the library
 * "retained as a separate destination". This is that destination.
 *
 * Every article image carries a GREEN chip with different words in a
 * different position from the location column's grey provenance chip
 * (06 §2, §7.2) — that contrast is the visual guarantee that
 * representative imagery and event evidence are never confused.
 *
 * A missing article image renders its own striped placeholder. It is
 * NEVER substituted from the location asset map, and the location asset
 * map is never consulted here.
 */
export interface EvidenceLibraryProps {
  articles: readonly NewsArticle[];
  language?: LanguageCode;
  onBack?: () => void;
}

export function EvidenceLibrary({
  articles,
  language = 'en',
  onBack,
}: EvidenceLibraryProps): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.analysisFrame;

  return (
    <div data-paf="evidence-library" className="mx-auto max-w-[1200px] px-6 py-8">
      <button
        type="button"
        onClick={onBack}
        className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#67e8f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
      >
        ← {t.backToWorkspace}
      </button>

      <h1 className="mt-4 font-gn-mono text-[12px] uppercase tracking-[0.16em] text-[#a9bccf]">
        {t.evidenceLibrary} · {articles.length}
      </h1>

      {articles.length === 0 ? (
        <p className="mt-6 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#4a5c73]">
          {t.noReportsRetrieved}
        </p>
      ) : (
        <ul
          className="mt-6 grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))' }}
        >
          {articles.map((article) => (
            <li key={article.id}>
              <article className="overflow-hidden rounded-[12px] border border-[#16202e]">
                <div className="relative h-[132px] w-full bg-[#071016]">
                  {article.imageUrl !== undefined && article.imageUrl.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={article.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(135deg, rgba(148,163,184,.09) 0 6px, transparent 6px 12px)',
                      }}
                    />
                  )}
                  {/* GREEN, bottom-left — the deliberate opposite of the
                      grey LOCATION CONTEXT chip at the top-left of the
                      location column's image. */}
                  <span
                    data-paf="event-evidence-chip"
                    className="absolute bottom-[7px] left-[7px] inline-flex h-[18px] items-center gap-[5px] rounded-[3px] border border-[#3f9d6a] bg-[rgba(5,13,8,.88)] px-[6px] font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#6ee7a8]"
                  >
                    <span aria-hidden="true" className="inline-block h-[4px] w-[4px] rounded-full bg-[#6ee7a8]" />
                    EVENT EVIDENCE
                  </span>
                </div>
                <div className="p-3">
                  <p className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#54687f]">
                    {article.sourceName} · {formatRelativeTime(article.publishedAt, language)}
                  </p>
                  <p className="mt-1 font-gn-sans text-[13px] leading-[1.4] text-[#d5e1ee]">{article.title}</p>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#67e8f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
                  >
                    {dict.analysisWorkspace.sources.opensInNewTab}
                  </a>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
