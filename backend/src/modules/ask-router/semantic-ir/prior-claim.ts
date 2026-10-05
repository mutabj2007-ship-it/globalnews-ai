import { plTolerant } from '../pl-tolerant';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 ALPHA DEFECT RULING R-4 / R-5 — THE PRIOR-CLAIM VALIDITY FORM
 * ════════════════════════════════════════════════════════════════════════════
 *
 * LIVE DEFECT (Alpha op 5ac0e7b0, "Is it still true now?"): the turn re-examines a claim the
 * previous ANSWER made, but no reader knew the form, so it was routed as plain current news with
 * no referent: the claim was never checked and unrelated reporting was retrieved.
 *
 * THE FORM IS STRUCTURAL, not a phrase list: a REFERENT that can only point back into the
 * conversation (it / that / this / these / those / what you said) + a VALIDITY predicate about a
 * claim (true · accurate · correct · valid · right · the case · up to date · holds · stands ·
 * applies) + optional persistence / present markers (still · now · today · anymore …), and NOTHING
 * else in the turn. "Is it still true that Poland cut rates?" carries its own proposition and is
 * NOT this form; "Is it raining in Kigali now?" has no validity predicate and is NOT this form.
 *
 * EN / PL only (the deterministic readers). FR / DE / ES / PT / AR reach the same decision through
 * the one bounded interpreter verdict (reference + needsCurrentEvidence) against the same bounded
 * prior work — no regex bank for them.
 */
const EN_REFERENT = String.raw`(?:it|that|this|these|those|what\s+you\s+(?:said|wrote|told\s+me|concluded))`;
const EN_TAIL = String.raw`(?:\s+(?:still|now|today|anymore|any\s+more|at\s+present|these\s+days|right\s+now|as\s+of\s+(?:now|today)))*\s*[?.!]*\s*$`;
const EN_CLAIM_VALIDITY = new RegExp(
  String.raw`^\s*(?:(?:so|and|but|ok(?:ay)?)[,\s]+)?(?:` +
    /* is/are/was it still true / accurate / the case … */
    String.raw`(?:is|are|was|were)\s+${EN_REFERENT}\s+(?:still\s+)?(?:true|accurate|correct|valid|right|the\s+case|up\s+to\s+date|current)` +
    '|' +
    /* does/do it still hold / stand / apply / hold up / hold true … */
    String.raw`(?:does|do|would|will)\s+${EN_REFERENT}\s+(?:still\s+)?(?:hold(?:\s+(?:up|true))?|stand|apply)` +
    ')' +
    EN_TAIL,
  'i',
);

const PL_CLAIM_VALIDITY = plTolerant(
  /^\s*(?:(?:a|i|więc|ok)[,\s]+)?(?:czy\s+)?(?:to|tamto|te|ta|ten|co\s+(?:powiedział(?:eś|aś)|napisał(?:eś|aś)))\s+(?:jest\s+|są\s+)?(?:(?:nadal|wciąż|dalej|ciągle|jeszcze|dziś|dzisiaj|teraz|obecnie)\s+)*(?:prawda|prawdziw\p{L}*|aktualn\p{L}*|słuszn\p{L}*|trafn\p{L}*|poprawn\p{L}*|obowiązuje|się\s+(?:sprawdza|zgadza|utrzymuje))(?:\s+(?:nadal|wciąż|dalej|teraz|dziś|dzisiaj|obecnie))*\s*[?.!]*\s*$/iu,
);

/*
  R-4 — the CAUSAL self-attribution: "What made you say that?", "What led you to conclude this?",
  "Why did that make you think so?" ask for the reason behind the ASSISTANT's earlier statement. The
  past tense sits on the causal verb, not on "say", so the past-anchored self-attribution form
  (user-job.ts, referencesOwnPriorStatement) does not see it. Second person + a causal verb + a
  statement verb; Polish already marks the reader's past second person on the verb (-łeś / -łaś).
*/
const EN_CAUSAL_ATTRIBUTION =
  /\b(?:what|why)\s+(?:(?:has|had|did)\s+)?(?:made|makes|led|leads|caused|causes|prompted)\s+you\s+(?:to\s+)?(?:say|conclude|think|claim|write|suggest|recommend|believe|state|put)\b/i;

/** The turn asks for the reason behind an earlier answer by naming its cause. */
export function readCausalSelfAttribution(text: string, language: string): boolean {
  return language === 'en' && EN_CAUSAL_ATTRIBUTION.test(text);
}

/*
  R-4 PRECISION — only an ANAPHORIC attribution needs an earlier answer to mean anything. "Why did
  you say that?", "What made you conclude this?", "Dlaczego tak powiedziałeś?" point at content that
  is NOT in the turn. "You said growth was strong — how has it changed since 2020?" and "Dlaczego
  powiedziałeś, że inflacja spada?" STATE the attributed proposition themselves: they are
  answerable as asked, so an unbound thread never turns them into a clarification.
  EN: the statement verb ends the turn, alone or with a pronoun object (that / it / this / so …).
  PL: no propositional complement (że / iż / jakoby) follows the attribution.
*/
const EN_ANAPHORIC_OBJECT =
  /\b(?:say|said|mean|meant|conclude|concluded|think|thought|claim|claimed|write|wrote|suggest|suggested|recommend|recommended|call|called|put|state|stated|believe|believed)(?:\s+(?:that|it|this|so|these|those))?\s*[?.!]*\s*$/i;
const PL_PROPOSITIONAL = plTolerant(/(?:^|[\s,])(?:że|iż|jakoby)(?=$|[\s,])/iu);

/** The attributed content is anaphoric: it can only be found in an earlier answer. */
export function attributionIsAnaphoric(text: string, language: string): boolean {
  if (language === 'en') return EN_ANAPHORIC_OBJECT.test(text.trim());
  if (language === 'pl') return !PL_PROPOSITIONAL.test(text);
  return false;
}

/*
  R4 ALPHA R-3 SCOPE — the kinds of the server's ANSWER RECORDS (ask-v2 conversation-artifact.ts
  SERVER_ARTIFACT_KINDS; equality asserted in ask-r2-execution.alpha-defects.spec.ts). An answer
  record is bound ONLY by a turn that explicitly refers to the assistant's earlier answer
  (self-attribution, claim validity). Generic anaphora ("How does this affect households?") keeps
  following the READER's subject exactly as before answers were recorded; only model-emitted
  structures (frameworks, plans, diagnoses) are bound by it.
*/
export const ANSWER_RECORD_KINDS: readonly string[] = ['SOURCED_REPORT', 'REASONED_ANSWER', 'GOVERNED_RECORD_ANSWER'];

/** The turn asks only whether an earlier answer's claim (still) holds. */
export function readClaimValidity(text: string, language: string): boolean {
  if (language === 'pl') return PL_CLAIM_VALIDITY.test(text.trim());
  if (language === 'en') return EN_CLAIM_VALIDITY.test(text.trim());
  return false;
}

/*
  ════════════════════════════════════════════════════════════════════════════
  SHARED R4 CONTINUITY (CTO "EARLIER_TURN SUBJECT CARRY") — ANSWER-DEPENDENT REQUESTS
  ════════════════════════════════════════════════════════════════════════════
  Two more forms whose object exists ONLY in an earlier answer, built like the claim-validity form:
  an action on an answer-dependent object and NOTHING else in the turn (no subject of its own).
    EVIDENCE      "Show me the (official) evidence.", "What are the sources for that?",
                  "Pokaż oficjalne dowody.", "Jakie są źródła?" — the evidence BEHIND the answer
    CHANGE_SINCE  "What changed since the previous stage?", "Anything new since then?",
                  "Co się zmieniło od poprzedniego etapu?" — the anchor is the earlier answer
  "Show me the official evidence on Poland's inflation" names its own subject and is NOT this form.
  Bound → the turn inherits that answer's scope (provenance EARLIER_TURN); unbound → clarification
  (R-4). EN / PL only; FR–AR reach the bound reading through the interpreter verdict.
*/
export type AnswerRequestKind = 'EVIDENCE' | 'OFFICIAL_EVIDENCE' | 'CHANGE_SINCE';

const EN_LEAD = String.raw`^\s*(?:(?:so|and|but|ok(?:ay)?|please|now)[,\s]+)*`;
const EN_ANSWER_OBJECT = String.raw`(?:\s+(?:for|behind|of|supporting|on|backing)\s+(?:that|it|this|those|these|them|your\s+(?:answer|claims?|conclusions?|points?)|what\s+you\s+(?:said|wrote)))?`;
const EN_EVIDENCE_NOUN = String.raw`(?:evidence|sources?|source\s+(?:documents?|records?)|documents?|documentation|records?|proof|citations?|references?)`;
const EN_EVIDENCE = new RegExp(
  EN_LEAD +
    String.raw`(?:` +
    /* show / give / list … me the (official) evidence (for that) */
    String.raw`(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?(?:show|give|send|list|share|provide|cite|point\s+me\s+to)(?:\s+(?:me|us))?\s+(?:the\s+|your\s+)?(?:(official|primary|underlying|supporting|original)\s+)?${EN_EVIDENCE_NOUN}${EN_ANSWER_OBJECT}` +
    '|' +
    /* what / which are the (official) sources (for that) */
    String.raw`(?:what|which)\s+(?:is|are|was|were)\s+(?:the|your)\s+(?:(official|primary|underlying|supporting|original)\s+)?${EN_EVIDENCE_NOUN}${EN_ANSWER_OBJECT}` +
    '|' +
    /* where does that come from / what sources did you use */
    String.raw`where\s+(?:does|did|do)\s+(?:that|it|this|those|these)\s+come\s+from` +
    '|' +
    String.raw`what\s+(?:sources?|evidence)\s+(?:did|do)\s+you\s+(?:use|rely\s+on|base\s+(?:that|it|this)\s+on)` +
    ')' +
    String.raw`(?:\s+please)?\s*[?.!]*\s*$`,
  'i',
);
const EN_CHANGE_SINCE = new RegExp(
  EN_LEAD +
    String.raw`(?:what(?:'s|\s+has|\s+have|\s+is)?\s+(?:changed|new|happened)|has\s+anything\s+(?:changed|happened)|did\s+anything\s+(?:change|happen)|(?:are\s+there\s+)?any(?:thing)?\s+(?:new|changes?|updates?|developments?))` +
    String.raw`\s+since\s+(?:then|that|the\s+(?:previous|last|prior|earlier)\s+(?:stage|step|update|version|reading|report|answer|time|one)|(?:your|my)\s+(?:last|previous|earlier)\s+(?:answer|update|report|question|reply))` +
    String.raw`\s*[?.!]*\s*$`,
  'i',
);

const PL_LEAD = String.raw`^\s*(?:(?:a|i|więc|ok|proszę|to)[,\s]+)*`;
const PL_ANSWER_OBJECT = String.raw`(?:\s+(?:na\s+to|do\s+tego|dla\s+tego|tego|tej\s+odpowiedzi|twojej\s+odpowiedzi|tych\s+twierdzeń))?`;
const PL_EVIDENCE_NOUN = String.raw`(?:dowod\p{L}*|dowód|źród\p{L}*|dokument\p{L}*|dokumentacj\p{L}*|zapis\p{L}*|potwierdzeni\p{L}*|przypis\p{L}*)`;
const PL_EVIDENCE = plTolerant(
  new RegExp(
    PL_LEAD +
      String.raw`(?:` +
      String.raw`(?:czy\s+(?:możesz|mógłbyś|mogłabyś|możecie)\s+)?(?:proszę\s+)?(?:pokaż\p{L}*|podaj\p{L}*|wskaż\p{L}*|przedstaw\p{L}*|wymień\p{L}*|przytocz\p{L}*|daj)(?:\s+mi)?\s+(?:(oficjaln\p{L}*|źródłow\p{L}*|pierwotn\p{L}*|urzędow\p{L}*)\s+)?${PL_EVIDENCE_NOUN}${PL_ANSWER_OBJECT}` +
      '|' +
      String.raw`(?:jakie|jaki|jaka|które)\s+(?:są|jest|były|był)\s+(?:(oficjaln\p{L}*|źródłow\p{L}*|pierwotn\p{L}*|urzędow\p{L}*)\s+)?${PL_EVIDENCE_NOUN}${PL_ANSWER_OBJECT}` +
      '|' +
      String.raw`skąd\s+(?:to\s+wiesz|ta\s+informacja|to\s+wiadomo|to\s+pochodzi)` +
      ')' +
      String.raw`(?:\s+proszę)?\s*[?.!]*\s*$`,
    'iu',
  ),
);
const PL_CHANGE_SINCE = plTolerant(
  new RegExp(
    PL_LEAD +
      String.raw`(?:co\s+(?:się\s+)?zmieniło(?:\s+się)?|co\s+nowego|co\s+się\s+wydarzyło|czy\s+(?:coś\s+)?(?:się\s+)?zmieniło(?:\s+się)?|czy\s+są\s+(?:jakieś\s+)?(?:zmiany|nowości))` +
      String.raw`\s+od\s+(?:tamtej\s+pory|tego\s+czasu|wtedy|(?:poprzedni\p{L}*|ostatni\p{L}*|wcześniejsz\p{L}*|twoj\p{L}*\s+(?:ostatni\p{L}*|poprzedni\p{L}*))\s+(?:etap\p{L}*|krok\p{L}*|raz\p{L}*|raport\p{L}*|odpowiedzi|wersj\p{L}*|aktualizacj\p{L}*|czas\p{L}*))` +
      String.raw`\s*[?.!]*\s*$`,
    'iu',
  ),
);

/** The turn asks for something that exists only relative to an earlier answer (or null). */
export function readAnswerRequest(text: string, language: string): AnswerRequestKind | null {
  const t = text.trim();
  if (language !== 'en' && language !== 'pl') return null;
  const evidence = (language === 'pl' ? PL_EVIDENCE : EN_EVIDENCE).exec(t);
  if (evidence !== null) {
    const qualifier = evidence.slice(1).find((g) => g !== undefined) ?? '';
    return /^(?:official|oficjaln|urz[eę]dow)/iu.test(qualifier) ? 'OFFICIAL_EVIDENCE' : 'EVIDENCE';
  }
  return (language === 'pl' ? PL_CHANGE_SINCE : EN_CHANGE_SINCE).test(t) ? 'CHANGE_SINCE' : null;
}

/**
 * SHARED R4 CONTINUITY (CTO "EARLIER_TURN SUBJECT CARRY") — the subject / scope a turn inherits from
 * the SPECIFIC earlier answer it was bound to. Derived only from the server's own record of that
 * answer (R-3 scope + evidence references), never from the reader's words; it stays EARLIER_TURN
 * wherever it travels and is never relabelled as a place or subject the reader typed.
 */
export interface InheritedScope {
  readonly provenance: 'EARLIER_TURN';
  /** the operation whose answer is referenced (null when the record does not carry it) */
  readonly sourceOperationId: string | null;
  /** the referenced answer's own question (its subject, for scope matching and retrieval) */
  readonly question: string;
  readonly countries: readonly string[];
  readonly relation: string | null;
  readonly job: string | null;
  /** the evidence the referenced answer stood on (references only — never re-stored evidence) */
  readonly evidenceRefs: readonly string[];
  /** the reader asked for OFFICIAL evidence: reporting is not an official source */
  readonly officialOnly: boolean;
}
