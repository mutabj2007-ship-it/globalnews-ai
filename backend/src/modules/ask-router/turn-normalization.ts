import { restoreCountryPossessives } from './country-morphology';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 THIRD PASS — BOUNDED FORM NORMALIZATION BEFORE JOB / CURRENTNESS READING
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Readers write "whats", "what's", "What is"; curly or straight apostrophes; "Now, …" as a
 * discourse marker; doubled punctuation. Those are FORM, not meaning, and the job / currentness
 * readers must not depend on them. This layer rewrites only harmless form:
 *
 *   · apostrophe omission and common contractions ("whats" / "what's" → "what is");
 *   · typographic quotes / apostrophes and dashes → plain ASCII forms;
 *   · whitespace and repeated punctuation;
 *   · a sentence-initial DISCOURSE "now" / "teraz" ("Now, compare those", "Right. Now turn that
 *     into…", "A teraz porównaj…") — a turn-taking particle, not a time requirement. A "now" that
 *     carries time ("What is happening now?", "now in Kenya", "right now") is kept.
 *
 * It never corrects spelling, never invents or removes an entity, never changes a name's
 * capitalisation and never translates. The reader's ORIGINAL text is what is stored, displayed,
 * audited and handed to frozen C; this text is only what the R4 readers look at.
 */

export interface NormalizedTurn {
  /** The text the R4 job / currentness readers read. */
  readonly text: string;
  /** Which harmless rewrites were applied (diagnostics; codes only). */
  readonly applied: readonly (
    'QUOTES' | 'CONTRACTION' | 'POSSESSIVE' | 'DISCOURSE_NOW' | 'WHITESPACE' | 'FILLER'
  )[];
}

/* Unambiguous English contractions, with or without the apostrophe. "its" / "were" / "well" /
   "hell" / "shell" / "id" are deliberately absent: without an apostrophe they are real words. */
const EN_CONTRACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(what|how|who|where|why|when|that|there|here)['’]?s\b/gi, '$1 is'],
  [/\bcan['’]t\b/gi, 'cannot'],
  [/\bwon['’]t\b/gi, 'will not'],
  [/\b(is|are|was|were|does|do|did|has|have|had|should|would|could|must)n['’]?t\b/gi, '$1 not'],
  [/\b(i)['’]m\b/gi, '$1 am'],
  [/\b(you|we|they)['’]re\b/gi, '$1 are'],
  [/\b(i|you|we|they)['’]ve\b/gi, '$1 have'],
  [/\b(i|you|we|they|he|she)['’]ll\b/gi, '$1 will'],
  [/\b(let)['’]s\b/gi, 'let us'],
];

/* a discourse "now": sentence-initial (optionally after ok / right / so / and / great …), followed
   by a comma or directly by a request / reference — never followed by a time continuation */
const EN_DISCOURSE_NOW =
  /(^|[.!?]\s+)((?:(?:ok(?:ay)?|right|so|and|great|good|fine|alright|thanks)[,.!]?\s+)*)now(?:\s*,\s*|\s+)(?!(?:is|are|was|were|happening|going|in\b|on\b|at\b|days|that\s+(?:the|it|we|they))\b)(?=[\p{L}])/giu;
const PL_DISCOURSE_NOW =
  /(^|[.!?]\s+)((?:(?:ok|dobrze|dobra|świetnie|super|dzięki|a|i|więc)[,.!]?\s+)*)teraz(?:\s*,\s*|\s+)(?!(?:jest|są|dzieje|w\b|na\b)(?![\p{L}]))(?=[\p{L}])/giu;

export function normalizeTurn(question: string, language: string): NormalizedTurn {
  const applied: NormalizedTurn['applied'][number][] = [];
  let text = question;
  const quotes = text
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—]/g, '-');
  if (quotes !== text) applied.push('QUOTES');
  text = quotes;
  const spaced = text
    .replace(/\s+/g, ' ')
    .replace(/([?!.])\1+/g, '$1')
    .trim();
  if (spaced !== text.trim()) applied.push('WHITESPACE');
  text = spaced;
  /* CTO R4 fifth pass — leading conversational FILLERS ("ok so", "well,", "um", PL "no to", "dobra")
     are form; "right now" keeps its time ("right" is a filler only when "now" does not follow) */
  const unfilled = text.replace(
    language === 'pl'
      ? /^(?:(?:ok|okej|dobra|no|więc|wiec|hej|słuchaj|sluchaj)[,.!]?\s+)+(?=\p{L})/iu
      : /^(?:(?:ok(?:ay)?|so|well|um+|uh+|hmm+|right(?!\s+now)|alright|hey|hi|hello|yeah|sure)[,.!]?\s+)+(?=\p{L})/iu,
    '',
  );
  if (unfilled !== text) applied.push('FILLER');
  text = unfilled;
  if (language === 'en') {
    let contracted = text;
    for (const [re, to] of EN_CONTRACTIONS) contracted = contracted.replace(re, to);
    if (contracted !== text) applied.push('CONTRACTION');
    text = contracted;
    /* CTO R4 fourth pass — an omitted apostrophe on a COUNTRY possessive ("brazils election") */
    const possessive = restoreCountryPossessives(text);
    if (possessive !== text) applied.push('POSSESSIVE');
    text = possessive;
    const discourse = text.replace(
      EN_DISCOURSE_NOW,
      (_m, lead: string, pre: string) => `${lead}${pre}`,
    );
    if (discourse !== text) applied.push('DISCOURSE_NOW');
    text = discourse;
  } else if (language === 'pl') {
    const discourse = text.replace(
      PL_DISCOURSE_NOW,
      (_m, lead: string, pre: string) => `${lead}${pre}`,
    );
    if (discourse !== text) applied.push('DISCOURSE_NOW');
    text = discourse;
  }
  /* the first letter of a sentence whose discourse marker was removed keeps its case as written */
  return { text: text.trim(), applied };
}
