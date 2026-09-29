import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  ADMIN_ASK_ALERT_IDS,
  ADMIN_ASK_ARRAY_SAMPLE_LIMIT,
  ADMIN_ASK_POOR_OUTCOME_STATES,
  ADMIN_ASK_THRESHOLD_SOURCES,
} from './admin-ask-intelligence.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R1 — "THIS IS NOT A RAW-PROMPT SURVEILLANCE SCREEN", ASSERTED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The brief's first sentence is a constraint on what the Admin surface may contain, so it
 * is asserted over the CONTRACT — the shape a screen is allowed to receive — rather than
 * over the service that happens to fill it today. A field that does not exist cannot be
 * rendered by a future screen, cannot be exported, and cannot be reached by an endpoint
 * somebody adds next quarter.
 */
const DIR = __dirname;

const stripComments = (source: string): string =>
  source
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const files = (): string[] =>
  readdirSync(DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name);

const productFiles = (): string[] => files().filter((name) => !name.endsWith('.spec.ts'));

const read = (name: string): string => stripComments(readFileSync(join(DIR, name), 'utf8'));

/**
 * Property names of every `export interface` in a source file, comments stripped first —
 * the same instrument the landed analytics parity spec uses, and for the same reason: a
 * doc comment that names a field in order to explain why it is ABSENT must not be read as
 * a declaration of it.
 */
function interfacesOf(source: string): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const match of source.matchAll(/export interface (\w+)\s*\{([^}]*)\}/g)) {
    found[match[1]] = (match[2].match(/^\s*(\w+)\??\s*:/gm) ?? [])
      .map((raw) => raw.replace(/[^\w]/g, ''))
      .sort();
  }
  return found;
}

describe('R1 — the contract has no field a question or a person could travel through', () => {
  const contract = read('admin-ask-intelligence.contract.ts');
  const declared = interfacesOf(contract);

  const FORBIDDEN = [
    'question',
    'questionText',
    'rawQuestion',
    'prompt',
    'promptText',
    'query',
    'searchQuery',
    'utterance',
    'readerTerms',
    'topicTerms',
    'statedPeriod',
    'matchedText',
    'answerText',
    'articleBody',
    'providerResponse',
    'email',
    'emailDomain',
    'maskedEmail',
    'displayName',
    'userId',
    'accountId',
    'operationId',
    'fingerprint',
    'ipAddress',
    'sessionId',
    'deviceId',
    'deviceClass',
    'audienceCountry',
    'userCountry',
    'city',
    'latitude',
    'longitude',
    'setBy',
    'actor',
    'costUsd',
    'costPln',
    'spendUsd',
  ];

  it('finds the contract interfaces', () => {
    expect(Object.keys(declared).length).toBeGreaterThanOrEqual(14);
  });

  it('NOT ONE interface in the contract declares any of them', () => {
    Object.entries(declared).forEach(([name, fields]) => {
      expect({ name, present: fields.filter((field) => FORBIDDEN.includes(field)) }).toEqual({
        name,
        present: [],
      });
    });
  });

  /**
   * POSITIVE CONTROL. The sweep above is only meaningful if the instrument can find a
   * field that IS declared — a broken regex, or a file read that returned nothing, would
   * pass every assertion in this block. So the same parser is run over a contract that
   * deliberately declares two of the forbidden names.
   */
  it('POSITIVE CONTROL — the same parser DOES condemn an interface carrying them', () => {
    const contaminated = `
      export interface Contaminated {
        question: string;
        userId: string;
        count: number;
      }
    `;
    const parsed = interfacesOf(contaminated);
    expect(parsed.Contaminated).toEqual(['count', 'question', 'userId'].sort());
    expect(parsed.Contaminated.filter((field) => FORBIDDEN.includes(field)).sort()).toEqual([
      'question',
      'userId',
    ]);
  });

  it('the disclosures say so in the type itself, not only in prose', () => {
    const block = contract.slice(contract.indexOf('export interface AdminAskDisclosures'));
    expect(block).toContain('rawQuestionStored: false');
    expect(block).toContain('questionReviewImplemented: false');
    expect(block).toContain('monetaryCostAvailable: false');
    expect(block).toContain('deviceClassAvailable: false');
    expect(block).toContain('readOnly: true');
  });

  it('every documented key is a machine value, so the surface stays translatable', () => {
    /* A backend that returned a sentence would be untranslatable by construction: the
       screen is EN and PL and the dictionary is the only place words live. */
    expect(contract).toContain('key: string');
    expect(contract).not.toMatch(/label\s*:\s*string/);
    expect(contract).not.toMatch(/message\s*:\s*string/);
    expect(contract).not.toMatch(/description\s*:\s*string/);
  });

  it('clarification is NOT counted as a poor outcome — the router asking back is it working', () => {
    expect([...ADMIN_ASK_POOR_OUTCOME_STATES]).toEqual(['INSUFFICIENT', 'CAPABILITY_UNAVAILABLE']);
    expect(ADMIN_ASK_POOR_OUTCOME_STATES).not.toContain('CLARIFICATION_REQUIRED');
  });

  it('every alert threshold is derived from a landed number, or is marked owner-pending', () => {
    const contract = read('admin-ask-intelligence.contract.ts');
    const service = read('admin-ask-intelligence.service.ts');

    ADMIN_ASK_ALERT_IDS.forEach((id) => {
      expect({ id, emitted: service.includes(`'${id}'`) }).toEqual({ id, emitted: true });
    });

    /* Every source name is either a LANDED_ anchor or the explicit owner-pending marker.
       An alert whose threshold came from nowhere would have to invent a third kind. */
    Object.values(ADMIN_ASK_THRESHOLD_SOURCES).forEach((source) => {
      expect(/^(LANDED_|PO_PENDING$)/.test(source)).toBe(true);
    });
    expect(contract).toContain('PO_PENDING');
  });

  it('an unmeasurable alert is UNKNOWN, never OK — a quiet page is not a healthy one', () => {
    const service = read('admin-ask-intelligence.service.ts');
    const block = service.slice(service.indexOf('const severity: AdminAskAlertSeverity'));
    expect(block.slice(0, 260)).toContain("'UNKNOWN'");
    expect(service).toContain('observed === null');
  });

  it('every list-valued tally is bounded, so an admin read cannot become a table scan', () => {
    expect(ADMIN_ASK_ARRAY_SAMPLE_LIMIT).toBeGreaterThan(0);
    expect(ADMIN_ASK_ARRAY_SAMPLE_LIMIT).toBeLessThanOrEqual(10_000);
  });
});

describe('R1 — the reader is read-only, and cannot reach the tables that hold words', () => {
  it('finds the product files', () => {
    expect(productFiles().sort()).toEqual([
      'admin-ask-intelligence.contract.ts',
      'admin-ask-intelligence.controller.ts',
      'admin-ask-intelligence.service.ts',
    ]);
  });

  it('no product file performs any write, by any spelling', () => {
    productFiles().forEach((name) => {
      const source = read(name);
      [
        '.create(',
        '.createMany(',
        '.update(',
        '.updateMany(',
        '.upsert(',
        '.delete(',
        '.deleteMany(',
        '.executeRaw',
        '$executeRaw',
        /* `.set(` is NOT a needle here: `Map.prototype.set` is how every tally in the
           reader is built, and a guard that condemns a Map gets deleted rather than
           obeyed. The switch service's own mutator is named exactly instead, and the
           write-call list above covers every Prisma spelling. */
        'this.switches.set(',
        'switches.set(',
      ].forEach((forbidden) => {
        expect({ name, forbidden, present: source.includes(forbidden) }).toEqual({
          name,
          forbidden,
          present: false,
        });
      });
    });
  });

  it('every database call is a count, a groupBy, a findMany or an aggregate', () => {
    const service = read('admin-ask-intelligence.service.ts');
    const calls = service.match(/this\.prisma\.\w+\.(\w+)\(/g) ?? [];
    expect(calls.length).toBeGreaterThan(10);
    calls.forEach((call) => {
      expect({ call, read: /\.(count|groupBy|findMany|aggregate)\($/.test(call) }).toEqual({
        call,
        read: true,
      });
    });
  });

  it('it never reads AskTurn, AskThread or SearchHistoryEntry — the tables that hold words', () => {
    productFiles().forEach((name) => {
      const source = read(name);
      ['askTurn', 'askThread', 'searchHistoryEntry', 'storedResult'].forEach((model) => {
        expect({ name, model, present: source.includes(`prisma.${model}`) }).toEqual({
          name,
          model,
          present: false,
        });
      });
    });
  });

  it('it never selects a user reference or the question fingerprint from ComputeOperation', () => {
    const service = read('admin-ask-intelligence.service.ts');
    const operationCalls = service.match(/this\.prisma\.computeOperation\.\w+\([^;]*\)/g) ?? [];
    expect(operationCalls.length).toBeGreaterThan(0);
    operationCalls.forEach((call) => {
      expect({ call, selects: /select\s*:/.test(call) }).toEqual({ call, selects: false });
      ['userId', 'fingerprint', 'plan', 'requestHash', 'clientKey'].forEach((column) => {
        expect({ call, column, present: call.includes(column) }).toEqual({
          call,
          column,
          present: false,
        });
      });
    });
  });

  it('the bounded sample selects an ALLOW-LIST, so a new column cannot start arriving by itself', () => {
    const service = read('admin-ask-intelligence.service.ts');
    const block = service.slice(service.indexOf('private async listSample'));
    const selectBlock = block.slice(block.indexOf('select: {'), block.indexOf('});'));
    const selected = (selectBlock.match(/(\w+): true/g) ?? []).map((raw) => raw.split(':')[0]);
    expect(selected.sort()).toEqual(
      [
        'answerState',
        'domains',
        'evidenceRolesMissing',
        'evidenceRolesObtained',
        'evidenceRolesRequested',
        'geographyCodes',
        'questionClass',
        'refusalCodes',
      ].sort(),
    );
  });

  it('it reads the switches but cannot turn one', () => {
    const service = read('admin-ask-intelligence.service.ts');
    expect(service).toContain('this.switches.state(');
    expect(service).not.toMatch(/this\.switches\.set\b/);
  });
});

describe('R1 — the route is one authorized GET', () => {
  const controller = read('admin-ask-intelligence.controller.ts');

  it('carries the three guards in the order the security model requires', () => {
    expect(controller).toContain(
      '@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)',
    );
  });

  it('exposes exactly one route, and it is a GET', () => {
    expect(controller.match(/@(Get|Post|Put|Patch|Delete)\(/g)).toEqual(['@Get(']);
    expect(controller).toContain("@Get('ask-intelligence')");
  });

  it('the route is capability-gated on analytics.view', () => {
    expect(controller).toContain('@RequireCapability(CAPABILITIES.AnalyticsView)');
  });

  it('there is no export route, and nothing that could become one', () => {
    productFiles().forEach((name) => {
      const source = read(name).toLowerCase();
      /* `'csv'` on its own is a false positive: `analyticsView` lowercases to
         `analyti·csv·iew`. The needles below are the spellings an export would actually
         use. */
      ['export(', 'download', '.csv', 'text/csv', 'attachment', 'streamablefile'].forEach(
        (forbidden) => {
          expect({ name, forbidden, present: source.includes(forbidden) }).toEqual({
            name,
            forbidden,
            present: false,
          });
        },
      );
    });
  });
});
