import { createHash } from 'node:crypto';
import {
  parseStrictJson,
  type MarketRetainedProcurementNotice,
} from '@globalnews-ai/shared';

export const TED_MARKET_ALPHA_R1_QUERY =
  'publication-date=20260924 AND buyer-country IN (POL) AND notice-type=cn-standard SORT BY publication-number DESC';

export const TED_MARKET_ALPHA_R1_FIELDS = [
  'publication-number',
  'publication-date',
  'notice-type',
  'notice-title',
  'buyer-name',
  'buyer-country',
  'classification-cpv',
  'total-value',
  'total-value-cur',
  'deadline-receipt-tender-date-lot',
  'deadline-receipt-tender-time-lot',
] as const;

export const TED_MARKET_ALPHA_R1_LIMIT = 20;
export const TED_MARKET_ALPHA_R1_ENDPOINT_ID = 'TED_SEARCH_V3_PROCUREMENT_ALPHA_R1';
export const TED_MARKET_ALPHA_R1_REQUEST_PATH = 'v3/notices/search';
export const TED_MARKET_ALPHA_R1_PARSER_ID = 'ted-procurement-search-v3';
export const TED_MARKET_ALPHA_R1_PARSER_VERSION = '1';
export const MAX_TED_MARKET_ALPHA_R1_BYTES = 4 * 1024 * 1024;

export interface TedProcurementCapture {
  retrievalId: string;
  providerId: string;
  endpointId: string;
  requestPath: string;
  parameters: unknown;
  requestedAt: Date;
  retrievedAt: Date;
  httpStatus: number;
  mediaType: string;
  byteLength: number;
  contentAddress: string | null;
  completeness: string;
  admissibility: string;
  refusalKey: string | null;
  parserId: string | null;
  parserVersion: string | null;
  parsedAt: Date | null;
  rightsGrade: string;
  rightsInstrumentRef: string;
  payloadRetentionPermitted: boolean;
  payload: {
    bytes: Uint8Array | null;
    storageState: string;
    byteLength: number;
    mediaType: string;
    contentAddress: string;
  } | null;
}

export class InvalidTedProcurementCapture extends Error {}

function refuse(reason: string): never {
  throw new InvalidTedProcurementCapture(reason);
}

function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) refuse('EXPECTED_OBJECT');
  return value as Record<string, any>;
}

function string(value: unknown, reason: string, max = 20_000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) refuse(reason);
  return value;
}

function optionalStrings(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function exactParameterMap(value: unknown): Map<string, string> {
  if (!Array.isArray(value)) refuse('REQUEST_PARAMETERS_MISSING');
  const map = new Map<string, string>();
  for (const raw of value) {
    const entry = object(raw);
    if (
      typeof entry.key !== 'string' ||
      typeof entry.value !== 'string' ||
      map.has(entry.key)
    ) {
      refuse('REQUEST_PARAMETERS_INVALID');
    }
    map.set(entry.key, entry.value);
  }

  const expected = new Map<string, string>([
    ['method', 'POST'],
    ['query', TED_MARKET_ALPHA_R1_QUERY],
    ['fields', JSON.stringify(TED_MARKET_ALPHA_R1_FIELDS)],
    ['page', '1'],
    ['limit', String(TED_MARKET_ALPHA_R1_LIMIT)],
    ['scope', 'ALL'],
    ['checkQuerySyntax', 'false'],
    ['paginationMode', 'PAGE_NUMBER'],
    ['onlyLatestVersions', 'true'],
  ]);

  if (map.size !== expected.size) refuse('REQUEST_PARAMETERS_DRIFT');
  for (const [key, expectedValue] of expected) {
    if (map.get(key) !== expectedValue) refuse(`REQUEST_PARAMETERS_DRIFT:${key}`);
  }

  return map;
}

function titlePair(value: unknown): MarketRetainedProcurementNotice['title'] {
  const source = object(value);
  const en = typeof source.eng === 'string' && source.eng.trim() ? source.eng : undefined;
  const pl = typeof source.pol === 'string' && source.pol.trim() ? source.pol : undefined;
  if (!en && !pl) refuse('NOTICE_TITLE_UNAVAILABLE');
  return {
    ...(en ? { en } : {}),
    ...(pl ? { pl } : {}),
  };
}

function buyerNames(value: unknown): MarketRetainedProcurementNotice['buyerNames'] {
  const source = object(value);
  const en = optionalStrings(source.eng);
  const pl = optionalStrings(source.pol);
  const firstOther = Object.keys(source)
    .sort()
    .map((key) => optionalStrings(source[key]))
    .find((items) => items.length > 0);

  if (en.length === 0 && pl.length === 0 && !firstOther) refuse('BUYER_NAME_UNAVAILABLE');

  return {
    ...(en.length ? { en } : {}),
    ...(pl.length ? { pl } : {}),
    ...(firstOther ? { source: firstOther } : {}),
  };
}

function sourceUrl(linksValue: unknown): string {
  const links = object(linksValue);
  const candidates = [
    links.htmlDirect?.ENG,
    links.htmlDirect?.POL,
    links.html?.ENG,
    links.html?.POL,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (candidates.length === 0) refuse('NOTICE_SOURCE_URL_UNAVAILABLE');
  const url = new URL(candidates[0]);
  if (url.protocol !== 'https:' || url.hostname !== 'ted.europa.eu') {
    refuse('NOTICE_SOURCE_URL_ORIGIN');
  }
  return url.toString();
}

function uniqueSingle(value: unknown): string | null {
  const values = [...new Set(optionalStrings(value))];
  return values.length === 1 ? values[0] : null;
}

export function inspectTedProcurementCapture(
  capture: TedProcurementCapture,
): readonly MarketRetainedProcurementNotice[] {
  if (
    capture.providerId !== 'TED' ||
    capture.endpointId !== TED_MARKET_ALPHA_R1_ENDPOINT_ID ||
    capture.requestPath !== TED_MARKET_ALPHA_R1_REQUEST_PATH ||
    capture.admissibility !== 'ADMITTED' ||
    capture.completeness !== 'COMPLETE' ||
    capture.refusalKey !== null ||
    capture.httpStatus !== 200 ||
    capture.parserId !== TED_MARKET_ALPHA_R1_PARSER_ID ||
    capture.parserVersion !== TED_MARKET_ALPHA_R1_PARSER_VERSION ||
    !capture.parsedAt ||
    capture.rightsGrade !== 'E-5' ||
    !capture.rightsInstrumentRef.trim() ||
    !capture.payloadRetentionPermitted
  ) {
    refuse('CAPTURE_NOT_ADMITTED');
  }

  exactParameterMap(capture.parameters);

  if (
    !Number.isFinite(capture.requestedAt.getTime()) ||
    !Number.isFinite(capture.retrievedAt.getTime()) ||
    capture.requestedAt > capture.retrievedAt
  ) {
    refuse('CAPTURE_TIMESTAMPS_INVALID');
  }

  const mediaType = capture.mediaType.split(';')[0].trim().toLowerCase();
  if (mediaType !== 'application/json') refuse('CAPTURE_MEDIA_TYPE');

  const bytes = capture.payload?.bytes;
  if (
    !bytes ||
    capture.payload?.storageState !== 'RETAINED' ||
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_TED_MARKET_ALPHA_R1_BYTES ||
    bytes.byteLength !== capture.byteLength ||
    bytes.byteLength !== capture.payload.byteLength ||
    capture.payload.mediaType.split(';')[0].trim().toLowerCase() !== 'application/json'
  ) {
    refuse('CAPTURE_BYTES_UNAVAILABLE');
  }

  const digest = createHash('sha256').update(bytes).digest('hex');
  if (
    !capture.contentAddress ||
    digest !== capture.contentAddress ||
    capture.payload.contentAddress !== capture.contentAddress
  ) {
    refuse('CAPTURE_DIGEST_MISMATCH');
  }

  const parsed = parseStrictJson(bytes);
  if (!parsed.ok) refuse('CAPTURE_JSON_REFUSED');
  const body = object(parsed.value);

  if (
    body.timedOut !== false ||
    !Number.isInteger(body.totalNoticeCount) ||
    body.totalNoticeCount < 1 ||
    !Array.isArray(body.notices) ||
    body.notices.length < 1 ||
    body.notices.length > TED_MARKET_ALPHA_R1_LIMIT
  ) {
    refuse('TED_RESPONSE_ENVELOPE');
  }

  const seen = new Set<string>();
  return body.notices.map((raw: unknown): MarketRetainedProcurementNotice => {
    const notice = object(raw);
    const noticeId = string(notice['publication-number'], 'NOTICE_ID', 32);
    if (!/^\d{6}-\d{4}$/.test(noticeId) || seen.has(noticeId)) {
      refuse('NOTICE_IDENTITY_INVALID');
    }
    seen.add(noticeId);

    const publicationDate = string(notice['publication-date'], 'PUBLICATION_DATE', 32);
    if (!/^2026-09-24(?:[+-]\d{2}:\d{2})?$/.test(publicationDate)) {
      refuse('PUBLICATION_DATE_OUTSIDE_CAPTURE_SCOPE');
    }

    const noticeType = string(notice['notice-type'], 'NOTICE_TYPE', 64);
    if (noticeType !== 'cn-standard') refuse('NOTICE_TYPE_OUTSIDE_SCOPE');

    const countries = [...new Set(optionalStrings(notice['buyer-country']))];
    if (countries.length !== 1 || countries[0] !== 'POL') {
      refuse('BUYER_COUNTRY_OUTSIDE_SCOPE');
    }

    const cpvCodes = [...new Set(optionalStrings(notice['classification-cpv']))];
    if (
      cpvCodes.length === 0 ||
      cpvCodes.some((code) => !/^\d{8}$/.test(code))
    ) {
      refuse('CPV_INVALID');
    }

    const rawValue = notice['total-value'];
    const totalValue =
      rawValue === undefined || rawValue === null
        ? null
        : typeof rawValue === 'number' && Number.isFinite(rawValue)
          ? rawValue
          : refuse('TOTAL_VALUE_INVALID');

    const currencies = [...new Set(optionalStrings(notice['total-value-cur']))];
    const currency =
      totalValue === null
        ? null
        : currencies.length === 1 && /^[A-Z]{3}$/.test(currencies[0])
          ? currencies[0]
          : refuse('TOTAL_VALUE_CURRENCY_INVALID');

    return {
      portalReference: {
        portalId: 'TED',
        noticeId,
      },
      artifactClass: 'PROCUREMENT_NOTICE',
      publicationDate,
      noticeType,
      title: titlePair(notice['notice-title']),
      buyerNames: buyerNames(notice['buyer-name']),
      buyerCountryIso3: 'POL',
      cpvCodes,
      totalValue,
      currency,
      deadlineDate: uniqueSingle(notice['deadline-receipt-tender-date-lot']),
      deadlineTime: uniqueSingle(notice['deadline-receipt-tender-time-lot']),
      sourceUrl: sourceUrl(notice.links),
      providerId: 'TED',
      retainedAt: capture.retrievedAt.toISOString(),
      retrievalId: capture.retrievalId,
      contentAddress: capture.contentAddress,
      freshnessBasis: 'RETAINED_ONLY',
    };
  });
}
