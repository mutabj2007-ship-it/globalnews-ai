import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { SpecialistClaimRegistry } from './specialist-claim.registry';
import { ConflictClaimModule } from '../conflict-claim/conflict-claim.module';

/**
 * RUNTIME PROOF FOR PO RULING 3 — "After integration require
 * registeredDomains() includes the accepted Conflict specialist domain.
 * Runtime proof required."
 *
 * The proof is in two halves, and they are different KINDS of claim, so they
 * are asserted differently rather than blurred into one.
 *
 *   1. RUNTIME — initialising the module really does register the domain. This
 *      boots a Nest testing module and reads the registry instance. It needs no
 *      database, because ConflictClaimModule touches none.
 *
 *   2. REACHABILITY — this candidate's own AppModule imports that module, so
 *      the registration happens on the application's real startup path. That is
 *      a fact about a file, and it is asserted against the file.
 *
 * WHY NOT SIMPLY BOOT AppModule AND ASSERT BOTH AT ONCE. AppModule pulls in
 * PrismaModule, whose `onModuleInit` calls `$connect()`, so booting it requires
 * a reachable Postgres. There is none on this validation host, and a proof that
 * cannot run is not a proof. Splitting it keeps every half executable here.
 *
 * The empty-registry assertion below is the control: it establishes that
 * CONFLICT is absent before initialisation, so the second assertion cannot pass
 * vacuously on a registry that was pre-populated by an import side effect.
 */
describe('specialist claim boundary — Conflict is registered, and reachable from AppModule', () => {
  it('initialising ConflictClaimModule registers the CONFLICT domain', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ConflictClaimModule] }).compile();

    const registry = moduleRef.get(SpecialistClaimRegistry);
    expect(registry.registeredDomains()).toEqual([]);

    await moduleRef.init();

    expect(registry.registeredDomains()).toContain('CONFLICT');
    expect(registry.canonicalKinds().length).toBeGreaterThan(0);

    await moduleRef.close();
  });

  it('AppModule imports ConflictClaimModule, so that registration is on the startup path', () => {
    /*
      This is the half that had regressed. The module existed on canonical and
      was mounted there; on this lineage it was absent, so `registeredDomains()`
      returned [] at runtime and Conflict was de-registered in everything but
      name. Asserting the import means a future removal fails here rather than
      silently emptying the register again.
    */
    const appModule = readFileSync(join(__dirname, '../../app.module.ts'), 'utf8');

    expect(appModule).toMatch(/import \{ ConflictClaimModule \} from '\.\/modules\/conflict-claim\/conflict-claim\.module';/);
    const imports = appModule.slice(appModule.indexOf('imports: ['), appModule.indexOf('controllers:'));
    expect(imports).toMatch(/\bConflictClaimModule,/);
  });
});
