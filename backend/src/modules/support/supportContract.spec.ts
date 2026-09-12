import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  SUPPORT_AUTHOR_TYPES,
  SUPPORT_CATEGORIES,
  SUPPORT_MESSAGE_VISIBILITIES,
  SUPPORT_REFERENCE_ALPHABET,
  SUPPORT_REFERENCE_BODY_LENGTH,
  SUPPORT_REFERENCE_PATTERN,
  SUPPORT_REFERENCE_PREFIX,
  SUPPORT_TICKET_STATUSES,
} from '@globalnews-ai/shared';

/**
 * Support loop S1 — the contracts and the persistence shape, proven
 * against the files that ship.
 *
 * WHY THESE ASSERTIONS LIVE HERE RATHER THAN IN shared/ OR backend/test/.
 * Neither of those directories is executed by anything:
 * `shared/src/*.spec.ts` is outside both workspaces' Jest roots, and
 * `backend/test/*.spec.ts` matches neither the backend Jest config
 * (rootDir "src") nor the e2e config (testRegex ".e2e-spec.ts$"). CI
 * runs `npm test --workspace=backend` and nothing else, so
 * backend/src is the only place a guarantee can actually be enforced.
 * The dead-test configuration itself is recorded as separate technical
 * debt and is deliberately NOT repaired here.
 *
 * Everything below is source analysis, this repository's established
 * technique: it asserts properties of the SHIPPED SOURCE rather than of
 * a running instance, because S1 has no runtime behaviour to observe.
 */
const SCHEMA = readFileSync(join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'), 'utf-8');

/**
 * Comments are stripped before every source scan below.
 *
 * A doc comment that NAMES what S1 deliberately does not contain — "no
 * SupportService, no import of AnalysisModule" — is the opposite of
 * smuggling those things in, and an assertion that punished the
 * explanation would push the explanation out of the file. Anything in
 * actual code is still caught.
 */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'prisma', 'migrations');
const SUPPORT_MIGRATION_DIR = '20260822053000_add_support_tickets';
const MIGRATION = readFileSync(
  join(MIGRATIONS_DIR, SUPPORT_MIGRATION_DIR, 'migration.sql'),
  'utf-8',
);

/** The members of a Prisma enum block, in declaration order. */
function prismaEnumMembers(name: string): string[] {
  const start = SCHEMA.indexOf(`enum ${name} {`);
  expect(start).toBeGreaterThan(-1);
  const body = SCHEMA.slice(start + `enum ${name} {`.length, SCHEMA.indexOf('}', start));
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*$/.test(line));
}

/** One model block, bounded at the next model/enum rather than at EOF. */
function prismaModel(name: string): string {
  const start = SCHEMA.indexOf(`model ${name} {`);
  expect(start).toBeGreaterThan(-1);
  const rest = SCHEMA.slice(start + 1);
  const nextBoundary = rest.search(/\n(model|enum) /);
  return nextBoundary === -1 ? SCHEMA.slice(start) : SCHEMA.slice(start, start + 1 + nextBoundary);
}

describe('S1 — shared/Prisma contract parity', () => {
  it('the seven approved categories exist, in the approved order, on both sides', () => {
    const approved = [
      'NEWS_QUESTION',
      'BUG_REPORT',
      'CONTENT_REPORT',
      'FEEDBACK',
      'ABUSE_REPORT',
      'ACCOUNT_PROBLEM',
      'OTHER',
    ];

    expect(SUPPORT_CATEGORIES).toEqual(approved);
    expect(prismaEnumMembers('SupportCategory')).toEqual(approved);
  });

  it('ticket status is identical on both sides', () => {
    expect(prismaEnumMembers('SupportTicketStatus')).toEqual([...SUPPORT_TICKET_STATUSES]);
  });

  it('message visibility is identical on both sides — exactly PUBLIC and INTERNAL', () => {
    expect([...SUPPORT_MESSAGE_VISIBILITIES]).toEqual(['PUBLIC', 'INTERNAL']);
    expect(prismaEnumMembers('SupportMessageVisibility')).toEqual([
      ...SUPPORT_MESSAGE_VISIBILITIES,
    ]);
  });

  it('author type is identical on both sides, and SYSTEM_AI is distinct from ADMIN', () => {
    expect(prismaEnumMembers('SupportAuthorType')).toEqual([...SUPPORT_AUTHOR_TYPES]);
    expect(SUPPORT_AUTHOR_TYPES).toContain('SYSTEM_AI');
    expect(SUPPORT_AUTHOR_TYPES.indexOf('SYSTEM_AI')).not.toBe(
      SUPPORT_AUTHOR_TYPES.indexOf('ADMIN'),
    );
  });

  it('no shared support member is missing from Prisma, in either direction', () => {
    const pairs: Array<[string, readonly string[]]> = [
      ['SupportCategory', SUPPORT_CATEGORIES],
      ['SupportTicketStatus', SUPPORT_TICKET_STATUSES],
      ['SupportMessageVisibility', SUPPORT_MESSAGE_VISIBILITIES],
      ['SupportAuthorType', SUPPORT_AUTHOR_TYPES],
    ];

    pairs.forEach(([enumName, sharedValues]) => {
      expect({ enumName, members: prismaEnumMembers(enumName).sort() }).toEqual({
        enumName,
        members: [...sharedValues].sort(),
      });
    });
  });
});

describe('S1 — the reference contract declares a shape and generates nothing', () => {
  it('is GN- plus ten characters', () => {
    expect(SUPPORT_REFERENCE_PREFIX).toBe('GN-');
    expect(SUPPORT_REFERENCE_BODY_LENGTH).toBe(10);
  });

  it('uses the Crockford alphabet — I, L, O and U are excluded', () => {
    ['I', 'L', 'O', 'U'].forEach((letter) => {
      expect(SUPPORT_REFERENCE_ALPHABET).not.toContain(letter);
    });
    expect(SUPPORT_REFERENCE_ALPHABET).toHaveLength(32);
  });

  it('the pattern accepts a well-formed reference and rejects the excluded letters', () => {
    expect(SUPPORT_REFERENCE_PATTERN.test('GN-7QK2M4XR9T')).toBe(true);

    ['GN-IQK2M4XR9T', 'GN-LQK2M4XR9T', 'GN-OQK2M4XR9T', 'GN-UQK2M4XR9T'].forEach((bad) => {
      expect({ bad, accepted: SUPPORT_REFERENCE_PATTERN.test(bad) }).toEqual({
        bad,
        accepted: false,
      });
    });
  });

  it('rejects a sequential-looking reference — opacity is the point', () => {
    expect(SUPPORT_REFERENCE_PATTERN.test('GN-1042')).toBe(false);
    expect(SUPPORT_REFERENCE_PATTERN.test('GN-2026-0001')).toBe(false);
  });

  /**
   * S2 REPLACED THIS ASSERTION, AND THE REPLACEMENT IS STRONGER.
   *
   * S1 asserted that no generator existed. That was a statement about a
   * milestone boundary, not a security property, and it expired the
   * moment S2 shipped the generator. What matters permanently is that
   * every reference comes from the shared contract's alphabet and
   * pattern, and that nothing weaker — a counter, a timestamp, a
   * non-cryptographic random — can be substituted.
   */
  it('the generator draws only from the shared alphabet, using the system CSPRNG', () => {
    const generator = withoutComments(
      readFileSync(join(__dirname, 'support-reference.util.ts'), 'utf-8'),
    );

    expect(generator).toContain('SUPPORT_REFERENCE_ALPHABET');
    expect(generator).toContain('randomInt');
    expect(generator).toContain("from 'crypto'");

    // Not a counter, not a clock, not Math.random.
    expect(generator).not.toMatch(/Math\.random/);
    expect(generator).not.toMatch(/Date\.now|new Date\(/);
    expect(generator).not.toMatch(/count\(|\+\+ *reference|sequence/i);
  });

  it('the generator never checks the database — the unique constraint is the authority', () => {
    const generator = withoutComments(
      readFileSync(join(__dirname, 'support-reference.util.ts'), 'utf-8'),
    );

    expect(generator).not.toMatch(/prisma|Prisma|findUnique|findFirst/);
  });
});

describe('S1 — persistence shape and cascade guarantees', () => {
  it('SupportTicket cascades from User — Option A, so DELETE /users/me still removes everything', () => {
    const model = prismaModel('SupportTicket');
    expect(model).toMatch(
      /user\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/,
    );
  });

  it('SupportMessage cascades from SupportTicket', () => {
    const model = prismaModel('SupportMessage');
    expect(model).toMatch(
      /ticket\s+SupportTicket\s+@relation\(fields: \[ticketId\], references: \[id\], onDelete: Cascade\)/,
    );
  });

  it('User declares the fourth cascading relation', () => {
    expect(prismaModel('User')).toMatch(/supportTickets\s+SupportTicket\[\]/);
  });

  it('authorId carries NO relation to User — an admin deleting their account must not erase another user’s thread', () => {
    const model = prismaModel('SupportMessage');

    expect(model).toMatch(/authorId\s+String\?/);
    // Exactly one @relation in this model, and it is the ticket one.
    expect(model.match(/@relation\(/g) ?? []).toHaveLength(1);
    expect(model).not.toMatch(/authorId.*@relation/);
    expect(model).not.toMatch(/author\s+User/);
  });

  it('visibility is NOT NULL and defaults to PUBLIC — a note can never be null-visibility', () => {
    const model = prismaModel('SupportMessage');

    expect(model).toMatch(/visibility\s+SupportMessageVisibility\s+@default\(PUBLIC\)/);
    // No `?` on the visibility field: it is required.
    expect(model).not.toMatch(/visibility\s+SupportMessageVisibility\?/);
  });

  it('the ticket reference is unique, so a generator collision is a database error rather than a duplicate', () => {
    expect(prismaModel('SupportTicket')).toMatch(/reference\s+String\s+@unique/);
  });

  it('neither support model declares an articleId', () => {
    expect(prismaModel('SupportTicket')).not.toMatch(/articleId/);
    expect(prismaModel('SupportMessage')).not.toMatch(/articleId/);
  });

  it('the ticket owner is REQUIRED — there is no orphaned or nullable ownership in S1', () => {
    const model = prismaModel('SupportTicket');
    expect(model).toMatch(/userId\s+String\b/);
    expect(model).not.toMatch(/userId\s+String\?/);
    expect(model).not.toMatch(/onDelete:\s*SetNull/);
  });
});

describe('S1 — the migration is additive and destroys nothing', () => {
  /**
   * R1/R3 — this assertion USED TO BE `toHaveLength(6)`, which was a
   * count of the migrations that happened to exist on the day S1 landed.
   * That is not a property of the support migration; it is a property of
   * the calendar, and it broke the moment any later milestone added one.
   *
   * NAMING THE SIX IS STRICTLY STRONGER THAN COUNTING THEM. A count of
   * six is satisfied by six arbitrary directories. This asserts that
   * every migration S1 depended on is still present AND still in order,
   * so a deletion or a rename fails here — which a length check would
   * have missed entirely as long as the total stayed the same.
   */
  it('is registered as a migration directory, and every migration S1 depends on is still present', () => {
    const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(dirs).toContain(SUPPORT_MIGRATION_DIR);

    [
      '20260807050251_init_article_storage',
      '20260807121042_add_article_sources_count',
      '20260808051558_add_article_country_relations',
      '20260815120000_add_accounts_and_history',
      '20260821090500_add_admin_role',
      '20260822053000_add_support_tickets',
    ].forEach((required) => {
      expect({ required, present: dirs.includes(required) }).toEqual({ required, present: true });
    });

    // The support migration must remain the LAST of the six it shipped
    // with, so nothing has been inserted before it and re-ordered the
    // schema history S1 assumes.
    const supportIndex = dirs.indexOf(SUPPORT_MIGRATION_DIR);
    expect(dirs.indexOf('20260821090500_add_admin_role')).toBeLessThan(supportIndex);
  });

  it('creates four enums, two tables, four indexes and two foreign keys', () => {
    expect(MIGRATION.match(/CREATE TYPE/g) ?? []).toHaveLength(4);
    expect(MIGRATION.match(/CREATE TABLE/g) ?? []).toHaveLength(2);
    expect(MIGRATION.match(/CREATE (UNIQUE )?INDEX/g) ?? []).toHaveLength(4);
    expect(MIGRATION.match(/ADD CONSTRAINT/g) ?? []).toHaveLength(2);
  });

  it('contains NO destructive or mutating statement — no existing row is touched', () => {
    // Anchored at the start of a statement on purpose. An unanchored
    // /DELETE/ would match the `ON DELETE CASCADE` clause of a foreign
    // key, which is a referential rule rather than a delete — the
    // assertion has to distinguish those or it is worthless.
    const forbidden = [
      /^\s*DROP\s/im,
      /^\s*UPDATE\s/im,
      /^\s*DELETE\s+FROM/im,
      /^\s*TRUNCATE\s/im,
      /^\s*ALTER TABLE "User"/im,
    ];

    forbidden.forEach((pattern) => {
      expect({ pattern: pattern.source, found: pattern.test(MIGRATION) }).toEqual({
        pattern: pattern.source,
        found: false,
      });
    });

    // And positively: every STATEMENT in the file is one of the additive
    // kinds. Split on the terminator rather than on lines, so a table
    // body's `CONSTRAINT ... PRIMARY KEY` clause is read as part of its
    // CREATE TABLE rather than mistaken for a statement of its own.
    const leadingKeywords = MIGRATION.split(';')
      .map((statement) =>
        statement
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith('--'))
          .join(' '),
      )
      .filter((statement) => statement.length > 0)
      .map((statement) => statement.split(/\s+/).slice(0, 3).join(' '));

    expect(leadingKeywords).toHaveLength(12);

    leadingKeywords.forEach((opening) => {
      expect({
        opening,
        additive:
          /^(CREATE TYPE|CREATE TABLE|CREATE UNIQUE|CREATE INDEX|ALTER TABLE "Support)/.test(
            opening,
          ),
      }).toEqual({
        opening,
        additive: true,
      });
    });
  });

  it('both foreign keys cascade on delete, matching the schema', () => {
    expect(MIGRATION).toMatch(
      /"SupportTicket_userId_fkey" FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE CASCADE/,
    );
    expect(MIGRATION).toMatch(
      /"SupportMessage_ticketId_fkey" FOREIGN KEY \("ticketId"\) REFERENCES "SupportTicket"\("id"\) ON DELETE CASCADE/,
    );
  });

  it('the enum members in SQL match the schema exactly', () => {
    const sqlMembers = (typeName: string): string[] => {
      const match = new RegExp(`CREATE TYPE "${typeName}" AS ENUM \\(([^)]*)\\)`).exec(MIGRATION);
      expect(match).not.toBeNull();
      return (match?.[1].match(/'[A-Z_]+'/g) ?? []).map((raw) => raw.replace(/'/g, ''));
    };

    [
      'SupportCategory',
      'SupportTicketStatus',
      'SupportMessageVisibility',
      'SupportAuthorType',
    ].forEach((name) => {
      expect({ name, sql: sqlMembers(name) }).toEqual({ name, sql: prismaEnumMembers(name) });
    });
  });
});

describe('S2 — the HTTP surface exists, and every route is locked down', () => {
  /**
   * S1 ASSERTED THAT NONE OF THIS EXISTED. Those four checks were
   * "S2 has not happened yet" markers with an expiry date, and this is
   * the expiry. Each is replaced below by the permanent invariant it
   * was standing in for: authenticated routes, CSRF on mutations,
   * ownership from the session, and no client-settable status.
   *
   * Nothing was relaxed to make S2 pass. The module may now declare a
   * controller and touch Prisma — what it may NOT do is expose an
   * unauthenticated route, accept an identity from a request, or let a
   * browser name a status.
   */
  const supportFiles = readdirSync(__dirname).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'),
  );

  const controller = withoutComments(
    readFileSync(join(__dirname, 'support.controller.ts'), 'utf-8'),
  );
  const module = withoutComments(readFileSync(join(__dirname, 'support.module.ts'), 'utf-8'));

  it('finds the support module source', () => {
    expect(supportFiles).toContain('support.module.ts');
    expect(supportFiles).toContain('support.controller.ts');
    expect(supportFiles).toContain('support.service.ts');
  });

  it('exposes exactly four routes: two reads and two mutations', () => {
    const verbs = controller.match(/@(Get|Post|Put|Patch|Delete)\(/g) ?? [];

    expect(verbs.sort()).toEqual(['@Get(', '@Get(', '@Post(', '@Post(']);
  });

  it('NO route is anonymous — the guard is on the class, not sprinkled per route', () => {
    expect(controller).toMatch(/@Controller\('support'\)\s*@UseGuards\(RequireAuthGuard\)/);
  });

  it('every mutating route carries CsrfGuard', () => {
    const mutations = controller.split(/@(?=Post\()/).slice(1);

    expect(mutations).toHaveLength(2);
    mutations.forEach((route) => {
      expect({ route: route.slice(0, 30), guarded: route.includes('CsrfGuard') }).toEqual({
        route: route.slice(0, 30),
        guarded: true,
      });
    });
  });

  it('NO route accepts a status — reopening is derived, never requested', () => {
    const dto = withoutComments(readFileSync(join(__dirname, 'dto', 'support.dto.ts'), 'utf-8'));

    expect(dto).not.toContain('status');
    expect(controller).not.toContain('status');
  });

  /*
    SUPPORT-AI-1 — THESE THREE GUARDS WERE NARROWED, NOT DELETED.

    They used to assert that Support performed no AI work AT ALL, which
    was the truth from S2 until this milestone. That statement is now
    false, and a guard that is false is worse than no guard: the next
    person to read it learns something untrue about the system.

    What they assert instead is the property that actually has to hold
    now, and it is a stricter one than "somewhere in this directory there
    is no AI":

      - NO DIRECT PROVIDER CLIENT anywhere under modules/support. There
        is one analysis pipeline in this codebase and Support calls it;
        it does not own a second one.
      - AnalysisService is named in EXACTLY ONE FILE. A single integration
        point is what makes the privacy boundary, the cost bound and the
        no-loop property auditable rather than distributed.
      - SYSTEM_AI is written in EXACTLY ONE FILE, and it is not either of
        the two files that write a human's message.
  */
  const SUPPORT_AI_FILE = 'support-ai.service.ts';

  const namesIn = (pattern: RegExp): string[] =>
    supportFiles.filter((name) =>
      pattern.test(withoutComments(readFileSync(join(__dirname, name), 'utf-8'))),
    );

  it('the module wires its own controller and services, and imports the EXISTING analysis module', () => {
    expect(module).toContain('SupportController');
    expect(module).toContain('SupportService');
    expect(module).toContain('SupportAiService');
    // Imported, never reimplemented, and never an OpenAI client of its own.
    expect(module).toContain('AnalysisModule');
    expect(module).not.toMatch(/OpenAi|openai/i);
    // Not exported: nothing outside support may invoke the support agent.
    expect(module).not.toMatch(/exports:\s*\[[^\]]*SupportAiService/);
  });

  it('NO support file contains a direct provider client — there is no second pipeline', () => {
    expect(namesIn(/openai|OpenAi|new OpenAI|ANALYSIS_PROVIDER/)).toEqual([]);
  });

  it('AnalysisService is reachable from EXACTLY ONE support file', () => {
    expect(namesIn(/AnalysisService/)).toEqual([SUPPORT_AI_FILE]);
  });

  it('NEWS_QUESTION is special-cased in EXACTLY ONE support file', () => {
    // The controller, the DTOs, the user service and the admin service
    // still treat the seven categories identically.
    expect(namesIn(/NEWS_QUESTION/)).toEqual([SUPPORT_AI_FILE]);
  });

  it('SYSTEM_AI is written in EXACTLY ONE file — never by the admin service', () => {
    /*
      One writer, and it is not the file that composes the reply. The
      agent decides WHAT to say; support.service.ts decides that a
      machine said it. Keeping those apart means the authorship of a
      support message is settled in one place that a reviewer can read
      end to end.
    */
    expect(namesIn(/'SYSTEM_AI'/)).toEqual(['support.service.ts']);
  });

  it('the agent is invoked from ticket CREATION only — an AI-to-AI loop is structurally impossible', () => {
    const service = withoutComments(readFileSync(join(__dirname, 'support.service.ts'), 'utf-8'));
    const calls = service.match(/answerNewsQuestion\(/g) ?? [];

    // One call site. addMessage -- the path a SYSTEM_AI or ADMIN message
    // would have to travel to trigger another reply -- does not have one.
    expect(calls).toHaveLength(1);
    const addMessage = service.slice(service.indexOf('async addMessage('));
    expect(addMessage).not.toContain('answerNewsQuestion');
    expect(addMessage).not.toContain('supportAi');
  });
});
