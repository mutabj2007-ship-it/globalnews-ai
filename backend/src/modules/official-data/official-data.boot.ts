/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE BOOT GATE — A MISCONFIGURED DEPLOYMENT REFUSES TO START
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── THE DEFECT THIS EXISTS FOR, WHICH IS NOT A PRECAUTION ─────────────────
 *
 * G's refusing default promised: *"with nothing installed the decoder REFUSES every
 * artifact with `NISR_PDF_NO_TEXT_LAYER`. A deployment that forgets to wire an extractor
 * reads no NISR figures; it does not read them badly."*
 *
 * **That promise is true about the figures and false about the recovery.** Traced:
 *
 * ```
 * NISR_PDF_NO_TEXT_LAYER
 *   → NISR_CPI_PLATFORM_REFUSAL_KEY = 'PARSE_FAILED'
 *   → REFUSAL_CLASS_BY_KEY.PARSE_FAILED = 'PERMANENT'
 * ```
 *
 * `PERMANENT` means the condition will not clear. But **"no extractor is installed" is
 * not a property of the artifact — it is a property of this deployment**: the very same
 * bytes decode perfectly where one is wired, which is what the accepted proof
 * demonstrates. So a deployment that forgot the wiring would not merely read no NISR
 * figures; **it would write a PERMANENT "unreadable" verdict against every NISR artifact
 * it saw, and wiring the extractor afterwards would not clear them.**
 *
 * **THE FIX IS NOT TO RECLASSIFY `PARSE_FAILED`.** That would make malformed JSON
 * retryable — a regression in a landed control — and the grading is *correct* for the
 * case that matters: a PDF that genuinely carries no text layer is genuinely permanently
 * unreadable, because OCR is refused. The grading is right for the artifact-caused case
 * and wrong only for the configuration-caused case, **so the two must not reach the same
 * code path.** This gate is how the configuration case is caught before a parse is ever
 * attempted, and it needs no change to the refusal table, no new refusal key and no
 * contract change.
 *
 * ── WHERE IT RUNS ─────────────────────────────────────────────────────────
 *
 * `main.ts`, before the port opens — the precedent `resolveAuthSecretsMode` already sets,
 * and for the reason stated there: a DI validator on `OnApplicationBootstrap` fires AFTER
 * the HTTP server is listening, which is too late to be fail-closed.
 *
 * ── THE THREE LAYERS, OUTERMOST FIRST (B-4.2) ─────────────────────────────
 *
 *   1  BOOT — this file. A misconfigured deployment never serves a request.
 *   2  PARSE — `NISR_CPI_NO_EXTRACTOR_INSTALLED`, landed and unchanged. It stays the
 *      default and the second line of defence, for tests and for any path that bypasses
 *      boot. The two answer different questions: layer 1 stops a misconfigured
 *      DEPLOYMENT, layer 2 stops a misconfigured PROCESS.
 *   3  RUNTIME — the adapter's `null` for a library throw, a cap, or an uncountable row
 *      count. Here `PERMANENT` is correct: that artifact has no usable text layer.
 */

import {
  NISR_CPI_NO_EXTRACTOR_INSTALLED,
  SNAPSHOT_WIRE_BYTE_CAP,
  installNisrCpiTextLayerExtractor,
  installedNisrCpiTextLayerExtractorId,
} from '@globalnews-ai/shared';

import { OFFICIAL_SOURCES } from '../official-sources/official-source-registry';
import {
  SAFE_FETCH_DENIED_HOST_SUFFIXES,
  type SafeFetchPolicy,
} from './official-artifact-safe-fetch';
import {
  NISR_CPI_EXTRACTOR_ID,
  NISR_CPI_EXTRACTOR_VERSION,
  NISR_CPI_PRODUCTION_EXTRACTOR,
} from './nisr/nisr-cpi-pdf.extractor';
import { PDF_SYNC_TEXT_VERSION } from './pdf/pdf-sync-text';

export const NISR_PROVIDER_ID = 'rw-nisr';

export class OfficialDataBootRefusal extends Error {
  constructor(readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'OfficialDataBootRefusal';
  }
}

export type NisrDocumentProducerState =
  /** The provider is dormant. No extractor is installed and none is required. */
  | 'DORMANT_NOT_RUNNABLE'
  /** The provider is enabled and the governed extractor is installed and verified. */
  | 'RUNNABLE';

/**
 * The wiring the gate performs, injectable SO THE MUTATIONS CAN BE DRIVEN.
 *
 * B-P6 and B-P7 are mutations — "a missing extractor" and "the installed extractor is
 * not the declared one" — and a gate whose only path installs the right extractor on
 * the way past cannot be driven into either state. Passing these in is what makes the
 * refusals testable rather than asserted. Production uses the defaults and calls this
 * with no second argument, so there is exactly one install site.
 */
export interface NisrExtractorWiring {
  readonly install: (extractor: typeof NISR_CPI_PRODUCTION_EXTRACTOR | null) => void;
  readonly installedId: () => string;
}

const PRODUCTION_WIRING: NisrExtractorWiring = Object.freeze({
  install: installNisrCpiTextLayerExtractor,
  installedId: installedNisrCpiTextLayerExtractorId,
});

/**
 * THE GATE. Returns the state it established, or throws and the deployment does not start.
 *
 * **Wiring an extractor is not activating a provider**, and the coupling here is what
 * keeps that true: the extractor is installed **if and only if** the registry says the
 * provider is enabled. In the canonical tree `rw-nisr` is `enabled: false`, so nothing is
 * installed, `nisr-dormancy.spec.ts` keeps asserting the refusing default, and this
 * function returns `DORMANT_NOT_RUNNABLE` without touching anything.
 */
export function assertNisrDocumentProducerIsRunnable(
  sources: readonly { id: string; enabled: boolean; ingestionMethod: string }[] = OFFICIAL_SOURCES,
  wiring: NisrExtractorWiring = PRODUCTION_WIRING,
): NisrDocumentProducerState {
  const entry = sources.find((s) => s.id === NISR_PROVIDER_ID);

  /* Not registered, or registered and dormant: there is no producer to make runnable, so
     there is nothing to refuse. The extractor stays uninstalled — the refusing default is
     the correct state for a deployment that will never fetch. */
  if (entry === undefined || !entry.enabled) return 'DORMANT_NOT_RUNNABLE';

  /*
    THE PROVIDER IS ENABLED. From here every failure is a REFUSAL TO BOOT, because the
    alternative is a running deployment writing permanent verdicts it cannot retract.
  */
  wiring.install(NISR_CPI_PRODUCTION_EXTRACTOR);

  const installed = wiring.installedId();

  /* B-4.2 layer 1 — the fact this gate exists for, named in full. */
  if (installed === NISR_CPI_NO_EXTRACTOR_INSTALLED.extractorId) {
    throw new OfficialDataBootRefusal(
      'NISR_ENABLED_WITHOUT_EXTRACTOR',
      `the official-source registry has '${NISR_PROVIDER_ID}' ENABLED and no PDF text-layer ` +
        'extractor is installed. Starting would write a PERMANENT PARSE_FAILED verdict ' +
        'against every NISR artifact fetched, and installing the extractor afterwards would ' +
        'not clear them — a deployment fault recorded as an artifact fault. Refusing to ' +
        'start instead.',
    );
  }

  /* B-3.2, third row — the installed extractor is the one this deployment DECLARES.
     Necessary and, on its own, insufficient: it makes an unannounced swap fail NOW, while
     the persisted `extractorId` is what makes a row resolvable to its extractor LATER. */
  if (installed !== NISR_CPI_EXTRACTOR_ID) {
    throw new OfficialDataBootRefusal(
      'NISR_EXTRACTOR_IS_NOT_THE_DECLARED_ONE',
      `installed '${installed}' but this deployment declares '${NISR_CPI_EXTRACTOR_ID}'. An ` +
        'extractor that is not the declared one produces rows attributing one extraction to ' +
        "another's identity.",
    );
  }

  /*
    B-2.2's INTENT, applied where its premise holds.

    The ruling asks the boot gate to assert a declared constant against "the resolved
    installed version of the pinned package", so that a dependency bump without a constant
    bump fails the deployment rather than mis-attributing rows. There is no package here —
    the extraction is in-repo, for the reasons recorded in `pdf-sync-text.ts` — so the
    equivalent assertion is that the extractor's declared version IS the extraction
    module's own version rather than a second constant beside it.

    This can only fail if someone reintroduces a hand-typed version, which is precisely
    the staleness the ruling was guarding against. The complementary check — that the
    extraction CODE has not changed without that version moving — is a content hash, and
    it lives in CI where source is available rather than at boot where it is not.
  */
  if (NISR_CPI_EXTRACTOR_VERSION !== PDF_SYNC_TEXT_VERSION) {
    throw new OfficialDataBootRefusal(
      'NISR_EXTRACTOR_VERSION_DRIFT',
      `the extractor declares version '${NISR_CPI_EXTRACTOR_VERSION}' and the extraction ` +
        `module is '${PDF_SYNC_TEXT_VERSION}'. A version that does not describe the code ` +
        'that produced a text layer is worse than no version, because it is believed.',
    );
  }

  return 'RUNNABLE';
}

/**
 * The governed safe-fetch policy.
 *
 * `wireByteCap` IS `SNAPSHOT_WIRE_BYTE_CAP`, imported — the field's own docblock requires
 * it, because *"two caps that agree today are two caps that will disagree the day one of
 * them moves"*. `deniedHostSuffixes` IS `SAFE_FETCH_DENIED_HOST_SUFFIXES` as exported,
 * not a copy and not an extension.
 *
 * `ownOrigins` is the ONE field the composition root supplies from its own knowledge —
 * **a fetch into our own API from inside the boundary is SSRF**, and only the deployment
 * knows what its own origins are.
 */
export function buildSafeFetchPolicy(ownOrigins: readonly string[]): SafeFetchPolicy {
  /*
    AN EMPTY `ownOrigins` IS REFUSED AT BOOT, AND IT IS THE R-B TRAP AGAIN: an empty list
    satisfies "is not one of our own origins" for every host in the world, so the check
    would pass hardest exactly when it knows least.
  */
  if (ownOrigins.length === 0) {
    throw new OfficialDataBootRefusal(
      'SAFE_FETCH_OWN_ORIGINS_EMPTY',
      'ownOrigins is empty, which satisfies "is not one of our own origins" for every host ' +
        'in the world. The deployment must state its own origins or it cannot fetch.',
    );
  }

  return Object.freeze({
    wireByteCap: SNAPSHOT_WIRE_BYTE_CAP,
    maxRedirectHops: 3,
    totalDeadlineMs: 60_000,
    perHopDeadlineMs: 30_000,
    admittedScheme: 'https:' as const,
    deniedHostSuffixes: SAFE_FETCH_DENIED_HOST_SUFFIXES,
    ownOrigins,
  });
}

/** The registry's own host for a provider. ONE instance is shared with the transport. */
export function officialSourceHostResolver(
  sources: readonly { id: string; baseUrl: string }[] = OFFICIAL_SOURCES,
): (providerId: string) => string | undefined {
  return (providerId: string): string | undefined => {
    const entry = sources.find((s) => s.id === providerId);
    if (entry === undefined) return undefined;
    try {
      return new URL(entry.baseUrl).hostname;
    } catch {
      return undefined;
    }
  };
}
