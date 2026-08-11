import { ConfigService } from '@nestjs/config';
import {
  CorsConfigurationError,
  CorsStartupValidator,
  resolveFrontendOrigin,
} from './cors-startup-validator';

function makeConfigService(overrides: {
  nodeEnv: string | undefined;
  frontendOrigin: string | undefined;
}): ConfigService {
  const values: Record<string, string | undefined> = {
    NODE_ENV: overrides.nodeEnv,
    FRONTEND_ORIGIN: overrides.frontendOrigin,
  };

  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('resolveFrontendOrigin (Milestone #34 — shared by main.ts and CorsStartupValidator)', () => {
  it('development + missing origin -> localhost development fallback', () => {
    expect(resolveFrontendOrigin('development', undefined)).toBe('http://localhost:3000');
  });

  it('development + empty origin -> localhost development fallback', () => {
    expect(resolveFrontendOrigin('development', '')).toBe('http://localhost:3000');
  });

  it('development + whitespace-only origin -> localhost development fallback', () => {
    expect(resolveFrontendOrigin('development', '   ')).toBe('http://localhost:3000');
  });

  it('development + a real configured origin -> uses that origin, not localhost', () => {
    expect(resolveFrontendOrigin('development', 'https://staging.example.com')).toBe(
      'https://staging.example.com',
    );
  });

  it('undefined NODE_ENV + missing origin -> localhost development fallback', () => {
    expect(resolveFrontendOrigin(undefined, undefined)).toBe('http://localhost:3000');
  });

  it('production + a real nonblank origin -> uses that origin', () => {
    expect(resolveFrontendOrigin('production', 'https://app.globalnews.example')).toBe(
      'https://app.globalnews.example',
    );
  });

  it('production + missing origin -> throws CorsConfigurationError', () => {
    expect(() => resolveFrontendOrigin('production', undefined)).toThrow(CorsConfigurationError);
  });

  it('production + empty origin -> throws CorsConfigurationError', () => {
    expect(() => resolveFrontendOrigin('production', '')).toThrow(CorsConfigurationError);
  });

  it('production + whitespace-only origin -> throws CorsConfigurationError', () => {
    expect(() => resolveFrontendOrigin('production', '   ')).toThrow(CorsConfigurationError);
  });

  it('production never falls back to localhost even implicitly', () => {
    expect(() => resolveFrontendOrigin('production', undefined)).toThrow();
    // Explicitly assert the thrown path never resolves to a value at all.
    let resolved: string | undefined;
    try {
      resolved = resolveFrontendOrigin('production', undefined);
    } catch {
      /* expected */
    }
    expect(resolved).toBeUndefined();
  });

  it('NODE_ENV is treated case/whitespace-insensitively, matching AnalysisConfigService/NewsStartupValidator', () => {
    expect(() => resolveFrontendOrigin('  PRODUCTION  ', undefined)).toThrow(
      CorsConfigurationError,
    );
  });

  it('never includes the configured (unusable) value in the thrown error message', () => {
    expect(() => resolveFrontendOrigin('production', '   ')).toThrow(
      'Production CORS configuration requires a valid FRONTEND_ORIGIN. FRONTEND_ORIGIN is whitespace-only.',
    );
  });

  it('missing vs empty both report "missing or empty", never leaking which exact byte-length distinction applied', () => {
    expect(() => resolveFrontendOrigin('production', undefined)).toThrow(
      'Production CORS configuration requires a valid FRONTEND_ORIGIN. FRONTEND_ORIGIN is missing or empty.',
    );
    expect(() => resolveFrontendOrigin('production', '')).toThrow(
      'Production CORS configuration requires a valid FRONTEND_ORIGIN. FRONTEND_ORIGIN is missing or empty.',
    );
  });
});

describe('CorsStartupValidator', () => {
  it('allows startup in development mode when FRONTEND_ORIGIN is missing', () => {
    const validator = new CorsStartupValidator(
      makeConfigService({ nodeEnv: 'development', frontendOrigin: undefined }),
    );

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
  });

  it('allows startup in development mode when FRONTEND_ORIGIN is whitespace-only', () => {
    const validator = new CorsStartupValidator(
      makeConfigService({ nodeEnv: 'development', frontendOrigin: '   ' }),
    );

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
  });

  it('allows startup in production mode when FRONTEND_ORIGIN is a real, non-blank value', () => {
    const validator = new CorsStartupValidator(
      makeConfigService({ nodeEnv: 'production', frontendOrigin: 'https://app.example.com' }),
    );

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
  });

  it('throws in production mode when FRONTEND_ORIGIN is missing', () => {
    const validator = new CorsStartupValidator(
      makeConfigService({ nodeEnv: 'production', frontendOrigin: undefined }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(CorsConfigurationError);
  });

  it('throws in production mode when FRONTEND_ORIGIN is an empty string', () => {
    const validator = new CorsStartupValidator(
      makeConfigService({ nodeEnv: 'production', frontendOrigin: '' }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(CorsConfigurationError);
  });

  it('throws in production mode when FRONTEND_ORIGIN is whitespace-only', () => {
    const validator = new CorsStartupValidator(
      makeConfigService({ nodeEnv: 'production', frontendOrigin: '   ' }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(CorsConfigurationError);
  });

  it('never includes the configured (unusable) value in the thrown error message', () => {
    const validator = new CorsStartupValidator(
      makeConfigService({ nodeEnv: 'production', frontendOrigin: '   ' }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(
      'Production CORS configuration requires a valid FRONTEND_ORIGIN. FRONTEND_ORIGIN is whitespace-only.',
    );
  });
});
