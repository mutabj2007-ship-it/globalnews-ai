import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/*
  CTO POLITICS SECURITY INTEGRATION RULING (E1-POL-1 / G4) — Politics never binds into the loose
  `entities.people` channel and holds no person-level structure. Enforced by ABSENCE: the stored
  columns are an enumerated set read from the actual schema, and no Politics source file reaches
  the people extractor, the analysis people field or any person-keyed shape.
*/
const BACKEND = join(__dirname, '../../..');
const REPO = join(BACKEND, '..');

const POLITICS_OBSERVATION_COLUMNS = [
  'id', 'observationKey', 'upstreamAuthority', 'upstreamId', 'subjectType', 'subjectId', 'observationKind',
  'claim', 'temporal', 'provenance', 'sourceReference', 'attributeAuthorship', 'revision', 'publication',
  'revisionOrdinal', 'publishedAt', 'sourceUpdatedAt', 'artifactSha256', 'review', 'reinstatement', 'snapshotRetrievalId',
  'snapshotAdmissibility', 'snapshotRetrieval', 'effectiveOn', 'retrievedAt', 'temporalBasis', 'language',
  'countryIso3', 'ingestedAt',
].sort();

function modelFields(schema: string, model: string): string[] {
  const body = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
  return body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//') && !l.startsWith('@@'))
    .map(l => l.split(/\s+/)[0]).sort();
}

describe('Politics holds no person channel (enforced by absence)', () => {
  it('the retained store columns equal the enumerated set — a silently added column fails', () => {
    const schema = readFileSync(join(BACKEND, 'prisma/schema.prisma'), 'utf8');
    expect(modelFields(schema, 'PoliticsObservation')).toEqual(POLITICS_OBSERVATION_COLUMNS);
  });

  it('no person-shaped name exists in the store, its migration or the shared Politics record', () => {
    const migration = ['20261004120000_politics_observation_store', '20261004130000_politics_reinstatement']
      .map(m => readFileSync(join(BACKEND, 'prisma/migrations', m, 'migration.sql'), 'utf8')).join(' ');
    const shared = readFileSync(join(REPO, 'shared/src/politics/retained.ts'), 'utf8');
    // Code only: comments may (and do) state the prohibition itself.
    const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/--.*$/gm, '');
    for (const text of [POLITICS_OBSERVATION_COLUMNS.join(' '), code(migration), code(shared)]) {
      expect(text).not.toMatch(/\b(people|person|persons|personId|personName|officeholderName|candidateName)\b/i);
    }
  });

  it('no Politics backend source reaches the loose people channel', () => {
    const dir = __dirname;
    for (const file of readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.spec.ts'))) {
      const text = readFileSync(join(dir, file), 'utf8');
      expect({ file, hit: /article-entities\.util|extractTitledPeople|PERSON_TITLES|entities\.people|validate-analysis-result/.test(text) })
        .toEqual({ file, hit: false });
    }
  });
});
