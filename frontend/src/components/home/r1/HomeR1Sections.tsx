'use client';

import type { JSX } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { accountSignInUrl } from '@/lib/api/accountLinks';
import { useHomeSession } from '@/components/home/reva/HomeSession';
import { RESOLVED_DOMAINS } from '@/components/home/reva/homeRevaModel';

/**
 * HOME R1 · STAGE A — the lower Home, light primary: the My Intelligence bridge and Explore
 * intelligence. Destinations come from the ONE module registry (RESOLVED_DOMAINS); a domain
 * without a real route is not drawn. Navigation only — nothing here requests anything
 * beyond the existing account read the Home session already makes.
 */
export function HomeR1Bridge({ language }: { readonly language: LanguageCode }): JSX.Element | null {
  const t = getDictionary(language).homeReva.bridge;
  const { user, isLoading } = useHomeSession();
  if (isLoading) return null;
  const signedIn = user !== null;
  return (
    <section data-home-r1-bridge="" className="flex flex-col gap-4 rounded-[14px] border border-[var(--gt-line)] bg-[var(--gt-card)] p-5 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--gt-ink3)]">{t.eyebrow}</p>
        <h2 className="mt-1 font-display text-[20px] font-bold text-[var(--gt-ink)]">{signedIn ? t.signedTitle : t.anonTitle}</h2>
        <p className="mt-1 flex items-start gap-2 text-[13.5px] text-[var(--gt-ink2)]">
          <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gt-mintText)]" />
          {signedIn ? t.signedBody : t.anonBody}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <a href="/my-intelligence" className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--gt-pgLine2)] px-4 text-[14px] font-semibold text-[var(--gt-ink)] hover:border-[var(--gt-act)]">
          {signedIn ? t.open : t.about}
        </a>
        {!signedIn && (
          <a href={accountSignInUrl('/')} className="inline-flex min-h-[44px] items-center rounded-full bg-[var(--gt-act)] px-5 text-[14px] font-bold text-white hover:brightness-110">
            {t.signIn}
          </a>
        )}
      </div>
    </section>
  );
}

export function HomeR1Explore({ language }: { readonly language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).homeReva.explore;
  const preview = getDictionary(language).homeR1.nav.preview;
  return (
    <section id="explore-intelligence" aria-labelledby="home-r1-explore" className="scroll-mt-24">
      <h2 id="home-r1-explore" className="font-display text-[22px] font-bold text-[var(--gt-ink)]">
        {t.title} <span className="ms-1 text-[13px] font-normal text-[var(--gt-ink2)]">{t.note}</span>
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {RESOLVED_DOMAINS.map((domain) =>
          domain.href === null ? null : (
            <li key={domain.key}>
              <a
                href={domain.href}
                className="flex h-full min-h-[96px] flex-col justify-between gap-2 rounded-[12px] border border-[var(--gt-line)] bg-[var(--gt-card)] p-3 hover:border-[var(--gt-act)]"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold text-[var(--gt-ink)]">{t.domains[domain.key].name}</span>
                  {domain.preview && (
                    <span className="rounded-[5px] border border-[var(--gt-line)] px-1.5 font-mono text-[9.5px] uppercase text-[var(--gt-ink3)]">{preview}</span>
                  )}
                </span>
                <span className="text-[12px] leading-snug text-[var(--gt-ink2)]">{t.domains[domain.key].line}</span>
                <ArrowRight aria-hidden="true" className="h-4 w-4 text-[var(--gt-link)]" />
              </a>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
