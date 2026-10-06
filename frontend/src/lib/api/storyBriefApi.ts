import { accountFetch } from '@/lib/api/accountFetch';
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
 * IDENTITY (PUBLIC-ENGINEERING-BASELINE-R1, 647668c). The endpoints take the CANONICAL story id;
 * the Home feed carries the governed `articleRef`. The frozen contract resolves one to the other:
 *
 *   GET /api/stories/by-article/:articleRef → { articleRef, storyId, materialVersion }
 *
 * read-only, zero compute, nothing created by reading, an alias resolved to its survivor, and NO
 * Discussion dependency — Read brief works with Discussion OFF. (The earlier temporary lookup
 * through the Discussion thread read is removed.) The id is never guessed or derived here.
 *
 * PARSING is strict and one-way: an unrecognised server shape is FAILED, never a guessed state.
 * No browser storage is ever a Brief source (S-8). No fixture is imported here (S-7).
 */

const BRIEF_PATH = (storyId: string): string => `/stories/${encodeURIComponent(storyId)}/brief`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RESOLVE_PATH = (articleRef: string): string => `/stories/by-article/${encodeURIComponent(articleRef)}`;
const ARTICLE_REF = /^[0-9a-f]{64}$/;

/** The canonical identity the frozen contract returns for an article. */
export interface CanonicalStoryIdentity {
  readonly articleRef: string;
  readonly storyId: StoryId;
  /** Story.briefVersion — continuity only (alerts, Discussion), NEVER the Brief staleness key. */
  readonly materialVersion: number | null;
}

/** articleRef → canonical story, through GET /stories/by-article/:articleRef. No Discussion. */
export async function resolveStoryId(articleRef: string): Promise<BriefResult<CanonicalStoryIdentity>> {
  if (!ARTICLE_REF.test(articleRef)) return { ok: false, reason: 'INVALID' };
  try {
    const response = await accountFetch(RESOLVE_PATH(articleRef));
    if (response.status === 404) return { ok: false, reason: 'OFF' };
    if (response.status === 429) return { ok: false, reason: 'RATE_LIMITED' };
    if (response.status === 400) return { ok: false, reason: 'INVALID' };
    if (!response.ok) return { ok: false, reason: 'FAILED' };
    const body = (await response.json()) as { articleRef?: unknown; storyId?: unknown; materialVersion?: unknown } | null;
    if (body === null || body.articleRef !== articleRef) return { ok: false, reason: 'FAILED' };
    if (body.storyId === null) return { ok: false, reason: 'NO_STORY' };
    if (typeof body.storyId !== 'string' || !UUID.test(body.storyId)) return { ok: false, reason: 'INVALID' };
    const materialVersion = typeof body.materialVersion === 'number' ? body.materialVersion : null;
    return { ok: true, value: { articleRef, storyId: body.storyId as StoryId, materialVersion } };
  } catch {
    return { ok: false, reason: 'FAILED' };
  }
}

/**
 * ASK RELIABILITY R1 (§9) — the signed-in reader's explicit Read Brief on a retained article that is
 * not yet in a canonical story: the server places it (same identity rules as Discussion) and returns
 * its storyId. Never called for guests, never from Discuss.
 */
export async function ensureStoryForArticle(articleRef: string, url: string): Promise<BriefResult<CanonicalStoryIdentity>> {
  if (!ARTICLE_REF.test(articleRef)) return { ok: false, reason: 'INVALID' };
  try {
    const response = await accountFetch(`${RESOLVE_PATH(articleRef)}/ensure`, { method: 'POST', body: { url } });
    if (response.status === 404) return { ok: false, reason: 'NO_STORY' };
    if (response.status === 401 || response.status === 403) return { ok: false, reason: 'NO_STORY' };
    if (response.status === 429) return { ok: false, reason: 'RATE_LIMITED' };
    if (!response.ok) return { ok: false, reason: 'FAILED' };
    const body = (await response.json()) as { storyId?: unknown; materialVersion?: unknown } | null;
    if (body === null || typeof body.storyId !== 'string' || !UUID.test(body.storyId)) return { ok: false, reason: 'FAILED' };
    return {
      ok: true,
      value: { articleRef, storyId: body.storyId as StoryId, materialVersion: typeof body.materialVersion === 'number' ? body.materialVersion : null },
    };
  } catch {
    return { ok: false, reason: 'FAILED' };
  }
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
