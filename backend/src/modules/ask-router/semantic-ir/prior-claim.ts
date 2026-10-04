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

/** The turn asks only whether an earlier answer's claim (still) holds. */
export function readClaimValidity(text: string, language: string): boolean {
  if (language === 'pl') return PL_CLAIM_VALIDITY.test(text.trim());
  if (language === 'en') return EN_CLAIM_VALIDITY.test(text.trim());
  return false;
}
