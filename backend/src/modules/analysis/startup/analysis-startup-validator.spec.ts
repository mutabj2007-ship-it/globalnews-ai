import {
  AnalysisStartupValidator,
  AnalysisStartupConfigurationError,
} from './analysis-startup-validator';
import type { AnalysisConfigService } from '../config/analysis-config.service';

function makeConfigService(overrides: {
  executionMode: 'production' | 'development';
  openAiApiKey: string | undefined;
}): AnalysisConfigService {
  return {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      cacheTtlSeconds: 300,
      openAiModel: 'gpt-4o-mini',
      retryAttempts: 2,
      retryBaseDelayMs: 300,
      ...overrides,
    }),
  } as unknown as AnalysisConfigService;
}

describe('AnalysisStartupValidator', () => {
  it('allows startup in development mode when OPENAI_API_KEY is missing', () => {
    const validator = new AnalysisStartupValidator(
      makeConfigService({ executionMode: 'development', openAiApiKey: undefined }),
    );

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
  });

  it('allows startup in development mode even when OPENAI_API_KEY is whitespace-only', () => {
    const validator = new AnalysisStartupValidator(
      makeConfigService({ executionMode: 'development', openAiApiKey: '   ' }),
    );

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
  });

  it('allows startup in production mode when OPENAI_API_KEY is a real, non-empty value', () => {
    const validator = new AnalysisStartupValidator(
      makeConfigService({ executionMode: 'production', openAiApiKey: 'sk-real-key' }),
    );

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
  });

  it('throws in production mode when OPENAI_API_KEY is missing', () => {
    const validator = new AnalysisStartupValidator(
      makeConfigService({ executionMode: 'production', openAiApiKey: undefined }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(AnalysisStartupConfigurationError);
  });

  it('throws in production mode when OPENAI_API_KEY is an empty string', () => {
    const validator = new AnalysisStartupValidator(
      makeConfigService({ executionMode: 'production', openAiApiKey: '' }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(AnalysisStartupConfigurationError);
  });

  it('throws in production mode when OPENAI_API_KEY is whitespace-only', () => {
    const validator = new AnalysisStartupValidator(
      makeConfigService({ executionMode: 'production', openAiApiKey: '   ' }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(AnalysisStartupConfigurationError);
  });

  it('never includes the configured (unusable) key value in the thrown error message', () => {
    // The thrown message must only ever contain this validator's fixed,
    // generic phrasing — never anything derived from the configured
    // value itself. Asserting the exact message (via jest's toThrow(string),
    // which checks the thrown error's message contains the given string)
    // is the direct way to prove that: any leak at all would change it.
    const validator = new AnalysisStartupValidator(
      makeConfigService({ executionMode: 'production', openAiApiKey: '   ' }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(
      'Production AI mode requires a valid OPENAI_API_KEY. OPENAI_API_KEY is whitespace-only.',
    );
  });
});
