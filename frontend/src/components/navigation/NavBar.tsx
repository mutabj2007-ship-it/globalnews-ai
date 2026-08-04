'use client';

import { useState } from 'react';
import { Search, Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { primaryNavLinks } from '@/lib/navigation';

export function NavBar(): JSX.Element {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-void/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="/" className="shrink-0" aria-label="GlobalNews AI home">
          <Logo />
        </a>

        {/* Desktop nav */}
        <nav
          className="hidden items-center gap-6 lg:flex"
          aria-label="Primary navigation"
        >
          {primaryNavLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-secondary transition-colors hover:text-ink-primary"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            type="button"
            aria-label="Search"
            className="rounded-full p-2 text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink-primary"
          >
            <Search size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-signal-bright"
          >
            Sign In
          </button>
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            aria-label="Search"
            className="rounded-full p-2 text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink-primary"
          >
            <Search size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
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
          aria-label="Mobile navigation"
        >
          <div className="flex flex-col gap-1">
            {primaryNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink-primary"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
          <button
            type="button"
            className="mt-4 w-full rounded-full bg-signal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-bright"
          >
            Sign In
          </button>
        </nav>
      )}
    </header>
  );
}
