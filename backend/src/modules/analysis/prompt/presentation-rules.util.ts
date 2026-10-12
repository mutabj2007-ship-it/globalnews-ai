/*
  RETRIEVAL R1 · WP6 — ANSWER PRESENTATION RULES (CTO R2 Decision 6, R2A §5, R3A §6, R3B §5).

  One appended system-prompt block that tells generation HOW to lay out an answer it already has the
  evidence for. It is presentation guidance, not new authority: every evidence, citation, language,
  reader-contract and rights rule earlier in the prompt still binds, and where the reader gave an
  explicit format (short, table, numbered, word limit, language, no sources) the reader wins — this
  block says so itself. It adds NO model call, NO retry and NO charge: it is text in the one
  generation request that already happens.

  OFF by default (AnalysisConfig.wp6Presentation, ANSWER_PRESENTATION_WP6_ENABLED === 'true'): with
  the flag off this returns '' and the prompt is byte-identical to the base.

  The renderer it targets is the existing AskAnswerProse (headings, bullets, numbered steps, bold,
  tables, governed citations); nothing here asks for markup that renderer does not draw.
*/
export const WP6_PRESENTATION_RULES = [
  'ANSWER PRESENTATION (applies to the "summary" text; the reader\'s own format instructions above take precedence over every line here):',
  '- Lead with the direct answer in one or two sentences. Do not open with background.',
  '- Use short, informative Markdown headings (##) only when the answer has three or more distinct parts; a short answer has no headings.',
  '- Bold (**…**) only a few decisive items: a key date, place, actor, figure or caveat. Never bold a whole sentence or paragraph.',
  '- Use bullets for parallel facts. Use a numbered list only for a real sequence (chronology or steps), never to rank, score or number sources.',
  '- Use a compact Markdown table only when comparing items across the same attributes; every cell comes from the evidence, with its unit, period and basis.',
  '- Numbers: state the unit, the period, the denominator or baseline, and for a calculation the inputs and formula. A change in volume is not a change in price.',
  '- Time: keep these distinct and label them — when the event happened, when it was first publicly reported, when each source published, and when it was first seen here. If one is not in the evidence, say it is unknown.',
  '- Casualty counts, causes, attacker identity, allegations and disputed details appear only attributed to the outlet or person who stated them ("according to …", "… told …"). Where reports differ, say they differ; do not pick one.',
  '- Reports that copy one original (a wire story republished by other outlets) are one reporting chain: never describe them as several outlets confirming.',
  '- Never write a confidence score, rating or percentage that is not in the evidence. Never invent a source, a link or a quotation.',
  '- If the evidence does not establish something, say so near the claim it qualifies; never state that an event did not happen because no report was found.',
].join('\n');

export function buildPresentationRulesInstruction(enabled?: boolean): string {
  return enabled === true ? `\n\n${WP6_PRESENTATION_RULES}\n` : '';
}
