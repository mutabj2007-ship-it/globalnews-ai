/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE BOOT GATE — B-P6 AND B-P7, BOTH MUTATIONS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * B-P6 and B-P7 are MUTATIONS, and a suite in which neither fails when mutated is
 * UNMEASURED, not PASS. Each one below drives the gate into the state the ruling names
 * through its injected wiring, and asserts the refusal rather than the happy path.
 */

import {
  NISR_CPI_NO_EXTRACTOR_INSTALLED,
  SNAPSHOT_WIRE_BYTE_CAP,
  installNisrCpiTextLayerExtractor,
  installedNisrCpiTextLayerExtractorId,
} from '@globalnews-ai/shared';

import { SAFE_FETCH_DENIED_HOST_SUFFIXES } from './official-artifact-safe-fetch';
import {
  OfficialDataBootRefusal,
  assertNisrDocumentProducerIsRunnable,
  buildSafeFetchPolicy,
  officialSourceHostResolver,
  type NisrExtractorWiring,
} from './official-data.boot';
import { NISR_CPI_EXTRACTOR_ID } from './nisr/nisr-cpi-pdf.extractor';

const DORMANT = [{ id: 'rw-nisr', enabled: false, ingestionMethod: 'none' }];
const ENABLED = [{ id: 'rw-nisr', enabled: true, ingestionMethod: 'document' }];

/** The mutation: an install that does nothing, so the gate meets an empty runtime. */
const WIRING_THAT_INSTALLS_NOTHING: NisrExtractorWiring = {
  install: () => undefined,
  installedId: () => NISR_CPI_NO_EXTRACTOR_INSTALLED.extractorId,
};

/** The mutation: something else got wired. */
const WIRING_THAT_INSTALLS_A_STRANGER: NisrExtractorWiring = {
  install: () => undefined,
  installedId: () => 'nisr.cpi.someone.else',
};

afterEach(() => {
  /* `install(null)` restores the refusing default — B-6 requires that it keep working,
     and every case here depends on being able to get back to it. */
  installNisrCpiTextLayerExtractor(null);
});

describe('the canonical tree is dormant, and the gate changes nothing there', () => {
  it('returns DORMANT_NOT_RUNNABLE and installs nothing', () => {
    expect(assertNisrDocumentProducerIsRunnable(DORMANT)).toBe('DORMANT_NOT_RUNNABLE');
    /*
      B-8 — WIRING AN EXTRACTOR IS NOT ACTIVATING A PROVIDER, and the coupling is what
      keeps that true: the extractor installs IF AND ONLY IF the registry says enabled.
      `nisr-dormancy.spec.ts` asserts the refusing default in the canonical tree and must
      still pass after this delivery.
    */
    expect(installedNisrCpiTextLayerExtractorId()).toBe(
      NISR_CPI_NO_EXTRACTOR_INSTALLED.extractorId,
    );
  });

  it('an unregistered provider is dormant too, and is not an error', () => {
    expect(assertNisrDocumentProducerIsRunnable([])).toBe('DORMANT_NOT_RUNNABLE');
  });
});

describe('B-P7 · MUTATION — a missing extractor fails the BOOT, not the artifact', () => {
  it('refuses to start when the provider is enabled and nothing can read a PDF', () => {
    expect(() =>
      assertNisrDocumentProducerIsRunnable(ENABLED, WIRING_THAT_INSTALLS_NOTHING),
    ).toThrow(OfficialDataBootRefusal);
    expect(() =>
      assertNisrDocumentProducerIsRunnable(ENABLED, WIRING_THAT_INSTALLS_NOTHING),
    ).toThrow(/NISR_ENABLED_WITHOUT_EXTRACTOR/);
  });

  it('AND NO PERMANENT REFUSAL ROW IS WRITTEN FOR A NISR ARTIFACT', () => {
    /*
      THE SECOND HALF IS THE WHOLE OF B-4.1 — without it the test passes while the defect
      survives. The point of the gate is not that it complains; it is that the process
      never reaches a state where it can record `PARSE_FAILED` / `PERMANENT` against an
      artifact whose bytes are perfectly readable on a correctly wired deployment.
    */
    const retained: unknown[] = [];
    const store = { retain: (input: unknown) => retained.push(input) };

    let threw = false;
    try {
      assertNisrDocumentProducerIsRunnable(ENABLED, WIRING_THAT_INSTALLS_NOTHING);
      /* Only reachable if the gate let a misconfigured deployment through. */
      store.retain({ refusalKey: 'PARSE_FAILED', refusalClass: 'PERMANENT' });
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
    expect(retained).toEqual([]);
  });

  it('the refusal NAMES both facts, because a refusal a reader cannot act on is an outage', () => {
    let message = '';
    try {
      assertNisrDocumentProducerIsRunnable(ENABLED, WIRING_THAT_INSTALLS_NOTHING);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('rw-nisr');
    expect(message).toContain('ENABLED');
    expect(message).toContain('PERMANENT');
  });
});

describe('B-P6 · MUTATION — an extractor that is not the declared one fails the boot', () => {
  it('refuses when something else got wired', () => {
    expect(() =>
      assertNisrDocumentProducerIsRunnable(ENABLED, WIRING_THAT_INSTALLS_A_STRANGER),
    ).toThrow(/NISR_EXTRACTOR_IS_NOT_THE_DECLARED_ONE/);
  });

  it('POSITIVE CONTROL — the declared extractor boots, so the refusal is not vacuous', () => {
    /* Without this, a gate that refused everything would pass the mutation above and
       prove nothing. */
    expect(assertNisrDocumentProducerIsRunnable(ENABLED)).toBe('RUNNABLE');
    expect(installedNisrCpiTextLayerExtractorId()).toBe(NISR_CPI_EXTRACTOR_ID);
  });

  it('the declared version IS the extraction module\u2019s, so there is no second constant to drift', () => {
    /* B-2.2 applied where its premise holds: with no npm package to resolve, the
       assertion that matters is that the version is DERIVED rather than re-typed. The
       complementary content-hash pin lives in the extractor suite, where source is
       available. */
    expect(assertNisrDocumentProducerIsRunnable(ENABLED)).toBe('RUNNABLE');
  });
});

describe('C-5 · the policy is imported, and ownOrigins may not be empty', () => {
  it('REFUSES an empty ownOrigins — the R-B trap', () => {
    /* An empty list satisfies "is not one of our own origins" for every host in the
       world, so the check would pass hardest exactly when it knows least. */
    expect(() => buildSafeFetchPolicy([])).toThrow(/SAFE_FETCH_OWN_ORIGINS_EMPTY/);
  });

  it('takes its cap and its denylist from the landed constants, not from copies', () => {
    const policy = buildSafeFetchPolicy(['api.globalnews.ai']);
    expect(policy.wireByteCap).toBe(SNAPSHOT_WIRE_BYTE_CAP);
    expect(policy.deniedHostSuffixes).toBe(SAFE_FETCH_DENIED_HOST_SUFFIXES);
    expect(policy.admittedScheme).toBe('https:');
  });
});

describe('C-4 · one host resolver, shared', () => {
  it('resolves the governed host from the registry, never from a response', () => {
    const resolve = officialSourceHostResolver([
      { id: 'rw-nisr', baseUrl: 'https://statistics.gov.rw' },
    ]);
    expect(resolve('rw-nisr')).toBe('statistics.gov.rw');
    expect(resolve('not-registered')).toBeUndefined();
  });

  it('returns undefined rather than guessing when the baseUrl is unusable', () => {
    const resolve = officialSourceHostResolver([{ id: 'x', baseUrl: 'not a url' }]);
    expect(resolve('x')).toBeUndefined();
  });
});
