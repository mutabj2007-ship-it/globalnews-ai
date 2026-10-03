import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  ASK_ACCESS_EVENTS,
  ASK_ROUTE_PATHS,
  EMITTED_ASK_ROUTE_PATHS,
  GOVERNED_GEOGRAPHY_CODES,
  accessBucketStart,
  sanitizeGeographyCodes,
} from './ask-observation.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN ASK INTELLIGENCE OBSERVABILITY R1 — THE PRIVACY CONTRACT, PROVEN
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The brief's first rule is that this is NOT a raw-prompt surveillance screen. That is
 * easy to write down and easy to violate later, so this file asserts the PROPERTIES —
 * over the shipped source and over the schema — rather than the intention.
 *
 * The strongest assertions here are about ABSENCE: there is no column a question could
 * occupy, no parameter one could travel through, and no code path that reads the table
 * that holds them. A thing that does not exist cannot be misconfigured.
 */
const OBSERVABILITY_DIR = __dirname;
const MODULES_DIR = join(__dirname, '..');
const BACKEND_ROOT = join(__dirname, '..', '..', '..');

const stripComments = (source: string): string =>
  source
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const productFiles = (): string[] =>
  readdirSync(OBSERVABILITY_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name)
    .filter((name) => !name.endsWith('.spec.ts'));

const read = (name: string): string =>
  stripComments(readFileSync(join(OBSERVABILITY_DIR, name), 'utf8'));

/**
 * LINE ENDINGS NORMALISED ON READ, and that is a correctness fix rather than tidiness:
 * this repository is checked out CRLF on Windows and LF in CI, and the block slicing below
 * looks for the blank line between two model declarations. The telemetry privacy spec
 * records the same defect being found by a CRLF mirror run.
 */
const SCHEMA = readFileSync(join(BACKEND_ROOT, 'prisma', 'schema.prisma'), 'utf8').replace(
  /\r\n/g,
  '\n',
);

const modelBlock = (name: string): string => {
  const declaration = SCHEMA.indexOf(`model ${name} {`);
  expect(declaration).toBeGreaterThan(-1);
  const rest = SCHEMA.slice(declaration + 1);
  const next = rest.search(/\n(model|enum) /);
  return next === -1
    ? SCHEMA.slice(declaration)
    : SCHEMA.slice(declaration, declaration + 1 + next);
};

/**
 * The same block with every comment removed. A doc comment that NAMES a forbidden column
 * in order to say the column does not exist is the opposite of storing one, and an
 * assertion that punished the explanation would push the explanation out of the schema.
 */
const modelFields = (name: string): string =>
  modelBlock(name)
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('///') && !line.trimStart().startsWith('//'))
    .join('\n');

describe('R1 — the observation schema has no column a question could occupy', () => {
  /**
   * TWO INSTRUMENTS, BECAUSE ONE OF THEM HAS FALSE POSITIVES AND THE OTHER HAS BLIND SPOTS.
   *
   * `FORBIDDEN_FIELD_NAMES` is matched against WHOLE FIELD NAMES. A substring scan for
   * `prompt` or `query` would condemn `promptTokens` and `queryIntent`, which are a token
   * count and a classifier enum — and a guard that cries wolf gets relaxed, which is worse
   * than no guard. `FORBIDDEN_SUBSTRINGS` is the substring pass, restricted to fragments
   * that have no innocent spelling in this schema.
   */
  const FORBIDDEN_FIELD_NAMES = [
    'question',
    'prompt',
    'query',
    'text',
    'body',
    'content',
    'snippet',
    'title',
    'summary',
    'url',
    'email',
    'user',
    'userId',
    'ip',
    'ipAddress',
    'userAgent',
    'sessionId',
    'deviceId',
    'fingerprint',
    'accountId',
    'subjectRef',
    'cost',
    'price',
    'readerTerms',
    'topicTerms',
    'statedPeriod',
    'matchedText',
    'rawQuestion',
  ].map((name) => name.toLowerCase());

  const FORBIDDEN_SUBSTRINGS = [
    'rawquestion',
    'readerterms',
    'topicterms',
    /*
      `statedperiod` is NOT on this list, and the omission is deliberate rather than an
      oversight: `statedPeriodPresent` is a boolean that records WHETHER the reader stated a
      period, which is precisely the presence-only shape this contract chose instead of
      storing the phrase. The exact-field-name pass above still condemns a bare
      `statedPeriod`, and the full field list below condemns any spelling of it.
    */
    'matchedtext',
    'email',
    'useragent',
    'ipaddress',
    'sessionid',
    'deviceid',
    'fingerprint',
    'accountid',
    'subjectref',
    'userid',
  ];

  const fieldNamesOf = (model: string): string[] =>
    (modelFields(model).match(/^\s{2}(\w+)\s+\S/gm) ?? []).map(
      (line) => line.trim().split(/\s+/)[0],
    );

  const assertClean = (model: string): void => {
    const names = fieldNamesOf(model).map((name) => name.toLowerCase());
    FORBIDDEN_FIELD_NAMES.forEach((forbidden) => {
      expect({ model, forbidden, present: names.includes(forbidden) }).toEqual({
        model,
        forbidden,
        present: false,
      });
    });
    const block = modelFields(model).toLowerCase();
    FORBIDDEN_SUBSTRINGS.forEach((forbidden) => {
      expect({ model, forbidden, present: block.includes(forbidden) }).toEqual({
        model,
        forbidden,
        present: false,
      });
    });
  };

  it('AskObservation declares none of them', () => {
    assertClean('AskObservation');
  });

  it('AskAccessCounter declares none of them either — an unauthenticated counter holds no identity', () => {
    assertClean('AskAccessCounter');
  });

  /**
   * POSITIVE CONTROL. The absence assertions above are only meaningful if the instrument
   * can detect a column that IS there — a scan pointed at the wrong block, or a regex that
   * matches nothing, would pass every one of them. `AskTurn` is the model that genuinely
   * holds the reader's question, and `AskThread` the one that genuinely holds an account
   * reference, so both must trip the same instruments.
   */
  it('POSITIVE CONTROL — the same instruments DO condemn AskTurn and AskThread', () => {
    const turnNames = fieldNamesOf('AskTurn').map((name) => name.toLowerCase());
    expect(turnNames).toContain('question');

    const threadNames = fieldNamesOf('AskThread').map((name) => name.toLowerCase());
    expect(threadNames).toContain('userid');
    expect(modelFields('AskThread').toLowerCase()).toContain('userid');
  });

  it('what AskObservation DOES store is exactly this list — any addition is a deliberate act', () => {
    expect(fieldNamesOf('AskObservation').sort()).toEqual(
      [
        'adapterVersion',
        'aiExecuted',
        'answerBasis',
        'answerState',
        'askPublicComputeEnabled',
        'askR2Enabled',
        'breakerOutcome',
        'capabilityUnavailable',
        'clarificationCodes',
        'clarificationRequired',
        'completionTokens',
        'computeClass',
        /* ASK INTELLIGENCE BINDING R1 — governed contributor IDS and one count; never content. */
        'contributorItemCount',
        'contributorsConsidered',
        'contributorsDegraded',
        'contributorsUsed',
        'disclosureCodes',
        'domainCount',
        'domains',
        'evidenceRolesMissing',
        'evidenceRolesObtained',
        'evidenceRolesRequested',
        'failureCode',
        'geographyCodes',
        'geographyCodesDropped',
        'geographyPrecision',
        'geographyPresent',
        'geographySources',
        'id',
        'identityState',
        'languageClassification',
        'latencyMs',
        'modelInvocationCount',
        'normalizationStatus',
        'occurredAt',
        'operationId',
        'promptTokens',
        'providerCallCount',
        'providerId',
        'queryIntent',
        'questionClass',
        'questionLanguage',
        'refusalCodes',
        'reportingItemCount',
        'requestLanguage',
        'routePath',
        'schemaVersion',
        'scopedBy',
        /* CTO R4 semantic IR — codes only (closed vocabularies, governed place codes, counts) */
        'semanticActorCodes',
        'semanticClauseCount',
        'semanticCompleteness',
        'semanticConflicts',
        'semanticEvidence',
        'semanticFreshness',
        'semanticInterpreterCompletionTokens',
        'semanticInterpreterPromptTokens',
        'semanticObjectCodes',
        'semanticObjectiveSourceTurn',
        'semanticPath',
        'semanticReferenceKind',
        'semanticRelation',
        'semanticUnresolvedFields',
        'semanticVenueCodes',
        'statedPeriodPresent',
        'temporalRequirement',
        'terminalState',
        'tokensMeasured',
        'topicPresent',
        /* CTO R4 closeout — the governed user job as CODES from closed vocabularies (the writer
           drops anything else); never model prose, never an artifact's label or components. */
        'jobArtifactProducedKind',
        'jobArtifactUsedKind',
        'jobClassifierUsed',
        'jobDepth',
        'jobDiscourseReference',
        'jobFreshness',
        'jobKind',
        'jobSource',
        'jobTransformation',
      ].sort(),
    );
  });

  it('the observation is UNIQUE per operation — one explicit Ask, at most one observation', () => {
    expect(modelFields('AskObservation')).toMatch(/operationId\s+String\s+@unique/);
  });

  it('it has no relation to any model, so no join can reach an account from it', () => {
    /* A Prisma relation is declared with @relation. None here means nothing to traverse. */
    expect(modelFields('AskObservation')).not.toContain('@relation');
    expect(modelFields('AskAccessCounter')).not.toContain('@relation');
  });
});

describe('R1 — no observability source file can reach a question', () => {
  it('finds the product files', () => {
    expect(productFiles().sort()).toEqual([
      'ask-observability.module.ts',
      'ask-observation-retention.service.ts',
      'ask-observation.contract.ts',
      'ask-observation.service.ts',
    ]);
  });

  it('none of them reads a request, a header, an address, a cookie or a user-agent', () => {
    productFiles().forEach((name) => {
      const source = read(name).toLowerCase();
      [
        'req.ip',
        'request.ip',
        '.ips',
        'user-agent',
        'useragent',
        'headers[',
        '.headers',
        'cookie',
        'x-forwarded-for',
      ].forEach((forbidden) => {
        expect({ name, forbidden, present: source.includes(forbidden) }).toEqual({
          name,
          forbidden,
          present: false,
        });
      });
    });
  });

  it('none of them touches an email address, a question, a prompt or a search query', () => {
    productFiles().forEach((name) => {
      const source = read(name);
      expect({ name, hit: /email|askturn|searchhistory|\bprompt(?!Tokens)/i.test(source) }).toEqual(
        {
          name,
          hit: false,
        },
      );
      const literals = source.match(/'[^']*'|"[^"]*"|`[^`]*`/g) ?? [];
      literals.forEach((literal) => {
        expect(/@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(literal)).toBe(false);
      });
    });
  });

  it('the writer is append-only — no update, no upsert and no delete on the observation', () => {
    const service = read('ask-observation.service.ts');
    expect(service).not.toMatch(/askObservation\.(update|upsert|delete|deleteMany)/);
    /* The counter's merge is an increment and nothing else: it may not overwrite a total. */
    expect(service).not.toMatch(/askAccessCounter\.(update\b|delete|deleteMany)/);
    expect(service).toContain('increment');
  });

  /**
   * RETENTION IS THE ONE DELETE, AND IT LIVES IN ITS OWN FILE SO THAT SENTENCE STAYS TRUE.
   *
   * Putting an age-based purge inside the writer would have meant the writer could delete,
   * and "append-only" would then depend on reading the predicate rather than on the file
   * having no such call at all.
   */
  it('the only delete in the module is the retention sweep, and its only predicate is age', () => {
    const retention = read('ask-observation-retention.service.ts');
    expect(retention).toContain('askObservation.deleteMany');
    expect(retention).toContain('askAccessCounter.deleteMany');

    const deletes =
      retention.match(/(askObservation|askAccessCounter)\.deleteMany\([\s\S]*?\}\)/g) ?? [];
    expect(deletes.length).toBe(2);
    /* Age, or a set of ids the age scan itself chose. Nothing else may narrow a purge. */
    deletes.forEach((call) => {
      expect(/occurredAt|bucketStart|id: \{ in:/.test(call)).toBe(true);
      ['questionClass', 'answerState', 'providerId', 'routePath', 'operationId'].forEach(
        (column) => {
          expect({ call, column, present: call.includes(column) }).toEqual({
            call,
            column,
            present: false,
          });
        },
      );
    });
  });

  it('the module serves nothing — there is no controller and no read method', () => {
    const module = read('ask-observability.module.ts');
    expect(module).not.toContain('controllers');
    expect(read('ask-observation.service.ts')).not.toMatch(
      /askObservation\.(findMany|findFirst|findUnique|groupBy|aggregate|count)/,
    );
  });
});

describe('R1 — geography codes are an allow-list, not a convention', () => {
  it('keeps governed ISO3 codes and the resolver marker', () => {
    const result = sanitizeGeographyCodes(['RWA', 'POL', 'CONTESTED']);
    expect(result).toEqual({ codes: ['RWA', 'POL', 'CONTESTED'], dropped: 0 });
  });

  it('POSITIVE CONTROL — free text in that position is DROPPED and counted, never stored', () => {
    const leak = 'the street in Warsaw where I live';
    const result = sanitizeGeographyCodes(['RWA', leak, 'not-a-code', '']);
    expect(result.codes).toEqual(['RWA']);
    expect(result.dropped).toBe(3);
    expect(result.codes.join(' ')).not.toContain('Warsaw');
  });

  it('de-duplicates rather than inflating a count from one question', () => {
    expect(sanitizeGeographyCodes(['RWA', 'RWA', 'RWA']).codes).toEqual(['RWA']);
  });

  it('the governed vocabulary is large enough to be the real ISO3 list, and holds no free text', () => {
    expect(GOVERNED_GEOGRAPHY_CODES.size).toBeGreaterThan(150);
    [...GOVERNED_GEOGRAPHY_CODES].forEach((code) => {
      expect(code).toMatch(/^[A-Z]{3,9}$/);
    });
  });
});

describe('R1 — the declared route paths, and the one with an emitter', () => {
  it('declares both, and instruments only the Ask R2 adapter', () => {
    expect([...ASK_ROUTE_PATHS]).toEqual(['ASK_R2', 'LEGACY_ANALYSIS']);
    expect([...EMITTED_ASK_ROUTE_PATHS]).toEqual(['ASK_R2']);
  });

  /**
   * "Not instrumented" is a MEASUREMENT about this codebase, not a promise. If somebody
   * wires the legacy path later, this fails until `EMITTED_ASK_ROUTE_PATHS` is corrected —
   * and correcting it is what makes the Admin screen stop saying the panel is empty
   * because nobody measured it.
   */
  it('no source file EMITS LEGACY_ANALYSIS — the Admin surface may READ the name to state the gap', () => {
    /*
      The scan looks for an ASSIGNMENT of the value into `routePath`, not for the string.
      The Admin reader mentions the name on purpose — it asks whether the path is
      instrumented so the screen can say "not instrumented" instead of rendering a zero —
      and a scan that condemned the mention would have forced the screen to go quiet about
      the very gap it exists to name.
    */
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        if (!entry.isFile() || !entry.name.endsWith('.ts')) return;
        if (entry.name.endsWith('.spec.ts')) return;
        const source = stripComments(readFileSync(full, 'utf8'));
        if (/routePath\s*[:=]\s*'LEGACY_ANALYSIS'/.test(source)) offenders.push(full);
      });
    };
    walk(MODULES_DIR);
    expect(offenders).toEqual([]);
  });

  it('POSITIVE CONTROL — that same scan DOES find the path the adapter really emits', () => {
    const contract = readFileSync(join(OBSERVABILITY_DIR, 'ask-observation.contract.ts'), 'utf8');
    expect(/routePath\s*[:=]\s*'ASK_R2'/.test(contract)).toBe(true);
  });
});

describe('R1 — the access counter is bounded by the clock, not by the caller', () => {
  it('declares exactly the two events that are reachable without a credential', () => {
    expect([...ASK_ACCESS_EVENTS]).toEqual(['SIGNED_OUT_ATTEMPT', 'ASK_SURFACE_ABSENT']);
  });

  it('buckets to the hour, so cardinality is events x hours and nothing a caller supplies', () => {
    const start = accessBucketStart(new Date('2026-09-29T13:47:31.500Z'));
    expect(start.toISOString()).toBe('2026-09-29T13:00:00.000Z');
    expect(accessBucketStart(new Date('2026-09-29T13:00:00.000Z')).toISOString()).toBe(
      '2026-09-29T13:00:00.000Z',
    );
    expect(accessBucketStart(new Date('2026-09-29T14:00:00.000Z')).toISOString()).toBe(
      '2026-09-29T14:00:00.000Z',
    );
  });
});
