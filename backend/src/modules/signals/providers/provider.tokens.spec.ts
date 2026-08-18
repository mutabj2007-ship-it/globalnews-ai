import { isGdeltEnabled, SIGNAL_PROVIDERS, ALL_SIGNAL_PROVIDERS } from './provider.tokens';

describe('isGdeltEnabled', () => {
  it('returns false for undefined', () => {
    expect(isGdeltEnabled(undefined)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isGdeltEnabled('')).toBe(false);
  });

  it('returns false for a whitespace-only string', () => {
    expect(isGdeltEnabled('   ')).toBe(false);
    expect(isGdeltEnabled('\t\n')).toBe(false);
  });

  it('returns true for "true", case-insensitively, with incidental surrounding whitespace', () => {
    expect(isGdeltEnabled('true')).toBe(true);
    expect(isGdeltEnabled('TRUE')).toBe(true);
    expect(isGdeltEnabled('True')).toBe(true);
    expect(isGdeltEnabled('  true  ')).toBe(true);
  });

  it('returns false for "false"', () => {
    expect(isGdeltEnabled('false')).toBe(false);
  });

  it('returns false for any other truthy-looking-but-not-exactly-"true" string — never guesses', () => {
    expect(isGdeltEnabled('1')).toBe(false);
    expect(isGdeltEnabled('yes')).toBe(false);
    expect(isGdeltEnabled('enabled')).toBe(false);
    expect(isGdeltEnabled('truex')).toBe(false);
  });
});

describe('SIGNAL_PROVIDERS / ALL_SIGNAL_PROVIDERS tokens', () => {
  it('are distinct symbols, mirroring the NEWS_PROVIDERS/ALL_NEWS_PROVIDERS separation', () => {
    expect(typeof SIGNAL_PROVIDERS).toBe('symbol');
    expect(typeof ALL_SIGNAL_PROVIDERS).toBe('symbol');
    expect(SIGNAL_PROVIDERS).not.toBe(ALL_SIGNAL_PROVIDERS);
  });
});
