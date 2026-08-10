import type { SourceEntities } from '@globalnews-ai/shared';

interface SourceEntitiesPanelProps {
  sourceEntities: SourceEntities | undefined;
  className?: string;
}

/**
 * Displays organizations deterministically resolved from the retrieved
 * source articles' own text (see organization-alias-resolver.util.ts /
 * build-source-entities.util.ts on the backend) — never from the AI
 * provider. Rendered alongside RetrievalContextStatus, independent of
 * whether AI analysis succeeded, since this evidence never depended on
 * it either.
 *
 * Deliberately does not read from analysis.entities (AnalysisEntities)
 * — that's the AI's own, ungrounded output, and is rendered separately
 * inside AnalysisResultView. The two are never combined into one list.
 */
export function SourceEntitiesPanel({
  sourceEntities,
  className = '',
}: SourceEntitiesPanelProps): JSX.Element | null {
  const organizations = sourceEntities?.organizations ?? [];

  if (organizations.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <span className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
        Organizations identified in source material
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {organizations.map((org) => {
          // Only the surface forms that actually differ from the
          // canonical display name are worth disclosing — e.g. "UN"
          // next to "United Nations". If the article only ever used
          // the canonical spelling, there's nothing extra to show.
          const alternateSurfaceForms = org.matchedFrom.filter(
            (form) => form !== org.canonical,
          );

          const title =
            alternateSurfaceForms.length > 0
              ? `Also referred to as "${alternateSurfaceForms.join('", "')}" in the source material`
              : undefined;

          return (
            <span
              key={org.canonical}
              title={title}
              className="rounded-full border border-border-strong bg-surface px-2.5 py-1 text-xs text-ink-secondary"
            >
              {org.canonical}
              {alternateSurfaceForms.length > 0 && (
                <span className="ml-1.5 text-ink-tertiary">
                  (also &ldquo;{alternateSurfaceForms[0]}&rdquo;)
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
