import { layoutReaderContractSummary } from '../validation/reader-contract-shape.util';

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

  /*
    ASK R2 A/B/C BLOCKER REPAIR R1 — a TABLE contract brief comes back as three fields; the join is
    the same mechanical one: contract order, blank-line separated, empty parts dropped. Nothing is
    judged here — an empty or non-table "briefTable" is refused by assessReaderContractShape.
  */
  const opening = record.briefOpening;
  const table = record.briefTable;
  const closing = record.briefClosing;
  if (typeof opening === 'string' && typeof table === 'string' && typeof closing === 'string') {
    const { briefOpening: _o, briefTable: _t, briefClosing: _c, ...others } = record;
    const summary = [opening, table, closing]
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .join('\n\n');
    return { ...others, summary };
  }

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

/**
 * ASK R2 CONTENT QUALITY REPAIR (P0-B) — the reader-contract layout, applied where the two-field
 * join above is: inside the provider, before the payload is validated or shown. Whitespace only;
 * a no-op unless the brief was generated under a structural reader contract.
 */
export function layoutReaderContractBrief(content: unknown, readerContract: boolean): unknown {
  if (!readerContract || content === null || typeof content !== 'object' || Array.isArray(content)) {
    return content;
  }
  const record = content as Record<string, unknown>;
  if (typeof record.summary !== 'string') return content;
  return { ...record, summary: layoutReaderContractSummary(record.summary) };
}
