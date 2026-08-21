'use client';

import type { AdminDictionary } from '@/lib/i18n/dictionaries/adminEn';

/**
 * F1.b — the non-authorized renderings of the admin surface.
 *
 * Four of the five access outcomes land here. None of them renders a
 * sidebar, a screen code, a capability list or a section inventory: a
 * caller who is not an administrator learns nothing about the shape of
 * the platform from this page.
 *
 * 403 AND 404 SHARE ONE RENDERING, and that is a security property, not
 * a shortcut. With ADMIN_PLATFORM_ENABLED off the backend answers 404 to
 * everyone precisely so a disabled platform is indistinguishable from an
 * absent one. Giving "disabled" its own screen would hand back the
 * distinction F1.a removed.
 */
export function AdminAccessState({
  t,
  variant,
  onRetry,
}: {
  t: AdminDictionary;
  variant: 'loading' | 'unauthenticated' | 'forbidden' | 'unreachable';
  onRetry?: () => void;
}): JSX.Element {
  const copy = {
    loading: { title: t.access.loadingTitle, body: t.access.loadingBody },
    unauthenticated: { title: t.access.signInTitle, body: t.access.signInBody },
    forbidden: { title: t.access.forbiddenTitle, body: t.access.forbiddenBody },
    unreachable: { title: t.access.unreachableTitle, body: t.access.unreachableBody },
  }[variant];

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-adm-void bg-adm-page px-6 font-cd-body text-adm-ink"
      aria-busy={variant === 'loading'}
    >
      <div className="w-full max-w-md rounded-xl border border-adm-edge bg-adm-card-soft p-7">
        <p className="font-cd-mono text-[10px] uppercase tracking-[0.18em] text-adm-ink-faint">
          {t.brand.name} {t.brand.accent}
        </p>

        <h1 className="mt-3 text-lg font-semibold tracking-tight text-adm-ink">{copy.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-adm-ink-4">{copy.body}</p>

        {variant === 'loading' && (
          <div
            aria-hidden="true"
            className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-adm-edge"
          >
            <div className="h-full w-1/3 rounded-full bg-adm-accent/60" />
          </div>
        )}

        {variant === 'unauthenticated' && (
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/auth/google`}
            className="mt-6 inline-flex items-center rounded-lg border border-adm-edge-input bg-adm-card px-4 py-2 text-sm text-adm-accent-hi hover:border-adm-accent/60"
          >
            {t.access.signInCta}
          </a>
        )}

        {variant === 'unreachable' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 inline-flex items-center rounded-lg border border-adm-edge-input bg-adm-card px-4 py-2 text-sm text-adm-accent-hi hover:border-adm-accent/60"
          >
            {t.access.retry}
          </button>
        )}
      </div>
    </main>
  );
}
