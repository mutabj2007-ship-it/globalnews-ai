import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AnalyzeNewsDto } from './analyze-news.dto';

describe('AnalyzeNewsDto', () => {
  it('accepts a normal natural-language question', async () => {
    const dto = plainToInstance(AnalyzeNewsDto, { query: "What's happening in Ceuta?" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty query', async () => {
    const dto = plainToInstance(AnalyzeNewsDto, { query: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a missing query field', async () => {
    const dto = plainToInstance(AnalyzeNewsDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an excessively long query', async () => {
    const dto = plainToInstance(AnalyzeNewsDto, { query: 'a'.repeat(500) });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
