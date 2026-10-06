/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 LIVE-GATE REPAIR (P0-1) — A REQUESTED COLUMN IS NOT A PLACE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Live Alpha 2026-10-06 (fe96eb1, TEST A): "…Then use a compact table: What changed | Date | Why it
 * matters to the shop | Source link…" — the column name "Date" resolved to the city of Date,
 * Hokkaido, and Kenya research became Japan-scoped retrieval (TYPED_GEOGRAPHY JPN; Kenya lost).
 *
 * Words that describe the ANSWER'S SHAPE (columns, headers, fields) are output vocabulary, not
 * subject content. Inside an output-instruction context — a pipe-separated header, a
 * "columns / headers / fields:" list, a "table with / showing …" list, or "show / include / add the
 * date and source" — the format words below are blanked (same length, so every span still
 * indexes the reader's text) before geography and entities are read. Nothing else is touched:
 * a real place in the same sentence still resolves, and a genuine question about Date, Japan
 * (no output-instruction context) is unaffected.
 *
 * EN and PL. Deterministic, no model, no list of prompts.
 */
const FORMAT_WORDS = new Set([
  /* EN */
  'date', 'dates', 'dated', 'source', 'sources', 'link', 'links', 'url', 'development',
  'developments', 'impact', 'impacts', 'fact', 'facts', 'analysis', 'route', 'routes', 'location',
  'locations', 'table', 'tables', 'summary', 'summaries', 'publisher', 'publication', 'event',
  'events', 'uncertainty', 'status', 'title', 'headline', 'notes', 'note', 'category', 'type',
  'evidence', 'confidence', 'risk', 'event/publication', 'column', 'columns',
  /* PL */
  'data', 'daty', 'źródło', 'źródła', 'link', 'rozwój', 'wydarzenie', 'wydarzenia', 'wpływ',
  'fakty', 'analiza', 'trasa', 'lokalizacja', 'tabela', 'podsumowanie', 'wydawca',
]);

/* the start of an output-instruction list (up to the end of its sentence) */
const LIST_MARKERS = [
  /\b(?:columns?|column\s+names?|headers?|headings?|fields?)\s*(?:[:\-–—]|for|of|with)?\s*/giu,
  /\btable\s*(?:[:\-–—]|with|showing|containing|listing|of|that\s+(?:shows|lists))\s*:?\s*/giu,
  /\b(?:show|showing|include|including|add|give|list|with)\s+(?:the\s+|each\s+|its\s+|their\s+)?(?=(?:date|dates|source|sources|link|links|impact|facts|analysis|route|location|summary|development|publisher)\b)/giu,
  /(?<![\p{L}\p{N}])(?:kolumn\p{L}*|nagłów\p{L}*|tabel\p{L}*)\s*:?\s*/giu,
];

const SENTENCE_END = /[.!?\n]/u;
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’/-]*/gu;

/** Blank only the FORMAT words inside [start, end) of text. */
function maskSpan(chars: string[], text: string, start: number, end: number): void {
  WORD.lastIndex = 0;
  const span = text.slice(start, end);
  for (const m of span.matchAll(WORD)) {
    if (!FORMAT_WORDS.has(m[0].toLowerCase())) continue;
    const at = start + (m.index ?? 0);
    for (let i = 0; i < m[0].length; i += 1) chars[at + i] = ' ';
  }
}

/** The sentence (between sentence ends) that contains index i. */
function sentenceAround(text: string, i: number): [number, number] {
  let s = i;
  while (s > 0 && !SENTENCE_END.test(text[s - 1]!)) s -= 1;
  let e = i;
  while (e < text.length && !SENTENCE_END.test(text[e]!)) e += 1;
  return [s, e];
}

/**
 * The reader's text with output-format vocabulary blanked inside output-instruction contexts.
 * Same length as the input. Returns the input unchanged when no such context exists.
 */
export function maskOutputVocabulary(text: string): string {
  /* UTF-16 units, exactly like the reader spans (a code-point array would shift indices) */
  const units = text.split('');
  let touched = false;
  /* 1 · pipe-separated headers: every sentence holding two or more "|" is a header row */
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '|') continue;
    const [s, e] = sentenceAround(text, i);
    if ((text.slice(s, e).match(/\|/g) ?? []).length >= 2) {
      maskSpan(units, text, s, e);
      touched = true;
      i = e;
    }
  }
  /* 2 · explicit list markers: the rest of their sentence */
  for (const marker of LIST_MARKERS) {
    marker.lastIndex = 0;
    for (const m of text.matchAll(marker)) {
      const from = (m.index ?? 0) + m[0].length;
      let end = from;
      while (end < text.length && !SENTENCE_END.test(text[end]!)) end += 1;
      maskSpan(units, text, m.index ?? 0, end);
      touched = true;
    }
  }
  return touched ? units.join('') : text;
}

/** True when `word` is output-format vocabulary (exported for the generation contract). */
export function isFormatWord(word: string): boolean {
  return FORMAT_WORDS.has(word.toLowerCase());
}
