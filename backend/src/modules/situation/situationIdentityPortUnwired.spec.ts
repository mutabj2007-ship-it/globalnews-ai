import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { Global, Module } from '@nestjs/common';

import { SituationModule } from './situation.module';
import { SituationService } from './situation.service';
import { SITUATION_IDENTITY_CONTRACT } from './situation-identity.contract';
import {
  SITUATION_IDENTITY_PORT,
  UNWIRED_SITUATION_IDENTITY_PORT,
  SituationIdentityPortNotWiredError,
} from './situation-identity.port';
import { PrismaService } from '../../database/prisma.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SITUATION_IDENTITY_PORT = UNWIRED — PINNED, NOT REMEMBERED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MAIN-SITUATION-IDENTITY-PORT-CLOSEOUT-R1. The Product Owner / CTO ruling:
 * "SITUATION IDENTITY PORT REMAINS UNWIRED. The Conflict presentation bind does
 * not authorize identity-port activation."
 *
 * WHY THIS FILE EXISTS. The binding drifted once already: `situation.module.ts`
 * bound the real adapter while three other accepted files went on describing the
 * port as unwired, and nothing failed — the contradiction lived in comments and
 * the bytes were never asked. A comment cannot notice a rebind. This can.
 *
 * ── IT GUARDS BOTH FAILURE MODES, NOT ONE ─────────────────────────────────
 *
 * "The port is not wired" is satisfiable by DELETING the contract, which would
 * be a different and worse outcome. So this asserts two things at once: the
 * resolved value is the unwired default, AND the accepted contract is still
 * present and still works. Neither assertion can be made true by breaking the
 * other.
 */

/* `PrismaModule` is @Global() in the application; this reproduces that
   arrangement so the module resolves exactly as it does under AppModule. */
@Global()
@Module({ providers: [{ provide: PrismaService, useValue: prismaDouble() }], exports: [PrismaService] })
class PrismaHarnessModule {}

function prismaDouble(): unknown {
  const unreachable = (): never => {
    throw new Error('No database is reachable from this spec, and none is needed.');
  };
  const delegate = (methods: readonly string[]): Record<string, unknown> =>
    Object.fromEntries(methods.map((m) => [m, unreachable]));

  return {
    $transaction: unreachable,
    situation: delegate(['findUnique', 'findMany', 'create', 'update']),
    situationSnapshot: delegate(['findFirst', 'create']),
    situationCluster: delegate(['create']),
    situationClusterMember: delegate(['createMany']),
    situationShadowDecision: delegate(['create']),
  };
}

describe('SITUATION_IDENTITY_PORT = UNWIRED', () => {
  it('the module registers the UNWIRED default, and not the contract', () => {
    const providers = (Reflect.getMetadata('providers', SituationModule) ?? []) as Array<
      Record<string, unknown>
    >;

    /* POSITIVE CONTROL: without this the find below passes vacuously the day the
       provider list is renamed or emptied. */
    expect(providers.length).toBeGreaterThan(3);

    const entry = providers.find((p) => p && p.provide === SITUATION_IDENTITY_PORT);

    expect(entry).toBeDefined();
    expect(entry?.useValue).toBe(UNWIRED_SITUATION_IDENTITY_PORT);
    expect(entry?.useValue).not.toBe(SITUATION_IDENTITY_CONTRACT);
  });

  it('a real injector resolves it, and the service reports itself unwired', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaHarnessModule, SituationModule],
    }).compile();

    const service = moduleRef.get(SituationService);

    /*
      The service's OWN self-report, not an inspection of the module. This is the
      value a future reader will trust, so it is the value pinned.
    */
    expect(service.writePathStatus()).toEqual({
      identityPortWired: false,
      keyVersion: 'UNWIRED',
      policyId: 'UNWIRED',
      tier2: 'SHADOW_ONLY',
    });

    await moduleRef.close();
  });

  it('the resolved port derives nothing — both methods throw the stated error', () => {
    expect(() => UNWIRED_SITUATION_IDENTITY_PORT.derivePartitionKey({} as never)).toThrow(
      SituationIdentityPortNotWiredError,
    );
    expect(() => UNWIRED_SITUATION_IDENTITY_PORT.decideAttachment({} as never, [])).toThrow(
      SituationIdentityPortNotWiredError,
    );
  });

  /*
    THE OTHER HALF OF THE GUARD. Deleting `situation-identity.contract.ts` would
    make every assertion above pass, and would destroy an accepted package. The
    contract is UNBOUND, not absent, and this is the assertion that tells the
    two apart.
  */
  it('the accepted identity contract is still present and still works — unbound, not deleted', () => {
    const contract = readFileSync(join(__dirname, 'situation-identity.contract.ts'), 'utf8');

    expect(contract.length).toBeGreaterThan(0);
    expect(SITUATION_IDENTITY_CONTRACT).toBeDefined();
    expect(SITUATION_IDENTITY_CONTRACT.derivePartitionKey({ countryCode: 'RW' } as never)).toBe(
      'sit:v1:RWA',
    );
  });

  it('no controller is declared here, so no route can reach any of it', () => {
    const source = readFileSync(join(__dirname, 'situation.module.ts'), 'utf8');

    expect(source).not.toMatch(/controllers\s*:/);
  });
});
