import { ADMIN_PLATFORM_ENABLED_ENV, isAdminPlatformEnabled } from './admin-platform.config';

describe('ADMIN_PLATFORM_ENABLED kill switch', () => {
  it('names the environment variable the deployment actually sets', () => {
    expect(ADMIN_PLATFORM_ENABLED_ENV).toBe('ADMIN_PLATFORM_ENABLED');
  });

  it('is DISABLED when the variable is unset', () => {
    expect(isAdminPlatformEnabled(undefined)).toBe(false);
    expect(isAdminPlatformEnabled(null)).toBe(false);
  });

  it('enables ONLY on the exact string "true", case-insensitive and trimmed', () => {
    ['true', 'TRUE', 'True', ' true', 'true ', '\ttrue\n'].forEach((value) => {
      expect(isAdminPlatformEnabled(value)).toBe(true);
    });
  });

  it('refuses every other truthy-looking value — a permissive parser here would enable admin by accident', () => {
    [
      '1',
      'yes',
      'on',
      'enabled',
      'y',
      't',
      'TRUE!',
      'true false',
      '',
      '  ',
      'false',
      '0',
      'no',
    ].forEach((value) => {
      expect(isAdminPlatformEnabled(value)).toBe(false);
    });
  });

  it('refuses a non-string value', () => {
    expect(isAdminPlatformEnabled(undefined as unknown as string)).toBe(false);
  });
});
