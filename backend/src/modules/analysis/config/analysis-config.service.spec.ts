import { ConfigService } from '@nestjs/config';
import { AnalysisConfigService } from './analysis-config.service';

function makeService(
  values: Record<string, string | undefined>,
): AnalysisConfigService {
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;

  return new AnalysisConfigService(config);
}

describe('AnalysisConfigService', () => {
  describe('executionMode', () => {
    it('forces production mode when NODE_ENV is production and AI_EXECUTION_MODE is absent', () => {
      const service = makeService({
        NODE_ENV: 'production',
        AI_EXECUTION_MODE: undefined,
      });

      expect(service.get().executionMode).toBe('production');
    });

    it('forces production mode when NODE_ENV is production even if AI_EXECUTION_MODE says development', () => {
      const service = makeService({
        NODE_ENV: 'production',
        AI_EXECUTION_MODE: 'development',
      });

      expect(service.get().executionMode).toBe('production');
    });

    it('allows explicit production mode outside NODE_ENV production', () => {
      const service = makeService({
        NODE_ENV: 'development',
        AI_EXECUTION_MODE: 'production',
      });

      expect(service.get().executionMode).toBe('production');
    });

    it('defaults to development mode outside production when AI_EXECUTION_MODE is absent', () => {
      const service = makeService({
        NODE_ENV: 'development',
        AI_EXECUTION_MODE: undefined,
      });

      expect(service.get().executionMode).toBe('development');
    });

    it('defaults to development for an unrecognized execution mode outside production', () => {
      const service = makeService({
        NODE_ENV: 'development',
        AI_EXECUTION_MODE: 'invalid-value',
      });

      expect(service.get().executionMode).toBe('development');
    });
  });

  describe('maxCompletionTokens (Milestone #45)', () => {
    it('A1. default is positive and deterministic', () => {
      const service = makeService({});
      const first = service.get().maxCompletionTokens;
      const second = service.get().maxCompletionTokens;
      expect(first).toBeGreaterThan(0);
      expect(first).toBe(second);
      expect(first).toBe(2000);
    });

    it('A2. a valid ANALYSIS_MAX_COMPLETION_TOKENS override is honored', () => {
      const service = makeService({ ANALYSIS_MAX_COMPLETION_TOKENS: '500' });
      expect(service.get().maxCompletionTokens).toBe(500);
    });

    it('A3. zero, negative, and non-numeric values fall back to the default (existing safe parsing behavior, unchanged)', () => {
      expect(makeService({ ANALYSIS_MAX_COMPLETION_TOKENS: '0' }).get().maxCompletionTokens).toBe(2000);
      expect(makeService({ ANALYSIS_MAX_COMPLETION_TOKENS: '-100' }).get().maxCompletionTokens).toBe(2000);
      expect(makeService({ ANALYSIS_MAX_COMPLETION_TOKENS: 'not-a-number' }).get().maxCompletionTokens).toBe(2000);
      expect(makeService({ ANALYSIS_MAX_COMPLETION_TOKENS: undefined }).get().maxCompletionTokens).toBe(2000);
    });
  });
});
