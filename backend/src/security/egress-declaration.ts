import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · §11 — THE DECLARED EGRESS MODE, AS A VALUE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Authority: F `04-EGRESS-DECLARATION` (revision R1-E1) · R1.1 SQ-6 · E1 M-5.
 *
 * DIRECT — ADDRESS BOUND. The one outbound connector this codebase has
 * (`modules/official-data/safe-wire-fetch.node.ts`) resolves A AND AAAA itself, classifies EVERY
 * returned address, dials the VALIDATED IP (never the hostname — no second, unclassified
 * resolution), presents the governed hostname for SNI and certificate verification, sends the
 * governed `Host`, keeps `rejectUnauthorized: true` with no option that could disable it, and
 * caches nothing. That is the mode under which the DNS/IP-rebinding defence actually holds.
 *
 * EG-0 · `TRUST_PROXY` is INGRESS (how Express attributes a client IP behind Railway's reverse
 * proxy). It is never evidence about outbound proxying, in either direction.
 *
 * EG-3 · E1 M-5 asked for a FIELD, not a comment — this is it: readable at runtime (F 07 T-23),
 * announced at boot, and the address-bound claim is DERIVED from the mode, so a proxy mode can
 * never claim the defence it hands to a proxy's allowlist (F 07 T-24). There is no proxy code
 * path to select: switching to `CONNECT_PROXY` is a change of security model and needs a new E1
 * round (F 04 §7), not a configuration edit — which is why the mode is a constant, not a knob.
 *
 * EG-9/EG-11 · Source proves the APPLICATION dials directly; only a runtime measurement proves the
 * NETWORK permits it. That bounded probe is a precondition of wiring the connector on a
 * deployment and is recorded as not yet run.
 */
export type EgressMode = 'DIRECT_ADDRESS_BOUND' | 'CONNECT_PROXY';

export const DECLARED_EGRESS_MODE: EgressMode = 'DIRECT_ADDRESS_BOUND';

export interface EgressDeclaration {
  readonly mode: EgressMode;
  /** EG-4…EG-7 hold only when the client itself dials the classified address. */
  readonly addressBoundRebindingDefence: boolean;
  /** EG-9 — measured on the deployment, never inferred from source. */
  readonly runtimeNetworkProbe: 'NOT_RUN' | 'PASSED' | 'FAILED';
  readonly userSuppliedUrlFetching: false;
}

export function egressDeclaration(
  mode: EgressMode = DECLARED_EGRESS_MODE,
  runtimeNetworkProbe: EgressDeclaration['runtimeNetworkProbe'] = 'NOT_RUN',
): EgressDeclaration {
  return {
    mode,
    addressBoundRebindingDefence: mode === 'DIRECT_ADDRESS_BOUND',
    runtimeNetworkProbe,
    userSuppliedUrlFetching: false,
  };
}

/** KS-8 / T-23 pattern: the resolved declaration is announced at boot like the landed validators. */
@Injectable()
export class EgressDeclarationReporter implements OnApplicationBootstrap {
  private readonly logger = new Logger('EgressDeclaration');

  onApplicationBootstrap(): void {
    const d = egressDeclaration();
    this.logger.log(
      `egressMode=${d.mode} addressBoundRebindingDefence=${d.addressBoundRebindingDefence} ` +
        `runtimeNetworkProbe=${d.runtimeNetworkProbe} userSuppliedUrlFetching=${d.userSuppliedUrlFetching}`,
    );
  }
}
