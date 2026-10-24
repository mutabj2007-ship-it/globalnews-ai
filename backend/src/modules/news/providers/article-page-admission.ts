import { admitGlobalVoicesPage, type GvVerdict } from '../rights/gv-v6-admission';

/**
 * E1 V6 — THE ARTICLE-PAGE READ BEHIND A PAGE-GATED FEED (Global Voices).
 *
 * The feed item alone cannot be admitted: its dc:creator is wrong in 0/5 measured items and the
 * provenance markers live on the page. So each item's own page is read ONCE, the V6 gate decides, and
 * only the verdict is kept — never the page.
 *
 * POLITE BY CONSTRUCTION:
 *   - at most ONE page read per `minIntervalMs` across the whole process (globalvoices.org robots.txt
 *     declares Crawl-delay: 10), and at most `maxReadsPerCall` per collection, so a reader's request
 *     never waits on a crawl;
 *   - a verdict is cached for `ttlMs` (a page edited to add a provenance note is re-read in time);
 *   - a failed read caches nothing and is retried on a later call.
 *
 * FAIL CLOSED: an item with no verdict yet is NOT emitted. It appears on a later collection, after
 * its page has been read — never before.
 */
export const PAGE_MIN_INTERVAL_MS = 10_000;
export const PAGE_VERDICT_TTL_MS = 6 * 60 * 60 * 1000;
export const PAGE_MAX_READS_PER_CALL = 1;
export const PAGE_MAX_BYTES = 1_500_000;
export const PAGE_TIMEOUT_MS = 8_000;

export type PageFetch = (
  url: string,
  init: { signal: AbortSignal; headers: Record<string, string> },
) => Promise<Response>;

export interface ArticlePageAdmissionOptions {
  readonly fetchImpl?: PageFetch;
  readonly now?: () => number;
  readonly minIntervalMs?: number;
  readonly ttlMs?: number;
  readonly maxReadsPerCall?: number;
  readonly readBody?: (response: Response) => Promise<string>;
}

export class ArticlePageAdmission {
  private readonly verdicts = new Map<
    string,
    { readonly verdict: GvVerdict; readonly at: number }
  >();
  private lastReadAt = Number.NEGATIVE_INFINITY;
  private readsAttempted = 0;
  private readsFailed = 0;

  constructor(private readonly options: ArticlePageAdmissionOptions = {}) {}

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private cached(url: string): GvVerdict | null {
    const hit = this.verdicts.get(url);
    if (!hit) return null;
    if (this.now() - hit.at > (this.options.ttlMs ?? PAGE_VERDICT_TTL_MS)) {
      this.verdicts.delete(url);
      return null;
    }
    return hit.verdict;
  }

  /**
   * The verdict for each url that has one (cached, or read in this call within the budget). Urls
   * without a verdict are absent from the result — the caller emits nothing for them.
   */
  async verdictsFor(urls: readonly string[]): Promise<Map<string, GvVerdict>> {
    const out = new Map<string, GvVerdict>();
    let reads = 0;
    for (const url of urls) {
      const hit = this.cached(url);
      if (hit) {
        out.set(url, hit);
        continue;
      }
      if (reads >= (this.options.maxReadsPerCall ?? PAGE_MAX_READS_PER_CALL)) continue;
      if (this.now() - this.lastReadAt < (this.options.minIntervalMs ?? PAGE_MIN_INTERVAL_MS))
        continue;
      reads += 1;
      const verdict = await this.read(url);
      if (verdict) {
        this.verdicts.set(url, { verdict, at: this.now() });
        out.set(url, verdict);
      }
    }
    return out;
  }

  private async read(url: string): Promise<GvVerdict | null> {
    this.lastReadAt = this.now();
    this.readsAttempted += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
    try {
      const fetchImpl = this.options.fetchImpl ?? (fetch as unknown as PageFetch);
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: 'text/html' },
      });
      if (!response.ok) throw new Error(`page responded ${response.status}`);
      const html = this.options.readBody
        ? await this.options.readBody(response)
        : await response.text();
      if (Buffer.byteLength(html, 'utf8') > PAGE_MAX_BYTES)
        throw new Error('page exceeds the byte limit');
      return admitGlobalVoicesPage(url, html);
    } catch {
      this.readsFailed += 1;
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Observed counters only, for health. Never probes. */
  stats(): {
    readonly cachedVerdicts: number;
    readonly readsAttempted: number;
    readonly readsFailed: number;
  } {
    return {
      cachedVerdicts: this.verdicts.size,
      readsAttempted: this.readsAttempted,
      readsFailed: this.readsFailed,
    };
  }
}
