import { readDecisionSupport } from '../decision-support';
import { plTolerant } from '../pl-tolerant';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 SEMANTIC IR §9–§10, §17–§18 — STRUCTURED OBJECTIVE, CHOICE SET, CHOICE QUESTION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ObjectiveState is a STRUCTURED slot, never a truncated surface string: the complete semantic
 * clause the reader used to state what matters ("The thing that matters most to me is access to
 * skilled engineers", "I care more about reliability than raw speed", "Zależy mi na tym, żeby…,
 * ale mam tylko 20 minut dziennie"), split into the criterion, an explicit preference over an
 * alternative, and stated constraints — with the turn and span it came from.
 *
 * SAFETY (§10): an objective comes ONLY from the reader's own turns. Model prose is never read
 * here, and a ConversationArtifact (model work) is a separate type: it can never become a
 * UserObjective. A newer explicit objective replaces an older one.
 *
 * The CHOICE SET is the options the reader named ("torn between index funds, a high-yield savings
 * account and overpaying the mortgage", "Compare Poland, Portugal and Romania"). A CHOICE
 * QUESTION ("which would you pick?", "so which one is best?", "które z nich polecasz?") is resolved
 * against this bounded state; "best for what?" is asked only when no objective exists at all.
 */
export interface ObjectiveState {
  /** the criterion, in the reader's words (the full clause, normalized whitespace) */
  readonly criterion: string;
  /** "X more than Y" / "X over Y" / "X rather than Y": the preferred and the dispreferred value */
  readonly prefer: string | null;
  readonly over: string | null;
  /** a constraint stated with it ("but I only have 20 minutes a day") */
  readonly constraints: readonly string[];
  /** the reader's turn (0-based, oldest first) and the span of the clause in that turn */
  readonly sourceTurn: number;
  readonly sourceSpan: readonly [number, number];
  /** what is being decided, when the reader said it ("choosing a laptop for university") */
  readonly target: string | null;
  /** true when it came from an EARLIER turn than the one being routed */
  readonly inherited: boolean;
}

type Lang = 'en' | 'pl';

/* the cue that introduces an objective; the objective is the REST OF ITS SENTENCE */
const EN_OBJECTIVE_CUE =
  /\b(?:(?:the\s+)?(?:one\s+)?(?:thing|factor|criterion|part|aspect)\s+(?:that\s+)?(?:i\s+care\s+about\s+most|matters?\s+(?:the\s+)?most(?:\s+to\s+(?:me|us))?|i\s+value\s+most)\s+(?:is|are)|what\s+(?:i|we)\s+(?:really\s+|mostly\s+)?(?:care\s+about|value|want)(?:\s+most)?\s+(?:is|are)|what\s+matters\s+(?:the\s+)?(?:most\s+)?(?:to\s+(?:me|us)\s+)?(?:is|are)|(?:my|our)\s+(?:main\s+|top\s+|biggest\s+|number\s+one\s+|first\s+|primary\s+|only\s+|real\s+)?(?:priority|priorities|goal|goals|objective|objectives|aim|concern|criterion|requirement)\s+(?:here\s+)?(?:is|are)|the\s+(?:main\s+|top\s+|key\s+)?(?:goal|priority|objective|aim)\s+(?:here\s+)?is|for\s+(?:me|us),?\s+the\s+(?:key|priority|most\s+important\s+thing|main\s+thing)\s+is|(?:i|we)\s+(?:mostly\s+|mainly\s+|really\s+|primarily\s+)?care\s+(?:most\s+|more\s+)?about|(?:i|we)\s+(?:am|are|'m|'re)\s+optimi[sz]ing\s+for|(?:i|we)\s+value\s+|(?:i|we)\s+(?:want|need)\s+to\s+(?=(?:maximi[sz]e|minimi[sz]e|optimi[sz]e|reduce|cut|lower|increase|keep|avoid)\b)|(?:evaluate|compare|assess|rank|weigh)\b[^.?!]{0,80}?\b(?:for|in\s+terms\s+of|with\s+the\s+goal\s+of|aimed\s+at)\s+(?=(?:reducing|increasing|improving|cutting|growing|lowering|raising|boosting|minimi[sz]ing|maximi[sz]ing|getting|finding|keeping|retaining|winning|attracting|saving|making|building|protecting)\b))/i;
const PL_OBJECTIVE_CUE = plTolerant(
  /(?:najważniejsze\s+(?:dla\s+(?:mnie|nas)\s+)?(?:jest|są)(?:\s+to)?,?(?:\s+(?:żeby|by|aby|że))?|(?:najbardziej\s+|bardziej\s+|głównie\s+|przede\s+wszystkim\s+)?zależy\s+(?:mi|nam)\s+(?:głównie\s+|najbardziej\s+|przede\s+wszystkim\s+)?na(?:\s+tym,?(?:\s+(?:żeby|by|aby|że))?)?|(?:najbardziej\s+)?liczy\s+się\s+(?:dla\s+(?:mnie|nas)\s+)?(?:przede\s+wszystkim\s+)?|(?:moim|naszym)\s+(?:głównym\s+)?(?:celem|priorytetem|kryterium)\s+jest|priorytetem\s+(?:jest|są)|chodzi\s+(?:mi|nam)\s+(?:głównie\s+|przede\s+wszystkim\s+)?o(?:\s+to,?(?:\s+(?:żeby|by|aby))?)?|(?:oceń|porównaj|zestaw)\p{L}*[^.?!]{0,80}?\s+pod\s+kątem)/iu,
);
/* "X more than Y" / "X over Y" / "X rather than Y" inside the criterion */
const EN_PREFERENCE =
  /^(.{2,}?)\s+(?:more\s+than|rather\s+than|than|over|above|instead\s+of)\s+(.{2,})$/i;
const PL_PREFERENCE = plTolerant(
  /^(.{2,}?)\s+(?:niż|bardziej\s+niż|zamiast|ponad)\s+(?:na\s+)?(.{2,})$/iu,
);
/* a constraint joined to it ("…, but I only have…", "…, ale mam tylko…") */
const EN_CONSTRAINT_SPLIT =
  /,?\s+(?=(?:even\s+if|even\s+though|as\s+long\s+as|provided\s+(?:that\s+)?|unless)\s)|,?\s+(?:but|although|though|while|and\s+(?:i|we)\s+only)\s+/i;
const PL_CONSTRAINT_SPLIT = plTolerant(
  /,?\s+(?=(?:nawet\s+jeśli|nawet\s+jeżeli|o\s+ile|pod\s+warunkiem|chyba\s+że)\s)|,?\s+(?:ale|choć|chociaż|jednak|przy\s+czym)\s+/iu,
);
/* what is being decided ("choosing a laptop", "picking a country to open an office in") */
const EN_TARGET =
  /\b(?:choosing|picking|selecting|deciding\s+(?:on|between)|looking\s+for|shopping\s+for|torn\s+between|buying|planning)\s+([^.?!]{3,120})/i;
const PL_TARGET = plTolerant(
  /(?:wybieram|wybieramy|szukam|szukamy|kupuję|planuję|zastanawiam\s+się\s+nad)\s+([^.?!]{3,120})/iu,
);

function sentenceRest(text: string, from: number): readonly [number, number] {
  const tail = text.slice(from);
  const stop = tail.search(/[.?!;](?:\s|$)|\n/);
  return [from, stop < 0 ? text.length : from + stop];
}

const tidy = (s: string): string =>
  s
    .replace(/\s+/g, ' ')
    .replace(/^[,:;\s-]+|[,:;\s-]+$/g, '')
    .trim();

/** The objective ONE reader turn states, as a structured slot (null when it states none). */
export function readObjectiveState(
  text: string,
  language: string,
  sourceTurn: number,
  inherited: boolean,
): ObjectiveState | null {
  const lang: Lang = language === 'pl' ? 'pl' : 'en';
  const targetMatch = (lang === 'pl' ? PL_TARGET : EN_TARGET).exec(text);
  const target = targetMatch === null ? null : tidy(targetMatch[1].split(/[.?!]/)[0]);
  const decision = readDecisionSupport(text, lang);
  const cue = (lang === 'pl' ? PL_OBJECTIVE_CUE : EN_OBJECTIVE_CUE).exec(text);
  let span: readonly [number, number] | null = null;
  if (cue !== null) span = sentenceRest(text, (cue.index ?? 0) + cue[0].length);
  else if (decision?.objective != null) {
    const at = text.indexOf(decision.objective);
    span = at < 0 ? null : sentenceRest(text, at);
    if (span === null)
      return {
        criterion: decision.objective,
        prefer: null,
        over: null,
        constraints: [],
        sourceTurn,
        sourceSpan: [0, text.length],
        target,
        inherited,
      };
  }
  if (span === null) return null;
  const clause = tidy(text.slice(span[0], span[1]));
  if (clause.length < 3) return null;
  const [main, ...rest] = clause.split(lang === 'pl' ? PL_CONSTRAINT_SPLIT : EN_CONSTRAINT_SPLIT);
  const criterion = tidy(main);
  if (criterion.length < 2) return null;
  const pref = (lang === 'pl' ? PL_PREFERENCE : EN_PREFERENCE).exec(criterion);
  return {
    criterion,
    prefer: pref === null ? null : tidy(pref[1]),
    over: pref === null ? null : tidy(pref[2]),
    constraints: rest.map(tidy).filter((c) => c.length > 0),
    sourceTurn,
    sourceSpan: span,
    target,
    inherited,
  };
}

/**
 * The conversation's objective: the NEWEST one the reader stated, over their own turns (oldest
 * first; the last entry is the turn being routed). Never read from model output.
 */
export function conversationObjectiveState(
  readerTurnsOldestFirst: readonly string[],
  language: string,
): ObjectiveState | null {
  const current = readerTurnsOldestFirst.length - 1;
  for (let i = current; i >= 0; i--) {
    const o = readObjectiveState(readerTurnsOldestFirst[i], language, i, i < current);
    if (o !== null) return o;
  }
  return null;
}

/* ── the CHOICE SET the reader named ─────────────────────────────────────────────────────── */
const EN_CHOICE_FRAME =
  /\b(?:between|torn\s+between|choose\s+(?:from|between|among)|pick\s+(?:from|between|among)|deciding\s+between|options\s+(?:are|being)|compare|comparing|considering)\s+([^.?!]{3,200})/i;
const PL_CHOICE_FRAME = plTolerant(
  /(?:między|pomiędzy|wybieram\s+(?:między|spośród)|porównaj|porównując|rozważam|opcje\s+to)\s+([^.?!]{3,200})/iu,
);
const EN_OR_LIST = /([^,.?!]{2,60}(?:,\s*[^,.?!]{2,60})*,?\s+or\s+[^,.?!]{2,60})\s*\?/i;
const PL_OR_LIST = plTolerant(
  /([^,.?!]{2,60}(?:,\s*[^,.?!]{2,60})*,?\s+czy\s+[^,.?!]{2,60})\s*\?/iu,
);

/** The options the reader named in one turn (bounded: at most six, each at most 80 chars). */
export function readChoiceSet(text: string, language: string): string[] {
  const lang: Lang = language === 'pl' ? 'pl' : 'en';
  const m =
    (lang === 'pl' ? PL_CHOICE_FRAME : EN_CHOICE_FRAME).exec(text) ??
    (lang === 'pl' ? PL_OR_LIST : EN_OR_LIST).exec(text);
  if (m === null) return [];
  const list = m[1]
    .split(
      lang === 'pl' ? /\s*,\s*|\s+(?:i|oraz|a|czy|lub|albo)\s+/iu : /\s*,\s*|\s+(?:and|or)\s+/i,
    )
    .map((s) => tidy(s.replace(/^(?:the|a|an)\s+/i, '')))
    .filter((s) => s.length >= 2 && s.length <= 80);
  return list.length >= 2 ? list.slice(0, 6) : [];
}

/* ── the CHOICE QUESTION: a choice resolved against the bounded state ─────────────────────── */
const EN_CHOICE_QUESTION =
  /^\s*(?:(?:so|ok(?:ay)?|alright|right|well|then|and|given\s+(?:all\s+)?(?:that|this),?)[,.]?\s+)*(?:which|what)\s+(?:one\s+|option\s+|of\s+(?:them|those|these|the\s+(?:options|three|two|four))\s+)?(?:would|should|do|did|could|will)\s+(?:you|i|we)\s+(?:pick|choose|go\s+(?:with|for)|recommend|suggest|take|buy|prefer|opt\s+for|back)\b|^\s*(?:(?:so|ok(?:ay)?|alright|right|well|then|given\s+(?:all\s+)?(?:that|this),?)[,.]?\s+)*(?:which|what)\s+(?:one\s+|option\s+|of\s+(?:them|those|these)\s+)?(?:is|would\s+be|seems?|fits?|works?|suits?)\s+(?:the\s+)?(?:best|better|right|strongest|most\s+suitable|best\s+fit|ideal|a\s+better\s+fit)\b|^\s*(?:(?:so|ok(?:ay)?|alright|right|well|then|given\s+(?:all\s+)?(?:that|this),?)[,.]?\s+)*(?:which|what)\s+(?:one\s+|option\s+)?(?:fits|suits|works)\s+(?:best|better)\b|\b(?:what(?:'s|\s+is)\s+your\s+(?:pick|recommendation|choice)|your\s+(?:pick|recommendation)\s*\?)/i;
const PL_CHOICE_QUESTION = plTolerant(
  /^\s*(?:(?:no|to|więc|dobra|ok|okej|a|i)[,.]?\s+)*(?:któr\p{L}*|co)\s+(?:z\s+(?:nich|tych|nich\s+wszystkich)\s+)?(?:(?:byś|by\s+pan|by\s+pani)\s+)?(?:wybrać|wybierasz|wybrałbyś|wybrałabyś|polecasz|poleciłbyś|poleciłabyś|rekomendujesz|doradzasz|wybrałbym|wziąć|bierzesz)(?![\p{L}])|^\s*(?:(?:no|to|więc|dobra|ok|okej|a|i)[,.]?\s+)*(?:któr\p{L}*)\s+(?:z\s+(?:nich|tych)\s+)?(?:jest|będzie|wydaje\s+się)\s+(?:najlepsz\p{L}*|lepsz\p{L}*|najwłaściwsz\p{L}*|najodpowiedniejsz\p{L}*)(?![\p{L}])|^\s*(?:(?:no|to|więc|dobra|ok|okej|a|i)[,.]?\s+)*(?:któr\p{L}*)\s+(?:wariant|opcj\p{L}*|wersj\p{L}*)\s+(?:wybrać|polecasz|jest\s+najlepsz\p{L}*)/iu,
);

/** Is this turn a choice between options already under discussion (not a new decision)? */
export function readChoiceQuestion(text: string, language: string): boolean {
  return (language === 'pl' ? PL_CHOICE_QUESTION : EN_CHOICE_QUESTION).test(text.trim());
}
