'use client';

import type { JSX } from 'react';
import Link from 'next/link';
import { ArrowRight, LayoutDashboard, UserPlus } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { accountSignInUrl } from '@/lib/api/accountLinks';
import { useHomeSession } from './HomeSession';
import { fill } from './homeRevaModel';

/**
 * HOME → MY INTELLIGENCE BRIDGE (MI_BRIDGE_SPEC.md, CTO §10 — REQUIRED).
 *
 * Signed in: "Your intelligence, your way" + "Open My Intelligence →". The
 * "{n} new since your previous visit" state appears ONLY when the existing
 * previous-visit boundary exists and n > 0 — never "0 new".
 * Signed out (same position): "Make GlobalNewsAI yours" + "About My
 * Intelligence" (/my-intelligence shows its auth-required state) + the primary
 * "Sign in", on the existing auth path returning to exactly "/".
 *
 * Existing account, Follow and visit-boundary contracts only. No new backend.
 * While the session resolves the box keeps its size and shows nothing, so a
 * signed-in reader never sees the signed-out invitation flash first.
 */
export function HomeBridge({ language }: { language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).homeReva.bridge;
  const { user, isLoading, newSinceCount } = useHomeSession();
  const shell = 'flex min-h-[96px] flex-col gap-4 rounded-[14px] border border-[#15406a] bg-[linear-gradient(135deg,#07233d_0%,#061a31_60%,#051427_100%)] px-5 py-4 md:flex-row md:items-center md:gap-6';

  if (isLoading) return <section aria-hidden="true" data-home-bridge="pending" className={`${shell} invisible`} />;

  if (user === null) {
    return (
      <section aria-labelledby="home-bridge-heading" data-home-bridge="anonymous" className={shell}>
        <UserPlus aria-hidden="true" className="hidden h-6 w-6 shrink-0 text-[#5abff5] md:block" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#5abff5]">{t.eyebrow}</p>
          <h2 id="home-bridge-heading" className="mt-1 text-[18px] font-bold text-white">
            {t.anonTitle}
          </h2>
          <p className="mt-1 text-[13.5px] leading-snug text-[#c2d3e6]">{t.anonBody}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/my-intelligence"
            className="inline-flex min-h-[44px] items-center rounded-full border border-[#2f6ea8] px-4 text-[14px] font-semibold text-white transition-colors hover:border-[#5abff5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] motion-reduce:transition-none"
          >
            {t.about}
          </Link>
          <a
            href={accountSignInUrl('/')}
            className="inline-flex min-h-[44px] items-center rounded-full bg-[#0a6bd6] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[#1479e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] motion-reduce:transition-none"
          >
            {t.signIn}
          </a>
        </div>
      </section>
    );
  }

  const [lead, ...rest] = newSinceCount === null ? [] : fill(t.newSince, { count: newSinceCount }).split(' ');
  return (
    <section aria-labelledby="home-bridge-heading" data-home-bridge="signed-in" className={shell}>
      <LayoutDashboard aria-hidden="true" className="hidden h-6 w-6 shrink-0 text-[#5abff5] md:block" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#5abff5]">{t.eyebrow}</p>
        <h2 id="home-bridge-heading" className="mt-1 text-[18px] font-bold text-white">
          {t.signedTitle}
        </h2>
        <p className="mt-1 text-[13.5px] leading-snug text-[#c2d3e6]">{t.signedBody}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {lead === undefined ? null : (
          <span data-home-bridge-new-since="" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#e2efff]">
            <span className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-[#0a6bd6] px-1.5 text-[12.5px] font-bold text-white">{lead}</span>
            {rest.join(' ')}
          </span>
        )}
        <Link
          href="/my-intelligence"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#0a6bd6] px-5 text-[14.5px] font-bold text-white transition-colors hover:bg-[#1479e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] motion-reduce:transition-none"
        >
          {t.open}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
