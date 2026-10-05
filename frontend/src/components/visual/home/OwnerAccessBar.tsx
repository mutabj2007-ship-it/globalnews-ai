'use client';

import { useEffect, useState, type JSX } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { accountFetch } from '@/lib/api/accountFetch';

type Mode = 'NOT_OWNER' | 'UNRESTRICTED' | 'ORDINARY_PREVIEW';

/**
 * PHONE-FIRST HOME CORRECTION R1 · §2 — the owner's view of the Alpha owner entitlement.
 *
 * Renders NOTHING unless the server says this signed-in account is the verified owner on Alpha
 * (GET /users/me/access → mode). The client decides nothing: the badge reflects a server fact, and
 * "Preview ordinary user experience" is a server-set cookie that can only REMOVE the exemption.
 */
export function OwnerAccessBar({ language }: { readonly language: LanguageCode }): JSX.Element | null {
  const t = getDictionary(language).visual.home;
  const [mode, setMode] = useState<Mode>('NOT_OWNER');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    accountFetch('/users/me/access')
      .then(async (r) => (r.ok ? ((await r.json()) as { mode?: Mode }) : null))
      .then((v) => {
        if (live && v?.mode !== undefined) setMode(v.mode);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  if (mode === 'NOT_OWNER') return null;
  const preview = mode === 'ORDINARY_PREVIEW';
  const toggle = async (): Promise<void> => {
    setBusy(true);
    try {
      const r = await accountFetch('/users/me/access/preview', { method: 'POST', body: { enabled: !preview } });
      if (r.ok) {
        const v = (await r.json()) as { mode?: Mode };
        if (v.mode !== undefined) setMode(v.mode);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-owner-access={mode} role="status" className="relative mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[0.5rem] border border-[var(--gt-amber)] bg-[var(--gt-amberBg)] px-2.5 py-1 text-[0.8125rem] text-[var(--gt-amberInk)]">
      <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="font-bold">{t.ownerBadge}</span>
      <span className="hidden min-w-0 flex-1 min-[600px]:inline">{preview ? t.ownerPreviewOn : t.ownerUnrestricted}</span>
      <span className="sr-only min-[600px]:hidden">{preview ? t.ownerPreviewOn : t.ownerUnrestricted}</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        data-owner-preview-toggle=""
        className="ms-auto inline-flex min-h-[44px] items-center rounded-[0.5rem] px-2 text-[0.8125rem] font-semibold underline disabled:opacity-60"
      >
        {preview ? t.ownerPreviewStop : t.ownerPreviewShort}
      </button>
    </div>
  );
}
