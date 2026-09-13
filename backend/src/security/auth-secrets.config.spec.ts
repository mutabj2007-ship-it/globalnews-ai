import { readFileSync } from 'fs';
import { join } from 'path';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  AUTH_SECRET_ENV_VARS,
  AuthSecretsConfigurationError,
  AuthSecretsStartupValidator,
  RECOMMENDED_FLOW_SECRET_MIN_LENGTH,
  SHIPPED_PLACEHOLDER_VALUES,
  describeAuthSecretsMode,
  resolveAuthSecretsMode,
} from './auth-secrets.config';

/**
 * S1 — NEGATIVE CONTROLS for production auth-secret validation.
 *
 * The point of a fail-closed guard is what it REFUSES, so most of this file is
 * refusals. The positive cases exist to prove the guard is not simply refusing
 * everything — a validator that rejects a correct configuration gets disabled
 * by the next person, which is worse than having none.
 */

const GOOD = {
  OAUTH_CLIENT_ID: '1234567890-abcdefghijklmnop.apps.googleusercontent.com',
  OAUTH_CLIENT_SECRET: 'GOCSPX-a1b2c3d4e5f6g7h8i9j0',
  // 44 characters, the length `openssl rand -base64 32` produces.
  OAUTH_FLOW_SECRET: 'RTNIVDdRc0hUR0pOTkFuT0J6bFZ4a3BSc2VDeVBmQmc=',
};

describe('S1 — resolveAuthSecretsMode: production REFUSES an unusable configuration', () => {
  it('rejects a shipped placeholder in OAUTH_FLOW_SECRET — the HMAC key protecting the flow-state cookie', () => {
    expect(() =>
      resolveAuthSecretsMode('production', { ...GOOD, OAUTH_FLOW_SECRET: 'change_me' }),
    ).toThrow(AuthSecretsConfigurationError);
  });

  it('rejects a shipped placeholder in OAUTH_CLIENT_SECRET', () => {
    expect(() =>
      resolveAuthSecretsMode('production', { ...GOOD, OAUTH_CLIENT_SECRET: 'change_me' }),
    ).toThrow(AuthSecretsConfigurationError);
  });

  it('rejects the exact OAUTH_CLIENT_ID placeholder .env.example ships', () => {
    expect(() =>
      resolveAuthSecretsMode('production', {
        ...GOOD,
        OAUTH_CLIENT_ID: 'your-google-oauth-client-id.apps.googleusercontent.com',
      }),
    ).toThrow(AuthSecretsConfigurationError);
  });

  it('rejects a placeholder regardless of surrounding whitespace or case', () => {
    expect(() =>
      resolveAuthSecretsMode('production', { ...GOOD, OAUTH_FLOW_SECRET: '  CHANGE_ME  ' }),
    ).toThrow(AuthSecretsConfigurationError);
  });

  it('names every offending variable, so one boot tells the operator the whole story', () => {
    expect(() =>
      resolveAuthSecretsMode('production', {
        ...GOOD,
        OAUTH_CLIENT_SECRET: 'change_me',
        OAUTH_FLOW_SECRET: 'change_me',
      }),
    ).toThrow(/OAUTH_CLIENT_SECRET, OAUTH_FLOW_SECRET/);
  });

  it('rejects a blank value that is present but whitespace-only', () => {
    expect(() =>
      resolveAuthSecretsMode('production', { ...GOOD, OAUTH_FLOW_SECRET: '   ' }),
    ).toThrow(AuthSecretsConfigurationError);
  });

  it('rejects an empty string', () => {
    expect(() =>
      resolveAuthSecretsMode('production', { ...GOOD, OAUTH_CLIENT_SECRET: '' }),
    ).toThrow(AuthSecretsConfigurationError);
  });

  it.each(AUTH_SECRET_ENV_VARS)(
    'rejects a production deployment with %s missing while the other two are set',
    (missing) => {
      const values = { ...GOOD, [missing]: undefined };

      expect(() => resolveAuthSecretsMode('production', values)).toThrow(
        AuthSecretsConfigurationError,
      );
    },
  );

  it('explains the partial case as partial, not as a placeholder problem', () => {
    expect(() =>
      resolveAuthSecretsMode('production', { ...GOOD, OAUTH_FLOW_SECRET: undefined }),
    ).toThrow(/partially configured/);
  });

  it('the error never contains the secret value itself', () => {
    const secret = 'a-real-looking-secret-value-9f3e1236';

    try {
      resolveAuthSecretsMode('production', {
        ...GOOD,
        OAUTH_CLIENT_SECRET: secret,
        OAUTH_FLOW_SECRET: 'change_me',
      });
      throw new Error('expected a rejection');
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
      expect((error as Error).message).not.toContain('change_me');
    }
  });

  it('normalizes NODE_ENV the way every other fail-closed guard does', () => {
    // " Production " satisfied the cookie Secure gate before the i3 fix; this
    // guard must not reintroduce the same class of bypass.
    expect(() =>
      resolveAuthSecretsMode(' Production ', { ...GOOD, OAUTH_FLOW_SECRET: 'change_me' }),
    ).toThrow(AuthSecretsConfigurationError);
  });
});

describe('S1 — resolveAuthSecretsMode: what it deliberately ALLOWS', () => {
  it('accepts a fully configured production deployment', () => {
    const mode = resolveAuthSecretsMode('production', GOOD);

    expect(mode.kind).toBe('configured');
  });

  it('accepts production with NONE of the three set — guest-only is a legitimate deployment', () => {
    const mode = resolveAuthSecretsMode('production', {});

    expect(mode.kind).toBe('guest-only');
  });

  it('treats three blank values as guest-only rather than as a partial configuration', () => {
    const mode = resolveAuthSecretsMode('production', {
      OAUTH_CLIENT_ID: '',
      OAUTH_CLIENT_SECRET: '   ',
      OAUTH_FLOW_SECRET: undefined,
    });

    expect(mode.kind).toBe('guest-only');
  });

  it('PRESERVES NON-PRODUCTION GUEST DEVELOPMENT: development with no values at all is untouched', () => {
    expect(resolveAuthSecretsMode('development', {}).kind).toBe('not-production');
    expect(resolveAuthSecretsMode(undefined, {}).kind).toBe('not-production');
    expect(resolveAuthSecretsMode('test', {}).kind).toBe('not-production');
  });

  it('PRESERVES LOCAL DEVELOPMENT WITH THE SHIPPED PLACEHOLDERS: .env.example still works verbatim', () => {
    // The whole point of the example file is that a fresh checkout runs. This
    // guard must never be the reason a newcomer cannot start the backend.
    expect(() =>
      resolveAuthSecretsMode('development', {
        OAUTH_CLIENT_ID: 'your-google-oauth-client-id.apps.googleusercontent.com',
        OAUTH_CLIENT_SECRET: 'change_me',
        OAUTH_FLOW_SECRET: 'change_me',
      }),
    ).not.toThrow();
  });

  it('never constrains OAUTH_CLIENT_ID or OAUTH_CLIENT_SECRET by length — Google dictates their format', () => {
    expect(() =>
      resolveAuthSecretsMode('production', {
        ...GOOD,
        OAUTH_CLIENT_ID: 'x',
        OAUTH_CLIENT_SECRET: 'y',
      }),
    ).not.toThrow();
  });

  it('flags a short OAUTH_FLOW_SECRET as weak but still BOOTS — advisory, not a refusal', () => {
    const mode = resolveAuthSecretsMode('production', {
      ...GOOD,
      OAUTH_FLOW_SECRET: 'short-but-random-x',
    });

    expect(mode).toEqual({ kind: 'configured', weakFlowSecret: true });
  });

  it('does not flag a secret of the recommended length', () => {
    const mode = resolveAuthSecretsMode('production', {
      ...GOOD,
      OAUTH_FLOW_SECRET: 'x'.repeat(RECOMMENDED_FLOW_SECRET_MIN_LENGTH),
    });

    expect(mode).toEqual({ kind: 'configured', weakFlowSecret: false });
  });
});

describe('S1 — anti-drift: .env.example cannot ship a placeholder this guard would accept', () => {
  const envExample = readFileSync(join(__dirname, '..', '..', '..', '.env.example'), 'utf-8');

  function shippedValue(name: string): string | undefined {
    const match = envExample.split('\n').find((line) => line.startsWith(`${name}=`));

    return match?.slice(name.length + 1).trim();
  }

  it.each(AUTH_SECRET_ENV_VARS)('%s is present in .env.example', (name) => {
    expect(shippedValue(name)).toBeTruthy();
  });

  it.each(AUTH_SECRET_ENV_VARS)(
    'the value .env.example ships for %s is one this guard REFUSES in production',
    (name) => {
      const value = shippedValue(name) as string;

      // If somebody changes the placeholder in .env.example without adding the
      // new value here, this fails rather than silently reopening the hole.
      expect(SHIPPED_PLACEHOLDER_VALUES.has(value.toLowerCase())).toBe(true);

      expect(() => resolveAuthSecretsMode('production', { ...GOOD, [name]: value })).toThrow(
        AuthSecretsConfigurationError,
      );
    },
  );
});

describe('S1 — AuthSecretsStartupValidator wiring', () => {
  async function buildValidator(
    env: Record<string, string | undefined>,
  ): Promise<AuthSecretsStartupValidator> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthSecretsStartupValidator,
        { provide: ConfigService, useValue: { get: (key: string) => env[key] } },
      ],
    }).compile();

    return moduleRef.get(AuthSecretsStartupValidator);
  }

  it('throws on bootstrap when production carries a placeholder', async () => {
    const validator = await buildValidator({
      NODE_ENV: 'production',
      ...GOOD,
      OAUTH_FLOW_SECRET: 'change_me',
    });

    expect(() => validator.onApplicationBootstrap()).toThrow(AuthSecretsConfigurationError);
  });

  it('does not throw for a guest-only production deployment', async () => {
    const validator = await buildValidator({ NODE_ENV: 'production' });

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
  });

  it('does not throw in development, whatever the values are', async () => {
    const validator = await buildValidator({
      NODE_ENV: 'development',
      OAUTH_CLIENT_ID: 'change_me',
      OAUTH_CLIENT_SECRET: 'change_me',
      OAUTH_FLOW_SECRET: 'change_me',
    });

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
  });

  it('reads the same three variables the resolver validates, and no others', async () => {
    const seen: string[] = [];
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthSecretsStartupValidator,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              seen.push(key);
              return key === 'NODE_ENV' ? 'development' : undefined;
            },
          },
        },
      ],
    }).compile();

    moduleRef.get(AuthSecretsStartupValidator).onApplicationBootstrap();

    expect(seen.sort()).toEqual(['NODE_ENV', ...AUTH_SECRET_ENV_VARS].sort());
  });
});

describe('S1 — describeAuthSecretsMode never leaks a value', () => {
  it('describes each mode in words only', () => {
    expect(describeAuthSecretsMode({ kind: 'not-production' })).toMatch(/not validated/);
    expect(describeAuthSecretsMode({ kind: 'guest-only' })).toMatch(/guest-only/);
    expect(describeAuthSecretsMode({ kind: 'configured', weakFlowSecret: false })).toMatch(
      /configured/,
    );
  });
});
