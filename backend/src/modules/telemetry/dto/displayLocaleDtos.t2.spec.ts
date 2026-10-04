import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DISPLAY_LOCALES } from '@globalnews-ai/shared';
import { RecordEventDto, TELEMETRY_LANGUAGE_VALUES } from './record-event.dto';
import { AnalyzeNewsDto, SUPPORTED_LANGUAGE_CODES } from '../../analysis/dto/analyze-news.dto';

/**
 * T2 · GLOBAL LANGUAGE FOUNDATION — the analysis and telemetry DTOs accept every display locale
 * (de and pt included) WITHOUT merging DisplayLocale into the retrieval LanguageCode.
 */
describe('T2 · display locales at the API boundary', () => {
  describe('telemetry `language`', () => {
    it.each([...DISPLAY_LOCALES])('accepts the display locale %s', async (locale) => {
      const dto = plainToInstance(RecordEventDto, { name: 'language_selected', language: locale });
      expect(await validate(dto)).toHaveLength(0);
    });

    it.each(['sw', 'rw'])('still accepts the retrieval-only LanguageCode %s', async (code) => {
      const dto = plainToInstance(RecordEventDto, { name: 'language_selected', language: code });
      expect(await validate(dto)).toHaveLength(0);
    });

    it.each(['zz', '', 'DE', 'pt-BR'])('rejects %p', async (value) => {
      const dto = plainToInstance(RecordEventDto, { name: 'language_selected', language: value });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    });

    it('the accepted set is exactly LanguageCode ∪ DisplayLocale', () => {
      expect([...TELEMETRY_LANGUAGE_VALUES].sort()).toEqual(
        [...new Set<string>([...SUPPORTED_LANGUAGE_CODES, ...DISPLAY_LOCALES])].sort(),
      );
    });
  });

  describe('analysis', () => {
    it.each([...DISPLAY_LOCALES])('accepts displayLocale=%s', async (locale) => {
      const dto = plainToInstance(AnalyzeNewsDto, { query: 'What is happening?', displayLocale: locale });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects an unknown displayLocale', async () => {
      const dto = plainToInstance(AnalyzeNewsDto, { query: 'What is happening?', displayLocale: 'zz' });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    });

    it.each(['de', 'pt'])('requestedLanguage (the retrieval LanguageCode) is NOT widened: %s is rejected', async (code) => {
      const dto = plainToInstance(AnalyzeNewsDto, { query: 'What is happening?', requestedLanguage: code });
      expect((await validate(dto)).length).toBeGreaterThan(0);
      expect(SUPPORTED_LANGUAGE_CODES as readonly string[]).not.toContain(code);
    });

    it('a body without displayLocale is unchanged (backward compatible)', async () => {
      const dto = plainToInstance(AnalyzeNewsDto, { query: 'What is happening?', requestedLanguage: 'pl' });
      expect(await validate(dto)).toHaveLength(0);
      expect(dto.displayLocale).toBeUndefined();
    });
  });
});
