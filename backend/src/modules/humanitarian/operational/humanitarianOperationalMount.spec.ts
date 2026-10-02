import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Delete, Get, Module, Post } from '@nestjs/common';
import { AdminModule } from '../../admin/admin.module';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../../database/prisma.module';
import { HumanitarianOperationalController } from './humanitarian-operational.controller';
import { HumanitarianOperationalModule } from './humanitarian-operational.module';
import { HumanitarianOperationalService } from './humanitarian-operational.service';
import {
  OPERATIONAL_MOUNT_ALLOWED_IMPORTS,
  humanitarianOperationalImports,
  operationalMountDecision,
  operationalMountViolations,
} from './humanitarian-operational.mount';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE MOUNT CONDITION — PROVEN ON MODULES THAT GENUINELY VIOLATE IT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * HUMANITARIAN-F-OPS-R2. The contract permits the mount *only if* the module
 * cannot activate acquisition, which makes the check the deliverable rather than
 * the registration.
 *
 * A guard tested only against the module it already passes is the same mistake
 * this lane has already made once and recorded: `overrideProvider` on a guard
 * silently did nothing, and thirty tests passed while measuring nothing. So each
 * property below is asserted against a module BUILT TO BREAK IT — a module that
 * imports a data module, one with an extra provider, one with a POST, one that
 * exports its service — with the real module as the positive control every time.
 */

/* ── the counter-examples. Each breaks exactly one property. ───────────────── */

@Module({
  imports: [AuthModule, AdminModule, PrismaModule],
  controllers: [HumanitarianOperationalController],
  providers: [HumanitarianOperationalService],
})
class ImportsADataModule {}

class SomethingElse {}

@Module({
  imports: [AuthModule, AdminModule],
  controllers: [HumanitarianOperationalController],
  providers: [HumanitarianOperationalService, SomethingElse],
})
class HasASecondProvider {}

@Module({
  imports: [AuthModule, AdminModule],
  controllers: [HumanitarianOperationalController],
  providers: [HumanitarianOperationalService],
  exports: [HumanitarianOperationalService],
})
class ExportsItsService {}

@Controller('admin/humanitarian')
class ControllerWithAWriteVerb {
  @Get('status')
  status(): string {
    return 'ok';
  }

  @Post('activate')
  activate(): string {
    return 'activated';
  }

  @Delete('cache')
  clear(): string {
    return 'cleared';
  }
}

@Module({
  imports: [AuthModule, AdminModule],
  controllers: [ControllerWithAWriteVerb],
  providers: [HumanitarianOperationalService],
})
class HasAWriteRoute {}

/* ══════════════════════════════════════════════════════════════════════════ */

describe('THE REVIEWED MODULE SATISFIES THE CONDITION — and is therefore mounted', () => {
  it('no violations, and the decision carries no reason because there is none', () => {
    expect(operationalMountViolations()).toEqual([]);
    expect(operationalMountDecision()).toEqual({ mounted: true, refusedBecause: null });
  });

  it('the import allowlist is the guard chain and nothing else', () => {
    expect([...OPERATIONAL_MOUNT_ALLOWED_IMPORTS]).toEqual(['AuthModule', 'AdminModule']);
  });

  it('what AppModule spreads is exactly the one reviewed module', () => {
    expect(humanitarianOperationalImports()).toEqual([HumanitarianOperationalModule]);
  });
});

describe('A MODULE THAT COULD REACH ACQUISITION IS REFUSED — one counter-example each', () => {
  it('REFUSES a module that imports a data module', () => {
    const decision = operationalMountDecision(ImportsADataModule);
    expect(decision.mounted).toBe(false);
    expect(decision.refusedBecause).toContain('IMPORT_NOT_ALLOWED');
    expect(decision.refusedBecause).toContain('PrismaModule');
  });

  it('REFUSES a module with a second provider', () => {
    const decision = operationalMountDecision(HasASecondProvider);
    expect(decision.mounted).toBe(false);
    expect(decision.refusedBecause).toContain('PROVIDERS_NOT_THE_REVIEWED_ONE');
    expect(decision.refusedBecause).toContain('SomethingElse');
  });

  it('REFUSES a module that exports its service into someone else’s graph', () => {
    const decision = operationalMountDecision(ExportsItsService);
    expect(decision.mounted).toBe(false);
    expect(decision.refusedBecause).toContain('EXPORTS_NOT_EMPTY');
  });

  it('REFUSES a controller carrying a write verb, and names every one it found', () => {
    const violations = operationalMountViolations(HasAWriteRoute);
    const nonGet = violations.filter((v) => v.startsWith('NON_GET_ROUTE'));
    expect(nonGet).toHaveLength(2);
    expect(nonGet.join(' ')).toContain('activate');
    expect(nonGet.join(' ')).toContain('POST');
    expect(nonGet.join(' ')).toContain('clear');
    expect(nonGet.join(' ')).toContain('DELETE');
    /* and the GET on the same controller is NOT reported — the check is about verbs, not routes */
    expect(nonGet.join(' ')).not.toContain('status');
  });

  it('A REFUSED MODULE IS NOT MOUNTED AT ALL — not mounted-and-inert', () => {
    /*
      The failure this returns [] to avoid: a module present in the graph "still
      looks registered to anyone reading it, and is the thing somebody later
      fixes by giving it a default store" — the humanitarian registration file's
      own words about the empty-array technique.
    */
    for (const broken of [
      ImportsADataModule,
      HasASecondProvider,
      ExportsItsService,
      HasAWriteRoute,
    ])
      expect(operationalMountDecision(broken).mounted).toBe(false);
  });

  it('a refusal always carries a reason, and a mount never does', () => {
    for (const broken of [
      ImportsADataModule,
      HasASecondProvider,
      ExportsItsService,
      HasAWriteRoute,
    ]) {
      const reason = operationalMountDecision(broken).refusedBecause;
      expect(typeof reason).toBe('string');
      expect((reason as string).length).toBeGreaterThan(40);
    }
    expect(operationalMountDecision().refusedBecause).toBeNull();
  });

  it('a class with no module metadata at all is refused, not defaulted', () => {
    expect(operationalMountDecision(class NotAModule {}).mounted).toBe(false);
  });
});

describe('THE MOUNT IS NOT AN ACTIVATION CONTROL', () => {
  const source = (): string =>
    readFileSync(join(__dirname, 'humanitarian-operational.mount.ts'), 'utf8');

  it('it reads no environment variable and no switch — the decision is a property of the code', () => {
    const body = source()
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(body).not.toMatch(/process\.env/);
    expect(body).not.toMatch(/OperationalSwitch|ConfigService|getOrThrow/);
    /* positive control: the stripper did not simply blank the file */
    expect(body).toContain('operationalMountViolations');
  });

  it('it cannot change a verdict: it names no source and no verdict', () => {
    const body = source().replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body).not.toMatch(/GDACS|RELIEFWEB|COPERNICUS|CLEARED_FOR/);
  });
});
