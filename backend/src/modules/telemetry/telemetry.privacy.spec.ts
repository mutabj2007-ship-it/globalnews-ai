import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ACCOUNT_SCOPED_EVENTS } from './account-scoped-events';
import { ProductEventName } from '../../generated/prisma/enums';

/**
 * R3/T7 — THE PRIVACY CONTRACT, PROVEN.
 *
 * Telemetry is where a platform's stated values meet its incentives. It
 * is easy to write a policy saying no PII is collected and easy to
 * collect it anyway, so this file asserts the properties rather than the
 * intentions, over the SHIPPED SOURCE and over the SCHEMA.
 *
 * The strongest assertions here are about ABSENCE: there is no column an
 * IP could occupy, no field a user-agent could travel through, and no
 * dependency that could beacon anywhere. A thing that does not exist
 * cannot be misconfigured.
 */
const TELEMETRY_DIR = __dirname;
const BACKEND_ROOT = join(__dirname, '..', '..', '..');

const stripComments = (source: string): string =>
  source
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const productFiles = (): string[] =>
  readdirSync(TELEMETRY_DIR, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? // P-1 - this value is an IDENTIFIER compared against a literal below,
          // not a filesystem path, so its separator is spelled explicitly.
          // join() would emit the PLATFORM separator ('dto\record-event.dto.ts'
          // on Windows), which passed in CI and failed on native Windows while
          // the module under test was correct on both. read() still resolves
          // this form: path.join() normalises a forward slash on Windows. The
          // join() below builds a real path and is deliberately unchanged.
          readdirSync(join(TELEMETRY_DIR, entry.name)).map((child) => `${entry.name}/${child}`)
        : [entry.name],
    )
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'));

const read = (name: string): string =>
  stripComments(readFileSync(join(TELEMETRY_DIR, name), 'utf8'));

/**
 * LINE ENDINGS NORMALISED ON READ, AND THAT IS A CORRECTNESS FIX.
 *
 * This repository is checked out with CRLF on Windows and LF in CI. The
 * block-slicing below looks for the blank line separating two model
 * declarations; under CRLF that separator is \r\n\r\n, so a scan written
 * for \n\n silently matches nothing and the "block" becomes the whole
 * file. A CRLF mirror run caught exactly that in this file — the
 * assertions passed on LF and failed on CRLF while the schema was
 * correct on both, which is the same defect the F-S3 guard-chain
 * assertion had.
 */
const SCHEMA = readFileSync(join(BACKEND_ROOT, 'prisma', 'schema.prisma'), 'utf8').replace(
  /\r\n/g,
  '\n',
);

/**
 * The model declaration PLUS the `///` doc comment immediately above it,
 * because in this schema the retention rule is written where the columns
 * are — in that comment — and a block that started at `model` would miss
 * the very thing this file asserts is present.
 */
const modelBlock = (name: string): string => {
  const declaration = SCHEMA.indexOf(`model ${name} {`);
  expect(declaration).toBeGreaterThan(-1);

  // Everything back to the blank line that separates this declaration
  // from the previous one, which is exactly the doc-comment paragraph
  // attached to this model.
  const preamble = SCHEMA.slice(0, declaration);
  const lastBlank = preamble.lastIndexOf('\n\n');
  const start = lastBlank === -1 ? 0 : lastBlank + 2;

  const rest = SCHEMA.slice(declaration + 1);
  const next = rest.search(/\n(model|enum) /);
  return next === -1 ? SCHEMA.slice(start) : SCHEMA.slice(start, declaration + 1 + next);
};

/**
 * The same block with every comment removed. A doc comment that NAMES a
 * forbidden column in order to say the column does not exist is the
 * opposite of storing one, and an assertion that punished the explanation
 * would push the explanation out of the schema.
 */
const modelFields = (name: string): string =>
  modelBlock(name)
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('///') && !line.trimStart().startsWith('//'))
    .join('\n');

describe('R3/T7 — no personally identifying data is collected', () => {
  it('finds the telemetry product files', () => {
    expect(productFiles().sort()).toEqual([
      'account-scoped-events.ts',
      'dto/record-event.dto.ts',
      'telemetry.controller.ts',
      'telemetry.interceptor.ts',
      'telemetry.module.ts',
      'telemetry.service.ts',
    ]);
  });

  it('NO telemetry file reads an IP address, a user-agent, a header or a cookie', () => {
    productFiles().forEach((name) => {
      const source = read(name);
      [
        'req.ip',
        'request.ip',
        '.ips',
        'user-agent',
        'userAgent',
        'headers[',
        '.headers',
        'cookie',
        'x-forwarded-for',
      ].forEach((forbidden) => {
        expect({
          name,
          forbidden,
          present: source.toLowerCase().includes(forbidden.toLowerCase()),
        }).toEqual({
          name,
          forbidden,
          present: false,
        });
      });
    });
  });

  it('NO telemetry file touches an email address', () => {
    productFiles().forEach((name) => {
      const source = read(name);
      expect({ name, email: /email/i.test(source) }).toEqual({ name, email: false });
      // No email literal either.
      const literals = source.match(/'[^']*'|"[^"]*"|`[^`]*`/g) ?? [];
      literals.forEach((literal) => {
        expect(/@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(literal)).toBe(false);
      });
    });
  });

  it('THE SCHEMA HAS NO COLUMN THOSE COULD OCCUPY — absence, not discipline', () => {
    [modelFields('ProductEvent'), modelFields('AnalysisRun')].forEach((block) => {
      ['email', 'ipAddress', ' ip ', 'userAgent', 'sessionId', 'deviceId', 'fingerprint'].forEach(
        (forbidden) => {
          expect({
            forbidden,
            present: block.toLowerCase().includes(forbidden.toLowerCase()),
          }).toEqual({
            forbidden,
            present: false,
          });
        },
      );
    });
  });

  it('no article or evidence BODY is duplicated — the dimensions are ids and enums only', () => {
    const block = modelFields('ProductEvent');

    ['title', 'url', 'summary', 'body', 'content', 'snippet', 'query'].forEach((forbidden) => {
      expect({ forbidden, present: new RegExp(`\\b${forbidden}\\b`, 'i').test(block) }).toEqual({
        forbidden,
        present: false,
      });
    });

    // What it DOES store, in full. Any addition to this list is a
    // deliberate, reviewable act.
    const fields = (block.match(/^\s{2}(\w+)\s+\S/gm) ?? []).map(
      (line) => line.trim().split(/\s+/)[0],
    );
    expect(fields.sort()).toEqual([
      'countryCode',
      'createdAt',
      'id',
      'language',
      'name',
      'subjectId',
      'user',
      'userId',
    ]);
  });
});

describe('R3/T7 — account linkage is limited to three events', () => {
  it('the list is exactly the three the architecture permits', () => {
    expect([...ACCOUNT_SCOPED_EVENTS].sort()).toEqual([
      'follow_created',
      'follow_removed',
      'return_visit',
    ]);
  });

  it('the public ingest endpoint has NO guard, NO session read and NO user parameter', () => {
    const controller = read('telemetry.controller.ts');

    // There is no code path here that could attach an account, whatever
    // the caller sends — the absence of the mechanism is the guarantee.
    expect(controller).not.toContain('@CurrentUser');
    expect(controller).not.toContain('RequireAuthGuard');
    expect(controller).not.toContain('SessionService');
    expect(controller).not.toContain('userId');
  });

  it('the ingest DTO declares no user identifier', () => {
    const dto = read('dto/record-event.dto.ts');

    ['userId', 'accountId', 'anonymousId', 'visitorId', 'clientId'].forEach((forbidden) => {
      expect({ forbidden, present: dto.includes(forbidden) }).toEqual({
        forbidden,
        present: false,
      });
    });
  });

  it('no anonymous identifier is minted anywhere in the module', () => {
    productFiles().forEach((name) => {
      const source = read(name);
      expect({
        name,
        minted: /randomUUID|nanoid|uuidv4|generateId|visitorId/i.test(source),
      }).toEqual({
        name,
        minted: false,
      });
    });
  });
});

describe('R3/T7 — the store is append-only', () => {
  it('the service contains no update, upsert or delete path', () => {
    const service = read('telemetry.service.ts');

    ['.update(', '.updateMany(', '.upsert(', '.delete(', '.deleteMany('].forEach((forbidden) => {
      expect({ forbidden, present: service.includes(forbidden) }).toEqual({
        forbidden,
        present: false,
      });
    });
  });

  it('no telemetry route mutates an existing row', () => {
    const controller = read('telemetry.controller.ts');

    expect(controller).not.toMatch(/@(Put|Patch|Delete)\(/);
    expect(controller.match(/@(Get|Post)\(/g) ?? []).toEqual(['@Post(']);
  });

  it('the module exposes no read route — telemetry is written here, never served', () => {
    const controller = read('telemetry.controller.ts');
    expect(controller).not.toMatch(/@Get\(/);
  });
});

describe('R3/T7 — no third-party tracker, no analytics SDK', () => {
  it('the module adds no dependency of any kind', () => {
    productFiles().forEach((name) => {
      const source = read(name);
      const imports = source.match(/from '([^']+)'/g) ?? [];
      imports.forEach((raw) => {
        const target = raw.replace(/from '|'/g, '');
        const allowed =
          target.startsWith('.') ||
          target.startsWith('@nestjs/') ||
          target === '@globalnews-ai/shared' ||
          target === 'rxjs' ||
          target === 'express' ||
          // Already used by every DTO in this project. Validation is not
          // a tracker.
          target === 'class-validator' ||
          target === 'class-transformer';
        expect({ name, target, allowed }).toEqual({ name, target, allowed: true });
      });
    });
  });

  it('package.json gained no analytics, tracker or beacon dependency', () => {
    const pkg = JSON.parse(readFileSync(join(BACKEND_ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];

    names.forEach((dependency) => {
      expect({
        dependency,
        tracker:
          /analytics|segment|mixpanel|amplitude|posthog|heap|hotjar|fullstory|gtag|google-analytics|facebook|doubleclick|adroll/i.test(
            dependency,
          ),
      }).toEqual({ dependency, tracker: false });
    });
  });

  it('no telemetry file makes an outbound request', () => {
    productFiles().forEach((name) => {
      const source = read(name);
      expect({
        name,
        outbound: /fetch\(|axios|node-fetch|https?\.request|sendBeacon/i.test(source),
      }).toEqual({ name, outbound: false });
    });
  });
});

describe('R3/T7 — the vocabulary and the retention rule', () => {
  it('the twelve approved event names exist, and no thirteenth', () => {
    expect(Object.values(ProductEventName).sort()).toEqual(
      [
        'analysis_completed',
        'analysis_started',
        'country_filter',
        'evidence_open',
        'follow_created',
        'follow_removed',
        'language_selected',
        'return_visit',
        'source_open',
        'today_item_open',
        'today_view',
        'world_map_open',
      ].sort(),
    );
  });

  it('the ingest DTO validates against the Prisma enum itself, so the two cannot drift', () => {
    const dto = read('dto/record-event.dto.ts');
    expect(dto).toContain('ProductEventName');
    expect(dto).toContain('@IsIn(PRODUCT_EVENT_NAMES)');
  });

  it('the retention rule is recorded in the schema, where the columns are', () => {
    // Comments are deliberately NOT stripped: the rule is the artefact.
    ['ProductEvent', 'AnalysisRun'].forEach((model) => {
      const block = modelBlock(model);
      expect(block).toMatch(/RETENTION: 90 days/);
      // And it says plainly that nothing enforces it yet, because
      // claiming enforced retention while no purge job exists would be
      // exactly the kind of untrue statement this platform refuses.
      expect(block).toMatch(/DECLARED, NOT YET ENFORCED/);
    });
  });

  it('account deletion SETS NULL rather than cascading, so aggregate history stays true', () => {
    expect(modelFields('ProductEvent')).toContain('onDelete: SetNull');
    expect(modelFields('AnalysisRun')).not.toContain('userId');
  });

  it('AnalysisRun stores NO cost — no price table exists in this repository', () => {
    const block = modelFields('AnalysisRun');
    expect(block.toLowerCase()).not.toMatch(/costusd|\bprice\b|\bcost\b\s+\w/);
    expect(block).toContain('promptTokens');
    expect(block).toContain('latencyMs');
  });
});
