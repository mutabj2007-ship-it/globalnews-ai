import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { SafeImage } from '@/components/ui/SafeImage';

interface SourceArticleCardProps {
  article: NewsArticle;
  /** Milestone #47 — defaults to 'en', so every pre-M47 caller renders exactly as before. */
  language?: LanguageCode;
}

const EVIDENCE_LANGUAGE_LABEL: Record<LanguageCode, string> = {
  en: 'Evidence language',
  pl: 'Język źródła',
  sw: 'Evidence language',
  fr: 'Evidence language',
  es: 'Evidence language',
  ar: 'Evidence language',
  rw: 'Evidence language',
};

/**
 * Milestone #47 — maps a raw provider language code (e.g. "en", "pl",
 * "de") to a short display name where one is known; falls back to the
 * raw code itself (uppercased) for anything unrecognized, since
 * NewsArticle.sourceLanguage can legitimately be any provider-reported
 * language, a far larger set than GlobalNews AI's own UI languages —
 * see NewsArticle.sourceLanguage's own doc comment. Never infers a
 * language when the field is absent — that case is handled by the
 * caller rendering nothing at all (see below), not by this function.
 */
const KNOWN_LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  en: 'English',
  pl: 'Polski',
  sw: 'Kiswahili',
  fr: 'Français',
  es: 'Español',
  ar: 'العربية',
  rw: 'Kinyarwanda',
  de: 'Deutsch',
};

function displaySourceLanguage(code: string): string {
  return KNOWN_LANGUAGE_DISPLAY_NAMES[code] ?? code.toUpperCase();
}

export function SourceArticleCard({ article, language = 'en' }: SourceArticleCardProps): JSX.Element {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-signal/60 hover:bg-surface-hover"
      aria-label={`Read the full story: ${article.title}`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border">
        <SafeImage
          src={article.imageUrl || '/images/article-placeholder.jpg'}
          alt={article.title}
          fill
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <span className="mb-2 font-mono text-[10px] uppercase tracking-widest text-signal-bright">
          {article.category}
        </span>
        <h4 className="mb-3 line-clamp-2 font-display text-base font-medium leading-snug text-ink-primary transition-colors group-hover:text-signal-bright">
          {article.title}
        </h4>
        <div className="mt-auto flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-tertiary">
          <span className="text-ink-secondary">{article.sourceName}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{formatRelativeTime(article.publishedAt)}</span>
          {/*
            Milestone #47 — only rendered when sourceLanguage is
            genuinely present (verified provider metadata, never
            fabricated or inferred). Absent -> renders nothing here at
            all, never an "unknown" placeholder, matching the CTO's
            "no sourceLanguage: show nothing" instruction.
          */}
          {article.sourceLanguage && (
            <>
              <span aria-hidden="true">&middot;</span>
              <span title={EVIDENCE_LANGUAGE_LABEL[language] ?? EVIDENCE_LANGUAGE_LABEL.en}>
                {displaySourceLanguage(article.sourceLanguage)}
              </span>
            </>
          )}
        </div>
      </div>
    </a>
  );
}
