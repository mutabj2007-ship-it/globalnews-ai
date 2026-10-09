import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK RECENT + SAVED CONTINUITY R1 — the backend half, as source guards
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHY SOURCE GUARDS AND NOT LIVE POSTGRES. The live IDOR/cascade behaviour belongs
 * in `ask-v2.postgres.spec.ts`, which needs a database AND the generated Prisma
 * client. Generating that client is refused in this environment — the schema engine
 * download answers 403 at the egress proxy — and the same failure reproduces on the
 * UNMODIFIED canonical schema, so it is environmental, not a product of this change.
 * The live rows are therefore recorded as UNMEASURED, never as PASS, and what CAN be
 * proven here is proven here: the ownership predicate, the guards, the idempotence
 * and the absence of any compute path.
 *
 * Comments are stripped before any assertion about code, so a prose explanation of
 * why something is forbidden cannot fail an assertion about its absence.
 */
const SERVICE = readFileSync(join(__dirname, 'ask-v2.service.ts'), 'utf8');
const CONTROLLER = readFileSync(join(__dirname, 'ask-v2.controller.ts'), 'utf8');
const DTO = readFileSync(join(__dirname, 'ask-v2.dto.ts'), 'utf8');
const SCHEMA = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');
const MIGRATION = readFileSync(
  join(
    __dirname,
    '../../../prisma/migrations/20260929120000_ask_continuity_bookmark/migration.sql',
  ),
  'utf8',
);

const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** The body of `async <name>(` up to the matching closing brace. */
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

describe('AskBookmark is a relation, never a copy', () => {
  it('the model stores only id, userId, turnId and createdAt', () => {
    const model = SCHEMA.slice(
      SCHEMA.indexOf('model AskBookmark {'),
      SCHEMA.indexOf('}', SCHEMA.indexOf('model AskBookmark {')),
    );
    const fields = code(model)
      .split('\n')
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((name) => name && !name.startsWith('@') && !name.startsWith('model'));
    expect(fields.sort()).toEqual(['createdAt', 'id', 'turn', 'turnId', 'user', 'userId']);
  });

  it('it copies neither the question nor the answer', () => {
    const model = SCHEMA.slice(SCHEMA.indexOf('model AskBookmark {'));
    const body = model.slice(0, model.indexOf('\n}'));
    for (const forbidden = ['question', 'answer', 'payload', 'title', 'summary'] as const; ;) {
      for (const token of forbidden) expect(code(body)).not.toContain(token);
      break;
    }
  });

  it('one bookmark per reader per turn — the uniqueness that makes it a state, not a counter', () => {
    expect(SCHEMA).toContain('@@unique([userId, turnId])');
    expect(MIGRATION).toContain(
      'CREATE UNIQUE INDEX "AskBookmark_userId_turnId_key" ON "AskBookmark"("userId", "turnId")',
    );
  });

  it('account deletion and turn deletion both cascade, so no row outlives its content', () => {
    const model = SCHEMA.slice(SCHEMA.indexOf('model AskBookmark {'));
    const body = model.slice(0, model.indexOf('\n}'));
    expect(body).toContain('references: [id], onDelete: Cascade');
    expect((body.match(/onDelete: Cascade/g) ?? []).length).toBe(2);
    expect(MIGRATION).toContain('"AskBookmark_userId_fkey"');
    expect(MIGRATION).toContain('"AskBookmark_turnId_fkey"');
    expect((MIGRATION.match(/ON DELETE CASCADE/g) ?? []).length).toBe(2);
  });

  it('the migration is additive: it alters and drops nothing', () => {
    expect(MIGRATION).not.toMatch(/\bDROP\b/);
    expect(MIGRATION).not.toMatch(/ALTER TABLE "(?!AskBookmark")/);
  });
});

describe('ownership is verified server-side, and absence is indistinguishable from refusal', () => {
  it('a bookmark write resolves the turn through its thread owner', () => {
    const body = code(methodBody(SERVICE, 'addBookmark'));
    expect(body).toContain('where: { id: turnId, thread: { userId } }');
    expect(body).toContain('throw new NotFoundException();');
  });

  it('the refusal carries no message, so it cannot distinguish "not yours" from "not there"', () => {
    const body = code(methodBody(SERVICE, 'addBookmark'));
    expect(body).toMatch(/throw new NotFoundException\(\);/);
    expect(body).not.toMatch(/NotFoundException\(['"`]/);
  });

  it('the bookmark listing is scoped by the row’s own userId', () => {
    expect(code(methodBody(SERVICE, 'listBookmarks'))).toContain('where: { userId }');
  });

  it('a removal is scoped by userId, so another reader’s row is simply not matched', () => {
    expect(code(methodBody(SERVICE, 'removeBookmark'))).toContain(
      'deleteMany({ where: { userId, turnId } })',
    );
  });

  it('Recent is scoped by userId and reads only this reader’s threads', () => {
    const body = code(methodBody(SERVICE, 'listThreads'));
    /* REASON TO RETURN R1 — the optional search adds a turn filter BESIDE the owner, never instead */
    expect(body).toMatch(/askThread\.findMany\(\{\s*where: \{\s*userId,/);
    expect(body).toContain('threadId: { in: ids }');
  });

  it('REASON TO RETURN R1 — deleting a conversation is scoped by userId at every step', () => {
    const body = code(methodBody(SERVICE, 'deleteThread'));
    expect(body).toContain('where: { id: threadId, userId }');
    expect(body).toContain('computeOperation.deleteMany({ where: { id: { in: operationIds }, userId } })');
    expect(body).toContain('storedResult.deleteMany({ where: { id: { in: storedIds }, userId } })');
    const del = CONTROLLER.slice(CONTROLLER.indexOf("@Delete('threads/:id')"));
    expect(del.slice(0, 120)).toContain('@UseGuards(CsrfGuard)');
  });

  it('every new read and write calls the signed-in assertion first', () => {
    for (const name of ['listThreads', 'listBookmarks', 'addBookmark', 'removeBookmark', 'deleteThread']) {
      expect(code(methodBody(SERVICE, name))).toContain('this.user(userId)');
    }
  });
});

describe('the mutations are guarded, and the read is not', () => {
  it('the controller applies auth and the Ask V2 enable guard to the whole surface', () => {
    expect(CONTROLLER).toContain('@UseGuards(AskV2EnabledGuard, RequireAuthGuard)');
  });

  it('both bookmark mutations carry CsrfGuard', () => {
    const post = CONTROLLER.slice(CONTROLLER.indexOf("@Post('bookmarks')"));
    expect(post.slice(0, 200)).toContain('@UseGuards(CsrfGuard)');
    const del = CONTROLLER.slice(CONTROLLER.indexOf("@Delete('bookmarks/:turnId')"));
    expect(del.slice(0, 200)).toContain('@UseGuards(CsrfGuard)');
  });

  it('the bookmark READ carries no CsrfGuard — a GET stays safe and idempotent', () => {
    const get = CONTROLLER.slice(
      CONTROLLER.indexOf("@Get('bookmarks')"),
      CONTROLLER.indexOf("@Post('bookmarks')"),
    );
    expect(get).not.toContain('CsrfGuard');
  });

  it('the write body accepts a turn id and nothing else', () => {
    const dto = DTO.slice(DTO.indexOf('export class BookmarkTurnDto'));
    expect(code(dto)).toContain('@IsUUID() turnId!: string;');
    for (const token of ['question', 'answer', 'payload', 'title']) {
      expect(code(dto)).not.toContain(token);
    }
  });
});

describe('idempotence', () => {
  it('bookmarking twice is bookmarking once', () => {
    const body = code(methodBody(SERVICE, 'addBookmark'));
    expect(body).toContain('askBookmark.upsert');
    expect(body).toContain('where: { userId_turnId: { userId, turnId } }');
    expect(body).toContain('update: {}');
  });

  it('removing a bookmark that is not there is not an error', () => {
    const body = code(methodBody(SERVICE, 'removeBookmark'));
    expect(body).not.toContain('NotFoundException');
    expect(body).toContain('removed: outcome.count > 0');
  });
});

describe('ZERO COMPUTE — none of the new paths can spend', () => {
  const COMPUTE = [
    'execute',
    'executor',
    'execution',
    'quote(',
    'reserve',
    'settle',
    'analyse',
    'analyze',
    'provider',
    'ASK_EXECUTION_PORT',
  ];

  it('no continuity method reaches a compute or provider token', () => {
    for (const name of ['listThreads', 'listBookmarks', 'addBookmark', 'removeBookmark']) {
      const body = code(methodBody(SERVICE, name));
      for (const token of COMPUTE) expect(body).not.toContain(token);
    }
  });

  it('the two reads perform no write of any kind', () => {
    for (const name of ['listThreads', 'listBookmarks']) {
      const body = code(methodBody(SERVICE, name));
      for (const token of ['.create(', '.update(', '.upsert(', '.delete(', '.deleteMany(']) {
        expect(body).not.toContain(token);
      }
    }
  });

  it('Recent generates no title: it selects the reader’s own stored question', () => {
    const body = code(methodBody(SERVICE, 'listThreads'));
    expect(body).toContain('sequence: FIRST_TURN_SEQUENCE');
    expect(body).toContain('firstQuestion');
    /* Nothing composes text; a title would have to be composed from something. */
    expect(body).not.toMatch(/\btitle\b/);
  });

  it('the first-turn selection is deterministic, not "the oldest row we happened to get"', () => {
    expect(code(SERVICE)).toContain('const FIRST_TURN_SEQUENCE = 1;');
  });

  it('Recent reports the stored lifecycle status and does not read the artifact payload', () => {
    const body = code(methodBody(SERVICE, 'listThreads'));
    expect(body).toContain('status: true');
    expect(body).not.toContain('payload');
    expect(body).not.toContain('storedResult');
  });
});
