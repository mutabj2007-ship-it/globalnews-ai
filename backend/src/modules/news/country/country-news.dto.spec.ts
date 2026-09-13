import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CountryNewsQueryDto } from './country-news.dto';

/**
 * Milestone #49 (World Map EN/PL integration). No spec existed for
 * this DTO before this milestone. `import 'reflect-metadata'` is the
 * first line, mirroring the exact fix already established for
 * top-headlines-query.dto.spec.ts in Milestone #47 Blocker 2 — this
 * DTO also uses class-transformer's @Type(() => Number) on `limit`.
 */
describe('CountryNewsQueryDto (Milestone #49)', () => {
  it('no params at all validates successfully (everything is optional)', async () => {
    const dto = plainToInstance(CountryNewsQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.lang).toBeUndefined();
  });

  it('limit + category only (no lang) validates — backward compatible', async () => {
    const dto = plainToInstance(CountryNewsQueryDto, { limit: '8', category: 'world' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('lang="en" validates successfully', async () => {
    const dto = plainToInstance(CountryNewsQueryDto, { lang: 'en' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('lang="pl" validates successfully', async () => {
    const dto = plainToInstance(CountryNewsQueryDto, { lang: 'pl' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('an unsupported/invalid lang value is rejected, matching the established DTO validation convention', async () => {
    const dto = plainToInstance(CountryNewsQueryDto, { lang: 'zz' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('a valid application LanguageCode outside the narrower top-headlines/country set (e.g. sw) is also rejected', async () => {
    const dto = plainToInstance(CountryNewsQueryDto, { lang: 'sw' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('existing limit/category validation is unaffected by the new lang field', async () => {
    const dto = plainToInstance(CountryNewsQueryDto, { limit: '999', lang: 'en' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
