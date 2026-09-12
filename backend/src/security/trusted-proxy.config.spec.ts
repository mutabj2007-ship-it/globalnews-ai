import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {
  TrustProxyConfigurationError,
  TrustedProxyStartupValidator,
  describeTrustProxySetting,
  resolveTrustProxySetting,
} from './trusted-proxy.config';

/**
 * B-1 - behavioural coverage for bounded proxy trust.
 *
 * These are behavioural tests, not source-text locks: each calls the real
 * resolver with a real value and asserts what it returns, mirroring the
 * convention frontend/src/lib/api/apiBase.spec.ts establishes.
 */

function configWith(env: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

describe('B-1 - resolveTrustProxySetting()', () => {
  describe('disabled - the default, and identical to pre-B-1 behaviour', () => {
    it.each([
      ['unset', undefined],
      ['empty', ''],
      ['whitespace', '   '],
      ['zero', '0'],
      ['false', 'false'],
      ['off', 'off'],
      ['no', 'no'],
      ['none', 'none'],
      ['disabled', 'disabled'],
    ])('treats %s as no trust at all', (_label, value) => {
      expect(resolveTrustProxySetting('production', value as string | undefined)).toBe(false);
    });

    it('is case- and whitespace-insensitive, so " FALSE " is not mistaken for an allowlist entry', () => {
      expect(resolveTrustProxySetting(undefined, ' FALSE ')).toBe(false);
    });
  });

  describe('hop count', () => {
    it.each([
      ['1', 1],
      ['2', 2],
      ['10', 10],
    ])('accepts %s as a bounded proxy count', (raw, expected) => {
      expect(resolveTrustProxySetting('production', raw)).toBe(expected);
    });

    it.each(['11', '99', '1000'])(
      'rejects %s - beyond any real topology, and a too-high count re-opens spoofing',
      (raw) => {
        expect(() => resolveTrustProxySetting('production', raw)).toThrow(
          TrustProxyConfigurationError,
        );
      },
    );
  });

  describe('allowlist', () => {
    it('accepts a single CIDR range', () => {
      expect(resolveTrustProxySetting('production', '10.0.0.0/8')).toEqual(['10.0.0.0/8']);
    });

    it('accepts a comma-separated list, trimming each entry', () => {
      expect(resolveTrustProxySetting('production', 'loopback, 172.16.0.0/12 ,10.1.2.3')).toEqual([
        'loopback',
        '172.16.0.0/12',
        '10.1.2.3',
      ]);
    });

    it.each(['loopback', 'linklocal', 'uniquelocal'])('accepts the named range %s', (preset) => {
      expect(resolveTrustProxySetting('production', preset)).toEqual([preset]);
    });

    it('accepts IPv6 with and without a prefix', () => {
      expect(resolveTrustProxySetting('production', '::1')).toEqual(['::1']);
      expect(resolveTrustProxySetting('production', 'fd00::/8')).toEqual(['fd00::/8']);
    });

    it.each(['999.1.1.1', '10.0.0.0/99', 'not-an-address', '10.0.0.0/8,garbage', 'fd00::/300'])(
      'rejects %s rather than passing malformed input through to Express',
      (raw) => {
        expect(() => resolveTrustProxySetting('production', raw)).toThrow(
          TrustProxyConfigurationError,
        );
      },
    );
  });

  describe('unrestricted trust is unreachable by configuration', () => {
    it.each(['true', 'TRUE', ' true ', 'yes', 'on', '*', 'all', 'any'])(
      'refuses %p - it would trust the entire forwarded chain',
      (raw) => {
        expect(() => resolveTrustProxySetting('production', raw)).toThrow(
          TrustProxyConfigurationError,
        );
      },
    );

    it('explains WHY in the error, naming forged identities rather than reading as a typo', () => {
      expect(() => resolveTrustProxySetting('production', 'true')).toThrow(
        /forge a fresh rate-limit identity/,
      );
    });

    it('never returns a boolean true, under any input, in any environment', () => {
      for (const value of [undefined, '', '0', '1', '10', '10.0.0.0/8', 'loopback']) {
        let resolved: unknown;
        try {
          resolved = resolveTrustProxySetting('production', value);
        } catch {
          continue;
        }
        expect(resolved).not.toBe(true);
      }
    });
  });

  it('an unparseable value throws rather than silently degrading to false - a trust setting that is ignored looks configured and is not', () => {
    expect(() => resolveTrustProxySetting('production', 'sort-of-maybe')).toThrow(
      TrustProxyConfigurationError,
    );
  });

  it('resolves identically in every NODE_ENV - unlike CORS, this has a safe default everywhere', () => {
    for (const nodeEnv of ['production', 'development', undefined]) {
      expect(resolveTrustProxySetting(nodeEnv, '1')).toBe(1);
      expect(resolveTrustProxySetting(nodeEnv, undefined)).toBe(false);
    }
  });
});

describe('B-1 - describeTrustProxySetting()', () => {
  it('describes each model in terms an operator can act on', () => {
    expect(describeTrustProxySetting(false)).toContain('socket peer');
    expect(describeTrustProxySetting(2)).toContain('2 proxy hop');
    expect(describeTrustProxySetting(['10.0.0.0/8'])).toContain('allowlist');
  });
});

describe('B-1 - TrustedProxyStartupValidator', () => {
  let logs: string[];
  let warnings: string[];

  beforeEach(() => {
    logs = [];
    warnings = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
      warnings.push(String(message));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws on an unusable value, so a misconfigured deployment fails at boot', () => {
    const validator = new TrustedProxyStartupValidator(
      configWith({ NODE_ENV: 'production', TRUST_PROXY: 'true' }),
    );

    expect(() => validator.onApplicationBootstrap()).toThrow(TrustProxyConfigurationError);
  });

  it('logs the resolved model, so which trust model a deployment got appears in its boot log', () => {
    new TrustedProxyStartupValidator(
      configWith({ NODE_ENV: 'production', TRUST_PROXY: '10.0.0.0/8' }),
    ).onApplicationBootstrap();

    expect(logs.join(' ')).toContain('allowlist');
  });

  it('WARNS but does not fail boot in production when unset - a single-container deployment behind no proxy is legitimate', () => {
    const validator = new TrustedProxyStartupValidator(configWith({ NODE_ENV: 'production' }));

    expect(() => validator.onApplicationBootstrap()).not.toThrow();
    expect(warnings.join(' ')).toContain('share ONE rate-limit identity');
  });

  it('says nothing alarming outside production', () => {
    new TrustedProxyStartupValidator(
      configWith({ NODE_ENV: 'development' }),
    ).onApplicationBootstrap();

    expect(warnings).toEqual([]);
    expect(logs.join(' ')).toContain('disabled');
  });
});
