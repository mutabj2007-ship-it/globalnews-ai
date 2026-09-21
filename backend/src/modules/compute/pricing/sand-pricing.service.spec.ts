import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { ComputeClass } from '@globalnews-ai/shared';
import { SandPricingService } from './sand-pricing.service';

async function buildService(env: Record<string, string> = {}): Promise<SandPricingService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      SandPricingService,
      { provide: ConfigService, useValue: { get: (key: string) => env[key] } },
    ],
  }).compile();

  return moduleRef.get(SandPricingService);
}

describe('BETA-SIMPLE-ASK-SAND-1 §8 SandPricingService', () => {
  describe('§7 Sand is not a charge for reading', () => {
    it.each<ComputeClass>(['STORED', 'CONTEXTUAL'])('prices %s at zero', async (computeClass) => {
      const service = await buildService();
      expect(service.priceFor(computeClass)).toBe(0);
      expect(service.isStructurallyFree(computeClass)).toBe(true);
    });

    it.each<[ComputeClass, string]>([
      ['STORED', 'SAND_PRICE_STORED'],
      ['CONTEXTUAL', 'SAND_PRICE_CONTEXTUAL'],
    ])('keeps %s free even if an operator sets a stray %s variable', async (computeClass, key) => {
      const service = await buildService({ [key]: '99' });
      expect(service.priceFor(computeClass)).toBe(0);
    });
  });

  describe('§5 an ordinary fresh Ask is governed by quota, not Sand', () => {
    it('prices FRESH_BOUNDED at zero by default', async () => {
      const service = await buildService();
      expect(service.priceFor('FRESH_BOUNDED')).toBe(0);
    });
  });

  describe('§9 design/testing fixtures for the metered classes', () => {
    it('quotes DEEP_ANALYSIS and RESEARCH_REPORT as non-zero integers', async () => {
      const service = await buildService();
      expect(service.priceFor('DEEP_ANALYSIS')).toBe(24);
      expect(service.priceFor('RESEARCH_REPORT')).toBe(120);
    });

    it('prices a report above a deep analysis', async () => {
      const service = await buildService();
      expect(service.priceFor('RESEARCH_REPORT')).toBeGreaterThan(
        service.priceFor('DEEP_ANALYSIS'),
      );
    });
  });

  describe('environment overrides — setting real economics is a config change', () => {
    it('honors a valid integer override', async () => {
      const service = await buildService({ SAND_PRICE_DEEP_ANALYSIS: '40' });
      expect(service.priceFor('DEEP_ANALYSIS')).toBe(40);
    });

    it('accepts zero as a deliberate override', async () => {
      const service = await buildService({ SAND_PRICE_DEEP_ANALYSIS: '0' });
      expect(service.priceFor('DEEP_ANALYSIS')).toBe(0);
    });

    it.each([
      ['a fractional value', '2.5'],
      ['a negative value', '-5'],
      ['a non-numeric value', 'free'],
      ['an empty value', ''],
      ['a whitespace value', '   '],
    ])(
      'falls back to the fixture for %s rather than producing a corrupt amount',
      async (_label, raw) => {
        const service = await buildService({ SAND_PRICE_DEEP_ANALYSIS: raw });
        expect(service.priceFor('DEEP_ANALYSIS')).toBe(24);
      },
    );

    it('never returns NaN for any class under any override', async () => {
      const service = await buildService({
        SAND_PRICE_FRESH_BOUNDED: 'nonsense',
        SAND_PRICE_DEEP_ANALYSIS: 'nonsense',
        SAND_PRICE_RESEARCH_REPORT: 'nonsense',
      });

      for (const computeClass of [
        'STORED',
        'CONTEXTUAL',
        'FRESH_BOUNDED',
        'DEEP_ANALYSIS',
        'RESEARCH_REPORT',
      ] as ComputeClass[]) {
        const price = service.priceFor(computeClass);
        expect(Number.isInteger(price)).toBe(true);
        expect(price).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('labels', () => {
    it('supplies a label for every compute class, so a price is never rendered unlabelled', async () => {
      const service = await buildService();
      for (const computeClass of [
        'STORED',
        'CONTEXTUAL',
        'FRESH_BOUNDED',
        'DEEP_ANALYSIS',
        'RESEARCH_REPORT',
      ] as ComputeClass[]) {
        expect(service.labelFor(computeClass)).toBeTruthy();
      }
    });

    it('labels DEEP_ANALYSIS exactly as §9 shows it in the quote panel', async () => {
      const service = await buildService();
      expect(service.labelFor('DEEP_ANALYSIS')).toBe('Deep Analysis');
    });
  });

  describe('§9 quote lifetime', () => {
    it('defaults to a bounded, positive TTL', async () => {
      const service = await buildService();
      expect(service.quoteTtlSeconds()).toBe(300);
    });

    it.each([['0'], ['-1'], ['abc'], ['']])('ignores the invalid TTL override %s', async (raw) => {
      const service = await buildService({ SAND_QUOTE_TTL_SECONDS: raw });
      expect(service.quoteTtlSeconds()).toBe(300);
    });

    it('honors a valid TTL override', async () => {
      const service = await buildService({ SAND_QUOTE_TTL_SECONDS: '60' });
      expect(service.quoteTtlSeconds()).toBe(60);
    });
  });

  describe('§16 a category view can never be metered', () => {
    it('marks category-view as a never-metered kind', async () => {
      const service = await buildService();
      expect(service.isNeverMeteredKind('category-view')).toBe(true);
    });

    it('does not exempt the kinds that genuinely can be metered', async () => {
      const service = await buildService();
      expect(service.isNeverMeteredKind('ask-turn')).toBe(false);
      expect(service.isNeverMeteredKind('deep-analysis')).toBe(false);
      expect(service.isNeverMeteredKind('research-report')).toBe(false);
    });
  });
});
