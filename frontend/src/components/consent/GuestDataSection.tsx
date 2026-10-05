'use client';

import { useEffect, useState } from 'react';
import {
  guestPrivacyApi,
  type GuestPrivacyApi,
  type GuestPrivacyStatus,
} from '@/lib/api/guestPrivacyApi';
import {
  GUEST_POLICY_BOUNDS,
  consentStrings,
  fillConsent,
  type ConsentLocale,
} from '@/lib/consent/consentStrings';
import { GuestForgetControl } from './GuestForgetControl';
import { GuestQuotaBadge } from './GuestQuotaBadge';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * STAGE 2 · T5 PART B — "YOUR GUEST DATA" (Privacy Notice and Cookies page)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The measured guest contract, stated before sign-in (T5 Part A §1.1):
 *   - {allowance} answers; a question we cannot answer does not count;
 *   - the guest cookie and its CSRF companion, set on the first guest question only, lasting at
 *     most {lifetimeDays} days, never extended;
 *   - questions and answers stored on OUR SERVERS until the session ends, then deleted by the
 *     always-on guest clean-up within about {purgeGraceH} hours (not RETENTION_SWEEP_ENABLED);
 *   - "Sign in to continue" moves ALL of this browser's guest conversations; a plain sign-in moves
 *     none and they reappear after sign-out on a shared device;
 *   - "Delete my guest data now" (POST /ask-v2/guest/forget).
 *
 * VALUES. The server render (and any reader whose status read fails) gets the hard code bounds
 * (GUEST_POLICY_BOUNDS, phrased "at most / within"); after ONE `GET /ask-v2/guest/status` (which
 * never mints a session) the configured policy replaces them and the live panel shows this
 * browser's own dates, quota and the delete action. Nothing else is fetched.
 *
 * `locale` is the T2 EFFECTIVE locale of the page (en/pl); in fr/de/es/pt/ar the page renders
 * the declared English fallback because the `consent` namespace has no approved copy there.
 */
type Loaded =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'status'; readonly status: GuestPrivacyStatus };

function formatterFor(locale: ConsentLocale): (iso: string) => string {
  const format = new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  return (iso) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : format.format(date);
  };
}

export function GuestDataSection({
  locale,
  api = guestPrivacyApi,
}: {
  readonly locale: ConsentLocale;
  readonly api?: Pick<GuestPrivacyApi, 'status' | 'forget'>;
}): JSX.Element {
  const t = consentStrings(locale);
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  /* The forget outcome outlives the control, which unmounts once the session is gone. */
  const [forgetMessage, setForgetMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void api.status().then((outcome) => {
      if (!live) return;
      setLoaded(outcome.ok ? { kind: 'status', status: outcome.value } : { kind: 'unavailable' });
    });
    return () => {
      live = false;
    };
    /* One read on mount; the client is stable for the page's lifetime. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = loaded.kind === 'status' ? loaded.status : null;
  const policy = status?.policy;
  const values = {
    allowance: policy?.allowance ?? GUEST_POLICY_BOUNDS.allowance,
    lifetimeDays:
      Math.round(((policy?.sessionLifetimeH ?? GUEST_POLICY_BOUNDS.sessionLifetimeH) / 24) * 10) /
      10,
    purgeGraceH: policy?.purgeGraceH ?? GUEST_POLICY_BOUNDS.purgeGraceH,
  };
  const formatDate = formatterFor(locale);
  const fill = (template: string, extra: Record<string, string | number> = {}) =>
    fillConsent(template, { ...values, ...extra });

  const paragraphs = [
    t.guest.intro,
    t.guest.questions,
    t.guest.cookie,
    t.guest.storage,
    t.guest.claim,
    t.guest.plainSignIn,
    t.guest.deleteNow,
  ];

  let panel: JSX.Element;
  if (loaded.kind === 'loading') {
    panel = <p data-consent="guest-panel-loading">{t.panel.loading}</p>;
  } else if (loaded.kind === 'unavailable' || status === null) {
    panel = <p data-consent="guest-panel-unavailable">{t.panel.unavailable}</p>;
  } else if (status.signedIn) {
    panel = <p data-consent="guest-panel-signed-in">{t.panel.signedIn}</p>;
  } else if (!status.session) {
    panel = (
      <div data-consent="guest-panel-none" className="flex flex-col gap-2">
        {forgetMessage !== null && (
          <p role="status" data-consent="guest-forget-result">
            {forgetMessage}
          </p>
        )}
        <p>{fill(t.panel.none)}</p>
      </div>
    );
  } else {
    const session = status.session;
    panel = (
      <div data-consent="guest-panel-active" className="flex flex-col items-start gap-2">
        <p>
          {fill(t.panel.active, {
            expiresAt: formatDate(session.expiresAt),
            purgeAfter: formatDate(session.purgeAfter ?? session.expiresAt),
          })}
        </p>
        <GuestQuotaBadge status={status} locale={locale} formatDate={formatDate} />
        <GuestForgetControl
          locale={locale}
          api={api}
          onForgotten={(result) => {
            setForgetMessage(result.deleted ? t.forget.done : t.forget.nothing);
            setLoaded({ kind: 'status', status: { ...status, session: null } });
          }}
        />
      </div>
    );
  }

  return (
    <section id="guest-data" data-consent="guest-data" className="mt-10">
      <h2 className="text-lg font-semibold text-ink-primary">{t.guest.heading}</h2>
      <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-ink-secondary">
        {paragraphs.map((p, i) => (
          <p key={i} data-consent-paragraph={i}>
            {fill(p)}
          </p>
        ))}
      </div>
      <div
        data-consent="guest-panel"
        className="mt-4 rounded-[10px] border border-white/10 p-3 text-sm text-ink-secondary"
      >
        {panel}
      </div>
    </section>
  );
}
