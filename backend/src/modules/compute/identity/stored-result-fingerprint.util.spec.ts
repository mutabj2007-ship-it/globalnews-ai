import type { StoredResultIdentity } from '@globalnews-ai/shared';
import {
  buildOperationIdempotencyIdentity,
  buildStoredResultCanonicalString,
  buildStoredResultFingerprint,
} from './stored-result-fingerprint.util';

function identity(overrides: Partial<StoredResultIdentity> = {}): StoredResultIdentity {
  return {
    kind: 'ask-turn',
    normalizedTask: 'what is happening in rwanda',
    language: 'en',
    evidenceRevision: 'rev-1',
    ...overrides,
  };
}

describe('BETA-SIMPLE-ASK-SAND-1 §6 stored-result fingerprint', () => {
  it('is deterministic', () => {
    expect(buildStoredResultFingerprint(identity())).toBe(
      buildStoredResultFingerprint(identity()),
    );
  });

  it('is a fixed-width sha256 hex string, whatever the task length', () => {
    const short = buildStoredResultFingerprint(identity({ normalizedTask: 'hi' }));
    const long = buildStoredResultFingerprint(identity({ normalizedTask: 'x'.repeat(1000) }));

    expect(short).toMatch(/^[0-9a-f]{64}$/);
    expect(long).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never embeds the verbatim question text in the key', () => {
    const fingerprint = buildStoredResultFingerprint(
      identity({ normalizedTask: 'a very distinctive secret question' }),
    );
    expect(fingerprint).not.toContain('distinctive');
    expect(fingerprint).not.toContain('secret');
  });

  describe('every §6 dimension participates in identity', () => {
    const base = identity({
      subjectId: 'story-1',
      countryCode: 'RW',
      timeWindow: '7d',
      analysisType: 'energy',
      modelContract: 'gpt-x@v1',
    });
    const baseFingerprint = buildStoredResultFingerprint(base);

    it.each<[string, Partial<StoredResultIdentity>]>([
      ['normalizedTask', { normalizedTask: 'something else entirely' }],
      ['kind', { kind: 'deep-analysis' }],
      ['subjectId', { subjectId: 'story-2' }],
      ['countryCode', { countryCode: 'UG' }],
      ['language', { language: 'pl' }],
      ['evidenceRevision', { evidenceRevision: 'rev-2' }],
      ['timeWindow', { timeWindow: '30d' }],
      ['analysisType', { analysisType: 'security' }],
      ['modelContract', { modelContract: 'gpt-x@v2' }],
    ])('changing %s changes the fingerprint', (_dimension, override) => {
      expect(buildStoredResultFingerprint({ ...base, ...override })).not.toBe(baseFingerprint);
    });
  });

  describe('§6 evidence revision is what stops a stale answer being served forever', () => {
    it('produces a different identity once the evidence corpus has moved on', () => {
      const before = buildStoredResultFingerprint(identity({ evidenceRevision: 'rev-1' }));
      const after = buildStoredResultFingerprint(identity({ evidenceRevision: 'rev-2' }));
      expect(before).not.toBe(after);
    });
  });

  describe('absent dimensions are explicit, so they cannot collide', () => {
    it('does not confuse a set countryCode with a set subjectId of the same value', () => {
      const asCountry = buildStoredResultFingerprint(identity({ countryCode: 'RW' }));
      const asSubject = buildStoredResultFingerprint(identity({ subjectId: 'RW' }));
      expect(asCountry).not.toBe(asSubject);
    });

    it('treats undefined, empty string and whitespace as the same absence', () => {
      const undef = buildStoredResultFingerprint(identity({ countryCode: undefined }));
      const empty = buildStoredResultFingerprint(identity({ countryCode: '' }));
      const blank = buildStoredResultFingerprint(identity({ countryCode: '   ' }));
      expect(empty).toBe(undef);
      expect(blank).toBe(undef);
    });

    it('distinguishes an absent optional field from a present one', () => {
      expect(buildStoredResultFingerprint(identity({ timeWindow: '7d' }))).not.toBe(
        buildStoredResultFingerprint(identity({ timeWindow: undefined })),
      );
    });
  });

  describe('normalization agrees with the existing AnalysisService cache key', () => {
    it('is case-insensitive for the task text, as the existing key is', () => {
      expect(buildStoredResultFingerprint(identity({ normalizedTask: 'Rwanda Energy' }))).toBe(
        buildStoredResultFingerprint(identity({ normalizedTask: 'rwanda energy' })),
      );
    });

    it('is case-insensitive for geography, so RW and rw are one identity', () => {
      expect(buildStoredResultFingerprint(identity({ countryCode: 'RW' }))).toBe(
        buildStoredResultFingerprint(identity({ countryCode: 'rw' })),
      );
    });

    it('ignores surrounding whitespace', () => {
      expect(buildStoredResultFingerprint(identity({ normalizedTask: '  rwanda  ' }))).toBe(
        buildStoredResultFingerprint(identity({ normalizedTask: 'rwanda' })),
      );
    });
  });

  describe('buildStoredResultCanonicalString', () => {
    it('renders exactly nine ordered dimensions', () => {
      const canonical = buildStoredResultCanonicalString(identity());
      expect(canonical.split('\u001f')).toHaveLength(9);
    });

    it('hashes to the fingerprint for the same identity', () => {
      const a = identity({ countryCode: 'RW' });
      const b = identity({ countryCode: 'RW' });
      expect(buildStoredResultCanonicalString(a)).toBe(buildStoredResultCanonicalString(b));
      expect(buildStoredResultFingerprint(a)).toBe(buildStoredResultFingerprint(b));
    });
  });
});

describe('BETA-SIMPLE-ASK-SAND-1 §12 operation idempotency identity', () => {
  const base = { ownerKey: 'user-1', clientKey: 'submission-abc', kind: 'ask-turn' };

  it('is deterministic for the same submission', () => {
    expect(buildOperationIdempotencyIdentity(base)).toBe(buildOperationIdempotencyIdentity(base));
  });

  it('separates two different callers submitting the same client key', () => {
    expect(buildOperationIdempotencyIdentity(base)).not.toBe(
      buildOperationIdempotencyIdentity({ ...base, ownerKey: 'user-2' }),
    );
  });

  it('separates two different submissions from the same caller', () => {
    expect(buildOperationIdempotencyIdentity(base)).not.toBe(
      buildOperationIdempotencyIdentity({ ...base, clientKey: 'submission-xyz' }),
    );
  });

  it('separates two kinds of operation under one client key', () => {
    expect(buildOperationIdempotencyIdentity(base)).not.toBe(
      buildOperationIdempotencyIdentity({ ...base, kind: 'deep-analysis' }),
    );
  });

  it('is a different identity space from the stored-result fingerprint', () => {
    // Two users asking the same question SHARE a stored result but must
    // never share one metered operation row.
    const sharedResult = buildStoredResultFingerprint(identity());
    expect(buildOperationIdempotencyIdentity(base)).not.toBe(sharedResult);
  });
});
