'use client';

import type { MarketRetainedProcurementNotice } from '@globalnews-ai/shared';
import {
  MKT_INK,
  MKT_LINE,
  MKT_SURFACE,
  MKT_TYPE,
} from '@/lib/market/mktTokens';
import type { MktLocale, MktStrings } from '@/lib/market/mktStrings';
import { Identifier, edge, micro } from './MktParts';

function localizedTitle(notice: MarketRetainedProcurementNotice, locale: MktLocale): string {
  return locale === 'pl'
    ? notice.title.pl ?? notice.title.en ?? notice.portalReference.noticeId
    : notice.title.en ?? notice.title.pl ?? notice.portalReference.noticeId;
}

function localizedBuyer(notice: MarketRetainedProcurementNotice, locale: MktLocale): string {
  const names =
    locale === 'pl'
      ? notice.buyerNames.pl ?? notice.buyerNames.en ?? notice.buyerNames.source
      : notice.buyerNames.en ?? notice.buyerNames.pl ?? notice.buyerNames.source;
  return names?.join(' · ') ?? '—';
}

function deadline(notice: MarketRetainedProcurementNotice, fallback: string): string {
  if (!notice.deadlineDate && !notice.deadlineTime) return fallback;
  return [notice.deadlineDate, notice.deadlineTime].filter(Boolean).join(' · ');
}

export function MarketNoticeCard({
  notice,
  locale,
  t,
}: {
  notice: MarketRetainedProcurementNotice;
  locale: MktLocale;
  t: MktStrings;
}): JSX.Element {
  return (
    <article
      data-mkt="procurement-notice"
      data-mkt-notice={notice.portalReference.noticeId}
      style={{
        border: edge,
        background: MKT_SURFACE.panel,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <span style={{ ...micro, color: MKT_INK.label }}>{t.procurement.notice}</span>
        <a
          href={notice.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: MKT_INK.primary,
            fontSize: MKT_TYPE.bodyLarge,
            fontWeight: 600,
            textDecoration: 'none',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
          }}
        >
          {localizedTitle(notice, locale)}
        </a>
        <span style={{ ...micro, color: MKT_INK.tertiary }}>
          <Identifier>TED · {notice.portalReference.noticeId}</Identifier>
        </span>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
          gap: '12px 18px',
        }}
      >
        <Field label={t.procurement.buyer}>{localizedBuyer(notice, locale)}</Field>
        <Field label={t.procurement.country}>
          <Identifier>{notice.buyerCountryIso3}</Identifier>
        </Field>
        <Field label={t.procurement.published}>
          <Identifier>{notice.publicationDate}</Identifier>
        </Field>
        <Field label={t.procurement.noticeType}>
          <Identifier>{notice.noticeType}</Identifier>
        </Field>
        <Field label={t.procurement.cpv}>
          <Identifier>{notice.cpvCodes.join(' · ')}</Identifier>
        </Field>
        <Field label={t.procurement.deadline}>
          <Identifier>{deadline(notice, t.procurement.notStated)}</Identifier>
        </Field>
        <Field label={t.procurement.statedValue}>
          {notice.totalValue === null ? (
            t.procurement.notStated
          ) : (
            <Identifier>{String(notice.totalValue)} {notice.currency}</Identifier>
          )}
        </Field>
      </div>

      <footer
        style={{
          borderBlockStart: `1px solid ${MKT_LINE.hairline}`,
          paddingBlockStart: '10px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 14px',
          alignItems: 'baseline',
        }}
      >
        <span style={{ ...micro, color: MKT_INK.label }}>{t.reader.source}</span>
        <span style={{ fontSize: MKT_TYPE.body, color: MKT_INK.secondary }}>
          <Identifier>TED</Identifier>
        </span>
        <span style={{ ...micro, color: MKT_INK.label }}>{t.reader.sourceClass}</span>
        <span style={{ fontSize: MKT_TYPE.body, color: MKT_INK.secondary }}>
          <Identifier>PROCUREMENT_NOTICE</Identifier>
        </span>
        <span style={{ ...micro, color: MKT_INK.tertiary }}>
          {t.procurement.retainedAt}: <Identifier>{notice.retainedAt}</Identifier>
        </span>
        <a
          href={notice.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...micro, color: MKT_INK.secondary }}
        >
          {t.procurement.openNotice} →
        </a>
      </footer>
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
      <span style={{ ...micro, color: MKT_INK.label }}>{label}</span>
      <span
        style={{
          color: MKT_INK.primary,
          fontSize: MKT_TYPE.body,
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
        }}
      >
        {children}
      </span>
    </div>
  );
}
