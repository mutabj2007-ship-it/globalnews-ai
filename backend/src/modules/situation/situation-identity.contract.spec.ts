import type { SituationObservation } from './situation.contract';
import {
  InvalidSituationIdentityError,
  MAX_DISCRIMINATOR_LENGTH,
  MAX_PARTITION_KEY_LENGTH,
  type SituationAnchor,
} from './situation-identity.port';
import {
  IDENTITY_SERIALIZATION_VERSION,
  SITUATION_CONTINUITY_CANDIDATE,
  SITUATION_IDENTITY_CONTRACT,
  SITUATION_KEY_VERSION,
  WORLD_SCOPE,
  decideAttachment,
  derivePartitionKey,
  serializeSituationIdentity,
  situationIdentityEquals,
} from './situation-identity.contract';

/**
 * MAIN-CONFLICT-D1 — THE IDENTITY CONTRACT, MADE EXECUTABLE.
 *
 * Every property PF-5 rests on is asserted here rather than described. A
 * duplicate-reuse policy that cannot say when two requests are "the same" is not
 * a policy, and this file is what makes that word mean something.
 */

const observation = (over: Partial<SituationObservation> = {}): SituationObservation => ({
  url: 'https://example.test/a',
  title: 'Flooding displaces thousands in the eastern province',
  summary: 'Heavy rain has displaced households across several districts.',
  observedAt: new Date('2026-09-01T08:00:00.000Z'),
  countryCode: 'RW',
  ...over,
});

const anchor = (over: Partial<SituationAnchor> = {}): SituationAnchor => ({
  situationId: 'sit-1',
  discriminator: 'd-1',
  anchorArticleUrl: 'https://example.test/anchor-1',
  anchorTitle: 'Flooding displaces thousands in the eastern province',
  anchorObservedAt: new Date('2026-08-31T08:00:00.000Z'),
  ...over,
});

describe('D1 · TIER 1 — partition-key derivation is stable', () => {
  it('is deterministic across repeated calls', () => {
    const o = observation();
    const runs = Array.from({ length: 25 }, () => derivePartitionKey(o));
    expect(new Set(runs).size).toBe(1);
    expect(runs[0]).toBe(`sit:${SITUATION_KEY_VERSION}:RWA`);
  });

  it('maps alpha-2 to ISO3, so RW and RWA are ONE bucket and not two', () => {
    expect(derivePartitionKey(observation({ countryCode: 'RW' }))).toBe('sit:v1:RWA');
  });

  it('is time-free, URL-free and headline-free — the fields that vary do not move it', () => {
    const base = derivePartitionKey(observation());
    expect(derivePartitionKey(observation({ url: 'https://other.test/z' }))).toBe(base);
    expect(derivePartitionKey(observation({ title: 'Completely different wording' }))).toBe(base);
    expect(derivePartitionKey(observation({ summary: '' }))).toBe(base);
    expect(derivePartitionKey(observation({ observedAt: new Date('2019-01-01T00:00:00Z') }))).toBe(
      base,
    );
  });

  it('null countryCode is a statement, and maps to the world scope', () => {
    expect(derivePartitionKey(observation({ countryCode: null }))).toBe(`sit:v1:${WORLD_SCOPE}`);
  });
});

describe('D1 · TIER 1 — equivalence and collision', () => {
  it('EQUIVALENT situations produce the SAME canonical identity', () => {
    const a = derivePartitionKey(
      observation({
        url: 'https://a.test/1',
        title: 'Floods hit the east',
        observedAt: new Date(0),
      }),
    );
    const b = derivePartitionKey(
      observation({
        url: 'https://b.test/2',
        title: 'Eastern province flooding worsens',
        observedAt: new Date('2030-01-01T00:00:00Z'),
      }),
    );
    expect(a).toBe(b);
  });

  it('MATERIALLY DIFFERENT situations do not collide', () => {
    const keys = ['RW', 'CD', 'KE', 'PL', 'US']
      .map((countryCode) => derivePartitionKey(observation({ countryCode })))
      .concat(derivePartitionKey(observation({ countryCode: null })));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('the world scope is not a country, and cannot be reached by a country', () => {
    const world = derivePartitionKey(observation({ countryCode: null }));
    for (const countryCode of ['RW', 'CD', 'US']) {
      expect(derivePartitionKey(observation({ countryCode }))).not.toBe(world);
    }
  });
});

describe('D1 · invalid or incomplete input fails EXPLICITLY, never silently defaulting', () => {
  it('an unrecognised country code is REJECTED, not folded into the world bucket', () => {
    expect(() => derivePartitionKey(observation({ countryCode: 'ZZ' }))).toThrow(
      InvalidSituationIdentityError,
    );
    /* The failure mode this exists to prevent. */
    expect(() => derivePartitionKey(observation({ countryCode: 'ZZ' }))).not.toBe(
      `sit:v1:${WORLD_SCOPE}`,
    );
  });

  it('whitespace-padded country codes are rejected rather than trimmed', () => {
    expect(() => derivePartitionKey(observation({ countryCode: ' RW' }))).toThrow(
      InvalidSituationIdentityError,
    );
    expect(() => derivePartitionKey(observation({ countryCode: 'RW ' }))).toThrow(
      InvalidSituationIdentityError,
    );
  });

  it('an empty country code is rejected — null is how absence is stated', () => {
    expect(() => derivePartitionKey(observation({ countryCode: '' }))).toThrow(
      InvalidSituationIdentityError,
    );
  });

  it('a non-string country code is rejected', () => {
    expect(() => derivePartitionKey(observation({ countryCode: 42 as unknown as string }))).toThrow(
      InvalidSituationIdentityError,
    );
  });

  it('a missing observation is rejected', () => {
    expect(() => derivePartitionKey(null as unknown as SituationObservation)).toThrow(
      InvalidSituationIdentityError,
    );
  });

  it('a non-array anchor set is rejected — an empty bucket is [], not undefined', () => {
    expect(() =>
      decideAttachment(observation(), undefined as unknown as SituationAnchor[]),
    ).toThrow(InvalidSituationIdentityError);
  });
});

describe('D1 · identity serialization is canonical', () => {
  it('round-trips to one stable string', () => {
    expect(serializeSituationIdentity('sit:v1:RWA', 'd-1')).toBe('sid:1:10:sit:v1:RWA3:d-1');
  });

  it('equality is decided on the canonical form, not on field order', () => {
    expect(
      situationIdentityEquals(
        { partitionKey: 'sit:v1:RWA', discriminator: 'd-1' },
        { discriminator: 'd-1', partitionKey: 'sit:v1:RWA' },
      ),
    ).toBe(true);
  });

  it('different discriminators in one partition are different identities', () => {
    expect(
      situationIdentityEquals(
        { partitionKey: 'sit:v1:RWA', discriminator: 'd-1' },
        { partitionKey: 'sit:v1:RWA', discriminator: 'd-2' },
      ),
    ).toBe(false);
  });

  it('rejects unstorable halves rather than serializing them', () => {
    expect(() => serializeSituationIdentity('', 'd-1')).toThrow(InvalidSituationIdentityError);
    expect(() => serializeSituationIdentity('sit:v1:RWA', ' d-1')).toThrow(
      InvalidSituationIdentityError,
    );
    expect(() =>
      serializeSituationIdentity('sit:v1:RWA', 'x'.repeat(MAX_DISCRIMINATOR_LENGTH + 1)),
    ).toThrow(InvalidSituationIdentityError);
  });
});

describe('D1 · TIER 2 — attachment decisions are deterministic', () => {
  it('repeated calls on the same inputs are byte-identical', () => {
    const o = observation();
    const set = [
      anchor(),
      anchor({
        situationId: 'sit-2',
        anchorArticleUrl: 'https://example.test/anchor-2',
        anchorTitle: 'Unrelated transport strike',
      }),
    ];
    const runs = Array.from({ length: 20 }, () => JSON.stringify(decideAttachment(o, set)));
    expect(new Set(runs).size).toBe(1);
  });

  it('ANCHOR ORDER cannot change the outcome', () => {
    const o = observation();
    const a = anchor();
    const b = anchor({
      situationId: 'sit-2',
      anchorArticleUrl: 'https://example.test/anchor-2',
      anchorTitle: 'Unrelated transport strike in the capital',
    });
    expect(decideAttachment(o, [a, b])).toEqual(decideAttachment(o, [b, a]));
  });

  it('a tie is broken on a stable total order, not on array position', () => {
    const o = observation({ title: 'alpha beta' });
    const first = anchor({
      anchorArticleUrl: 'https://example.test/zzz',
      anchorTitle: 'alpha beta',
    });
    const second = anchor({
      situationId: 'sit-2',
      anchorArticleUrl: 'https://example.test/aaa',
      anchorTitle: 'alpha beta',
    });
    const forward = decideAttachment(o, [first, second]);
    const reverse = decideAttachment(o, [second, first]);
    expect(forward.anchorArticleUrl).toBe('https://example.test/aaa');
    expect(reverse.anchorArticleUrl).toBe('https://example.test/aaa');
  });

  it('an empty bucket yields bestScore NULL — never 0, which means "compared, no overlap"', () => {
    const d = decideAttachment(observation(), []);
    expect(d.bestScore).toBeNull();
    expect(d.attached).toBe(false);
    expect(d.anchorArticleUrl).toBeNull();
  });

  it('a compared-but-unrelated anchor yields 0, which is NOT null', () => {
    const d = decideAttachment(observation({ title: 'alpha beta gamma' }), [
      anchor({ anchorTitle: 'delta epsilon zeta' }),
    ]);
    expect(d.bestScore).toBe(0);
    expect(d.attached).toBe(false);
  });

  it('every decision is shadowOnly — the candidate policy governs nothing', () => {
    expect(decideAttachment(observation(), []).shadowOnly).toBe(true);
    expect(decideAttachment(observation(), [anchor()]).shadowOnly).toBe(true);
  });

  it('attaches only at or above the ratified threshold', () => {
    const identical = decideAttachment(observation(), [anchor()]);
    expect(identical.bestScore).toBe(1);
    expect(identical.attached).toBe(true);

    const unrelated = decideAttachment(observation({ title: 'alpha beta gamma' }), [
      anchor({ anchorTitle: 'delta epsilon zeta' }),
    ]);
    expect(unrelated.attached).toBe(false);
    expect(SITUATION_CONTINUITY_CANDIDATE.threshold).toBe(0.35);
  });
});

describe('D1 · the port is implemented, not paralleled', () => {
  it('SITUATION_IDENTITY_CONTRACT satisfies SituationIdentityPort', () => {
    expect(SITUATION_IDENTITY_CONTRACT.keyVersion).toBe(SITUATION_KEY_VERSION);
    expect(SITUATION_IDENTITY_CONTRACT.policyId).toBe(SITUATION_CONTINUITY_CANDIDATE.id);
    expect(SITUATION_IDENTITY_CONTRACT.policyThreshold).toBe(
      SITUATION_CONTINUITY_CANDIDATE.threshold,
    );
    expect(typeof SITUATION_IDENTITY_CONTRACT.derivePartitionKey).toBe('function');
    expect(typeof SITUATION_IDENTITY_CONTRACT.decideAttachment).toBe('function');
  });

  it('the port methods are the same functions, so there is one implementation', () => {
    expect(SITUATION_IDENTITY_CONTRACT.derivePartitionKey).toBe(derivePartitionKey);
    expect(SITUATION_IDENTITY_CONTRACT.decideAttachment).toBe(decideAttachment);
  });

  it('CALLER identity is absent — identity is a property of the evidence', () => {
    const source = SITUATION_IDENTITY_CONTRACT.derivePartitionKey.toString();
    expect(source).not.toMatch(/\b(userId|callerId|sessionId|requestId|tenantId)\b/);
  });
});

describe('D1-CORR-1 · serialization is INJECTIVE, not merely delimited', () => {
  it("E1's collision pair no longer collides", () => {
    const a = serializeSituationIdentity('sit:v1:RWA#alpha', 'beta');
    const b = serializeSituationIdentity('sit:v1:RWA', 'alpha#beta');
    expect(a).not.toBe(b);
  });

  it('no split of one concatenation can collide — the general property, not one pair', () => {
    const whole = 'sit:v1:RWA#alpha#beta';
    const forms = new Set<string>();
    for (let i = 1; i < whole.length; i += 1) {
      forms.add(serializeSituationIdentity(whole.slice(0, i), whole.slice(i)));
    }
    /* Every split of the same characters must produce a DIFFERENT encoding. */
    expect(forms.size).toBe(whole.length - 1);
  });

  it('content containing the old delimiter, or a colon, is not structural', () => {
    expect(serializeSituationIdentity('a#b', 'c')).not.toBe(serializeSituationIdentity('a', 'b#c'));
    expect(serializeSituationIdentity('a:1', 'b')).not.toBe(serializeSituationIdentity('a', '1:b'));
  });

  it('equivalent identities remain equal', () => {
    expect(serializeSituationIdentity('sit:v1:RWA', 'd-1')).toBe(
      serializeSituationIdentity('sit:v1:RWA', 'd-1'),
    );
    expect(
      situationIdentityEquals(
        { partitionKey: 'sit:v1:RWA', discriminator: 'd-1' },
        { discriminator: 'd-1', partitionKey: 'sit:v1:RWA' },
      ),
    ).toBe(true);
  });

  it('is deterministic across repeated calls', () => {
    const runs = Array.from({ length: 25 }, () => serializeSituationIdentity('sit:v1:RWA', 'd-1'));
    expect(new Set(runs).size).toBe(1);
  });

  it('carries the encoding version, separately from the key version', () => {
    expect(
      serializeSituationIdentity('sit:v1:RWA', 'd-1').startsWith(
        `${IDENTITY_SERIALIZATION_VERSION}:`,
      ),
    ).toBe(true);
  });

  it('boundary / maximum-length values remain valid', () => {
    const maxKey = 'k'.repeat(MAX_PARTITION_KEY_LENGTH);
    const maxDisc = 'd'.repeat(MAX_DISCRIMINATOR_LENGTH);
    const encoded = serializeSituationIdentity(maxKey, maxDisc);
    expect(encoded).toContain(`${MAX_PARTITION_KEY_LENGTH}:`);
    expect(encoded).toContain(`${MAX_DISCRIMINATOR_LENGTH}:`);
    expect(encoded).toBe(serializeSituationIdentity(maxKey, maxDisc));
    /* one character over the ceiling is still rejected */
    expect(() => serializeSituationIdentity(maxKey + 'k', maxDisc)).toThrow(
      InvalidSituationIdentityError,
    );
  });

  it('invalid values still fail explicitly', () => {
    expect(() => serializeSituationIdentity('', 'd-1')).toThrow(InvalidSituationIdentityError);
    expect(() => serializeSituationIdentity('sit:v1:RWA', '')).toThrow(
      InvalidSituationIdentityError,
    );
    expect(() => serializeSituationIdentity('sit:v1:RWA', ' d-1')).toThrow(
      InvalidSituationIdentityError,
    );
    expect(() => serializeSituationIdentity(null as unknown as string, 'd-1')).toThrow(
      InvalidSituationIdentityError,
    );
  });
});

describe('D1-CORR-2 · no comparison is not a comparison that scored zero', () => {
  const comparableAnchors = [
    anchor({ anchorArticleUrl: 'https://example.test/zzz', anchorTitle: 'alpha beta' }),
    anchor({
      situationId: 'sit-2',
      anchorArticleUrl: 'https://example.test/aaa',
      anchorTitle: 'alpha beta',
    }),
  ];

  it('an observation with no comparable content yields NO-COMPARISON, not 0', () => {
    const d = decideAttachment(observation({ title: '' }), comparableAnchors);
    expect(d.bestScore).toBeNull();
    expect(d.anchorArticleUrl).toBeNull();
    expect(d.attached).toBe(false);
  });

  it('it does NOT name the alphabetically first anchor for a comparison never performed', () => {
    const d = decideAttachment(observation({ title: '   ---   ' }), comparableAnchors);
    expect(d.anchorArticleUrl).not.toBe('https://example.test/aaa');
    expect(d.anchorArticleUrl).toBeNull();
  });

  it('anchors with no comparable content are not comparison partners', () => {
    const d = decideAttachment(observation({ title: 'alpha beta' }), [
      anchor({ anchorTitle: '' }),
      anchor({
        situationId: 'sit-2',
        anchorArticleUrl: 'https://example.test/b',
        anchorTitle: '  ',
      }),
    ]);
    expect(d.bestScore).toBeNull();
    expect(d.anchorArticleUrl).toBeNull();
  });

  it('a GENUINE comparison with zero overlap is numeric 0, and names its anchor', () => {
    const d = decideAttachment(observation({ title: 'alpha beta gamma' }), [
      anchor({ anchorTitle: 'delta epsilon zeta' }),
    ]);
    expect(d.bestScore).toBe(0);
    expect(d.anchorArticleUrl).not.toBeNull();
    expect(d.attached).toBe(false);
  });

  it('tie-breaking still applies among genuinely compared equal scores', () => {
    const o = observation({ title: 'alpha beta' });
    const forward = decideAttachment(o, comparableAnchors);
    const reverse = decideAttachment(o, [...comparableAnchors].reverse());
    expect(forward.anchorArticleUrl).toBe('https://example.test/aaa');
    expect(reverse.anchorArticleUrl).toBe('https://example.test/aaa');
    expect(forward).toEqual(reverse);
  });

  it('the empty bucket keeps its original no-comparison meaning', () => {
    const d = decideAttachment(observation(), []);
    expect(d.bestScore).toBeNull();
    expect(d.anchorArticleUrl).toBeNull();
  });
});
