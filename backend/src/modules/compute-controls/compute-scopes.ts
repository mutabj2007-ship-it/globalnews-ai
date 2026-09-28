import { isIP } from 'node:net';

/**
 * Meter scope keys and buckets (F 01 L-3, L-4, L-8).
 *
 * Identity is SERVER-RESOLVED: the account id from the validated session and the client
 * IP the trusted proxy attests (`request.ip` under the landed TRUST_PROXY validator) —
 * never a body field, a header the caller chose, or a `NEXT_PUBLIC_*` value (L-3).
 */

export const GLOBAL_SCOPE = 'global';
export const accountScope = (accountId: string): string => `acct:${accountId}`;
export const providerScope = (provider: string): string => `provider:${provider}`;
export const concurrencyScope = (base: string): string => `conc:${base}`;
export const breakerScope = (kind: 'fail' | 'ok', provider: string): string =>
  `brk:${kind}:${provider}`;

/**
 * L-4 — IPv6 is keyed by /64 prefix, not address (a /128 is free to rotate). IPv4 is keyed by
 * address. An IPv4-mapped IPv6 address is keyed as the IPv4 it carries. Anything unparseable
 * shares ONE `ip:unknown` bucket — the safe direction (it can only be refused sooner).
 */
export function clientIpScope(ip: string | undefined | null): string {
  const raw = (ip ?? '').trim();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(raw);
  const candidate = mapped ? mapped[1]! : raw;
  const family = isIP(candidate);
  if (family === 4) return `ip:v4:${candidate}`;
  if (family === 6) return `ip:v6:${ipv6Prefix64(candidate)}::/64`;
  return 'ip:unknown';
}

function ipv6Prefix64(address: string): string {
  const [head, tail] = address.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const missing = tail === undefined ? 0 : 8 - headParts.length - tailParts.length;
  const full = [...headParts, ...Array<string>(Math.max(0, missing)).fill('0'), ...tailParts];
  return full
    .slice(0, 4)
    .map((h) => (parseInt(h || '0', 16) || 0).toString(16))
    .join(':');
}

/** Hour and UTC-day buckets (F 06 ASK_METER_BUCKET_S = 3600); concurrency uses a fixed bucket. */
export const hourBucket = (now: Date): Date =>
  new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
export const dayBucket = (now: Date): Date =>
  new Date(Math.floor(now.getTime() / 86_400_000) * 86_400_000);
export const windowBucket = (now: Date, windowS: number): Date =>
  new Date(Math.floor(now.getTime() / (windowS * 1000)) * windowS * 1000);
export const CONCURRENCY_BUCKET = new Date(0);

/** F 02 T-5 — no unbounded await on the request path; the control store fails closed on timeout. */
export async function withDeadline<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`CONTROL_STORE_DEADLINE:${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
