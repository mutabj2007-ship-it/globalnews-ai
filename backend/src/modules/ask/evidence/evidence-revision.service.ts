import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';

/**
 * BETA-SIMPLE-ASK-SAND-1 §6 — the evidence revision.
 *
 * This is the field that keeps stored-result reuse honest. Without
 * it, "do not regenerate just because the user revisited a route"
 * quietly becomes "serve the same answer forever", which would score
 * perfectly on cost and fail the product.
 *
 * WHAT A REVISION IS HERE: a coarse marker of how fresh the stored
 * article corpus is for a given geography. It is derived from the
 * newest `fetchedAt` among persisted Articles in scope, rounded down
 * to a bucket. When new articles arrive the marker advances, every
 * fingerprint built from it changes, and the next identical question
 * recomputes against the newer evidence.
 *
 * WHY BUCKETED RATHER THAN THE RAW TIMESTAMP: `max(fetchedAt)` moves
 * on literally every ingest, so using it raw would invalidate the
 * cache continuously and reuse would approach zero — the opposite of
 * what §6 asks for. The bucket makes the revision stable across a
 * period of ingest activity while still advancing as the corpus
 * genuinely moves.
 *
 * WHAT IT IS NOT: it is not a content hash of the evidence set, and
 * it does not claim that two results sharing a revision were built
 * from byte-identical evidence. A content hash over the retrieved
 * article set would be stronger, but it can only be computed AFTER
 * retrieval — and the whole point of §6 is to decide whether to
 * retrieve at all. This is the strongest signal available before
 * paying that cost, and the bucket size is the honest knob for how
 * much staleness is acceptable.
 */

/** Default bucket. One hour of ingest activity shares one revision. */
const DEFAULT_BUCKET_MINUTES = 60;

/** Used when the corpus is empty for a scope — a real, stable state, not an error. */
const EMPTY_CORPUS_REVISION = 'corpus-empty';

@Injectable()
export class EvidenceRevisionService {
  private readonly logger = new Logger(EvidenceRevisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private bucketMinutes(): number {
    const raw = this.config.get<string>('EVIDENCE_REVISION_BUCKET_MINUTES');
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_BUCKET_MINUTES;
    return parsed;
  }

  /**
   * The current evidence revision for a geography, or for the global
   * corpus when no geography is given.
   *
   * FAILS CLOSED, unlike the stored-result lookup which fails open.
   * The asymmetry is deliberate and is the more important of the two
   * decisions in this file:
   *
   *   - a failed stored-result LOOKUP costs money (we recompute) but
   *     is always correct, so it fails open;
   *   - a failed REVISION lookup, if it fell back to a fixed value,
   *     would make every stored result look current forever and
   *     serve stale answers indefinitely. So on failure this returns
   *     a value derived from the current clock, which is guaranteed
   *     to differ from any previously stored revision. The cost is
   *     recomputation; the alternative is silently wrong answers.
   */
  async currentRevision(countryCode?: string): Promise<string> {
    try {
      const newest = await this.prisma.article.findFirst({
        where: countryCode ? { countryCode: countryCode.toUpperCase() } : {},
        orderBy: { fetchedAt: 'desc' },
        select: { fetchedAt: true },
      });

      if (!newest) {
        return `${this.scopeLabel(countryCode)}:${EMPTY_CORPUS_REVISION}`;
      }

      return `${this.scopeLabel(countryCode)}:${this.bucket(newest.fetchedAt)}`;
    } catch (error) {
      this.logger.warn(
        `Evidence revision lookup failed; using a clock-derived revision so nothing stale is reused. ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return `${this.scopeLabel(countryCode)}:unknown:${Date.now()}`;
    }
  }

  private scopeLabel(countryCode?: string): string {
    return countryCode ? countryCode.toUpperCase() : 'GLOBAL';
  }

  /** Floors a timestamp to the configured bucket, as a stable ISO-like string. */
  private bucket(at: Date): string {
    const bucketMs = this.bucketMinutes() * 60 * 1000;
    const floored = Math.floor(at.getTime() / bucketMs) * bucketMs;
    return new Date(floored).toISOString();
  }
}
