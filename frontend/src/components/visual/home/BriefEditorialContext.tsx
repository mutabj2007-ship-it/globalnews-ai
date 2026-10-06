import type { JSX } from 'react';
import type { HomeStoryCard, LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { fill } from '@/components/home/reva/homeRevaModel';
import { absoluteDate, domainLabel, freshnessLabel, isAttention, otherReportsLabel } from './homeStoryView';

/**
 * PHONE-FIRST HOME CORRECTION R1 · §9 — inside the Brief: WHY this story is on Home, stated only
 * from facts the server holds: business/conflict domain, the plain-language topic of the evidence
 * that admitted it (`card.topics`, server-derived), supported geography, other reports of the same
 * development, first-report date, freshness. Comments are never evidence; this block cites none.
 *
 * HOME DATA TRUTH CORRECTION R1 · B2 — `card.signals` (classifier evidence keys) is diagnostic
 * and is NEVER rendered to readers; no reason is invented here when the server gives none.
 */
export function BriefEditorialContext({ card, language }: { readonly card: HomeStoryCard; readonly language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).visual.home;
  const domain = domainLabel(card, t);
  const others = otherReportsLabel(card.otherReports.count, t);
  return (
    <section aria-labelledby="brief-why-here" data-brief-editorial="" className="flex flex-col gap-1.5 rounded-[0.625rem] border border-[var(--gt-line)] p-3">
      <h3 id="brief-why-here" className="text-[0.9375rem] font-bold">
        {t.whyHere}
      </h3>
      <p className="flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
        <span className={`rounded-[6px] px-2 py-[2px] text-[11.5px] font-bold ${isAttention(card.freshness) ? 'bg-[var(--gt-amber)] text-[var(--gt-amberOn)]' : 'bg-[var(--gt-sunk)] text-[var(--gt-ink)]'}`}>
          {freshnessLabel(card.freshness, t)}
        </span>
        {domain === null ? (
          <span className="text-[var(--gt-ink2)]">{t.outsideFocus}</span>
        ) : (
          <span className="font-semibold">{domain}</span>
        )}
        {(card.topics ?? []).length > 0 && <span className="text-[var(--gt-ink2)]">· {card.topics.join(' · ')}</span>}
      </p>
      {card.countries.length > 0 && (
        <p className="text-[0.8125rem] text-[var(--gt-ink2)]" aria-label={t.countriesAria}>
          {card.countries.map((c) => c.name).join(' · ')}
        </p>
      )}
      <p className="text-[0.8125rem] text-[var(--gt-ink2)]">
        {fill(t.firstReported, { date: absoluteDate(card.otherReports.firstReportedAt, language) })}
        {others === null ? '' : ` · ${others}`}
        {card.otherReports.publishers.length > 0 ? ` (${card.otherReports.publishers.join(', ')})` : ''}
      </p>
    </section>
  );
}
