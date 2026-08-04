import type { NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { FeaturedStory } from '@/components/home/FeaturedStory';
import { TrendingSidebar } from '@/components/home/TrendingSidebar';
import { DataModeLabel } from '@/components/ui/DataModeLabel';

interface NewsroomSectionProps {
  story: NewsArticle | null;
  trending: NewsArticle[];
  dataMode: NewsDataMode | null;
}

export function NewsroomSection({ story, trending, dataMode }: NewsroomSectionProps): JSX.Element {
  return (
    <section className="border-b border-border bg-void" aria-labelledby="newsroom-heading">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">
              Newsroom snapshot
            </span>
            <h2
              id="newsroom-heading"
              className="font-display text-2xl font-medium tracking-tight text-ink-primary sm:text-3xl"
            >
              The story everyone&rsquo;s reading
            </h2>
          </div>
          <DataModeLabel dataMode={dataMode} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FeaturedStory story={story} />
          </div>
          <div className="lg:col-span-1">
            <TrendingSidebar items={trending} />
          </div>
        </div>
      </div>
    </section>
  );
}
