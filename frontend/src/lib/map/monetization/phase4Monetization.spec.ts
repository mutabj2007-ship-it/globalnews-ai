import { readFileSync } from 'fs';
import { join } from 'path';

import { entitlementConfig, hasEntitlementConfig } from './entitlement';
import { WATCH_RUNTIME_ACTIVE } from './watchRuntimeGate';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PHASE 4 — MONETIZATION, INSPECTED AND GUARDED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The inspection found NO DEFECT. This suite exists anyway, because the two
 * properties that make the layer safe are exactly the two an ordinary,
 * well-meant change would erode:
 *
 *   1. `entitlementConfig()` returning `null` rather than a default. The first
 *      "sensible default" added here is the moment the product starts asserting
 *      commercial facts nobody approved.
 *
 *   2. `WATCH_RUNTIME_ACTIVE` staying a SOURCE CONSTANT. Making it an
 *      environment variable would hand an operator the ability to produce fake
 *      activation over a runtime that does not exist — the specific thing the
 *      PO ruling forbids.
 *
 * NOTHING HERE PROPOSES A PRICE, A TIER OR A POLICY. Asserting that no currency
 * appears is not a commercial decision; it is the absence of one.
 */

const src = (...parts: string[]): string =>
  readFileSync(join(__dirname, '..', '..', '..', ...parts), 'utf-8');

const stripComments = (value: string): string =>
  value
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const monetizationSurface = (name: string): string =>
  stripComments(src('components', 'map', 'shell', 'monetization', name));

describe('PHASE 4 — the product cannot state a figure it was not given', () => {
  describe('ENTITLEMENT IS ABSENT UNTIL CONFIGURED', () => {
    const original = process.env.NEXT_PUBLIC_GN_ENTITLEMENT;

    afterEach(() => {
      if (original === undefined) delete process.env.NEXT_PUBLIC_GN_ENTITLEMENT;
      else process.env.NEXT_PUBLIC_GN_ENTITLEMENT = original;
    });

    it('with nothing configured it returns null, not a default', () => {
      delete process.env.NEXT_PUBLIC_GN_ENTITLEMENT;

      expect(entitlementConfig()).toBeNull();
      expect(hasEntitlementConfig()).toBe(false);
    });

    it('null is NOT an object of zeros', () => {
      /*
        Zero watches and "no watches configured" are different claims. A surface
        must be able to tell them apart to say anything true, and an object of
        zeros would take that ability away.
      */
      delete process.env.NEXT_PUBLIC_GN_ENTITLEMENT;

      expect(entitlementConfig()).not.toEqual(
        expect.objectContaining({ watches: 0 }),
      );
    });

    it('a malformed value yields null rather than a partial invention', () => {
      process.env.NEXT_PUBLIC_GN_ENTITLEMENT = '{ not json';

      expect(entitlementConfig()).toBeNull();
    });

    it('EVERY FIELD OR NONE — a half-configured entitlement is refused', () => {
      /*
        Otherwise one surface could state a cadence while another could not
        state a limit, and a reader would have no way to tell which numbers
        were real.
      */
      process.env.NEXT_PUBLIC_GN_ENTITLEMENT = JSON.stringify({
        watches: 5,
        chainLinks: 3,
        /* historyDays deliberately missing */
        cadenceLabel: 'daily',
        actionsUsed: 1,
        actionsTotal: 10,
        resetsLabel: 'monthly',
      });

      expect(entitlementConfig()).toBeNull();
    });

    it('and a complete one is accepted verbatim, with nothing added', () => {
      const complete = {
        watches: 5,
        chainLinks: 3,
        historyDays: 30,
        cadenceLabel: 'daily',
        actionsUsed: 1,
        actionsTotal: 10,
        resetsLabel: 'monthly',
      };
      process.env.NEXT_PUBLIC_GN_ENTITLEMENT = JSON.stringify(complete);

      expect(entitlementConfig()).toEqual(complete);
    });

    it('the module declares no default anywhere', () => {
      /*
        B5.1 — RENAMED FROM `module`, and that is not a style preference.

        `@next/next/no-assign-module-variable` is an ERROR, not a warning, so
        binding the name `module` failed `next lint` and therefore `next build`.
        The assertion never needed the name; only the build did.
      */
      const entitlementSource = stripComments(
        src('lib', 'map', 'monetization', 'entitlement.ts'),
      );

      expect(entitlementSource).not.toMatch(/\?\?\s*\{/);
      expect(entitlementSource).not.toMatch(/DEFAULT_ENTITLEMENT/);
    });
  });

  describe('THE WATCH GATE IS A SOURCE CONSTANT, NOT AN OPERATOR SWITCH', () => {
    const gate = src('lib', 'map', 'monetization', 'watchRuntimeGate.ts');

    it('it is off', () => {
      expect(WATCH_RUNTIME_ACTIVE).toBe(false);
    });

    it('and it is not read from the environment', () => {
      /*
        An environment variable would imply an operator may turn Watch on, and
        turning it on without a backend produces exactly the fake activation the
        ruling forbids.
      */
      expect(stripComments(gate)).not.toContain('process.env');
    });

    it('it hides surfaces rather than deleting them', () => {
      /* When the runtime lands, the surfaces return exactly as they were. */
      expect(gate).toMatch(/HIDES, AND DELETES NOTHING/);
    });

    it('and Follow is explicitly not folded into it', () => {
      /* Follow is real, persistent and authenticated. It is not Watch. */
      expect(gate).toMatch(/FOLLOW IS NOT AFFECTED AND MUST NEVER BE FOLDED INTO THIS/);
    });
  });

  describe('NO SURFACE STATES A PRICE', () => {
    const SURFACES = [
      'AnalysisCostPrompt.tsx',
      'ActivationPanel.tsx',
      'WatchCta.tsx',
      'WatchComposer.tsx',
      'Watchboard.tsx',
      'ActionDeck.tsx',
    ];

    it('no currency symbol or amount appears in any of them', () => {
      for (const name of SURFACES) {
        const surface = monetizationSurface(name);

        expect(surface).not.toMatch(/[$£€]\s?\d/);
        expect(surface).not.toMatch(/\bUSD\b|\bEUR\b|\bPLN\b/);
      }
    });

    it('and none of them names a payment provider or a purchase path', () => {
      for (const name of SURFACES) {
        const surface = monetizationSurface(name).toLowerCase();

        for (const term of ['stripe', 'checkout', 'billing', 'paywall', 'subscribe']) {
          expect(surface).not.toContain(term);
        }
      }
    });

    it('the cost prompt states cost in ACTIONS, which is a quota and not a price', () => {
      const prompt = monetizationSurface('AnalysisCostPrompt.tsx');

      expect(prompt).toContain('labels.costUnitOne');
      expect(prompt).toContain('labels.costUnitMany');
    });

    it('and TIER_RESTRICTED names no price', () => {
      /*
        The likeliest drift in the whole layer: an honest unavailability reason
        quietly becoming an upsell. E-1 introduced this label; this keeps it
        honest.
      */
      const en = src('lib', 'i18n', 'dictionaries', 'en.ts');
      const match = en.match(/TIER_RESTRICTED: '([^']+)'/);

      expect(match?.[1]).toBe('Not included in your access');
      expect(match?.[1]).not.toMatch(/\d/);
    });
  });
});
