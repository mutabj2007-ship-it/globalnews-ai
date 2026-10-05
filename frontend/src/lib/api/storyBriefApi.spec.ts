/**
 * COMPACT VISUAL PRODUCT R1 — the Story Brief adapter against the REAL R1 contract
 * (EA-STORY-BRIEF-01). Fixtures live ONLY in this spec (S-7).
 */
jest.mock('@/lib/api/accountFetch', () => ({ accountFetch: jest.fn() }));
jest.mock('@/lib/stories/stageBApi', () => ({ fetchThread: jest.fn() }));

import { accountFetch } from '@/lib/api/accountFetch';
import { fetchThread } from '@/lib/stories/stageBApi';
import { parseStoryBriefView, readStoryBrief, requestStoryBrief, resolveStoryId, storyBriefRunsInFlightForTests } from './storyBriefApi';
import type { StoryId } from '@/lib/storyBrief/storyBriefView';

const fetchMock = accountFetch as jest.MockedFunction<typeof accountFetch>;
const threadMock = fetchThread as jest.MockedFunction<typeof fetchThread>;
const STORY = '2f1c6a8e-1b3d-4c5e-9f00-112233445566' as StoryId;
const REF = 'a'.repeat(64);

const version = (over: Record<string, unknown> = {}) => ({
  version: 2,
  state: 'READY',
  evidenceRevision: 'rev-old',
  materialVersion: 3,
  blocks: {
    schema: 'briefing-blocks/1',
    summary: 'Sourced summary.',
    keyFacts: [{ claim: 'Fact one.', sourceArticleIds: ['x1', 'x2'] }, { claim: '', sourceArticleIds: [] }],
    background: { text: 'Model background.', citable: false },
  },
  evidenceRefs: [{ id: 'x1', host: 'a.example', url: 'https://a.example/1', title: 'T1', publisher: 'Outlet A', publishedAt: null }, { bad: true }],
  coverageGaps: ['Local radio not checked'],
  uncertainty: ['Casualty figure unconfirmed'],
  asOf: '2026-10-05T10:00:00.000Z',
  generatedAt: '2026-10-05T10:00:01.000Z',
  ...over,
});
const server = (over: Record<string, unknown> = {}) => ({
  storyId: STORY,
  state: 'NOT_GENERATED',
  currentEvidenceRevision: 'rev-now',
  brief: null,
  versions: 0,
  changedSince: null,
  lastAttempt: null,
  generationAvailable: false,
  ...over,
});
const response = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

beforeEach(() => {
  fetchMock.mockReset();
  threadMock.mockReset();
});

describe('server → presentation state mapping (strict)', () => {
  it('NOT_GENERATED → NONE, carrying generationAvailable', () => {
    expect(parseStoryBriefView(server())).toMatchObject({ state: 'NONE', generationAvailable: false, storyId: STORY });
  });
  it('READY / PARTIAL / INSUFFICIENT keep the stored version verbatim, dropping malformed parts', () => {
    for (const state of ['READY', 'PARTIAL', 'INSUFFICIENT'] as const) {
      const view = parseStoryBriefView(server({ state, brief: version({ state }), versions: 2 }));
      expect(view?.state).toBe(state);
      if (view === null || !('brief' in view)) throw new Error('no brief');
      expect(view.brief.summary).toBe('Sourced summary.');
      expect(view.brief.keyFacts).toEqual([{ claim: 'Fact one.', sourceArticleIds: ['x1', 'x2'] }]);
      expect(view.brief.evidence).toHaveLength(1);
      expect(view.brief.background).toBe('Model background.');
    }
  });
  it('a concluded state without a valid stored version is not guessed (null → FAILED surface)', () => {
    expect(parseStoryBriefView(server({ state: 'READY', brief: null }))).toBeNull();
    expect(parseStoryBriefView(server({ state: 'READY', brief: version({ version: 0 }) }))).toBeNull();
  });
  it('STALE keeps the old version inspectable and carries NO count', () => {
    const view = parseStoryBriefView(server({ state: 'STALE', brief: version(), changedSince: { fromRevision: 'rev-old', toRevision: 'rev-now', basis: 'EVIDENCE_SET_CHANGED' } }));
    expect(view).toMatchObject({ state: 'STALE', lastAttemptFailure: null });
    expect(JSON.stringify(view)).not.toMatch(/count/i);
  });
  it('STALE with a failed refresh keeps the stale Brief and names the failure', () => {
    const view = parseStoryBriefView(
      server({ state: 'STALE', brief: version(), lastAttempt: { status: 'FAILED', failureKind: 'PROVIDER_DEGRADED', failureCode: 'x', startedAt: 'a', finishedAt: 'b' } }),
    );
    expect(view).toMatchObject({ state: 'STALE', lastAttemptFailure: 'PROVIDER_DEGRADED' });
  });
  it('CHECKING carries no stage and no percentage; the latest version stays inspectable', () => {
    const view = parseStoryBriefView(server({ state: 'CHECKING', brief: version() }));
    expect(view?.state).toBe('CHECKING');
    expect(JSON.stringify(view)).not.toMatch(/stage|percent|progress/i);
  });
  it('FAILED is its own state with the server failure kind — never INSUFFICIENT, never a stored Brief', () => {
    const view = parseStoryBriefView(server({ state: 'FAILED', lastAttempt: { status: 'FAILED', failureKind: 'BUDGET_REFUSED', failureCode: 'b', startedAt: 'a', finishedAt: 'b' } }));
    expect(view).toMatchObject({ state: 'FAILED', failureKind: 'BUDGET_REFUSED' });
    expect(view && 'brief' in view).toBe(false);
  });
  it('an unknown state or shape is never mapped to a guess', () => {
    expect(parseStoryBriefView(server({ state: 'SOMETHING_NEW' }))).toBeNull();
    expect(parseStoryBriefView({ state: 'READY' })).toBeNull();
    expect(parseStoryBriefView('nope')).toBeNull();
  });
});

describe('identity: articleRef → canonical story, read-only', () => {
  it('without discussion.read the page cannot resolve the id and makes NO request', async () => {
    await expect(resolveStoryId(REF, { discussionRead: false })).resolves.toEqual({ ok: false, reason: 'UNRESOLVED' });
    expect(threadMock).not.toHaveBeenCalled();
  });
  it('resolves through the public thread read; an unclustered article is NO_STORY', async () => {
    threadMock.mockResolvedValueOnce({ ok: true, value: { articleRef: REF, storyId: STORY, briefVersion: 1, locked: false, count: 0, comments: [] } });
    await expect(resolveStoryId(REF, { discussionRead: true })).resolves.toEqual({ ok: true, value: STORY });
    threadMock.mockResolvedValueOnce({ ok: true, value: { articleRef: REF, storyId: null, briefVersion: null, locked: false, count: 0, comments: [] } });
    await expect(resolveStoryId(REF, { discussionRead: true })).resolves.toEqual({ ok: false, reason: 'NO_STORY' });
  });
});

describe('the read is a GET and the run is the only POST', () => {
  it('reading uses GET only (zero compute) on the canonical id', async () => {
    fetchMock.mockResolvedValueOnce(response(200, server()));
    await readStoryBrief(STORY);
    expect(fetchMock).toHaveBeenCalledWith(`/stories/${STORY}/brief`, {});
  });
  it('the gate OFF (bare 404) is OFF; a missing story (404 STORY) is NO_STORY', async () => {
    fetchMock.mockResolvedValueOnce(response(404, { message: 'Not Found' }));
    await expect(readStoryBrief(STORY)).resolves.toEqual({ ok: false, reason: 'OFF' });
    fetchMock.mockResolvedValueOnce(response(404, { message: 'STORY' }));
    await expect(readStoryBrief(STORY)).resolves.toEqual({ ok: false, reason: 'NO_STORY' });
  });
  it('concurrent explicit runs for one story share ONE request', async () => {
    let release: (r: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (release = resolve)));
    const a = requestStoryBrief(STORY, 'READ_BRIEF');
    const b = requestStoryBrief(STORY, 'STALE_REFRESH');
    expect(storyBriefRunsInFlightForTests()).toBe(1);
    release(response(200, server({ state: 'CHECKING' })));
    await Promise.all([a, b]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`/stories/${STORY}/brief`, { method: 'POST', body: {} });
    expect(storyBriefRunsInFlightForTests()).toBe(0);
  });
});
