import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ApprovedKindMapping, ClaimRequestFormation, FormationSignals } from './claim-request.contract';
import { HOSTILITY_MAPPING_V1R3 } from './hostility-evidence.v1r3';

/**
 * THE CONTRACT'S GUARANTEES ARE STRUCTURAL, SO THESE ASSERT THE STRUCTURE.
 * The ones that matter most are the two negatives: only FORMED carries a request, and
 * INTENT_UNFORMED carries no kinds. Those are what make "partial context does not route" and
 * "no empty-kinds call to P2" impossible to violate rather than merely forbidden.
 */

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

const FORMED: ClaimRequestFormation = {
  status: 'FORMED',
  request: { candidateKinds: [] as never[] },
  provenance: { mappingVersion: 'x', signals: {} },
};
const INSUFFICIENT: ClaimRequestFormation = {
  status: 'INSUFFICIENT_CONTEXT',
  candidateKinds: [],
  missing: ['GEOGRAPHY'],
  provenance: { mappingVersion: 'x', signals: {} },
};
const UNFORMED: ClaimRequestFormation = { status: 'INTENT_UNFORMED', reason: 'NO_MAPPING_MATCHED' };

describe('only FORMED carries a request', () => {
  it('FORMED has one', () => {
    expect('request' in FORMED).toBe(true);
  });

  it('INSUFFICIENT_CONTEXT does not — so a caller cannot route partial context', () => {
    expect('request' in INSUFFICIENT).toBe(false);
  });

  it('INTENT_UNFORMED carries neither a request nor candidate kinds', () => {
    expect('request' in UNFORMED).toBe(false);
    expect('candidateKinds' in UNFORMED).toBe(false);
  });
});

describe('the signal set is exactly what is authorized', () => {
  it('accepts only the four authorized signals', () => {
    const signals: FormationSignals = {
      subjectIsHostility: true,
      objectType: 'situation',
      geographyPrecision: 'COUNTRY',
      geographyProvenance: 'STATED',
    };
    expect(Object.keys(signals).sort()).toEqual([
      'geographyPrecision',
      'geographyProvenance',
      'objectType',
      'subjectIsHostility',
    ]);
  });

  it('carries no language signal and no AnalyticalDomain', () => {
    const code = readFileSync(join(__dirname, 'claim-request.contract.ts'), 'utf8');
    expect(code).not.toContain('AnalyticalDomain');
    expect(code).not.toMatch(/\blanguage\b\s*[?:]/);
  });

  it('models the subject signal as present-or-absent, never false', () => {
    const code = readFileSync(join(__dirname, 'claim-request.contract.ts'), 'utf8');
    expect(code).toContain('subjectIsHostility?: true');
    expect(code).not.toContain('subjectIsHostility?: boolean');
  });
});

describe('the time window cannot be supplied', () => {
  it('defaults TTime to never, so absence is the type rather than a convention', () => {
    const code = readFileSync(join(__dirname, 'claim-request.contract.ts'), 'utf8');
    expect(code).toContain('TTime = never');
  });

  it('defines no TimeWindow taxonomy of its own', () => {
    const code = readFileSync(join(__dirname, 'claim-request.contract.ts'), 'utf8');
    expect(code).not.toMatch(/interface\s+TimeWindow/);
    expect(code).not.toMatch(/type\s+TimeWindow/);
  });
});

describe('a mapping declares what it requires', () => {
  it('exposes version, authority hash, requiresContext and a pure derive', () => {
    const mapping: ApprovedKindMapping = HOSTILITY_MAPPING_V1R3;
    expect(typeof mapping.version).toBe('string');
    expect(mapping.approvedAgainstSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Array.isArray(mapping.requiresContext)).toBe(true);
    expect(typeof mapping.derive).toBe('function');
  });
});

describe('the contract names no domain and imports nothing it must not', () => {
  it('has no domain id, no registry import, no Analysis import', () => {
    const code = codeOnly('claim-request.contract.ts');
    expect(code).not.toContain('conflict-claim');
    expect(code).not.toContain('specialist-claim.registry');
    expect(code).not.toContain('specialist.module');
    expect(code).not.toContain('modules/analysis');
    expect(code).not.toContain('classifyQueryIntent');
    expect(code).not.toContain('domainId');
  });
});
