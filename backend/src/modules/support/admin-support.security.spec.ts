import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { AdminSupportService } from './admin-support.service';
import { SupportService } from './support.service';
import { SupportAiService } from './support-ai.service';
import type { AnalysisService } from '../analysis/service/analysis.service';
import type { ConfigService } from '@nestjs/config';
import { capabilitiesFor } from '../admin/rbac/capabilities';
import {
  buildAdminPrismaDouble,
  emptyStore,
  seedMessage,
  seedTicket,
} from './admin-support.service.spec';
import type { PrismaService } from '../../database/prisma.service';

/**
 * A real SupportAiService with an analysis double that REJECTS.
 *
 * DEFINED LOCALLY RATHER THAN IMPORTED FROM support.service.spec.
 * Importing a .spec module re-registers every test it declares inside
 * the importing suite, so sharing this six-line helper across files
 * would have run sixty-seven unrelated tests twice more per run. The
 * codebase already pays that cost once, deliberately, for the loop
 * spec's shared Prisma double; it is not worth paying again for this.
 */
function buildSupportAi(): SupportAiService {
  const analysis = {
    analyzeNews: (): Promise<never> => Promise.reject(new Error('analysis unavailable in test')),
  } as unknown as AnalysisService;

  return new SupportAiService(analysis, {
    get: (key: string): string | undefined => (key === 'SUPPORT_AI_ENABLED' ? 'true' : undefined),
  } as unknown as ConfigService);
}

/**
 * S3 — THE INTERNAL-NOTE BOUNDARY, PROVEN.
 *
 * This is the file the CTO named as the hard security gate, and every
 * assertion in it is about ONE claim: an administrator's internal note
 * is visible to an administrator and is not visible, not countable and
 * not inferable by the person who opened the ticket.
 *
 * THE SAME TICKET, THE SAME STORE, THE TWO REAL SERVICES. The proof
 * below does not compare two fixtures or two mocks. It seeds one ticket
 * carrying one PUBLIC message and one INTERNAL note, then reads it
 * twice — once through AdminSupportService and once through the
 * unmodified S2 SupportService — against the same in-memory database.
 * Anything the requester's service returns is, by construction, exactly
 * what the requester's HTTP route returns, because that route is a thin
 * pass-through over this method.
 *
 * FOUR INDEPENDENT BARRIERS, AND EACH IS ASSERTED SEPARATELY BELOW, so
 * that no single edit can remove the protection quietly:
 *
 *   1. THE QUERY. Every message read on a user path carries
 *      `visibility: 'PUBLIC'` in its `where`. An INTERNAL row is never
 *      loaded, so it cannot be leaked by a mapper, a log line or a
 *      serializer that has not been written yet.
 *   2. THE RESPONSE TYPE. `SupportMessageView` has no `visibility` and
 *      no `authorId` field at all. There is no property an internal
 *      note or an administrator's identity could travel through.
 *   3. THE REQUEST CONTRACT. No user-facing DTO declares `visibility`,
 *      and the global ValidationPipe runs `forbidNonWhitelisted`, so a
 *      request that tries to submit one is a 400 before any handler
 *      runs.
 *   4. THE CAPABILITY. Every admin support route requires
 *      `support.handle`, which ANALYST does not hold.
 *
 * THE DOUBLE USED HERE IS THE ADMIN ONE, DELIBERATELY. It applies NO
 * visibility filter of its own — it returns every message row it is
 * asked for. If SupportService's PUBLIC filtering lived in a mapper
 * rather than in the query, this file would catch it, because nothing
 * underneath is helping.
 */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * LINE ENDINGS ARE NORMALISED ON READ, AND THAT IS A CORRECTNESS FIX
 * RATHER THAN A CONVENIENCE.
 *
 * This repository is checked out with CRLF on Windows and LF in CI, while
 * the committed blobs are LF either way. A source-analysis assertion that
 * embeds a bare newline is therefore partly testing WHICH MACHINE RAN IT
 * rather than what the code says. Native Windows validation caught exactly
 * that defect in the first version of the guard-chain assertion below: it
 * passed on LF and failed on CRLF while the controller was correct on both.
 *
 * Every scan in this file reads through here, so no assertion in it can
 * acquire that sensitivity again.
 */
const read = (...segments: string[]): string =>
  readFileSync(join(__dirname, ...segments), 'utf8').replace(/\r\n/g, '\n');

/**
 * The user-facing double: identical to the admin one EXCEPT that it
 * honours the `visibility` filter a query asks for.
 *
 * Written by wrapping the admin double rather than by copying it, so
 * the two cannot drift apart and the only difference between them is
 * the one property under test.
 */
function buildUserPrismaDouble(store: ReturnType<typeof emptyStore>): PrismaService {
  const admin = buildAdminPrismaDouble(store) as unknown as {
    supportTicket: {
      findMany: (args: unknown) => Promise<unknown[]>;
      findUnique: (args: {
        where: { reference: string };
        select?: Record<string, unknown>;
      }) => Promise<unknown>;
    };
  };

  const visible = (
    messages: Array<{ visibility: string }>,
    where?: { visibility?: string },
  ): Array<{ visibility: string }> =>
    where?.visibility === undefined
      ? messages
      : messages.filter((message) => message.visibility === where.visibility);

  return {
    supportTicket: {
      findMany: async ({
        where,
        select,
      }: {
        where: { userId?: string };
        select?: { _count?: { select?: { messages?: { where?: { visibility?: string } } } } };
      }): Promise<unknown[]> => {
        const rows = (await admin.supportTicket.findMany({ where: {}, take: 100 })) as Array<{
          userId: string;
          messages: Array<{ visibility: string }>;
        }>;

        return rows
          .filter((row) => where.userId === undefined || row.userId === where.userId)
          .map((row) => ({
            ...row,
            _count: {
              messages: visible(row.messages, select?._count?.select?.messages?.where).length,
            },
          }));
      },

      findFirst: async ({
        where,
        select,
      }: {
        where: { reference: string; userId: string };
        select?: { messages?: { where?: { visibility?: string } } };
      }): Promise<unknown | null> => {
        const ticket = (await admin.supportTicket.findUnique({
          where: { reference: where.reference },
          select: { messages: true },
        })) as
          | (Record<string, unknown> & {
              userId: string;
              messages: Array<{ visibility: string }>;
            })
          | null;

        if (!ticket || ticket.userId !== where.userId) return null;

        return { ...ticket, messages: visible(ticket.messages, select?.messages?.where) };
      },
    },
  } as unknown as PrismaService;
}

/** One ticket, one public message, one internal note. The whole fixture. */
function seedOneTicketWithAnInternalNote(): ReturnType<typeof emptyStore> {
  const store = emptyStore();
  const ticket = seedTicket(store, {
    reference: 'GN-AAAAAAAAAA',
    userId: 'user-1',
    status: 'AWAITING_ADMIN',
  });

  seedMessage(store, {
    ticketId: ticket.id,
    authorType: 'USER',
    authorId: 'user-1',
    visibility: 'PUBLIC',
    body: 'The public message the requester wrote.',
  });

  seedMessage(store, {
    ticketId: ticket.id,
    authorType: 'ADMIN',
    authorId: 'admin-9',
    visibility: 'INTERNAL',
    body: 'INTERNAL-NOTE-BODY-THAT-MUST-NEVER-REACH-THE-REQUESTER',
  });

  return store;
}

describe('S3 GATE — an internal note on the requester’s OWN ticket', () => {
  it('the ADMIN can see the internal note', async () => {
    const store = seedOneTicketWithAnInternalNote();

    const detail = await new AdminSupportService(buildAdminPrismaDouble(store)).ticket(
      'GN-AAAAAAAAAA',
    );

    expect(detail.messages).toHaveLength(2);
    expect(
      detail.messages.some(
        (message) =>
          message.visibility === 'INTERNAL' &&
          message.body === 'INTERNAL-NOTE-BODY-THAT-MUST-NEVER-REACH-THE-REQUESTER',
      ),
    ).toBe(true);
  });

  it('the REQUESTER cannot see it — same ticket, same store, same moment', async () => {
    const store = seedOneTicketWithAnInternalNote();

    const detail = await new SupportService(
      buildUserPrismaDouble(store),
      buildSupportAi(),
    ).getTicket('user-1', 'GN-AAAAAAAAAA');

    expect(detail.messages).toHaveLength(1);
    expect(detail.messages[0].body).toBe('The public message the requester wrote.');
  });

  it('the requester’s MESSAGE COUNT excludes it, in the detail and in the list', async () => {
    const store = seedOneTicketWithAnInternalNote();
    const service = new SupportService(buildUserPrismaDouble(store), buildSupportAi());

    expect((await service.getTicket('user-1', 'GN-AAAAAAAAAA')).messageCount).toBe(1);

    const list = await service.listTickets('user-1');
    expect(list).toHaveLength(1);
    expect(list[0].messageCount).toBe(1);
  });

  it('the requester’s SERIALIZED response contains neither the note body nor the admin’s id', async () => {
    const store = seedOneTicketWithAnInternalNote();
    const service = new SupportService(buildUserPrismaDouble(store), buildSupportAi());

    const serialized = JSON.stringify({
      detail: await service.getTicket('user-1', 'GN-AAAAAAAAAA'),
      list: await service.listTickets('user-1'),
    });

    // The exact strings, not a shape check: this is what would actually
    // travel over the wire to the requester's browser.
    expect(serialized).not.toContain('INTERNAL-NOTE-BODY-THAT-MUST-NEVER-REACH-THE-REQUESTER');
    expect(serialized).not.toContain('admin-9');
    expect(serialized).not.toContain('INTERNAL');
    expect(serialized).not.toContain('authorId');
  });

  it('the ADMIN response and the REQUESTER response disagree, which is the whole point', async () => {
    const store = seedOneTicketWithAnInternalNote();

    const adminDetail = await new AdminSupportService(buildAdminPrismaDouble(store)).ticket(
      'GN-AAAAAAAAAA',
    );
    const userDetail = await new SupportService(
      buildUserPrismaDouble(store),
      buildSupportAi(),
    ).getTicket('user-1', 'GN-AAAAAAAAAA');

    expect(adminDetail.messages.length).toBeGreaterThan(userDetail.messages.length);
    expect(adminDetail.internalNoteCount).toBe(1);
    expect(adminDetail.publicMessageCount).toBe(userDetail.messageCount);
  });
});

describe('S3 GATE — the requester’s service is structurally PUBLIC-filtered', () => {
  const service = stripComments(read('support.service.ts'));

  it('is UNMODIFIED by S3 — every message read still filters at the query level', () => {
    const messageReads = service.match(/messages: \{[\s\S]*?where: \{[^}]*\}/g) ?? [];
    const counts = service.match(/_count: \{[\s\S]*?\}\s*\}/g) ?? [];

    expect(messageReads.length).toBeGreaterThanOrEqual(1);
    messageReads.forEach((block) => {
      expect({ block, filtered: block.includes("visibility: 'PUBLIC'") }).toEqual({
        block,
        filtered: true,
      });
    });

    expect(counts.length).toBeGreaterThanOrEqual(1);
    counts.forEach((block) => {
      expect({ block, filtered: block.includes("visibility: 'PUBLIC'") }).toEqual({
        block,
        filtered: true,
      });
    });
  });

  it('never writes anything but PUBLIC — a user path cannot author an internal note', () => {
    const writes = service.match(/visibility: '[A-Z]+'/g) ?? [];

    expect(writes.length).toBeGreaterThanOrEqual(2);
    expect([...new Set(writes)]).toEqual(["visibility: 'PUBLIC'"]);
  });

  it('the word INTERNAL appears nowhere in the requester’s service, in any position', () => {
    expect(service).not.toContain('INTERNAL');
  });

  it('the ADMIN service and the REQUESTER service are separate files', () => {
    // If they were one class, the scans above would have to be loosened
    // to accommodate the admin reads, and the guarantee would be gone.
    const files = readdirSync(__dirname);
    expect(files).toContain('support.service.ts');
    expect(files).toContain('admin-support.service.ts');
  });
});

describe('S3 GATE — the requester cannot submit a visibility', () => {
  const userDto = stripComments(read('dto', 'support.dto.ts'));
  const userController = stripComments(read('support.controller.ts'));
  const adminDto = stripComments(read('dto', 'admin-support.dto.ts'));

  it('no user-facing DTO declares visibility, authorId, userId or status', () => {
    ['visibility', 'authorId', 'userId', 'status'].forEach((forbidden) => {
      expect({ forbidden, present: userDto.includes(forbidden) }).toEqual({
        forbidden,
        present: false,
      });
    });
  });

  it('the user controller passes only the message body to the service', () => {
    // Whatever else a request body carried, only `body.message` reaches
    // the service — and forbidNonWhitelisted rejects the request before
    // that anyway.
    expect(userController).toMatch(/addMessage\([^)]*body\.message\)/s);
    expect(userController).not.toContain('visibility');
  });

  it('the ADMIN DTO requires visibility and gives it NO default', () => {
    const block = adminDto.slice(
      adminDto.indexOf('export class CreateAdminSupportMessageDto'),
      adminDto.indexOf('export class UpdateSupportStatusDto'),
    );

    expect(block).toContain('@IsIn(SUPPORT_MESSAGE_VISIBILITIES)');
    expect(block).toContain('visibility!:');
    // A default or an optional marker here would let an omitted field
    // fall back to the schema's PUBLIC — which is the exact disclosure
    // this contract exists to prevent.
    expect(block).not.toContain('@IsOptional');
    expect(block).not.toMatch(/visibility\?:/);
    expect(block).not.toMatch(/visibility[^\n]*=\s*'PUBLIC'/);
  });

  it('the admin service reads visibility from the input and never defaults it', () => {
    const adminService = stripComments(read('admin-support.service.ts'));

    expect(adminService).toContain('visibility: input.visibility');
    expect(adminService).not.toMatch(/visibility:\s*'PUBLIC'/);
    expect(adminService).not.toMatch(/visibility\s*\?\?\s*/);
  });
});

describe('S3 GATE — ANALYST cannot reach the admin support endpoints', () => {
  const controller = stripComments(read('admin-support.controller.ts'));

  it('ANALYST does not hold support.handle, and the other three roles do', () => {
    expect(capabilitiesFor('ANALYST')).not.toContain('support.handle');

    expect(capabilitiesFor('SUPER_ADMIN')).toContain('support.handle');
    expect(capabilitiesFor('ADMIN')).toContain('support.handle');
    expect(capabilitiesFor('SUPPORT')).toContain('support.handle');
  });

  it('a caller with no role at all holds nothing', () => {
    expect(capabilitiesFor(null)).toEqual([]);
  });

  it('EVERY admin support route requires support.handle — not one is left on AdminOnly', () => {
    const routes = controller.split(/@(?=Get\(|Post\(|Put\(|Patch\(|Delete\()/).slice(1);

    expect(routes).toHaveLength(4);
    routes.forEach((route) => {
      const head = route.slice(0, 60);
      expect({ head, gated: route.includes('CAPABILITIES.SupportHandle') }).toEqual({
        head,
        gated: true,
      });
      // @AdminOnly() would admit ANALYST, because it requires a role and
      // no particular capability.
      expect({ head, adminOnly: route.includes('@AdminOnly()') }).toEqual({
        head,
        adminOnly: false,
      });
    });
  });

  /**
   * The guard chain, proven as an ORDERED LIST rather than as a source
   * substring.
   *
   * The order is a security property, not a style choice, and each
   * position earns its place:
   *   AdminPlatformEnabledGuard -> 404 when the platform is switched off,
   *                                so "disabled" means ABSENT rather than
   *                                LOCKED, even to an anonymous caller
   *   RequireAuthGuard          -> 401 before any privilege is consulted
   *   AdminGuard                -> 403 for a non-administrator, or one
   *                                lacking support.handle
   * Putting RequireAuthGuard first would make a disabled platform answer
   * 401 instead of 404, telling an anonymous prober that an authenticated
   * route lives at this path.
   *
   * WHY THE ARGUMENT LIST IS PARSED INSTEAD OF STRING-MATCHED. The first
   * version of this test asserted a literal source substring containing a
   * newline between the two decorators. It was right about the security
   * model and wrong about the world: it also asserted that exactly one LF
   * separates them, which is false on a Windows checkout and false again
   * the moment Prettier wraps a longer guard list. Parsing the decorator's
   * arguments proves MORE than the substring did — exact membership AND
   * exact order, with no fourth guard slipped in and none dropped — while
   * depending on nothing about whitespace or line endings.
   *
   * The window ends at the class declaration, so only the CLASS-level
   * decorator can satisfy this. A @UseGuards on a route further down the
   * file is outside it and cannot stand in for the chain.
   */
  it('the admin guard chain is present, complete and in the required order', () => {
    const controllerAt = controller.indexOf("@Controller('admin/support')");
    const classAt = controller.indexOf('export class AdminSupportController');

    expect(controllerAt).toBeGreaterThan(-1);
    expect(classAt).toBeGreaterThan(controllerAt);

    const classDecorators = controller.slice(controllerAt, classAt);

    const useGuards = /@UseGuards\(([^)]*)\)/.exec(classDecorators);
    expect(useGuards).not.toBeNull();

    const guards = (useGuards as RegExpExecArray)[1]
      .split(',')
      .map((guard) => guard.trim())
      .filter((guard) => guard.length > 0);

    expect(guards).toEqual(['AdminPlatformEnabledGuard', 'RequireAuthGuard', 'AdminGuard']);

    // Exactly ONE class-level @UseGuards. Two would mean the chain proved
    // above is not the whole chain.
    expect(classDecorators.match(/@UseGuards\(/g)).toHaveLength(1);
  });

  it('every admin mutation is CSRF-guarded, and no admin route uses PUT, PATCH or DELETE', () => {
    const mutations = controller.split(/@(?=Post\()/).slice(1);

    expect(mutations).toHaveLength(2);
    mutations.forEach((route) => {
      expect({ route: route.slice(0, 40), csrf: route.includes('CsrfGuard') }).toEqual({
        route: route.slice(0, 40),
        csrf: true,
      });
    });

    expect(controller).not.toMatch(/@(Put|Patch|Delete)\(/);
  });

  it('no admin support route accepts an identity from the request', () => {
    expect(controller).toContain('@CurrentAdmin()');
    expect(controller).not.toMatch(/body\.userId|body\.authorId|params\.userId|query\.userId/);
  });
});

describe('S3 GATE — the requester identity is never disclosed to the admin surface', () => {
  const adminService = stripComments(read('admin-support.service.ts'));

  /**
   * The strongest form of this assertion, and deliberately not a
   * narrower one.
   *
   * An earlier draft scanned only `select: { ... }` blocks. A negative
   * control proved that insufficient: adding `userId: true` to the
   * shared TICKET_FIELDS constant — which is spread INTO the selects
   * rather than written inside one — passed the scan untouched. The
   * assertion now covers the whole file with comments stripped, so
   * there is no position in this service in which the requester's
   * identifier can be selected, destructured, mapped or logged.
   */
  it('the requester’s identifier appears NOWHERE in the admin service, in any position', () => {
    expect(adminService).not.toContain('userId');
  });

  it('the admin reads select an explicit field list rather than the whole row', () => {
    // `select` is what keeps the column out. A findMany or findUnique
    // with no select would load every column, userId included, and only
    // the mapper would stand between it and a response.
    const reads =
      adminService.match(/supportTicket\.(findMany|findUnique)\(\{[\s\S]*?select:/g) ?? [];
    const readCount = (adminService.match(/supportTicket\.(findMany|findUnique)\(/g) ?? []).length;

    expect(readCount).toBeGreaterThanOrEqual(2);
    expect(reads).toHaveLength(readCount);
  });

  it('the admin response shapes have no field for an email, a name or a user id', () => {
    const shared = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'shared', 'src', 'support.ts'),
      'utf8',
    );
    const block = stripComments(
      shared.slice(shared.indexOf('export interface AdminSupportMessageView')),
    );

    ['email', 'displayName', 'userId', 'requesterName'].forEach((field) => {
      expect({ field, present: block.includes(field) }).toEqual({ field, present: false });
    });
  });
});

describe('S3 — the excluded capabilities are genuinely absent, not approximated', () => {
  const supportFiles = readdirSync(__dirname).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'),
  );

  it('no support source file mentions priority or assignment', () => {
    supportFiles.forEach((name) => {
      const source = stripComments(read(name));
      expect({ name, priority: /\bpriority\b/i.test(source) }).toEqual({ name, priority: false });
      expect({ name, assignee: /assigneeId|assignedTo|\bassignee\b/i.test(source) }).toEqual({
        name,
        assignee: false,
      });
    });
  });

  it('the schema still declares no priority and no assignee column', () => {
    const schema = readFileSync(
      join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'),
      'utf8',
    );
    const supportBlock = schema.slice(schema.indexOf('model SupportTicket {'));

    expect(supportBlock).not.toMatch(/\bpriority\b/i);
    expect(supportBlock).not.toMatch(/assigneeId|\bassignee\b/i);
  });

  it('S3 invents no audit store — no support file writes an audit or history record', () => {
    supportFiles.forEach((name) => {
      const source = stripComments(read(name));
      expect({
        name,
        audit: /auditLog|AuditEvent|ticketHistory|StatusHistory/i.test(source),
      }).toEqual({ name, audit: false });
    });
  });

  it('THE ADMIN SIDE still performs no AI work, and there is still one support implementation', () => {
    /*
      SUPPORT-AI-1 narrowed this from "no support file does AI work" to
      "no ADMIN support file does". The user side now has an agent; the
      operator side deliberately does not. An administrator's message is
      authored as ADMIN by a human, and nothing on this surface calls a
      provider, summarises a thread, or drafts a reply.
    */
    ['admin-support.controller.ts', 'admin-support.service.ts', 'dto/admin-support.dto.ts'].forEach(
      (name) => {
        const source = stripComments(read(name));
        expect({ name, ai: /AnalysisService|AnalysisModule|openai/i.test(source) }).toEqual({
          name,
          ai: false,
        });
        expect({ name, news: /NEWS_QUESTION/.test(source) }).toEqual({ name, news: false });
        expect({ name, systemAi: source.includes("'SYSTEM_AI'") }).toEqual({
          name,
          systemAi: false,
        });
      },
    );

    // Exactly one module, one user service, one admin service, and the
    // agent. A second Support implementation would show up here as a
    // fourth service file.
    expect(supportFiles.filter((name) => name.endsWith('.service.ts')).sort()).toEqual([
      'admin-support.service.ts',
      'support-ai.service.ts',
      'support.service.ts',
    ]);
    expect(supportFiles.filter((name) => name.endsWith('.module.ts'))).toEqual([
      'support.module.ts',
    ]);
  });
});
