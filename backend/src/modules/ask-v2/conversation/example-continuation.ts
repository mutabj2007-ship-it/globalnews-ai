/**
 * R74 (#95, Alpha PO test 15 Oct) — AN EXAMPLE THAT NAMES NO SUBJECT CONTINUES THE EARLIER ONE.
 *
 * "Explain the difference between economic growth and inflation…" → "Give me a practical example
 * involving a small shop owner, and recommend what they should consider doing." The second turn asks
 * for an example WITHOUT saying of what: it is an example of the earlier question's subject. Neither
 * landed follow-up detector read it (no anaphor; longer than a bounded follow-up), so no earlier
 * question reached the answer and the model invented an unrelated coffee-shop marketing checklist.
 *
 * Structural, closed form: an imperative / polite request for an example at the START of the turn,
 * NOT followed by what it exemplifies ("an example of a mixed economy", "przykład inflacji" name
 * their own subject and stay self-contained). Who or what the example involves ("involving a small
 * shop owner", "for a family", "z małym sklepem") is its setting, not its subject. EN / PL; Polish
 * marks "of what" by case, not a preposition, so it is read only where the example ends the clause
 * or is followed by a setting preposition (z, ze, dla, w, we, u).
 */
const EN_EXAMPLE_REQUEST =
  /^(?:(?:and|so|ok(?:ay)?|now|then)[\s,]+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?(?:give|show|offer|provide|share|walk\s+me\s+through)\s+(?:me\s+|us\s+)?(?:an?|one|another|some)\s+(?:(?:more|practical|concrete|real[-\s]world|real[-\s]life|simple|specific|everyday|realistic|quick|short|worked|typical)\s+)*examples?\b(?!\s+(?:of|about|on|regarding|concerning)\b)/i;
const PL_EXAMPLE_REQUEST =
  /^(?:(?:a|i|to|teraz)[\s,]+)?(?:(?:czy\s+)?(?:mo[żz]esz|m[óo]g[łl]by[śs]|mog[łl]aby[śs])\s+)?(?:prosz[ęe]\s+)?(?:podaj|daj|poka[żz]|przedstaw|opisz)(?:\s+mi|\s+nam)?\s+(?:jaki[śs]\s+|jeden\s+|inny\s+)?(?:(?:praktyczny|konkretny|prosty|realny|codzienny|typowy)\s+)*przyk[łl]ad(?=\s*$|\s*[,.?!:;]|\s+(?:z|ze|dla|w|we|u)\s)/iu;

export function asksForUnnamedExample(question: string): boolean {
  const text = question.trim();
  return EN_EXAMPLE_REQUEST.test(text) || PL_EXAMPLE_REQUEST.test(text);
}
