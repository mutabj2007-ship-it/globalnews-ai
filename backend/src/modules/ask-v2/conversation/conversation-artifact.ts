import { supportedWindowHours } from '../../ask-router/reporting-window';
/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 — CONVERSATION ARTIFACTS: memory of work this assistant itself produced
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The R3 rule stands: the reader's scope, preferences, geography, objectives and constraints come
 * ONLY from the reader's own turns. That is not enough for conceptual conversation: "Apply that
 * idea to GlobalNewsAI", "Which part is weakest?", "Turn that into a 90-day plan" refer to a
 * structure the ANSWER built (a framework, a diagnosis, recommendations).
 *
 * A ConversationArtifact is that structure, bounded and labelled:
 *   kind        CONCEPTUAL_FRAMEWORK · DIAGNOSIS · COMPARISON · DECISION_CRITERIA ·
 *               RECOMMENDATION · PLAN · SUMMARY            (model-emitted, MODEL_REASONING)
 *               SOURCED_REPORT · REASONED_ANSWER           (server-derived — R4 ALPHA R-3)
 *   label       a short name ("Prime moment")
 *   components  at most 8 short component names / claim points
 *   provenance  MODEL_REASONING, or SOURCED_REPORTING for an answer that stood on sourced reporting
 *   citable     false — ALWAYS
 *
 * A model-emitted artifact is returned by the SAME reasoning call that wrote the answer (no second
 * model call to "remember"), validated here, stored with the answer, and never regenerated when the
 * turn is reopened. It is conversation memory, never evidence: it can resolve a reference ("that
 * idea", "which part", "it"), and it can never become a current fact, a source, an official claim,
 * the reader's preference or scope.
 */
export const ARTIFACT_KINDS = [
  'CONCEPTUAL_FRAMEWORK',
  'DIAGNOSIS',
  'COMPARISON',
  'DECISION_CRITERIA',
  'RECOMMENDATION',
  'PLAN',
  'SUMMARY',
] as const;
/** The kinds the MODEL may emit (listed in its prompt — job-execution.ts). Unchanged. */
export type ModelArtifactKind = (typeof ARTIFACT_KINDS)[number];

/*
  CTO R4 ALPHA DEFECT RULING R-3 — EVERY ANSWERED TURN IS REFERABLE CONVERSATION WORK.
  Live defects 2da0209c / 5ac0e7b0: only a reasoning answer whose model chose to emit a structure
  left memory, so "Why did you say that?" after a news answer had nothing to bind. The SAME authority
  now also holds a server-derived record of every other successful answer — never a second memory
  system, never emitted by the model (these kinds are not in its prompt), never evidence:
    SOURCED_REPORT   an answer that stood on sourced reporting: its claim points + REFERENCES to the
                     evidence the answer used (article ids already retained with that answer — no
                     duplicate evidence store)
    REASONED_ANSWER  a model-reasoning answer that emitted no structure of its own
*/
export const SERVER_ARTIFACT_KINDS = ['SOURCED_REPORT', 'REASONED_ANSWER'] as const;
export type ArtifactKind = ModelArtifactKind | (typeof SERVER_ARTIFACT_KINDS)[number];
export type ArtifactProvenance = 'MODEL_REASONING' | 'SOURCED_REPORTING';

/** R-3 / R-5 — the original semantic scope of the answer, so a later turn re-examines THAT. */
export interface ArtifactScope {
  /** the question the answer answered (the effective, server-composed question), bounded */
  readonly question: string;
  readonly job: string | null;
  /** ISO3 states the answer was about (actors, or the typed place) */
  readonly countries: readonly string[];
  readonly relation: string | null;
  readonly freshness: 'NONE' | 'CURRENT' | 'MIXED';
  /**
   * ASK RETRIEVAL / CONVERSATION R2 (§7) — the reporting window the answer was bounded by (the
   * reader's own period words and its ORIGINAL instants), so a follow-up on that answer keeps the
   * same period ("past seven days" of the original ask), never a dropped or re-anchored one.
   */
  readonly window?: ArtifactWindow;
}

export interface ArtifactWindow {
  readonly statedPeriod: string;
  readonly from: string;
  readonly to: string;
}

export interface ConversationArtifact {
  readonly kind: ArtifactKind;
  readonly label: string;
  readonly components: readonly string[];
  readonly provenance: ArtifactProvenance;
  /** conversation memory is NEVER evidence and never a source — always false */
  readonly citable: false;
  readonly scope?: ArtifactScope;
  /** references to evidence the answer used (retained article ids), never the evidence itself */
  readonly evidenceRefs?: readonly string[];
  /**
   * ASK RETRIEVAL / CONVERSATION R2 (§7) — the canonical URLs of the evidence a SOURCED answer
   * used: the story identity (articleRef = sha256(url)) a follow-up re-reads from RETAINED
   * reporting ("put those in a table") instead of running a fresh, unrelated search. References
   * only — never prompt data (artifactPromptBlock never prints them), never a source by itself.
   */
  readonly evidenceUrls?: readonly string[];
  /**
   * ASK RETRIEVAL / CONVERSATION R2 (§7) — the current part of the question this answer was asked
   * found NO verified reporting (its search found nothing or failed): the answer is reasoning
   * beside a named gap, never findings. A follow-up on it says so instead of revising "findings".
   */
  readonly currentFindings?: 'NONE';
  /**
   * ASK R2 LIVE-GATE REPAIR (P0-4) — the earlier turn did NOT COMPLETE (its execution failed:
   * MODEL_FAILURE / a deadline / a refusal): server-derived from the stored turn, never emitted by
   * a model. Its question and scope survive so a correction keeps the reader's intent; it carries
   * no findings and is never evidence.
   */
  readonly incomplete?: true;
  /**
   * ASK EVIDENCE CONTINUITY R1 (Production op ce732c69) — WHY a record carries no verified evidence:
   * the search did not complete (a source was unavailable / rate-limited) or it completed and found
   * no qualifying reporting. Server-derived from the retrieval facts, only beside
   * `currentFindings: 'NONE'`; a later turn states it instead of reading "summarised reporting".
   */
  readonly noEvidenceReason?: NoEvidenceReason;
}

export type NoEvidenceReason = 'SEARCH_INCOMPLETE' | 'NO_QUALIFYING_REPORTING';

/** The artifact as it is handed to a later turn: with the turn that produced it. */
export interface PriorArtifact extends ConversationArtifact {
  readonly sourceOperationId: string;
}

export const ARTIFACT_MAX_COMPONENTS = 8;
const MAX_LABEL = 80;
const MAX_COMPONENT = 80;
/* ASK R2 LIVE-GATE REPAIR (P0-4) — the WHOLE earlier question (its output contract — table,
   columns, closing — is at its end; 300 characters cut it off), bounded by the documented limit */
const MAX_SCOPE_QUESTION = 4000;
const MAX_EVIDENCE_REFS = 8;
const EVIDENCE_REF = /^[A-Za-z0-9:._-]{1,120}$/;
const EVIDENCE_URL = /^https?:\/\/[^\s<>"'`]{1,2040}$/i;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MAX_STATED_PERIOD = 60;

/* plain text only: no markup, no URLs, no delimiter tricks — this travels back into a prompt */
function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value
    .replace(/<<<|>>>|```/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length === 0 ? null : text.slice(0, max);
}

/**
 * Validate an untrusted MODEL candidate. Only the model kinds; always MODEL_REASONING; no scope or
 * evidence references (the model can never claim an answer was sourced). Null when not well-formed.
 */
export function validateArtifact(candidate: unknown): ConversationArtifact | null {
  if (candidate === null || typeof candidate !== 'object') return null;
  const c = candidate as Record<string, unknown>;
  const kind = typeof c.kind === 'string' ? c.kind.toUpperCase() : '';
  if (!(ARTIFACT_KINDS as readonly string[]).includes(kind)) return null;
  const label = clean(c.label, MAX_LABEL);
  if (label === null) return null;
  const raw = Array.isArray(c.components) ? c.components : [];
  const components = [
    ...new Set(raw.map((x) => clean(x, MAX_COMPONENT)).filter((x): x is string => x !== null)),
  ].slice(0, ARTIFACT_MAX_COMPONENTS);
  if (components.length === 0) return null;
  return {
    kind: kind as ModelArtifactKind,
    label,
    components,
    provenance: 'MODEL_REASONING',
    citable: false,
  };
}

/**
 * R-3 — validate an artifact read back from a STORED answer: a model kind (as above) or a
 * server-derived record, with its scope and evidence references bounded. Untrusted input either
 * way: nothing here can turn memory into evidence (citable stays false).
 */
export function validateStoredArtifact(candidate: unknown): ConversationArtifact | null {
  if (candidate === null || typeof candidate !== 'object') return null;
  const c = candidate as Record<string, unknown>;
  const kind = typeof c.kind === 'string' ? c.kind.toUpperCase() : '';
  const server = (SERVER_ARTIFACT_KINDS as readonly string[]).includes(kind);
  /* the shared shape rules (label, components) apply to both families */
  const base = validateArtifact(server ? { ...c, kind: 'SUMMARY' } : candidate);
  if (base === null) return null;
  const provenance: ArtifactProvenance =
    server && c.provenance === 'SOURCED_REPORTING' ? 'SOURCED_REPORTING' : 'MODEL_REASONING';
  const scope = validateScope(c.scope);
  const refs = Array.isArray(c.evidenceRefs)
    ? [
        ...new Set(
          c.evidenceRefs.filter((r): r is string => typeof r === 'string' && EVIDENCE_REF.test(r)),
        ),
      ].slice(0, MAX_EVIDENCE_REFS)
    : [];
  const urls = evidenceUrlsOf(c.evidenceUrls);
  return {
    ...base,
    kind: (server ? kind : base.kind) as ArtifactKind,
    provenance,
    citable: false,
    ...(scope === null ? {} : { scope }),
    ...(provenance === 'SOURCED_REPORTING' && refs.length > 0 ? { evidenceRefs: refs } : {}),
    ...(provenance === 'SOURCED_REPORTING' && urls.length > 0 ? { evidenceUrls: urls } : {}),
    ...(server && c.currentFindings === 'NONE' ? { currentFindings: 'NONE' as const } : {}),
    ...(server &&
    c.currentFindings === 'NONE' &&
    (c.noEvidenceReason === 'SEARCH_INCOMPLETE' || c.noEvidenceReason === 'NO_QUALIFYING_REPORTING')
      ? { noEvidenceReason: c.noEvidenceReason as NoEvidenceReason }
      : {}),
    ...(server && c.incomplete === true ? { incomplete: true as const } : {}),
  };
}

/** R2 §7 — the evidence URLs of a stored record, bounded (http(s) only, at most 8, no dupes). */
function evidenceUrlsOf(candidate: unknown): string[] {
  if (!Array.isArray(candidate)) return [];
  return [
    ...new Set(candidate.filter((u): u is string => typeof u === 'string' && EVIDENCE_URL.test(u))),
  ].slice(0, MAX_EVIDENCE_REFS);
}

/** R2 §7 — a stored reporting window: the reader's period words and two valid instants. */
function validateWindow(candidate: unknown): ArtifactWindow | null {
  if (candidate === null || typeof candidate !== 'object') return null;
  const c = candidate as Record<string, unknown>;
  const statedPeriod = clean(c.statedPeriod, MAX_STATED_PERIOD);
  const from = typeof c.from === 'string' && ISO_INSTANT.test(c.from) ? c.from : null;
  const to = typeof c.to === 'string' && ISO_INSTANT.test(c.to) ? c.to : null;
  if (statedPeriod === null || from === null || to === null) return null;
  return Date.parse(from) < Date.parse(to) ? { statedPeriod, from, to } : null;
}

function validateScope(candidate: unknown): ArtifactScope | null {
  if (candidate === null || typeof candidate !== 'object') return null;
  const c = candidate as Record<string, unknown>;
  const question = clean(c.question, MAX_SCOPE_QUESTION);
  if (question === null) return null;
  const countries = Array.isArray(c.countries)
    ? [
        ...new Set(
          c.countries.filter((x): x is string => typeof x === 'string' && /^[A-Z]{3}$/.test(x)),
        ),
      ].slice(0, 6)
    : [];
  const freshness: ArtifactScope['freshness'] =
    c.freshness === 'CURRENT' || c.freshness === 'MIXED' ? c.freshness : 'NONE';
  const window = validateWindow(c.window);
  return {
    question,
    job: typeof c.job === 'string' && /^[A-Z_]{1,40}$/.test(c.job) ? c.job : null,
    countries,
    relation:
      typeof c.relation === 'string' && /^[A-Z_]{1,40}$/.test(c.relation) ? c.relation : null,
    freshness,
    ...(window === null ? {} : { window }),
  };
}

/**
 * R-3 — a server-derived record for an answered turn (never model-emitted). Null when the answer
 * has nothing bounded to record.
 */
export function serverArtifact(input: {
  readonly kind: (typeof SERVER_ARTIFACT_KINDS)[number];
  readonly provenance: ArtifactProvenance;
  readonly label: string;
  readonly components: readonly string[];
  readonly scope: ArtifactScope | null;
  readonly evidenceRefs?: readonly string[];
  readonly evidenceUrls?: readonly string[];
  readonly currentFindings?: 'NONE';
  readonly noEvidenceReason?: NoEvidenceReason;
}): ConversationArtifact | null {
  return validateStoredArtifact({ ...input, scope: input.scope ?? undefined });
}

/** R-3 — a model-emitted artifact keeps its content and gains the server's scope record. */
export function withScope(
  artifact: ConversationArtifact,
  scope: ArtifactScope | null,
): ConversationArtifact {
  const bounded = scope === null ? null : validateScope(scope);
  return bounded === null ? artifact : { ...artifact, scope: bounded };
}

export const ARTIFACT_OPEN = '<<<ARTIFACT';
export const ARTIFACT_CLOSE = 'ARTIFACT>>>';

/**
 * Split the model's output into reader-facing prose and an artifact block appended at its end
 * (`<<<ARTIFACT {json} ARTIFACT>>>`). A malformed or absent block yields no artifact and leaves the
 * prose untouched (minus the block): the answer never depends on the memory.
 */
export function splitArtifact(output: string): {
  text: string;
  artifact: ConversationArtifact | null;
} {
  const start = output.lastIndexOf(ARTIFACT_OPEN);
  if (start === -1) return { text: output.trim(), artifact: null };
  const end = output.indexOf(ARTIFACT_CLOSE, start);
  const body = output.slice(start + ARTIFACT_OPEN.length, end === -1 ? undefined : end).trim();
  const text = (
    output.slice(0, start) + (end === -1 ? '' : output.slice(end + ARTIFACT_CLOSE.length))
  ).trim();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  return { text, artifact: validateArtifact(parsed) };
}

/**
 * ASK EVIDENCE CONTINUITY R1 — does this earlier record carry NO verified evidence, and why?
 *   null           not a record of a search (pure reasoning), or it stood on verified evidence (a
 *                  sourced answer with evidence references) — behaviour unchanged
 *   'UNAVAILABLE'  its search did not complete (a source was unavailable / rate-limited), or the
 *                  turn itself did not complete
 *   'NO_EVIDENCE'  its search completed and found no qualifying reporting (also a legacy sourced
 *                  record without evidence references, whose reason was never stored)
 */
export function priorEvidenceGap(
  artifact: ConversationArtifact | undefined,
): 'UNAVAILABLE' | 'NO_EVIDENCE' | null {
  if (artifact === undefined) return null;
  const sourced = artifact.provenance === 'SOURCED_REPORTING';
  if (sourced && (artifact.evidenceRefs ?? []).length > 0) return null;
  if (!sourced && artifact.currentFindings !== 'NONE') return null;
  return artifact.incomplete === true || artifact.noEvidenceReason === 'SEARCH_INCOMPLETE'
    ? 'UNAVAILABLE'
    : 'NO_EVIDENCE';
}

/** ASK EVIDENCE CONTINUITY R1 — the truthful reason a record holds no verified reports. */
export function noEvidenceReasonText(gap: 'UNAVAILABLE' | 'NO_EVIDENCE'): string {
  return gap === 'UNAVAILABLE'
    ? 'the search did not complete (a news source was unavailable or rate-limited), so what current reporting says is not known'
    : 'the search completed and found no qualifying reporting, which is not evidence that nothing happened';
}

/** The artifact as delimited DATA for a later prompt (never rules, never evidence). */
export function artifactPromptBlock(artifact: ConversationArtifact): string {
  const sourced = artifact.provenance === 'SOURCED_REPORTING';
  /* ASK EVIDENCE CONTINUITY R1 — a sourced record with no evidence summarised NOTHING: it is never
     described as "summarised sourced reporting" (Production op 9713f8ee read it that way) */
  const gap = sourced ? priorEvidenceGap(artifact) : null;
  const header =
    gap !== null
      ? `your own earlier answer; its search returned NO verified reports because ${noEvidenceReasonText(gap)}; it holds no findings, is NOT evidence and NOT a current fact`
      : sourced
        ? 'your own earlier answer, which summarised sourced reporting retrieved at that time; this summary is NOT evidence and NOT a current fact'
        : 'your own earlier model reasoning; NOT evidence, NOT a source, NOT a current fact';
  return (
    `<<<EARLIER WORK IN THIS CONVERSATION (${header})\n` +
    (artifact.scope === undefined ? '' : `question it answered: ${artifact.scope.question}\n`) +
    `kind: ${artifact.kind}\nlabel: ${artifact.label}\n` +
    `${gap !== null ? 'what the record says' : sourced ? 'points the answer made' : 'components'}: ${artifact.components.join('; ')}\n` +
    `EARLIER WORK>>>`
  );
}

/** A stable identity for the plan revision (the same memory → the same revision). */
export function artifactIdentity(artifact: ConversationArtifact): string {
  /* the pre-R-3 identity, byte for byte, for every artifact that carries nothing new */
  const base = `${artifact.kind}|${artifact.label}|${artifact.components.join('|')}`;
  return (
    base +
    (artifact.provenance === 'SOURCED_REPORTING' ? '|SOURCED' : '') +
    (artifact.scope === undefined ? '' : `|${artifact.scope.question}`)
  );
}

/* the relative windows reporting-window.ts honours, read from an earlier question's own words */
const PRIOR_RELATIVE_WINDOW =
  /(?:(?:over|in|during|within|for)\s+)?(?:the\s+)?(?:last|past|previous)\s+(?:\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|fifteen|twenty|thirty)\s+(?:days?|hours?)(?![\p{L}\p{N}])|\b(?:the\s+)?past\s+week\b/iu;

/**
 * ASK R2 LIVE-GATE REPAIR (P0-4) — the record of an earlier turn that did NOT complete.
 *
 * Live Alpha 2026-10-06 (fe96eb1): the corridor question (B) released MODEL_FAILURE, so it left no
 * stored answer and no memory; "My shipment goes through Dar es Salaam, not Mombasa. Revise your
 * answer…" then lost Rwanda (destination), the seven-day window, the import purpose and the
 * requested structure. The TURN itself is stored (its question, its plan's typed places and its
 * time), so the server derives a bounded record from those facts — no findings, never evidence,
 * marked incomplete — and the existing follow-up contract revises THAT question honestly.
 */
export function incompleteTurnArtifact(input: {
  readonly question: string;
  readonly planScope: unknown;
  readonly askedAt: Date;
}): ConversationArtifact | null {
  const question = clean(input.question, MAX_SCOPE_QUESTION);
  if (question === null) return null;
  let countries: string[] = [];
  try {
    const scope =
      typeof input.planScope === 'string' ? (JSON.parse(input.planScope) as { geography?: unknown }) : null;
    countries = Array.isArray(scope?.geography)
      ? [
          ...new Set(
            scope.geography
              .filter((g): g is string => typeof g === 'string')
              .map((g) => g.split(':').pop() ?? '')
              .filter((iso3) => /^[A-Z]{3}$/.test(iso3)),
          ),
        ].slice(0, 8)
      : [];
  } catch {
    countries = [];
  }
  const period = PRIOR_RELATIVE_WINDOW.exec(question)?.[0]?.trim();
  const hours = period === undefined ? null : supportedWindowHours(period);
  const to = input.askedAt.getTime();
  const window =
    period !== undefined && hours !== null && Number.isFinite(to)
      ? { statedPeriod: period, from: new Date(to - hours * 3_600_000).toISOString(), to: new Date(to).toISOString() }
      : null;
  return {
    kind: 'REASONED_ANSWER',
    label: 'Earlier search did not complete',
    components: [],
    provenance: 'MODEL_REASONING',
    citable: false,
    scope: {
      question,
      job: null,
      countries,
      relation: null,
      freshness: 'CURRENT',
      ...(window === null ? {} : { window }),
    },
    currentFindings: 'NONE',
    incomplete: true,
  };
}
