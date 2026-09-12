import { readFileSync } from 'fs';
import { join } from 'path';
import type { ConfigService } from '@nestjs/config';
import { GdeltDocProvider } from './gdelt-doc.provider';
import { isGdeltDocEnabled } from './provider.tokens';

/**
 * G-ALPHA-1 D3 + D5 — "DELIBERATELY OFF" IS NOT "BROKEN".
 *
 * ProviderHealthState has three members — ok, degraded, down — and until now a
 * switched-off provider and an unreachable one both reported 'down'. Read from
 * the live Alpha on 2026-08-29, GDELT DOC appeared exactly like a failure:
 *
 *   gdelt-doc | down | 'GDELT_DOC_ENABLED is not set to "true". This provider
 *                       is switched off.'
 *
 * That is how a configuration omission was able to look like an outage, and it
 * is why the deployment evidence never showed the switch at all. The shared
 * ProviderHealthStatus interface ALREADY declares `enabled?: boolean`,
 * documented as "distinct from health/reachability"; the vocabulary existed and
 * was never populated. D3 populates it. D5 documents the variable in
 * .env.example, where it was entirely absent.
 *
 * NO CONTRACT CHANGED and no status value moved — asserted below, because an
 * additive field that quietly altered `status` would break every existing
 * consumer.
 */

function configFor(enabled: string | undefined): ConfigService {
  return {
    get: (key: string) => (key === 'GDELT_DOC_ENABLED' ? enabled : undefined),
  } as unknown as ConfigService;
}

function providerFor(enabled: string | undefined): GdeltDocProvider {
  const provider = new GdeltDocProvider(configFor(enabled));
  (provider as unknown as { lastRequestStartedAt: number }).lastRequestStartedAt = -1_000_000;
  return provider;
}

describe('D3 — a switched-off provider reports itself as switched off', () => {
  it('reports enabled:false when GDELT_DOC_ENABLED is unset', async () => {
    const health = await providerFor(undefined).health();

    expect(health.enabled).toBe(false);
  });

  it('keeps its existing status and message EXACTLY — this change is additive only', async () => {
    const health = await providerFor(undefined).health();

    expect(health.status).toBe('down');
    expect(health.message).toBe(
      'GDELT_DOC_ENABLED is not set to "true". This provider is switched off.',
    );
    expect(health.providerId).toBe('gdelt-doc');
  });

  it('reports enabled:false for every value that is not the exact literal "true"', async () => {
    for (const value of ['', '   ', '1', 'yes', 'on', 'TRUE!', 'false', undefined]) {
      const health = await providerFor(value).health();

      expect(health.enabled).toBe(false);
      expect(health.status).toBe('down');
    }
  });
});

describe('D3 — an enabled provider reports itself as enabled', () => {
  it('reports enabled:true, and status still describes REACHABILITY, not configuration', async () => {
    const health = await providerFor('true').health();

    expect(health.enabled).toBe(true);
    expect(health.status).toBe('ok');
  });

  it('accepts the literal in any case, with surrounding whitespace', async () => {
    for (const value of ['true', 'TRUE', ' True ', '\ttrue\n']) {
      const health = await providerFor(value).health();

      expect(health.enabled).toBe(true);
    }
  });

  it('a provider in COOLDOWN is enabled and degraded — a third condition, kept distinct', async () => {
    const provider = providerFor('true');
    (provider as unknown as { cooldownUntil: number }).cooldownUntil = Date.now() + 60_000;

    const health = await provider.health();

    expect(health.enabled).toBe(true);
    expect(health.status).toBe('degraded');
    expect(health.rateLimitState).toBe('throttled');
  });

  it('the three conditions are now mutually distinguishable from health alone', async () => {
    const off = await providerFor(undefined).health();
    const on = await providerFor('true').health();

    const cooling = providerFor('true');
    (cooling as unknown as { cooldownUntil: number }).cooldownUntil = Date.now() + 60_000;
    const throttled = await cooling.health();

    const signature = (h: { enabled?: boolean; status: string }) => `${h.enabled}/${h.status}`;

    expect(new Set([signature(off), signature(on), signature(throttled)]).size).toBe(3);
  });
});

describe('D3 — the enablement rule itself is unchanged and still fails closed', () => {
  it('only the exact trimmed, case-folded literal "true" enables the provider', () => {
    expect(isGdeltDocEnabled('true')).toBe(true);
    expect(isGdeltDocEnabled('TRUE')).toBe(true);
    expect(isGdeltDocEnabled('  true  ')).toBe(true);

    for (const value of ['1', 'yes', 'on', 'y', 'enabled', 'TRUE!', 'true false', '', '   ']) {
      expect(isGdeltDocEnabled(value)).toBe(false);
    }

    expect(isGdeltDocEnabled(undefined)).toBe(false);
  });
});

describe('D5 — the switch is documented where a deployer would look', () => {
  const envExample = readFileSync(join(__dirname, '../../../../../.env.example'), 'utf-8');

  it('.env.example declares GDELT_DOC_ENABLED', () => {
    expect(envExample).toMatch(/^GDELT_DOC_ENABLED=/m);
  });

  it('it ships DISABLED, matching the fail-closed default', () => {
    expect(envExample).toMatch(/^GDELT_DOC_ENABLED=false$/m);
  });

  it('the documentation states the exact literal rule, not a vague "set to true"', () => {
    const section = envExample.slice(
      envExample.indexOf('GDELT DOC 2.0 fallback NEWS provider'),
      envExample.indexOf('GDELT_DOC_ENABLED=false'),
    );

    expect(section).toMatch(/exact string "true"/i);
    expect(section).toMatch(/case-insensitive/i);
    // The values a deployer would most plausibly try and be surprised by.
    expect(section).toContain('"1"');
    expect(section).toContain('"yes"');
    expect(section).toMatch(/DISABLED/);
  });

  it('it warns that this is NOT the same provider as the GEO signal one', () => {
    const section = envExample.slice(
      envExample.indexOf('GDELT DOC 2.0 fallback NEWS provider'),
      envExample.indexOf('GDELT_DOC_ENABLED=false'),
    );

    expect(section).toContain('GDELT_ENABLED');
    expect(section).toMatch(/NOT the same provider/i);
  });

  it('it states the consequence of leaving it off, and where to check', () => {
    const section = envExample.slice(
      envExample.indexOf('GDELT DOC 2.0 fallback NEWS provider'),
      envExample.indexOf('GDELT_DOC_ENABLED=false'),
    );

    expect(section).toMatch(/fallback tier is EMPTY/i);
    expect(section).toContain('/news/providers/health');
  });

  it('the pre-existing GEO signal keys are untouched', () => {
    expect(envExample).toMatch(/^GDELT_ENABLED=true$/m);
    expect(envExample).toMatch(/^GDELT_GEO_API_BASE_URL=/m);
    expect(envExample).toMatch(/^GDELT_REQUEST_TIMEOUT_MS=/m);
    expect(envExample).toMatch(/^GDELT_DEFAULT_LIMIT=/m);
  });
});
