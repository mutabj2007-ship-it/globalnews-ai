/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 LIVE-GATE REPAIR (P0-2) — THE READER'S OUTPUT CONTRACT, CARRIED EXPLICITLY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Live Alpha 2026-10-06 (fe96eb1, TEST A): the question asked for "a two-sentence summary", "a
 * compact table: What changed | Date | Why it matters to the shop | Source link", "fewer than three
 * if…", "one practical thing the shopkeeper should check next" and "under 250 words". The answer had
 * none of it: the instructions reached the model only as generic rules beside the question.
 *
 * The full original question is still sent verbatim. In addition, its OUTPUT instructions are read
 * deterministically (no model, EN + PL forms) into a contract that is rendered as its own block of
 * the generation request: structure in order, the exact requested columns, the item cap, the source
 * requirement, the facts-vs-analysis distinction, the closing instruction and the word limit. They
 * are output constraints — never retrieval topics (retrieval reads the masked text, P0-1).
 */
export interface OutputContract {
  readonly openingSentences: number | null;
  readonly table: { readonly columns: readonly string[] } | null;
  readonly itemCap: number | null;
  readonly fewerAllowed: boolean;
  readonly sourcePerItem: boolean;
  readonly factsVsAnalysis: boolean;
  readonly closing: string | null;
  readonly wordLimit: number | null;
}

const NUMBER: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  jeden: 1, jedno: 1, jedna: 1, dwa: 2, dwie: 2, trzy: 3, cztery: 4, pięć: 5,
};
const num = (raw: string | undefined): number | null => {
  if (raw === undefined) return null;
  const n = /^\d+$/.test(raw) ? Number(raw) : NUMBER[raw.toLowerCase()];
  return n !== undefined && Number.isInteger(n) && n > 0 && n < 10_000 ? n : null;
};

const sentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

function columnsOf(text: string): string[] {
  /* a pipe header: "What changed | Date | Why it matters | Source link" */
  for (const s of sentences(text)) {
    if ((s.match(/\|/g) ?? []).length >= 2) {
      const after = s.replace(
        /^.*?(?:table|tabel\p{L}*|columns?|headers?|headings?|kolumn\p{L}*|nagłów\p{L}*)\s*[:\-–—]?\s*/iu,
        '',
      );
      const cells = after
        .split('|')
        .map((c) => c.replace(/[.:;]+$/u, '').trim())
        .filter((c) => c.length > 0 && c.length <= 60);
      if (cells.length >= 2) return cells;
    }
  }
  /* "table with/showing: a, b, and c" · "columns: a, b, c" · "kolumny: a, b" */
  const m =
    /\b(?:table\s*(?:with|showing|containing|listing|of)?|columns?|kolumn\p{L}*)\s*[:\-–—]\s*([^.!?\n]+)/iu.exec(
      text,
    ) ??
    /\btable\s+(?:with|showing|containing|listing)\s+([^.!?\n]+)/iu.exec(text);
  if (m?.[1] === undefined) return [];
  return m[1]
    .split(/\s*[,;]\s*|\s+(?:and|i|oraz)\s+/u)
    .map((c) =>
      c
        .replace(/^(?:and|i|oraz|a|an|the)\s+/iu, '')
        .replace(/^(?:a\s+)?clickable\s+/iu, '')
        .replace(/[.:;]+$/u, '')
        .trim(),
    )
    .filter((c) => c.length > 0 && c.length <= 60);
}

export function readOutputContract(question: string): OutputContract {
  const text = question.replace(/\s+/gu, ' ').trim();
  const lower = text.toLowerCase();
  const opening =
    /\b(?:start|begin|open)\s+with\s+(?:a\s+|an\s+)?(\d+|one|two|three|four|five)[-\s]sentence\s+summary/iu.exec(
      text,
    ) ?? /\bzacznij\s+od\s+(\d+|jednego|dwóch|trzech)[-\s]?zdaniow/iu.exec(text);
  const tableAsked =
    /\b(?:table|tabulate|tabular)\b|(?<![\p{L}])tabel\p{L}*/iu.test(text) || /\|[^|]+\|/u.test(text);
  const columns = tableAsked ? columnsOf(question) : [];
  const cap =
    /\b(?:up\s+to|at\s+most|no\s+more\s+than|maximum\s+of|the|top)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:(?:most\s+)?[\p{L}-]+\s+){0,3}?(?:developments?|items?|stories|events?|findings?|changes?|updates?)\b/iu.exec(
      text,
    ) ??
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:(?:most\s+)?[\p{L}-]+\s+){0,2}?(?:developments?|items?|stories|events?|findings?)\b/iu.exec(
      text,
    ) ??
    /(?<![\p{L}])(?:do|maksymalnie|najwyżej)\s+(\d+|trzech|pięciu)\s+/iu.exec(text);
  const closingSentence = sentences(question).find((s) =>
    /^(?:and\s+)?(?:finish|end|conclude|close|wrap\s+up)\b|^(?:na\s+koniec|zakończ)/iu.test(s),
  );
  /* the word limit for the WHOLE answer ("Keep the entire answer under 250 words"); a limit inside
     the closing sentence ("in no more than 60 words") stays part of that closing instruction */
  const limits = [...text.matchAll(/\b(?:under|below|no\s+more\s+than|at\s+most|maximum\s+of|within|max\.?)\s+(\d{2,4})\s+words\b|(?<![\p{L}])(?:poniżej|maksymalnie|do)\s+(\d{2,4})\s+słów/giu)];
  const wholeLimit = limits.find((m) => closingSentence === undefined || !closingSentence.includes(m[0]));
  const toNumber = (raw: string | undefined): number | null =>
    raw === undefined ? null : (num(raw) ?? (/^two$/i.test(raw) ? 2 : null));
  return {
    openingSentences: toNumber(opening?.[1]) ?? (opening?.[1]?.startsWith('dw') ? 2 : opening?.[1]?.startsWith('trz') ? 3 : null),
    table: tableAsked ? { columns } : null,
    itemCap: num(cap?.[1]),
    fewerAllowed: /\bfewer\b|\bonly\s+those\b|\bif\s+(?:the\s+)?evidence\s+is\s+insufficient|mniej\s+niż/iu.test(text),
    sourcePerItem: /\bsources?\b|\blinks?\b|\bcitations?\b|źródł/iu.test(lower),
    factsVsAnalysis:
      /\b(?:distinguish|separate|keep)\b[^.]{0,80}\bfacts?\b[^.]{0,60}\b(?:analysis|opinion|forecasts?|speculation)\b|\bfacts?\b[^.]{0,40}\bfrom\s+(?:your\s+)?analysis\b|oddziel\p{L}*\s+fakty/iu.test(
        text,
      ),
    closing: closingSentence ?? null,
    wordLimit: wholeLimit === undefined ? null : Number(wholeLimit[1] ?? wholeLimit[2]),
  };
}

/** True when the reader gave at least one output instruction worth carrying. */
export function hasOutputContract(c: OutputContract): boolean {
  return (
    c.openingSentences !== null ||
    c.table !== null ||
    c.itemCap !== null ||
    c.closing !== null ||
    c.wordLimit !== null ||
    c.factsVsAnalysis
  );
}

/**
 * The contract as an ordered instruction block for the generation request. Rendered into the brief
 * ("summary", or "primaryDevelopment" + "additionalDevelopments" when the brief is two fields).
 */
export function renderOutputContract(c: OutputContract): string {
  if (!hasOutputContract(c)) return '';
  const lines: string[] = [];
  let step = 1;
  if (c.openingSentences !== null)
    lines.push(`${step++}. OPEN the brief with exactly ${c.openingSentences} sentence${c.openingSentences === 1 ? '' : 's'} summarising the answer.`);
  if (c.table !== null) {
    const cols =
      c.table.columns.length > 0
        ? `with EXACTLY these columns, in this order: ${c.table.columns.map((x) => `"${x}"`).join(' | ')}`
        : 'with the columns the question names';
    lines.push(
      `${step++}. Then ONE compact Markdown table (header row, |---| separator, one row per development) ${cols}. ` +
        'Cells come only from the supplied evidence; write "not reported" where the evidence is silent. ' +
        (c.sourcePerItem ? 'A source/link cell names the cited report’s publisher exactly as given in the evidence. ' : '') +
        'The table is part of the brief text, never omitted.',
    );
  }
  if (c.itemCap !== null)
    lines.push(
      `${step++}. At most ${c.itemCap} development${c.itemCap === 1 ? '' : 's'}${c.fewerAllowed ? '; give fewer if the evidence supports fewer, and say so' : ''}. Never fill a slot with a weakly related report.`,
    );
  if (c.factsVsAnalysis)
    lines.push(`${step++}. Keep reported FACTS apart from your ANALYSIS: label analysis as analysis.`);
  if (c.closing !== null)
    lines.push(`${step++}. END the brief with a short final paragraph that does exactly this: "${c.closing.replace(/"/g, "'")}"`);
  if (c.wordLimit !== null)
    lines.push(`${step++}. The whole brief stays under ${c.wordLimit} words.`);
  return (
    "THE READER'S OUTPUT CONTRACT (read from their own question; follow it exactly — it is about the " +
    'shape of the answer, not a topic to research):\n' +
    lines.join('\n')
  );
}
