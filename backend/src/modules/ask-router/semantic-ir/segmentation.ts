import { splitClauses } from '../clause-intent';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO RUN-3 STRUCTURAL RULING B — ONE SHARED SEVEN-LANGUAGE CLAUSE SEGMENTATION LAYER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ROOT CAUSE (Run 3, de / ar): interpreter-first turns had NO deterministic clause boundary. The
 * interpreter was asked to split the turn itself and, for "Wie ist … aufgebaut, und welche
 * Volksabstimmungen stehen als Nächstes an?", returned ONE current part — the stable half was erased.
 *
 * INVARIANT: before any semantic interpretation, every turn in every product language is segmented
 * into its likely semantic clauses by ONE layer; the interpreter then classifies the GIVEN clauses
 * (it can no longer merge them away). Segmentation identifies clause BOUNDARIES only — it never
 * assigns a job, a freshness or a route.
 *
 *   EN / PL           the existing deterministic splitter (clause-intent.ts) — unchanged, so the
 *                     EN / PL readers keep exactly their behaviour
 *   FR DE ES PT AR    universal boundaries: sentence ends (. ? ! ؟ followed by space), semicolons
 *                     (; ؛), spaced dashes (— –), and a SAFE conjunction hint: a coordinating
 *                     conjunction that opens a NEW question / request ("…, und welche…", "…، وما…",
 *                     "… y cuánta…"). One small closed list per language of conjunctions and
 *                     question / request openers — boundary hints, not a routing stack.
 */
export interface ClauseSpan {
  readonly start: number;
  readonly end: number;
}

/* a coordinating conjunction followed by a question / request opener (closed, boundary-only) */
const CONJUNCTION_HINT: Readonly<Record<string, RegExp>> = {
  fr: /\s*,?\s+(?=(?:et|mais|puis)\s+(?:que|qu['’]|quel|quels|quelle|quelles|comment|pourquoi|combien|qui|quand|où|est-ce|dis|dites|explique|expliquez|donne|donnez|indique|indiquez)(?![\p{L}]))/giu,
  de: /\s*,?\s+(?=(?:und|aber|sowie)\s+(?:was|wie|welche|welcher|welches|welchen|warum|wieso|weshalb|wer|wann|wo|wieviel|ob|erkläre|erklär|sag|sage|nenne|gib)(?![\p{L}]))/giu,
  es: /\s*,?\s+(?=(?:y|e|pero)\s+(?:qué|que|cómo|cuál|cuáles|cuánto|cuánta|cuántos|cuántas|por\s+qué|quién|quiénes|cuándo|dónde|si|dime|explica|explícame|indica|indícame)(?![\p{L}]))/giu,
  pt: /\s*,?\s+(?=(?:e|mas)\s+(?:que|o\s+que|qual|quais|como|quanto|quanta|quantos|quantas|por\s+que|porque|quem|quando|onde|se|diga|diz|explique|explica|indique|indica)(?![\p{L}]))/giu,
  ar: /\s*[،,]?\s+(?=(?:و|ثم\s+)(?:ما|ماذا|كيف|هل|لماذا|لم|من|متى|أين|أي|كم|اشرح|أخبرني)(?![\p{L}]))/gu,
};
/* sentence ends, semicolons and spaced dashes — language-independent */
const UNIVERSAL_BOUNDARY = /(?<=[.?!؟])\s+(?=\S)|\s*[;؛]\s*|\s+[—–]\s+/gu;

function spansFromCuts(text: string, cuts: readonly { at: number; skip: number }[]): ClauseSpan[] {
  const sorted = [...cuts].sort((a, b) => a.at - b.at);
  const spans: ClauseSpan[] = [];
  let start = 0;
  for (const c of sorted) {
    if (c.at <= start) continue;
    spans.push({ start, end: c.at });
    start = c.at + c.skip;
  }
  spans.push({ start, end: text.length });
  /* trim each span and drop those without a letter */
  return spans
    .map(({ start: s, end: e }) => {
      let a = s;
      let b = e;
      while (a < b && /\s/u.test(text[a])) a++;
      while (b > a && /\s/u.test(text[b - 1])) b--;
      return { start: a, end: b };
    })
    .filter(({ start: s, end: e }) => /\p{L}/u.test(text.slice(s, e)));
}

/** THE SHARED LAYER — the clause spans of a turn, for any of the seven product languages. */
export function segmentTurn(text: string, language: string): ClauseSpan[] {
  if (language === 'en' || language === 'pl') {
    /* EN / PL: the existing deterministic splitter, mapped to spans in order */
    const parts = splitClauses(text, language);
    let cursor = 0;
    const out: ClauseSpan[] = [];
    for (const part of parts) {
      const at = text.indexOf(part, cursor);
      const start = at < 0 ? cursor : at;
      const end = at < 0 ? Math.min(text.length, cursor + part.length) : at + part.length;
      out.push({ start, end });
      cursor = end;
    }
    return out.length === 0 ? [{ start: 0, end: text.length }] : out;
  }
  const cuts: { at: number; skip: number }[] = [];
  for (const m of text.matchAll(UNIVERSAL_BOUNDARY))
    cuts.push({ at: m.index ?? 0, skip: m[0].length });
  const hint = CONJUNCTION_HINT[language];
  if (hint !== undefined) {
    hint.lastIndex = 0;
    for (const m of text.matchAll(hint)) cuts.push({ at: m.index ?? 0, skip: m[0].length });
  }
  const spans = spansFromCuts(text, cuts);
  return spans.length === 0 ? [{ start: 0, end: text.length }] : spans;
}
