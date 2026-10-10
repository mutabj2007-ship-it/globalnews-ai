import { FEED_SOURCES, type FeedSourceEntry } from '../providers/feed-source-registry';
import { INTERNATIONAL_NEWS_SOURCES } from '../../global-reach/source-coverage.authority';
import {
  partitionByRights,
  providerEnforcementFromEnv,
  sourceUseDecision,
  summarizeExclusions,
  summarizePending,
} from './source-use-policy';

/*
  MASTER CTO P0 RIGHTS CONTAINMENT R1.1 — the use policy against the REAL governed registries:
  the feed registry (Standard 28, WP 15, Taarifa 59 stored rows measured on Alpha 2026-10-10) and
  the recorded aggregator rights (GNews RIGHTS_UNDER_E1_REVIEW, GDELT UNRESOLVED).
*/
const RECORD = { enforcement: 'record' as const };
const ENFORCE = { enforcement: 'enforce' as const };

describe('RSS rows — decided by the feed registry', () => {
  it.each([
    ['feed:standardmedia-ke', 'RIGHTS_RESTRICTED'],
    ['feed:wp-pl', 'RIGHTS_PROHIBITED'],
  ])('%s: never used, not even as metadata', (sourceId, reason) => {
    for (const use of ['AI_INPUT', 'METADATA'] as const) {
      expect(sourceUseDecision({ sourceId }, use, RECORD)).toEqual({ allowed: false, reason });
    }
  });

  it('Taarifa (LIMITED_SCOPE_REVIEW, recorded grant: links + short excerpts) → metadata only', () => {
    expect(sourceUseDecision({ sourceId: 'feed:taarifa-rw' }, 'AI_INPUT', RECORD)).toEqual({ allowed: false, reason: 'RIGHTS_NOT_CLEARED_FOR_AI' });
    expect(sourceUseDecision({ sourceId: 'feed:taarifa-rw' }, 'METADATA', RECORD)).toEqual({ allowed: true, basis: 'FEED_METADATA_ONLY' });
  });

  it.each(['feed:ktpress-rw', 'feed:cbk-ke', 'feed:gus-pl'])(
    '%s (UNRESOLVED / UNREVIEWED: no recorded grant) → neither use',
    (sourceId) => {
      for (const use of ['AI_INPUT', 'METADATA'] as const) {
        expect(sourceUseDecision({ sourceId }, use, RECORD)).toEqual({ allowed: false, reason: 'RIGHTS_NOT_CLEARED_FOR_AI' });
      }
    },
  );

  it('every registry row is decided by its own state (AI input only when CLEARED)', () => {
    for (const row of FEED_SOURCES) {
      expect(sourceUseDecision({ sourceId: row.sourceId }, 'AI_INPUT', RECORD).allowed).toBe(row.rights.state === 'CLEARED');
    }
  });

  it('a CLEARED row is usable for both (synthetic; no live row is CLEARED today)', () => {
    const feeds = [{ ...FEED_SOURCES[0], sourceId: 'feed:cleared-test', rights: { state: 'CLEARED', evidence: 't' } } as FeedSourceEntry];
    expect(sourceUseDecision({ sourceId: 'feed:cleared-test' }, 'AI_INPUT', { ...RECORD, feeds })).toEqual({ allowed: true, basis: 'FEED_CLEARED' });
  });
});

describe('provenance fails closed', () => {
  it.each([
    ['feed:unknown-feed'],
    ['feed:'],
    [''],
    ['   '],
    ['Reuters'],
    ['bbc:p1'],
    ['bbc news'],
    ['../etc'],
    ['-bbc'],
  ])('sourceId %p is unknown provenance in every mode and use', (sourceId) => {
    for (const options of [RECORD, ENFORCE]) {
      for (const use of ['AI_INPUT', 'METADATA'] as const) {
        expect(sourceUseDecision({ sourceId, providerId: 'gnews' }, use, options)).toEqual({ allowed: false, reason: 'UNKNOWN_PROVENANCE' });
      }
    }
  });

  it.each([undefined, null])('a missing sourceId (%p) is unknown provenance', (sourceId) => {
    expect(sourceUseDecision({ sourceId: sourceId as never }, 'AI_INPUT', RECORD)).toEqual({ allowed: false, reason: 'UNKNOWN_PROVENANCE' });
  });

  it('a providerId the provider record does not know is unknown provenance', () => {
    expect(sourceUseDecision({ sourceId: 'bbc', providerId: 'some-scraper' }, 'AI_INPUT', RECORD)).toEqual({ allowed: false, reason: 'UNKNOWN_PROVENANCE' });
  });
});

describe('aggregator items — decided by the provider that acquired them', () => {
  it('the recorded provider rights are NOT cleared today (the policy reads them, never assumes)', () => {
    expect(INTERNATIONAL_NEWS_SOURCES.map((p) => [p.sourceId, p.rightsState])).toEqual([
      ['gnews', 'RIGHTS_UNDER_E1_REVIEW'],
      ['gdelt-doc', 'UNRESOLVED'],
    ]);
  });

  it.each(['gnews', 'gdelt-doc'])('record mode: a %s item is allowed PENDING REVIEW — never "cleared"', (providerId) => {
    expect(sourceUseDecision({ sourceId: 'reuters', providerId }, 'AI_INPUT', RECORD)).toEqual({ allowed: true, basis: 'PROVIDER_PENDING_REVIEW', provider: providerId });
  });

  it.each(['gnews', 'gdelt-doc'])('enforce mode: a %s item is excluded until its provider is CLEARED', (providerId) => {
    expect(sourceUseDecision({ sourceId: 'reuters', providerId }, 'AI_INPUT', ENFORCE)).toEqual({ allowed: false, reason: 'PROVIDER_RIGHTS_NOT_CLEARED' });
  });

  it('a stored provider row (no providerId persisted) has unverified acquisition: pending in record mode, excluded in enforce mode', () => {
    expect(sourceUseDecision({ sourceId: 'bbc' }, 'AI_INPUT', RECORD)).toEqual({ allowed: true, basis: 'PROVIDER_PENDING_REVIEW', provider: 'stored-provider-unverified' });
    expect(sourceUseDecision({ sourceId: 'bbc' }, 'AI_INPUT', ENFORCE)).toEqual({ allowed: false, reason: 'UNKNOWN_PROVENANCE' });
  });

  it('a provider recorded CLEARED is cleared in both modes (synthetic record)', () => {
    const providers = [{ sourceId: 'gnews', rightsState: 'CLEARED' }];
    for (const options of [RECORD, ENFORCE]) {
      expect(sourceUseDecision({ sourceId: 'bbc', providerId: 'gnews' }, 'AI_INPUT', { ...options, providers })).toEqual({ allowed: true, basis: 'PROVIDER_CLEARED', provider: 'gnews' });
    }
  });

  it('the enforcement mode comes only from ASK_PROVIDER_RIGHTS_ENFORCEMENT=enforce; anything else records', () => {
    expect(providerEnforcementFromEnv({ ASK_PROVIDER_RIGHTS_ENFORCEMENT: 'enforce' })).toBe('enforce');
    expect(providerEnforcementFromEnv({ ASK_PROVIDER_RIGHTS_ENFORCEMENT: ' ENFORCE ' })).toBe('enforce');
    expect(providerEnforcementFromEnv({})).toBe('record');
    expect(providerEnforcementFromEnv({ ASK_PROVIDER_RIGHTS_ENFORCEMENT: 'off' })).toBe('record');
  });
});

describe('partitionByRights / summaries', () => {
  it('a mixed set: provider kept pending, RSS and malformed excluded with reasons', () => {
    const items = [
      { sourceId: 'bbc', providerId: 'gnews' },
      { sourceId: 'feed:taarifa-rw' },
      { sourceId: 'feed:standardmedia-ke' },
      { sourceId: 'feed:wp-pl' },
      { sourceId: '' },
    ];
    const { allowed, excluded, pending } = partitionByRights(items, 'AI_INPUT', RECORD);
    expect(allowed).toEqual([{ sourceId: 'bbc', providerId: 'gnews' }]);
    expect(summarizeExclusions(excluded)).toEqual({
      count: 4,
      reasons: { RIGHTS_NOT_CLEARED_FOR_AI: 1, RIGHTS_RESTRICTED: 1, RIGHTS_PROHIBITED: 1, UNKNOWN_PROVENANCE: 1 },
      sourceIds: ['<none>', 'feed:standardmedia-ke', 'feed:taarifa-rw', 'feed:wp-pl'],
    });
    expect(summarizePending(pending)).toEqual({ count: 1, providers: { gnews: 1 } });
  });

  it('nothing excluded or pending → no summaries', () => {
    const cleared = [{ sourceId: 'gnews', rightsState: 'CLEARED' }];
    const r = partitionByRights([{ sourceId: 'bbc', providerId: 'gnews' }], 'AI_INPUT', { ...RECORD, providers: cleared });
    expect(summarizeExclusions(r.excluded)).toBeUndefined();
    expect(summarizePending(r.pending)).toBeUndefined();
  });
});
