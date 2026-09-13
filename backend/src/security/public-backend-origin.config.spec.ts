import { readFileSync } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import {
  PUBLIC_BACKEND_ORIGIN_ENV,
  PublicBackendOriginConfigurationError,
  PublicBackendOriginStartupValidator,
  resolvePublicBackendOrigin,
} from './public-backend-origin.config';

/**
 * B-2 repair — the resolver that replaced a request-derived OAuth callback
 * origin with a configured one.
 *
 * The blocker it closes: `req.protocol` is "http" behind a TLS-terminating
 * proxy unless Express's `trust proxy` is truthy, and that setting ships as
 * false. The derived redirect_uri was therefore http:// while the registered
 * one is https://, and Google refused every sign-in attempt.
 *
 * Two properties below are load-bearing rather than tidy, and both are stated
 * here so a future reader does not "simplify" them away:
 *
 *   PRODUCTION REFUSES http. Accepting a configured http origin in production
 *   would let the exact failure this file removes from the CODE return through
 *   CONFIGURATION instead.
 *
 *   A MALFORMED VALUE THROWS IN DEVELOPMENT TOO. Falling back silently would
 *   make a typo look like a working configuration, which is how the original
 *   defect survived: nothing ever said anything was wrong.
 */
describe('resolvePublicBackendOrigin — production', () => {
  const PROD = 'production';

  it('fails closed when the value is missing', () => {
    expect(() => resolvePublicBackendOrigin(PROD, undefined)).toThrow(
      PublicBackendOriginConfigurationError,
    );
  });

  it('fails closed when the value is empty', () => {
    expect(() => resolvePublicBackendOrigin(PROD, '')).toThrow(
      PublicBackendOriginConfigurationError,
    );
  });

  it('fails closed when the value is whitespace-only — not a truthiness check', () => {
    expect(() => resolvePublicBackendOrigin(PROD, '   ')).toThrow(
      PublicBackendOriginConfigurationError,
    );
  });

  it('fails closed on a malformed value that is not an absolute URL', () => {
    expect(() => resolvePublicBackendOrigin(PROD, 'api.example.com')).toThrow(
      PublicBackendOriginConfigurationError,
    );
    expect(() => resolvePublicBackendOrigin(PROD, 'https://')).toThrow(
      PublicBackendOriginConfigurationError,
    );
  });

  it('REFUSES an http origin — the defect must not be reachable through configuration', () => {
    expect(() => resolvePublicBackendOrigin(PROD, 'http://api.example.com')).toThrow(
      PublicBackendOriginConfigurationError,
    );
  });

  it('refuses a scheme that is neither http nor https', () => {
    expect(() => resolvePublicBackendOrigin(PROD, 'ftp://api.example.com')).toThrow(
      PublicBackendOriginConfigurationError,
    );
  });

  it('refuses a value carrying a path, a query or a fragment', () => {
    expect(() => resolvePublicBackendOrigin(PROD, 'https://api.example.com/auth')).toThrow(
      PublicBackendOriginConfigurationError,
    );
    expect(() => resolvePublicBackendOrigin(PROD, 'https://api.example.com?x=1')).toThrow(
      PublicBackendOriginConfigurationError,
    );
    expect(() => resolvePublicBackendOrigin(PROD, 'https://api.example.com#frag')).toThrow(
      PublicBackendOriginConfigurationError,
    );
  });

  it('refuses embedded credentials', () => {
    expect(() => resolvePublicBackendOrigin(PROD, 'https://user:pass@api.example.com')).toThrow(
      PublicBackendOriginConfigurationError,
    );
  });

  it('accepts an https origin', () => {
    expect(resolvePublicBackendOrigin(PROD, 'https://api.example.com')).toBe(
      'https://api.example.com',
    );
  });

  it('normalises a trailing slash rather than rejecting it — that is a typo, not an ambiguity', () => {
    expect(resolvePublicBackendOrigin(PROD, 'https://api.example.com/')).toBe(
      'https://api.example.com',
    );
  });

  it('trims surrounding whitespace, which a .env file supplies more often than anyone expects', () => {
    expect(resolvePublicBackendOrigin(PROD, '  https://api.example.com  ')).toBe(
      'https://api.example.com',
    );
  });

  it('normalises host case and a redundant default port, because Google compares byte for byte', () => {
    expect(resolvePublicBackendOrigin(PROD, 'https://API.Example.com')).toBe(
      'https://api.example.com',
    );
    expect(resolvePublicBackendOrigin(PROD, 'https://api.example.com:443')).toBe(
      'https://api.example.com',
    );
  });

  it('keeps a non-default port, which is a real part of the origin', () => {
    expect(resolvePublicBackendOrigin(PROD, 'https://api.example.com:8443')).toBe(
      'https://api.example.com:8443',
    );
  });

  it('normalises " Production " the same way every other guard in this codebase does', () => {
    expect(() => resolvePublicBackendOrigin(' Production ', undefined)).toThrow(
      PublicBackendOriginConfigurationError,
    );
  });

  it('never echoes a credential in its error message', () => {
    try {
      resolvePublicBackendOrigin(PROD, 'https://user:sup3rs3cret@api.example.com');
      fail('expected a throw');
    } catch (error) {
      expect((error as Error).message).not.toContain('sup3rs3cret');
    }
  });
});

describe('resolvePublicBackendOrigin — development', () => {
  it('falls back to http://localhost:4000 when unset', () => {
    expect(resolvePublicBackendOrigin('development', undefined)).toBe('http://localhost:4000');
    expect(resolvePublicBackendOrigin(undefined, undefined)).toBe('http://localhost:4000');
    expect(resolvePublicBackendOrigin('test', '')).toBe('http://localhost:4000');
  });

  it('THE FALLBACK IS NOT DERIVED FROM PORT, and changing PORT must not move it', () => {
    // docker-compose maps ${BACKEND_PORT:-4000}:4000 while setting PORT=4000
    // INSIDE the container, so PORT is the listening port and can differ from
    // the port a browser reaches. A derived fallback would be silently wrong.
    const originalPort = process.env.PORT;
    try {
      process.env.PORT = '9999';
      expect(resolvePublicBackendOrigin('development', undefined)).toBe('http://localhost:4000');
    } finally {
      if (originalPort === undefined) delete process.env.PORT;
      else process.env.PORT = originalPort;
    }
  });

  it('uses a configured value verbatim, http included', () => {
    expect(resolvePublicBackendOrigin('development', 'http://localhost:4100')).toBe(
      'http://localhost:4100',
    );
  });

  it('still THROWS on a malformed value — a silently ignored setting looks configured and is not', () => {
    expect(() => resolvePublicBackendOrigin('development', 'not-a-url')).toThrow(
      PublicBackendOriginConfigurationError,
    );
    expect(() => resolvePublicBackendOrigin('development', 'http://localhost:4000/auth')).toThrow(
      PublicBackendOriginConfigurationError,
    );
  });
});

describe('PublicBackendOriginStartupValidator', () => {
  function makeConfig(values: Record<string, string | undefined>): ConfigService {
    return { get: (key: string) => values[key] } as unknown as ConfigService;
  }

  it('throws at bootstrap in production when the origin is absent — this IS the fail-closed mechanism', () => {
    // Unlike CORS and trust-proxy, nothing in main.ts evaluates this value.
    // Without this provider a misconfigured production deployment would boot
    // healthy and fail at the first sign-in.
    const validator = new PublicBackendOriginStartupValidator(
      makeConfig({ NODE_ENV: 'production', [PUBLIC_BACKEND_ORIGIN_ENV]: undefined }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(PublicBackendOriginConfigurationError);
  });

  it('throws at bootstrap in production on an http origin', () => {
    const validator = new PublicBackendOriginStartupValidator(
      makeConfig({ NODE_ENV: 'production', [PUBLIC_BACKEND_ORIGIN_ENV]: 'http://api.example.com' }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(PublicBackendOriginConfigurationError);
  });

  it('starts cleanly on a valid production origin', () => {
    const validator = new PublicBackendOriginStartupValidator(
      makeConfig({
        NODE_ENV: 'production',
        [PUBLIC_BACKEND_ORIGIN_ENV]: 'https://api.example.com',
      }),
    );

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
  });

  it('starts cleanly in development with nothing configured', () => {
    const validator = new PublicBackendOriginStartupValidator(
      makeConfig({ NODE_ENV: 'development', [PUBLIC_BACKEND_ORIGIN_ENV]: undefined }),
    );

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
  });

  it('reads the SAME environment variable name the service reads', () => {
    // A validator guarding a different key from the one the service consumes
    // would be a guard over nothing.
    expect(PUBLIC_BACKEND_ORIGIN_ENV).toBe('PUBLIC_BACKEND_ORIGIN');
  });

  it('IS ACTUALLY REGISTERED IN app.module.ts — without this it is decoration', () => {
    // Found by a negative control that removed the registration and watched
    // every test still pass. A validator nobody wires up guards nothing, and
    // the boot-time check is the ONLY thing standing between a misconfigured
    // production deployment and a healthy-looking container that cannot sign
    // anybody in. Line endings normalised: this file is read on LF and CRLF
    // checkouts alike.
    const appModule = readFileSync(join(__dirname, '..', 'app.module.ts'), 'utf-8').replace(
      /\r\n/g,
      '\n',
    );

    expect(appModule).toContain(
      "import { PublicBackendOriginStartupValidator } from './security/public-backend-origin.config';",
    );

    const providersBlock = appModule.slice(
      appModule.indexOf('providers: ['),
      appModule.indexOf('controllers: [') > appModule.indexOf('providers: [')
        ? appModule.indexOf('controllers: [')
        : appModule.length,
    );
    expect(providersBlock).toContain('PublicBackendOriginStartupValidator,');
  });
});
