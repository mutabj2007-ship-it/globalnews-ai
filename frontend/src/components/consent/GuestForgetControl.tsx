'use client';

import { useState } from 'react';
import {
  guestPrivacyApi,
  type GuestForgetResult,
  type GuestPrivacyApi,
} from '@/lib/api/guestPrivacyApi';
import { consentStrings, type ConsentLocale } from '@/lib/consent/consentStrings';

/**
 * STAGE 2 · T5 PART B — "Delete my guest data now".
 *
 * One explicit action with an inline confirmation step (no modal, no pre-checked box), then
 * `POST /ask-v2/guest/forget`. The server deletes THIS browser's guest session with the same
 * cascade as the guest clean-up and clears both guest cookies; the call is idempotent. Outcomes
 * are stated as the server reported them:
 *   deleted:true   → done      deleted:false → nothing
 *   409 GUEST_ANSWER_IN_PROGRESS → busy (nothing changed)      anything else → failed
 *
 * Reusable by the Ask composer (protected-file patch P-1 imports it); it takes the effective
 * en/pl locale and an injectable client for tests.
 */
type Phase = 'idle' | 'confirm' | 'working' | 'done' | 'nothing' | 'busy' | 'failed';

export function GuestForgetControl({
  locale,
  api = guestPrivacyApi,
  onForgotten,
}: {
  readonly locale: ConsentLocale;
  readonly api?: Pick<GuestPrivacyApi, 'forget'>;
  readonly onForgotten?: (result: GuestForgetResult) => void;
}): JSX.Element {
  const t = consentStrings(locale).forget;
  const [phase, setPhase] = useState<Phase>('idle');

  async function run(): Promise<void> {
    setPhase('working');
    const outcome = await api.forget();
    if (outcome.ok) {
      setPhase(outcome.value.deleted ? 'done' : 'nothing');
      onForgotten?.(outcome.value);
      return;
    }
    setPhase(outcome.code === 'GUEST_ANSWER_IN_PROGRESS' ? 'busy' : 'failed');
  }

  const message =
    phase === 'done'
      ? t.done
      : phase === 'nothing'
        ? t.nothing
        : phase === 'busy'
          ? t.busy
          : phase === 'failed'
            ? t.failed
            : null;

  return (
    <div
      data-consent="guest-forget"
      data-phase={phase}
      className="mt-3 flex flex-col items-start gap-2"
    >
      {phase === 'confirm' ? (
        <>
          <p className="text-sm text-ink-primary">{t.confirm}</p>
          <div className="flex gap-2">
            <button
              type="button"
              data-consent="guest-forget-confirm"
              onClick={() => void run()}
              className="rounded-[10px] border border-white/20 px-3 py-1.5 text-sm text-ink-primary hover:border-signal"
            >
              {t.confirmAction}
            </button>
            <button
              type="button"
              data-consent="guest-forget-cancel"
              onClick={() => setPhase('idle')}
              className="rounded-[10px] px-3 py-1.5 text-sm text-ink-secondary hover:text-ink-primary"
            >
              {t.cancel}
            </button>
          </div>
        </>
      ) : phase === 'done' || phase === 'nothing' ? null : (
        <button
          type="button"
          data-consent="guest-forget-action"
          disabled={phase === 'working'}
          onClick={() => setPhase('confirm')}
          className="rounded-[10px] border border-white/20 px-3 py-1.5 text-sm text-ink-primary hover:border-signal disabled:opacity-50"
        >
          {phase === 'working' ? t.working : t.action}
        </button>
      )}
      {message !== null && (
        <p role="status" data-consent="guest-forget-result" className="text-sm text-ink-secondary">
          {message}
        </p>
      )}
    </div>
  );
}
