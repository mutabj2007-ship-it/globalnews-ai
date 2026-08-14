import 'reflect-metadata';
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

  describe('Milestone #47 â€” requestedLanguage', () => {
    it('query only (no requestedLanguage) validates successfully â€” backward compatible', async () => {
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
        query: 'Co dzieje siÄ™ w NATO?',
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

  describe('Milestone #51 Phase B â€” storyContext', () => {
    it('query only (no storyContext) validates successfully \u2014 backward compatible, exactly the pre-#51 request shape', async () => {
      const dto = plainToInstance(AnalyzeNewsDto, { query: 'What is happening in Rwanda?' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.storyContext).toBeUndefined();
    });

    it('query + a full valid storyContext validates successfully', async () => {
      const dto = plainToInstance(AnalyzeNewsDto, {
        query: 'Rwanda revealed as EU\u2019s first migrant return hub, but what\u2019s in it for Kigali?',
        storyContext: {
          title: 'Rwanda revealed as EU\u2019s first migrant return hub, but what\u2019s in it for Kigali?',
          articleId: 'abc123',
          url: 'https://example.com/rwanda-migrant-hub',
          sourceName: 'Example Wire',
          countryCode: 'RWA',
        },
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('query + storyContext with only the required title field validates successfully \u2014 every other storyContext field is genuinely optional', async () => {
      const dto = plainToInstance(AnalyzeNewsDto, {
        query: 'some question',
        storyContext: { title: 'some question' },
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('storyContext missing its required title field is rejected', async () => {
      const dto = plainToInstance(AnalyzeNewsDto, {
        query: 'some question',
        storyContext: { countryCode: 'RWA' },
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('an excessively long storyContext.title is rejected, mirroring the top-level query length cap', async () => {
      const dto = plainToInstance(AnalyzeNewsDto, {
        query: 'some question',
        storyContext: { title: 'a'.repeat(500) },
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('an excessively long storyContext.countryCode is rejected', async () => {
      const dto = plainToInstance(AnalyzeNewsDto, {
        query: 'some question',
        storyContext: { title: 'some question', countryCode: 'a'.repeat(50) },
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
