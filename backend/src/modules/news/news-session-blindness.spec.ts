import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * E1-N-3 — STRUCTURAL SESSION-BLINDNESS GUARD OVER THE PUBLIC NEWS MODULE.
 *
 * WHY THIS EXISTS, AND WHY A COMMENT WOULD NOT DO. Before the converged release,
 * newsApi.ts called the BACKEND origin directly, which is cross-site: SameSite=Lax
 * withheld `gna_session` and `gna_csrf` on every news request. `/news` is now a
 * same-origin PUBLIC rewrite and the cookies have Path='/', so both now travel on
 * every news request.
 *
 * That is a TRANSMISSION change, not a privilege change — the backend confers
 * nothing, and E1 measured the module session-blind today. But "today" is the
 * problem: news responses are deliberately NOT `Vary: Cookie`, because they are
 * public and identical for every caller. If anything on this path ever started
 * reading a cookie, the response would begin varying by session while still being
 * cached as if it did not, and one caller's view could be served to the next.
 *
 * So the property stops being an accident and becomes a control. This fails the
 * build, not a review.
 *
 * IF /news EVER LEGITIMATELY VARIES BY SESSION, `Vary: Cookie` becomes mandatory
 * in the SAME change that makes it vary — and this guard is what forces that
 * conversation to happen.
 *
 * COMMENTS ARE STRIPPED BEFORE SCANNING, DELIBERATELY. E1's own sweep found one
 * hit in gdelt-doc.provider.ts — the word "session" inside unrelated prose about
 * a transient blip. An allowlist for that line would rot the moment the prose
 * moved. Scanning code rather than text is the durable form.
 */

const NEWS_MODULE_ROOT = join(__dirname);
const GEO_MODULE_ROOT = join(__dirname, '..', 'geo');

/** Tokens that would mean this public path had started consuming identity. */
const FORBIDDEN = [
  { pattern: /@UseGuards\b/, label: '@UseGuards' },
  { pattern: /\bCurrentUser\b/, label: 'CurrentUser' },
  { pattern: /\b(?:req|request)\s*\.\s*cookies\b/, label: 'request.cookies' },
  { pattern: /\buserId\b/, label: 'userId' },
  { pattern: /\bgna_session\b/, label: 'gna_session' },
  { pattern: /\bSessionService\b/, label: 'SessionService' },
  { pattern: /\bvalidateSession\b/, label: 'validateSession' },
] as const;

/**
 * Removes block and line comments. STRING LITERALS ARE DELIBERATELY KEPT.
 *
 * The first version of this stripped strings too, and its own positive control
 * caught the mistake: a cookie is read as `req.cookies['gna_session']`, so the
 * cookie NAME lives in a string literal. Stripping literals made the scanner
 * blind to exactly the token it most needed to see.
 *
 * Comments are the only thing that needs removing — E1's sweep hit the word
 * "session" in unrelated prose, and prose is what produces false positives here.
 * Keeping literals errs toward over-reporting, which is the correct direction
 * for a guard whose job is to fail loudly.
 */
function stripNonCode(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

function scanSource(source: string): string[] {
  const code = stripNonCode(source);
  return FORBIDDEN.filter(({ pattern }) => pattern.test(code)).map(({ label }) => label);
}

function collectModuleFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectModuleFiles(full, acc);
      continue;
    }
    if (!entry.endsWith('.ts')) continue;
    if (entry.endsWith('.spec.ts')) continue;
    acc.push(full);
  }
  return acc;
}

describe('E1-N-3 — the public news module is session-blind, structurally', () => {
  const files = collectModuleFiles(NEWS_MODULE_ROOT);

  it('THE SWEEP IS ALIVE: it actually visited the module', () => {
    // A dead search returns an empty set and passes everything. This is the
    // liveness control: if the module moves or the walk breaks, this fails
    // before the absence assertion below can pass for the wrong reason.
    expect(files.length).toBeGreaterThan(5);
    expect(files.some((f) => f.endsWith('news.controller.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('news.service.ts'))).toBe(true);
  });

  it('POSITIVE CONTROL: the scanner FAILS a deliberately non-compliant source', () => {
    // Without this, a scanner that matched nothing at all would pass the real
    // assertion silently. Each forbidden form is exercised in a real code
    // position, not in a comment.
    const nonCompliant = `
      @Controller('news')
      export class BadNewsController {
        @UseGuards(RequireAuthGuard)
        @Get()
        find(@CurrentUser() user: { userId: string }, @Req() req: Request) {
          const token = req.cookies['gna_session'];
          return this.sessionService.validateSession(token) && user.userId;
        }
      }
    `;
    const hits = scanSource(nonCompliant);

    expect(hits).toEqual(
      expect.arrayContaining([
        '@UseGuards',
        'CurrentUser',
        'request.cookies',
        'userId',
        'gna_session',
        'validateSession',
      ]),
    );
  });

  it('NEGATIVE CONTROL: prose mentioning a session in a comment does NOT trip it', () => {
    // E1's own sweep hit exactly this shape in gdelt-doc.provider.ts. If this
    // test ever fails, the strip is over-eager and the real assertion below has
    // become unreliable rather than strict.
    const proseOnly = `
      /* A transient blip does not cost the whole session. */
      // userId is not read here; this line is prose about CurrentUser.
      export const NEWS_LIMIT = 12;
    `;
    expect(scanSource(proseOnly)).toEqual([]);
  });

  it.each(collectModuleFiles(NEWS_MODULE_ROOT))(
    'reads no session, user identity or cookie: %s',
    (file) => {
      expect(scanSource(readFileSync(file, 'utf-8'))).toEqual([]);
    },
  );
});

/*
  ══ G-1 — THE SAME GUARD, EXTENDED TO THE SECOND PUBLIC FAMILY ══════════════

  `/geo` is now a public non-`/api` family alongside `/news`
  (E1-GEO-PUBLIC-REWRITE-REVIEW-1). Being reachable same-origin means the
  BROWSER WILL SEND COOKIES to it — that is a property of the origin, not a
  choice this module makes, and it cannot be prevented without stripping the
  cookie in Next middleware, which E1 forbids (G-4/G-5).

  SO THE REQUIREMENT IS SEMANTIC, NOT PHYSICAL: cookies may ARRIVE, and the Geo
  module must never READ one or derive any behaviour from identity. Its answers
  must be identical for a signed-in reader and an anonymous one, because they
  are a function of the shipped gazetteer and the query text alone.

  THE SAME SCANNER, THE SAME CONTROLS. Reusing `FORBIDDEN`, `scanSource` and the
  positive/negative controls above is deliberate: a second, parallel guard is
  how two surfaces end up with two different definitions of "session-blind".
*/
describe('E1 G-1 — the public geo module is session-blind, structurally', () => {
  const files = collectModuleFiles(GEO_MODULE_ROOT);

  it('THE SWEEP IS ALIVE: it actually visited the geo module', () => {
    /* A dead walk returns nothing and passes everything. */
    expect(files.length).toBeGreaterThan(5);
    expect(files.some((f) => f.endsWith('geo.controller.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('geo.module.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('gazetteer-search.ts'))).toBe(true);
  });

  it.each(collectModuleFiles(GEO_MODULE_ROOT))(
    'reads no session, user identity or cookie: %s',
    (file) => {
      expect(scanSource(readFileSync(file, 'utf-8'))).toEqual([]);
    },
  );

  it('G-5 — map-feed resolves TEXT, and is joined to no stored or private evidence', () => {
    /*
      E1 measured that `/geo/map-feed` is a text -> gazetteer resolver. It is
      NOT authority to read stored evidence, and a future join would need its
      own security gate. This pins the absence: no Prisma, no repository, no
      article store reaches this module.
    */
    for (const file of files) {
      const code = readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ');

      for (const forbidden of ['PrismaService', 'prisma.', '@prisma/client', 'ArticlePersistence']) {
        expect(`${file.split('/').pop()} ${forbidden}: ${code.includes(forbidden)}`).toBe(
          `${file.split('/').pop()} ${forbidden}: false`,
        );
      }
    }
  });
});
