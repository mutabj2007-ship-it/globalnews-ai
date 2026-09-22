/* Disposable local PostgreSQL only. No existing schema or production migrations. */
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const { Client } = require('pg');
const root = path.resolve(__dirname, '..');
const migration = path.join(root, 'prisma/migrations/20260922130000_security_evidence_r2');
let phase = 'configuration';
async function main() {
  const connectionString = process.env.SECURITY_R2_TEST_DATABASE_URL;
  if (!connectionString) {
    console.error('UNMEASURED: SECURITY_R2_TEST_DATABASE_URL is required');
    process.exitCode = 2;
    return;
  }
  const url = new URL(connectionString);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('Refusing non-loopback database');
  const schema = 'security_r2_' + crypto.randomBytes(8).toString('hex');
  if (!/^security_r2_[a-f0-9]{16}$/.test(schema)) throw new Error('Unsafe schema');
  const db = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  let created = false;
  const passed = [];
  const q = (sql, args = []) => db.query(sql, args);
  const ok = (name, test) => {
    if (!test) throw new Error(name);
    passed.push(name);
  };
  const rejects = async (name, sql, args = [], code) => {
    phase = name;
    let e;
    try {
      await q(sql, args);
    } catch (error) {
      e = error;
    }
    if (!e || (code && e.code !== code)) throw new Error(name + ' did not reject as expected');
    passed.push(name);
  };
  const up = fs.readFileSync(path.join(migration, 'migration.sql'), 'utf8');
  const down = fs.readFileSync(path.join(migration, 'DOWN.sql'), 'utf8');
  try {
    phase = 'connect';
    await db.connect();
    phase = 'migration';
    await q('CREATE SCHEMA "' + schema + '"');
    created = true;
    await q('SET search_path TO "' + schema + '"');
    await q(up);
    passed.push('migration applies to real PostgreSQL');
    const run = async (g = 'RW') =>
      (
        await q(
          'INSERT INTO "SecurityProjectionRun" ("geographyId","maxAgeMinutes") VALUES ($1,1440) RETURNING "id"',
          [g],
        )
      ).rows[0].id;
    const insert =
      'INSERT INTO "SecurityObservation" ("runId","observationKey","geographyId","revisionOrdinal","supersedesRevisionOrdinal","ownershipT1","ownershipT2","resolvedOwner","payload") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)';
    const id = await run();
    const row = [id, 'report:RW', 'RW', 0, null, true, false, 'SECURITY', '{}'];
    await rejects('NULL T1 rejected', insert, [...row.slice(0, 5), null, ...row.slice(6)], '23502');
    await rejects('NULL T2 rejected', insert, [...row.slice(0, 6), null, ...row.slice(7)], '23502');
    await rejects('true T2 rejected', insert, [...row.slice(0, 6), true, ...row.slice(7)], '23514');
    await rejects(
      'false T1 rejected',
      insert,
      [...row.slice(0, 5), false, ...row.slice(6)],
      '23514',
    );
    await rejects(
      'Conflict owner rejected',
      insert,
      [...row.slice(0, 7), 'CONFLICT', row[8]],
      '23514',
    );
    await rejects('wrong geography rejected', insert, [
      id,
      'report:KE',
      'KE',
      0,
      null,
      true,
      false,
      'SECURITY',
      '{}',
    ]);
    await rejects('first revision cannot skip zero', insert, [
      id,
      'report:RW',
      'RW',
      2,
      1,
      true,
      false,
      'SECURITY',
      '{}',
    ]);
    await q(insert, row);
    passed.push('valid first observation accepted');
    const member = async (runId, key) =>
      q(
        'INSERT INTO "SecurityProjectionMember" ("runId","observationId","observationKey") SELECT $1,"id","observationKey" FROM "SecurityObservation" WHERE "observationKey"=$2 ORDER BY "revisionOrdinal" DESC LIMIT 1',
        [runId, key],
      );
    await member(id, 'report:RW');
    await rejects('duplicate revision rejected', insert, row);
    await rejects(
      'count mismatch rejected',
      'INSERT INTO "SecurityProjectionCompletion" ("runId","status","observationCount") VALUES ($1,$2,2)',
      [id, 'OK'],
    );
    await q(
      'INSERT INTO "SecurityProjectionCompletion" ("runId","status","observationCount") VALUES ($1,$2,$3)',
      [id, 'OK', 1],
    );
    await rejects('sealed run rejects further rows', insert, [
      id,
      'other:RW',
      'RW',
      0,
      null,
      true,
      false,
      'SECURITY',
      '{}',
    ]);
    for (const table of [
      'SecurityProjectionRun',
      'SecurityProjectionCompletion',
      'SecurityObservation',
    ]) {
      await rejects(
        table + ' UPDATE refused',
        'UPDATE "' +
          table +
          '" SET ' +
          (table === 'SecurityProjectionRun'
            ? '"geographyId"=$1'
            : table === 'SecurityProjectionCompletion'
              ? '"status"=$1'
              : '"ownershipT1"=$1'),
        [
          table === 'SecurityProjectionRun'
            ? 'RW'
            : table === 'SecurityProjectionCompletion'
              ? 'OK'
              : true,
        ],
      );
      await rejects(table + ' DELETE refused', 'DELETE FROM "' + table + '"');
    }
    const second = await run();
    await q(insert, [second, 'report:RW', 'RW', 1, 0, true, false, 'SECURITY', '{}']);
    passed.push('contiguous revision appended');
    await member(second, 'report:RW');
    await q(
      'INSERT INTO "SecurityProjectionCompletion" ("runId","status","observationCount") VALUES ($1,$2,$3)',
      [second, 'OK', 1],
    );
    const ke = await run('KE');
    await q(insert, [ke, 'report:KE', 'KE', 0, null, true, false, 'SECURITY', '{}']);
    passed.push('same source in another country is independent');
    const pending = await run();
    ok(
      'latest unfinished attempt has no completion',
      (
        await q(
          'SELECT c."status" FROM "SecurityProjectionRun" r LEFT JOIN "SecurityProjectionCompletion" c ON c."runId"=r."id" WHERE r."geographyId"=$1 ORDER BY r."id" DESC LIMIT 1',
          ['RW'],
        )
      ).rows[0].status === null,
    );
    await q(
      'INSERT INTO "SecurityProjectionCompletion" ("runId","status","observationCount") VALUES ($1,$2,$3)',
      [pending, 'SOURCE_UNAVAILABLE', 0],
    );
    const empty = await run();
    await q(
      'INSERT INTO "SecurityProjectionCompletion" ("runId","status","observationCount") VALUES ($1,$2,$3)',
      [empty, 'NO_RESULTS', 0],
    );
    ok(
      'reclassified empty latest projection hides historical observations',
      (await q('SELECT count(*)::int AS n FROM "SecurityObservation" WHERE "runId"=$1', [empty]))
        .rows[0].n === 0,
    );
    ok(
      'historical revisions remain retained',
      (
        await q('SELECT count(*)::int AS n FROM "SecurityObservation" WHERE "observationKey"=$1', [
          'report:RW',
        ])
      ).rows[0].n === 2,
    );

    await rejects('TRUNCATE is refused', 'TRUNCATE "SecurityProjectionMember"');
    // Execute the actual repository and producer against the same isolated database.
    require('ts-node').register({
      transpileOnly: true,
      compilerOptions: {
        module: 'commonjs',
        target: 'ES2021',
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    });
    const { PrismaClient } = require('../src/generated/prisma/client.ts');
    const { PrismaPg } = require('@prisma/adapter-pg');
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema }) });
    try {
      const {
        SecurityObservationRepository,
      } = require('../src/modules/security/persistence/security-observation.repository.ts');
      const {
        SecurityProducerService,
      } = require('../src/modules/security/security-producer.service.ts');
      const { SecurityReadService } = require('../src/modules/security/security-read.service.ts');
      const repository = new SecurityObservationRepository(prisma);
      const article = {
        id: 'r2-proof',
        title: 'A shooting was committed by an unaffiliated individual acting alone.',
        summary: 'Retained report about John Example.',
        sourceId: 'publisher',
        sourceName: 'Publisher',
        url: 'https://example.test/retained',
        publishedAt: new Date().toISOString(),
        firstSeenAt: new Date().toISOString(),
        publishedAtBasis: 'publisher',
        sourcesCount: 1,
        category: 'world',
      };
      const corpus = {
        readRecentForSecurity: async () => ({
          status: 'OK',
          articles: [
            {
              ...article,
              securityCountryAttribution: {
                countryCode: 'PL',
                relevanceScore: 73,
                basis: 'ArticleCountry',
              },
            },
          ],
        }),
      };
      const producer = new SecurityProducerService(corpus, repository);
      phase = 'real producer first write';
      ok(phase, (await producer.produce('PL')) === 'OK');
      phase = 'real producer unchanged refresh';
      ok(phase, (await producer.produce('PL')) === 'OK');
      ok(
        'unchanged refresh does not fabricate a revision',
        (
          await q('SELECT count(*)::int n FROM "SecurityObservation" WHERE "geographyId"=$1', [
            'PL',
          ])
        ).rows[0].n === 1,
      );
      ok(
        'unchanged refresh remains readable',
        (await repository.findByGeography({ geographyId: 'PL' })).observations.length === 1,
      );
      ok(
        '24h retained projection refuses 60m request',
        (await repository.findByGeography({ geographyId: 'PL', maxAgeMinutes: 60 })).succeeded ===
          false,
      );
      const retained = await repository.findByGeography({ geographyId: 'PL' });
      ok(
        'actual relation score is persisted instead of article confidence',
        retained.observations[0].geography.attributionScore === 73,
      );
      ok(
        'persisted source decision denies public eligibility',
        retained.observations[0].sourceEligibility.publicEvidencePermitted === false,
      );
      const {
        buildSecurityObservation,
      } = require('../src/modules/security/provenance/security-observation.factory.ts');
      const {
        classifySecurityCandidate,
      } = require('../src/modules/security/classification/security-candidate.classifier.ts');
      for (const defect of ['identity', 'geography', 'ownership', 'revision']) {
        const a = { ...article, url: article.url + '/' + defect };
        const original = buildSecurityObservation(
          a,
          { countryCode: 'GB', countryName: 'GB', relevanceScore: 73 },
          classifySecurityCandidate(a),
        ).observation;
        const corrupt = JSON.parse(JSON.stringify(original));
        if (defect === 'identity') corrupt.observationKey = 'wrong';
        if (defect === 'geography') corrupt.subjectId = corrupt.geography.geographyId = 'KE';
        if (defect === 'ownership') corrupt.claim.ownership.organisedArmedActorParticipates = true;
        if (defect === 'revision') corrupt.revision.revisionOrdinal = 9;
        const badRun = await repository.startRun('GB', 1440);
        await q(insert, [
          badRun.id,
          original.observationKey,
          'GB',
          0,
          null,
          true,
          false,
          'SECURITY',
          JSON.stringify(corrupt),
        ]);
        await member(badRun.id, original.observationKey);
        await q(
          'INSERT INTO "SecurityProjectionCompletion" ("runId","status","observationCount") VALUES ($1,$2,1)',
          [badRun.id, 'OK'],
        );
        ok(
          'actual read refuses payload ' + defect + ' disagreement',
          (await repository.findByGeography({ geographyId: 'GB' })).succeeded === false,
        );
        const next = await repository.startRun('GB', 1440);
        ok(
          'actual write refuses prior payload ' + defect + ' disagreement',
          (await repository.completeRun(next, [original], 'OK')) === false,
        );
      }
      article.summary = 'Publisher corrected the retained report.';
      phase = 'real revised article';
      ok(phase, (await producer.produce('PL')) === 'OK');
      ok(
        'real changed report appends revision',
        (
          await q(
            'SELECT max("revisionOrdinal") n FROM "SecurityObservation" WHERE "geographyId"=$1',
            ['PL'],
          )
        ).rows[0].n === 1,
      );
      article.title = 'Army troops opened fire.';
      phase = 'real reclassification';
      ok(phase, (await producer.produce('PL')) === 'NO_RESULTS');
      ok(
        'real reclassification has no stale current observation',
        (await repository.findByGeography({ geographyId: 'PL' })).observations.length === 0,
      );
      const failedRepository = new SecurityObservationRepository({
        securityProjectionRun: prisma.securityProjectionRun,
        $transaction: async () => {
          throw new Error('test-injected completion failure');
        },
      });
      phase = 'real failed completion';
      ok(
        phase,
        (await new SecurityProducerService(corpus, failedRepository).produce('PL')) ===
          'SOURCE_UNAVAILABLE',
      );
      ok(
        'real unfinished latest run blocks stale fallback',
        (await repository.findByGeography({ geographyId: 'PL' })).succeeded === false,
      );
      const before = (await q('SELECT count(*)::int n FROM "SecurityProjectionRun"')).rows[0].n;
      const publicResponse = await new SecurityReadService().readForGeography({
        countryCode: 'PL',
      });
      ok(
        'public GET writes zero rows',
        (await q('SELECT count(*)::int n FROM "SecurityProjectionRun"')).rows[0].n === before,
      );
      ok(
        'public GET exposes no copied person text',
        !JSON.stringify(publicResponse).includes('John Example') &&
          publicResponse.absence === 'NOT_ASSESSED',
      );
    } finally {
      await prisma.$disconnect();
    }
    await rejects('rollback refuses retained audit evidence', down);
    // Roll back the standalone DO block failure before cleanup if the driver used implicit grouping.
    await q('ROLLBACK');

    const emptySchema = schema + '_empty';
    await q('CREATE SCHEMA "' + emptySchema + '"');
    try {
      await q('SET search_path TO "' + emptySchema + '"');
      await q(up);
      await q(down);
      ok(
        'empty rollback removes all introduced functions',
        (
          await q(
            'SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1',
            [emptySchema],
          )
        ).rows[0].n === 0,
      );
      ok(
        'empty rollback removes all introduced tables',
        (await q('SELECT count(*)::int n FROM pg_tables WHERE schemaname=$1', [emptySchema]))
          .rows[0].n === 0,
      );
    } finally {
      await q('DROP SCHEMA "' + emptySchema + '" CASCADE');
      await q('SET search_path TO "' + schema + '"');
    }
    console.log(JSON.stringify({ status: 'PASS', checks: passed.length, passed }, null, 2));
  } finally {
    if (created) await q('DROP SCHEMA "' + schema + '" CASCADE');
    await db.end();
  }
}
main().catch((error) => {
  console.error(
    JSON.stringify({
      status: 'FAIL',
      phase,
      code: error.code ?? 'ASSERTION',
      reason:
        phase === 'configuration'
          ? 'Local connection configuration unavailable or refused'
          : 'See phase; connection details suppressed',
    }),
  );
  process.exitCode = 1;
});
