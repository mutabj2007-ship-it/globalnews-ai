/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK FIRST-ANSWER RETRIEVAL R3 — THE ANSWER'S FORMAT IS NOT THE QUESTION'S SUBJECT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE MEASURED DEFECT (Production operation 0b4985f8, 2026-09-30). The reader asked
 *
 *   "What has changed in Poland's economy? Give the dates and cite the sources."
 *
 * and the second sentence — an instruction about how to ANSWER — travelled into
 * retrieval. The provider phrase became "What has changed in Poland s economy Give
 * the dates and cite the sources", the multi-word relevance gate then required
 * "give", "dates", "cite" and "sources" in a headline, and every candidate was
 * rejected. Offline, the same unchanged gate admits economy reporting for the
 * subject alone and still rejects unrelated Polish stories.
 *
 * WHAT THIS DOES. It separates RECOGNISED answer-format instructions from the
 * text that retrieval derives its subject from. It is deterministic, closed and
 * bilingual (EN/PL), and it removes only:
 *
 *   1. whole TRAILING sentences made only of format instructions
 *      ("Give the dates and cite the sources.", "Podaj daty i źródła."), and
 *   2. one TRAILING clause, joined by a comma, a dash or "and"/"i"/"oraz", that is
 *      only a format instruction ("…, with dates and sources", "… and cite sources").
 *
 * An instruction is a directive verb (give, cite, list, podaj, wymień …) or a
 * "with/z" phrase whose objects are ONLY format nouns (dates, sources, links,
 * citations, daty, źródła …), or a bare presentation directive ("be brief",
 * "in bullet points", "krótko", "w punktach"). "dates", "sources" or "change"
 * anywhere else in a question are never touched: "What are Poland's energy
 * sources?" and "Give me the latest on sources of inflation" have no trailing
 * instruction and are returned unchanged.
 *
 * WHAT IT NEVER DOES. It never changes what the reader sees or what the model
 * receives — the model still gets the whole question and honours the instruction.
 * It never removes a time bound ("this week", "w tym tygodniu"), geography, an
 * entity or a source attribution. It never empties a question: if fewer than two
 * content words would remain, the text is returned unchanged.
 */

const EN_DIRECTIVE_VERB =
  '(?:please\\s+)?(?:give|provide|include|list|cite|show|add|mention|quote|attach|link|reference|supply|state|note)(?:\\s+(?:me|us))?';
const PL_DIRECTIVE_VERB =
  '(?:prosz[ęe]\\s+)?(?:podaj(?:cie)?|wymie[ńn](?:cie)?|wska[żz](?:cie)?|dodaj(?:cie)?|za[łl][ąa]cz(?:cie)?|zacytuj(?:cie)?|cytuj(?:cie)?|przytocz(?:cie)?|poka[żz](?:cie)?|uwzgl[ęe]dnij(?:cie)?)(?:\\s+(?:mi|nam))?';

/* Determiners/qualifiers that may precede a format noun. */
const EN_QUALIFIER =
  '(?:(?:the|your|all|any|some|relevant|exact|specific|key|main|original|publication|release|report|article|news)\\s+)*';
const PL_QUALIFIER =
  '(?:(?:wszystkie|wszystkich|dok[łl]adne|dok[łl]adnych|konkretne|g[łl][óo]wne|odpowiednie|oryginalne)\\s+)*';

/* ONLY format nouns. Topic nouns never belong here. */
const EN_FORMAT_NOUN =
  '(?:dates?|sources?|citations?|references?|links?|urls?|timestamps?|times\\s+and\\s+dates|publication\\s+dates?)';
const PL_FORMAT_NOUN =
  '(?:daty\\s+publikacji|datami|daty|dat[ęey]?|[źz]r[óo]d(?:[łl]ami|[łl]a|[łl]o|e[łl])|link(?:ami|i|ów|ow)?|odno[śs]nik(?:ami|i|ów|ow)?|cytat(?:ami|y|ów|ow)?|przypis(?:ami|y|ów|ow)?)';

const EN_NOUN_LIST = `${EN_QUALIFIER}${EN_FORMAT_NOUN}(?:\\s*(?:,|and|&)\\s*${EN_QUALIFIER}${EN_FORMAT_NOUN})*`;
const PL_NOUN_LIST = `${PL_QUALIFIER}${PL_FORMAT_NOUN}(?:\\s*(?:,|i|oraz|a\\s+tak[żz]e)\\s*${PL_QUALIFIER}${PL_FORMAT_NOUN})*`;

/* Format units: an instruction whose objects are ONLY format nouns. May form a trailing clause. */
const EN_FORMAT_UNIT = [
  `${EN_DIRECTIVE_VERB}\\s+${EN_NOUN_LIST}(?:\\s+(?:for\\s+(?:each|every)\\s+\\w+|you\\s+used|used))?`,
  `(?:with|including)\\s+${EN_NOUN_LIST}`,
].join('|');
const PL_FORMAT_UNIT = [
  `${PL_DIRECTIVE_VERB}\\s+${PL_NOUN_LIST}`,
  `(?:z|ze|wraz\\s+z|wraz\\s+ze)\\s+(?:podaniem\\s+)?${PL_NOUN_LIST}`,
  `podaj[ąa]c\\s+${PL_NOUN_LIST}`,
].join('|');
/* Presentation units ("be brief", "w punktach", "please"): ONLY inside a whole directive sentence,
   never as a trailing "and …" clause, where a word such as "short" can be the reader's content. */
const PRESENTATION_UNIT = [
  '(?:be\\s+)?(?:brief|concise|short)',
  'keep\\s+it\\s+(?:brief|short|concise)',
  'briefly|concisely',
  'in\\s+(?:bullet\\s+points|bullets|a\\s+(?:table|list)|one\\s+paragraph|(?:a\\s+)?few\\s+sentences|\\d+\\s+(?:sentences|words|bullets))',
  'please|thanks|thank\\s+you',
  'kr[óo]tko|zwi[ęe][źz]le|w\\s+skr[óo]cie|w\\s+punktach|w\\s+tabeli|w\\s+jednym\\s+akapicie',
  'prosz[ęe]|dzi[ęe]kuj[ęe]',
].join('|');

const FORMAT_UNIT = `(?:${EN_FORMAT_UNIT}|${PL_FORMAT_UNIT})`;
const UNIT = `(?:${FORMAT_UNIT}|${PRESENTATION_UNIT})`;
const JOINER = '(?:\\s*(?:,|;|and|&|i|oraz|a\\s+tak[żz]e|also|too)\\s*|\\s+)';

/** A sentence made ONLY of directive units. */
const DIRECTIVE_SENTENCE = new RegExp(`^${UNIT}(?:${JOINER}${UNIT})*$`, 'iu');

/** A trailing clause made only of FORMAT units, joined to the subject. */
const DIRECTIVE_TRAILING_CLAUSE = new RegExp(
  `(?:\\s*[,;]\\s*|\\s+[-–—]\\s+|\\s+(?:and|i|oraz)\\s+)(${FORMAT_UNIT}(?:${JOINER}${FORMAT_UNIT})*)\\s*$`,
  'iu',
);

const TERMINAL = /[\s?!.…]+$/u;

export interface ResponseDirectiveSplit {
  /** The text retrieval derives its subject from. Unchanged when nothing was recognised. */
  readonly subject: string;
  /** The recognised instructions, in reading order, as the reader wrote them. */
  readonly directives: readonly string[];
}

function contentWordCount(text: string): number {
  return text.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2).length;
}

/** Sentences with their own terminal punctuation kept. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.?!…])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function splitResponseDirectives(question: string): ResponseDirectiveSplit {
  const original = question.trim();
  if (original.length === 0) return { subject: question, directives: [] };

  const parts = sentences(original);
  const directives: string[] = [];

  /* 1 · whole trailing directive sentences — never the first sentence. */
  while (parts.length > 1) {
    const last = parts[parts.length - 1];
    const bare = last.replace(TERMINAL, '');
    if (!DIRECTIVE_SENTENCE.test(bare)) break;
    directives.unshift(bare);
    parts.pop();
  }

  /* 2 · one trailing directive clause on the (new) last sentence. */
  if (parts.length > 0) {
    const lastIndex = parts.length - 1;
    const last = parts[lastIndex];
    const terminal = last.match(TERMINAL)?.[0].trim() ?? '';
    const bare = last.replace(TERMINAL, '');
    const clause = bare.match(DIRECTIVE_TRAILING_CLAUSE);
    if (clause && clause.index !== undefined) {
      const kept = bare.slice(0, clause.index).trimEnd();
      if (contentWordCount(kept) >= 2) {
        directives.push(clause[1].trim());
        parts[lastIndex] = `${kept}${terminal}`;
      }
    }
  }

  const subject = parts.join(' ');
  /* A question that is ONLY instructions has no subject to protect: leave it as written. */
  const onlyInstructions = DIRECTIVE_SENTENCE.test(subject.replace(TERMINAL, ''));
  if (directives.length === 0 || onlyInstructions || contentWordCount(subject) < 2) {
    return { subject: question, directives: [] };
  }
  return { subject, directives };
}

/** The retrieval-subject text for a question — the question itself when nothing was recognised. */
export function retrievalSubjectOf(question: string): string {
  return splitResponseDirectives(question).subject;
}

/*
  ASK R3 RETRIEVAL POLICY CLOSEOUT R2 — the reader explicitly asked for DATES. Read only from the
  recognised trailing instructions above ("Give the dates and cite the sources", "Podaj daty"),
  never from topic words elsewhere. It selects presentation only (show each source's labelled
  publication/reporting date); it never creates or infers an event date.
*/
const DATE_REQUEST =
  /(?:^|[^\p{L}])(?:dates?|timestamps?|times\s+and\s+dates|publication\s+dates?|daty(?:\s+publikacji)?|datami|dat[ęey]?)(?=$|[^\p{L}])/iu;

export function requestsDates(question: string): boolean {
  return splitResponseDirectives(question).directives.some((directive) =>
    DATE_REQUEST.test(directive),
  );
}
