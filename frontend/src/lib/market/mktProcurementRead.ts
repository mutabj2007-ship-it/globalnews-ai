import type {
  MarketProcurementNotice,
  MarketProcurementLocalizedNames,
  MarketProcurementLocalizedText,
} from '@globalnews-ai/shared';
import { resolveApiBaseUrl } from '@/lib/api/apiBase';
import type { MktLocale } from '@/lib/market/mktStrings';

export type MarketProcurementReadUnavailableReason =
  | 'NO_READ_ENDPOINT'
  | 'NO_RETAINED_PROCUREMENT'
  | 'NO_DISPLAYABLE_PROCUREMENT';

export type MarketProcurementReadResult =
  | { readonly kind: 'PROCUREMENT'; readonly notices: readonly MarketProcurementNotice[] }
  | { readonly kind: 'UNAVAILABLE'; readonly reason: MarketProcurementReadUnavailableReason };

const PATH = '/market-data/procurement';

function readUrl(): string {
  if (typeof window !== 'undefined') return PATH;
  return `${resolveApiBaseUrl()}/market/procurement?limit=25`;
}

function strings(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim());
}

function localizedText(value: unknown): value is MarketProcurementLocalizedText {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.en === undefined || typeof v.en === 'string') &&
    (v.pl === undefined || typeof v.pl === 'string') &&
    typeof v.fallback === 'string' &&
    Boolean(v.fallback.trim()) &&
    typeof v.fallbackLanguage === 'string' &&
    Boolean(v.fallbackLanguage.trim())
  );
}

function localizedNames(value: unknown): value is MarketProcurementLocalizedNames {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.en === undefined || strings(v.en)) &&
    (v.pl === undefined || strings(v.pl)) &&
    strings(v.fallback) &&
    typeof v.fallbackLanguage === 'string'
  );
}

export function isMarketProcurementNotice(value: unknown): value is MarketProcurementNotice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const n = value as Record<string, any>;
  return (
    typeof n.procurementKey === 'string' &&
    n.procurementKey.startsWith('mktproc:1:') &&
    typeof n.publicationNumber === 'string' &&
    /^\d{6}-\d{4}$/.test(n.publicationNumber) &&
    typeof n.publicationDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}[+-]\d{2}:\d{2}$/.test(n.publicationDate) &&
    typeof n.noticeType === 'string' &&
    localizedText(n.title) &&
    localizedNames(n.buyerNames) &&
    strings(n.buyerCountries) &&
    n.buyerCountries.every((c: string) => /^[A-Z]{3}$/.test(c)) &&
    strings(n.cpvCodes) &&
    n.cpvCodes.every((c: string) => /^\d{8}$/.test(c)) &&
    (n.totalValue === null || (typeof n.totalValue === 'number' && Number.isFinite(n.totalValue))) &&
    (n.totalValueCurrency === null || /^[A-Z]{3}$/.test(n.totalValueCurrency)) &&
    ((n.totalValue === null && n.totalValueCurrency === null) ||
      (n.totalValue !== null && n.totalValueCurrency !== null)) &&
    strings(n.deadlineDates) &&
    strings(n.deadlineTimes) &&
    n.provider === 'TED' &&
    n.sourceClass === 'PROCUREMENT_NOTICE' &&
    typeof n.retrievalId === 'string' &&
    Boolean(n.retrievalId.trim()) &&
    typeof n.retainedAt === 'string' &&
    Number.isFinite(Date.parse(n.retainedAt)) &&
    typeof n.snapshotContentAddress === 'string' &&
    /^[0-9a-f]{64}$/.test(n.snapshotContentAddress) &&
    n.freshnessBasis === 'RETAINED_ONLY'
  );
}

export async function readMarketProcurement(): Promise<MarketProcurementReadResult> {
  let response: Response;
  try {
    response = await fetch(readUrl(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
      headers: { accept: 'application/json' },
    });
  } catch {
    return { kind: 'UNAVAILABLE', reason: 'NO_READ_ENDPOINT' };
  }
  if (!response.ok) return { kind: 'UNAVAILABLE', reason: 'NO_READ_ENDPOINT' };

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { kind: 'UNAVAILABLE', reason: 'NO_DISPLAYABLE_PROCUREMENT' };
  }
  if (!Array.isArray(payload)) return { kind: 'UNAVAILABLE', reason: 'NO_DISPLAYABLE_PROCUREMENT' };
  if (payload.length === 0) return { kind: 'UNAVAILABLE', reason: 'NO_RETAINED_PROCUREMENT' };

  const notices = payload.filter(isMarketProcurementNotice);
  if (notices.length === 0)
    return { kind: 'UNAVAILABLE', reason: 'NO_DISPLAYABLE_PROCUREMENT' };
  return { kind: 'PROCUREMENT', notices };
}

export function procurementTitle(notice: MarketProcurementNotice, locale: MktLocale): string {
  return (locale === 'pl' ? notice.title.pl : notice.title.en) ?? notice.title.fallback;
}

export function procurementBuyerNames(
  notice: MarketProcurementNotice,
  locale: MktLocale,
): readonly string[] {
  return (locale === 'pl' ? notice.buyerNames.pl : notice.buyerNames.en) ??
    notice.buyerNames.fallback;
}

export function procurementSourceHref(
  notice: MarketProcurementNotice,
  locale: MktLocale,
): string | null {
  return (
    (locale === 'pl' ? notice.sourceLinks.htmlPl : notice.sourceLinks.htmlEn) ??
    notice.sourceLinks.htmlEn ??
    notice.sourceLinks.htmlPl ??
    notice.sourceLinks.xml ??
    null
  );
}
