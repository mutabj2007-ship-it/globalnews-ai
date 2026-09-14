/**
 * ============================================================================
 * C910 - THE PROVIDER-INTERNAL BRIEF NORMALIZATION
 * ============================================================================
 *
 * The multi-development schema asks for the executive brief as two required
 * fields. This joins them back into the single `summary` string the rest of the
 * programme already consumes, INSIDE the provider, before the result is returned.
 *
 * SO NOTHING DOWNSTREAM CHANGES. `validateAnalysisResult`, `assessBriefCompliance`,
 * `withholdExecutiveBrief`, the shared contract and the frontend all receive the
 * exact shape they receive today: `summary` is a string, and the two field names
 * never leave this module boundary.
 *
 * FAIL-CLOSED IS PRESERVED, NOT BYPASSED. The join is mechanical and makes no
 * judgement about content. If either field comes back empty or whitespace, the
 * joined string collapses to a single paragraph under
 * `countSynthesisParagraphs()` - which splits on blank lines and discards empty
 * parts - and the existing compliance validator withholds the brief exactly as it
 * does today. The schema makes the compliant shape the easy path; it is not a
 * replacement for the check, and the check is unchanged.
 *
 * IT IS A NO-OP ON EVERY OTHER PATH. Narrow evidence, an absent breadth, the mock
 * provider, and any response that does not carry BOTH fields as strings are
 * returned untouched, so the single-summary behaviour is byte-identical to C909.
 */
export function normalizeBriefFields(content: unknown): unknown {
  if (content === null || typeof content !== 'object' || Array.isArray(content)) {
    return content;
  }

  const record = content as Record<string, unknown>;
  const primary = record.primaryDevelopment;
  const additional = record.additionalDevelopments;

  // Both, and both strings, or this is not a multi-development payload.
  if (typeof primary !== 'string' || typeof additional !== 'string') {
    return content;
  }

  const { primaryDevelopment: _primary, additionalDevelopments: _additional, ...rest } = record;

  /*
    The blank line is the separator `countSynthesisParagraphs()` splits on, and
    the frontend's `splitSynthesisParagraphs` renders by. One definition, both
    ends - the same principle the compliance validator already states about
    paragraph counting.
  */
  return { ...rest, summary: `${primary.trim()}\n\n${additional.trim()}` };
}
