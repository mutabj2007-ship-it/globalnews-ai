import { POLITICS_ES_CONTRACT_VERSION, type PoliticsEsReadModelV1 } from '@globalnews-ai/shared';

/**
 * MASTER CTO R66 · #90 — the frontend side of the Politics read adapter (`politics-early-signal-adapter/v1`,
 * backend `politics-early-signal.read-adapter.ts` at Politics d071d96, unchanged since e9b77ce). The adapter's PUBLIC result is
 * mirrored here exactly; there is no HTTP route, so nothing is fetched.
 *
 * THE PUBLIC STATE IS A CODE LITERAL: `DISABLED / RELEASE_GATES_NOT_MET`, the same literal the backend
 * adapter returns today. It changes only by a reviewed code change after E1 per-use clearance, EA's
 * verdict, Main's full-suite qualification and CTO/PO release approval. No environment variable, cookie,
 * query or request input can turn it on.
 */
export type PoliticsEsPublicRead =
  | { readonly contractVersion: typeof POLITICS_ES_CONTRACT_VERSION; readonly status: 'DISABLED'; readonly reason: 'RELEASE_GATES_NOT_MET' }
  | { readonly contractVersion: typeof POLITICS_ES_CONTRACT_VERSION; readonly status: 'REFUSED'; readonly reason: 'SYNTHETIC_DATA_NEVER_PUBLIC' }
  | { readonly contractVersion: typeof POLITICS_ES_CONTRACT_VERSION; readonly status: 'OK'; readonly model: PoliticsEsReadModelV1 };

export const POLITICS_EARLY_SIGNAL_PUBLIC_READ: PoliticsEsPublicRead = Object.freeze({
  contractVersion: POLITICS_ES_CONTRACT_VERSION,
  status: 'DISABLED',
  reason: 'RELEASE_GATES_NOT_MET',
});

/**
 * A synthetic read model is never public: a model whose data origin is SYNTHETIC_FIXTURE is refused here
 * too, whatever handed it over (defence in depth; the backend adapter refuses it first).
 */
export function publicReadOf(model: PoliticsEsReadModelV1): PoliticsEsPublicRead {
  if (model.contractVersion !== POLITICS_ES_CONTRACT_VERSION || model.dataOrigin === 'SYNTHETIC_FIXTURE') {
    return { contractVersion: POLITICS_ES_CONTRACT_VERSION, status: 'REFUSED', reason: 'SYNTHETIC_DATA_NEVER_PUBLIC' };
  }
  return { contractVersion: POLITICS_ES_CONTRACT_VERSION, status: 'OK', model };
}

/** A UTC time as the reader reads it; an unparseable value is never rendered as a time. */
export function esTime(iso: string | null | undefined, locale: string): string | null {
  if (iso == null || Number.isNaN(Date.parse(iso))) return null;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(iso));
}
