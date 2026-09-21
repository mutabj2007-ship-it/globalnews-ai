import {
  BETA_FEATURE_FLAG_ENV_KEYS,
  isAskConversationalV2Enabled,
  isAskPersistenceEnabled,
  isBetaSimpleHomeEnabled,
  isComputeClassificationEnabled,
  isMeteredComputeEnabled,
  isSandChargingEnabled,
  isSandLedgerEnabled,
  resolveBetaFeatureFlags,
  type BetaFeatureFlagEnv,
} from './feature-flags';

/** Everything on, as raw env strings — the only configuration in which every gate opens. */
const ALL_ON: BetaFeatureFlagEnv = {
  betaSimpleHome: 'true',
  askConversationalV2: 'true',
  askPersistence: 'true',
  computeClassification: 'true',
  meteredCompute: 'true',
  sandLedger: 'true',
  sandCharging: 'true',
};

describe('BETA-SIMPLE-ASK-SAND-1 §10 feature flags', () => {
  describe('the strict repository truthiness rule', () => {
    const simplePredicates = [
      ['isBetaSimpleHomeEnabled', isBetaSimpleHomeEnabled],
      ['isAskConversationalV2Enabled', isAskConversationalV2Enabled],
      ['isComputeClassificationEnabled', isComputeClassificationEnabled],
    ] as const;

    it.each(simplePredicates)('%s is true for exactly the string "true"', (_name, predicate) => {
      expect(predicate('true')).toBe(true);
    });

    it.each(simplePredicates)('%s is false for every near-miss value', (_name, predicate) => {
      for (const raw of [
        undefined,
        '',
        '   ',
        'TRUE',
        'True',
        '1',
        'yes',
        'on',
        'false',
        'TRUE ',
      ]) {
        expect(predicate(raw)).toBe(false);
      }
    });
  });

  describe('§10 dependency gates', () => {
    it('ASK_PERSISTENCE cannot be on while ASK_CONVERSATIONAL_V2 is off', () => {
      expect(isAskPersistenceEnabled('true', 'false')).toBe(false);
      expect(isAskPersistenceEnabled('true', undefined)).toBe(false);
      expect(isAskPersistenceEnabled('true', 'true')).toBe(true);
    });

    it('METERED_COMPUTE cannot be on while COMPUTE_CLASSIFICATION is off', () => {
      expect(isMeteredComputeEnabled('true', 'false')).toBe(false);
      expect(isMeteredComputeEnabled('true', undefined)).toBe(false);
      expect(isMeteredComputeEnabled('true', 'true')).toBe(true);
    });

    it('SAND_LEDGER requires the whole classification -> metering chain', () => {
      expect(isSandLedgerEnabled('true', 'true', 'false')).toBe(false);
      expect(isSandLedgerEnabled('true', 'false', 'true')).toBe(false);
      expect(isSandLedgerEnabled('true', 'true', 'true')).toBe(true);
    });
  });

  describe('§10 critical default — SAND_CHARGING is OFF', () => {
    it('is off when nothing at all is configured', () => {
      expect(resolveBetaFeatureFlags({}).sandCharging).toBe(false);
    });

    it('is off when every other flag in the chain is on but charging is unset', () => {
      const flags = resolveBetaFeatureFlags({ ...ALL_ON, sandCharging: undefined });
      expect(flags.sandLedger).toBe(true);
      expect(flags.sandCharging).toBe(false);
    });

    it.each([
      ['SAND_LEDGER', { sandLedger: 'false' }],
      ['METERED_COMPUTE', { meteredCompute: 'false' }],
      ['COMPUTE_CLASSIFICATION', { computeClassification: 'false' }],
    ])(
      'stays off even when explicitly set to true, if %s is off',
      (_broken, override: Partial<BetaFeatureFlagEnv>) => {
        const flags = resolveBetaFeatureFlags({ ...ALL_ON, ...override });
        expect(flags.sandCharging).toBe(false);
      },
    );

    it('turns on only when explicitly set AND the entire chain is deliberately on', () => {
      expect(resolveBetaFeatureFlags(ALL_ON).sandCharging).toBe(true);
    });

    it('the direct predicate agrees with the resolver on the broken-chain case', () => {
      expect(isSandChargingEnabled('true', 'true', 'true', 'false')).toBe(false);
      expect(isSandChargingEnabled('true', 'true', 'true', 'true')).toBe(true);
    });
  });

  describe('resolveBetaFeatureFlags', () => {
    it('resolves every flag to false for a completely unconfigured deployment', () => {
      expect(resolveBetaFeatureFlags({})).toEqual({
        betaSimpleHome: false,
        askConversationalV2: false,
        askPersistence: false,
        computeClassification: false,
        meteredCompute: false,
        sandLedger: false,
        sandCharging: false,
      });
    });

    it('resolves every flag to true only for a fully, deliberately enabled deployment', () => {
      expect(resolveBetaFeatureFlags(ALL_ON)).toEqual({
        betaSimpleHome: true,
        askConversationalV2: true,
        askPersistence: true,
        computeClassification: true,
        meteredCompute: true,
        sandLedger: true,
        sandCharging: true,
      });
    });
  });

  describe('env key names', () => {
    it('follows the repository SCREAMING_SNAKE_CASE convention, with NEXT_PUBLIC_ only for the frontend flag', () => {
      for (const [name, key] of Object.entries(BETA_FEATURE_FLAG_ENV_KEYS)) {
        expect(key).toMatch(/^[A-Z0-9_]+$/);
        if (name === 'betaSimpleHome') {
          expect(key.startsWith('NEXT_PUBLIC_')).toBe(true);
        } else {
          expect(key.startsWith('NEXT_PUBLIC_')).toBe(false);
        }
      }
    });

    it('covers exactly the seven flags §10 names', () => {
      expect(Object.keys(BETA_FEATURE_FLAG_ENV_KEYS).sort()).toEqual(
        Object.keys(resolveBetaFeatureFlags({})).sort(),
      );
    });
  });
});
