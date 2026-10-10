import { FEED_SOURCES, type FeedSourceEntry } from '../providers/feed-source-registry';
import { partitionByRights, sourceUseDecision, summarizeExclusions } from './source-use-policy';

/*
  MASTER CTO P0 RIGHTS CONTAINMENT R1 — the use policy, against the REAL governed registry rows
  (the feeds whose stored rows were measured on Alpha 2026-10-10: Standard 28, WP 15, Taarifa 59).
*/
describe('sourceUseDecision — governed RSS rows', () => {
  it.each([
    ['feed:standardmedia-ke', 'RIGHTS_RESTRICTED'],
    ['feed:wp-pl', 'RIGHTS_PROHIBITED'],
  ])('%s is never used: not as AI input, not even as metadata', (id, reason) => {
    expect(sourceUseDecision(id, 'AI_INPUT')).toEqual({ allowed: false, reason });
    expect(sourceUseDecision(id, 'METADATA')).toEqual({ allowed: false, reason });
  });

  it.each(['feed:taarifa-rw', 'feed:ktpress-rw', 'feed:cbk-ke', 'feed:gus-pl'])(
    '%s (below CLEARED): metadata only — never AI input',
    (id) => {
      expect(sourceUseDecision(id, 'AI_INPUT')).toEqual({ allowed: false, reason: 'RIGHTS_NOT_CLEARED_FOR_AI' });
      expect(sourceUseDecision(id, 'METADATA')).toEqual({ allowed: true, basis: 'FEED_METADATA_ONLY' });
    },
  );

  it('the policy reads the registry, not a copy: every registry row is decided by its own state', () => {
    for (const row of FEED_SOURCES) {
      const ai = sourceUseDecision(row.sourceId, 'AI_INPUT');
      expect(ai.allowed).toBe(row.rights.state === 'CLEARED');
    }
  });

  it('a CLEARED row is usable for both (synthetic registry; no live row is CLEARED today)', () => {
    const cleared = { ...FEED_SOURCES[0], sourceId: 'feed:cleared-test', rights: { state: 'CLEARED', evidence: 'test' } } as FeedSourceEntry;
    expect(sourceUseDecision('feed:cleared-test', 'AI_INPUT', [cleared])).toEqual({ allowed: true, basis: 'FEED_CLEARED' });
  });
});

describe('sourceUseDecision — provenance', () => {
  it.each(['feed:unknown-feed', 'feed:'])('%s (a feed the registry does not know) is unknown provenance', (id) => {
    expect(sourceUseDecision(id, 'AI_INPUT')).toEqual({ allowed: false, reason: 'UNKNOWN_PROVENANCE' });
    expect(sourceUseDecision(id, 'METADATA')).toEqual({ allowed: false, reason: 'UNKNOWN_PROVENANCE' });
  });

  it.each([undefined, null, '', '   '])('an empty source id (%p) is unknown provenance', (id) => {
    expect(sourceUseDecision(id as never, 'AI_INPUT')).toEqual({ allowed: false, reason: 'UNKNOWN_PROVENANCE' });
  });

  it.each(['bbc:abc', 'reuters:xyz', 'the-star-co-ke:1'])('%s (stored from a live provider response) keeps the provider path', (id) => {
    expect(sourceUseDecision(id, 'AI_INPUT')).toEqual({ allowed: true, basis: 'PROVIDER_PATH' });
  });
});

describe('partitionByRights / summarizeExclusions', () => {
  it('a mixed set keeps provider items and records each exclusion with its reason', () => {
    const items = [
      { sourceId: 'bbc:1' },
      { sourceId: 'feed:taarifa-rw' },
      { sourceId: 'feed:standardmedia-ke' },
      { sourceId: 'feed:wp-pl' },
      { sourceId: '' },
    ];
    const { allowed, excluded } = partitionByRights(items, 'AI_INPUT');
    expect(allowed).toEqual([{ sourceId: 'bbc:1' }]);
    expect(summarizeExclusions(excluded)).toEqual({
      count: 4,
      reasons: { RIGHTS_NOT_CLEARED_FOR_AI: 1, RIGHTS_RESTRICTED: 1, RIGHTS_PROHIBITED: 1, UNKNOWN_PROVENANCE: 1 },
      sourceIds: ['<none>', 'feed:standardmedia-ke', 'feed:taarifa-rw', 'feed:wp-pl'],
    });
  });

  it('nothing excluded → no summary at all', () => {
    expect(summarizeExclusions(partitionByRights([{ sourceId: 'bbc:1' }], 'AI_INPUT').excluded)).toBeUndefined();
  });
});
