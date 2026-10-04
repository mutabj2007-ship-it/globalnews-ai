import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  describeUnusableCredential,
  isPlaceholderCredential,
  isUsableApiCredential,
} from './placeholder-credential';
import { isUsableGNewsApiKey } from '../modules/news/providers/provider.tokens';
import { isUsableOpenAiApiKey } from '../modules/analysis/providers/provider.tokens';
import { isUsableEventRegistryApiKey } from '../modules/signals/providers/event-registry.provider';
import { NewsStartupValidator, NewsStartupConfigurationError } from '../modules/news/startup/news-startup-validator';
import { GNewsProvider } from '../modules/news/providers/gnews.provider';
import { XRecentSearchProvider, YouTubeSearchProvider } from '../modules/news/social/social-search.providers';
import { resolveAiProviderPosture } from '../modules/admin/system/admin-system.service';

/** T1 — placeholder credentials are "not configured", everywhere a provider key is checked. */
describe('T1 · isPlaceholderCredential', () => {
  it.each([
    'replace_with_your_gnews_key',
    'replace_with_your_event_registry_key',
    'replace_with_your_openai_key',
    'REPLACE-WITH-KEY',
    'change_me',
    'changeme',
    'your_api_key',
    'your-gnews-key',
    'your_key_here',
    '<your-key>',
    '${GNEWS_API_KEY}',
    '{{ api_key }}',
    'xxx',
    'XXXXXXXX',
    'xxxx-xxxx-xxxx',
    '****',
    'example',
    'dummy',
    'dummy_api_key',
    'test-key',
    'test_api_key',
    'fake-token',
    'placeholder',
    'insert_your_key_here',
    '  replace_with_your_gnews_key  ',
  ])('rejects %p', (value) => {
    expect(isPlaceholderCredential(value)).toBe(true);
    expect(isUsableApiCredential(value)).toBe(false);
  });

  it.each([
    'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
    'sk-proj-AbC123xyz',
    'test-key-12345',
    'gnews-spec-fixture-key-7f3a',
    'real-key',
    'key',
    'my-testing-environment-key-9',
  ])('accepts a plausible real key %p (whole-value matching only)', (value) => {
    expect(isPlaceholderCredential(value)).toBe(false);
    expect(isUsableApiCredential(value)).toBe(true);
  });

  it('missing / blank are unusable but are not "placeholders"', () => {
    for (const v of [undefined, null, '', '   ']) {
      expect(isPlaceholderCredential(v)).toBe(false);
      expect(isUsableApiCredential(v)).toBe(false);
    }
  });

  it('every provider key value shipped in .env.example is rejected (anti-drift)', () => {
    const root = join(__dirname, '..', '..', '..');
    for (const file of [join(root, '.env.example'), join(root, 'backend', '.env.example')]) {
      const shipped = readFileSync(file, 'utf8')
        .split('\n')
        .map((line) => /^([A-Z_]+_(?:API_KEY|BEARER_TOKEN))=(.*)$/.exec(line.trim()))
        .filter((m): m is RegExpExecArray => m !== null && m[2].trim().length > 0);
      expect(shipped.length).toBeGreaterThan(0);
      for (const [, name, value] of shipped) {
        expect([name, isUsableApiCredential(value)]).toEqual([name, false]);
      }
    }
  });

  it('describes the reason without echoing the value', () => {
    const message = describeUnusableCredential('GNEWS_API_KEY', 'replace_with_your_gnews_key');
    expect(message).toContain('placeholder');
    expect(message).not.toContain('replace_with_your_gnews_key');
  });
});

describe('T1 · every provider key check rejects placeholders', () => {
  it('GNews, OpenAI, Event Registry predicates', () => {
    expect(isUsableGNewsApiKey('replace_with_your_gnews_key')).toBe(false);
    expect(isUsableOpenAiApiKey('replace_with_your_openai_key')).toBe(false);
    expect(isUsableEventRegistryApiKey('replace_with_your_event_registry_key')).toBe(false);
    expect(isUsableGNewsApiKey('a-real-looking-key-123')).toBe(true);
  });

  it('admin AI posture agrees with isUsableOpenAiApiKey on a placeholder', () => {
    expect(
      resolveAiProviderPosture({
        openAiApiKey: 'replace_with_your_openai_key',
        nodeEnv: 'production',
        aiExecutionMode: undefined,
      }),
    ).toEqual({ status: 'FAILING', detail: 'ai-provider-not-configured' });
  });

  it('production startup refuses a placeholder GNEWS_API_KEY and says why', () => {
    const config = {
      get: (k: string) =>
        k === 'NODE_ENV' ? 'production' : k === 'GNEWS_API_KEY' ? 'replace_with_your_gnews_key' : undefined,
    };
    const validator = new NewsStartupValidator(config as never);
    expect(() => validator.onApplicationBootstrap()).toThrow(NewsStartupConfigurationError);
    expect(() => validator.onApplicationBootstrap()).toThrow(/placeholder/);
  });

  it('GNews health reports a placeholder key as not configured, and makes no request', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('no network'));
    try {
      const provider = new GNewsProvider({ get: () => 'replace_with_your_gnews_key' } as never);
      const health = await provider.health();
      expect(health.status).toBe('down');
      expect(health.message).toContain('not configured');
      await expect(provider.search('x')).rejects.toThrow('GNEWS_API_KEY is not configured');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('social lanes treat a placeholder token/key as not configured', () => {
    const cfg = (values: Record<string, string>) => ({ get: (k: string) => values[k] });
    expect(
      new XRecentSearchProvider(
        cfg({ ASK_SOCIAL_X_ENABLED: 'true', X_API_BEARER_TOKEN: 'your_x_bearer_token' }) as never,
      ).configured(),
    ).toBe(false);
    expect(
      new YouTubeSearchProvider(
        cfg({ ASK_SOCIAL_YOUTUBE_ENABLED: 'true', YOUTUBE_API_KEY: 'replace_with_your_youtube_key' }) as never,
      ).configured(),
    ).toBe(false);
    expect(
      new YouTubeSearchProvider(
        cfg({ ASK_SOCIAL_YOUTUBE_ENABLED: 'true', YOUTUBE_API_KEY: 'AIzaReal123' }) as never,
      ).configured(),
    ).toBe(true);
  });
});
