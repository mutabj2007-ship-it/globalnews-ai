/**
 * BETA-SIMPLE-ASK-SAND-1 — an in-memory stand-in for PrismaService,
 * covering only the five tables this tranche added.
 *
 * WHY A FAKE RATHER THAN A JEST MOCK.
 *
 * The behavior under test is §12 idempotency and §13 reservation
 * lifecycle, and the actual enforcement mechanism for §12 is a UNIQUE
 * INDEX. A `jest.fn()` returning canned values cannot express "the
 * second insert for this key fails" — you would have to program the
 * failure you were trying to prove, which tests nothing. This fake
 * enforces the unique constraints for real, throwing the same
 * `{ code: 'P2002' }` shape Prisma throws, so
 * ComputeOperationService's insert-first/catch-conflict path is
 * exercised as written.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: transactions, isolation levels,
 * or concurrent-write ordering. Those are real database semantics and
 * a fake asserting them would be asserting its own implementation.
 * The claim this fake supports is narrower and honest: "given a
 * unique-constraint violation, the service recovers by reusing the
 * existing row." That a real PostgreSQL UNIQUE index produces that
 * violation under concurrency is a property of PostgreSQL, not of
 * this code, and is covered by the migration's own
 * `CREATE UNIQUE INDEX` rather than by a unit test.
 *
 * Excluded from the production build via the '.testing.ts' glob in
 * tsconfig.build.json's exclude list.
 */

/** The error shape Prisma raises for a unique-constraint violation. */
export class FakeUniqueViolation extends Error {
  readonly code = 'P2002';

  constructor(field: string) {
    super(`Unique constraint failed on the fields: (${field})`);
    this.name = 'PrismaClientKnownRequestError';
  }
}

interface AnyRow {
  [key: string]: unknown;
}

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

/**
 * A minimal table supporting the operations these services actually
 * use: create, findUnique, update, upsert, findMany. Nothing more —
 * an unused method would be untested scaffolding.
 */
class FakeTable {
  readonly rows: AnyRow[] = [];

  constructor(
    private readonly name: string,
    /**
     * A plain string is a single-column unique; a nested array is a
     * composite one (AskTurn's @@unique([threadId, sequence]), which
     * is what makes a concurrent double-submit unable to produce two
     * turns claiming the same position in a conversation).
     */
    private readonly uniqueFields: readonly (string | readonly string[])[],
    private readonly defaults: () => AnyRow,
  ) {}

  private match(where: AnyRow): AnyRow | undefined {
    // Supports Prisma's nested composite-unique `where` shape, e.g.
    // `{ threadId_sequence: { threadId, sequence } }`, by flattening it.
    const flat: AnyRow = {};
    for (const [key, value] of Object.entries(where)) {
      if (value && typeof value === 'object' && !(value instanceof Date) && key.includes('_')) {
        Object.assign(flat, value as AnyRow);
      } else {
        flat[key] = value;
      }
    }
    return this.rows.find((row) => Object.entries(flat).every(([k, v]) => row[k] === v));
  }

  private assertUnique(candidate: AnyRow, excluding?: AnyRow): void {
    for (const unique of this.uniqueFields) {
      const fields = typeof unique === 'string' ? [unique] : unique;
      if (fields.some((f) => candidate[f] === undefined || candidate[f] === null)) continue;

      const clash = this.rows.find(
        (row) => row !== excluding && fields.every((f) => row[f] === candidate[f]),
      );
      if (clash) throw new FakeUniqueViolation(fields.join('_'));
    }
  }

  create({ data, select }: { data: AnyRow; select?: AnyRow }): AnyRow {
    const row = { ...this.defaults(), ...data, id: (data.id as string) ?? nextId(this.name) };
    this.assertUnique(row);
    this.rows.push(row);
    return project(row, select);
  }

  findUnique({ where, select }: { where: AnyRow; select?: AnyRow }): AnyRow | null {
    const row = this.match(where);
    return row ? project(row, select) : null;
  }

  findMany({
    where,
    orderBy,
    select,
  }: {
    where?: AnyRow;
    orderBy?: AnyRow;
    select?: AnyRow;
  } = {}): AnyRow[] {
    let found = this.rows.filter((row) =>
      where ? Object.entries(where).every(([k, v]) => row[k] === v) : true,
    );

    if (orderBy) {
      const [field, direction] = Object.entries(orderBy)[0] as [string, 'asc' | 'desc'];
      found = [...found].sort((a, b) => {
        const av = a[field] as number | Date;
        const bv = b[field] as number | Date;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return direction === 'desc' ? -cmp : cmp;
      });
    }

    return found.map((row) => project(row, select));
  }

  update({ where, data, select }: { where: AnyRow; data: AnyRow; select?: AnyRow }): AnyRow {
    const row = this.match(where);
    if (!row) throw new Error(`${this.name}: no row matching ${JSON.stringify(where)}`);

    for (const [key, value] of Object.entries(data)) {
      // Supports Prisma's `{ increment: n }` atomic-update shape, which
      // StoredResultService.recordReuse uses.
      if (value && typeof value === 'object' && 'increment' in (value as AnyRow)) {
        row[key] = ((row[key] as number) ?? 0) + ((value as AnyRow).increment as number);
      } else {
        row[key] = value;
      }
    }
    row.updatedAt = new Date();
    return project(row, select);
  }

  upsert({
    where,
    create,
    update,
    select,
  }: {
    where: AnyRow;
    create: AnyRow;
    update: AnyRow;
    select?: AnyRow;
  }): AnyRow {
    const existing = this.match(where);
    if (existing) return this.update({ where, data: update, select });
    return this.create({ data: { ...create, ...where }, select });
  }
}

function project(row: AnyRow, select?: AnyRow): AnyRow {
  if (!select) return { ...row };
  const out: AnyRow = {};
  for (const key of Object.keys(select)) out[key] = row[key];
  return out;
}

/**
 * Stands in for PrismaService. Only the five BETA tables are present;
 * touching any other model is a programming error in the test, and
 * failing loudly is better than silently returning undefined.
 */
export class FakePrisma {
  readonly storedResult = new FakeTable('storedResult', ['fingerprint', 'id'], () => ({
    id: undefined,
    createdAt: new Date(),
    reuseCount: 0,
    lastReusedAt: null,
    expiresAt: null,
  }));

  readonly computeOperation = new FakeTable(
    'computeOperation',
    ['idempotencyKey', 'id'],
    () => ({
      id: undefined,
      executionStatus: 'QUOTED',
      quotedSand: 0,
      requiresConfirmation: false,
      storedResultId: null,
      storedResultReused: false,
      quoteExpiresAt: null,
      confirmedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );

  readonly sandLedgerEntry = new FakeTable('sandLedgerEntry', ['id'], () => ({
    id: undefined,
    quotedSand: 0,
    reservedSand: 0,
    finalSand: 0,
    resultId: null,
    createdAt: new Date(),
  }));

  readonly askThread = new FakeTable('askThread', ['id'], () => ({
    id: undefined,
    language: 'en',
    context: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  readonly askTurn = new FakeTable('askTurn', ['id', ['threadId', 'sequence']], () => ({
    id: undefined,
    storedResultReused: false,
    operationId: null,
    question: null,
    answer: null,
    computeClass: null,
    createdAt: new Date(),
  }));
}

/**
 * Resets the shared id counter so ids are stable and readable within a
 * test file. Call in beforeEach alongside constructing a new
 * FakePrisma.
 */
export function resetFakePrismaIds(): void {
  sequence = 0;
}
