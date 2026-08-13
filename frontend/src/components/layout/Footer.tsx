import type { LanguageCode } from '@globalnews-ai/shared';
import { Logo } from '@/components/ui/Logo';
import { footerLinkGroups } from '@/lib/homeContent';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface FooterProps {
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

/**
 * Milestone #48 — group titles and link labels are GlobalNews AI UI
 * copy (Category A), looked up from the dictionary by the SAME key
 * (`group.title`) / href (`link.href`) homeContent.ts's
 * footerLinkGroups already uses — homeContent.ts's own English strings
 * remain the fallback for any key the dictionary doesn't (yet) cover,
 * so this never renders a blank label. Routes/hrefs and the
 * `comingSoon` flag are completely untouched — only presentation text.
 */
export function Footer({ language = 'en' }: FooterProps): JSX.Element {
  const currentYear = new Date().getFullYear();
  const t = getDictionary(language).footer;

  return (
    <footer className="bg-void">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-secondary">{t.tagline}</p>
          </div>

          {footerLinkGroups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-ink-tertiary">
                {t.groupTitles[group.title] ?? group.title}
              </h3>
              <ul className="flex flex-col gap-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="inline-flex items-center gap-2 text-sm text-ink-secondary transition-colors hover:text-ink-primary"
                    >
                      {t.linkLabels[link.href] ?? link.label}
                      {link.comingSoon && (
                        <span className="rounded-full border border-border-strong bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
                          {t.comingSoon}
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
            &copy; {currentYear} {t.copyrightSuffix}
          </p>
          <p className="font-mono text-xs text-ink-tertiary">{t.closingTagline}</p>
        </div>
      </div>
    </footer>
  );
}
