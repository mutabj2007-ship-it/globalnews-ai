'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Search, Menu, X } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { Logo } from '@/components/ui/Logo';
import { primaryNavLinks } from '@/lib/navigation';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface NavBarProps {
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

/**
 * Milestone #48 — nav link LABELS (Category A, GlobalNews AI UI copy)
 * are looked up from the dictionary by href, keeping navigation.ts's
 * own `primaryNavLinks` array (routes + English fallback labels)
 * completely unchanged — no routes/structure altered, only the
 * rendered text.
 */
export function NavBar({ language = 'en' }: NavBarProps): JSX.Element {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const t = getDictionary(language).navBar;

  return (
    <header className="sticky top-0 z-50 border-b border-cyan-500/15 bg-void/85 backdrop-blur-md relative">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

      <div className="mx-auto flex h-14 max-w-[1480px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="/" className="shrink-0" aria-label={t.homeAriaLabel}>
          <Logo />
        </a>

        {/* Desktop nav */}
        <nav
          className="hidden items-center gap-5 lg:flex"
          aria-label={t.primaryNavigationAriaLabel}
        >
          {primaryNavLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-1 text-sm font-medium transition-colors after:absolute after:-bottom-1 after:left-0 after:h-px after:bg-cyan-400 after:transition-all after:duration-200 ${
                  isActive ? 'text-ink-primary after:w-full' : 'text-ink-secondary after:w-0 hover:text-ink-primary hover:after:w-full'
                }`}
              >
                {t.linkLabels[link.href] ?? link.label}
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            type="button"
            aria-label={t.searchAriaLabel}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-500/25 text-ink-secondary transition-colors hover:border-cyan-400/60 hover:text-cyan-300"
          >
            <Search size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-void transition-colors hover:bg-cyan-400"
          >
            {t.signIn}
          </button>
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            aria-label={t.searchAriaLabel}
            className="rounded-full p-2 text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink-primary"
          >
            <Search size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label={isMobileMenuOpen ? t.closeMenuAriaLabel : t.openMenuAriaLabel}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className="rounded-full p-2 text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink-primary"
          >
            {isMobileMenuOpen ? (
              <X size={20} strokeWidth={2} />
            ) : (
              <Menu size={20} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {isMobileMenuOpen && (
        <nav
          className="border-t border-border bg-void px-4 pb-6 pt-2 lg:hidden"
          aria-label={t.mobileNavigationAriaLabel}
        >
          <div className="flex flex-col gap-1">
            {primaryNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink-primary"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t.linkLabels[link.href] ?? link.label}
              </a>
            ))}
          </div>
          <button
            type="button"
            className="mt-4 w-full rounded-full bg-signal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-bright"
          >
            {t.signIn}
          </button>
        </nav>
      )}
    </header>
  );
}
