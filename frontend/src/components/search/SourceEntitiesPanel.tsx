import type { LanguageCode, SourceEntities } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface SourceEntitiesPanelProps {
  sourceEntities: SourceEntities | undefined;
  className?: string;
  /** Milestone #47 — defaults to 'en', so every pre-M47 caller renders exactly as before. */
  language?: LanguageCode;
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
 *
 * Milestone #47 (Defect 1 correction) — `language` defaults to 'en';
 * English output is byte-for-byte unchanged from before this
 * milestone. org.canonical / alternateSurfaceForms are real,
 * backend-resolved organization names extracted from source text —
 * NEVER translated, only the surrounding English prose changes.
 */
export function SourceEntitiesPanel({
  sourceEntities,
  className = '',
  language = 'en',
}: SourceEntitiesPanelProps): JSX.Element | null {
  const organizations = sourceEntities?.organizations ?? [];

  if (organizations.length === 0) {
    return null;
  }

  const t = getDictionary(language).sourceEntitiesPanel;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <span className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
        {t.organizationsIdentified}
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
              ? `${t.alsoReferredToAsPrefix} "${alternateSurfaceForms.join('", "')}" ${t.alsoReferredToAsSuffix}`
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
                  ({t.also} &ldquo;{alternateSurfaceForms[0]}&rdquo;)
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
