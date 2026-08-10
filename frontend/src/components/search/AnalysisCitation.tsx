import type { AnalysisSourceRef } from '@globalnews-ai/shared';

interface AnalysisCitationProps {
  /** Real, backend-resolved article IDs (NewsAnalysisResult.sourceArticleIds) — never an AI-facing evidenceId. */
  sourceArticleIds: string[];
  /** NewsAnalysisResult.sources — trusted metadata reconstructed from the real NewsArticle objects. */
  sources: AnalysisSourceRef[];
}

/**
 * Milestone #31 — renders numbered citation chips ("[1] [3]") for a
 * grounded claim/agreement/position, linking straight to the real
 * source article. Citation numbers reflect each article's position in
 * `sources` (the same order Original sources are displayed in), so a
 * chip's number always matches the source list below it.
 *
 * Every value rendered here — the URL, the number, the tooltip title —
 * comes from `sources`, which is itself only ever built server-side
 * from real NewsArticle objects (see validate-analysis-result.ts).
 * This component never receives or trusts anything the AI provider
 * returned directly.
 */
export function AnalysisCitation({ sourceArticleIds, sources }: AnalysisCitationProps): JSX.Element | null {
  if (sourceArticleIds.length === 0) return null;

  const indexByArticleId = new Map(sources.map((source, index) => [source.articleId, index + 1]));

  const chips = sourceArticleIds
    .map((articleId) => {
      const source = sources.find((s) => s.articleId === articleId);
      const number = indexByArticleId.get(articleId);
      if (!source || !number) return null;
      return { articleId, number, url: source.url, title: source.title };
    })
    .filter((chip): chip is { articleId: string; number: number; url: string; title: string } => chip !== null);

  if (chips.length === 0) return null;

  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-1 align-middle">
      {chips.map((chip) => (
        <a
          key={chip.articleId}
          href={chip.url}
          target="_blank"
          rel="noopener noreferrer"
          title={chip.title}
          className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-border-strong bg-surface px-1 font-mono text-[10px] leading-none text-ink-tertiary transition-colors hover:border-signal/60 hover:text-signal-bright"
        >
          {chip.number}
        </a>
      ))}
    </span>
  );
}
