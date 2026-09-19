import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { GeometryCoordinateValue } from '@globalnews-ai/shared';

import {
  GovernedIntakeService,
  type AuthorityIntakeRepository,
  type GovernedGeometryRow,
  type GovernedProtectionResolver,
} from './governed-intake.service';
import type { SourceEvidenceRecord } from '../humanitarian-intake.port';
import {
  __resetHumanitarianAuthorityForTests,
  loadHumanitarianAuthority,
  type GovernedAuthorityStore,
} from '../humanitarian-authority.loader';
import { humanitarianModuleImports, HUMANITARIAN_PROVISIONING } from '../humanitarian.registration';
import { HumanitarianModule, HUMANITARIAN_AUTHORITY_STORE } from '../humanitarian-boot';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE TWO THINGS G's R1.2 LEFT TO THIS LANE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-HUMANITARIAN-BOOT-INTAKE-R1.
 *
 * G's `humanitarian-boot.spec.ts` covers the three boot proofs and AC-1's PORT. Two
 * things are deliberately outside it, and both are named in G's own files:
 *
 *   1. the INTAKE IMPLEMENTATION behind the door — G's port asserts it declares no
 *      `implements GovernedHumanitarianIntake`, because that belongs to this layer;
 *   2. the APP MODULE WIRING — G's boot file lists it under "WHAT CLAUDE CODE WIRES".
 *
 * This file tests exactly those two and re-tests none of G's 100 assertions. A second
 * copy of somebody else's suite is not a second proof.
 */

const CLASS = {
  classId: 'CLASS-P',
  declaredAt: '2026-01-01T00:00:00Z',
  basis: 'synthetic declared class',
  partitionUnitLevel: 'DISTRICT' as const,
};

const PARTITION = {
  partitionKey: 'PART-DARK',
  unitLevel: 'DISTRICT' as const,
  declaredAt: '2026-01-01T00:00:00Z',
  minimumMembership: 5,
  declaredEligibleMembership: 40,
  coversClassIds: ['CLASS-P'],
};

const store: GovernedAuthorityStore = {
  readGovernedRows: async () => ({ classes: [CLASS], partitions: [PARTITION] }),
};

const COORDS: GeometryCoordinateValue = {
  type: 'Polygon',
  coordinates: [
    [
      [11.0, 48.0],
      [11.5, 48.0],
      [11.5, 48.5],
      [11.0, 48.5],
      [11.0, 48.0],
    ],
  ],
} as GeometryCoordinateValue;

const evidence = (over: Partial<SourceEvidenceRecord> = {}): SourceEvidenceRecord => ({
  recordKey: 'rec:1',
  sourceId: 'COPERNICUS_EMS',
  sourceGeometryId: 'EMSR999/DEL-01/F1',
  emittingDomainId: 'HUMANITARIAN',
  geometryKind: 'POLYGON',
  denotation: 'AFFECTED_AREA',
  origin: 'SOURCE_NATIVE',
  crs: 'EPSG:4326',
  coordinates: COORDS,
  ...over,
});

class RecordingRepository implements AuthorityIntakeRepository {
  readonly rows: GovernedGeometryRow[] = [];
  async insertGeometryRecord(row: GovernedGeometryRow): Promise<void> {
    this.rows.push(row);
  }
}

const resolver = (
  resolution: ReturnType<GovernedProtectionResolver['resolve']>,
): GovernedProtectionResolver => ({ resolve: () => resolution });

async function installed() {
  __resetHumanitarianAuthorityForTests();
  const { authority } = await loadHumanitarianAuthority(store, {
    epoch: 1,
    loadedAt: '2026-01-02T00:00:00Z',
  });
  return authority;
}

describe('AC-1 · the intake layer supplies the protection-owned fields', () => {
  it('the row is built from the RESOLUTION, never from the evidence', async () => {
    const authority = await installed();
    const repo = new RecordingRepository();
    const intake = new GovernedIntakeService(
      resolver({ presentationPartitionKey: 'PART-DARK', protectionClassId: 'CLASS-P' }),
      repo,
      () => authority,
    );

    const receipt = await intake.admit([evidence()]);

    expect(receipt).toEqual({ admitted: 1, recordKeys: ['rec:1'] });
    expect(repo.rows[0]!.presentationPartitionKey).toBe('PART-DARK');
    expect(repo.rows[0]!.protectionClassId).toBe('CLASS-P');

    // And the evidence half is carried through untouched.
    expect(repo.rows[0]!.sourceGeometryId).toBe('EMSR999/DEL-01/F1');
    expect(repo.rows[0]!.geometryKind).toBe('POLYGON');
  });

  it('GX-12 · the coordinate carrier is passed BY REFERENCE, never rebuilt', async () => {
    /*
      Rebuilding it here would be the first step of the reshaping this domain forbids,
      and a deep-equal assertion would not notice a rebuild. Identity is the property.
    */
    const authority = await installed();
    const repo = new RecordingRepository();
    const intake = new GovernedIntakeService(
      resolver({ presentationPartitionKey: 'PART-LIGHT' }),
      repo,
      () => authority,
    );

    await intake.admit([evidence()]);
    expect(repo.rows[0]!.coordinates).toBe(COORDS);
  });

  it('THE HOSTILE PAYLOAD · protection-owned fields on the evidence are REFUSED', async () => {
    /*
      G's `assertNoProtectionOwnedFields` is re-run here rather than trusted from
      `prepareSourceEvidence`, because a record can reach `admit` from a queue, a retry
      or a test double — and a check that only runs on the happy path runs where it is
      least needed.
    */
    const authority = await installed();
    const repo = new RecordingRepository();
    const intake = new GovernedIntakeService(
      resolver({ presentationPartitionKey: 'PART-LIGHT' }),
      repo,
      () => authority,
    );

    const hostile = {
      ...evidence(),
      presentationPartitionKey: 'PART-LIGHT',
    } as unknown as SourceEvidenceRecord;

    await expect(intake.admit([hostile])).rejects.toThrow(
      /PROTECTION_OWNED_FIELD_ON_PRODUCER_PAYLOAD/,
    );
    // A write path, so the refusal must happen before anything durable.
    expect(repo.rows).toEqual([]);
  });

  it('AS-4 · an unresolved record is withheld, never defaulted into an unprotected key', async () => {
    const authority = await installed();
    const repo = new RecordingRepository();
    const intake = new GovernedIntakeService(resolver(null), repo, () => authority);

    const receipt = await intake.admit([evidence()]);

    expect(receipt).toEqual({ admitted: 0, recordKeys: [] });
    expect(repo.rows).toEqual([]);
  });

  it('a resolver naming an undeclared class is refused, not persisted', async () => {
    const authority = await installed();
    const repo = new RecordingRepository();
    const intake = new GovernedIntakeService(
      resolver({ presentationPartitionKey: 'PART-DARK', protectionClassId: 'CLASS-INVENTED' }),
      repo,
      () => authority,
    );

    expect(await intake.admit([evidence()])).toEqual({ admitted: 0, recordKeys: [] });
    expect(repo.rows).toEqual([]);
  });

  it('AS-E1-2 · a forged authority is refused before anything is written', async () => {
    const authority = await installed();
    const repo = new RecordingRepository();

    const [seal] = Object.getOwnPropertySymbols(authority);
    const forged = {
      [seal!]: true,
      epoch: authority.epoch,
      classes: { declarations: [] },
      partitions: { declarations: [] },
      loadedAt: authority.loadedAt,
      sourceDigest: authority.sourceDigest,
    } as unknown as typeof authority;

    const intake = new GovernedIntakeService(
      resolver({ presentationPartitionKey: 'PART-LIGHT' }),
      repo,
      () => forged,
    );

    await expect(intake.admit([evidence()])).rejects.toThrow(
      /GEOMETRY_AUTHORITY_NOT_THE_INSTALLED_INSTANCE/,
    );
    expect(repo.rows).toEqual([]);
  });

  it('POSITIVE CONTROL · a mixed batch admits the keyed and withholds the rest', async () => {
    /*
      Without this every assertion above is satisfied by an intake that refuses
      everything and writes nothing.
    */
    const authority = await installed();
    const repo = new RecordingRepository();

    let call = 0;
    const mixed: GovernedProtectionResolver = {
      resolve: () => {
        call += 1;
        return call === 2 ? null : { presentationPartitionKey: 'PART-LIGHT' };
      },
    };

    const intake = new GovernedIntakeService(mixed, repo, () => authority);
    const receipt = await intake.admit([
      evidence({ recordKey: 'rec:a' }),
      evidence({ recordKey: 'rec:b' }),
      evidence({ recordKey: 'rec:c' }),
    ]);

    expect(receipt.admitted).toBe(2);
    expect(receipt.recordKeys).toEqual(['rec:a', 'rec:c']);
    expect(repo.rows.map((r) => r.recordKey)).toEqual(['rec:a', 'rec:c']);
  });

  it('the service holds NO connection — the writer is a port, and there is no concrete one', () => {
    const src = readFileSync(join(__dirname, 'governed-intake.service.ts'), 'utf8');
    for (const forbidden of ['PrismaService', "from 'pg'", 'INSERT INTO', 'new Client(']) {
      expect([forbidden, src.includes(forbidden)]).toEqual([forbidden, false]);
    }
    expect(src).toContain('interface AuthorityIntakeRepository');
  });

  it("and it implements G's port rather than declaring a second one", () => {
    /*
      The draft of this service declared its own `GovernedHumanitarianIntake`, its own
      submission type and its own repository port — a SECOND ARCHITECTURE for the same
      boundary, agreeing with G's only by discipline. It was discarded when G's port
      landed. This asserts the correction held.
    */
    const src = readFileSync(join(__dirname, 'governed-intake.service.ts'), 'utf8');
    expect(src).toContain('implements GovernedHumanitarianIntake');
    expect(src).toContain("from '../humanitarian-intake.port'");
    // It declares no competing door.
    expect(src).not.toMatch(/export interface GovernedHumanitarianIntake/);
    expect(src).not.toMatch(/export interface SourceEvidenceRecord/);
  });
});

describe('part B · the AppModule wiring, which G assigned to this lane', () => {
  it('unprovisioned registers NOTHING — not a module that does nothing', () => {
    expect(humanitarianModuleImports(undefined)).toEqual([]);
    expect(HUMANITARIAN_PROVISIONING).toBeUndefined();
  });

  it('provisioned registers the module with the store and options bound', () => {
    const imports = humanitarianModuleImports({
      store: { provide: HUMANITARIAN_AUTHORITY_STORE, useValue: store },
      options: { epoch: 1, loadedAt: '2026-01-02T00:00:00Z' },
    });

    expect(imports).toHaveLength(1);
    expect(imports[0]!.module).toBe(HumanitarianModule);
    expect(imports[0]!.providers ?? []).toHaveLength(3);
  });

  it('AppModule spreads it, and the wiring reads no environment', () => {
    const app = readFileSync(join(__dirname, '..', '..', '..', 'app.module.ts'), 'utf8');
    expect(app).toContain('...humanitarianModuleImports(HUMANITARIAN_PROVISIONING)');

    // E1 forbade a flag that turns provider execution on. Provisioning is expressed by
    // supplying a PROVIDER — a reviewed code change — not a variable on a box.
    const reg = readFileSync(join(__dirname, '..', 'humanitarian.registration.ts'), 'utf8');
    expect(reg).not.toContain('process.env');
  });

  it('and importing it registers no controller and no route', () => {
    const bootSrc = readFileSync(join(__dirname, '..', 'humanitarian-boot.ts'), 'utf8');
    expect(bootSrc).not.toMatch(/@Controller|@Get\(|@Post\(|@Put\(|@Delete\(/);
  });
});
