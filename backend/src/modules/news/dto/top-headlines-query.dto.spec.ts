// Milestone #47 correction (Blocker 2): TopHeadlinesQueryDto is the
// first DTO spec in this file to instantiate/validate a class using
// class-transformer's @Type(() => Number) directly in an isolated
// Jest unit test (not through the full Nest application bootstrap,
// where reflect-metadata is typically already loaded early via
// main.ts). @Type() reads/writes design-time type metadata via
// Reflect.getMetadata, which requires the reflect-metadata polyfill
// to have been loaded BEFORE the decorated class is defined — this
// import must be the very first line, ahead of every other import,
// so the polyfill installs before TopHeadlinesQueryDto's own module
// (imported below) evaluates its decorators. reflect-metadata is
// already a real project dependency (see backend/package.json); this
// import is safe to add even if a global Jest setup already loads it
// elsewhere, since reflect-metadata installation is idempotent.
// Production DTO validation behavior (including @Type itself) is
// completely unchanged — only the test environment is corrected.
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TopHeadlinesQueryDto } from './top-headlines-query.dto';

describe('TopHeadlinesQueryDto (Milestone #47 — Defect 3 correction)', () => {
  it('limit only (no lang) validates successfully — backward compatible', async () => {
    const dto = plainToInstance(TopHeadlinesQueryDto, { limit: '12' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.lang).toBeUndefined();
  });

  it('no query params at all validates successfully (limit is itself optional)', async () => {
    const dto = plainToInstance(TopHeadlinesQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('limit + lang="en" validates successfully', async () => {
    const dto = plainToInstance(TopHeadlinesQueryDto, { limit: '12', lang: 'en' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('limit + lang="pl" validates successfully', async () => {
    const dto = plainToInstance(TopHeadlinesQueryDto, { limit: '12', lang: 'pl' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("an unsupported/arbitrary lang value is REJECTED, following the project's existing DTO validation convention", async () => {
    const dto = plainToInstance(TopHeadlinesQueryDto, { limit: '12', lang: 'zz' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('Blocker 4 (correction round 2): a valid APPLICATION LanguageCode that is NOT in the narrower top-headlines set (sw) is still REJECTED here', async () => {
    const dto = plainToInstance(TopHeadlinesQueryDto, { limit: '12', lang: 'sw' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('Blocker 4: rw is also rejected for the same reason', async () => {
    const dto = plainToInstance(TopHeadlinesQueryDto, { limit: '12', lang: 'rw' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('only en/pl validate successfully for top-headlines — the endpoint-specific set, not the full 7-member application set', async () => {
    for (const lang of ['en', 'pl']) {
      const dto = plainToInstance(TopHeadlinesQueryDto, { limit: '12', lang });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
    for (const lang of ['sw', 'fr', 'es', 'ar', 'rw']) {
      const dto = plainToInstance(TopHeadlinesQueryDto, { limit: '12', lang });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('existing limit validation (range 1-50) is unaffected by the new lang field', async () => {
    const dto = plainToInstance(TopHeadlinesQueryDto, { limit: '999', lang: 'en' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
