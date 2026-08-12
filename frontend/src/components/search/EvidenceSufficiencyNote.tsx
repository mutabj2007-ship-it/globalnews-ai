import type { EvidenceBasis, EvidenceBreadth, LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface EvidenceSufficiencyNoteProps {
  /** Milestone #32 — deterministic, backend-computed. Never implies confirmation/truth. */
  evidenceBreadth?: EvidenceBreadth;
  /** Milestone #32 — present only when backend-validated against the exact evidence text the model saw. */
  evidenceBasis?: EvidenceBasis;
  /** Milestone #47 — defaults to 'en', so every pre-M47 caller renders exactly as before. */
  language?: LanguageCode;
}

/**
 * Milestone #32 — renders, at most, a small breadth count and a
 * validated excerpt for one grounded entry.
 *
 * Deliberately conservative language throughout, per Milestone #32
 * authorization §9:
 * - Breadth is presented as a citation count only ("Cited by N
 *   sources"), never as confirmation ("N sources confirm this").
 * - A validated excerpt is labeled "Evidence basis from cited source"
 *   — never "Verified", "Fact checked", "Confirmed true", "Proven", or
 *   "Independently verified". Excerpt-existence validation proves the
 *   excerpt was actually present in what the model was shown; it does
 *   not prove the excerpt logically entails the claim's wording or
 *   strength.
 *
 * Kept as an isolated component, separate from AnalysisCitation.tsx
 * (an M31 concern), per Milestone #32 authorization §11.
 *
 * Milestone #47 (Defect 1 correction) — `language` defaults to 'en';
 * English output is byte-for-byte unchanged from before this
 * milestone. The excerpt text itself (evidenceBasis.excerpt) is NEVER
 * translated — it is a verbatim quotation from the real source
 * article, exactly as required.
 */
export function EvidenceSufficiencyNote({
  evidenceBreadth,
  evidenceBasis,
  language = 'en',
}: EvidenceSufficiencyNoteProps): JSX.Element | null {
  if (!evidenceBreadth && !evidenceBasis) return null;

  const t = getDictionary(language).evidenceSufficiencyNote;

  return (
    <div className="mt-2 flex flex-col gap-1">
      {evidenceBreadth && (
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
          {t.citedByPrefix} {evidenceBreadth.sourceCount}{' '}
          {evidenceBreadth.sourceCount === 1 ? t.sourceSingular : t.sourcePlural}
        </span>
      )}
      {evidenceBasis && (
        <blockquote className="border-l-2 border-border-strong pl-2 text-xs italic leading-relaxed text-ink-tertiary">
          <span className="not-italic font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
            {t.evidenceBasisLabel}
          </span>{' '}
          &ldquo;{evidenceBasis.excerpt}&rdquo;
        </blockquote>
      )}
    </div>
  );
}
