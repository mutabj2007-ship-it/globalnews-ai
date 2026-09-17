import type { AnalysisDevelopmentBreadth } from '../interfaces/analysis-provider.interface';
import { renderDimensionSemanticsInstruction } from './dimension-semantics';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';

/**
 * Milestone #31 — a request-local, AI-facing alias for one article in
 * the final bounded evidence set (e.g. "S1"), paired with the real
 * canonical NewsArticle.id it stands for.
 *
 * This alias exists ONLY inside the prompt/output round trip with the
 * AI provider — it is never persisted, cached, or exposed on
 * AnalysisApiResponse. The trusted, canonical `articleId` is what
 * ultimately appears in a validated NewsAnalysisResult's
 * sourceArticleIds fields; `evidenceId` never does.
 */
export interface EvidenceReference {
  evidenceId: string;
  articleId: string;
}

/**
 * Deterministically assigns S1, S2, S3... to `articles` in array order.
 *
 * The caller MUST pass the exact final, deduplicated, maxArticles-bounded
 * article array — the same array supplied to the AI provider and used as
 * AnalysisApiResponse.articles — so that the AI-facing alias and every
 * other party resolving it (the runtime validator, other providers)
 * agree on the same S-label for the same article without needing to
 * share any state beyond "the same array, in the same order". This
 * function performs no deduplication or bounding itself.
 */
export function buildEvidenceReferences(articles: NewsArticle[]): EvidenceReference[] {
  return articles.map((article, index) => ({
    evidenceId: `S${index + 1}`,
    articleId: article.id,
  }));
}

/**
 * Milestone #32 — the single, deterministic normalization applied on
 * BOTH sides of an evidence-basis excerpt comparison (the model's
 * claimed excerpt, and the exact truncated evidence text the model was
 * shown for that evidenceId — see normalizeArticlesForPrompt). Kept
 * deliberately conservative and exact-substring-only, per CTO
 * authorization: no fuzzy/Levenshtein/embedding matching.
 *
 * Policy (documented, not silently loosened):
 * 1. Unicode NFKC normalization (e.g. so a precomposed vs. decomposed
 *    accented character compares equal).
 * 2. Typographic quotes/dashes normalized to their ASCII equivalents
 *    (curly quotes, en/em dashes) — models frequently "smarten"
 *    punctuation when quoting, and the source text may use either form.
 * 3. All whitespace runs (including newlines/tabs) collapsed to a
 *    single space, then trimmed.
 * 4. Case-INsensitive comparison (lowercased) — chosen because the
 *    model may reproduce a sentence-initial capital differently than
 *    the source's mid-sentence casing after our own title+summary
 *    concatenation; this is a deliberate, documented policy choice,
 *    not progressive loosening. Case sensitivity is NOT relaxed for
 *    anything else (no fuzzy matching of any kind).
 */
export function normalizeExcerptText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export interface NormalizedArticleForPrompt {
  evidenceId: string;
  title: string;
  summary: string;
  sourceName: string;
  publishedAt: string;
}

/**
 * Truncates and strips each article down to what the model actually
 * needs, and replaces the real article ID with its request-local
 * evidenceId — the model is never shown a canonical article ID,
 * publisher-verified URL, or any other trusted metadata it could
 * later try to echo back as if it were authoritative.
 */
export function normalizeArticlesForPrompt(
  articles: NewsArticle[],
  maxChars: number,
): NormalizedArticleForPrompt[] {
  return buildEvidenceReferences(articles).map(({ evidenceId }, index) => {
    const article = articles[index];
    const combined = `${article.title}. ${article.summary}`.trim();
    return {
      evidenceId,
      title: article.title,
      summary: combined.length > maxChars ? `${combined.slice(0, maxChars)}\u2026` : combined,
      sourceName: article.sourceName,
      publishedAt: article.publishedAt,
    };
  });
}

/**
 * Milestone #32 — the exact truncated evidence text keyed by
 * evidenceId, i.e. precisely what normalizeArticlesForPrompt computed
 * as `summary` (the truncated `title. summary` combination actually
 * shown to the model for that evidenceId), run through
 * normalizeExcerptText() once so callers can do a plain substring
 * check against the model's normalized excerpt.
 *
 * This is the SOLE source of truth for "what evidence text did the
 * model actually see" — it must be built with the same `articles`
 * array and the same `maxArticleChars` value used to build the actual
 * prompt (see AnalysisConfig.maxArticleChars / buildAnalysisMessages),
 * or the comparison would validate against text the model was never
 * shown.
 */
export function buildNormalizedEvidenceTextMap(
  articles: NewsArticle[],
  maxChars: number,
): Map<string, string> {
  return new Map(
    normalizeArticlesForPrompt(articles, maxChars).map((a) => [
      a.evidenceId,
      normalizeExcerptText(a.summary),
    ]),
  );
}

const BASE_SYSTEM_PROMPT = `You are a careful news analyst working for GlobalNews AI.

You will be given a user's question and a numbered list of news articles,
each with a request-local evidence ID (S1, S2, S3, ...). These evidence
IDs are the ONLY way you may refer to a source. Your job is to produce a
structured, evidence-grounded analysis of ONLY those articles.

Strict rules:
- Use only the supplied articles. Do not use outside knowledge, do not
  search the web, and do not invent facts, quotations, publishers, or URLs.
- Every entry in keyFacts, agreements, differences (each position),
  timeline, and uncertainties MUST include the evidenceIds of the
  articles that support it, using ONLY the exact evidenceId values shown
  (e.g. "S1", "S2"). Never invent a new evidence ID, never cite a real
  article ID, a URL, a publisher name, or anything other than a supplied
  evidenceId value. Never state something as a fact without a supporting
  evidenceId.
- Clearly distinguish observed facts from interpretation. If something is
  your inference rather than something explicitly reported, say so or omit
  it from keyFacts.
- GEOGRAPHIC SCOPE IS A FACT, AND IT IS NEVER UPGRADED. The question may
  name a city, region, or other place that the supplied evidence does not
  itself establish. When that happens, state the location AT THE LEVEL THE
  EVIDENCE SUPPORTS, never at the level the question asked for. Evidence
  that establishes something about a COUNTRY is evidence about that
  country; presenting it as something that happened "in <city>" is a
  fabrication even when every other detail is accurate. This binds
  "headline" and "summary" exactly as strictly as keyFacts, and applies
  equally to "context", "relevance", "significance" rationale,
  "affectedParties" descriptions, "immediateImpacts",
  "spilloverImplications", "watchNext", and every other piece of prose you
  generate.
  Broader evidence remains legitimate and useful, and you should use it:
  you may say that a national or regional development bears on a question
  about a city, naming it as the national or regional development it is.
  What you may never do is relocate it. If the evidence says Rwanda's
  economy grew, then "Rwanda's economy grew, which bears on the capital" is
  correct and "Kigali's economy grew" is not — the second claims a
  city-level fact no supplied article establishes. The same holds for a
  region, a province, or any other place named in the question.
  Where the supplied evidence does not reach the place the question named,
  say so in "uncertainties" rather than quietly answering about somewhere
  else.
- Do not assume that multiple articles are independent confirmation if
  they read like syndicated copies of the same wire report — note this in
  "differences" or "uncertainties" instead of treating it as strong
  agreement.
- Where the supplied evidence does not establish a conclusion, or reports
  conflict, or something remains unconfirmed, add an entry to
  "uncertainties" describing the gap, citing the relevant evidenceIds when
  the gap concerns specific articles (an empty evidenceIds array is fine
  for a general gap). Also reflect this in the confidence score.
- "confidence.score" IS ON A 0-100 SCALE, not a 0-1 probability. Give a whole
  number where 0 is no confidence and 100 is maximum confidence, and keep it
  consistent with "confidence.level": roughly 0-39 for "low", 40-74 for
  "medium", 75-100 for "high". This is YOUR OWN self-assessment and is a
  different thing from how well the evidence supports the analysis, which the
  backend derives and you are not asked for.
- Avoid political persuasion, advocacy, or loaded language of any kind.
- Avoid sensational or exaggerated language; use a neutral, precise tone.
- Preserve genuinely important differences between sources rather than
  smoothing them into a single narrative.
- If you are not confident about something, list it in "unknowns" and/or
  "uncertainties" instead of guessing.
- For "context": provide at most 4 evidence-grounded background facts
  needed to understand the current development — historical,
  institutional, or geographic context. Only include background that is
  actually contained in the supplied evidence above; never draw on
  general knowledge beyond it. Each entry follows the exact same
  evidenceIds/evidenceBasis rules as keyFacts. Return an empty array if
  the evidence does not establish any useful background beyond the
  immediate facts already covered elsewhere.
- For "relevance": provide at most 3 evidence-grounded claims explaining
  why this development matters. Do not exaggerate importance. Do not
  infer political, economic, social, security, or geographic
  consequences unless the supplied evidence itself states them. Each
  entry follows the exact same evidenceIds/evidenceBasis rules as
  keyFacts. Return an empty array if a meaningful relevance claim cannot
  be grounded in the supplied evidence.
${renderDimensionSemanticsInstruction()}
- ATTRIBUTION IS STRUCTURAL, NOT PROSE. Every entry in "keyFacts" carries
  "assertion", which is either "FACT" or "REPORTED_STATEMENT".
  * "FACT" — the supplied evidence ESTABLISHES this proposition. It is stated
    in GlobalNews AI's own voice, so only use it where the evidence supports
    the proposition itself.
  * "REPORTED_STATEMENT" — someone SAID this. What is being asserted is that
    they said it, which is a different claim from the content being true. Set
    "attribution" with "speaker" naming the most precise attributor the
    evidence supports: a named official or ministry where one is given, the
    institution where it is not, and the country ONLY when the evidence
    attributes it no more precisely. Put the reporting verb the evidence uses
    in "attribution.verb".
  AN INTERPRETIVE CHARACTERISATION IS NOT A KEY FACT. Words such as "threat",
  "escalation", "crackdown", "crisis" or "landmark" are judgements about what
  something MEANS. You may use such a word only where the supplied evidence
  itself uses it, and then it is a REPORTED_STATEMENT attributed to whoever
  used it — never a "FACT" in our own voice. If the evidence reports an action
  without characterising it, report the action.
  DO NOT SOFTEN A CHARACTERISATION INTO ACCEPTABLE WORDING. Rewriting "issued a
  threat" as "made a strongly worded statement" is the same judgement in
  quieter language. State what the evidence states, attributed.
- For "affectedParties": identify up to 6 people, organizations,
  countries, regions, or groups the supplied evidence EXPLICITLY
  describes as affected, and state the effect on each using only what
  the evidence states — never inferred. For each entry, set "partyType"
  to the single best-fitting category (person, organization, country,
  region, group, or other). Return an empty array if the evidence does
  not identify specific affected parties.
  AN ACTOR IS NOT AN AFFECTED PARTY. Something in the evidence must
  HAPPEN TO the entity you list. An entity that decides, announces,
  implements, seeks, threatens or responds is acting, and being the most
  prominent name in the story does not make it affected. If the evidence
  states both — an actor who also bears a consequence — the "effect"
  field must state the CONSEQUENCE IT BEARS, never the action it took.
  "<Country> implementing policy" is an action and must be rejected;
  "<Country> now pays X more for Y, per the evidence" is an effect.
- For "immediateImpacts": list up to 4 direct, already-occurring
  effects the supplied evidence explicitly states — never a
  plausible-sounding consequence you are inferring. Each entry follows
  the exact same evidenceIds/evidenceBasis rules as keyFacts. Return an
  empty array if the evidence does not state any direct effect.
  A DEVELOPMENT IS NOT AN EFFECT, AND NEITHER IS A RESPONSE. An effect is
  a consequence ON someone or something, caused by the event. Something
  that merely HAPPENED is a development, and something an actor CHOSE TO
  DO about it is a response — however recent or important either is.
  "<Proposal> revived" is a development and must be rejected; "<Group>
  has already halted <activity> as a result, per the evidence" is an
  effect. If the evidence states the event but no consequence of it, this
  array is empty, and that is the correct answer.
- For "spilloverImplications": list up to 4 wider or secondary effects
  EXPLICITLY discussed in the supplied evidence — never your own
  extrapolation of what might plausibly follow. Each entry follows the
  exact same evidenceIds/evidenceBasis rules as keyFacts. Return an
  empty array if the evidence does not discuss any wider effect.
- For "significance": provide an evidence-grounded judgment of this
  development's magnitude/consequence — level ("minor", "moderate",
  "major", or "critical") plus up to 2 grounded rationale entries. This
  is an assessment of event magnitude/consequence ONLY — never a proxy
  for source trust, your own confidence, evidence sufficiency,
  emotional tone, topic category, or general importance inferred from
  world knowledge. Base the level ONLY on objective signals actually
  present in the supplied evidence: casualty or injury counts,
  displacement/evacuation figures, documented financial/economic
  magnitude, geographic scope, the number or scale of affected
  people/groups/institutions, official emergency/disaster
  declarations, major institutional/legal/policy consequences, or
  explicit source characterization of scale where grounded in concrete
  facts. Do NOT infer severity merely because reporting uses dramatic
  language such as "crisis", "catastrophic", "historic", "shocking",
  or "devastating" — those words alone are never sufficient evidence.
  "critical" requires EITHER (A) an explicit authoritative designation
  of exceptional severity supported by the supplied evidence, OR (B)
  multiple independent objective high-severity indicators together
  (for example, a very large casualty/displacement magnitude PLUS
  major geographic/institutional/economic consequences) — one isolated
  signal is generally not enough to justify "critical". When the
  evidence is ambiguous between two levels, choose the lower defensible
  level. Each rationale entry follows the exact same
  evidenceIds/evidenceBasis rules as keyFacts. Return "significance":
  null (the JSON null literal, not an object) when the supplied
  evidence does not support a defensible level judgment — never
  default to "minor" or guess.
- For "watchNext": list up to 4 concrete forthcoming or unresolved
  developments EXPLICITLY signalled by the supplied evidence — a
  scheduled meeting, vote, hearing, or negotiation; an announced
  decision expected on a stated date or timeframe; a pending official
  action; an investigation or test whose results are explicitly said
  to be forthcoming; a stated deadline; a pending court or regulatory
  decision; an officially announced report/result/release; or an
  unresolved process the evidence explicitly says will continue or
  reach another stage. This is NOT forecasting. Do not include
  something merely because it would be a plausible or interesting
  thing to happen next — only because the supplied evidence itself
  already names it as scheduled, announced, pending, expected by an
  identified source or authority, forthcoming, or proceeding toward a
  documented next step. Every watchNext item must correspond to a
  specific FUTURE HINGE explicitly present in the supplied evidence —
  a concrete scheduled, announced, pending, unresolved, deadline-based,
  or forthcoming-report/result development, never a general possibility.
  A useful internal check: if the supplied evidence disappeared, could
  you still plausibly invent this item from general knowledge alone?
  If yes, it does not belong here. Do NOT generate items like "the
  conflict may escalate" merely because fighting is occurring, "markets
  could decline further" from your own inference, or "the government
  may respond" unless the evidence explicitly says a response is
  pending or expected — these are exactly the kind of unsupported
  forecasting this field must never contain. Critically, a real,
  verbatim excerpt from the evidence is NOT sufficient on its own: the
  excerpt must itself describe the FUTURE hinge, not merely be real
  text about the topic. An excerpt describing something that ALREADY
  HAPPENED (a completed strike, an event already reported as having
  occurred) does NOT establish a future hinge, even if you cite it
  accurately and even if the surrounding claim sounds forward-looking.
  For example, an excerpt stating that a strike on infrastructure
  already occurred does not support a claim like "monitor potential
  escalation" — that is a completed event repackaged as something to
  watch, not a genuine future hinge, and must be omitted. By contrast,
  an excerpt stating that a named party's response to a specific
  proposed action REMAINS PENDING is a genuine future hinge and IS
  valid. Do NOT include: a completed event merely repackaged as
  something to monitor; a generic escalation possibility; a generic
  risk or consequence; a prediction inferred merely because fighting or
  another event is occurring; or any claim whose evidenceBasis only
  establishes a past or already-completed event rather than an
  explicitly pending or forthcoming one. Every watchNext item must also
  include "hingeType", one of exactly: "pending_response" (a named
  party's response to a specific proposed action or event remains
  pending), "scheduled_event" (a meeting, vote, hearing, or negotiation
  with a stated or implied date), "announced_action" (an official
  action or decision that has been announced but not yet taken),
  "deadline" (a stated deadline the evidence identifies), or
  "forthcoming_report" (an investigation, test, or report whose result
  is explicitly said to be forthcoming). There is no "other" or
  "unknown" category — if an item does not truthfully fit one of these
  five, OMIT IT from watchNext rather than forcing it into the nearest
  category. watchNext: [] is valid and preferable to including an
  unsupported or mischaracterized item. For "watchNext" specifically
  (unlike keyFacts), "evidenceBasis" is REQUIRED, not optional: you
  must quote or closely identify the exact passage in the supplied
  evidence that establishes the future hinge itself — the specific
  words that show the development is scheduled, announced, pending, or
  otherwise explicitly forthcoming, not merely related to the topic. A
  watchNext item with citations but no evidenceBasis identifying the
  future hinge will be discarded. Return an empty array if the evidence
  does not explicitly signal any forthcoming development — never infer
  likely outcomes to fill this field.
- THE "summary" IS THE EXECUTIVE BRIEF, AND IT IS THE SUBSTANTIVE ANSWER.
  It is printed to the reader verbatim — nothing downstream re-summarises,
  slices, reorders or shortens it — so whatever you write here is exactly
  what a person reads as the answer to their question.
  ORGANISE IT BY MATERIAL DEVELOPMENT, NOT AS ONE BLENDED SENTENCE. A broad
  question such as "Rwanda" is rarely about one thing: the evidence usually
  holds several distinct developments, and collapsing them into a single
  vague line destroys the only thing that made the answer worth reading.
  Write readable paragraphs separated by a BLANK LINE, one per material
  development or topic. Within each paragraph make clear, where the evidence
  supports it:
    * WHAT happened — what the reporting actually says;
    * WHICH development or topic it belongs to;
    * WHY IT MATTERS, but ONLY where the supplied evidence itself
      establishes the significance;
    * any material uncertainty or gap in what the evidence establishes.
  DO NOT INVENT A REASON BECAUSE THE READER WOULD LIKE ONE. If an article
  reports that eucalyptus plantations raised environmental concerns and also
  explains why the trees were planted or what programme they belonged to,
  state that. If the evidence does not establish the motive, say what is
  reported and say plainly that the evidence does not establish why — never
  supply a plausible-sounding purpose to make the paragraph feel complete.
  A confidently invented cause is worse than an acknowledged gap.
  SCALE THE SYNTHESIS TO THE EVIDENCE. There is no target length and no
  required number of paragraphs. Two well-sourced developments are two
  paragraphs; one narrow story is one short paragraph. Do not pad a thin
  evidence set into the shape of a rich one, and do not compress a rich one
  into a single sentence.
  Every rule above about geographic scope, invention and interpretation binds
  this field exactly as strictly as keyFacts.
  THIS REQUIREMENT IS CHECKED AFTER YOU ANSWER, NOT MERELY REQUESTED, AND
  THERE IS NO SECOND ATTEMPT. When the supplied evidence covers several
  distinct developments across different domains, a single blended paragraph
  is REJECTED AND THE EXECUTIVE BRIEF IS WITHHELD FROM THE READER ENTIRELY.
  You are not asked to re-organise it and you do not get to revise it. The
  rest of your analysis is still shown, so a blended paragraph does not
  produce a weaker brief — it produces NO brief. Padding a thin evidence set
  to look structured fails for a different reason — the number of paragraphs
  must follow the evidence, not a target.
- For keyFacts, agreements, differences (each position), and timeline
  entries, you may optionally include "evidenceBasis": an object with
  "evidenceId" (one of the exact evidenceId values you already cited for
  that entry) and "excerpt" (a short excerpt, a sentence or less, copied
  verbatim from that evidence's own text above — do not paraphrase, do
  not combine wording from multiple articles, do not invent text). Omit
  "evidenceBasis" entirely if you cannot quote a genuine short excerpt
  that directly appears in the cited evidence's text.
`;

/**
 * Milestone #40 (authoritative-context correction) — the exact,
 * deterministic X/Y pair the model must use for relational direction
 * classification, when the current request matched Milestone #37's
 * relational pattern set. This is the SAME object AnalysisService
 * already builds from deriveRelationalSearchQueries()'s output
 * (relationalQuery.x/relationalQuery.y) — this module does not parse,
 * derive, or reinterpret X/Y itself; it only renders whatever it's
 * given into the prompt. There is exactly one source of truth for
 * what X and Y are: deriveRelationalSearchQueries().
 */
export interface RelationalPromptContext {
  x: string;
  y: string;
}

/**
 * Milestone #40 (authoritative-context correction) — appended to
 * BASE_SYSTEM_PROMPT to produce the final system prompt. Two mutually
 * exclusive branches:
 *
 * - relationalContext present: explicitly states the EXACT X and Y
 *   values (verbatim, never reinterpreted) and defines
 *   requested-direction/reverse-direction strictly in terms of that
 *   pair — the model is never asked to independently infer X/Y from
 *   the question text, closing the "two independent interpretations"
 *   gap the CTO identified.
 * - relationalContext absent: explicitly tells the model this is NOT
 *   an M40 relational request and relationalEvidenceAssessments must
 *   stay empty — this is a prompt-level instruction only; the actual
 *   safety guarantee is enforced independently and unconditionally by
 *   validateAnalysisResult() (see Step 8's fail-closed rule), which
 *   never trusts prompt obedience alone.
 */
export function buildRelationalPromptSection(
  relationalContext: RelationalPromptContext | undefined,
): string {
  if (!relationalContext) {
    return `- This is NOT a Milestone #40 relational request — the question did
  not match a supported relational pattern. Do not populate
  "relationalEvidenceAssessments"; leave it as an empty array, and leave
  every entry's "relationshipAssessmentIds" as null. Do not attempt to
  classify any relationship direction for this request.
- Output must be valid JSON matching the provided schema exactly. Do not
  include commentary outside the JSON.`;
  }

  const { x, y } = relationalContext;
  return `- RELATIONAL CONTEXT: X = "${x}", Y = "${y}". These are the EXACT,
  authoritative concepts for this request — do not infer, replace, or
  reinterpret them using synonyms or your own reading of the question;
  use exactly these two values. Populate "relationalEvidenceAssessments"
  with specific excerpts you found in the evidence above that bear on the
  relationship between X and Y. Each entry needs a unique "assessmentId"
  you invent for this response only (e.g. "R1", "R2", ...), the
  "evidenceId" of the article the excerpt is from, the "excerpt" itself
  (copied verbatim, a sentence or less, exactly like evidenceBasis above —
  never invented or combined from multiple articles), and a "direction":
  "requested-direction" if the excerpt supports or discusses the
  relationship in the order X affecting Y (i.e. "${x}" affecting "${y}"),
  "reverse-direction" if the excerpt supports it in the opposite order
  (i.e. "${y}" affecting "${x}"), "bidirectional" if the excerpt supports
  both directions at once, "association-only" if the excerpt merely
  discusses both X and Y without describing a relationship between them,
  "unclear" if you genuinely cannot tell, or "non-substantive" if the
  shared wording is incidental (e.g. part of an organization's name
  rather than substantive content). A single article may reasonably
  produce more than one assessment if it discusses the relationship in
  more than one place or more than one way — this is expected, not an
  error. Then, on any keyFacts, agreements, differences positions, or
  timeline entry whose claim text is actually supported by one or more of
  these assessments, include "relationshipAssessmentIds": the
  assessmentId(s) that specific entry relies on. Never mark an entry as
  relying on an assessment that isn't about an article that entry itself
  already cited in "evidenceIds". If you found no genuine relational
  evidence, leave "relationalEvidenceAssessments" as an empty array and
  every entry's "relationshipAssessmentIds" as null. Never state or imply
  that a relationship is causally proven — you are only reporting what
  the evidence says, not establishing that one thing caused another.
- Output must be valid JSON matching the provided schema exactly. Do not
  include commentary outside the JSON.`;
}

export function buildAnalysisUserPrompt(
  query: string,
  articles: NormalizedArticleForPrompt[],
): string {
  const articleBlocks = articles
    .map(
      (article, index) =>
        `${index + 1}. [evidenceId: ${article.evidenceId}] "${article.title}" \u2014 ${article.sourceName} (${article.publishedAt})\n${article.summary}`,
    )
    .join('\n\n');

  return `User question: "${query}"

Evidence (cite these exact evidenceId values in "evidenceIds" fields — never invent new ones, never cite anything else):

${articleBlocks}

Produce the structured analysis now.`;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE MEASURED-BREADTH SECTION — EXECUTIVE-BRIEF-STRUCTURAL-COMPLIANCE-
 * RECOVERY-1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE GOVERNING RULE OF THIS CORRECTION: the model and the validator must
 * receive the SAME already-computed breadth fact. This function is the model's
 * end of that rule. `assessBriefCompliance()` is the validator's end, and it
 * is unchanged.
 *
 * ── WHY THIS IS NOT THE WORDING-ONLY CHANGE C906 FORBADE ───────────────────
 *
 * C906 ruling D: "The C905 prompt already asks for multiple paragraphs,
 * therefore DO NOT report another wording-only prompt change as a fix." That
 * reasoning is correct and is preserved here. This does not ask harder. It
 * supplies a FACT the model did not previously have — the cluster and domain
 * counts THIS evidence set carries, computed by the same function that grades
 * the answer — and it states the real consequence, which the base prompt
 * previously stated incorrectly (it promised a repair request that Alpha
 * Budget R1 removed).
 *
 * ENFORCEMENT IS STILL THE GUARANTEE, NOT THIS TEXT. A brief that ignores
 * this section is refused by `assessBriefCompliance()` exactly as before. No
 * threshold moved, and nothing here can make a non-compliant brief pass.
 *
 * ── TWO BEHAVIOURS, BECAUSE THE RULING HAS TWO HALVES ──────────────────────
 *
 * The ruling protects narrow questions as explicitly as it demands structure
 * from broad ones: "narrow/single-story questions remain allowed to produce
 * one paragraph." So a narrow set is told it is narrow and that one paragraph
 * is a correct answer. A generic instruction firm enough to fix the broad case
 * would push the narrow case into padding — the same failure wearing
 * structure, which is precisely what the ruling's no-quota clause forbids.
 *
 * ── ABSENT MEANS SILENT ────────────────────────────────────────────────────
 *
 * Undefined returns the empty string, so a caller that does not measure
 * breadth produces a byte-identical prompt to pre-recovery behaviour.
 */
export function buildDevelopmentBreadthSection(
  breadth?: AnalysisDevelopmentBreadth,
): string {
  if (breadth === undefined) {
    return '';
  }

  if (!breadth.multiDevelopment) {
    return (
      `\n\nMEASURED EVIDENCE BREADTH FOR THIS REQUEST: ${breadth.clusters} distinct reporting ` +
      `cluster(s) across ${breadth.categories} editorial domain(s). This count was computed from ` +
      'the exact articles supplied below.\n\nTHIS IS A NARROW EVIDENCE SET. One well-written ' +
      'paragraph is a correct and fully accepted answer here. Do NOT pad it into a ' +
      'multi-paragraph shape the evidence does not earn — the number of paragraphs must follow ' +
      'the evidence, not a target.'
    );
  }

  /*
    C910 - THIS SECTION NOW DESCRIBES THE FIELDS THE SCHEMA ACTUALLY ASKS FOR.

    Two C909 sentences are corrected, and only those two. "There is no target
    count" argued against the requirement stated immediately above it, and the
    reference to a `summary` field is wrong here because the multi-development
    schema does not contain one. Everything else C909 said is kept verbatim in
    substance - the WITHHELD consequence, the absence of a second attempt, the
    blank-line separator and the anti-padding rule - because the contract asked
    for a structural guarantee, not for a quieter prompt.
  */
  return (
    `\n\nMEASURED EVIDENCE BREADTH FOR THIS REQUEST: ${breadth.clusters} distinct reporting ` +
    `clusters across ${breadth.categories} editorial domains. This count was computed from the ` +
    'exact articles supplied below, by the same check that will grade your answer.\n\n' +
    'HOW THE BRIEF IS REQUESTED HERE: not as one "summary" field, but as two required fields, ' +
    '"primaryDevelopment" and "additionalDevelopments". Every earlier rule about the brief binds ' +
    'their combined content. They must cover DIFFERENT material developments: do not restate one ' +
    'in both, and do not split one across them. Where a field carries more than one development, ' +
    'separate them with a BLANK LINE.\n\n' +
    'THE CONSEQUENCE, STATED PLAINLY: if the brief still reads as a single paragraph for this ' +
    'evidence set, it is WITHHELD from the reader entirely - there is no repair request, no ' +
    'second attempt and no opportunity to revise.\n\n' +
    `DO NOT PAD: ${breadth.clusters} clusters do not mean ${breadth.clusters} developments. Cover ` +
    'what the evidence establishes and nothing more, and do not pad a thin strand into a second ' +
    'development. An honest short second field is correct; an invented one is not.'
  );
}

export function buildAnalysisMessages(
  query: string,
  articles: NewsArticle[],
  maxChars: number,
  relationalContext?: RelationalPromptContext,
  responseLanguage: LanguageCode = 'en',
  repairDirective?: string,
  developmentBreadth?: AnalysisDevelopmentBreadth,
): { system: string; user: string } {
  const normalized = normalizeArticlesForPrompt(articles, maxChars);
  return {
    system:
      BASE_SYSTEM_PROMPT +
      buildRelationalPromptSection(relationalContext) +
      buildResponseLanguageInstruction(responseLanguage) +
      /*
        EXECUTIVE-BRIEF-STRUCTURAL-COMPLIANCE-RECOVERY-1 — the measured breadth,
        appended by the same mechanism and for the same reason as the sections
        above it: never substituted, so every rule above still binds. Empty
        string when breadth was not measured.
      */
      buildDevelopmentBreadthSection(developmentBreadth) +
      /*
        PO ruling D (C906) — APPENDED LAST, AND ONLY ON A REPAIR.
        Last so it is the most recent thing the model reads, and appended
        rather than substituted so every rule above it — evidence ids,
        no invention, geographic scope — still binds the repaired answer.
        Absent on every ordinary call, which keeps the prompt byte-identical
        for the path that did not fail.
      */
      (repairDirective === undefined ? '' : `\n\n${repairDirective}\n`),
    user: buildAnalysisUserPrompt(query, normalized),
  };
}

/**
 * Milestone #47 — the ONLY prompt change required to support a
 * non-English response, reusing the SAME single existing analysis
 * call (zero additional OpenAI calls). Maps a LanguageCode to a stable
 * English language name — never hard-codes "Polish" specifically, so
 * every LanguageCode already has defined behavior here even though
 * only 'en'/'pl' are wired into AnalysisService as of this milestone.
 *
 * Deliberately instructs the model to translate ONLY prose fields and
 * explicitly NOT touch structured/machine-readable fields (article
 * IDs, evidenceId values, citation identifiers, enum values) — this is
 * a prompt-level reinforcement of what the EXISTING, unmodified
 * validation pipeline (validate-analysis-result.ts) already enforces
 * structurally regardless of what the model actually does: a
 * fabricated or altered ID/enum would already be rejected by that
 * unchanged machinery, so this instruction is a quality aid, not the
 * sole safety mechanism.
 *
 * Returns an empty string for 'en' — the base system prompt's existing
 * behavior is already English, so no additional instruction is needed
 * and none is added, preserving byte-for-byte prior prompt behavior
 * for every English request.
 */
export function buildResponseLanguageInstruction(language: LanguageCode): string {
  if (language === 'en') return '';

  const languageName = RESPONSE_LANGUAGE_NAMES[language];

  return `\n\nRespond in ${languageName}. All prose fields (headline, summary, claim text, agreement/difference descriptions, uncertainty text, explanations, entity labels, etc.) must be written in ${languageName}. Do NOT translate, alter, or localize: article IDs, evidenceId values, citation identifiers, or any enum/machine-readable field value (e.g. direction, sufficiency, confidence level tokens) — those must remain exactly as specified by the schema.`;
}

const RESPONSE_LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  pl: 'Polish',
  sw: 'Swahili',
  fr: 'French',
  es: 'Spanish',
  ar: 'Arabic',
  rw: 'Kinyarwanda',
};

/**
 * JSON schema handed to the OpenAI provider's structured-output mode.
 * Kept here (not inline in the provider) so the schema, the prompt, and
 * the runtime validator all describe the same shape from one source of
 * truth conceptually — the provider just forwards this schema, and
 * validate-analysis-result.ts is the actual runtime gate.
 *
 * Milestone #31: the model-facing field is "evidenceIds" (request-local
 * S1/S2/... aliases only) everywhere a source needs citing. The
 * validated NewsAnalysisResult that comes out of validateAnalysisResult
 * still exposes "sourceArticleIds" containing REAL article IDs — that
 * translation happens entirely in the validator, never here.
 */
/**
 * ============================================================================
 * C910 - THE FIRST-PASS STRUCTURAL GUARANTEE LIVES IN THE SCHEMA
 * ============================================================================
 *
 * WHY THE SCHEMA AND NOT MORE PROMPT. C909 supplied the measured breadth to the
 * model and stated the consequence in prose. Production then withheld the brief
 * for "Zambia" anyway - 6 clusters across 3 domains, one paragraph. The reason
 * was measured, not guessed: this is a `strict: true` structured-output call, the
 * prompt tells the model "Output must be valid JSON matching the provided schema
 * exactly", and the schema declared `summary` an unconstrained string. The only
 * statement of the requirement lived in the one channel the model was told was
 * advisory.
 *
 * So the requirement moves into the channel that is already binding. When the
 * evidence is multi-development the brief is requested as TWO REQUIRED fields.
 * Under `strict: true` with `additionalProperties: false` every declared property
 * must be present, so a single undivided brief is not expressible.
 *
 * THIS IS NOT A PARAGRAPH QUOTA, and the C906 ruling that forbids one is intact.
 * Two fields is exactly the validator's own threshold (`paragraphs >= 2`), not one
 * field per reporting cluster. Six clusters do not become six paragraphs; the model
 * still decides how the evidence divides, and `additionalDevelopments` may itself
 * carry several paragraphs or one.
 *
 * NARROW EVIDENCE IS UNTOUCHED. When `multiDevelopment` is false - and when no
 * breadth is supplied at all - the schema is byte-identical to C909's: one
 * `summary` string. A narrow question cannot be pushed into a shape it has not
 * earned, because it is never asked for one.
 *
 * NOTHING DOWNSTREAM SEES THIS. `normalizeBriefFields()` joins the two fields with
 * a blank line into the existing `summary` string before the result leaves the
 * provider, so `validateAnalysisResult`, the compliance validator, the shared
 * contract and the frontend all receive exactly what they receive today.
 *
 * NO UNSUPPORTED KEYWORD. `minItems` is deliberately not used: OpenAI strict
 * structured outputs support only a subset of JSON Schema and array cardinality
 * has not been part of it. Required named properties need no such keyword.
 */
export function buildAnalysisJsonSchema(
  developmentBreadth?: AnalysisDevelopmentBreadth,
): Record<string, unknown> {
  /**
   * Milestone #32 — model-facing evidence-basis shape. Nullable +
   * listed in `required` per OpenAI strict-mode structured-output
   * convention for an optional field (the schema itself cannot express
   * "may be omitted" under `strict: true`/`additionalProperties: false`
   * — the model must emit `null` instead of leaving it out). Uses the
   * SAME request-local "evidenceId" field name as the rest of this
   * schema; validate-analysis-result.ts is the only place this ever
   * gets resolved to a real articleId, exactly like every other
   * evidenceIds field here.
   */
  const evidenceBasisSchema = {
    type: ['object', 'null'],
    properties: {
      evidenceId: { type: 'string' },
      excerpt: { type: 'string' },
    },
    required: ['evidenceId', 'excerpt'],
    additionalProperties: false,
  };

  /**
   * Milestone #40 — model-facing relational-evidence-assessment shape.
   * `assessmentId` is a request-local, model-facing label (e.g. "R1",
   * distinct from and never confused with the request-local "S1"-style
   * evidenceId aliases) — it exists only to let a claim reference which
   * specific assessment(s) it relies on within THIS same response; it
   * is never trusted as a stable ID and never survives validation. Uses
   * the same request-local "evidenceId" field as everywhere else in
   * this schema — resolve-relational-evidence-assessment.util.ts is the
   * only place either ID is ever resolved/discarded.
   */
  const relationalEvidenceAssessmentSchema = {
    type: 'object',
    properties: {
      assessmentId: { type: 'string' },
      evidenceId: { type: 'string' },
      excerpt: { type: 'string' },
      direction: {
        type: 'string',
        enum: [
          'requested-direction',
          'reverse-direction',
          'bidirectional',
          'association-only',
          'unclear',
          'non-substantive',
        ],
      },
    },
    required: ['assessmentId', 'evidenceId', 'excerpt', 'direction'],
    additionalProperties: false,
  };

  /**
   * Milestone #40 — nullable array of request-local assessmentId
   * strings a claim/agreement/position/timeline entry relies on. Null
   * (not an empty array) when the entry has no relational grounding —
   * an empty array vs. null both mean "none" at validation time, but
   * null is the natural "not applicable" value here, consistent with
   * evidenceBasisSchema's own nullable-object convention above.
   */
  const relationshipAssessmentIdsSchema = {
    type: ['array', 'null'],
    items: { type: 'string' },
  };

  const sourcedClaim = {
    type: 'object',
    properties: {
      claim: { type: 'string' },
      evidenceIds: { type: 'array', items: { type: 'string' } },
      evidenceBasis: evidenceBasisSchema,
      relationshipAssessmentIds: relationshipAssessmentIdsSchema,
    },
    required: ['claim', 'evidenceIds', 'evidenceBasis', 'relationshipAssessmentIds'],
    additionalProperties: false,
  };

  /**
   * Milestone #62 Phase 2 — same evidence-grounding fields as
   * sourcedClaim (evidenceIds/evidenceBasis), but with "party"/
   * "partyType"/"effect" in place of a single "claim" string, since
   * affectedParties genuinely needs the who/how distinction — see
   * AffectedParty's own doc comment in shared/src/analysis.ts.
   */
  const affectedParty = {
    type: 'object',
    properties: {
      party: { type: 'string' },
      partyType: {
        type: 'string',
        enum: ['person', 'organization', 'country', 'region', 'group', 'other'],
      },
      effect: { type: 'string' },
      evidenceIds: { type: 'array', items: { type: 'string' } },
      evidenceBasis: evidenceBasisSchema,
    },
    required: ['party', 'partyType', 'effect', 'evidenceIds', 'evidenceBasis'],
    additionalProperties: false,
  };

  /**
   * Milestone #62 Phase 4, second hardening — deliberately narrow,
   * non-catch-all hingeType enum. No "other"/"unknown" value exists on
   * purpose — an item that doesn't truthfully fit one of these five
   * categories must be omitted from watchNext entirely, never
   * force-fit. evidenceBasis remains nullable at the schema level
   * (same strict-mode convention as elsewhere), but the runtime
   * validator enforces it as effectively required for this field.
   */
  const watchNextItem = {
    type: 'object',
    properties: {
      claim: { type: 'string' },
      hingeType: {
        type: 'string',
        enum: [
          'pending_response',
          'scheduled_event',
          'announced_action',
          'deadline',
          'forthcoming_report',
        ],
      },
      evidenceIds: { type: 'array', items: { type: 'string' } },
      evidenceBasis: evidenceBasisSchema,
    },
    required: ['claim', 'hingeType', 'evidenceIds', 'evidenceBasis'],
    additionalProperties: false,
  };

  /**
   * Milestone #62 Phase 3 — nullable object, following the exact same
   * strict-mode convention as evidenceBasisSchema above: under
   * `strict: true`/`additionalProperties: false` the schema cannot
   * express "may be omitted", so the model must emit `null` explicitly
   * when the evidence does not support a defensible significance
   * judgment, rather than the property being left out.
   */
  const significanceSchema = {
    type: ['object', 'null'],
    properties: {
      level: { type: 'string', enum: ['minor', 'moderate', 'major', 'critical'] },
      rationale: { type: 'array', items: sourcedClaim },
    },
    required: ['level', 'rationale'],
    additionalProperties: false,
  };

  const positionSchema = {
    type: 'object',
    properties: {
      description: { type: 'string' },
      evidenceIds: { type: 'array', items: { type: 'string' } },
      evidenceBasis: evidenceBasisSchema,
      relationshipAssessmentIds: relationshipAssessmentIdsSchema,
    },
    required: ['description', 'evidenceIds', 'evidenceBasis', 'relationshipAssessmentIds'],
    additionalProperties: false,
  };

  const uncertaintySchema = {
    type: 'object',
    properties: {
      description: { type: 'string' },
      evidenceIds: { type: 'array', items: { type: 'string' } },
    },
    required: ['description', 'evidenceIds'],
    additionalProperties: false,
  };

  /*
    C910 - the brief's shape, chosen from the SAME measured breadth the compliance
    validator will judge the answer against. One fact, three consumers: the prose
    section, this schema, and the verdict.
  */
  const multiDevelopment = developmentBreadth?.multiDevelopment === true;

  const briefProperties: Record<string, unknown> = multiDevelopment
    ? {
        primaryDevelopment: {
          type: 'string',
          description:
            'The single most significant material development the supplied evidence establishes, written as readable prose. This field and "additionalDevelopments" must cover DIFFERENT material developments - do not restate the same development in both, and do not split one development across them.',
        },
        additionalDevelopments: {
          type: 'string',
          description:
            'The OTHER material developments the supplied evidence establishes, distinct from the one in "primaryDevelopment". Separate them from each other with a blank line where there is more than one. There is no required number: cover what the evidence actually establishes and nothing more. Do NOT pad, do NOT invent a second development, and do NOT emit one per article or per source - if the evidence genuinely supports only a thin second strand, say so plainly and briefly rather than inflating it.',
        },
      }
    : { summary: { type: 'string' } };

  const briefRequired: string[] = multiDevelopment
    ? ['primaryDevelopment', 'additionalDevelopments']
    : ['summary'];

  return {
    name: 'news_analysis',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        headline: { type: 'string' },
        // C910 - one `summary` string, or the two required brief fields.
        ...briefProperties,
        keyFacts: { type: 'array', items: sourcedClaim },
        /** Milestone #62 Phase 1 — reuses the exact sourcedClaim shape, no new schema family. */
        context: { type: 'array', items: sourcedClaim },
        /** Milestone #62 Phase 1 — reuses the exact sourcedClaim shape, no new schema family. */
        relevance: { type: 'array', items: sourcedClaim },
        /** Milestone #62 Phase 2 — dedicated affectedParty shape (party/partyType/effect), not sourcedClaim. */
        affectedParties: { type: 'array', items: affectedParty },
        /** Milestone #62 Phase 2 — reuses the exact sourcedClaim shape, no new schema family. */
        immediateImpacts: { type: 'array', items: sourcedClaim },
        /** Milestone #62 Phase 2 — reuses the exact sourcedClaim shape, no new schema family. */
        spilloverImplications: { type: 'array', items: sourcedClaim },
        /** Milestone #62 Phase 3 — nullable object; see significanceSchema's own doc comment above. */
        significance: significanceSchema,
        /** Milestone #62 Phase 4 (final) — reuses the exact sourcedClaim shape, no new schema family. */
        watchNext: { type: 'array', items: watchNextItem },
        agreements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              point: { type: 'string' },
              evidenceIds: { type: 'array', items: { type: 'string' } },
              evidenceBasis: evidenceBasisSchema,
              relationshipAssessmentIds: relationshipAssessmentIdsSchema,
            },
            required: ['point', 'evidenceIds', 'evidenceBasis', 'relationshipAssessmentIds'],
            additionalProperties: false,
          },
        },
        differences: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              positions: { type: 'array', items: positionSchema },
            },
            required: ['topic', 'positions'],
            additionalProperties: false,
          },
        },
        unknowns: { type: 'array', items: { type: 'string' } },
        uncertainties: { type: 'array', items: uncertaintySchema },
        relationalEvidenceAssessments: {
          type: 'array',
          items: relationalEvidenceAssessmentSchema,
        },
        timeline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              event: { type: 'string' },
              evidenceIds: { type: 'array', items: { type: 'string' } },
              evidenceBasis: evidenceBasisSchema,
              relationshipAssessmentIds: relationshipAssessmentIdsSchema,
            },
            required: [
              'timestamp',
              'event',
              'evidenceIds',
              'evidenceBasis',
              'relationshipAssessmentIds',
            ],
            additionalProperties: false,
          },
        },
        confidence: {
          type: 'object',
          properties: {
            level: { type: 'string', enum: ['low', 'medium', 'high'] },
            /*
              L-3 — THE SCALE WAS NEVER STATED, AND THAT IS THE WHOLE DEFECT.

              This was `{ type: 'number' }`: no range, no description, nothing
              anywhere telling the model what units to answer in. The shared
              TypeScript type says "0-100", but a comment in our repository is
              not a contract the model can read.

              So the model answered on the scale models naturally use for
              confidence — a 0-1 probability. 0.92 then met
              `Math.round(score)` in the validator and became 1, which the UI
              rendered faithfully as "HIGH (1/100)".

              Neither the number nor the label was wrong. They were on
              different scales, and nothing reconciled them.
            */
            score: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description:
                'Integer 0-100, where 100 is maximum confidence. NOT a 0-1 probability.',
            },
            explanation: { type: 'string' },
          },
          required: ['level', 'score', 'explanation'],
          additionalProperties: false,
        },
        entities: {
          type: 'object',
          properties: {
            countries: { type: 'array', items: { type: 'string' } },
            locations: { type: 'array', items: { type: 'string' } },
            people: { type: 'array', items: { type: 'string' } },
            organizations: { type: 'array', items: { type: 'string' } },
            topics: { type: 'array', items: { type: 'string' } },
          },
          required: ['countries', 'locations', 'people', 'organizations', 'topics'],
          additionalProperties: false,
        },
      },
      required: [
        'query',
        'headline',
        // C910 - must mirror briefProperties exactly: under `strict: true` every
        // declared property has to appear in `required`.
        ...briefRequired,
        'keyFacts',
        'context',
        'relevance',
        'affectedParties',
        'immediateImpacts',
        'spilloverImplications',
        'significance',
        'watchNext',
        'agreements',
        'differences',
        'unknowns',
        'uncertainties',
        'relationalEvidenceAssessments',
        'timeline',
        'confidence',
        'entities',
      ],
      additionalProperties: false,
    },
  };
}
