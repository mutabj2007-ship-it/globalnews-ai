import type { LanguageCode } from '@globalnews-ai/shared';
import { Logo } from '@/components/ui/Logo';
import { footerLinkGroups } from '@/lib/homeContent';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { hudCornerBracketClassName } from '@/components/home/hudPanelGeometry';

interface FooterProps {
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

/**
 * CTO directive (Footer must be finished) — compacted from a
 * 4-column stacked layout into a single-row flat link band (logo +
 * tagline left, all real links inline right, copyright/tagline
 * beneath a thin cyan rail) — closer to the reference's compact
 * single-row footer than the earlier multi-column SaaS-style stack.
 *
 * Data unchanged: still every real group/link/href/comingSoon flag
 * from `footerLinkGroups` (homeContent.ts) — flattened for DISPLAY
 * only, nothing added or removed. Group titles are dropped from the
 * visual (the reference doesn't show them either) but the underlying
 * grouped data structure itself is untouched.
 */
export function Footer({ language = 'en' }: FooterProps): JSX.Element {
  const currentYear = new Date().getFullYear();
  const t = getDictionary(language).footer;
  const allLinks = footerLinkGroups.flatMap((group) => group.links);

  return (
    <footer className="relative border-t border-cyan-500/25 bg-void">
      <span aria-hidden="true" className={hudCornerBracketClassName('top-left')} />
      <span aria-hidden="true" className={hudCornerBracketClassName('top-right')} />
      <div className="mx-auto max-w-[1480px] px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <p className="hidden max-w-xs text-xs leading-relaxed text-ink-tertiary sm:block">{t.tagline}</p>
          </div>

          <nav aria-label={t.tagline} className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {allLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1.5 text-xs text-ink-secondary transition-colors hover:text-cyan-300"
              >
                {t.linkLabels[link.href] ?? link.label}
                {link.comingSoon && (
                  <span className="rounded-full border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ink-tertiary">
                    {t.comingSoon}
                  </span>
                )}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-4 flex flex-col items-start gap-2 border-t border-cyan-500/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] text-ink-tertiary">
            &copy; {currentYear} {t.copyrightSuffix}
          </p>
          <p className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-tertiary">
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-cyan-400" />
            {t.closingTagline}
          </p>
        </div>
      </div>
    </footer>
  );
}
