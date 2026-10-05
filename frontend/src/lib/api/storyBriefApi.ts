import { accountFetch } from '@/lib/api/accountFetch';
import { fetchThread } from '@/lib/stories/stageBApi';
import {
  STORY_BRIEF_CONCLUSIONS,
  STORY_BRIEF_FAILURE_KINDS,
  type BriefEvidenceRef,
  type BriefKeyFact,
  type BriefResult,
  type BriefRunIntent,
  type EvidenceRevision,
  type StoredBriefContent,
  type StoryBriefConclusion,
  type StoryBriefFailureKind,
  type StoryBriefView,
  type StoryId,
} from '@/lib/storyBrief/storyBriefView';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMPACT VISUAL PRODUCT R1 — THE STORY BRIEF ADAPTER (the one plug-in point)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Bound to the REAL canonical Story Brief R1 on the engineering checkpoint (EA-STORY-BRIEF-01):
 *
 *   GET  /api/stories/:storyId/brief   public, ZERO COMPUTE (the generator is unreachable from it)
 *   POST /api/stories/:storyId/brief   the explicit Read Brief — signed-in + CSRF; reuses a current
 *                                      Brief, else ONE deduplicated generation attempt
 *
 * Both answer 404 while STORY_BRIEF_ENABLED is off; this adapter reads that as OFF. The flag is
 * never set from here and there is no frontend copy of it: the backend twin is the only switch.
 * In R1 the production generator is `UnavailableStoryBriefGenerator` (`generationAvailable:false`),
 * so no surface offers generation and nothing is ever spent.
 *
 * IDENTITY. The endpoints take the CANONICAL story id. The Home feed carries only the governed
 * `articleRef`, and the one public, read-only response that resolves articleRef → canonical story
 * on this checkpoint is the Discussion thread read (`storyIdentity.resolveByArticleRef`, a lookup
 * that never creates a story), served only under discussion.read. Without it this page cannot
 * learn the id and says so (UNRESOLVED) — it never guesses or derives one. A dedicated public
 * resolver is recorded as a backend dependency for the engineering lane.
 *
 * PARSING is strict and one-way: an unrecognised server shape is FAILED, never a guessed state.
 * No browser storage is ever a Brief source (S-8). No fixture is imported here (S-7).
 */

const BRIEF_PATH = (storyId: string): string => `/stories/${encodeURIComponent(storyId)}/brief`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** articleRef → canonical story id, through the public read-only thread resolution. */
export async function resolveStoryId(
  articleRef: string,
  capability: { readonly discussionRead: boolean },
): Promise<BriefResult<StoryId>> {
  if (!capability.discussionRead) return { ok: false, reason: 'UNRESOLVED' };
  const thread = await fetchThread(articleRef);
  if (!thread.ok) return { ok: false, reason: thread.reason === 'OFF' ? 'UNRESOLVED' : thread.reason === 'LOCKED' ? 'FAILED' : thread.reason };
  const id = thread.value.storyId;
  if (id === null) return { ok: false, reason: 'NO_STORY' };
  return UUID.test(id) ? { ok: true, value: id as StoryId } : { ok: false, reason: 'INVALID' };
}

async function call(storyId: StoryId, method: 'GET' | 'POST'): Promise<BriefResult<StoryBriefView>> {
  try {
    const response = await accountFetch(BRIEF_PATH(storyId), method === 'POST' ? { method: 'POST', body: {} } : {});
    if (response.ok) {
      const view = parseStoryBriefView(await response.json());
      return view === null ? { ok: false, reason: 'FAILED' } : { ok: true, value: view };
    }
    if (response.status === 404) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, reason: body?.message === 'STORY' ? 'NO_STORY' : 'OFF' };
    }
    if (response.status === 401 || response.status === 403) return { ok: false, reason: 'SIGNED_OUT' };
    if (response.status === 429) return { ok: false, reason: 'RATE_LIMITED' };
    if (response.status === 400) return { ok: false, reason: 'INVALID' };
    return { ok: false, reason: 'FAILED' };
  } catch {
    return { ok: false, reason: 'FAILED' };
  }
}

/** READ PATH ONLY — zero compute. Reopening a Brief always comes here. */
export function readStoryBrief(storyId: StoryId): Promise<BriefResult<StoryBriefView>> {
  return call(storyId, 'GET');
}

/*
 * The explicit run. One in-flight request per story from this page (the server also collapses
 * concurrent attempts onto one claim); a second press while one is running joins it.
 */
const inFlight = new Map<string, Promise<BriefResult<StoryBriefView>>>();

export function requestStoryBrief(storyId: StoryId, intent: BriefRunIntent): Promise<BriefResult<StoryBriefView>> {
  void intent; /* the closed intent set is the type-level guard; the server needs no reason */
  const existing = inFlight.get(storyId);
  if (existing !== undefined) return existing;
  const pending = call(storyId, 'POST').finally(() => inFlight.delete(storyId));
  inFlight.set(storyId, pending);
  return pending;
}

/** Test seam: the number of runs currently in flight. */
export function storyBriefRunsInFlightForTests(): number {
  return inFlight.size;
}

/* ── STRICT SERVER → VIEW MAPPING ─────────────────────────────────────────── */

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []);

function conclusionOf(v: unknown): StoryBriefConclusion | null {
  return (STORY_BRIEF_CONCLUSIONS as readonly string[]).includes(v as string) ? (v as StoryBriefConclusion) : null;
}
function failureOf(v: unknown): StoryBriefFailureKind | null {
  return (STORY_BRIEF_FAILURE_KINDS as readonly string[]).includes(v as string) ? (v as StoryBriefFailureKind) : null;
}

function keyFactsOf(v: unknown): BriefKeyFact[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((f) =>
    isObj(f) && typeof f.claim === 'string' && f.claim.trim() !== '' ? [{ claim: f.claim, sourceArticleIds: strList(f.sourceArticleIds) }] : [],
  );
}

function evidenceOf(v: unknown): BriefEvidenceRef[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((r) => {
    if (!isObj(r)) return [];
    const id = str(r.id);
    const title = str(r.title);
    const publisher = str(r.publisher);
    if (id === null || title === null || publisher === null) return [];
    return [{ id, url: str(r.url), title, publisher, publishedAt: str(r.publishedAt) }];
  });
}

export function storedBriefOf(raw: unknown): StoredBriefContent | null {
  if (!isObj(raw)) return null;
  const conclusion = conclusionOf(raw.state);
  const version = typeof raw.version === 'number' && Number.isInteger(raw.version) && raw.version >= 1 ? raw.version : null;
  const revision = str(raw.evidenceRevision);
  const asOf = str(raw.asOf);
  const generatedAt = str(raw.generatedAt);
  if (conclusion === null || version === null || revision === null || asOf === null || generatedAt === null) return null;
  const blocks = isObj(raw.blocks) ? raw.blocks : {};
  const background = isObj(blocks.background) && typeof blocks.background.text === 'string' ? blocks.background.text : null;
  return {
    version,
    conclusion,
    evidenceRevision: revision as EvidenceRevision,
    asOf,
    generatedAt,
    summary: str(blocks.summary),
    keyFacts: keyFactsOf(blocks.keyFacts),
    background,
    evidence: evidenceOf(raw.evidenceRefs),
    coverageGaps: strList(raw.coverageGaps),
    uncertainty: strList(raw.uncertainty),
  };
}

/** The server's StoryBriefView → the presentation view. Unrecognised → null (shown as FAILED). */
export function parseStoryBriefView(raw: unknown): StoryBriefView | null {
  if (!isObj(raw)) return null;
  const storyId = str(raw.storyId);
  const revision = str(raw.currentEvidenceRevision);
  const versions = typeof raw.versions === 'number' && raw.versions >= 0 ? raw.versions : null;
  if (storyId === null || revision === null || versions === null || typeof raw.generationAvailable !== 'boolean') return null;
  const base = {
    storyId: storyId as StoryId,
    currentEvidenceRevision: revision as EvidenceRevision,
    versions,
    generationAvailable: raw.generationAvailable,
  };
  const brief = raw.brief === null || raw.brief === undefined ? null : storedBriefOf(raw.brief);
  const lastAttempt = isObj(raw.lastAttempt) ? raw.lastAttempt : null;
  const lastFailure = lastAttempt !== null && lastAttempt.status === 'FAILED' ? failureOf(lastAttempt.failureKind) : null;

  switch (raw.state) {
    case 'NOT_GENERATED':
      return { ...base, state: 'NONE' };
    case 'CHECKING':
      return { ...base, state: 'CHECKING', inspectable: brief };
    case 'READY':
    case 'PARTIAL':
    case 'INSUFFICIENT':
      return brief === null ? null : { ...base, state: raw.state, brief };
    case 'STALE':
      return brief === null ? null : { ...base, state: 'STALE', brief, lastAttemptFailure: lastFailure };
    case 'FAILED':
      return lastFailure === null ? { ...base, state: 'FAILED', failureKind: 'OUTCOME_UNKNOWN' } : { ...base, state: 'FAILED', failureKind: lastFailure };
    default:
      return null;
  }
}
