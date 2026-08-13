import type { LanguageCode, NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { FeaturedStory } from '@/components/home/FeaturedStory';
import { InFocusSidebar } from '@/components/home/InFocusSidebar';
import { DataModeLabel } from '@/components/ui/DataModeLabel';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface NewsroomSectionProps {
  story: NewsArticle | null;
  inFocus: NewsArticle[];
  dataMode: NewsDataMode | null;
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

export function NewsroomSection({
  story,
  inFocus,
  dataMode,
  language = 'en',
}: NewsroomSectionProps): JSX.Element {
  const t = getDictionary(language).newsroomSnapshot;

  return (
    <section className="border-b border-border bg-void" aria-labelledby="newsroom-heading">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">
              {t.label}
            </span>
            <h2
              id="newsroom-heading"
              className="font-display text-2xl font-medium tracking-tight text-ink-primary sm:text-3xl"
            >
              {t.headline}
            </h2>
          </div>
          <DataModeLabel dataMode={dataMode} language={language} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FeaturedStory story={story} language={language} />
          </div>
          <div className="lg:col-span-1">
            <InFocusSidebar items={inFocus} language={language} />
          </div>
        </div>
      </div>
    </section>
  );
}
