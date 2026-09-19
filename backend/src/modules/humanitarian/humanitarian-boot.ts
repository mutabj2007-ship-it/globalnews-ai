import {
  Inject,
  Injectable,
  Module,
  type DynamicModule,
  type OnModuleInit,
  type Provider,
} from '@nestjs/common';

import type { GeometryDenotation, SourceGeometryKind } from '@globalnews-ai/shared';

import {
  loadHumanitarianAuthority,
  type AuthorityLoadReport,
  type GovernedAuthorityStore,
} from './humanitarian-authority.loader';
import {
  COPERNICUS_DENOTATION,
  COPERNICUS_DOMAIN_ID,
  COPERNICUS_EMITS,
  COPERNICUS_PRODUCER_ENABLED,
  COPERNICUS_RIGHTS,
  COPERNICUS_SOURCE_ID,
  HUMANITARIAN_PRODUCER_ACTIVATION,
} from './producers/copernicus-ems.producer';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HUMANITARIAN BOOT CONVERGENCE — CAPABILITY UP, ACQUISITION DOWN
 * ════════════════════════════════════════════════════════════════════════════
 *
 * G-HUMANITARIAN-COPERNICUS-PRODUCER-R1-2 · E1 item 2.
 *
 *     "It must be possible to initialize the producer capability and authority checks
 *      at boot while provider acquisition remains disabled."
 *
 * ── WHAT CLAUDE CODE WIRES ────────────────────────────────────────────────
 *
 *   • FUNCTION : `bootHumanitarian(store, { epoch, loadedAt })`
 *   • PROVIDER : `HumanitarianAuthorityBootstrap` (implements `OnModuleInit`)
 *   • MODULE   : `HumanitarianModule.forRoot({ store, options })`, imported by
 *                `AppModule`
 *
 * `store` is a Nest provider for the token `HUMANITARIAN_AUTHORITY_STORE`, bound to the
 * real governed-rows reader. This lane does not supply one: reading the authority store
 * needs a credential this lane has no authority to hand out, and a default store is how
 * a boot path ends up reading something nobody chose.
 *
 * ── AND WHY THERE IS NO FLAG ──────────────────────────────────────────────
 *
 * E1: *"Do not add an environment flag that turns provider execution on."* There is no
 * environment read in this file, and a test asserts it. Acquisition is off because the
 * producer HAS no acquisition — no transport, no schedule, no client — and boot merely
 * declines to invent one. The capability that goes up is a DESCRIPTION: which geometry
 * kinds the producer would emit, under which denotation, under which rights state. A
 * registry can answer "what would this produce" without anything producing it.
 *
 * ── FAIL CLOSED, AND EARLY ────────────────────────────────────────────────
 *
 * `assertAcquisitionIsStillOff` runs BEFORE the authority is loaded. If somebody flips
 * `COPERNICUS_PRODUCER_ENABLED` while E1's ruling still reads NOT_CLEARED, the process
 * refuses to start — and in fact refuses to COMPILE, because both constants are literal
 * types and the comparison stops overlapping. A guard that fails at build time is a
 * guard that never had to fire in production.
 */

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · THE CAPABILITY — A DESCRIPTION, NOT A CLIENT
 * ══════════════════════════════════════════════════════════════════════════ */

export interface HumanitarianProducerCapability {
  readonly producerId: string;
  readonly sourceId: string;
  readonly domainId: string;
  /** The geometry kinds this producer emits. Anything else is withheld, never coerced. */
  readonly emits: readonly SourceGeometryKind[];
  readonly denotation: GeometryDenotation;
  readonly rightsClass: string;
  /** E1's ruling, carried rather than re-stated. */
  readonly activation: string;
  /**
   * LITERAL `false`, not `boolean`. A boolean is a value somebody sets; a literal type
   * is a value somebody has to change the source to set, in a file that is reviewed.
   */
  readonly acquisitionEnabled: false;
}

export const COPERNICUS_CAPABILITY: HumanitarianProducerCapability = Object.freeze({
  producerId: 'COPERNICUS_EMS_INUNDATION_EXTENT',
  sourceId: COPERNICUS_SOURCE_ID,
  domainId: COPERNICUS_DOMAIN_ID,
  emits: COPERNICUS_EMITS,
  denotation: COPERNICUS_DENOTATION,
  rightsClass: COPERNICUS_RIGHTS.rightsClass,
  activation: HUMANITARIAN_PRODUCER_ACTIVATION,
  acquisitionEnabled: false,
});

/** Every Humanitarian producer this lane registers. One, deliberately. */
export const HUMANITARIAN_PRODUCER_CAPABILITIES: readonly HumanitarianProducerCapability[] =
  Object.freeze([COPERNICUS_CAPABILITY]);

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · BOOT
 * ══════════════════════════════════════════════════════════════════════════ */

export class HumanitarianBootFailure extends Error {}

export interface HumanitarianBootReport {
  /** The GA-33 load report, from the real composition root. */
  readonly authority: AuthorityLoadReport;
  readonly capabilities: readonly HumanitarianProducerCapability[];
  readonly acquisitionEnabled: false;
  readonly activationCleared: false;
}

/**
 * The one condition boot refuses to start under: a producer switched on while E1's
 * activation ruling still says it is not cleared.
 */
export function assertAcquisitionIsStillOff(): void {
  if (HUMANITARIAN_PRODUCER_ACTIVATION !== 'NOT_CLEARED') {
    throw new HumanitarianBootFailure(
      'HUMANITARIAN_ACTIVATION_CHANGED_WITHOUT_BOOT_REVIEW: the activation constant no longer ' +
        "reads NOT_CLEARED. E1's re-review is what changes it, and this boot path is part of " +
        'what E1 re-reviews.',
    );
  }
  if (COPERNICUS_PRODUCER_ENABLED !== false) {
    throw new HumanitarianBootFailure(
      'HUMANITARIAN_PRODUCER_ENABLED_WHILE_NOT_CLEARED: a producer was switched on while ' +
        'activation is NOT_CLEARED. Boot refuses rather than registering it.',
    );
  }
  for (const capability of HUMANITARIAN_PRODUCER_CAPABILITIES) {
    if (capability.acquisitionEnabled !== false) {
      throw new HumanitarianBootFailure(
        `HUMANITARIAN_CAPABILITY_ACQUISITION_ENABLED: '${capability.producerId}'. A registered ` +
          'capability is a description of what a producer would emit, never permission to fetch.',
      );
    }
  }
}

/**
 * THE STARTUP ENTRY POINT.
 *
 * Order matters and is the point of R1.2: the acquisition guard first, so a misconfigured
 * process never reaches the authority store; then the real composition root, which
 * validates the governed rows BEFORE installing anything.
 */
export async function bootHumanitarian(
  store: GovernedAuthorityStore,
  input: { readonly epoch: number; readonly loadedAt: string },
): Promise<HumanitarianBootReport> {
  assertAcquisitionIsStillOff();

  const { report } = await loadHumanitarianAuthority(store, input);

  return Object.freeze({
    authority: report,
    capabilities: HUMANITARIAN_PRODUCER_CAPABILITIES,
    acquisitionEnabled: false,
    activationCleared: false,
  });
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · THE NEST SURFACE
 * ══════════════════════════════════════════════════════════════════════════ */

/** Bind this token to the real governed-rows reader. This lane supplies no default. */
export const HUMANITARIAN_AUTHORITY_STORE = 'HUMANITARIAN_AUTHORITY_STORE';
export const HUMANITARIAN_BOOT_OPTIONS = 'HUMANITARIAN_BOOT_OPTIONS';

export interface HumanitarianBootOptions {
  /** Monotonic across loads. AS-5. */
  readonly epoch: number;
  /** ISO-8601, when the platform loaded it — not when a reader asked. */
  readonly loadedAt: string;
}

@Injectable()
export class HumanitarianAuthorityBootstrap implements OnModuleInit {
  private report: HumanitarianBootReport | undefined;

  constructor(
    @Inject(HUMANITARIAN_AUTHORITY_STORE) private readonly store: GovernedAuthorityStore,
    @Inject(HUMANITARIAN_BOOT_OPTIONS) private readonly options: HumanitarianBootOptions,
  ) {}

  async onModuleInit(): Promise<void> {
    this.report = await bootHumanitarian(this.store, this.options);
  }

  /**
   * The boot report, for a health surface or an admin read.
   *
   * It THROWS when boot has not run. There is no "not yet booted" report, because an
   * empty report is indistinguishable from a successful boot of nothing — the same
   * shape of mistake GA-44 refuses at the authority.
   */
  bootReport(): HumanitarianBootReport {
    if (this.report === undefined) {
      throw new HumanitarianBootFailure(
        'HUMANITARIAN_NOT_BOOTED: the Humanitarian authority has not been loaded in this process.',
      );
    }
    return this.report;
  }
}

/**
 * The module `AppModule` imports.
 *
 *     HumanitarianModule.forRoot({
 *       store: { provide: HUMANITARIAN_AUTHORITY_STORE, useClass: PostgresGovernedAuthorityStore },
 *       options: { epoch: 1, loadedAt: new Date().toISOString() },
 *     })
 *
 * It registers NO controller and NO route. Importing it buys the authority load and the
 * capability registry, and buys nothing that can reach a publisher.
 */
@Module({})
export class HumanitarianModule {
  static forRoot(input: {
    readonly store: Provider;
    readonly options: HumanitarianBootOptions;
  }): DynamicModule {
    return {
      module: HumanitarianModule,
      providers: [
        input.store,
        { provide: HUMANITARIAN_BOOT_OPTIONS, useValue: input.options },
        HumanitarianAuthorityBootstrap,
      ],
      exports: [HumanitarianAuthorityBootstrap],
    };
  }
}
