import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SPECIALIST_SYMBOL_PATTERN,
  questionKind,
  registeredSpecialistDomainId,
  type QuestionKind,
  type SpecialistClaimDefinition,
} from '@globalnews-ai/shared';
import {
  ACCEPTED_SPECIALIST_DESIGN_AUTHORITIES,
  SUPERSEDED_SPECIALIST_DESIGN_AUTHORITIES,
  SpecialistClaimRegistry,
} from '../specialist/specialist-claim.registry';
import { ConflictClaimModule } from './conflict-claim.module';
import {
  CONFLICT_CLAIM_DEFINITION,
  CONFLICT_CLAIMED_KINDS,
  CONFLICT_DOMAIN_ID,
  CONFLICT_OWNED_OBJECT_TYPES,
  CONFLICT_REFUSED_KINDS,
  HOSTILITY_ESCALATION,
  HOSTILITY_PARTICIPANTS,
  HOSTILITY_SEVERITY,
} from './conflict-claim.definition';

/**
 * CONFLICT CLAIM REGISTRATION — THE PROOFS.
 *
 *     baseline  C16  225A1E3EA122AFF019D96517BB12EAFC520FCF7DC9C655DE67F00B3A775E98D8
 *     authority Shared Specialist Addendum v1.0 R1 §16
 *               50b4b882576e76722eb57044de80289a5559b64dc0b6832ba838605902b90acd
 *
 * ELECTION, DELIVERY AND HUMANITARIAN APPEAR BELOW ONLY AS TEST FIXTURES — the same
 * arrangement P2's own registry spec uses and says so. No foreign domain is
 * registered by this package, and the fixtures exist precisely to prove that.
 */

/* Fixtures. Not §16 rows, not registrations, not a vocabulary. */
const ELECTION = registeredSpecialistDomainId('ELECTION');
const HUMANITARIAN = registeredSpecialistDomainId('HUMANITARIAN');
const RESULT_DISPUTE = questionKind('RESULT_DISPUTE');
const DISPLACEMENT_MOVEMENT = questionKind('DISPLACEMENT_MOVEMENT');

const R1_SHA = '50b4b882576e76722eb57044de80289a5559b64dc0b6832ba838605902b90acd';

function fixture(
  domainId: typeof ELECTION,
  claimedKinds: readonly QuestionKind[],
  overrides: Partial<SpecialistClaimDefinition> = {},
): SpecialistClaimDefinition {
  return {
    domainId,
    authorityRef: 'Shared Specialist Intelligence Addendum v1.0 R1 - fixture',
    authoritySha256: R1_SHA,
    claimedKinds,
    refusedKinds: [],
    landsOn: { railId: 'fixture-rail', objectType: 'contest' },
    ownsObjectTypes: ['contest'],
    ...overrides,
  };
}

const registry = (): SpecialistClaimRegistry => new SpecialistClaimRegistry();

describe('the registration is exactly the three ruled kinds', () => {
  it('claims three kinds and no fourth', () => {
    expect(CONFLICT_CLAIMED_KINDS).toEqual([
      HOSTILITY_SEVERITY,
      HOSTILITY_PARTICIPANTS,
      HOSTILITY_ESCALATION,
    ]);
    expect(CONFLICT_CLAIM_DEFINITION.claimedKinds).toHaveLength(3);
  });

  it('does NOT claim DISPLACEMENT_MOVEMENT — reserved for future HUMANITARIAN ownership', () => {
    /*
      CTO ruling on the P4 proposal. §16's fourth Conflict phrase is "Where are
      people moving", and registering it would have let REGISTRATION ORDER settle a
      precedence question §16 says is "resolved by ruling, not by code".

      Conflict may DISPLAY displacement — it owns the `displacement` object subtype
      and Part V §02's humanConsequence — but it does not WIN a displacement question
      at the router. Those are different powers.
    */
    expect(CONFLICT_CLAIMED_KINDS).not.toContain(DISPLACEMENT_MOVEMENT);

    const registered = registry();
    registered.register(CONFLICT_CLAIM_DEFINITION);

    expect(registered.ownerOfKind(DISPLACEMENT_MOVEMENT)).toBeUndefined();
    expect(registered.resolve({ candidateKinds: [DISPLACEMENT_MOVEMENT] }).status).toBe('UNCLAIMED');
  });

  it('the name is ABSENT from the module, not declared-and-unclaimed', () => {
    /*
      A declared constant is a name looking for a claim. The next reader should find
      nothing to promote — so the source itself is asserted, not merely the export.
    */
    const source = readFileSync(join(__dirname, 'conflict-claim.definition.ts'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

    expect(code).not.toContain('DISPLACEMENT_MOVEMENT');
    expect(code).not.toMatch(/questionKind\('DISPLACEMENT/);
  });

  it('HUMANITARIAN can later claim it, because Conflict reserved nothing', () => {
    const registered = registry();
    registered.register(CONFLICT_CLAIM_DEFINITION);

    /* The whole point of the ruling: the name is free for its eventual owner. */
    expect(() =>
      registered.register(fixture(HUMANITARIAN, [DISPLACEMENT_MOVEMENT], { ownsObjectTypes: [] })),
    ).not.toThrow();
    expect(registered.ownerOfKind(DISPLACEMENT_MOVEMENT)).toBe(HUMANITARIAN);
  });
});

describe('R1 — Conflict owns no displacement OBJECT-TYPE authority either', () => {
  /*
    ── THE DEFECT THIS GROUP EXISTS TO PREVENT ─────────────────────────────

    The first cut of this registration kept `displacement` in `ownsObjectTypes`,
    on the reasoning that an object type is a tiebreak input and a question kind is
    a claim, so Conflict could hold one without the other.

    That is wrong, because `ownsObjectTypes` PARTICIPATES IN P2's RESOLUTION. With
    `displacement` owned, a request carrying both a displacement kind and a hostility
    kind on `objectType: 'displacement'` narrows to Conflict at rule 3 and takes
    precedence FROM THE KIND'S REAL OWNER — the reservation holding in the vocabulary
    and leaking in the resolution.

    These tests execute that scenario against P2's real resolver rather than
    asserting the list, because the list is the cause and the resolution is the harm.
  */

  it('displacement is absent from the ownership/tiebreak declaration', () => {
    expect(CONFLICT_OWNED_OBJECT_TYPES).not.toContain('displacement');
    expect(CONFLICT_CLAIM_DEFINITION.ownsObjectTypes).not.toContain('displacement');
  });

  it('a HUMANITARIAN owner wins a displacement object OUTRIGHT — no tiebreak reached', () => {
    const registered = registry();
    registered.register(CONFLICT_CLAIM_DEFINITION);
    registered.register(
      fixture(HUMANITARIAN, [DISPLACEMENT_MOVEMENT], { ownsObjectTypes: ['displacement'] }),
    );

    const outcome = registered.resolve({
      candidateKinds: [DISPLACEMENT_MOVEMENT],
      objectType: 'displacement',
    });

    expect(outcome.status).toBe('CLAIMED');
    expect(outcome.status === 'CLAIMED' && outcome.domainId).toBe(HUMANITARIAN);
  });

  it('and wins it even when a Conflict kind is in the SAME request', () => {
    /*
      THE EXACT SCENARIO THE OLD LIST BROKE. Both domains have an effective kind, so
      rule 3 runs on `objectType: 'displacement'`. Conflict must not be an owner of
      that object, or it narrows to Conflict and answers a displacement question.
    */
    const registered = registry();
    registered.register(CONFLICT_CLAIM_DEFINITION);
    registered.register(
      fixture(HUMANITARIAN, [DISPLACEMENT_MOVEMENT], { ownsObjectTypes: ['displacement'] }),
    );

    const outcome = registered.resolve({
      candidateKinds: [DISPLACEMENT_MOVEMENT, HOSTILITY_SEVERITY],
      objectType: 'displacement',
    });

    expect(outcome.status).toBe('CLAIMED');
    expect(outcome.status === 'CLAIMED' && outcome.domainId).toBe(HUMANITARIAN);
    expect(outcome.status === 'CLAIMED' && outcome.matchedKinds).toEqual([DISPLACEMENT_MOVEMENT]);
  });

  it('Conflict still wins its OWN objects in the same request — nothing was over-removed', () => {
    /*
      The correction must not cost Conflict anything it legitimately owns. On a
      `situation`, the same two-kind request resolves to Conflict exactly as before.
    */
    const registered = registry();
    registered.register(CONFLICT_CLAIM_DEFINITION);
    registered.register(
      fixture(HUMANITARIAN, [DISPLACEMENT_MOVEMENT], { ownsObjectTypes: ['displacement'] }),
    );

    const outcome = registered.resolve({
      candidateKinds: [DISPLACEMENT_MOVEMENT, HOSTILITY_SEVERITY],
      objectType: 'situation',
    });

    expect(outcome.status).toBe('CLAIMED');
    expect(outcome.status === 'CLAIMED' && outcome.domainId).toBe(CONFLICT_DOMAIN_ID);
  });

  it('with no HUMANITARIAN registered, a displacement request is UNCLAIMED — never Conflict', () => {
    /*
      The state the product is actually in today. Conflict must not become the
      fallback answerer for displacement merely by being the only domain present.
    */
    const registered = registry();
    registered.register(CONFLICT_CLAIM_DEFINITION);

    expect(
      registered.resolve({ candidateKinds: [DISPLACEMENT_MOVEMENT], objectType: 'displacement' })
        .status,
    ).toBe('UNCLAIMED');
  });
});

describe('duplicate kind THROWS', () => {
  it('a second domain claiming a Conflict kind is refused, naming both domains', () => {
    const registered = registry();
    registered.register(CONFLICT_CLAIM_DEFINITION);

    let thrown: Error | null = null;

    try {
      registered.register(fixture(ELECTION, [HOSTILITY_SEVERITY]));
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown).not.toBeNull();
    /*
      Asserted on the MESSAGE, not merely that something threw. P2 names both
      domains and the kind precisely so the overlap surfaces for a ruling; a test
      that accepted any error would pass on a bare `throw`.
    */
    expect(thrown?.message).toContain('HOSTILITY_SEVERITY');
    expect(thrown?.message).toContain('CONFLICT');
    expect(thrown?.message).toContain('ELECTION');
    expect(thrown?.message).toContain('resolved by ruling, not by code');
  });

  it('every one of the three kinds is protected, not just the first', () => {
    for (const kind of CONFLICT_CLAIMED_KINDS) {
      const registered = registry();
      registered.register(CONFLICT_CLAIM_DEFINITION);

      expect(() => registered.register(fixture(ELECTION, [kind]))).toThrow(/is claimed by both/);
    }
  });

  it('the registry is UNCHANGED after a refused registration', () => {
    const registered = registry();
    registered.register(CONFLICT_CLAIM_DEFINITION);

    expect(() => registered.register(fixture(ELECTION, [HOSTILITY_ESCALATION]))).toThrow();

    /* A refusal must not half-apply: no partial domain, no orphaned kind owner. */
    expect(registered.registeredDomains()).toEqual([CONFLICT_DOMAIN_ID]);
    expect(registered.ownerOfKind(HOSTILITY_ESCALATION)).toBe(CONFLICT_DOMAIN_ID);
    expect(registered.canonicalKinds()).toHaveLength(3);
  });

  it('Conflict registering twice throws — a domain registers once, from its own module', () => {
    const registered = registry();
    registered.register(CONFLICT_CLAIM_DEFINITION);

    expect(() => registered.register(CONFLICT_CLAIM_DEFINITION)).toThrow(/already registered/);
  });
});

describe('no Election, Delivery or Humanitarian registration exists', () => {
  it('the live module registers exactly one domain', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ConflictClaimModule] }).compile();
    await moduleRef.init();

    const registered = moduleRef.get(SpecialistClaimRegistry);

    expect(registered.registeredDomains()).toEqual([CONFLICT_DOMAIN_ID]);
    expect(registered.canonicalKinds()).toEqual(
      [HOSTILITY_ESCALATION, HOSTILITY_PARTICIPANTS, HOSTILITY_SEVERITY].sort(),
    );
  });

  it('no foreign kind has an owner', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ConflictClaimModule] }).compile();
    await moduleRef.init();

    const registered = moduleRef.get(SpecialistClaimRegistry);

    for (const foreign of [RESULT_DISPUTE, DISPLACEMENT_MOVEMENT, questionKind('COMMITMENT_MET')]) {
      expect({ foreign, owner: registered.ownerOfKind(foreign) }).toEqual({
        foreign,
        owner: undefined,
      });
    }
  });

  it('the module source registers no domain but its own', () => {
    const source = readFileSync(join(__dirname, 'conflict-claim.module.ts'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

    expect(code.match(/\.register\(/g) ?? []).toHaveLength(1);
    expect(code).toContain('CONFLICT_CLAIM_DEFINITION');
    expect(code).not.toMatch(/ELECTION|DELIVERY|HUMANITARIAN/);
  });
});

describe('refusedKinds is empty by ruling, and the boundary still holds', () => {
  it('refuses nothing, and names no vocabulary it does not own', () => {
    expect(CONFLICT_REFUSED_KINDS).toEqual([]);

    const source = readFileSync(join(__dirname, 'conflict-claim.definition.ts'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

    expect(code).not.toContain('ELECTION_RESULT');
    expect(code).not.toContain('DELIVERY_PERFORMANCE');
  });

  it('Conflict still cannot win a foreign kind — rule 2 does the work', () => {
    const registered = registry();
    registered.register(CONFLICT_CLAIM_DEFINITION);
    registered.register(fixture(ELECTION, [RESULT_DISPUTE]));

    const outcome = registered.resolve({ candidateKinds: [RESULT_DISPUTE] });

    expect(outcome.status).toBe('CLAIMED');
    expect(outcome.status === 'CLAIMED' && outcome.domainId).toBe(ELECTION);
  });
});

describe('the Election collision guard — §16 precedence, executed', () => {
  it('Conflict owns NEITHER contest NOR commitment', () => {
    /*
      The single silent way this registration can corrupt §16. If `contest` were
      added — for the plausible reason that conflict objects exist near elections —
      both domains would own it, rule 3 would narrow to two, and a question §16 says
      ELECTION wins would become EQUAL_CLAIM and fall back to Country Intelligence.
    */
    expect(CONFLICT_OWNED_OBJECT_TYPES).not.toContain('contest');
    expect(CONFLICT_OWNED_OBJECT_TYPES).not.toContain('commitment');
  });

  it('"Is the Nakuru result disputed, and is that dangerous?" splits on OBJECT', () => {
    const registered = registry();
    registered.register(CONFLICT_CLAIM_DEFINITION);
    registered.register(fixture(ELECTION, [RESULT_DISPUTE]));

    const both = [RESULT_DISPUTE, HOSTILITY_SEVERITY];

    const onContest = registered.resolve({ candidateKinds: both, objectType: 'contest' });
    expect(onContest.status).toBe('CLAIMED');
    expect(onContest.status === 'CLAIMED' && onContest.domainId).toBe(ELECTION);

    const onSituation = registered.resolve({ candidateKinds: both, objectType: 'situation' });
    expect(onSituation.status).toBe('CLAIMED');
    expect(onSituation.status === 'CLAIMED' && onSituation.domainId).toBe(CONFLICT_DOMAIN_ID);

    /* No object resolved: a genuine tie, never a guess — rule 6. */
    const noObject = registered.resolve({ candidateKinds: both });
    expect(noObject.status).toBe('EQUAL_CLAIM');
    expect(noObject.status === 'EQUAL_CLAIM' && noObject.domainIds).toEqual([
      CONFLICT_DOMAIN_ID,
      ELECTION,
    ]);
  });

  it('"Is there post-election violence in Kisumu?" is Conflict, with no tiebreak needed', () => {
    const registered = registry();
    registered.register(CONFLICT_CLAIM_DEFINITION);
    registered.register(fixture(ELECTION, [RESULT_DISPUTE]));

    const outcome = registered.resolve({ candidateKinds: [HOSTILITY_SEVERITY] });

    expect(outcome.status).toBe('CLAIMED');
    expect(outcome.status === 'CLAIMED' && outcome.domainId).toBe(CONFLICT_DOMAIN_ID);
    expect(outcome.status === 'CLAIMED' && outcome.landsOn).toEqual({
      railId: 'conflict-assessment',
      objectType: 'situation',
    });
  });
});

describe('authority and shape', () => {
  it('cites the R1 §16 hash, which the platform accepts', () => {
    expect(CONFLICT_CLAIM_DEFINITION.authoritySha256).toBe(R1_SHA);
    expect(ACCEPTED_SPECIALIST_DESIGN_AUTHORITIES[R1_SHA]).toBe(
      'Shared Specialist Addendum v1.0 R1',
    );
  });

  it('does NOT cite the superseded Addendum v1.0', () => {
    /*
      My accepted frontend package cites 71646a05… — superseded. P2's hash-keyed
      table caught it, which is what the table is for. This registration cites R1.
    */
    expect(SUPERSEDED_SPECIALIST_DESIGN_AUTHORITIES).not.toContain(
      CONFLICT_CLAIM_DEFINITION.authoritySha256,
    );
    expect(CONFLICT_CLAIM_DEFINITION.authoritySha256).not.toBe(
      '71646a05b4055ec547527b22cae68bd2ecc50d054370d0db91b3bd350fdd2ff5',
    );
  });

  it('the domain id and every kind are symbolic ids', () => {
    expect(SPECIALIST_SYMBOL_PATTERN.test(CONFLICT_DOMAIN_ID)).toBe(true);

    for (const kind of CONFLICT_CLAIMED_KINDS) {
      expect({ kind, symbolic: SPECIALIST_SYMBOL_PATTERN.test(kind) }).toEqual({
        kind,
        symbolic: true,
      });
    }
  });

  it('lands on the Conflict Assessment rail for the situation object', () => {
    expect(CONFLICT_CLAIM_DEFINITION.landsOn).toEqual({
      railId: 'conflict-assessment',
      objectType: 'situation',
    });
  });

  it('owns SEVEN object subtypes — Part V §14’s eight, less displacement', () => {
    /*
      R1. `displacement` was removed from this list because `ownsObjectTypes` is the
      rule 3 TIEBREAK INPUT and therefore participates in routing. See the
      displacement group below for the resolution this prevents.
    */
    expect(CONFLICT_OWNED_OBJECT_TYPES).toEqual([
      'situation',
      'incident',
      'front',
      'corridor',
      'exposure',
      'cessation',
      'spillover',
    ]);
    expect(CONFLICT_OWNED_OBJECT_TYPES).toHaveLength(7);
  });
});

describe('no recognizer, no keyword, no assessment logic, no data, no P3', () => {
  const sources = (): readonly { readonly name: string; readonly code: string }[] =>
    ['conflict-claim.definition.ts', 'conflict-claim.module.ts'].map((name) => ({
      name,
      code: readFileSync(join(__dirname, name), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/^\s*\/\/.*$/gm, ' '),
    }));

  it('nothing maps text to a kind', () => {
    for (const { name, code } of sources()) {
      expect({
        name,
        recognizer: /\b(match|test|includes|indexOf|toLowerCase|RegExp|keyword|intent)\s*\(/i.test(
          code,
        ),
      }).toEqual({ name, recognizer: false });
    }
  });

  it('nothing imports a provider, a model, or anything under P3', () => {
    for (const { name, code } of sources()) {
      expect({
        name,
        model: /\b(openai|anthropic|completion|prompt|inference)\b/i.test(code),
        p3: /claim-request/.test(code),
        analysis: /AnalysisService|analysis\.service/.test(code),
      }).toEqual({ name, model: false, p3: false, analysis: false });
    }
  });

  it('nothing resolves — registration is not routing', () => {
    for (const { name, code } of sources()) {
      expect({ name, resolves: /\.resolve\s*\(/.test(code) }).toEqual({ name, resolves: false });
    }
  });

  it('no conflict object, situation, incident or figure is defined', () => {
    for (const { name, code } of sources()) {
      /* Object TYPE NAMES are strings in a tiebreak list; object INSTANCES are data. */
      expect({
        name,
        data: /\b(severity|assessment|indicator|participant)s?\s*[:=]\s*[[{]/i.test(code),
      }).toEqual({ name, data: false });
    }
  });
});
