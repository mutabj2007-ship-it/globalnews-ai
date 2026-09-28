import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  requiresExplicitAcceptance,
  SAND_CHARGING_ENABLED,
} from '../modules/ask-v2/ask-compute.contract';
import { planRevision } from '../modules/ask-v2/ask-r2-execution.adapter';
import { routeAskR2 } from '../modules/ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../modules/ask-router/frozen-c/fixtures/specialist-registry.fixture';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE H — H's HANDOFF ROWS, backend half
 * ════════════════════════════════════════════════════════════════════════════
 *
 * H's package was never on disk (Gate A register); its 22 rows reach this lane only as
 * Main R1.1's one-line assertions. Several name routes contract §15 replaced: the result
 * identity is the Ask V2 OPERATION (`GET /ask-v2/operations/:id`, `/ask?operation=`), not
 * `/analysis/results/:id` or `/search?op=`. Each row is evaluated against the route that
 * exists, and where H's premise and the contract differ the row says so (EXPLAINED), never
 * a silent PASS. Live-Postgres behaviour (0 AI on read, owner-404, privacy headers) is
 * proven by ask-v2.postgres.spec / ask-r2-execution.postgres.spec and joined in the merge.
 */

const SERVICE = readFileSync(join(__dirname, '../modules/ask-v2/ask-v2.service.ts'), 'utf8');
const CONTROLLER = readFileSync(join(__dirname, '../modules/ask-v2/ask-v2.controller.ts'), 'utf8');
const ADAPTER = readFileSync(
  join(__dirname, '../modules/ask-v2/ask-r2-execution.adapter.ts'),
  'utf8',
);
const DTO = readFileSync(join(__dirname, '../modules/ask-v2/ask-v2.dto.ts'), 'utf8');

/** The body of `async <name>(` up to the matching closing brace of the method. */
function methodBody(source: string, name: string): string {
  const start = source.indexOf(`async ${name}(`);
  if (start < 0) throw new Error(`no method ${name}`);
  const open = source.indexOf('{', source.indexOf(')', start));
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(open, i + 1);
  }
  throw new Error('unbalanced');
}

const results: { id: string; verdict: string; path: string; observed: string; note?: string }[] =
  [];
function record(
  id: string,
  verdict: string,
  path: string,
  observed: unknown,
  note?: string,
): string {
  results.push({
    id,
    verdict,
    path,
    observed: JSON.stringify(observed),
    ...(note ? { note } : {}),
  });
  return verdict;
}
afterAll(() => {
  const out = process.env.QUAL_OUT;
  if (out !== undefined) writeFileSync(out, JSON.stringify(results, null, 1) + '\n');
});

describe('H — the read cannot compute', () => {
  it('H-G1 / H-T01: GET operations/:id calls only getOperation, and getOperation only reads', () => {
    const route =
      /@Get\('operations\/:id'\) operation\([\s\S]*?\) \{\s*return this\.ask\.getOperation\(user\.id, id\);\s*\}/.test(
        CONTROLLER,
      );
    const body = methodBody(SERVICE, 'getOperation');
    const writes =
      body.match(
        /\.(update|upsert|create|delete|updateMany|createMany)\(|execute|executor|reserve|settle|analy[sz]e|provider|quote\(/g,
      ) ?? [];
    const v = record(
      'H-G1',
      route && writes.length === 0 ? 'PASS' : 'FAIL',
      'source guard: controller route + getOperation body',
      { routeOnlyReads: route, computeOrWriteTokens: writes },
    );
    record(
      'H-T01',
      v,
      'H-G1 guard + live "opening an existing result is display-only: 0 AI" (merge)',
      { routeOnlyReads: route },
      'Route per contract §15: GET /ask-v2/operations/:id, not /analysis/results/:id.',
    );
    expect(v).toBe('PASS');
  });

  it('H-T03: the read handler reaches no provider or execute path — at FUNCTION level', () => {
    const body = methodBody(SERVICE, 'getOperation');
    const calls = [...body.matchAll(/this\.([a-zA-Z]+)\(/g)].map((m) => m[1]);
    const ok = calls.every((c) => ['atomic', 'owned'].includes(c!));
    record(
      'H-T03',
      ok ? 'EXPLAINED' : 'FAIL',
      'source: calls made by getOperation',
      { calls },
      'getOperation calls only atomic() and owned() (Prisma reads). The MODULE import graph does include the execution port, because contract §15 keeps the read a thin seam over the SAME Ask V2 authority that also executes; a separate read module would be the parallel identity §15 forbids.',
    );
    expect(ok).toBe(true);
  });

  it('H-T05: another owner’s id and a never-existing id take the SAME not-found', () => {
    const owned = methodBody(SERVICE, 'owned');
    const ok =
      /findFirst\(\{ where: \{ id, userId \} \}\)/.test(owned) &&
      /throw new NotFoundException\(\);/.test(owned);
    const v = record('H-T05', ok ? 'PASS' : 'FAIL', 'source: owned() + live owner-404 (merge)', {
      ownerScopedLookup: ok,
    });
    expect(v).toBe('PASS');
  });
});

describe('H — result state is honest', () => {
  it('H-T06: an expired stored result is displayed as expired, and nothing runs on arrival', () => {
    const body = methodBody(SERVICE, 'getOperation');
    const ok =
      /expired: result\.expiresAt\.getTime\(\) <= Date\.now\(\)/.test(body) &&
      /displayOnly: true/.test(body);
    record(
      'H-T06',
      ok ? 'EXPLAINED' : 'FAIL',
      'source: getOperation result view',
      { expiredField: ok },
      'H asks for HTTP 410. The landed Ask V2 read (contract §15 authority) returns the owner’s operation with result.expired=true and displayOnly=true; /ask shows "This saved answer has expired · shown as it was, not re-checked" and makes no request. The question is carried in the stored payload.',
    );
    expect(ok).toBe(true);
  });

  it('H-T07: an operation with no stored result reads with result null — the operation itself is not a 404', () => {
    const body = methodBody(SERVICE, 'getOperation');
    const ok =
      /result:\s*result && operation\.status === 'COMPLETED'/.test(body) &&
      /failureCode: operation\.failureCode/.test(body);
    record(
      'H-T07',
      ok ? 'EXPLAINED' : 'FAIL',
      'source: getOperation',
      { resultNullWhenNotCompleted: ok, failureCodeInBody: true },
      'H’s premise is a RESULT identity (no result → 404). Under §15 the identity is the OPERATION, which exists; its result is null. failureCode IS in the owner-only body, deliberately: F’s one-refusal-shape rule names the control that refused (e.g. BUDGET_REFUSED:account-day). Owner-scoped, private, no-store.',
    );
    expect(ok).toBe(true);
  });

  it('H-T08: a reuse is marked on the reusing operation', () => {
    const ok = /storedResultReused: operation\.storedResultReused/.test(
      methodBody(SERVICE, 'getOperation'),
    );
    record(
      'H-T08',
      ok ? 'EXPLAINED' : 'FAIL',
      'source + live "the same question asked again reuses the stored result: 0 additional AI" (merge)',
      { reuseFlagExposed: ok },
      'Ask V2 marks storedResultReused on the operation that REUSED a result; the operation that computed it is not a reuse and is not marked one. H’s "both carry" wording is read as both reusing operations.',
    );
    expect(ok).toBe(true);
  });

  it('H-T09: a fresh bounded answer never satisfies a deep-analysis intent (different plan revision)', () => {
    const deps = { specialistRegistry: specialistRegistryFixture };
    const q = 'What is happening in Kenya?';
    const route = routeAskR2(
      {
        originalQuestion: q,
        sourceLanguage: 'en',
        normalizationLanguage: 'en',
        displayLanguage: 'en',
        origin: 'ASK',
      },
      { computeConsent: 'GRANTED' },
      deps,
    );
    const ask = planRevision({ question: q, language: 'en', intent: 'ask' }, route);
    const deep = planRevision({ question: q, language: 'en', intent: 'deep-analysis' }, route);
    const v = record('H-T09', ask !== deep ? 'PASS' : 'FAIL', 'planRevision keys reuse by intent', {
      differs: ask !== deep,
    });
    expect(v).toBe('PASS');
  });

  it('H-T10: DEEP_ANALYSIS requires explicit acceptance; a GET moves nothing (H-G1)', () => {
    const v = record(
      'H-T10',
      requiresExplicitAcceptance('DEEP_ANALYSIS') && !requiresExplicitAcceptance('FRESH_BOUNDED')
        ? 'PASS'
        : 'FAIL',
      'requiresExplicitAcceptance',
      { deep: requiresExplicitAcceptance('DEEP_ANALYSIS') },
    );
    expect(v).toBe('PASS');
  });

  it('H-T11: an escalation carries the question only — no field of the prior envelope crosses', () => {
    const quote = DTO.slice(
      DTO.indexOf('class QuoteTurnDto'),
      DTO.indexOf('}', DTO.indexOf('class QuoteTurnDto')),
    );
    const fields = [...quote.matchAll(/(\w+)!?:\s*\w+/g)].map((m) => m[1]);
    const ok = fields.join(',') === 'idempotencyKey,question,language,intent';
    const v = record(
      'H-T11',
      ok ? 'PASS' : 'FAIL',
      'QuoteTurnDto fields (whitelist + forbidNonWhitelisted)',
      { fields },
      'There is no escalatedFrom field at all: Run deeper quotes a NEW deep-analysis operation for the same question.',
    );
    expect(v).toBe('PASS');
  });

  it('H-T15: the plan’s disclosures survive into the stored payload', () => {
    const v = record(
      'H-T15',
      /disclosures: route\.plan\.disclosures/.test(ADAPTER) ? 'PASS' : 'FAIL',
      'adapter payload source',
      {},
    );
    expect(v).toBe('PASS');
  });

  it('H-G7 / H-T14 (backend): charging is a false literal', () => {
    record(
      'H-G7:backend',
      SAND_CHARGING_ENABLED === false ? 'PASS' : 'FAIL',
      'SAND_CHARGING_ENABLED literal',
      { SAND_CHARGING_ENABLED },
    );
    expect(SAND_CHARGING_ENABLED).toBe(false);
  });
});

describe('E1 implementation-facing checks (NOT an E1 certification)', () => {
  it('E1-006: the Ask R2 telemetry line carries no account or IP identity', () => {
    const start = ADAPTER.indexOf('this.logger.log(');
    const line = ADAPTER.slice(start, ADAPTER.indexOf(');', start));
    /* `questionClass` / `questionLanguage` are routing facts; the reader's text is `request.question`. */
    const leaks = line.match(/accountId|ipScope|who\.|userId|request\.question/g) ?? [];
    const v = record(
      'E1-006',
      leaks.length === 0 ? 'IMPLEMENTED_NOT_CERTIFIED' : 'FAIL',
      'adapter log line source',
      { leaks },
      'Identity now resolves server-side (AskRequestContext); the rule is re-asserted: the one Ask R2 log line names operation, class, terminal, normalization, language, answer state and aiExecuted — never the account, the IP scope or the question text.',
    );
    expect(leaks).toEqual([]);
    expect(v).toBe('IMPLEMENTED_NOT_CERTIFIED');
  });

  it('E1-009: retrieved article text cannot reach a tool, a fetch, a mutation or an identity — no such capability exists', () => {
    const provider = readFileSync(
      join(__dirname, '../modules/analysis/providers/openai-analysis.provider.ts'),
      'utf8',
    );
    const capability =
      provider.match(/\btools\b|tool_choice|function_call|functions\s*:|parallel_tool_calls/g) ??
      [];
    const oneCall = (ADAPTER.match(/this\.analysis\.analyzeNews\(/g) ?? []).length === 1;
    const v = record(
      'E1-009',
      capability.length === 0 && oneCall ? 'IMPLEMENTED_NOT_CERTIFIED' : 'FAIL',
      'provider + adapter source',
      { toolCapabilityTokens: capability, singleAnalysisCall: oneCall },
      'Asserted by ABSENCE: the provider request declares no tools/functions, and the adapter makes one analysis call whose output is stored as a display payload — nothing it returns is executed, fetched or used as an identity.',
    );
    expect(v).toBe('IMPLEMENTED_NOT_CERTIFIED');
  });
});
