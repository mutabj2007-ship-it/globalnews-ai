import type { GuestPrivacyStatus } from '@/lib/api/guestPrivacyApi';
import {
  GUEST_POLICY_BOUNDS,
  consentStrings,
  fillConsent,
  type ConsentLocale,
} from '@/lib/consent/consentStrings';

/**
 * STAGE 2 · T5 PART B — the guest quota badge ("N of 3 guest answers left").
 *
 * Presentational and network-free: it renders ONLY what `GET /ask-v2/guest/status` said
 * (`remaining`, `allowance`, `state`, `cooldownUntil`) and keeps no counter of its own. It renders
 * nothing for a signed-in reader, when the trial is unavailable, or before a guest session exists
 * (the full allowance is stated by the notice, not by a badge). Built to be imported by the Ask
 * composer later (protected-file patch P-1); mounted today inside `GuestDataSection`.
 */
export function guestQuotaText(
  status: GuestPrivacyStatus | null | undefined,
  locale: ConsentLocale,
  formatDate: (iso: string) => string = (iso) => iso,
): string | null {
  if (!status || status.signedIn || !status.session) return null;
  if (typeof status.remaining !== 'number') return null;
  const t = consentStrings(locale).quota;
  const allowance = status.allowance ?? status.policy?.allowance ?? GUEST_POLICY_BOUNDS.allowance;
  if (status.state === 'COOLDOWN' && status.cooldownUntil) {
    return fillConsent(t.cooldown, { cooldownUntil: formatDate(status.cooldownUntil) });
  }
  if (status.remaining <= 0 || status.state === 'EXHAUSTED') {
    return fillConsent(t.exhausted, { allowance });
  }
  return fillConsent(t.remaining, { remaining: status.remaining, allowance });
}

export function GuestQuotaBadge({
  status,
  locale,
  formatDate,
}: {
  readonly status: GuestPrivacyStatus | null | undefined;
  readonly locale: ConsentLocale;
  readonly formatDate?: (iso: string) => string;
}): JSX.Element | null {
  const text = guestQuotaText(status, locale, formatDate);
  if (text === null) return null;
  return (
    <span
      data-consent="guest-quota"
      data-state={status?.state ?? 'OPEN'}
      className="inline-flex items-center rounded-[8px] border border-white/10 px-2 py-0.5 font-mono text-xs text-ink-secondary"
    >
      {text}
    </span>
  );
}
