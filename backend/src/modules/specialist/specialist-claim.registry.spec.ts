import { Test } from '@nestjs/testing';
import {
  QuestionKind,
  SpecialistClaimDefinition,
  RegisteredSpecialistDomainId,
  questionKind,
  registeredSpecialistDomainId,
} from '@globalnews-ai/shared';
import {
  ACCEPTED_SPECIALIST_DESIGN_AUTHORITIES,
  SUPERSEDED_SPECIALIST_DESIGN_AUTHORITIES,
  SpecialistClaimRegistry,
} from './specialist-claim.registry';
import { SpecialistModule } from './specialist.module';

/**
 * SPECIALIST CLAIM BOUNDARY — THE REGISTRY.
 *
 * The domains and kinds below are TEST FIXTURES, not §16 rows. No domain claim definition exists
 * in this candidate: Conflict, Election and Delivery register themselves, from their own modules,
 * when they exist.
 */

const CONFLICT = registeredSpecialistDomainId('CONFLICT');
const ELECTION = registeredSpecialistDomainId('ELECTION');

const HOSTILITY_SEVERITY = questionKind('HOSTILITY_SEVERITY');
const RESULT_DISPUTE = questionKind('RESULT_DISPUTE');

const AUTHORITY = 'Part V Conflict Intelligence v1.0 R2 - SPEC (prose authority)';
const AUTHORITY_SHA = 'b8425fa996fa5cfc6415df8b938ee4dd5ac118257e5c62d41bd161fce141c1d2';

function definition(
  domainId: RegisteredSpecialistDomainId,
  claimedKinds: readonly QuestionKind[],
  overrides: Partial<SpecialistClaimDefinition> = {},
): SpecialistClaimDefinition {
  return {
    domainId,
    authorityRef: AUTHORITY,
    authoritySha256: AUTHORITY_SHA,
    claimedKinds,
    refusedKinds: [],
    landsOn: { railId: `${String(domainId).toLowerCase()}-rail`, objectType: 'situation' },
    ownsObjectTypes: ['situation'],
    ...overrides,
  };
}

describe('SpecialistClaimRegistry — the module', () => {
  it('provides and exports the registry, and is empty on construction', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [SpecialistModule] }).compile();
    const registry = moduleRef.get(SpecialistClaimRegistry);
    expect(registry).toBeInstanceOf(SpecialistClaimRegistry);
    expect(registry.registeredDomains()).toEqual([]);
  });

  it('registers no domain of its own — the platform never claims', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [SpecialistModule] }).compile();
    const registry = moduleRef.get(SpecialistClaimRegistry);
    expect(registry.resolve({ candidateKinds: [HOSTILITY_SEVERITY] }).status).toBe(
      'NO_DOMAINS_REGISTERED',
    );
  });
});

describe('SpecialistClaimRegistry — registration', () => {
  let registry: SpecialistClaimRegistry;

  beforeEach(() => {
    registry = new SpecialistClaimRegistry();
  });

  it('accepts one domain and reports it', () => {
    registry.register(definition(CONFLICT, [HOSTILITY_SEVERITY]));
    expect(registry.registeredDomains()).toEqual([CONFLICT]);
    expect(registry.ownerOfKind(HOSTILITY_SEVERITY)).toBe(CONFLICT);
  });

  it('refuses a second domain claiming an already-claimed kind, naming both', () => {
    registry.register(definition(CONFLICT, [HOSTILITY_SEVERITY]));
    expect(() => registry.register(definition(ELECTION, [HOSTILITY_SEVERITY]))).toThrow(
      /claimed by both "CONFLICT" and "ELECTION"/,
    );
  });

  it('leaves the registry unchanged when a duplicate claim is refused', () => {
    registry.register(definition(CONFLICT, [HOSTILITY_SEVERITY]));
    try {
      registry.register(definition(ELECTION, [HOSTILITY_SEVERITY]));
    } catch {
      /* refused, as asserted above */
    }
    expect(registry.registeredDomains()).toEqual([CONFLICT]);
    expect(registry.ownerOfKind(HOSTILITY_SEVERITY)).toBe(CONFLICT);
  });

  it('accepts two domains claiming different kinds', () => {
    registry.register(definition(CONFLICT, [HOSTILITY_SEVERITY]));
    registry.register(definition(ELECTION, [RESULT_DISPUTE], { ownsObjectTypes: ['election-result'] }));
    expect(registry.registeredDomains()).toEqual([CONFLICT, ELECTION]);
  });

  it('refuses the same domain registering twice', () => {
    registry.register(definition(CONFLICT, [HOSTILITY_SEVERITY]));
    expect(() => registry.register(definition(CONFLICT, [RESULT_DISPUTE]))).toThrow(
      /already registered/,
    );
  });

  it('refuses a domain that claims nothing — absence expresses non-existence', () => {
    expect(() => registry.register(definition(CONFLICT, []))).toThrow(/claims no kinds/);
  });

  it('refuses a row that both claims and refuses the same kind', () => {
    expect(() =>
      registry.register(
        definition(CONFLICT, [HOSTILITY_SEVERITY], { refusedKinds: [HOSTILITY_SEVERITY] }),
      ),
    ).toThrow(/both claims and refuses/);
  });
});

describe('SpecialistClaimRegistry — authority is checked by hash, not by filename', () => {
  let registry: SpecialistClaimRegistry;

  beforeEach(() => {
    registry = new SpecialistClaimRegistry();
  });

  it('accepts any label as long as the hash is one the platform accepted', () => {
    registry.register(
      definition(CONFLICT, [HOSTILITY_SEVERITY], { authorityRef: 'whatever the file was called' }),
    );
    expect(registry.registeredDomains()).toEqual([CONFLICT]);
  });

  it('refuses the SUPERSEDED Addendum, and says so — the filename would not have told anyone', () => {
    expect(() =>
      registry.register(
        definition(CONFLICT, [HOSTILITY_SEVERITY], {
          authorityRef: 'Shared Specialist Addendum v1.0',
          authoritySha256: '71646a05b4055ec547527b22cae68bd2ecc50d054370d0db91b3bd350fdd2ff5',
        }),
      ),
    ).toThrow(/SUPERSEDED document/);
  });

  it('refuses a hash the platform has not accepted at all', () => {
    expect(() =>
      registry.register(
        definition(CONFLICT, [HOSTILITY_SEVERITY], {
          authoritySha256:
            '0000000000000000000000000000000000000000000000000000000000000000',
        }),
      ),
    ).toThrow(/has not accepted/);
  });

  it('refuses a value that is not a sha256 at all', () => {
    expect(() =>
      registry.register(
        definition(CONFLICT, [HOSTILITY_SEVERITY], { authoritySha256: 'unknown' }),
      ),
    ).toThrow(/is not a sha256/);
  });

  it('refuses a registration that cites no document', () => {
    expect(() =>
      registry.register(definition(CONFLICT, [HOSTILITY_SEVERITY], { authorityRef: '   ' })),
    ).toThrow(/cites no authority document/);
  });

  it('accepts the Addendum at R1 and never at the superseded hash', () => {
    expect(
      ACCEPTED_SPECIALIST_DESIGN_AUTHORITIES[
        '50b4b882576e76722eb57044de80289a5559b64dc0b6832ba838605902b90acd'
      ],
    ).toBe('Shared Specialist Addendum v1.0 R1');
    expect(
      Object.keys(ACCEPTED_SPECIALIST_DESIGN_AUTHORITIES).some((hash) =>
        SUPERSEDED_SPECIALIST_DESIGN_AUTHORITIES.includes(hash),
      ),
    ).toBe(false);
  });
});

describe('the canonical QuestionKind register is platform-owned', () => {
  it('starts empty — this package declares no canonical vocabulary of its own', () => {
    expect(new SpecialistClaimRegistry().canonicalKinds()).toEqual([]);
  });

  it('a kind acquires an owner only by passing through register()', () => {
    const registry = new SpecialistClaimRegistry();
    expect(registry.ownerOfKind(HOSTILITY_SEVERITY)).toBeUndefined();
    registry.register(definition(CONFLICT, [HOSTILITY_SEVERITY]));
    expect(registry.canonicalKinds()).toEqual([HOSTILITY_SEVERITY]);
    expect(registry.ownerOfKind(HOSTILITY_SEVERITY)).toBe(CONFLICT);
  });

  it('records ownership for every claimed kind, ordered, across domains', () => {
    const registry = new SpecialistClaimRegistry();
    registry.register(definition(ELECTION, [RESULT_DISPUTE], { ownsObjectTypes: ['election-result'] }));
    registry.register(definition(CONFLICT, [HOSTILITY_SEVERITY]));
    expect(registry.canonicalKinds()).toEqual([HOSTILITY_SEVERITY, RESULT_DISPUTE]);
  });

  it('does not register a refused kind as canonical — refusing is not owning', () => {
    const registry = new SpecialistClaimRegistry();
    registry.register(
      definition(CONFLICT, [HOSTILITY_SEVERITY], { refusedKinds: [RESULT_DISPUTE] }),
    );
    expect(registry.canonicalKinds()).toEqual([HOSTILITY_SEVERITY]);
    expect(registry.ownerOfKind(RESULT_DISPUTE)).toBeUndefined();
  });

  it('leaves the register untouched when a duplicate-kind registration is refused', () => {
    const registry = new SpecialistClaimRegistry();
    registry.register(definition(CONFLICT, [HOSTILITY_SEVERITY]));
    expect(() => registry.register(definition(ELECTION, [HOSTILITY_SEVERITY]))).toThrow();
    expect(registry.canonicalKinds()).toEqual([HOSTILITY_SEVERITY]);
    expect(registry.ownerOfKind(HOSTILITY_SEVERITY)).toBe(CONFLICT);
  });
});

describe('NO_DOMAINS_REGISTERED is the honest landing behaviour', () => {
  it('is what an empty register returns, and is never UNCLAIMED', () => {
    const registry = new SpecialistClaimRegistry();
    const outcome = registry.resolve({ candidateKinds: [HOSTILITY_SEVERITY] });
    expect(outcome.status).toBe('NO_DOMAINS_REGISTERED');
    expect(outcome.status).not.toBe('UNCLAIMED');
  });

  it('survives a refused registration — a rejected domain is not a registered one', () => {
    const registry = new SpecialistClaimRegistry();
    // Refused on the AUTHORITY HASH, not on the label: since authorities are keyed by sha256, a
    // wrong label alone would (correctly) register fine.
    expect(() =>
      registry.register(
        definition(CONFLICT, [HOSTILITY_SEVERITY], {
          authorityRef: 'some draft nobody accepted',
          authoritySha256:
            '0000000000000000000000000000000000000000000000000000000000000000',
        }),
      ),
    ).toThrow(/has not accepted/);
    expect(registry.registeredDomains()).toEqual([]);
    expect(registry.resolve({ candidateKinds: [HOSTILITY_SEVERITY] }).status).toBe(
      'NO_DOMAINS_REGISTERED',
    );
  });

  it('stops being the answer the moment one domain registers', () => {
    const registry = new SpecialistClaimRegistry();
    registry.register(definition(CONFLICT, [HOSTILITY_SEVERITY]));
    expect(registry.resolve({ candidateKinds: [RESULT_DISPUTE] }).status).toBe('UNCLAIMED');
  });
});

describe('SpecialistClaimRegistry — resolution through the live registry', () => {
  it('adds no rule of its own: it returns exactly what the pure resolver returns', () => {
    const registry = new SpecialistClaimRegistry();
    registry.register(definition(CONFLICT, [HOSTILITY_SEVERITY]));
    const outcome = registry.resolve({
      candidateKinds: [HOSTILITY_SEVERITY],
      objectType: 'situation',
      geography: { iso3: 'KEN' },
    });
    expect(outcome.status).toBe('CLAIMED');
    if (outcome.status === 'CLAIMED') {
      expect(outcome.domainId).toBe(CONFLICT);
      expect(outcome.handoff.geography).toEqual({ iso3: 'KEN' });
    }
  });

  it('reports a registered-but-unavailable domain as its owner, never as unclaimed', () => {
    const registry = new SpecialistClaimRegistry();
    registry.register(definition(CONFLICT, [HOSTILITY_SEVERITY]));
    const outcome = registry.resolve({
      candidateKinds: [HOSTILITY_SEVERITY],
      unavailability: { CONFLICT: 'LIVE CONFLICT ASSESSMENT SERVICE NOT YET PRESENT' },
    });
    expect(outcome.status).toBe('CLAIMED_UNAVAILABLE');
  });

  it('exposes no method that can answer a question', () => {
    const surface = Object.getOwnPropertyNames(SpecialistClaimRegistry.prototype).filter(
      (name) => name !== 'constructor' && !name.startsWith('assert') && !name.startsWith('on'),
    );
    expect(surface.sort()).toEqual([
      'canonicalKinds',
      'ownerOfKind',
      'register',
      'registeredDomains',
      'resolve',
    ]);
  });
});
