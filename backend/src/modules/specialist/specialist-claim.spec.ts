import * as sharedPackage from '@globalnews-ai/shared';
import {
  QuestionKind,
  SpecialistClaimDefinition,
  RegisteredSpecialistDomainId,
  questionKind,
  resolveSpecialistClaim,
  registeredSpecialistDomainId,
} from '@globalnews-ai/shared';

/**
 * SPECIALIST CLAIM BOUNDARY — THE PURE CONTRACT.
 *
 * WHY THESE TESTS LIVE UNDER `backend/src` WHEN THE CODE LIVES UNDER `shared/src`.
 * The backend Jest configuration sets `rootDir: "src"` and the frontend uses Jest's defaults
 * rooted at `frontend/`. Neither collects `shared/src`, so a `.spec.ts` placed beside the contract
 * would be executed by NO suite while still looking like coverage. Placement here is what makes
 * these assertions real; `@globalnews-ai/shared` is imported exactly as production code imports it.
 *
 * The domains and kinds below are TEST FIXTURES. They are not §16 rows and they are not any
 * domain's registration — no domain claim definition exists in this candidate.
 */

const CONFLICT = registeredSpecialistDomainId('CONFLICT');
const ELECTION = registeredSpecialistDomainId('ELECTION');

const HOSTILITY_SEVERITY = questionKind('HOSTILITY_SEVERITY');
const RESULT_DISPUTE = questionKind('RESULT_DISPUTE');
const AID_DELIVERY_PERFORMANCE = questionKind('AID_DELIVERY_PERFORMANCE');
const PRODUCT_HELP = questionKind('PRODUCT_HELP');

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

describe('resolveSpecialistClaim — the five outcomes', () => {
  it('returns NO_DOMAINS_REGISTERED when nothing is registered, and never UNCLAIMED', () => {
    const outcome = resolveSpecialistClaim([], { candidateKinds: [HOSTILITY_SEVERITY] });
    expect(outcome.status).toBe('NO_DOMAINS_REGISTERED');
    expect(outcome.status).not.toBe('UNCLAIMED');
  });

  it('returns NO_DOMAINS_REGISTERED even for an empty request — "nobody is listening" is about the registry', () => {
    expect(resolveSpecialistClaim([], { candidateKinds: [] }).status).toBe('NO_DOMAINS_REGISTERED');
  });

  it('returns CLAIMED with the landing and the full handoff state for a single matching domain', () => {
    const geography = { iso3: 'KEN', rung: 'ADMIN1' };
    const timeWindow = { fromIso: '2026-01-01', toIso: '2026-02-01' };
    const outcome = resolveSpecialistClaim(
      [definition(CONFLICT, [HOSTILITY_SEVERITY])],
      {
        candidateKinds: [HOSTILITY_SEVERITY],
        objectType: 'situation',
        geography,
        timeWindow,
      },
    );

    expect(outcome).toEqual({
      status: 'CLAIMED',
      domainId: CONFLICT,
      matchedKinds: [HOSTILITY_SEVERITY],
      landsOn: { railId: 'conflict-rail', objectType: 'situation' },
      handoff: { objectType: 'situation', geography, timeWindow },
    });
  });

  it('carries geography and the time window through by reference, without inspecting them', () => {
    const geography = { opaque: Symbol('geo') };
    const outcome = resolveSpecialistClaim([definition(CONFLICT, [HOSTILITY_SEVERITY])], {
      candidateKinds: [HOSTILITY_SEVERITY],
      geography,
    });
    expect(outcome.status).toBe('CLAIMED');
    if (outcome.status === 'CLAIMED') {
      expect(outcome.handoff.geography).toBe(geography);
    }
  });

  it('returns UNCLAIMED when a registered domain does not claim the kind', () => {
    const outcome = resolveSpecialistClaim([definition(CONFLICT, [HOSTILITY_SEVERITY])], {
      candidateKinds: [PRODUCT_HELP],
    });
    expect(outcome.status).toBe('UNCLAIMED');
  });

  it('returns UNCLAIMED for an empty kind list once a domain is registered', () => {
    expect(
      resolveSpecialistClaim([definition(CONFLICT, [HOSTILITY_SEVERITY])], { candidateKinds: [] })
        .status,
    ).toBe('UNCLAIMED');
  });

  it('never selects a refused kind, even when the same kind also appears in claimedKinds', () => {
    const contradictory = definition(CONFLICT, [HOSTILITY_SEVERITY, RESULT_DISPUTE], {
      refusedKinds: [RESULT_DISPUTE],
    });
    const outcome = resolveSpecialistClaim([contradictory], { candidateKinds: [RESULT_DISPUTE] });
    expect(outcome.status).toBe('UNCLAIMED');
  });

  it('still lets a domain win on a kind it does claim while refusing another in the same request', () => {
    const conflict = definition(CONFLICT, [HOSTILITY_SEVERITY], {
      refusedKinds: [AID_DELIVERY_PERFORMANCE],
    });
    const outcome = resolveSpecialistClaim([conflict], {
      candidateKinds: [HOSTILITY_SEVERITY, AID_DELIVERY_PERFORMANCE],
    });
    expect(outcome.status).toBe('CLAIMED');
    if (outcome.status === 'CLAIMED') {
      expect(outcome.matchedKinds).toEqual([HOSTILITY_SEVERITY]);
    }
  });
});

describe('resolveSpecialistClaim — routing rule 3 and rule 6', () => {
  it('breaks a two-domain tie on the object the question is about, not on its mood', () => {
    const conflict = definition(CONFLICT, [HOSTILITY_SEVERITY], {
      ownsObjectTypes: ['situation'],
      landsOn: { railId: 'conflict-assessment', objectType: 'situation' },
    });
    const election = definition(ELECTION, [RESULT_DISPUTE], {
      ownsObjectTypes: ['election-result'],
      landsOn: { railId: 'election-result', objectType: 'election-result' },
    });

    // §16's worked example: "Is the Nakuru result disputed, and is that dangerous?" — the question
    // carries both kinds; the object is an election result, so ELECTION wins and the conflict
    // object is a related object, never a second answer.
    const outcome = resolveSpecialistClaim([conflict, election], {
      candidateKinds: [RESULT_DISPUTE, HOSTILITY_SEVERITY],
      objectType: 'election-result',
    });

    expect(outcome.status).toBe('CLAIMED');
    if (outcome.status === 'CLAIMED') {
      expect(outcome.domainId).toBe(ELECTION);
      expect(outcome.landsOn.railId).toBe('election-result');
    }
  });

  it('returns EQUAL_CLAIM naming every tied domain when no object type is supplied', () => {
    const outcome = resolveSpecialistClaim(
      [
        definition(ELECTION, [RESULT_DISPUTE], { ownsObjectTypes: ['election-result'] }),
        definition(CONFLICT, [HOSTILITY_SEVERITY], { ownsObjectTypes: ['situation'] }),
      ],
      { candidateKinds: [RESULT_DISPUTE, HOSTILITY_SEVERITY] },
    );
    expect(outcome).toEqual({ status: 'EQUAL_CLAIM', domainIds: [CONFLICT, ELECTION] });
  });

  it('returns EQUAL_CLAIM rather than UNCLAIMED when the object type belongs to neither domain', () => {
    const outcome = resolveSpecialistClaim(
      [
        definition(CONFLICT, [HOSTILITY_SEVERITY], { ownsObjectTypes: ['situation'] }),
        definition(ELECTION, [RESULT_DISPUTE], { ownsObjectTypes: ['election-result'] }),
      ],
      { candidateKinds: [HOSTILITY_SEVERITY, RESULT_DISPUTE], objectType: 'article' },
    );
    expect(outcome.status).toBe('EQUAL_CLAIM');
  });

  it('orders EQUAL_CLAIM domains deterministically, whatever order they were registered in', () => {
    const conflict = definition(CONFLICT, [HOSTILITY_SEVERITY]);
    const election = definition(ELECTION, [RESULT_DISPUTE]);
    const request = { candidateKinds: [HOSTILITY_SEVERITY, RESULT_DISPUTE] };
    expect(resolveSpecialistClaim([conflict, election], request)).toEqual(
      resolveSpecialistClaim([election, conflict], request),
    );
  });
});

describe('resolveSpecialistClaim — unavailability is not absence', () => {
  it('returns CLAIMED_UNAVAILABLE with the stated reason, never UNCLAIMED', () => {
    const outcome = resolveSpecialistClaim([definition(CONFLICT, [HOSTILITY_SEVERITY])], {
      candidateKinds: [HOSTILITY_SEVERITY],
      unavailability: { CONFLICT: 'LIVE CONFLICT ASSESSMENT SERVICE NOT YET PRESENT' },
    });
    expect(outcome).toEqual({
      status: 'CLAIMED_UNAVAILABLE',
      domainId: CONFLICT,
      reason: 'LIVE CONFLICT ASSESSMENT SERVICE NOT YET PRESENT',
    });
  });

  it('ignores unavailability for a domain that did not win', () => {
    const outcome = resolveSpecialistClaim([definition(CONFLICT, [HOSTILITY_SEVERITY])], {
      candidateKinds: [HOSTILITY_SEVERITY],
      unavailability: { ELECTION: 'not built' },
    });
    expect(outcome.status).toBe('CLAIMED');
  });
});

describe('the boundary is a table read, not a classifier', () => {
  it('is pure — identical inputs give identical output, with no clock and no I/O', () => {
    const definitions = [definition(CONFLICT, [HOSTILITY_SEVERITY])];
    const request = { candidateKinds: [HOSTILITY_SEVERITY], objectType: 'situation' };
    const first = resolveSpecialistClaim(definitions, request);
    const second = resolveSpecialistClaim(definitions, request);
    expect(first).toEqual(second);
  });

  it('does not mutate the definitions or the request it is given', () => {
    const definitions = [definition(CONFLICT, [HOSTILITY_SEVERITY])];
    const request = { candidateKinds: [HOSTILITY_SEVERITY], objectType: 'situation' };
    const definitionsBefore = JSON.stringify(definitions);
    const requestBefore = JSON.stringify(request);
    resolveSpecialistClaim(definitions, request);
    expect(JSON.stringify(definitions)).toBe(definitionsBefore);
    expect(JSON.stringify(request)).toBe(requestBefore);
  });

  it('refuses a question kind that is user text rather than a symbolic id', () => {
    expect(() => questionKind('is this escalating?')).toThrow(/not a symbolic id/);
    expect(() => questionKind('hostility_severity')).toThrow(/not a symbolic id/);
    expect(() => questionKind('')).toThrow(/not a symbolic id/);
  });

  it('refuses a domain id that is not a symbolic id', () => {
    expect(() => registeredSpecialistDomainId('Conflict')).toThrow(/not a symbolic id/);
    expect(() => registeredSpecialistDomainId('9LIVES')).toThrow(/not a symbolic id/);
  });

  it('exposes no way to answer a question — the module surface names owners only', () => {
    const surface = Object.keys(sharedPackage as Record<string, unknown>).filter((name) =>
      /specialist|question/i.test(name),
    );
    expect(surface.sort()).toEqual([
      'SPECIALIST_SHA256_PATTERN',
      'SPECIALIST_SYMBOL_PATTERN',
      'questionKind',
      'registeredSpecialistDomainId',
      'resolveSpecialistClaim',
    ]);
  });
});
