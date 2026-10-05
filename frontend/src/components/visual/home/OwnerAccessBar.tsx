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
    <div data-owner-access={mode} role="status" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[0.5rem] border border-[var(--gt-amber)] bg-[var(--gt-amberBg)] px-3 py-2 text-[0.8125rem] text-[var(--gt-amberInk)]">
      <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="font-bold">{t.ownerBadge}</span>
      <span className="min-w-0 flex-1">{preview ? t.ownerPreviewOn : t.ownerUnrestricted}</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        data-owner-preview-toggle=""
        className="inline-flex min-h-[44px] items-center rounded-[0.5rem] border border-current px-3 font-semibold disabled:opacity-60"
      >
        {preview ? t.ownerPreviewStop : t.ownerPreviewStart}
      </button>
    </div>
  );
}
