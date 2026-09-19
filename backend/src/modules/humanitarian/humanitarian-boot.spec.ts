import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  ProtectedClassDeclaration,
  ProtectedPartitionDeclaration,
} from '@globalnews-ai/shared';

import {
  AuthorityLoadFailure,
  __resetHumanitarianAuthorityForTests,
  computeGovernedDigest,
  humanitarianProtectionAuthority,
  loadHumanitarianAuthority,
  type GovernedAuthorityRows,
  type GovernedAuthorityStore,
} from './humanitarian-authority.loader';
import {
  COPERNICUS_CAPABILITY,
  HUMANITARIAN_AUTHORITY_STORE,
  HUMANITARIAN_BOOT_OPTIONS,
  HUMANITARIAN_PRODUCER_CAPABILITIES,
  HumanitarianAuthorityBootstrap,
  HumanitarianBootFailure,
  HumanitarianModule,
  assertAcquisitionIsStillOff,
  bootHumanitarian,
} from './humanitarian-boot';
import {
  PROTECTION_OWNED_FIELDS,
  ProtectionOwnedFieldPresent,
  assertNoProtectionOwnedFields,
  prepareSourceEvidence,
} from './humanitarian-intake.port';
import {
  COPERNICUS_DENOTATION,
  COPERNICUS_SOURCE_ID,
  produceInundationExtents,
  type GovernedRecordKeying,
} from './producers/copernicus-ems.producer';

/* ── harness ──────────────────────────────────────────────────────────────── */

const HERE = __dirname;
const ROOT_SOURCE = readFileSync(join(HERE, 'humanitarian-authority.loader.ts'), 'utf-8');
const BOOT_SOURCE = readFileSync(join(HERE, 'humanitarian-boot.ts'), 'utf-8');
const INTAKE_SOURCE = readFileSync(join(HERE, 'humanitarian-intake.port.ts'), 'utf-8');
const PRODUCER_SOURCE = readFileSync(
  join(HERE, 'producers', 'copernicus-ems.producer.ts'),
  'utf-8',
);

/** Comments removed, strings kept — a scan for a literal cannot run over blanked strings. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'))
    .join('\n');
}

const CLASS_ROW: ProtectedClassDeclaration = {
  classId: 'CLASS-P',
  declaredAt: '2026-01-01T00:00:00Z',
  basis: 'synthetic declaration for a boot-convergence proof',
  partitionUnitLevel: 'DISTRICT',
};

const PARTITION_ROW: ProtectedPartitionDeclaration = {
  partitionKey: 'PART-DARK',
  unitLevel: 'DISTRICT',
  declaredAt: '2026-01-01T00:00:00Z',
  minimumMembership: 2,
  declaredEligibleMembership: 5,
  coversClassIds: ['CLASS-P'],
};

const ROWS: GovernedAuthorityRows = { classes: [CLASS_ROW], partitions: [PARTITION_ROW] };

class CountingStore implements GovernedAuthorityStore {
  reads = 0;
  constructor(private readonly rows: (n: number) => GovernedAuthorityRows) {}
  async readGovernedRows(): Promise<GovernedAuthorityRows> {
    this.reads += 1;
    return this.rows(this.reads);
  }
}

/** Drifts on the SECOND read — the exact window R1 installed inside. */
const drifting = (): CountingStore =>
  new CountingStore((n) =>
    n === 1
      ? ROWS
      : { classes: [{ ...CLASS_ROW, basis: 'edited after the first read' }], partitions: [PARTITION_ROW] },
  );

const BOOT_INPUT = { epoch: 1, loadedAt: '2026-09-19T00:00:00Z' } as const;

/** "Nothing is installed" — asked of the process, not of a local variable. */
function nothingIsInstalled(): boolean {
  try {
    humanitarianProtectionAuthority();
    return false;
  } catch (error) {
    return /GEOMETRY_AUTHORITY_NOT_INSTALLED/.test(String(error));
  }
}

const keying: GovernedRecordKeying = {
  keyFor: ({ sourceGeometryId }) => ({
    recordKey: `rec:${sourceGeometryId}`,
    presentationPartitionKey: 'PART-LIGHT',
    protectionClassId: 'CLASS-P',
  }),
};

const RING = [
  [
    [11.0, 48.0],
    [11.5, 48.0],
    [11.5, 48.5],
    [11.0, 48.5],
    [11.0, 48.0],
  ],
];

beforeEach(() => {
  __resetHumanitarianAuthorityForTests();
});

/* ── 1 · GA-33 · CHECK BEFORE INSTALL ─────────────────────────────────────── */

describe('HB-1 · R1.2 · validation happens before anything is installed', () => {
  it('THE NEGATIVE CONTROL · drift → startup refusal → ZERO installed authority', async () => {
    /*
      E1's defect, and the test that kills it.

      R1 read, sealed, INSTALLED, re-read and only then compared — so on drift the throw
      arrived with a stale authority already globally reachable. Against R1's order the
      first two assertions below pass and the THIRD fails: an authority is installed.

      "It threw" is not the property. The property is what the process is left holding.
    */
    await expect(loadHumanitarianAuthority(drifting(), BOOT_INPUT)).rejects.toThrow(
      /GEOMETRY_AUTHORITY_DIGEST_DRIFTED/,
    );

    // ── the mutation-killing assertion ──
    expect(nothingIsInstalled()).toBe(true);
    expect(() => humanitarianProtectionAuthority()).toThrow(/GEOMETRY_AUTHORITY_NOT_INSTALLED/);
  });

  it('the refusal is an AuthorityLoadFailure, not a bare Error', async () => {
    await expect(loadHumanitarianAuthority(drifting(), BOOT_INPUT)).rejects.toThrow(
      AuthorityLoadFailure,
    );
  });

  it('a refused load does not consume the once-per-process loader token', async () => {
    /*
      A second, subtler consequence of checking first: nothing was minted, so a corrected
      start is still possible in the same process. Under R1's order the refused load had
      already taken the one token, and the retry failed with
      GEOMETRY_AUTHORITY_TOKEN_ALREADY_ISSUED — a second, misleading symptom of the
      first defect.
    */
    await expect(loadHumanitarianAuthority(drifting(), BOOT_INPUT)).rejects.toThrow(
      AuthorityLoadFailure,
    );

    const { authority } = await loadHumanitarianAuthority(
      new CountingStore(() => ROWS),
      BOOT_INPUT,
    );
    expect(humanitarianProtectionAuthority()).toBe(authority);
  });

  it('the refusal happens after exactly TWO governed reads and no third', async () => {
    const store = drifting();
    await expect(loadHumanitarianAuthority(store, BOOT_INPUT)).rejects.toThrow(
      AuthorityLoadFailure,
    );

    // Read A and read B. A loader that installed first would also have read twice —
    // which is why the installed-state assertion above is the one that discriminates.
    expect(store.reads).toBe(2);
  });

  it('GA-44 preserved · an empty registry refuses BEFORE install too', async () => {
    const empty = new CountingStore(() => ({ classes: [], partitions: [] }));

    await expect(loadHumanitarianAuthority(empty, BOOT_INPUT)).rejects.toThrow(
      /GEOMETRY_AUTHORITY_EMPTY/,
    );
    expect(nothingIsInstalled()).toBe(true);
  });

  it('a clean load DOES install, and the installed object is the sealed instance', async () => {
    const store = new CountingStore(() => ROWS);
    const { authority, report } = await loadHumanitarianAuthority(store, BOOT_INPUT);

    expect(store.reads).toBe(2);
    expect(report.sourceDigest).toBe(computeGovernedDigest(ROWS));
    expect(report.recomputedDigest).toBe(report.sourceDigest);
    expect(report.digestsMatch).toBe(true);
    expect(report.isInstalledInstance).toBe(true);

    // AS-E1-2 · identity, not structure.
    expect(humanitarianProtectionAuthority()).toBe(authority);
  });

  it('SOURCE ORDER · the install call comes after the drift refusal, statically', () => {
    /*
      A second, independent control on the same property.

      The in-process mutant — a copy of the root that installs first — cannot be written
      in this spec, because building an authority requires the shared loader module and
      the GX-14 allowlist admits exactly two files, neither of them this one. That
      allowlist is the more important control, so the mutant gives way to it and the
      order is checked in the source instead.
    */
    const src = withoutComments(ROOT_SOURCE);

    const refusal = src.indexOf('GEOMETRY_AUTHORITY_DIGEST_DRIFTED');
    const seal = src.indexOf('sealProtectionAuthority(token');
    const install = src.indexOf('installProtectionAuthority(token');

    expect(refusal).toBeGreaterThan(-1);
    expect(seal).toBeGreaterThan(refusal);
    expect(install).toBeGreaterThan(seal);

    // and there is exactly one install site to reason about
    expect(src.split('installProtectionAuthority(token').length - 1).toBe(1);
  });
});

/* ── 2 · BOOT CONVERGENCE ─────────────────────────────────────────────────── */

describe('HB-2 · the capability comes up and acquisition stays down', () => {
  it('boot loads the authority and registers the capability, acquisition OFF', async () => {
    const store = new CountingStore(() => ROWS);
    const report = await bootHumanitarian(store, BOOT_INPUT);

    expect(report.authority.digestsMatch).toBe(true);
    expect(report.authority.classCount).toBe(1);
    expect(report.acquisitionEnabled).toBe(false);
    expect(report.activationCleared).toBe(false);

    expect(report.capabilities).toHaveLength(1);
    expect(report.capabilities[0]).toBe(COPERNICUS_CAPABILITY);
    expect(COPERNICUS_CAPABILITY.acquisitionEnabled).toBe(false);
    expect(COPERNICUS_CAPABILITY.activation).toBe('NOT_CLEARED');
    expect(COPERNICUS_CAPABILITY.sourceId).toBe(COPERNICUS_SOURCE_ID);
    expect(COPERNICUS_CAPABILITY.denotation).toBe(COPERNICUS_DENOTATION);
    expect(COPERNICUS_CAPABILITY.emits).toEqual(['POLYGON', 'MULTIPOLYGON']);

    // The capability is a DESCRIPTION: there is no callable acquisition on it.
    expect(Object.getOwnPropertyNames(COPERNICUS_CAPABILITY).sort()).toEqual([
      'acquisitionEnabled',
      'activation',
      'denotation',
      'domainId',
      'emits',
      'producerId',
      'rightsClass',
      'sourceId',
    ]);
    expect(Object.isFrozen(COPERNICUS_CAPABILITY)).toBe(true);
    expect(Object.isFrozen(HUMANITARIAN_PRODUCER_CAPABILITIES)).toBe(true);
  });

  it('boot reads the governed store exactly twice and fetches from no publisher', async () => {
    const store = new CountingStore(() => ROWS);
    await bootHumanitarian(store, BOOT_INPUT);
    expect(store.reads).toBe(2);
  });

  it('the guard is callable and passes while activation is NOT_CLEARED', () => {
    expect(() => assertAcquisitionIsStillOff()).not.toThrow();
  });

  it('NO ENVIRONMENT FLAG · boot reads no configuration at all', () => {
    const exec = withoutComments(BOOT_SOURCE);

    for (const forbidden of ['process.env', 'ConfigService', 'ConfigModule', 'getenv', 'dotenv']) {
      expect(exec.includes(forbidden)).toBe(false);
    }
    // positive control: the scan bites on a flag written the way one really would be
    expect(`${exec}\nconst on = process.env.COPERNICUS_ENABLED === 'true';`).toContain(
      'process.env',
    );
  });

  it('NO TRANSPORT, NO SCHEDULE, NO ROUTE reaches the boot path', () => {
    const exec = withoutComments(BOOT_SOURCE);

    for (const forbidden of ['fetch(', 'axios', 'setInterval', 'setTimeout', 'Cron', 'http']) {
      expect(exec.toLowerCase().includes(forbidden.toLowerCase())).toBe(false);
    }
    for (const forbidden of ['@Controller', '@Get', '@Post', 'Controller(']) {
      expect(exec.includes(forbidden)).toBe(false);
    }
  });

  it('the Nest provider boots on init and refuses to report before it has', async () => {
    const store = new CountingStore(() => ROWS);
    const bootstrap = new HumanitarianAuthorityBootstrap(store, BOOT_INPUT);

    expect(() => bootstrap.bootReport()).toThrow(HumanitarianBootFailure);
    expect(() => bootstrap.bootReport()).toThrow(/HUMANITARIAN_NOT_BOOTED/);

    await bootstrap.onModuleInit();

    expect(bootstrap.bootReport().acquisitionEnabled).toBe(false);
    expect(bootstrap.bootReport().authority.isInstalledInstance).toBe(true);
  });

  it('a drifting store makes onModuleInit REJECT, and leaves nothing installed', async () => {
    const bootstrap = new HumanitarianAuthorityBootstrap(drifting(), BOOT_INPUT);

    await expect(bootstrap.onModuleInit()).rejects.toThrow(/GEOMETRY_AUTHORITY_DIGEST_DRIFTED/);
    expect(nothingIsInstalled()).toBe(true);
    expect(() => bootstrap.bootReport()).toThrow(HumanitarianBootFailure);
  });

  it('the module registers three providers, one export, and NO controller', () => {
    const dynamic = HumanitarianModule.forRoot({
      store: { provide: HUMANITARIAN_AUTHORITY_STORE, useValue: new CountingStore(() => ROWS) },
      options: BOOT_INPUT,
    });

    expect(dynamic.module).toBe(HumanitarianModule);
    expect(dynamic.providers).toHaveLength(3);
    expect(dynamic.exports).toEqual([HumanitarianAuthorityBootstrap]);
    expect(dynamic.controllers).toBeUndefined();

    // The store token is the caller's to bind; this lane ships no default reader.
    expect(withoutComments(BOOT_SOURCE)).not.toContain('useClass:');
    expect(HUMANITARIAN_AUTHORITY_STORE).toBe('HUMANITARIAN_AUTHORITY_STORE');
    expect(HUMANITARIAN_BOOT_OPTIONS).toBe('HUMANITARIAN_BOOT_OPTIONS');
  });
});

/* ── 3 · AC-1 · NO DIRECT INSERT, NO PROTECTION-OWNED FIELDS ──────────────── */

describe('HB-3 · AC-1 · the governed intake boundary', () => {
  const emittedRecords = (): ReturnType<typeof produceInundationExtents>['emitted'] =>
    produceInundationExtents(
      {
        features: [
          {
            activationCode: 'EMSR999',
            productId: 'DEL-01',
            featureId: 'F1',
            geometryType: 'Polygon',
            crs: 'EPSG:4326',
            coordinates: RING,
          },
        ],
      },
      keying,
    ).emitted;

  it('prepared evidence carries the source assertion and NEITHER protection-owned field', () => {
    const emitted = emittedRecords();
    expect(emitted).toHaveLength(1);

    // The producer DID receive both from the authority port…
    expect(emitted[0]!.protectionClassId).toBe('CLASS-P');
    expect(emitted[0]!.presentationPartitionKey).toBe('PART-LIGHT');

    // …and neither survives onto what goes to persistence.
    const [evidence] = prepareSourceEvidence(emitted);
    const names = Object.getOwnPropertyNames(evidence!);

    for (const forbidden of PROTECTION_OWNED_FIELDS) {
      expect(names).not.toContain(forbidden);
    }
    expect(names.sort()).toEqual([
      'coordinates',
      'crs',
      'denotation',
      'emittingDomainId',
      'geometryKind',
      'origin',
      'recordKey',
      'sourceGeometryId',
      'sourceId',
    ]);

    expect(evidence!.sourceId).toBe(COPERNICUS_SOURCE_ID);
    expect(evidence!.geometryKind).toBe('POLYGON');
    expect(evidence!.denotation).toBe('AFFECTED_AREA');
    expect(evidence!.origin).toBe('SOURCE_NATIVE');
  });

  it("the source's coordinate array is carried BY REFERENCE, not rebuilt", () => {
    const [evidence] = prepareSourceEvidence(emittedRecords());

    expect(evidence!.coordinates.type).toBe('Polygon');
    expect(evidence!.coordinates.coordinates).toBe(RING);
    expect(Object.getOwnPropertyNames(evidence!.coordinates).sort()).toEqual([
      'coordinates',
      'type',
    ]);
  });

  it('the protection-owned-field guard actually bites (positive control)', () => {
    expect(() =>
      assertNoProtectionOwnedFields({ recordKey: 'r', protectionClassId: 'CLASS-P' }),
    ).toThrow(ProtectionOwnedFieldPresent);
    expect(() =>
      assertNoProtectionOwnedFields({ recordKey: 'r', presentation_partition_key: 'PART-DARK' }),
    ).toThrow(/PROTECTION_OWNED_FIELD_ON_PRODUCER_PAYLOAD/);
    expect(() => assertNoProtectionOwnedFields({ recordKey: 'r' })).not.toThrow();
  });

  it('NO DIRECT INSERT PATH · no SQL and no client in any file this lane owns', () => {
    const owned = [BOOT_SOURCE, INTAKE_SOURCE, PRODUCER_SOURCE, ROOT_SOURCE].map(withoutComments);

    for (const src of owned) {
      for (const forbidden of ['INSERT', 'UPDATE ', 'prisma', 'PrismaClient', 'pg.Pool', '$executeRaw', '$queryRaw']) {
        expect(new RegExp(forbidden.replace(/[$.]/g, '\\$&'), 'i').test(src)).toBe(false);
      }
    }

    // positive control: the scan bites on a write written the way one really would be
    expect(/insert/i.test('INSERT INTO hum_authority_record ...')).toBe(true);

    // The intake layer is a PORT here: declared, and not implemented.
    expect(INTAKE_SOURCE).toContain('export interface GovernedHumanitarianIntake');
    expect(withoutComments(INTAKE_SOURCE)).not.toContain('implements GovernedHumanitarianIntake');
  });
});
