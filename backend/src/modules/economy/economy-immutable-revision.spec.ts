import {
  type EconomyObservation,
  ECONOMY_KEY_ENCODING_VERSION,
  economyObservationKey,
  economySeriesPeriodKey,
} from '@globalnews-ai/shared';
import { EconomyObservationLedger } from './economy-observation-ledger';
import { economySourceProvenance } from './economy-source-class.adapter';

/**
 * ECON-DATA-CONTRACT-ADAPT-1 - IMMUTABLE-REVISION AND INJECTIVE-KEY PROOFS.
 *
 * The hard rule is unchanged: an Observation is immutable; a revision creates a
 * LATER VINTAGE for the same Series + Period; the prior observation is never
 * overwritten. What changed is the KEY, and the new tests below are the ones
 * that would have caught the defect MAIN-ECON-CONTRACT-1 found.
 *
 * The figures are FIXTURES, deliberately not the illustrative
 * Rwanda/Kenya/Poland numbers from the Design authority. `TEST-SERIES-1` is not
 * a real indicator.
 */
const provenance = economySourceProvenance({
  claimKind: 'STATISTICAL_RELEASE',
  officialSourceId: 'pl-gus',
  sourceUrl: 'https://stat.gov.pl/fixture/release-1',
  language: 'pl',
  retrievedAt: '2026-02-01T00:00:00.000Z',
});

function obs(
  vintage: string,
  value: number,
  over: Partial<EconomyObservation> = {},
): EconomyObservation {
  return {
    seriesId: 'TEST-SERIES-1',
    periodId: '2026-01',
    vintage,
    value,
    unit: 'index',
    semantics: { releaseStatus: 'PRELIMINARY', valueKind: 'ACTUAL', freshness: 'FRESH' },
    provenance,
    ...over,
  };
}

describe('ECON-DATA-CONTRACT-ADAPT-1 - injective key (the defect Main found)', () => {
  /*
   * THE REGRESSION. Under the previous local encoding
   *     `${seriesId} ${periodId} ${vintage}`
   * these two DIFFERENT observations produced the SAME key, and the ledger
   * silently merged them. Nothing threw; one row won.
   */
  const a = obs('v1', 1, { seriesId: 'RW CPI', periodId: 'Q1' });
  const b = obs('v1', 2, { seriesId: 'RW', periodId: 'CPI Q1' });

  it('the OLD space-join encoding collides - the mutation bite, executed', () => {
    const oldKey = (o: EconomyObservation) => `${o.seriesId} ${o.periodId} ${o.vintage}`;

    // Proof the defect was real, not hypothetical.
    expect(oldKey(a)).toBe('RW CPI Q1 v1');
    expect(oldKey(b)).toBe('RW CPI Q1 v1');
    expect(oldKey(a)).toBe(oldKey(b));

    // And proof it was load-bearing: a ledger keyed that way loses a reading.
    const collidingLedger = new Map<string, EconomyObservation>();
    for (const o of [a, b]) collidingLedger.set(oldKey(o), o);
    expect(collidingLedger.size).toBe(1);
  });

  it('the ACCEPTED eco:1 encoding does not collide', () => {
    expect(economyObservationKey(a)).not.toBe(economyObservationKey(b));
    expect(economyObservationKey(a)).toContain(ECONOMY_KEY_ENCODING_VERSION);
  });

  it('the ledger now retains BOTH observations the old key merged', () => {
    const ledger = new EconomyObservationLedger();

    ledger.append(a);
    ledger.append(b);

    expect(ledger.size()).toBe(2);
    expect(ledger.latest('RW CPI', 'Q1')?.value).toBe(1);
    expect(ledger.latest('RW', 'CPI Q1')?.value).toBe(2);
  });

  it('injectivity holds across a separator-hostile matrix, not just one example', () => {
    const parts = ['', 'a', 'a b', ' ', 'a:b', '1:a', 'eco:1', 'a  b'];
    const seen = new Map<string, string>();

    for (const s of parts) {
      for (const p of parts) {
        for (const v of parts) {
          const key = economyObservationKey({ seriesId: s, periodId: p, vintage: v });
          const id = JSON.stringify([s, p, v]);
          const clash = seen.get(key);
          expect([key, clash ?? id]).toEqual([key, id]);
          seen.set(key, id);
        }
      }
    }
    expect(seen.size).toBe(parts.length ** 3);
  });

  it('the series-period key is injective too, so two slots never merge', () => {
    expect(economySeriesPeriodKey({ seriesId: 'RW CPI', periodId: 'Q1' })).not.toBe(
      economySeriesPeriodKey({ seriesId: 'RW', periodId: 'CPI Q1' }),
    );
  });

  it('identity stays CALLER-SUPPLIED - the key mints nothing', () => {
    const key = economyObservationKey({ seriesId: 'S', periodId: 'P', vintage: 'V' });

    // Every part appears verbatim; nothing is hashed, generated or looked up.
    expect(key).toBe('eco:1:1:S1:P1:V');
  });
});

describe('ECON-DATA-CONTRACT-ADAPT-1 - observation immutability and vintages', () => {
  it('a revision APPENDS a later vintage and does not overwrite the earlier one', () => {
    const ledger = new EconomyObservationLedger();

    ledger.append(obs('2026-02-15', 101.2));
    ledger.append(
      obs('2026-03-15', 101.9, {
        semantics: {
          releaseStatus: 'REVISED',
          valueKind: 'ACTUAL',
          freshness: 'FRESH',
          revisionOrdinal: 1,
        },
      }),
    );

    const vintages = ledger.vintagesFor('TEST-SERIES-1', '2026-01');

    expect(vintages.map((v) => [v.vintage, v.value])).toEqual([
      ['2026-02-15', 101.2],
      ['2026-03-15', 101.9],
    ]);
    expect(ledger.size()).toBe(2);
  });

  it('the stored record is FROZEN, so history cannot be edited through a held reference', () => {
    const ledger = new EconomyObservationLedger();
    const stored = ledger.append(obs('2026-02-15', 101.2));

    expect(Object.isFrozen(stored)).toBe(true);
    expect(() => {
      (stored as { value: number }).value = 999;
    }).toThrow();
    expect(ledger.latest('TEST-SERIES-1', '2026-01')?.value).toBe(101.2);
  });

  it('rewriting an EXISTING vintage with a different reading is refused', () => {
    const ledger = new EconomyObservationLedger();

    ledger.append(obs('2026-02-15', 101.2));

    expect(() => ledger.append(obs('2026-02-15', 104.0))).toThrow(/ECON-IMMUTABLE-1/);
    expect(ledger.latest('TEST-SERIES-1', '2026-01')?.value).toBe(101.2);
  });

  it('re-ingesting an UNCHANGED release is idempotent, not a revision', () => {
    const ledger = new EconomyObservationLedger();
    const first = ledger.append(obs('2026-02-15', 101.2));

    // Same reading, later retrieval, and time has moved the freshness axis on.
    const again = ledger.append(
      obs('2026-02-15', 101.2, {
        semantics: { releaseStatus: 'PRELIMINARY', valueKind: 'ACTUAL', freshness: 'AGEING' },
        provenance: { ...provenance, retrievedAt: '2026-04-01T00:00:00.000Z' },
      }),
    );

    expect(again).toBe(first);
    expect(ledger.size()).toBe(1);
  });

  it('asAt answers WHAT WAS BELIEVED THEN, which is why earlier vintages are kept', () => {
    const ledger = new EconomyObservationLedger();

    ledger.append(obs('2026-02-15', 101.2));
    ledger.append(obs('2026-03-15', 101.9));

    expect(ledger.asAt('TEST-SERIES-1', '2026-01', '2026-03-01')?.value).toBe(101.2);
    expect(ledger.asAt('TEST-SERIES-1', '2026-01', '2026-04-01')?.value).toBe(101.9);
    expect(ledger.asAt('TEST-SERIES-1', '2026-01', '2026-01-01')).toBeUndefined();
  });

  it('the ledger exposes NO update or delete path', () => {
    const surface = new Set([
      ...Object.getOwnPropertyNames(EconomyObservationLedger.prototype),
      ...Object.keys(new EconomyObservationLedger()),
    ]);

    for (const forbidden of ['update', 'set', 'delete', 'remove', 'replace', 'clear', 'overwrite']) {
      expect([...surface].some((m) => m.toLowerCase().includes(forbidden))).toBe(false);
    }
  });
});
