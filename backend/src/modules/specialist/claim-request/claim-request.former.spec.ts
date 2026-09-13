import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ApprovedKindMapping, ClaimRequestFormationInput } from './claim-request.contract';
import { formClaimRequest } from './claim-request.former';
import { HOSTILITY_KINDS } from './hostility-evidence.v1r3';

/**
 * Source-text guards must test CODE, not the prose that explains why something is absent.
 * The first cut of these guards failed against this very module, because its comments name
 * `classifyQueryIntent`, `contextCountryIso3` and the Conflict module path in order to say they are
 * NOT used. A guard that a correct file fails is a broken guard, so comments are stripped first.
 */
function codeOnly(file: string): string {
  return readFileSync(join(__dirname, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const HOSTILE = 'Is there an armed conflict in Sudan?';
const WEATHER = "What's the weather in Sudan?";
const HOSTILE_PL = 'Czy w Sudanie trwa konflikt zbrojny?';
const WEATHER_PL = 'Jaka jest pogoda w Sudanie?';

function input(rawText: string, object?: string): ClaimRequestFormationInput {
  return {
    rawText,
    navigator: object === undefined ? {} : { object: { objectType: object } },
  };
}

describe('the collision the whole boundary exists for', () => {
  it('separates a hostility question from a weather question at the SAME structured signals', () => {
    const hostile = formClaimRequest(input(HOSTILE, 'situation'));
    const weather = formClaimRequest(input(WEATHER, 'situation'));
    expect(hostile.status).toBe('FORMED');
    expect(weather.status).toBe('INTENT_UNFORMED');
  });

  it('does the same in Polish', () => {
    expect(formClaimRequest(input(HOSTILE_PL, 'situation')).status).toBe('FORMED');
    expect(formClaimRequest(input(WEATHER_PL, 'situation')).status).toBe('INTENT_UNFORMED');
  });

  it('is decided by the subject signal alone — the object type is identical in both', () => {
    const hostile = formClaimRequest(input(HOSTILE, 'situation'));
    const weather = formClaimRequest(input(WEATHER, 'situation'));
    if (hostile.status !== 'FORMED') throw new Error('expected FORMED');
    expect(hostile.provenance.signals.objectType).toBe('situation');
    expect(hostile.provenance.signals.subjectIsHostility).toBe(true);
    expect(weather.status).toBe('INTENT_UNFORMED');
  });
});

describe('statuses', () => {
  it('FORMED carries all three kinds together and the mapping version', () => {
    const outcome = formClaimRequest(input(HOSTILE, 'situation'));
    if (outcome.status !== 'FORMED') throw new Error('expected FORMED');
    expect(outcome.request.candidateKinds).toEqual(HOSTILITY_KINDS);
    expect(outcome.provenance.mappingVersion).toBe('HOSTILITY-EN-PL-v1-R3');
  });

  it('INTENT_UNFORMED carries no request and no kinds', () => {
    const outcome = formClaimRequest(input(WEATHER));
    expect(outcome.status).toBe('INTENT_UNFORMED');
    expect('request' in outcome).toBe(false);
    expect('candidateKinds' in outcome).toBe(false);
  });

  it('FORMS with no object open — requiresContext is empty, so absence forces nothing', () => {
    const outcome = formClaimRequest(input(HOSTILE));
    expect(outcome.status).toBe('FORMED');
  });

  it('FORMS with no place named — absent geography is not INSUFFICIENT_CONTEXT for this version', () => {
    const outcome = formClaimRequest(input('shelling continued'));
    expect(outcome.status).toBe('FORMED');
  });

  it('returns INSUFFICIENT_CONTEXT, with no request, for a mapping that DOES require context', () => {
    const demanding: ApprovedKindMapping = {
      version: 'TEST-REQUIRES-OBJECT',
      approvedAgainstSha256: '0'.repeat(64),
      requiresContext: ['OBJECT'],
      derive: () => HOSTILITY_KINDS,
    };
    const outcome = formClaimRequest(input(HOSTILE), demanding);
    expect(outcome.status).toBe('INSUFFICIENT_CONTEXT');
    if (outcome.status !== 'INSUFFICIENT_CONTEXT') throw new Error('expected INSUFFICIENT_CONTEXT');
    expect(outcome.missing).toEqual(['OBJECT']);
    expect('request' in outcome).toBe(false);
  });
});

describe('nothing is defaulted', () => {
  it('never invents geography — an unplaced question carries none', () => {
    const outcome = formClaimRequest(input('shelling continued'));
    if (outcome.status !== 'FORMED') throw new Error('expected FORMED');
    const geo = outcome.request.geography;
    expect(geo === undefined || geo.place === undefined).toBe(true);
  });

  it('never carries a time window — it cannot be supplied at all', () => {
    const outcome = formClaimRequest(input(HOSTILE, 'situation'));
    if (outcome.status !== 'FORMED') throw new Error('expected FORMED');
    expect(outcome.request.timeWindow).toBeUndefined();
  });

  it('never substitutes an object type', () => {
    const outcome = formClaimRequest(input(HOSTILE));
    if (outcome.status !== 'FORMED') throw new Error('expected FORMED');
    expect(outcome.request.objectType).toBeUndefined();
  });
});

describe('reuse, done correctly', () => {
  it('does not re-resolve geography the navigator already supplied', () => {
    const supplied = {
      precision: 'COUNTRY' as const,
      provenance: 'STATED' as const,
      candidates: [],
      reason: 'NO_PLACE_EVIDENCE' as const,
      detail: 'supplied by the navigator',
    };
    const outcome = formClaimRequest({
      rawText: HOSTILE,
      navigator: { geography: supplied, object: { objectType: 'situation' } },
    });
    if (outcome.status !== 'FORMED') throw new Error('expected FORMED');
    expect(outcome.request.geography).toBe(supplied);
  });

  it('carries geography provenance through unflattened', () => {
    const outcome = formClaimRequest(input('armed conflict in Sudan', 'situation'));
    if (outcome.status !== 'FORMED') throw new Error('expected FORMED');
    const geo = outcome.request.geography;
    if (geo?.provenance !== undefined) {
      expect(['STATED', 'INTERPRETED', 'CONTESTED']).toContain(geo.provenance);
      expect(outcome.provenance.signals.geographyProvenance).toBe(geo.provenance);
    }
  });

  it('calls the canonical navigator with requireGeographicContext and never contextCountryIso3', () => {
    const code = codeOnly('claim-request.former.ts');
    expect(code).toContain('requireGeographicContext: true');
    expect(code).not.toContain('contextCountryIso3');
  });
});

describe('purity', () => {
  it('gives identical output for identical input', () => {
    const one = formClaimRequest(input(HOSTILE, 'situation'));
    const two = formClaimRequest(input(HOSTILE, 'situation'));
    expect(JSON.stringify(one)).toBe(JSON.stringify(two));
  });

  it('does not mutate its input', () => {
    const given = input(HOSTILE, 'situation');
    const before = JSON.stringify(given);
    formClaimRequest(given);
    expect(JSON.stringify(given)).toBe(before);
  });
});

describe('boundaries', () => {
  it('imports nothing from Analysis, from P2s registry, or from any domain', () => {
    const code = codeOnly('claim-request.former.ts');
    expect(code).not.toContain("from '../../analysis");
    expect(code).not.toContain('classifyQueryIntent');
    expect(code).not.toContain('specialist-claim.registry');
    expect(code).not.toContain('specialist.module');
    expect(code).not.toContain('conflict-claim');
    expect(code).not.toContain('AnalyticalDomain');
  });

  it('names no domain and returns no domain id', () => {
    const outcome = formClaimRequest(input(HOSTILE, 'situation'));
    expect(JSON.stringify(outcome)).not.toContain('CONFLICT');
    expect(JSON.stringify(outcome)).not.toContain('domainId');
  });

  it('exposes only the former — nothing that answers a question', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const surface = Object.keys(require('./claim-request.former') as Record<string, unknown>);
    expect(surface.sort()).toEqual(['formClaimRequest']);
  });
});
