/*
  E1-TAARIFA-RIGHTS-RULING-R2 §8.2 step 3 — a STORED answer derived from sources that are not
  cleared for AI use is WITHHELD from every reader surface, not deleted: the stored record stays
  unchanged for audit, and what a reader receives says it is withheld pending a source-rights review.

  Decided at read time from the payload's own evidence (analysis.articles[].sourceId) with the same
  governed policy every new answer uses, so a later clearance re-admits it and a later restriction
  withholds it — no data rewrite either way. A metadata list (recentReporting) keeps only items the
  METADATA decision admits. Pure; no I/O.
*/
import { EXTERNAL_READER_POLICY, partitionByRights } from '../news/rights/source-use-policy';
import { isPublisherRightsHeld } from '../news/rights/publisher-rights-hold';

export const WITHHELD_BASIS = 'WITHHELD_SOURCE_RIGHTS' as const;

type Json = Record<string, unknown>;

const articlesOf = (payload: Json): Array<{ sourceId?: string | null; providerId?: string | null; url?: string | null }> => {
  const analysis = payload.analysis as Json | null | undefined;
  const list = analysis?.articles;
  return Array.isArray(list) ? (list as Array<{ sourceId?: string | null; providerId?: string | null; url?: string | null }>) : [];
};

export function withheldForSourceRights(payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const p = payload as Json;
  /* MASTER CTO R47 / E1-R46 R46-1/2/5/7 — every operation response (fresh, reopen, Saved, guest)
     passes here: an external reader gets a stored answer only on a POSITIVE basis */
  const excluded = partitionByRights(articlesOf(p), 'AI_INPUT', EXTERNAL_READER_POLICY).excluded;

  let out: Json = p;
  const recent = p.recentReporting as Json | null | undefined;
  if (recent && Array.isArray(recent.items)) {
    const items = partitionByRights(
      recent.items as Array<{ sourceId?: string | null; url?: string | null }>,
      'METADATA',
      EXTERNAL_READER_POLICY,
    ).allowed;
    if (items.length !== (recent.items as unknown[]).length) out = { ...out, recentReporting: { ...recent, items } };
  }
  if (excluded.length === 0) return withheldUnverifiableArtifact(out, p);
  return withheldPayload(out, p, excluded.length);
}

/*
  CTO R81 / E1 D2 (forward-adapted from Production CTO R53) — the stored CONVERSATION ARTIFACT of a
  sourced answer carries source-derived claim points (`components`) and the evidence URLs / refs it
  rests on; no reader-JSON walk recognises those strings as articles. Fail closed: a SOURCED artifact
  (or any artifact naming evidence) survives only when every URL and ref it names is an article of
  this same payload that the external-reader AI_INPUT decision admits; one naming none cannot be
  verified and is withheld. An unsourced (general-knowledge / reasoning) artifact is untouched, and
  the stored row is never changed. The answer itself is NOT marked withheld for this (it is not).
*/
function withheldUnverifiableArtifact(out: Json, p: Json): Json {
  const artifact = p.artifact as Json | null | undefined;
  if (artifact === null || artifact === undefined || typeof artifact !== 'object') return out;
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const urls = strings(artifact.evidenceUrls);
  const refs = strings(artifact.evidenceRefs);
  const sourced = artifact.provenance === 'SOURCED_REPORTING' || urls.length > 0 || refs.length > 0;
  if (!sourced) return out;
  const admitted = partitionByRights(articlesOf(p), 'AI_INPUT', EXTERNAL_READER_POLICY).allowed as Array<{ id?: unknown; url?: unknown }>;
  const admittedUrls = new Set(admitted.map((a) => String(a.url)));
  const admittedIds = new Set(admitted.map((a) => String(a.id)));
  const verified = urls.length + refs.length > 0 && urls.every((u) => admittedUrls.has(u)) && refs.every((r) => admittedIds.has(r));
  if (verified) return out;
  return { ...out, artifact: null, sourceRightsWithheld: { count: 1, scope: 'ARTIFACT' } };
}

/*
  CTO R81 / E1 D2 (forward-adapted from Production CTO R54 · C-96) — a withheld answer is an EXPLICIT
  ALLOWLIST, never a spread of the stored payload: every field that is or could be derived from the
  withheld sources (guidance, verification, continuation, research, contributions, any future field,
  and the answer object's own prose) is dropped by default. Kept: the payload's identity and the
  reader's own words and scope, and the run's facts. The answer decision is rebuilt from codes. The
  Alpha shape the reader surface renders (state INSUFFICIENT, basis WITHHELD_SOURCE_RIGHTS,
  `withheld`) is unchanged.
*/
export const WITHHELD_PAYLOAD_ALLOWLIST = ['schema', 'route', 'chips', 'checkedAt', 'aiExecuted', 'modelPriorCitable'] as const;

function withheldPayload(_out: Json, p: Json, count: number): Json {
  const kept: Json = {};
  for (const key of WITHHELD_PAYLOAD_ALLOWLIST) if (key in p) kept[key] = p[key];
  return {
    ...kept,
    answer: { state: 'INSUFFICIENT', basis: WITHHELD_BASIS, missingRoles: [], candidates: [] },
    analysis: null,
    background: null,
    recentReporting: null,
    comparisonTable: null,
    artifact: null,
    intelligence: null,
    withheld: { reason: 'SOURCE_RIGHTS', count },
  };
}

/**
 * MASTER CTO R4 · P0 #86 — the SAME withheld shape, decided by the publisher rights hold ONLY.
 * Briefing snapshots never passed the read-time withholding at all (a pre-existing bypass for every
 * rights class); #86 is source-specific, so a briefing is withheld here only when its answer rests on
 * a held publisher host. Widening it to every rights class is a separate CTO / E1 decision.
 */
export function withheldForPublisherRightsHold(payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const p = payload as Json;
  const held = articlesOf(p).filter((a) => isPublisherRightsHeld(a)).length;
  let out: Json = p;
  const recent = p.recentReporting as Json | null | undefined;
  if (recent && Array.isArray(recent.items)) {
    const items = (recent.items as Array<{ url?: string | null }>).filter((i) => !isPublisherRightsHeld(i));
    if (items.length !== (recent.items as unknown[]).length) out = { ...out, recentReporting: { ...recent, items } };
  }
  return held === 0 ? out : withheldPayload(out, p, held);
}

/**
 * MASTER CTO P0 RIGHTS CONTAINMENT R1.1 — may an earlier answer's points reach the model again?
 * Model-reasoning answers carry no source content (yes). A SOURCED answer only when every evidence
 * reference still resolves (through the store, which cannot return a held source) to an article
 * usable as AI input; no references, too many to check, an unresolvable one or a failed read → no.
 */
export async function priorWorkRightsClearedWith(
  artifact: { readonly provenance?: string; readonly evidenceRefs?: readonly string[] },
  findArticleById: ((id: string) => Promise<{ sourceId?: string | null; providerId?: string | null; url?: string | null } | null>) | undefined,
  maxRefs: number,
): Promise<boolean> {
  if (artifact.provenance !== 'SOURCED_REPORTING') return true;
  const refs = artifact.evidenceRefs ?? [];
  if (refs.length === 0 || refs.length > maxRefs || findArticleById === undefined) return false;
  try {
    const found = await Promise.all(refs.map((id) => findArticleById(id)));
    if (found.some((a) => a === null)) return false;
    /* E1-R46 R46-10 — model re-input of a prior sourced answer needs a positive basis too */
    return (
      partitionByRights(
        found as Array<{ sourceId?: string | null; providerId?: string | null; url?: string | null }>,
        'AI_INPUT',
        EXTERNAL_READER_POLICY,
      ).excluded.length === 0
    );
  } catch {
    return false;
  }
}

/**
 * MASTER CTO R47 / E1-R46 R46-6 / R46-8 (#93) — a followed-question CHECK, as an external reader may
 * receive it. Its evidence lines (new, late-found, possible corrections) are publisher metadata; its
 * supported changes are model-written claims resting on those lines. A line whose stored source has
 * no positive basis for METADATA, and a claim citing any source without a positive basis for
 * AI_INPUT, is withheld HERE, at read time: the stored assessment is never rewritten, and what was
 * withheld is counted and said ("withheld" — never "no relevant news").
 */
const CHECK_EVIDENCE_LISTS = ['newEvidence', 'earlierReportingFoundNow', 'possibleCorrections'] as const;

/** Every evidence id a check's assessment refers to (lines and claims), for one batched lookup. */
export function assessmentEvidenceIds(assessment: unknown): string[] {
  if (assessment === null || typeof assessment !== 'object') return [];
  const a = assessment as Json;
  const ids: string[] = [];
  for (const key of CHECK_EVIDENCE_LISTS) {
    const list = a[key];
    if (Array.isArray(list)) for (const line of list) if (typeof (line as Json)?.id === 'string') ids.push((line as Json).id as string);
  }
  const claims = a.supportedChanges;
  if (Array.isArray(claims)) {
    for (const claim of claims) {
      const refs = (claim as Json)?.sourceArticleIds;
      if (Array.isArray(refs)) for (const id of refs) if (typeof id === 'string') ids.push(id);
    }
  }
  return [...new Set(ids)];
}

export function readerSafeAssessment(
  assessment: unknown,
  permitted: { readonly metadata: ReadonlySet<string>; readonly aiInput: ReadonlySet<string> },
): unknown {
  if (assessment === null || typeof assessment !== 'object' || Array.isArray(assessment)) return assessment;
  const a = assessment as Json;
  let withheld = 0;
  const out: Json = { ...a };
  for (const key of CHECK_EVIDENCE_LISTS) {
    const list = a[key];
    if (!Array.isArray(list)) continue;
    const kept = list.filter((line) => typeof (line as Json)?.id === 'string' && permitted.metadata.has((line as Json).id as string));
    withheld += list.length - kept.length;
    out[key] = kept;
  }
  const claims = a.supportedChanges;
  if (Array.isArray(claims)) {
    const kept = claims.filter((claim) => {
      const refs = (claim as Json)?.sourceArticleIds;
      return Array.isArray(refs) && refs.length > 0 && refs.every((id) => typeof id === 'string' && permitted.aiInput.has(id));
    });
    withheld += claims.length - kept.length;
    out.supportedChanges = kept;
  }
  return withheld === 0 ? assessment : { ...out, withheld: { reason: 'SOURCE_RIGHTS', count: withheld } };
}
