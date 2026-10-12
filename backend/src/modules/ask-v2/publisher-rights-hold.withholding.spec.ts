import {
  priorWorkRightsClearedWith,
  withheldForPublisherRightsHold,
  withheldForSourceRights,
  WITHHELD_BASIS,
} from './source-rights-withholding';
import { briefingSnapshotOf } from './briefings/briefing-snapshot';

/**
 * MASTER CTO R4 · P0 #86 — stored answers (reopen, briefing snapshot, prior-work rework) that rest on
 * a held publisher host are withheld at read time by the SAME rule; nothing stored is rewritten.
 * Pure; synthetic payloads only.
 */
const article = (id: string, url: string, sourceId: string) => ({ id, url, sourceId, title: 'Synthetic', summary: 'Synthetic.' });
const payload = (articles: Array<ReturnType<typeof article>>, recent: Array<{ url: string; sourceId: string }> = []) => ({
  schema: 'ask-r2-result/1',
  checkedAt: '2026-10-12T00:00:00.000Z',
  answer: { state: 'CURRENT_REPORTING', basis: 'SOURCED' },
  analysis: {
    articles,
    analysis: { summary: 'A synthetic summary.', sources: articles.map((a) => ({ articleId: a.id })), keyFacts: [], unknowns: [] },
  },
  background: null,
  recentReporting: { items: recent },
});

describe('#86 · stored-answer reopen', () => {
  it('an answer citing a held-host article is withheld (WITHHELD_SOURCE_RIGHTS); the stored object is not mutated', () => {
    const p = payload([article('r', 'https://www.reuters.com/world/x', 'reuters'), article('b', 'https://www.bbc.com/n', 'bbc')]);
    const before = JSON.stringify(p);
    const out = withheldForSourceRights(p) as Record<string, unknown>;
    expect((out.answer as { basis: string }).basis).toBe(WITHHELD_BASIS);
    expect(out.analysis).toBeNull();
    expect(out.withheld).toEqual({ reason: 'SOURCE_RIGHTS', count: 1 });
    expect(JSON.stringify(p)).toBe(before);
  });

  it('control: an answer citing only unheld reports (incl. a syndication host) is returned unchanged', () => {
    const p = payload([article('b', 'https://www.bbc.com/n', 'bbc'), article('s', 'https://www.straitstimes.com/w', 'the-straits-times')]);
    expect(withheldForSourceRights(p)).toBe(p);
  });

  it('the recent-reporting metadata list drops held-host items only', () => {
    const p = payload([article('b', 'https://www.bbc.com/n', 'bbc')], [
      { url: 'https://www.reuters.com/world/y', sourceId: 'reuters' },
      { url: 'https://apnews.com/article/z', sourceId: 'ap' },
    ]);
    const out = withheldForSourceRights(p) as { recentReporting: { items: Array<{ url: string }> } };
    expect(out.recentReporting.items.map((i) => i.url)).toEqual(['https://apnews.com/article/z']);
  });
});

describe('#86 · briefing snapshot and prior-work rework', () => {
  it('a briefing is never snapshotted from an answer resting on a held host (snapshot null → not saveable)', () => {
    const held = payload([article('r', 'https://www.reuters.com/world/x', 'reuters')]);
    expect(briefingSnapshotOf(held)).not.toBeNull(); /* non-vacuous: the raw payload WOULD snapshot */
    expect(briefingSnapshotOf(withheldForPublisherRightsHold(held))).toBeNull();
    const ok = payload([article('b', 'https://www.bbc.com/n', 'bbc')]);
    expect(briefingSnapshotOf(withheldForPublisherRightsHold(ok))).not.toBeNull();
  });

  it('the briefing guard is source-specific: another rights class (here unknown provenance) is NOT newly withheld by #86', () => {
    const other = payload([article('u', 'https://www.bbc.com/n', 'Bad Id')]);
    expect(withheldForPublisherRightsHold(other)).toBe(other);
    /* (the reopen path still withholds it, as before — unchanged) */
    expect((withheldForSourceRights(other) as { answer: { basis: string } }).answer.basis).toBe(WITHHELD_BASIS);
  });

  it('prior work whose evidence resolves to a held-host article does not reach the model again', async () => {
    const find = async (id: string) =>
      id === 'r' ? { sourceId: 'reuters', url: 'https://www.reuters.com/world/x' } : { sourceId: 'bbc', url: 'https://www.bbc.com/n' };
    expect(await priorWorkRightsClearedWith({ provenance: 'SOURCED_REPORTING', evidenceRefs: ['r', 'b'] }, find, 8)).toBe(false);
    expect(await priorWorkRightsClearedWith({ provenance: 'SOURCED_REPORTING', evidenceRefs: ['b'] }, find, 8)).toBe(true);
  });
});
