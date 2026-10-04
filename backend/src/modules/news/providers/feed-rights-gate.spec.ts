import type { ConfigService } from '@nestjs/config';
import {
  FEED_SOURCES,
  feedActivationRefusal,
  resolveActiveFeedSources,
  type FeedSourceEntry,
} from './feed-source-registry';
import { RssFeedProvider } from './rss-feed.provider';
import { EvidenceDiscoveryService } from '../evidence/evidence-discovery.service';

/**
 * T1 — PROVIDER-RIGHTS-ACTIVATION-GATE-1: recorded rights decide whether a feed
 * MAY run; the RSS_FEED_SOURCES allowlist only decides whether it is asked to.
 */
describe('T1 · feed rights are recorded per entry, from the governed packs', () => {
  const state = (id: string) => FEED_SOURCES.find((f) => f.sourceId === id)?.rights.state;

  it('records the pack evidence verbatim — nothing is CLEARED', () => {
    expect(state('feed:standardmedia-ke')).toBe('RESTRICTED');
    expect(state('feed:ktpress-rw')).toBe('UNRESOLVED');
    expect(state('feed:taarifa-rw')).toBe('LIMITED_SCOPE_REVIEW');
    expect(state('feed:cbk-ke')).toBe('UNRESOLVED');
    expect(state('feed:gus-pl')).toBe('UNREVIEWED');
    expect(state('feed:wp-pl')).toBe('PROHIBITED');
    expect(FEED_SOURCES.some((f) => f.rights.state === 'CLEARED')).toBe(false);
  });
});

describe('T1 · the gate', () => {
  it('refuses RESTRICTED/PROHIBITED feeds named in the allowlist, with reason and evidence', () => {
    const selection = resolveActiveFeedSources(FEED_SOURCES, 'feed:standardmedia-ke,feed:ktpress-rw');
    expect(selection.sources.map((s) => s.sourceId)).toEqual(['feed:ktpress-rw']);
    expect(selection.refused).toEqual([
      {
        sourceId: 'feed:standardmedia-ke',
        reason: 'RIGHTS_RESTRICTED',
        rightsState: 'RESTRICTED',
        evidence: expect.stringContaining('KEN.json'),
      },
    ]);
    expect(selection.rightsUnresolved).toEqual([{ sourceId: 'feed:ktpress-rw', rightsState: 'UNRESOLVED' }]);
  });

  it('also refuses a restricted feed that ships enabled:true (no override path)', () => {
    const shipped: FeedSourceEntry[] = FEED_SOURCES.map((f) =>
      f.sourceId === 'feed:standardmedia-ke' ? { ...f, enabled: true } : f,
    );
    const selection = resolveActiveFeedSources(shipped, undefined);
    expect(selection.sources).toEqual([]);
    expect(selection.refused.map((r) => r.sourceId)).toEqual(['feed:standardmedia-ke']);
  });

  it('feedActivationRefusal is null for unresolved-but-not-restricted feeds', () => {
    const taarifa = FEED_SOURCES.find((f) => f.sourceId === 'feed:taarifa-rw')!;
    expect(feedActivationRefusal(taarifa)).toBeNull();
  });

  it('governed local fan-out never sees a refused feed', () => {
    const discovery = new EvidenceDiscoveryService(
      [],
      { get: (k: string) => (k === 'RSS_FEED_SOURCES' ? 'feed:standardmedia-ke' : undefined) } as never,
    );
    expect(discovery.hasGovernedLocalFeeds(['KE'])).toBe(false);
  });
});

describe('T1 · health records the refusal and the unresolved rights', () => {
  const provider = (sources: string) =>
    new RssFeedProvider({
      get: (key: string) =>
        key === 'RSS_FEEDS_ENABLED' ? 'true' : key === 'RSS_FEED_SOURCES' ? sources : undefined,
    } as unknown as ConfigService);

  it('lists refused and rights-unresolved feeds in message and structured field', async () => {
    const health = await provider('feed:standardmedia-ke,feed:wp-pl,feed:taarifa-rw').health();
    expect(health.message).toContain('Refused by rights gate: feed:standardmedia-ke (RIGHTS_RESTRICTED), feed:wp-pl (RIGHTS_PROHIBITED)');
    expect(health.message).toContain('Active without cleared rights: feed:taarifa-rw (LIMITED_SCOPE_REVIEW)');
    expect(health.sourceRights).toEqual({
      refused: [
        { sourceId: 'feed:standardmedia-ke', reason: 'RIGHTS_RESTRICTED', rightsState: 'RESTRICTED' },
        { sourceId: 'feed:wp-pl', reason: 'RIGHTS_PROHIBITED', rightsState: 'PROHIBITED' },
      ],
      rightsUnresolved: [{ sourceId: 'feed:taarifa-rw', rightsState: 'LIMITED_SCOPE_REVIEW' }],
    });
  });

  it('when every named feed is refused, health says so instead of "no id matches"', async () => {
    const health = await provider('feed:standardmedia-ke').health();
    expect(health.message).toContain('refused by the rights gate');
    expect(health.message).not.toContain('named no id that matches');
  });

  it('a refused feed is never fetched', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('down'));
    try {
      await provider('feed:standardmedia-ke,feed:wp-pl').topHeadlines();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
