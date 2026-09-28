'use client';

import type { JSX } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { useHomeSession } from './HomeSession';
import { fill } from './homeRevaModel';

/**
 * D3 (APPROVED) — THE RETURNING-READER HERO STATE.
 *
 * Signed in only. The greeting sits above the H1 and never replaces it, so the
 * product identity stays. The New-since chip appears ONLY when the existing
 * previous-visit boundary exists and the count is > 0 — never "0 new".
 *
 * The count is the session's one feed read (see HomeSession): retained data,
 * no AI, no provider, made only for a signed-in reader.
 */
export function HeroGreeting({ language }: { language: LanguageCode }): JSX.Element | null {
  const { user, isLoading } = useHomeSession();
  if (isLoading || user === null) return null;
  const t = getDictionary(language).homeReva.hero;
  const name = user.displayName?.trim();
  return (
    <p data-home-hero-greeting="" className="mb-3 text-[17px] font-semibold text-[#8fd3ff] md:text-[19px]">
      {name ? fill(t.welcomeNamed, { name }) : t.welcome}
    </p>
  );
}

export function HeroNewSince({ language }: { language: LanguageCode }): JSX.Element | null {
  const { user, isLoading } = useHomeSession();
  if (isLoading || user === null) return null;
  return <NewSinceChip language={language} />;
}

function NewSinceChip({ language }: { language: LanguageCode }): JSX.Element | null {
  const count = useHomeSession().newSinceCount;
  if (count === null) return null;
  const t = getDictionary(language).homeReva.hero;
  const [lead, ...rest] = fill(t.newSince, { count }).split(' ');
  return (
    <Link
      href="/my-intelligence"
      data-home-new-since=""
      className="mt-4 inline-flex min-h-[44px] max-w-full items-center gap-2.5 rounded-full border border-[#1b6fa8] bg-[#07233d] py-1 pl-1.5 pr-4 text-[14px] font-semibold text-[#e2efff] transition-colors hover:border-[#5abff5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] motion-reduce:transition-none"
    >
      <span className="inline-flex h-[30px] min-w-[30px] items-center justify-center rounded-full bg-[#0a6bd6] px-2 text-[13px] font-bold text-white">{lead}</span>
      <span className="truncate">{rest.join(' ')}</span>
      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#8fd3ff]" />
    </Link>
  );
}
