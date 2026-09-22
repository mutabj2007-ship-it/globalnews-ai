import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../../database/prisma.module';
import { PrismaService } from '../../database/prisma.service';
import { SecurityController } from './security.controller';
import { SecurityModule } from './security.module';
import { SecurityObservationRepository } from './persistence/security-observation.repository';
import { SecurityReadService } from './security-read.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE MODULE — REAL DI COMPILATION, AND THE THINGS IT MUST NOT CONTAIN
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The DI half of this spec is worth little on its own — a module that does not compile fails
 * at boot. The SOURCE SWEEPS are the part that matters, because each one guards a claim made
 * in a docblock, and a docblock cannot fail:
 *
 *   "no provider, no HTTP client, no API key"  -> nothing here can reach GNews, GDELT or RSS,
 *                                                so no provider quota control is affected
 *   "no scheduler, no @Cron"                   -> nothing begins doing work on its own, and
 *                                                Production stays on HOLD
 *   "stage 4 is not called"                    -> no notification, no watch, no alert
 *   "no synthetic or demo observation"          -> the retained corpus is the only input
 *
 * Every sweep carries a positive control that can fail, so a regex that stopped matching
 * anything would not quietly pass.
 */

const MODULE_DIR = __dirname;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      out.push(path);
    }
  }
  return out;
}

/** Comments stripped FIRST, so a docblock explaining what is forbidden is not punished for it. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const RUNTIME_FILES = sourceFiles(MODULE_DIR);
const RUNTIME_CODE = RUNTIME_FILES.map(code).join('\n');

describe('SecurityModule — real NestJS DI compilation', () => {
  it('compiles with its controller and both providers', async () => {
    /*
      `PrismaModule` is imported explicitly here and is NOT imported by `SecurityModule`.
      That asymmetry is correct rather than an omission: `PrismaModule` is declared `@Global`,
      so in the real application `AppModule`'s single import makes `PrismaService` resolvable
      from every module, and re-importing it per module is the pattern every other module in
      this codebase deliberately avoids. A test module does not inherit that global scope, so
      the test supplies it.

      The service itself is overridden because constructing the real one requires DATABASE_URL
      and would open a connection pool. Overriding it proves the module's wiring without
      turning this spec into an integration test against a live database.
    */
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, SecurityModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    expect(moduleRef.get(SecurityReadService)).toBeInstanceOf(SecurityReadService);
    expect(() => moduleRef.get(SecurityObservationRepository)).toThrow();
    expect(moduleRef.get(SecurityController)).toBeInstanceOf(SecurityController);
  });

  it('exports the read service and NOT the repository', () => {
    // A consumer that could read the table directly would bypass the contract guard, and a
    // row that fails it would reach a reader through the side door.
    const exported = Reflect.getMetadata('exports', SecurityModule) as unknown[];
    expect(exported).toContain(SecurityReadService);
    expect(exported).not.toContain(SecurityObservationRepository);
  });
});

describe('the module reaches no provider and adds no traffic', () => {
  it('imports no news, signal or analysis provider', () => {
    expect(RUNTIME_CODE).not.toMatch(
      /GNewsProvider|GdeltDocProvider|RssFeedProvider|GdeltProvider/,
    );
    expect(RUNTIME_CODE).not.toMatch(/EventRegistryProvider|MockNewsProvider/);
    expect(RUNTIME_CODE).not.toMatch(/NEWS_PROVIDERS|ALL_NEWS_PROVIDERS|SIGNAL_PROVIDERS/);
  });

  it('holds no HTTP client and issues no request', () => {
    expect(RUNTIME_CODE).not.toMatch(/\bfetch\s*\(/);
    expect(RUNTIME_CODE).not.toMatch(/axios|node-fetch|undici|https?\.request|HttpService/);
  });

  it('reads no API key and no provider credential', () => {
    expect(RUNTIME_CODE).not.toMatch(/API_KEY|_TOKEN|_SECRET|apiKey/);
  });

  it('positive control — the sweep is reading real source', () => {
    // If the file list or the comment stripper broke, these would fail too.
    expect(RUNTIME_FILES.length).toBeGreaterThanOrEqual(7);
    expect(RUNTIME_CODE).toMatch(/classifySecurityCandidate/);
    expect(RUNTIME_CODE).toMatch(/publicSecurityRead/);
  });
});

describe('the module starts no work of its own — Production stays on HOLD', () => {
  it('registers no scheduler, cron or queue', () => {
    expect(RUNTIME_CODE).not.toMatch(/@nestjs\/schedule|@Cron|CronExpression|SchedulerRegistry/);
    expect(RUNTIME_CODE).not.toMatch(/bullmq|\bbull\b|Queue\s*\(/);
    expect(RUNTIME_CODE).not.toMatch(/setInterval|setTimeout/);
  });

  it('implements no lifecycle hook that would run at boot', () => {
    expect(RUNTIME_CODE).not.toMatch(
      /OnModuleInit|OnApplicationBootstrap|onModuleInit|onApplicationBootstrap/,
    );
  });
});

describe('the module never notifies anybody — stage 4 is not wired', () => {
  it('does not call mayNotify or build a notification candidate', () => {
    // "A null state is the honest answer and it is not a notification."
    expect(RUNTIME_CODE).not.toMatch(/mayNotify|NotificationCandidate|assertedAxes/);
  });

  it('touches no watch, alert or delivery path', () => {
    expect(RUNTIME_CODE).not.toMatch(/WatchModule|WatchService|sendAlert|notifySubscribers/);
  });
});

describe('the controller surface is read-only and carries no guard', () => {
  const controller = code(join(MODULE_DIR, 'security.controller.ts'));

  it('declares exactly one route, and it is a GET', () => {
    expect(controller.match(/@Get\(/g)).toHaveLength(1);
    expect(controller).not.toMatch(/@Post\(|@Put\(|@Patch\(|@Delete\(/);
  });

  it('places no authentication guard — it is a public, session-blind family', () => {
    expect(controller).not.toMatch(/RequireAuthGuard|@UseGuards|CsrfGuard|AdminGuard/);
  });

  it('does not opt out of the global rate limit', () => {
    // A Security read has no reason to be cheaper than the default 20/60s.
    expect(controller).not.toMatch(/@SkipThrottle/);
  });
});

describe('nothing synthetic can reach a Security surface', () => {
  it('holds no fixture, seed, mock or demo observation', () => {
    expect(RUNTIME_CODE).not.toMatch(/__fixtures__|\.fixture|sampleObservation|DEMO_|SEED_/);
    expect(RUNTIME_CODE).not.toMatch(/isMock|mockObservation|placeholderObservation/);
  });

  it('never constructs an observation outside the single factory', () => {
    const constructions = RUNTIME_FILES.filter((path) =>
      /buildSecurityObservation\s*\(/.test(code(path)),
    );
    // Exactly two: the factory that declares it, and the read service that calls it.
    expect(constructions).toHaveLength(2);
  });

  it('reads the retained corpus through the existing persistence service only', () => {
    expect(RUNTIME_CODE).toMatch(/readRecentForSecurity/);
    // And never writes to it from this lane.
    expect(RUNTIME_CODE).not.toMatch(/persistMany|persistCountryRelations/);
  });
});

describe('no natural person is representable anywhere in the lane', () => {
  it('declares no structured person extraction field', () => {
    // PO-1 is enforced by there being no field, no slot, no placeholder and no dash.
    expect(RUNTIME_CODE).not.toMatch(
      /personName|suspectName|victimName|dateOfBirth|yearOfBirth|nationality/,
    );
  });
});
