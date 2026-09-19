/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE GENERIC NON-NUMERIC OBSERVATION CONTRACT — PL-B1 · PL-B2 · TIMESTAMP MODEL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `MAIN-POLITICS-PLATFORM-PROMOTION-R3` §1.4. These assert the landed bytes on this
 * lineage; Main's own `PL-probes.js` assert the same rules against the package's
 * transpiled copy, and both are reported.
 *
 * The load-bearing one is PL-B2-1: the authorship vocabulary must be the ACCEPTED list by
 * REFERENTIAL IDENTITY, not a copy that happens to hold the same strings. A copy drifts
 * silently; an identity cannot.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ATTRIBUTE_AUTHORSHIP_KINDS,
  assertAuthorshipIsWellFormed,
  assertTemporalBasisIsSupported,
  domainObservationKey,
} from './domain-observation';
import { UNIT_AUTHORSHIP_KINDS } from '../market';

const SRC = readFileSync(join(__dirname, 'domain-observation.ts'), 'utf-8');
const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'))
  .join('\n');

describe('PL-B1 · the record is NON-NUMERIC by construction', () => {
  it('declares no `value` and no `unit` field', () => {
    expect(code).not.toMatch(/^\s*readonly\s+value\s*[?:]/m);
    expect(code).not.toMatch(/^\s*readonly\s+unit\s*[?:]/m);
  });

  it('POSITIVE CONTROL · the scan bites when either is added', () => {
    /* Without this, "no value field" passes just as happily against an empty string or a
       renamed file. */
    expect(/^\s*readonly\s+value\s*[?:]/m.test('  readonly value: number;')).toBe(true);
    expect(/^\s*readonly\s+unit\s*[?:]/m.test('  readonly unit?: string;')).toBe(true);
  });

  it('no untyped escape hatch — any · unknown · index signature', () => {
    expect(code).not.toMatch(/:\s*any\b/);
    expect(code).not.toMatch(/:\s*unknown\b/);
    expect(code).not.toMatch(/\[\s*key\s*:\s*string\s*\]/);
    expect(code).not.toMatch(/Record<\s*string\s*,\s*unknown\s*>/);
  });

  it('POSITIVE CONTROL · that scan finds an escape hatch when one is present', () => {
    expect(/:\s*any\b/.test('const x: any = 1;')).toBe(true);
    expect(/\[\s*key\s*:\s*string\s*\]/.test('  [key: string]: number;')).toBe(true);
  });

  it('the claim is a TYPE PARAMETER, so a domain must declare its own closed shape', () => {
    /* This is what stops the generic record becoming the catch-all it refuses to be: a
       domain cannot use it without naming what it is claiming. */
    expect(code).toMatch(/interface\s+DomainObservation\s*<\s*TClaim/);
  });
});

describe('PL-B2 · authorship is attached to a NAMED attribute', () => {
  it('ATTRIBUTE_AUTHORSHIP_KINDS IS the accepted list — referential identity, not deep equality', () => {
    /*
      `toBe`, not `toEqual`. A second array holding the same strings would satisfy
      `toEqual` on the day it was written and diverge the day either list changed — which
      is exactly the failure a shared vocabulary exists to prevent.
    */
    expect(ATTRIBUTE_AUTHORSHIP_KINDS).toBe(UNIT_AUTHORSHIP_KINDS);
  });

  it('no member was added to the accepted vocabulary', () => {
    expect([...ATTRIBUTE_AUTHORSHIP_KINDS].sort()).toEqual([...UNIT_AUTHORSHIP_KINDS].sort());
  });

  it('an unnamed attribute is refused — authorship of nothing in particular', () => {
    expect(() =>
      assertAuthorshipIsWellFormed([
        { attribute: '', authorship: 'PUBLISHER_STATED' },
      ] as never),
    ).toThrow();
  });

  it('a duplicate attribute is refused — one attribute cannot have two authorships', () => {
    expect(() =>
      assertAuthorshipIsWellFormed([
        { attribute: 'summaryStage', authorship: 'PUBLISHER_STATED' },
        { attribute: 'summaryStage', authorship: 'LOCALLY_ASSERTED' },
      ] as never),
    ).toThrow();
  });

  it('a well-formed list passes — so the refusals above are about the defect, not the call', () => {
    expect(() =>
      assertAuthorshipIsWellFormed([
        { attribute: 'sourceValue', authorship: 'PUBLISHER_STATED' },
        { attribute: 'summaryStage', authorship: 'LOCALLY_ASSERTED' },
      ] as never),
    ).not.toThrow();
  });
});

describe('THE TIMESTAMP MODEL · a basis without its axis is refused', () => {
  it('OCCURRENCE with no occurrence time is refused — scheduled is not happened', () => {
    expect(() =>
      assertTemporalBasisIsSupported({
        temporalBasis: 'OCCURRENCE',
        retrievedAt: '2026-09-19T00:00:00.000Z',
      } as never),
    ).toThrow();
  });

  it('PUBLISHER_VINTAGE with no vintage is refused — published is not happened either', () => {
    expect(() =>
      assertTemporalBasisIsSupported({
        temporalBasis: 'PUBLISHER_VINTAGE',
        retrievedAt: '2026-09-19T00:00:00.000Z',
      } as never),
    ).toThrow();
  });

  it('each basis passes when the axis it claims IS present', () => {
    expect(() =>
      assertTemporalBasisIsSupported({
        temporalBasis: 'OCCURRENCE',
        occurredAt: '2026-09-01T00:00:00.000Z',
        retrievedAt: '2026-09-19T00:00:00.000Z',
      } as never),
    ).not.toThrow();
    expect(() =>
      assertTemporalBasisIsSupported({
        temporalBasis: 'PUBLISHER_VINTAGE',
        publisherVintage: '2026-09-01',
        retrievedAt: '2026-09-19T00:00:00.000Z',
      } as never),
    ).not.toThrow();
  });
});

describe('IDENTITY · the key cannot be written by hand and cannot be collided into', () => {
  it("'2018-0218' and '2018-0218 ' produce DIFFERENT keys — the id is not trimmed", () => {
    /*
      A trailing space is a different upstream identifier, and silently trimming it would
      merge two records the publisher kept apart. Length prefixing is what distinguishes
      the decompositions.
    */
    const a = domainObservationKey({
      domainId: 'POLITICS', upstreamAuthority: 'EP', upstreamId: '2018-0218',
    });
    const b = domainObservationKey({
      domainId: 'POLITICS', upstreamAuthority: 'EP', upstreamId: '2018-0218 ',
    });
    expect(a).not.toBe(b);
  });

  it('length prefixing means two decompositions cannot encode to one key', () => {
    /* `('EP','2018') and ('EP2','018')` would collide under naive concatenation. */
    const a = domainObservationKey({ domainId: 'POLITICS', upstreamAuthority: 'EP', upstreamId: '2018' });
    const b = domainObservationKey({ domainId: 'POLITICS', upstreamAuthority: 'EP2', upstreamId: '018' });
    expect(a).not.toBe(b);
  });

  it('NO UPSTREAM ID IS A PRODUCER LIMITATION, NOT AN IDENTITY TO MINT', () => {
    /*
      The refusal that matters most on this contract: a minted identity asserts a sameness
      nobody established, and it would do so silently.
    */
    expect(() =>
      domainObservationKey({ domainId: 'POLITICS', upstreamAuthority: 'EP', upstreamId: '   ' }),
    ).toThrow(/PL-ID-1/);
  });
});
