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

  describe('Milestone #47 — requestedLanguage', () => {
    it('query only (no requestedLanguage) validates successfully — backward compatible', async () => {
      const dto = plainToInstance(AnalyzeNewsDto, { query: 'What is happening in NATO?' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.requestedLanguage).toBeUndefined();
    });

    it('query + requestedLanguage="en" validates successfully', async () => {
      const dto = plainToInstance(AnalyzeNewsDto, {
        query: 'What is happening in NATO?',
        requestedLanguage: 'en',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('query + requestedLanguage="pl" validates successfully', async () => {
      const dto = plainToInstance(AnalyzeNewsDto, {
        query: 'Co dzieje się w NATO?',
        requestedLanguage: 'pl',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('an unsupported/arbitrary requestedLanguage value is REJECTED by DTO validation, not silently guessed at', async () => {
      const dto = plainToInstance(AnalyzeNewsDto, {
        query: 'What is happening in NATO?',
        requestedLanguage: 'zz',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('an empty-string requestedLanguage is also rejected (not treated as "absent")', async () => {
      const dto = plainToInstance(AnalyzeNewsDto, {
        query: 'What is happening in NATO?',
        requestedLanguage: '',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('every currently-supported LanguageCode value validates successfully', async () => {
      for (const language of ['en', 'pl', 'sw', 'fr', 'es', 'ar', 'rw']) {
        const dto = plainToInstance(AnalyzeNewsDto, {
          query: 'What is happening in NATO?',
          requestedLanguage: language,
        });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });
});
