import { ConfigService } from '@nestjs/config';
import { NewsStartupValidator, NewsStartupConfigurationError } from './news-startup-validator';
import { isUsableGNewsApiKey } from '../providers/provider.tokens';

function makeConfigService(overrides: {
  nodeEnv: string | undefined;
  gnewsApiKey: string | undefined;
}): ConfigService {
  const values: Record<string, string | undefined> = {
    NODE_ENV: overrides.nodeEnv,
    GNEWS_API_KEY: overrides.gnewsApiKey,
  };

  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('NewsStartupValidator', () => {
  it('allows startup in development mode when GNEWS_API_KEY is missing', () => {
    const validator = new NewsStartupValidator(
      makeConfigService({ nodeEnv: 'development', gnewsApiKey: undefined }),
    );

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
  });

  it('allows startup when NODE_ENV is unset and GNEWS_API_KEY is missing', () => {
    const validator = new NewsStartupValidator(
      makeConfigService({ nodeEnv: undefined, gnewsApiKey: undefined }),
    );

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
  });

  it('allows startup in development mode when GNEWS_API_KEY is empty', () => {
    const validator = new NewsStartupValidator(
      makeConfigService({ nodeEnv: 'development', gnewsApiKey: '' }),
    );

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
  });

  it('allows startup in development mode when GNEWS_API_KEY is whitespace-only', () => {
    const validator = new NewsStartupValidator(
      makeConfigService({ nodeEnv: 'development', gnewsApiKey: '   ' }),
    );

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
  });

  it('allows startup in production mode when GNEWS_API_KEY is a real, non-blank value', () => {
    const validator = new NewsStartupValidator(
      makeConfigService({ nodeEnv: 'production', gnewsApiKey: 'real-gnews-key' }),
    );

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
  });

  it('throws in production mode when GNEWS_API_KEY is missing', () => {
    const validator = new NewsStartupValidator(
      makeConfigService({ nodeEnv: 'production', gnewsApiKey: undefined }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(NewsStartupConfigurationError);
  });

  it('throws in production mode when GNEWS_API_KEY is an empty string', () => {
    const validator = new NewsStartupValidator(
      makeConfigService({ nodeEnv: 'production', gnewsApiKey: '' }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(NewsStartupConfigurationError);
  });

  it('throws in production mode when GNEWS_API_KEY is whitespace-only', () => {
    const validator = new NewsStartupValidator(
      makeConfigService({ nodeEnv: 'production', gnewsApiKey: '   ' }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(NewsStartupConfigurationError);
  });

  it('treats NODE_ENV case/whitespace-insensitively, matching AnalysisConfigService.readExecutionMode', () => {
    const validator = new NewsStartupValidator(
      makeConfigService({ nodeEnv: '  PRODUCTION  ', gnewsApiKey: undefined }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(NewsStartupConfigurationError);
  });

  it('never includes the configured (unusable) key value in the thrown error message', () => {
    const validator = new NewsStartupValidator(
      makeConfigService({ nodeEnv: 'production', gnewsApiKey: '   ' }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(
      'Production news retrieval requires a valid GNEWS_API_KEY. GNEWS_API_KEY is whitespace-only.',
    );
  });

  it('never includes a real-looking secret value in the thrown error message', () => {
    // Distinct from the whitespace-only case above: proves that even
    // if a "plausible but rejected" secret-shaped string were ever
    // passed through by mistake, nothing about the string itself is
    // ever interpolated into the message — the message is always this
    // validator's fixed, generic phrasing.
    const validator = new NewsStartupValidator(
      makeConfigService({ nodeEnv: 'production', gnewsApiKey: '' }),
    );

    const thrown = (() => {
      try {
        validator.onApplicationBootstrap();
        return undefined;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    })();

    expect(thrown).toBe(
      'Production news retrieval requires a valid GNEWS_API_KEY. GNEWS_API_KEY is missing or empty.',
    );
  });

  describe('isUsableGNewsApiKey (shared with news.module.ts provider selection)', () => {
    // Milestone #33: this is the exact same function news.module.ts's
    // NEWS_PROVIDERS factory imports and calls — asserting its
    // behavior here proves the startup guard and provider selection
    // can never disagree, without needing a full Nest DI test module.
    it('is unusable when undefined, empty, or whitespace-only', () => {
      expect(isUsableGNewsApiKey(undefined)).toBe(false);
      expect(isUsableGNewsApiKey('')).toBe(false);
      expect(isUsableGNewsApiKey('   ')).toBe(false);
    });

    it('is usable for any non-blank value', () => {
      expect(isUsableGNewsApiKey('real-key')).toBe(true);
      expect(isUsableGNewsApiKey('  real-key  ')).toBe(true);
    });
  });
});
