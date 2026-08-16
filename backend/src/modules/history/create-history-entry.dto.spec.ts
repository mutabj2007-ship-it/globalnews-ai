import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateHistoryEntryDto } from './create-history-entry.dto';

/**
 * Query-limit correction — no dedicated validation spec previously
 * existed for this DTO (only history.service.spec.ts, which does not
 * exercise class-validator directly). This follows the exact
 * established convention already used by analyze-news.dto.spec.ts
 * for the same kind of free-text query length boundary.
 */
describe('CreateHistoryEntryDto', () => {
  it('accepts a normal short query', async () => {
    const dto = plainToInstance(CreateHistoryEntryDto, { query: "What's happening in Ceuta?" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a query comfortably above the old 300-character limit but at or below the new 1000-character limit', async () => {
    const question = 'Give me a comprehensive analysis of recent developments. '
      .repeat(10)
      .slice(0, 600);
    expect(question.length).toBeGreaterThan(300);
    expect(question.length).toBeLessThanOrEqual(1000);
    const dto = plainToInstance(CreateHistoryEntryDto, { query: question });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a query of exactly 1000 characters', async () => {
    const dto = plainToInstance(CreateHistoryEntryDto, { query: 'a'.repeat(1000) });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a query of 1001 characters', async () => {
    const dto = plainToInstance(CreateHistoryEntryDto, { query: 'a'.repeat(1001) });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts an optional countryCode within its own 60-character bound, unaffected by the query-length change', async () => {
    const dto = plainToInstance(CreateHistoryEntryDto, { query: 'NATO', countryCode: 'US' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
