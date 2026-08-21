import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

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

const read = (...segments: string[]): string => readFileSync(join(...segments), 'utf8');

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
    const controller = read(ADMIN_DIR, 'admin.controller.ts');

    it('the controller class carries the three guards in the order the security model requires', () => {
      expect(controller).toContain(
        '@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)',
      );
    });

    it('exposes exactly one route — GET me — and nothing else', () => {
      const routeDecorators = controller.match(/@(Get|Post|Put|Patch|Delete)\(/g) ?? [];
      expect(routeDecorators).toEqual(['@Get(']);
      expect(controller).toContain("@Get('me')");
    });

    it('every route handler carries a capability decorator', () => {
      const routeBlocks = controller.split(/@(?=Get\(|Post\(|Put\(|Patch\(|Delete\()/).slice(1);
      expect(routeBlocks.length).toBeGreaterThan(0);

      routeBlocks.forEach((block) => {
        expect(/@AdminOnly\(\)|@RequireCapability\(/.test(block)).toBe(true);
      });
    });
  });

  describe('no administrator identity is hard-coded anywhere in the admin module', () => {
    const files = adminSourceFiles();

    it('finds admin source files to check', () => {
      expect(files.length).toBeGreaterThanOrEqual(9);
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
