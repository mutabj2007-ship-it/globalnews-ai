import type { EvidenceBasis, EvidenceBreadth } from '@globalnews-ai/shared';

interface EvidenceSufficiencyNoteProps {
  /** Milestone #32 — deterministic, backend-computed. Never implies confirmation/truth. */
  evidenceBreadth?: EvidenceBreadth;
  /** Milestone #32 — present only when backend-validated against the exact evidence text the model saw. */
  evidenceBasis?: EvidenceBasis;
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
 */
export function EvidenceSufficiencyNote({
  evidenceBreadth,
  evidenceBasis,
}: EvidenceSufficiencyNoteProps): JSX.Element | null {
  if (!evidenceBreadth && !evidenceBasis) return null;

  return (
    <div className="mt-2 flex flex-col gap-1">
      {evidenceBreadth && (
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
          Cited by {evidenceBreadth.sourceCount}{' '}
          {evidenceBreadth.sourceCount === 1 ? 'source' : 'sources'}
        </span>
      )}
      {evidenceBasis && (
        <blockquote className="border-l-2 border-border-strong pl-2 text-xs italic leading-relaxed text-ink-tertiary">
          <span className="not-italic font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
            Evidence basis from cited source:
          </span>{' '}
          &ldquo;{evidenceBasis.excerpt}&rdquo;
        </blockquote>
      )}
    </div>
  );
}
