'use client';

import { useEffect, useRef, useState } from 'react';
import { MY_INTELLIGENCE_INTERESTS, type LanguageCode, type MyIntelligenceInterest } from '@globalnews-ai/shared';
import { X } from 'lucide-react';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { MI_FOCUS, MI_FOLLOW_OFF, MI_FOLLOW_ON, MI_TARGET } from '../miPresentation';

/**
 * INTEREST + SELECTION HOOK R1 — TUNE INTERESTS.
 *
 * Explicit and inspectable: the reader sees every governed interest and picks
 * any of them. Desktop: a compact side panel; phone: a bounded bottom sheet.
 * Preference chips are CYAN (the Follow family), never sand — sand means an
 * intelligence action, and choosing interests is not one.
 *
 * Opening, toggling and closing are local. Apply is ONE account mutation
 * (PUT /users/me/intelligence/interests); Show all applies the empty set.
 * No AI, no provider, no /analysis/news.
 */
export function InterestEditor({
  language,
  current,
  saving,
  onApply,
  onClose,
}: {
  language: LanguageCode;
  current: readonly MyIntelligenceInterest[];
  saving: boolean;
  onApply: (next: readonly MyIntelligenceInterest[]) => Promise<boolean>;
  onClose: () => void;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence.interests;
  const [draft, setDraft] = useState<ReadonlySet<MyIntelligenceInterest>>(() => new Set(current));
  const [failed, setFailed] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (interest: MyIntelligenceInterest): void =>
    setDraft((was) => {
      const next = new Set(was);
      if (next.has(interest)) next.delete(interest);
      else next.add(interest);
      return next;
    });

  const apply = async (next: readonly MyIntelligenceInterest[]): Promise<void> => {
    setFailed(false);
    const ok = await onApply(next);
    if (ok) onClose();
    else setFailed(true);
  };

  const ordered = MY_INTELLIGENCE_INTERESTS.filter((interest) => draft.has(interest));

  return (
    <div className="fixed inset-0 z-[85]" data-mi-interest-editor="">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-[rgba(1,6,15,0.62)]" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mi-interest-title"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[78dvh] flex-col rounded-t-[16px] border border-[#0e2d4d] bg-[#04162b] outline-none lg:inset-x-auto lg:bottom-auto lg:right-6 lg:top-[88px] lg:max-h-[calc(100dvh-112px)] lg:w-[400px] lg:rounded-[14px] lg:shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#0a2744] px-5 py-3">
          <h2 id="mi-interest-title" className="text-[17px] font-bold text-white">{t.title}</h2>
          <button type="button" aria-label={t.close} onClick={onClose} className={`${MI_FOCUS} ${MI_TARGET} flex items-center justify-center rounded-full text-[#cfe2f2]`}>
            <X aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <p className="text-[13px] leading-[1.5] text-[#93a7bd]">{t.note}</p>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label={t.title}>
            {MY_INTELLIGENCE_INTERESTS.map((interest) => (
              <li key={interest}>
                <button
                  type="button"
                  aria-pressed={draft.has(interest)}
                  data-mi-interest={interest}
                  onClick={() => toggle(interest)}
                  className={`${MI_FOCUS} min-h-[44px] rounded-full px-4 text-[13.5px] font-semibold transition-colors motion-reduce:transition-none ${
                    draft.has(interest) ? MI_FOLLOW_ON : MI_FOLLOW_OFF
                  }`}
                >
                  {t.labels[interest]}
                </button>
              </li>
            ))}
          </ul>
          {failed && (
            <p role="status" className="mt-3 text-[13px] text-[#ffcf7d]">
              {t.failed}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[#0a2744] px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            data-mi-interest-action="show-all"
            disabled={saving}
            onClick={() => void apply([])}
            className={`${MI_FOCUS} ${MI_TARGET} rounded-full px-3 text-[13.5px] font-semibold text-[#5abff5] disabled:opacity-50`}
          >
            {t.showAll}
          </button>
          <button
            type="button"
            data-mi-interest-action="apply"
            disabled={saving}
            onClick={() => void apply(ordered)}
            className={`${MI_FOCUS} ${MI_TARGET} rounded-full border border-[#1b6fa8] bg-[#07304f] px-6 text-[14px] font-bold text-[#cfe6ff] disabled:opacity-50`}
          >
            {saving ? t.saving : t.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
