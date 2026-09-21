import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../database/prisma.module';
import { PrismaService } from '../database/prisma.service';
import { ComputeModule } from './compute/compute.module';
import { AskModule } from './ask/ask.module';
import { BetaModule } from './beta/beta.module';
import { AskService } from './ask/ask.service';
import { BetaCategoryService } from './beta/category/beta-category.service';
import { ComputeQuoteService } from './compute/quote/compute-quote.service';
import { BetaFeatureFlagsService } from './compute/flags/beta-feature-flags.service';
import { FakePrisma } from './compute/testing/fake-prisma.testing';

/**
 * BETA-SIMPLE-ASK-SAND-1 — module wiring.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE SERVICE TESTS.
 *
 * Every other spec in this tranche builds its subject with a manual
 * `providers: [...]` list, which proves the SERVICE works but proves
 * nothing about whether the real MODULE can be constructed. Those are
 * genuinely different failures, and this repository has already been
 * bitten by exactly the difference: SignalsModule (M64.3) passed its
 * service tests while being unable to resolve ConfigService in a
 * standalone testing module, because it relied on AppModule's
 * `isGlobal: true` rather than declaring its own dependency. The
 * module's own doc comment records that repair.
 *
 * These tests compile the REAL modules, so a missing import, a
 * missing export, or a provider that cannot be resolved fails here
 * rather than at application boot.
 *
 * ON PRISMA: these modules obtain PrismaService from the @Global
 * PrismaModule rather than importing it, which is this repository's
 * existing pattern — HistoryModule and AuthModule do exactly the same
 * (verified against their module definitions). So the test supplies
 * that global registration itself, with the real PrismaService
 * overridden: instantiating the real one requires DATABASE_URL and
 * opens a database connection, and a unit test must do neither.
 * overrideProvider replaces the definition before instantiation, so
 * the real constructor never runs.
 *
 * ConfigModule is imported bare (not .forRoot), and that IS the
 * point: if any of these modules secretly depended on the root's
 * isGlobal registration, this would fail — which is precisely the
 * M64.3 failure described above.
 */

async function compile(
  module: unknown,
  prisma: FakePrisma = new FakePrisma(),
  /**
   * See the AskModule block below. Bare ConfigModule is the strict
   * form and is used everywhere it can be; AskModule needs the
   * global form for a reason that is not its own.
   */
  globalConfig = false,
) {
  return Test.createTestingModule({
    imports: [
      globalConfig ? ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }) : ConfigModule,
      PrismaModule,
      module as never,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();
}

describe('ComputeModule', () => {
  it('compiles standalone, without relying on a global ConfigService', async () => {
    const moduleRef = await compile(ComputeModule);
    expect(moduleRef.get(ComputeQuoteService)).toBeInstanceOf(ComputeQuoteService);
  });

  it('registers no controller, so no compute route is reachable from the network', () => {
    // §9's flow never has the client call a quote endpoint directly —
    // the quote arrives attached to the Ask turn that triggered it. A
    // public /compute/quote would let a caller enumerate pricing and
    // mint operation rows without intending to run anything.
    const controllers: unknown[] = Reflect.getMetadata('controllers', ComputeModule) ?? [];
    expect(controllers).toHaveLength(0);
  });

  it('resolves every §10 flag to false for an unconfigured deployment', async () => {
    const moduleRef = await compile(ComputeModule);
    const flags = moduleRef.get(BetaFeatureFlagsService).get();

    // The baseline guarantee: adding these modules to an existing
    // deployment changes nothing until flags are deliberately set.
    expect(Object.values(flags).every((value) => value === false)).toBe(true);
  });

  it('constructs without making a database query or a provider call', async () => {
    const prisma = new FakePrisma();
    const moduleRef = await compile(ComputeModule, prisma);

    await moduleRef.init();

    expect(prisma.computeOperation.rows).toHaveLength(0);
    expect(prisma.storedResult.rows).toHaveLength(0);
    expect(prisma.sandLedgerEntry.rows).toHaveLength(0);

    await moduleRef.close();
  });
});

describe('AskModule', () => {
  /**
   * PRE-EXISTING FINDING, NOT A DEFECT IN THIS TRANCHE — and the
   * reason this one module is compiled with the global ConfigModule
   * form while ComputeModule and BetaModule are not.
   *
   * AskModule imports AnalysisModule (for AnalysisService), which
   * imports NewsModule. NewsModule declares no `imports: [ConfigModule]`
   * of its own, yet GNewsProvider injects ConfigService — so NewsModule
   * resolves only because AppModule happens to call
   * `.forRoot({ isGlobal: true })`. Compiling it with bare
   * ConfigModule fails with:
   *
   *   Nest can't resolve dependencies of the GNewsProvider (?).
   *   Please make sure that the argument ConfigService at index [0]
   *   is available in the NewsModule context.
   *
   * This is exactly the defect the CTO repaired for SignalsModule in
   * M64.3; NewsModule was never given the same treatment. It is
   * harmless in the running application (isGlobal really does make
   * ConfigService available app-wide) and shows up only in a
   * standalone testing module.
   *
   * IT IS DELIBERATELY NOT FIXED HERE. §25 says to consume existing
   * retrieval contracts rather than redesign them, and to document a
   * defect this work reveals rather than silently rewriting provider
   * architecture owned by another workstream. news.module.ts is also
   * among the 97 files the other CTO's M64 lane currently has dirty,
   * so editing it would be a direct collision. Recorded in the R1
   * report under "provider findings" for Main to schedule.
   *
   * The one-line fix, when someone owns it: add
   * `imports: [ConfigModule]` (bare) to NewsModule, exactly as
   * SignalsModule now does.
   */
  it('compiles with the application’s own ConfigModule wiring', async () => {
    // This is the test that would catch AnalysisModule or AuthModule
    // failing to export what AskModule needs.
    const moduleRef = await compile(AskModule, new FakePrisma(), true);
    expect(moduleRef.get(AskService)).toBeInstanceOf(AskService);
  });

  it('documents the pre-existing NewsModule ConfigModule gap it inherits', async () => {
    // Pinned as a test so the finding cannot be quietly forgotten: if
    // someone repairs NewsModule, this fails and the note above (and
    // the R1 report entry) should be removed with it.
    await expect(compile(AskModule, new FakePrisma(), false)).rejects.toThrow(/ConfigService/);
  });

  it('exposes the conversational Ask controller', () => {
    const controllers: unknown[] = Reflect.getMetadata('controllers', AskModule) ?? [];
    expect(controllers).toHaveLength(1);
  });
});

describe('BetaModule', () => {
  it('compiles standalone', async () => {
    const moduleRef = await compile(BetaModule);
    expect(moduleRef.get(BetaCategoryService)).toBeInstanceOf(BetaCategoryService);
  });

  it('§16 — imports nothing that could run a provider or a model call', () => {
    // The structural guarantee, asserted against the real module
    // metadata: a category click cannot trigger expensive synthesis
    // because there is no module here through which it could.
    const imports: unknown[] = Reflect.getMetadata('imports', BetaModule) ?? [];
    expect(imports).toHaveLength(0);
  });

  it('§16 — needs no database writes to serve a category view', async () => {
    const prisma = new FakePrisma();
    const moduleRef = await compile(BetaModule, prisma);

    await moduleRef.get(BetaCategoryService).getCategoryView('energy');

    // A read-only public surface must not write anything — no
    // operation row, no ledger entry, nothing.
    expect(prisma.computeOperation.rows).toHaveLength(0);
    expect(prisma.sandLedgerEntry.rows).toHaveLength(0);
    expect(prisma.storedResult.rows).toHaveLength(0);

    await moduleRef.close();
  });
});
