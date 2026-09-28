'use client';

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import { HERO_COMPOSER_ID } from './homeRevaModel';

/**
 * D2 (APPROVED) — the compact secondary Ask quick action.
 *
 * Rendered only once the primary Hero composer is no longer visible, so Home
 * never shows two equal Ask entries at once. Pressing it returns the reader to
 * the Hero composer and focuses it: 0 AI until the reader presses Send in Ask.
 * Phone relies on the existing Ask AI bottom-nav destination instead.
 */
export function HeaderAskLauncher({ label, ariaLabel }: { label: string; ariaLabel: string }): JSX.Element | null {
  const [composerVisible, setComposerVisible] = useState(true);

  useEffect(() => {
    const target = document.getElementById(HERO_COMPOSER_ID);
    if (target === null || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setComposerVisible(entry?.isIntersecting ?? true), {
      rootMargin: '-64px 0px 0px 0px',
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  if (composerVisible) return null;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-home-header-ask=""
      onClick={() => {
        const composer = document.getElementById(HERO_COMPOSER_ID);
        composer?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        composer?.querySelector<HTMLElement>('input, textarea')?.focus({ preventScroll: true });
      }}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#1b6fa8] bg-[#07304f] px-4 text-[13.5px] font-semibold text-[#cfe6ff] transition-colors hover:border-[#5abff5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] motion-reduce:transition-none"
    >
      <MessagesSquare aria-hidden="true" className="h-[17px] w-[17px]" />
      {label}
    </button>
  );
}
