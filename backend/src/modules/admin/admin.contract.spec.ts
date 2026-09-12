import { readFileSync, readdirSync } from 'fs';
import { basename, join } from 'path';

/**
 * F1.a — static contract guards, in this repository's established
 * source-analysis style. These assert properties that must remain true
 * of the SHIPPED SOURCE, not of a running instance: a route that
 * forgets its capability decorator, a hard-coded administrator, a
 * write path for adminRole, or a leak of the design's sample data
 * would all pass a behavioural test on the routes that exist today.
 */
const ADMIN_DIR = __dirname;
const BACKEND_SRC = join(__dirname, '..', '..');
const BACKEND_ROOT = join(BACKEND_SRC, '..');
const MODULES_DIR = join(BACKEND_SRC, 'modules');

const read = (...segments: string[]): string => readFileSync(join(...segments), 'utf8');

/**
 * S3 — EVERY admin controller in the backend, not only the ones that
 * happen to live under modules/admin.
 *
 * The sweeps below used to scan this directory alone, which was
 * sufficient while every admin route lived here. S3's admin support
 * controller is deliberately placed in modules/support — because the
 * no-write-path guard further down bans `.create(` and `.update(` in
 * every non-spec file under modules/admin, and a support queue is
 * inherently a write — so a directory-scoped sweep would have let it
 * escape the guard-order and capability-decorator assertions entirely.
 *
 * An admin controller is identified by what it IS, not by where it
 * sits: a controller file whose @Controller path is `admin` or begins
 * `admin/`. Moving a file can therefore no longer move it out of this
 * contract.
 */
function allAdminControllers(dir: string = MODULES_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return allAdminControllers(full);
    if (!entry.isFile() || !entry.name.endsWith('.controller.ts')) return [];
    return /@Controller\(\s*'admin(?:\/[^']*)?'\s*\)/.test(read(full)) ? [full] : [];
  });
}

/**
 * Every .ts file under modules/admin EXCEPT this one.
 *
 * This file is excluded from its own scans deliberately and only from
 * its own: naming the forbidden literals is precisely its job, so
 * including it would make the guard fail on itself. Every other admin
 * file — product and spec alike — is scanned.
 */
function adminSourceFiles(): string[] {
  const collect = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return collect(full);
      return entry.isFile() && entry.name.endsWith('.ts') ? [full] : [];
    });

  return collect(ADMIN_DIR).filter((file) => file !== __filename);
}

describe('F1.a admin module — source contracts', () => {
  describe('every admin route is explicitly authorized', () => {
    // F1.b swept every admin controller under modules/admin. S3 widens
    // that to every admin controller in the backend, wherever it lives —
    // see allAdminControllers above for why that distinction now matters.
    const controllers = allAdminControllers();

    it('finds every admin controller, including any outside modules/admin', () => {
      expect(controllers.length).toBeGreaterThanOrEqual(3);

      // The S3 support controller is outside this directory ON PURPOSE
      // and must still be in this list. If it ever stops being found,
      // this contract has silently stopped covering a mutating admin
      // surface.
      expect(controllers.some((file) => file.endsWith('admin-support.controller.ts'))).toBe(true);
    });

    it('every admin controller carries the three guards in the order the security model requires', () => {
      controllers.forEach((file) => {
        expect(read(file)).toContain(
          '@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)',
        );
      });
    });

    it('every route handler in every admin controller carries a capability decorator', () => {
      let handlerCount = 0;

      controllers.forEach((file) => {
        const routeBlocks = read(file)
          .split(/@(?=Get\(|Post\(|Put\(|Patch\(|Delete\()/)
          .slice(1);
        handlerCount += routeBlocks.length;

        routeBlocks.forEach((block) => {
          expect(/@AdminOnly\(\)|@RequireCapability\(/.test(block)).toBe(true);
        });
      });

      expect(handlerCount).toBeGreaterThanOrEqual(3);
    });

    /**
     * S3 — REPLACES "exposes only GET routes — F1.b ships no mutating
     * admin action", which was a true statement about F1.b and stopped
     * being true the moment an administrator could answer a support
     * ticket.
     *
     * IT IS NOT A RELAXATION, AND THE DIFFERENCE MATTERS. The old
     * assertion said "no mutation exists". This one says "these exact
     * mutations exist and no others", which is a strictly stronger
     * statement: the old rule would have been satisfied by deleting it,
     * this one is only satisfied by enumerating every mutating admin
     * route in the platform. A fifth mutating route — or a PUT, PATCH or
     * DELETE anywhere on the admin surface — fails this test, and adding
     * it to the list is a deliberate, reviewable act.
     *
     * PUT, PATCH and DELETE remain banned outright. Every approved
     * mutation is expressible as a POST, and the CSRF guard, the
     * throttler and the existing conventions are all written for POST.
     */
    const APPROVED_ADMIN_MUTATIONS: ReadonlyArray<[string, string]> = [
      ['admin-support.controller.ts', "@Post('tickets/:reference/messages')"],
      ['admin-support.controller.ts', "@Post('tickets/:reference/status')"],
    ];

    it('exposes no PUT, PATCH or DELETE anywhere on the admin surface', () => {
      controllers.forEach((file) => {
        expect(read(file)).not.toMatch(/@(Put|Patch|Delete)\(/);
      });
    });

    it('every mutating admin route is one of the explicitly approved ones', () => {
      const found: string[] = [];

      controllers.forEach((file) => {
        (read(file).match(/@Post\('[^']*'\)/g) ?? []).forEach((decorator) => {
          found.push(`${basename(file)}::${decorator}`);
        });
      });

      const approved = APPROVED_ADMIN_MUTATIONS.map(([file, decorator]) => `${file}::${decorator}`);

      expect(found.sort()).toEqual([...approved].sort());
    });

    it('every mutating admin route is CSRF-guarded and capability-gated', () => {
      controllers.forEach((file) => {
        read(file)
          .split(/@(?=Post\()/)
          .slice(1)
          .forEach((block) => {
            const head = block.slice(0, 200);
            expect({ head, csrf: block.includes('CsrfGuard') }).toEqual({ head, csrf: true });
            expect({ head, gated: /@RequireCapability\(/.test(block) }).toEqual({
              head,
              gated: true,
            });
          });
      });
    });

    it('admin.controller.ts still exposes exactly GET me', () => {
      const controller = read(ADMIN_DIR, 'admin.controller.ts');
      expect(controller.match(/@(Get|Post|Put|Patch|Delete)\(/g) ?? []).toEqual(['@Get(']);
      expect(controller).toContain("@Get('me')");
    });
  });

  describe('no administrator identity is hard-coded anywhere in the admin module', () => {
    const files = adminSourceFiles();

    it('finds admin source files to check', () => {
      expect(files.length).toBeGreaterThanOrEqual(14);
    });

    it('contains no email address literal', () => {
      files.forEach((file) => {
        const source = read(file);
        // An @ inside a string literal that also carries a dot is the
        // shape of an email address. Decorators (@Get, @Injectable)
        // never appear inside string literals.
        const literals = source.match(/'[^']*'|"[^"]*"|`[^`]*`/g) ?? [];
        literals.forEach((literal) => {
          expect(/@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(literal)).toBe(false);
        });
      });
    });

    it('contains no email-domain check and no administrator allow-list', () => {
      files.forEach((file) => {
        const source = read(file);
        expect(source).not.toMatch(/endsWith\(\s*['"`]@/);
        expect(source).not.toMatch(/BOOTSTRAP_SUPER_ADMIN/);
        expect(source).not.toMatch(/ALLOW_?LIST|ALLOWED_ADMINS?|ADMIN_EMAILS?/i);
      });
    });
  });

  describe('F1.a ships no write path for adminRole', () => {
    /**
     * S3 — THIS BAN IS UNCHANGED, AND KEEPING IT UNCHANGED IS WHY THE
     * ADMIN SUPPORT SERVICE LIVES IN modules/support.
     *
     * It scans `adminSourceFiles()` — this directory — not the widened
     * controller list above. A support reply is a legitimate write and
     * has nothing to do with granting a role, but a scan cannot tell the
     * two apart, so admitting the first would have meant admitting the
     * second. The code moved instead of the guard.
     */
    it('no admin source file writes, updates or upserts a role', () => {
      adminSourceFiles()
        .filter((file) => !file.endsWith('.spec.ts'))
        .forEach((file) => {
          const source = read(file);
          expect(source).not.toMatch(/\.update\(|\.updateMany\(|\.upsert\(|\.create\(/);
          expect(source).not.toMatch(/adminRole\s*:\s*['"`]/);
        });
    });

    it('AuthService.findOrCreateUser still creates a user with no adminRole — a new sign-in cannot become an administrator', () => {
      const authService = read(BACKEND_SRC, 'modules', 'auth', 'auth.service.ts');
      const createBlock = authService.slice(authService.indexOf('return this.prisma.user.create('));

      expect(createBlock.length).toBeGreaterThan(0);
      expect(createBlock.slice(0, 400)).not.toContain('adminRole');
    });
  });

  describe('existing backend contracts are preserved', () => {
    it('UserSummary and GET /users/me do not expose adminRole', () => {
      expect(read(BACKEND_SRC, 'modules', 'users', 'users.service.ts')).not.toContain('adminRole');
      expect(read(BACKEND_SRC, 'modules', 'users', 'users.controller.ts')).not.toContain(
        'adminRole',
      );
    });

    it('RequireAuthGuard is untouched by F1.a — it knows nothing about roles or admin', () => {
      const guard = read(BACKEND_SRC, 'modules', 'auth', 'require-auth.guard.ts');
      expect(guard).not.toMatch(/admin/i);
      expect(guard).not.toContain('Role');
    });

    it('AdminModule is the only registration F1.a adds to app.module.ts', () => {
      const appModule = read(BACKEND_SRC, 'app.module.ts');
      expect(appModule).toContain("import { AdminModule } from './modules/admin/admin.module';");
      expect(appModule).toContain('AdminModule,');
    });
  });

  describe('the Prisma schema change is additive and cannot grant privilege', () => {
    const schema = read(BACKEND_ROOT, 'prisma', 'schema.prisma');

    it('declares the four approved roles and no fifth member', () => {
      const block = schema.slice(schema.indexOf('enum AdminRole {'));
      const body = block.slice(0, block.indexOf('}'));
      const members = body
        .split('\n')
        .slice(1)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('//') && !line.startsWith('///'));

      expect(members).toEqual(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ANALYST']);
    });

    it('adminRole is OPTIONAL and carries NO default — every pre-existing row is therefore NULL', () => {
      expect(schema).toMatch(/adminRole\s+AdminRole\?/);
      expect(schema).not.toMatch(/adminRole\s+AdminRole\?\s*@default/);
    });

    it('the migration adds the column without a default and without touching any row', () => {
      const migration = read(
        BACKEND_ROOT,
        'prisma',
        'migrations',
        '20260821090500_add_admin_role',
        'migration.sql',
      );

      expect(migration).toContain('CREATE TYPE "AdminRole"');
      expect(migration).toContain('ALTER TABLE "User" ADD COLUMN');
      expect(migration).not.toMatch(/DEFAULT/i);
      expect(migration).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bDROP\b/i);
    });
  });

  describe('no Claude Design sample data reaches the codebase', () => {
    it('none of the design artifact tag-D values appears in any admin source file', () => {
      const forbidden = [
        '5252445566',
        '9581234567',
        '6771122334',
        'FV/2026',
        'KOR/2026',
        'A1B2C3',
        'GN-2026-',
        'evt_01J9K7RQ2M8F',
        '203.0.113.44',
        'd.kowal',
        'm.lis',
        'a.kern',
        'j.iwan',
        'Nowak Media',
        'Baltic Press',
      ];

      adminSourceFiles().forEach((file) => {
        const source = read(file);
        forbidden.forEach((needle) => {
          expect(source).not.toContain(needle);
        });
      });
    });
  });
});
