import { createHash } from 'node:crypto';
import {
  marketProcurementKey,
  parseStrictJson,
  type MarketProcurementLocalizedNames,
  type MarketProcurementLocalizedText,
  type MarketProcurementNotice,
} from '@globalnews-ai/shared';
import { RIGHTS_RECORDS } from './market-acquisition-declarations';
import { TED_PROCUREMENT_R1 } from './ted-procurement.reviewed';

export const MAX_TED_PROCUREMENT_BYTES = 4 * 1024 * 1024;

export interface TedProcurementRetainedCapture {
  readonly retrievalId: string;
  readonly providerId: string;
  readonly endpointId: string;
  readonly requestPath: string;
  readonly parameters: unknown;
  readonly requestedAt: Date;
  readonly retrievedAt: Date;
  readonly httpStatus: number;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly contentAddress: string | null;
  readonly completeness: string;
  readonly admissibility: string;
  readonly refusalKey: string | null;
  readonly parserId: string | null;
  readonly parserVersion: string | null;
  readonly rightsGrade: string;
  readonly rightsInstrumentRef: string;
  readonly payloadRetentionPermitted: boolean;
  readonly payload: {
    readonly bytes: Uint8Array | null;
    readonly storageState: string;
    readonly byteLength: number;
    readonly contentAddress: string;
  } | null;
}

export class InvalidTedProcurementCapture extends Error {}

function refuse(reason: string): never {
  throw new InvalidTedProcurementCapture(reason);
}

function object(value: unknown, reason: string): Record<string, any> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) refuse(reason);
  return value as Record<string, any>;
}

function string(value: unknown, reason: string, max = 16_384): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) refuse(reason);
  return value;
}

function stringArray(value: unknown, maxItems: number, pattern?: RegExp): string[] {
  if (!Array.isArray(value) || value.length > maxItems) return [];
  const result: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string' || !raw.trim() || raw.length > 4096) continue;
    if (pattern && !pattern.test(raw)) continue;
    if (!result.includes(raw)) result.push(raw);
  }
  return result;
}

function localizedText(value: unknown): MarketProcurementLocalizedText {
  const source = object(value, 'NOTICE_TITLE_MISSING');
  const entries = Object.entries(source)
    .filter(([language, text]) => /^[a-z]{3}$/.test(language) && typeof text === 'string' && text.trim())
    .map(([language, text]) => [language, (text as string).trim()] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) refuse('NOTICE_TITLE_MISSING');

  const byLanguage = new Map(entries);
  const [fallbackLanguage, fallback] = entries[0];
  return {
    ...(byLanguage.get('eng') ? { en: byLanguage.get('eng') } : {}),
    ...(byLanguage.get('pol') ? { pl: byLanguage.get('pol') } : {}),
    fallback,
    fallbackLanguage,
  };
}

function localizedNames(value: unknown): MarketProcurementLocalizedNames {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { fallback: [], fallbackLanguage: 'und' };
  }
  const source = value as Record<string, unknown>;
  const entries = Object.entries(source)
    .filter(([language]) => /^[a-z]{3}$/.test(language))
    .map(([language, names]) => [language, stringArray(names, 50)] as const)
    .filter(([, names]) => names.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return { fallback: [], fallbackLanguage: 'und' };
  const byLanguage = new Map(entries);
  const [fallbackLanguage, fallback] = entries[0];
  return {
    ...(byLanguage.get('eng') ? { en: byLanguage.get('eng') } : {}),
    ...(byLanguage.get('pol') ? { pl: byLanguage.get('pol') } : {}),
    fallback,
    fallbackLanguage,
  };
}

function safeTedLink(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'ted.europa.eu') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function parametersArePinned(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const map = new Map<string, string>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const item = entry as Record<string, unknown>;
    if (typeof item.key !== 'string' || typeof item.value !== 'string' || map.has(item.key))
      return false;
    map.set(item.key, item.value);
  }
  const expected = new Map<string, string>([
    ['query', TED_PROCUREMENT_R1.query],
    ['fields', JSON.stringify(TED_PROCUREMENT_R1.fields)],
    ['page', String(TED_PROCUREMENT_R1.page)],
    ['limit', String(TED_PROCUREMENT_R1.limit)],
    ['scope', TED_PROCUREMENT_R1.scope],
    ['checkQuerySyntax', 'false'],
    ['paginationMode', TED_PROCUREMENT_R1.paginationMode],
    ['onlyLatestVersions', String(TED_PROCUREMENT_R1.onlyLatestVersions)],
  ]);
  return (
    map.size === expected.size &&
    [...expected].every(([key, expectedValue]) => map.get(key) === expectedValue)
  );
}

function parseNotice(
  raw: unknown,
  capture: TedProcurementRetainedCapture,
): MarketProcurementNotice {
  const notice = object(raw, 'NOTICE_NOT_OBJECT');
  const publicationNumber = string(notice['publication-number'], 'PUBLICATION_NUMBER_MISSING', 64);
  if (!/^\d{6}-\d{4}$/.test(publicationNumber)) refuse('PUBLICATION_NUMBER_INVALID');

  const publicationDate = string(notice['publication-date'], 'PUBLICATION_DATE_MISSING', 64);
  if (!/^\d{4}-\d{2}-\d{2}[+-]\d{2}:\d{2}$/.test(publicationDate))
    refuse('PUBLICATION_DATE_INVALID');

  const noticeType = string(notice['notice-type'], 'NOTICE_TYPE_MISSING', 128);
  const title = localizedText(notice['notice-title']);
  const buyerNames = localizedNames(notice['buyer-name']);
  const buyerCountries = stringArray(notice['buyer-country'], 32, /^[A-Z]{3}$/);
  if (buyerCountries.length === 0) refuse('BUYER_COUNTRY_MISSING');

  const cpvCodes = stringArray(notice['classification-cpv'], 256, /^\d{8}$/);
  const currencies = stringArray(notice['total-value-cur'], 16, /^[A-Z]{3}$/);
  const rawValue = notice['total-value'];
  const value =
    typeof rawValue === 'number' && Number.isFinite(rawValue) && currencies.length === 1
      ? rawValue
      : null;
  const currency = value === null ? null : currencies[0];

  const deadlineDates = stringArray(
    notice['deadline-receipt-tender-date-lot'],
    128,
    /^\d{4}-\d{2}-\d{2}[+-]\d{2}:\d{2}$/,
  );
  const deadlineTimes = stringArray(
    notice['deadline-receipt-tender-time-lot'],
    128,
    /^\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
  );

  const links =
    notice.links && typeof notice.links === 'object' && !Array.isArray(notice.links)
      ? (notice.links as Record<string, any>)
      : {};
  const sourceLinks = {
    ...(safeTedLink(links.html?.ENG) ? { htmlEn: safeTedLink(links.html?.ENG) } : {}),
    ...(safeTedLink(links.html?.POL) ? { htmlPl: safeTedLink(links.html?.POL) } : {}),
    ...(safeTedLink(links.xml?.MUL) ? { xml: safeTedLink(links.xml?.MUL) } : {}),
  };
  if (!sourceLinks.htmlEn && !sourceLinks.htmlPl && !sourceLinks.xml) refuse('SOURCE_LINK_MISSING');

  return {
    procurementKey: marketProcurementKey(publicationNumber),
    publicationNumber,
    publicationDate,
    noticeType,
    title,
    buyerNames,
    buyerCountries,
    cpvCodes,
    totalValue: value,
    totalValueCurrency: currency,
    deadlineDates,
    deadlineTimes,
    sourceLinks,
    provider: 'TED',
    sourceClass: 'PROCUREMENT_NOTICE',
    retrievalId: capture.retrievalId,
    retainedAt: capture.retrievedAt.toISOString(),
    snapshotContentAddress: capture.contentAddress!,
    freshnessBasis: 'RETAINED_ONLY',
  };
}

export function inspectTedProcurementCapture(
  capture: TedProcurementRetainedCapture,
): readonly MarketProcurementNotice[] {
  if (
    capture.providerId !== TED_PROCUREMENT_R1.providerId ||
    capture.endpointId !== TED_PROCUREMENT_R1.endpointId ||
    capture.requestPath !== TED_PROCUREMENT_R1.requestPath ||
    capture.admissibility !== 'ADMITTED' ||
    capture.completeness !== 'COMPLETE' ||
    capture.refusalKey !== null ||
    capture.httpStatus !== 200 ||
    capture.parserId !== TED_PROCUREMENT_R1.parserId ||
    capture.parserVersion !== TED_PROCUREMENT_R1.parserVersion ||
    capture.rightsGrade !== 'E-5' ||
    capture.rightsInstrumentRef !== RIGHTS_RECORDS.TED.instrument ||
    !capture.payloadRetentionPermitted ||
    capture.mediaType.split(';')[0].trim().toLowerCase() !== 'application/json' ||
    !capture.contentAddress ||
    !parametersArePinned(capture.parameters) ||
    !Number.isFinite(capture.requestedAt.getTime()) ||
    !Number.isFinite(capture.retrievedAt.getTime()) ||
    capture.requestedAt > capture.retrievedAt ||
    capture.payload?.storageState !== 'RETAINED' ||
    !capture.payload.bytes ||
    capture.payload.contentAddress !== capture.contentAddress ||
    capture.payload.byteLength !== capture.byteLength ||
    capture.payload.bytes.length !== capture.byteLength ||
    capture.payload.bytes.length === 0 ||
    capture.payload.bytes.length > MAX_TED_PROCUREMENT_BYTES ||
    createHash('sha256').update(capture.payload.bytes).digest('hex') !== capture.contentAddress
  ) {
    refuse('CAPTURE_NOT_ADMISSIBLE');
  }

  const parsed = parseStrictJson(capture.payload.bytes);
  if (!parsed.ok) refuse('MALFORMED_RETAINED_JSON');
  const envelope = object(parsed.value, 'MALFORMED_RESPONSE');
  if (envelope.timedOut !== false) refuse('TED_QUERY_TIMED_OUT');
  if (!Number.isInteger(envelope.totalNoticeCount) || envelope.totalNoticeCount < 0)
    refuse('TOTAL_NOTICE_COUNT_INVALID');
  if (!Array.isArray(envelope.notices) || envelope.notices.length > TED_PROCUREMENT_R1.limit)
    refuse('NOTICE_SET_INVALID');

  const notices = envelope.notices.map((notice: unknown) => parseNotice(notice, capture));
  const keys = notices.map((notice) => notice.procurementKey);
  if (new Set(keys).size !== keys.length) refuse('DUPLICATE_NOTICE_IDENTITY');
  return notices;
}
