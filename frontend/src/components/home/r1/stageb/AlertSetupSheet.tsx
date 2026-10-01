'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { Bell, BellRing, Check, Mail, Smartphone, X } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { accountSignInUrl } from '@/lib/api/accountLinks';
import { createAlert } from '@/lib/stories/stageBApi';
import { closePanel, setAlertFor, type StoryTarget } from '@/lib/stories/stageBStore';
import { saveStoryTask } from '@/lib/stories/storyTask';

/**
 * HOME R1 · STAGE B — ALERT SETUP. Explicit creation only: nothing is created until the reader
 * presses Save alert. Follow ≠ Alert is stated, not implied. Delivery is IN-APP ONLY: push and
 * email are shown as "Not available" with no control — there is no delivery capability, and
 * no consent is collected for one. Signed out, the choice is kept in the same-tab
 * continuation record and the sheet reopens after sign-in (it never saves by itself).
 */
export function AlertSetupSheet({
  story,
  language,
  signedIn,
}: {
  readonly story: StoryTarget;
  readonly language: LanguageCode;
  readonly signedIn: boolean | null;
}): JSX.Element {
  const t = getDictionary(language).homeR1.alerts;
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<'saved' | 'failed' | 'signin' | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goSignIn = (): void => {
    saveStoryTask({ kind: 'alert', story });
    window.location.assign(accountSignInUrl('/'));
  };

  const save = async (): Promise<void> => {
    if (signedIn === false) {
      setResult('signin');
      return;
    }
    setSaving(true);
    const out = await createAlert({ articleRef: story.articleRef, url: story.url });
    setSaving(false);
    if (out.ok) {
      setAlertFor(story.articleRef, { alertId: out.value.id, status: out.value.status });
      setResult('saved');
    } else setResult(out.reason === 'SIGNED_OUT' ? 'signin' : 'failed');
  };

  const signInView = result === 'signin' || signedIn === false;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[var(--gt-scrim)] sm:items-center" data-stage-b-alert-setup="" onClick={(e) => e.target === e.currentTarget && closePanel()}>
      <section role="dialog" aria-modal="true" aria-labelledby="stage-b-alert-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-[18px] bg-[var(--gt-bg)] p-4 text-[var(--gt-ink)] sm:max-w-[520px] sm:rounded-[16px] sm:p-5">
        <div className="flex items-start gap-3">
          <BellRing aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-[var(--gt-amberInk)]" />
          <div className="min-w-0 flex-1">
            <h2 id="stage-b-alert-title" className="font-display text-[19px] font-bold leading-tight">
              {signInView ? t.signInTitle : t.setupTitle}
            </h2>
            <p className="mt-1 text-[13px] text-[var(--gt-ink2)]">{signInView ? t.signInBody : t.setupSub}</p>
          </div>
          <button ref={closeRef} type="button" onClick={closePanel} aria-label={t.cancel} className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-[var(--gt-ink2)] hover:bg-[var(--gt-sunk)]">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 rounded-[12px] border-2 border-[var(--gt-amberBd)] bg-[var(--gt-card)] p-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <Check aria-hidden="true" className="h-4 w-4 text-[var(--gt-amberInk)]" />
            {t.scopeStory}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[13.5px] font-semibold text-[var(--gt-ink)]">{story.title}</p>
          <p className="mt-0.5 text-[12px] text-[var(--gt-ink2)]">{t.scopeStorySub}</p>
        </div>

        {!signInView && (
          <>
            <h3 className="mt-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--gt-ink2)]">{t.countsTitle}</h3>
            <ul className="mt-1 list-disc pl-5 text-[13px] text-[var(--gt-ink)]">
              {t.counts.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            <p data-follow-not-alert="" className="mt-3 rounded-[10px] border border-[var(--gt-mint)] bg-[var(--gt-mintBg)] p-3 text-[12.5px] text-[var(--gt-mintText)]">
              {t.followNote}
            </p>

            <h3 className="mt-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--gt-ink2)]">{t.where}</h3>
            <ul className="mt-1 flex flex-col gap-1.5 text-[13px]">
              <li className="flex items-center gap-2 rounded-[10px] border border-[var(--gt-line)] bg-[var(--gt-card)] p-2.5">
                <Bell aria-hidden="true" className="h-4 w-4 text-[var(--gt-amberInk)]" />
                <span className="flex-1">
                  <span className="font-semibold">{t.inApp}</span>
                  <span className="block text-[12px] text-[var(--gt-ink2)]">{t.inAppSub}</span>
                </span>
                <Check aria-hidden="true" className="h-4 w-4" />
              </li>
              {[
                { icon: Smartphone, label: t.push },
                { icon: Mail, label: t.email },
              ].map(({ icon: Icon, label }) => (
                <li key={label} data-delivery-unavailable="" className="flex items-center gap-2 rounded-[10px] border border-dashed border-[var(--gt-line)] p-2.5 text-[var(--gt-ink3)]">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  <span className="flex-1">{label}</span>
                  <span className="text-[12px]">{t.notAvailable}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-[var(--gt-ink2)]">{t.delivery}</p>
          </>
        )}

        {result === 'saved' && (
          <p role="status" className="mt-3 rounded-[10px] bg-[var(--gt-amberBg)] p-3 text-[13px] text-[var(--gt-amberInk)]">
            {t.saved}
          </p>
        )}
        {result === 'failed' && (
          <p role="alert" className="mt-3 text-[13px] text-[var(--gt-danger)]">
            {t.failed}
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={closePanel} className="min-h-[44px] rounded-full px-4 text-[14px] font-semibold text-[var(--gt-link)]">
            {t.cancel}
          </button>
          {signInView ? (
            <button type="button" onClick={goSignIn} data-alert-sign-in="" className="min-h-[44px] rounded-full bg-[var(--gt-act)] px-5 text-[14px] font-bold text-white">
              {t.signIn}
            </button>
          ) : result !== 'saved' ? (
            <button type="button" disabled={saving || signedIn === null} onClick={() => void save()} data-alert-save="" className="min-h-[44px] rounded-full bg-[var(--gt-act)] px-5 text-[14px] font-bold text-white disabled:opacity-50">
              {saving ? t.saving : t.save}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
