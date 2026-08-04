import { Logo } from '@/components/ui/Logo';
import { footerLinkGroups } from '@/lib/homeContent';

export function Footer(): JSX.Element {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-void">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-secondary">
              Clear, sourced, multi-perspective news understanding &mdash; powered by AI,
              grounded in real reporting.
            </p>
          </div>

          {footerLinkGroups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-ink-tertiary">
                {group.title}
              </h3>
              <ul className="flex flex-col gap-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="inline-flex items-center gap-2 text-sm text-ink-secondary transition-colors hover:text-ink-primary"
                    >
                      {link.label}
                      {link.comingSoon && (
                        <span className="rounded-full border border-border-strong bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
                          Coming soon
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs text-ink-tertiary">
            &copy; {currentYear} GlobalNews AI. All rights reserved.
          </p>
          <p className="font-mono text-xs text-ink-tertiary">
            Built for clarity, not clicks.
          </p>
        </div>
      </div>
    </footer>
  );
}
