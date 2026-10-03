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
 *               RECOMMENDATION · PLAN · SUMMARY
 *   label       a short name ("Prime moment")
 *   components  at most 8 short component names
 *   provenance  MODEL_REASONING, citable false — ALWAYS
 *
 * It is returned by the SAME reasoning call that wrote the answer (no second model call to
 * "remember"), validated here, stored with the answer, and never regenerated when the turn is
 * reopened. It is conversation memory, never evidence: it can resolve a reference ("that idea",
 * "which part", "it"), and it can never become a current fact, a source, an official claim, the
 * reader's preference or scope.
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
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export interface ConversationArtifact {
  readonly kind: ArtifactKind;
  readonly label: string;
  readonly components: readonly string[];
  readonly provenance: 'MODEL_REASONING';
  readonly citable: false;
}

/** The artifact as it is handed to a later turn: with the turn that produced it. */
export interface PriorArtifact extends ConversationArtifact {
  readonly sourceOperationId: string;
}

export const ARTIFACT_MAX_COMPONENTS = 8;
const MAX_LABEL = 80;
const MAX_COMPONENT = 80;

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

/** Validate an untrusted candidate (model output or a stored payload). Null when not well-formed. */
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
    kind: kind as ArtifactKind,
    label,
    components,
    provenance: 'MODEL_REASONING',
    citable: false,
  };
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

/** The artifact as delimited DATA for a later prompt (never rules, never evidence). */
export function artifactPromptBlock(artifact: ConversationArtifact): string {
  return (
    `<<<EARLIER WORK IN THIS CONVERSATION (your own earlier model reasoning; NOT evidence, NOT a source, NOT a current fact)\n` +
    `kind: ${artifact.kind}\nlabel: ${artifact.label}\ncomponents: ${artifact.components.join('; ')}\n` +
    `EARLIER WORK>>>`
  );
}

/** A stable identity for the plan revision (the same memory → the same revision). */
export function artifactIdentity(artifact: ConversationArtifact): string {
  return `${artifact.kind}|${artifact.label}|${artifact.components.join('|')}`;
}
