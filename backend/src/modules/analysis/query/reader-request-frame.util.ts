/*
  P0 SOURCE-BACKED NEWS ANSWERS R1 — P1: the reader's REQUEST FRAME is not the subject.

  Measured at the retrieval boundary (p0-news-exact-wording.spec): "Give any reports about Eric Prince
  please." sent "Give any reports about Eric Prince please" to the provider, then "any reports Eric
  Prince please" as the bounded fallback; the multi-word relevance gate demanded either phrase inside a
  headline, so a real Reuters headline about Erik Prince could never be admitted. "Report abt Eric
  Prince in congo." made "report abt eric prince" the event topic.

  This removes only the frame AROUND the subject — a closed, ordered list of request shapes
  ("give/show/find (me) (any) (recent) reports/news about …", "any reports about …", "report abt …")
  and a trailing or leading "please". It never rewrites the subject, never reads a reporting noun
  inside the subject ("UN report on Gaza aid" is untouched: no request verb, no leading "any"), and
  never returns an empty string: a frame with nothing after it leaves the question exactly as it was.
  normalizedQuery (the model prompt, the cache key, response.query) is not touched by the caller.
*/

const ABOUT = String.raw`(?:about|abt|on|regarding|concerning)`;
const RECENCY = String.raw`(?:(?:the\s+)?(?:latest|recent|newest|current|new)\s+)?`;
const NOUN = String.raw`(?:reports?|reporting|news|articles?|stories|coverage|updates|headlines)`;

const REQUEST_FRAMES: readonly RegExp[] = [
  new RegExp(
    String.raw`^(?:give|show|find|get|send|share|bring|list)\s+(?:me\s+|us\s+)?(?:any\s+|some\s+|all\s+|the\s+)?${RECENCY}${NOUN}\s+${ABOUT}\s+(.+)$`,
    'i',
  ),
  new RegExp(String.raw`^(?:are\s+there\s+|is\s+there\s+)?(?:any|some)\s+${RECENCY}${NOUN}\s+${ABOUT}\s+(.+)$`, 'i'),
  new RegExp(String.raw`^report\s+${ABOUT}\s+(.+)$`, 'i'),
  /^(?:podaj|poka[żz]|daj|znajd[źz])\s+(?:mi\s+)?(?:jakie[śs]\s+|najnowsze\s+|ostatnie\s+)*(?:doniesienia|wiadomo[śs]ci|informacje|artyku[łl]y|raporty)\s+(?:o|na\s+temat|w\s+sprawie)\s+(.+)$/iu,
];

const LEADING_COURTESY = /^(?:please\s*,?\s+|(?:can|could|would|will)\s+you\s+(?:please\s+)?|prosz[ęe]\s*,?\s+)/iu;
const TRAILING_COURTESY = /[\s,]*(?:please|pls|plz|prosz[ęe])\s*([.!?]*)\s*$/iu;

export function withoutReaderRequestFrame(question: string): string {
  const original = question.trim();
  let q = original.replace(TRAILING_COURTESY, '$1').trim();
  q = q.replace(LEADING_COURTESY, '').trim();
  for (const frame of REQUEST_FRAMES) {
    const subject = q.match(frame)?.[1]?.trim();
    if (subject && /[\p{L}\p{N}]/u.test(subject)) {
      q = subject;
      break;
    }
  }
  return /[\p{L}\p{N}]/u.test(q) ? q : original;
}
