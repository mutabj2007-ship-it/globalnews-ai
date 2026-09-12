import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ALL_ISO3_CODES } from '@globalnews-ai/shared';
import { buildFollowDouble, type FollowRow } from './follows.service.spec';

/**
 * R1/T3 — CROSS-USER ISOLATION AND OWNERSHIP, PROVEN.
 *
 * Follows are user-declared interests. They are low-sensitivity as data
 * goes, and they are still personal data: which countries a person
 * watches says something about them. This file asserts that one account
 * can neither read nor delete another's, and that ownership is never
 * expressible as input.
 */
const stripComments = (source: string): string =>
  source
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const read = (...segments: string[]): string =>
  stripComments(readFileSync(join(__dirname, ...segments), 'utf8'));

describe('R1/T3 — one account cannot reach another’s follows', () => {
  it('a list never contains another user’s follow', async () => {
    const rows: FollowRow[] = [];
    const { service } = buildFollowDouble(rows);
    await service.follow('user-1', 'POL');
    await service.follow('user-2', 'DEU');

    const list = await service.listForUser('user-1');

    expect(list.follows.map((follow) => follow.countryCode)).toEqual(['POL']);
  });

  it('DELETE cannot remove another user’s follow', async () => {
    const rows: FollowRow[] = [];
    const { service } = buildFollowDouble(rows);
    await service.follow('user-2', 'DEU');

    await service.unfollow('user-1', 'DEU');

    // user-2's row survives untouched. The where clause carries both
    // halves, so a foreign row is not matched, not merely not reported.
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe('user-2');
  });

  it('a foreign follow and a nonexistent follow are INDISTINGUISHABLE', async () => {
    const rows: FollowRow[] = [];
    const { service } = buildFollowDouble(rows);
    await service.follow('user-2', 'DEU');

    const foreign = await service.unfollow('user-1', 'DEU').then(
      () => 'resolved',
      () => 'rejected',
    );
    const missing = await service.unfollow('user-1', 'FRA').then(
      () => 'resolved',
      () => 'rejected',
    );

    // Same outcome for both, so this route cannot be used to discover
    // what another account follows.
    expect(foreign).toBe(missing);
  });
});

describe('R1/T3 — ownership never travels in a request', () => {
  const service = read('follows.service.ts');
  const controller = read('follows.controller.ts');
  const bodyDto = read('dto', 'follow-country.dto.ts');
  const paramsDto = read('dto', 'follow-country-params.dto.ts');

  it('no DTO declares a user identifier', () => {
    [bodyDto, paramsDto].forEach((dto) => {
      ['userId', 'user_id', 'accountId'].forEach((forbidden) => {
        expect({ forbidden, present: dto.includes(forbidden) }).toEqual({
          forbidden,
          present: false,
        });
      });
    });
  });

  it('the controller takes the user only from @CurrentUser', () => {
    expect(controller).toContain('@CurrentUser()');
    expect(controller).not.toMatch(/body\.userId|params\.userId|query\.userId/);
  });

  it('EVERY follow query is scoped to userId — none is left open', () => {
    const queries = service.match(/countryFollow\.\w+\(\{[\s\S]*?where: \{[^}]*\}/g) ?? [];

    expect(queries.length).toBeGreaterThanOrEqual(4);
    queries.forEach((query) => {
      expect({ query, scoped: query.includes('userId') }).toEqual({ query, scoped: true });
    });
  });

  it('every route is authenticated and every mutation is CSRF-guarded', () => {
    expect(controller).toMatch(/@Controller\('follows'\)\s*@UseGuards\(RequireAuthGuard\)/);

    const routes = controller.split(/@(?=Get\(|Post\(|Put\(|Patch\(|Delete\()/).slice(1);
    expect(routes).toHaveLength(3);

    routes
      .filter((route) => route.startsWith('Post(') || route.startsWith('Delete('))
      .forEach((route) => {
        expect({ route: route.slice(0, 40), csrf: route.includes('CsrfGuard') }).toEqual({
          route: route.slice(0, 40),
          csrf: true,
        });
      });
  });

  it('exposes no admin route and no route that reads another account', () => {
    expect(controller).not.toMatch(/'admin/);
    expect(controller).not.toMatch(/:userId|byUser|allUsers/);
  });
});

describe('R1/T3 — the country code is canonical, never free text', () => {
  const bodyDto = read('dto', 'follow-country.dto.ts');
  const paramsDto = read('dto', 'follow-country-params.dto.ts');

  it('both DTOs validate against ALL_ISO3_CODES, not a length or a shape', () => {
    [bodyDto, paramsDto].forEach((dto) => {
      expect(dto).toContain('ALL_ISO3_CODES');
      expect(dto).toContain('@IsIn(ALL_ISO3_CODES)');
    });
  });

  it('the canonical list is the shared one and is substantial', () => {
    expect(ALL_ISO3_CODES.length).toBeGreaterThan(150);
    expect(ALL_ISO3_CODES).toContain('POL');
    // A well-formed but non-existent code must not be in the list — a
    // length check would have accepted it.
    expect(ALL_ISO3_CODES).not.toContain('XXX');
  });

  it('the service does not re-derive or re-normalise the code', () => {
    const service = read('follows.service.ts');

    // One validation point. Two that could disagree is how a value ends
    // up canonical on one path and not the other.
    expect(service).not.toContain('toUpperCase');
    expect(service).not.toContain('ALL_ISO3_CODES');
  });
});

describe('R1/T3 — the ceiling is a resource bound, not an entitlement', () => {
  const constants = read('follows.constants.ts');
  const service = read('follows.service.ts');
  // Product files only. A spec asserting the ABSENCE of these words
  // necessarily contains them, so sweeping itself would be self-defeating.
  const followFiles = readdirSync(__dirname).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'),
  );

  it('finds the follow product files', () => {
    expect(followFiles.sort()).toEqual([
      'follows.constants.ts',
      'follows.controller.ts',
      'follows.module.ts',
      'follows.service.ts',
    ]);
  });

  it('no follow file consults a plan, a tier or a subscription', () => {
    followFiles.forEach((name) => {
      const source = read(name);
      expect({
        name,
        plan: /\bplan\b|\btier\b|subscription|entitlement|premium|upgrade/i.test(source),
      }).toEqual({ name, plan: false });
    });
  });

  it('the constant states plainly what it is NOT', () => {
    // Comments are deliberately NOT stripped for this one assertion: the
    // disclaimer is the artefact under test.
    const raw = readFileSync(join(__dirname, 'follows.constants.ts'), 'utf8');
    expect(raw).toMatch(/NOT a Free\/Pro\/Premium entitlement/i);
  });

  it('exceeding it is a conflict, not a payment or permission error', () => {
    expect(service).toContain('HttpStatus.CONFLICT');
    expect(constants).not.toMatch(/PAYMENT_REQUIRED|FORBIDDEN/);
  });
});
