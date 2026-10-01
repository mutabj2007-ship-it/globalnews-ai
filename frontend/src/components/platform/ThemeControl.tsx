'use client';

import { useEffect, useId, useRef, useState, type JSX, type ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { THEME_PREFERENCES, type ThemePreference } from '@/lib/theme/theme';
import { setThemePreference, useThemePreference } from '@/lib/theme/themeStore';

/**
 * HOME R1 · DUAL THEME — the theme SCOPE. Server-rendered with the cookie's preference so
 * the first frame is already right (System resolves in CSS through prefers-color-scheme);
 * afterwards it follows the reader's choice. Presentation only.
 */
export function ThemeScope({
  initial,
  children,
  className,
  ...rest
}: {
  readonly initial: ThemePreference;
  readonly children: ReactNode;
  readonly className?: string;
} & Record<`data-${string}`, string>): JSX.Element {
  const preference = useThemePreference(initial);
  return (
    <div {...rest} data-gna-theme={preference} className={className}>
      {children}
    </div>
  );
}

const ICONS: Record<ThemePreference, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

/**
 * Light · Dark · System. A 44 px button opens a small radio group (native radios: arrow
 * keys, Space, screen-reader state for free); Escape and an outside press close it. Choosing
 * writes one first-party cookie and re-labels the theme scopes in place — no request, no
 * navigation, no other state touched.
 */
export function ThemeControl({
  language,
  initial,
}: {
  readonly language: LanguageCode;
  readonly initial: ThemePreference;
}): JSX.Element {
  const t = getDictionary(language).homeR1.theme;
  const preference = useThemePreference(initial);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const firstRef = useRef<HTMLInputElement | null>(null);
  const id = useId();
  const Icon = ICONS[preference];

  useEffect(() => {
    if (!open) return undefined;
    firstRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative" data-theme-control="">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-label={`${t.label}: ${t[preference]}`}
        title={`${t.label}: ${t[preference]}`}
        onClick={() => setOpen((was) => !was)}
        data-theme-toggle=""
        className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-white/30 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-navOn)]"
      >
        <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
      </button>
      {open && (
        <fieldset
          id={`${id}-menu`}
          data-theme-menu=""
          className="absolute right-0 top-[52px] z-[70] w-[220px] rounded-[12px] border border-[var(--gt-line)] bg-[var(--gt-card)] p-2 text-[var(--gt-ink)] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)]"
        >
          <legend className="px-2 pb-1 pt-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--gt-ink3)]">{t.label}</legend>
          {THEME_PREFERENCES.map((option, index) => {
            const OptionIcon = ICONS[option];
            return (
              <label
                key={option}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[8px] px-2 text-[14px] font-semibold hover:bg-[var(--gt-sunk)] has-[:checked]:bg-[var(--gt-actSoft)]"
              >
                <input
                  ref={index === 0 ? firstRef : undefined}
                  type="radio"
                  name={`${id}-theme`}
                  value={option}
                  checked={preference === option}
                  onChange={() => setThemePreference(option)}
                  data-theme-option={option}
                  className="h-4 w-4 accent-[var(--gt-act)]"
                />
                <OptionIcon aria-hidden="true" className="h-4 w-4 text-[var(--gt-ink2)]" />
                <span className="flex flex-col">
                  <span>{t[option]}</span>
                  {option === 'system' && <span className="text-[11.5px] font-normal text-[var(--gt-ink2)]">{t.systemNote}</span>}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}
